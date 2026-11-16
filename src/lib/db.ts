import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Cloudflare D1 存取層。
 * 每次都從當次請求的 context 取得連線（Workers 不能跨請求共用資料庫連線）。
 * 所有查詢都使用參數綁定，不做字串拼接。
 */
export function env(): CloudflareEnv {
  return getCloudflareContext().env;
}

type Param = string | number | null;

export function stmt(sql: string, ...params: Param[]): D1PreparedStatement {
  return env().DB.prepare(sql).bind(...params);
}

export async function all<T>(sql: string, ...params: Param[]): Promise<T[]> {
  const res = await stmt(sql, ...params).all<T>();
  return res.results ?? [];
}

export async function first<T>(sql: string, ...params: Param[]): Promise<T | null> {
  return (await stmt(sql, ...params).first<T>()) ?? null;
}

export async function run(sql: string, ...params: Param[]): Promise<number> {
  const res = await stmt(sql, ...params).run();
  return res.meta.changes ?? 0;
}

/** 多個寫入以交易方式一次送出；在 D1 的用量計算中只算一次查詢 */
export async function batch(statements: D1PreparedStatement[]): Promise<void> {
  if (statements.length) await env().DB.batch(statements);
}

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** 產生 IN (?, ?, ...) 用的佔位符 */
export function placeholders(n: number): string {
  return Array.from({ length: n }, () => "?").join(", ");
}

/** LIKE 查詢用：跳脫萬用字元 */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** 讀取環境變數／密鑰：正式環境來自 Worker 的 vars 與 secrets，本機開發來自 .dev.vars */
export function getVar(name: string): string {
  let fromBinding: unknown;
  try {
    fromBinding = (env() as unknown as Record<string, unknown>)[name];
  } catch {
    fromBinding = undefined;
  }
  const value = typeof fromBinding === "string" ? fromBinding : process.env[name];
  return (value ?? "").trim();
}
