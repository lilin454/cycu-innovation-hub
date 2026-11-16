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

/** SITE_URL 設定的對外網域（例如 cycuinnovation.vercel.app）；沒設定時回傳空字串 */
export function publicHost(): string {
  try {
    return new URL(getVar("SITE_URL")).host;
  } catch {
    return "";
  }
}

/**
 * 訪客的 IP。直接連到 Worker 時用 Cloudflare 提供的 cf-connecting-ip；
 * 經由對外網域（Vercel）轉進來時，cf-connecting-ip 會是 Vercel 的機器，要改看 Vercel 帶來的標頭。
 */
export function clientIpFrom(h: { get(name: string): string | null }): string {
  const viaProxy = Boolean(publicHost()) && h.get("x-forwarded-host") === publicHost();
  const forwarded = h.get("x-vercel-forwarded-for") || h.get("x-real-ip") || h.get("x-forwarded-for");
  const ip = (viaProxy && forwarded ? forwarded : h.get("cf-connecting-ip") || forwarded || "unknown").split(",")[0].trim();
  return ip.slice(0, 64) || "unknown";
}
