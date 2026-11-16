import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { all, batch, clientIpFrom, first, getVar, newId, nowIso, run, stmt } from "./db";
import { SESSION_COOKIE } from "./constants";
import type { Role } from "./types";

const SESSION_DAYS = 7;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ACCOUNT_FAILURES = 5;
const MAX_IP_FAILURES = 20;
// Workers 的 Web Crypto 對 PBKDF2 的上限是 100,000 次
const PBKDF2_ITERATIONS = 100_000;

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (s: string) => new Uint8Array((s.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)));

async function sha256(v: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(v)));
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

/** 密碼雜湊格式：pbkdf2$<次數>$<salt hex>$<hash hex>（每個密碼使用獨立的隨機 salt） */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITERATIONS}$${hex(salt)}$${hex(await pbkdf2(password, salt, PBKDF2_ITERATIONS))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, saltHex, hashHex] = stored.split("$");
  const iterations = Number(iter);
  if (scheme !== "pbkdf2" || !Number.isInteger(iterations) || iterations < 1 || iterations > 100_000 || !saltHex || !hashHex) {
    return false;
  }
  const actual = await pbkdf2(password, fromHex(saltHex), iterations);
  const expected = fromHex(hashHex);
  if (actual.length !== expected.length) return false;
  // 固定時間比對，避免從回應時間推測內容
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

function secureCookie(): boolean {
  return getVar("SITE_URL").startsWith("https://");
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return clientIpFrom(h);
}

type UserRow = { id: string; account: string; passwordHash: string; displayName: string; role: Role };

/**
 * 第一次使用時的初始化：資料庫裡還沒有任何管理員時，
 * 以環境變數 ADMIN_ACCOUNT / ADMIN_PASSWORD 登入就會自動建立這位總管理員。
 * 一旦有任何管理員存在，這段就不再作用。
 */
async function bootstrapOwner(account: string, password: string): Promise<UserRow | null> {
  const envAccount = getVar("ADMIN_ACCOUNT").toLowerCase();
  const envPassword = getVar("ADMIN_PASSWORD");
  if (!envAccount || envPassword.length < 10) return null;
  if (account !== envAccount || password !== envPassword) return null;
  if (((await first<{ n: number }>(`SELECT COUNT(*) AS n FROM "User"`))?.n ?? 0) > 0) return null;
  const user: UserRow = {
    id: newId(),
    account,
    passwordHash: await hashPassword(password),
    displayName: getVar("ADMIN_DISPLAY_NAME") || "總管理員",
    role: "OWNER",
  };
  const now = nowIso();
  await run(
    `INSERT INTO "User" ("id", "account", "passwordHash", "displayName", "role", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)`,
    user.id, user.account, user.passwordHash, user.displayName, user.role, now, now,
  );
  return user;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(accountRaw: string, password: string): Promise<LoginResult> {
  const account = accountRaw.trim().toLowerCase();
  if (!account || !password) return { ok: false, error: "請輸入帳號與密碼。" };
  if (account.length > 64 || password.length > 200) return { ok: false, error: "帳號或密碼錯誤。" };

  const ip = await clientIp();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const acctKey = `acct:${account}`;
  const ipKey = `ip:${ip}`;
  const fails = await all<{ key: string; n: number }>(
    `SELECT "key", COUNT(*) AS n FROM "LoginAttempt" WHERE "key" IN (?, ?) AND "createdAt" >= ? GROUP BY "key"`,
    acctKey, ipKey, since,
  );
  const acctFails = fails.find((f) => f.key === acctKey)?.n ?? 0;
  const ipFails = fails.find((f) => f.key === ipKey)?.n ?? 0;
  if (acctFails >= MAX_ACCOUNT_FAILURES || ipFails >= MAX_IP_FAILURES) {
    return { ok: false, error: "登入失敗次數過多，請 15 分鐘後再試。" };
  }

  let user = await first<UserRow>(`SELECT "id", "account", "passwordHash", "displayName", "role" FROM "User" WHERE "account" = ?`, account);
  let valid = false;
  if (user) {
    valid = await verifyPassword(password, user.passwordHash);
  } else {
    user = await bootstrapOwner(account, password);
    valid = user !== null;
  }

  if (!user || !valid) {
    const now = nowIso();
    await batch([
      stmt(`INSERT INTO "LoginAttempt" ("id", "key", "createdAt") VALUES (?, ?, ?)`, newId(), acctKey, now),
      stmt(`INSERT INTO "LoginAttempt" ("id", "key", "createdAt") VALUES (?, ?, ?)`, newId(), ipKey, now),
    ]);
    const left = MAX_ACCOUNT_FAILURES - acctFails - 1;
    return {
      ok: false,
      error: left > 0 && left <= 2 ? `帳號或密碼錯誤（再錯 ${left} 次將暫時鎖定）。` : "帳號或密碼錯誤。",
    };
  }

  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  const now = nowIso();
  const h = await headers();
  await batch([
    stmt(`DELETE FROM "LoginAttempt" WHERE "key" = ? OR "createdAt" < ?`, acctKey, new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    stmt(`DELETE FROM "Session" WHERE "expiresAt" < ?`, now),
    stmt(
      `INSERT INTO "Session" ("id", "tokenHash", "userId", "expiresAt", "createdAt", "userAgent") VALUES (?, ?, ?, ?, ?, ?)`,
      newId(), await sha256(token), user.id, expiresAt.toISOString(), now, h.get("user-agent")?.slice(0, 250) ?? null,
    ),
  ]);
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
  if (token) await run(`DELETE FROM "Session" WHERE "tokenHash" = ?`, await sha256(token));
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = { id: string; account: string; displayName: string; role: Role };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return first<CurrentUser>(
    `SELECT u."id", u."account", u."displayName", u."role" FROM "Session" s JOIN "User" u ON u."id" = s."userId"
     WHERE s."tokenHash" = ? AND s."expiresAt" > ?`,
    await sha256(token),
    nowIso(),
  );
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
