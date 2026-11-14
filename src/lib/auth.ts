import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "./db";
import { SESSION_COOKIE } from "./constants";

const SESSION_DAYS = 7;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ACCOUNT_FAILURES = 5;
const MAX_IP_FAILURES = 20;
// 帳號不存在時也跑一次雜湊比對，避免從回應時間推測帳號是否存在
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8rYy4R1rj0Jt8eG2j7mXqk1b0lQy2W";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

function sha256(v: string): string {
  return crypto.createHash("sha256").update(v).digest("hex");
}

function secureCookie(): boolean {
  return (process.env.SITE_URL ?? "").startsWith("https://");
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(accountRaw: string, password: string): Promise<LoginResult> {
  const account = accountRaw.trim().toLowerCase();
  if (!account || !password) return { ok: false, error: "請輸入帳號與密碼。" };
  if (account.length > 64 || password.length > 200) return { ok: false, error: "帳號或密碼錯誤。" };

  const ip = await clientIp();
  const since = new Date(Date.now() - WINDOW_MS);
  const acctKey = `acct:${account}`;
  const ipKey = `ip:${ip}`;
  const [acctFails, ipFails] = await Promise.all([
    db.loginAttempt.count({ where: { key: acctKey, success: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { key: ipKey, success: false, createdAt: { gte: since } } }),
  ]);
  if (acctFails >= MAX_ACCOUNT_FAILURES || ipFails >= MAX_IP_FAILURES) {
    return { ok: false, error: "登入失敗次數過多，請 15 分鐘後再試。" };
  }

  const user = await db.user.findUnique({ where: { account } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    await db.loginAttempt.createMany({
      data: [
        { key: acctKey, success: false },
        { key: ipKey, success: false },
      ],
    });
    const left = MAX_ACCOUNT_FAILURES - acctFails - 1;
    return {
      ok: false,
      error: left > 0 && left <= 2 ? `帳號或密碼錯誤（再錯 ${left} 次將暫時鎖定）。` : "帳號或密碼錯誤。",
    };
  }

  await db.loginAttempt.deleteMany({ where: { key: acctKey } });
  // 順手清掉過期資料
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } });
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  const h = await headers();
  await db.session.create({
    data: { tokenHash: sha256(token), userId: user.id, expiresAt, userAgent: h.get("user-agent")?.slice(0, 250) },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    expires: expiresAt,
  });
  return { ok: true };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = { id: string; account: string; displayName: string; role: "OWNER" | "EDITOR" };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const { id, account, displayName, role } = session.user;
  return { id, account, displayName, role };
});

/** 頁面用：未登入就導向登入頁 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** 頁面用：只有總管理員可以進入，其他管理員導回總覽 */
export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireAdmin();
  if (user.role !== "OWNER") redirect("/admin");
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("尚未登入或登入已過期，請重新登入。");
  }
}

/** Server Action / API 用：未登入直接丟錯 */
export async function assertAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
