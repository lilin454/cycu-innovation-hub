import "server-only";
import { all, first, newId, nowIso, publicHost, run } from "./db";
import { getCurrentUser, type CurrentUser } from "./auth";

/**
 * AI 匯入接口用的 API 金鑰。
 * - 只有總管理員能在後台建立；金鑰只在建立當下顯示一次，資料庫只存 SHA-256 雜湊。
 * - 每次呼叫都重新確認建立者「現在仍是總管理員」，被降級或刪除後金鑰立即失效。
 * - 金鑰有到期日，也可以隨時停用。
 */

const PREFIX = "cycu_";

async function sha256(v: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createApiToken(userId: string, name: string, canPublish: boolean, canEditDrafts: boolean, days: number): Promise<string> {
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
  const token = `${PREFIX}${secret}`;
  const now = new Date();
  await run(
    `INSERT INTO "ApiToken" ("id", "name", "tokenHash", "prefix", "userId", "canPublish", "canEditDrafts", "createdAt", "expiresAt")
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(), name, await sha256(token), token.slice(0, PREFIX.length + 6), userId, canPublish ? 1 : 0, canEditDrafts ? 1 : 0,
    now.toISOString(), new Date(now.getTime() + days * 24 * 3600 * 1000).toISOString(),
  );
  return token;
}

export type ApiTokenRow = {
  id: string;
  name: string;
  prefix: string;
  canPublish: number;
  canEditDrafts: number;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  ownerName: string;
};

export async function listApiTokens(): Promise<ApiTokenRow[]> {
  try {
    return await all<ApiTokenRow>(
      `SELECT t."id", t."name", t."prefix", t."canPublish", t."canEditDrafts", t."createdAt", t."expiresAt", t."lastUsedAt", t."revokedAt", u."displayName" AS ownerName
       FROM "ApiToken" t JOIN "User" u ON u."id" = t."userId" ORDER BY t."createdAt" DESC LIMIT 50`,
    );
  } catch {
    return [];
  }
}

export type AiCaller = { user: CurrentUser; canPublish: boolean; canEditDrafts: boolean; via: "token" | "session" };

export class ApiAuthError extends Error {
  constructor(message: string, public status: 401 | 403) {
    super(message);
  }
}

/**
 * 確認呼叫者身分：
 * 1. Authorization: Bearer cycu_… 金鑰（給外部 AI 使用）
 * 2. 或已登入後台的總管理員（之後在後台內建「上傳檔案給 AI」時使用）；寫入操作要同源
 */
export async function authenticateAi(req: Request, write: boolean): Promise<AiCaller> {
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(auth);
  if (m) {
    const token = m[1];
    if (!token.startsWith(PREFIX) || !/^[a-z_]+[a-f0-9]{64}$/.test(token)) throw new ApiAuthError("API 金鑰格式不正確。", 401);
    const row = await first<{
      id: string; canPublish: number; canEditDrafts: number; expiresAt: string; revokedAt: string | null;
      userId: string; account: string; displayName: string; role: CurrentUser["role"];
    }>(
      `SELECT t."id" AS id, t."canPublish", t."canEditDrafts", t."expiresAt", t."revokedAt", u."id" AS userId, u."account", u."displayName", u."role"
       FROM "ApiToken" t JOIN "User" u ON u."id" = t."userId" WHERE t."tokenHash" = ?`,
      await sha256(token),
    );
    if (!row || row.revokedAt) throw new ApiAuthError("API 金鑰無效或已停用。", 401);
    if (row.expiresAt <= nowIso()) throw new ApiAuthError("API 金鑰已過期，請到後台「AI 匯入」重新建立。", 401);
    if (row.role !== "OWNER") throw new ApiAuthError("建立這把金鑰的帳號已不是總管理員，金鑰已失效。", 403);
    await run(`UPDATE "ApiToken" SET "lastUsedAt" = ? WHERE "id" = ?`, nowIso(), row.id);
    return {
      user: { id: row.userId, account: row.account, displayName: row.displayName, role: row.role },
      canPublish: row.canPublish === 1,
      canEditDrafts: row.canEditDrafts === 1,
      via: "token",
    };
  }

  const user = await getCurrentUser();
  if (!user) throw new ApiAuthError("需要 API 金鑰（Authorization: Bearer …），或先登入總管理員帳號。", 401);
  if (user.role !== "OWNER") throw new ApiAuthError("AI 匯入只開放給總管理員。", 403);
  if (write) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const originHost = origin ? new URL(origin).host : "";
    if (!origin || (originHost !== host && originHost !== publicHost())) throw new ApiAuthError("不允許的請求來源。", 403);
  }
  return { user, canPublish: true, canEditDrafts: true, via: "session" };
}
