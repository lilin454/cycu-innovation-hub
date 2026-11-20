// Worker 進入點：網站本體交給 OpenNext 產生的處理器，另外加上 Cron Trigger 的排程發布與自動下架，
// 以及公開頁面的快取標頭。
// @ts-ignore `.open-next/worker.js` 是建置時才產生的檔案
import { default as handler } from "./.open-next/worker.js";
import { lifecycleStatements } from "./src/lib/lifecycle-sql";

/**
 * 公開頁面的快取標頭。
 * 網站是經由 Vercel 轉進來的，Vercel 的 CDN 看到 s-maxage 就會把頁面暫存起來，
 * 同一頁在這段時間內被重複打開（真人或爬蟲），不會再回到這裡查資料庫。
 * 代價：後台改了內容，前台最多要等 s-maxage 的時間才會更新。
 * 只處理一般的 HTML 頁面與網站地圖；搜尋結果（?q=）、Next.js 的 RSC 請求、帶 Cookie 的回應都不快取。
 */
const PAGE_RE = /^\/(?:|announcements|categories|calendar|records|about|a\/[a-z0-9-]+)\/?$/;
// max-age=0：瀏覽器每次都重新向 CDN 確認，只有 CDN 會暫存
const PAGE_CACHE = "public, max-age=0, s-maxage=120, stale-while-revalidate=300";
const META_CACHE = "public, max-age=0, s-maxage=600, stale-while-revalidate=1800";
const MISS_CACHE = "public, max-age=0, s-maxage=60";

function withEdgeCache(request: Request, res: Response): Response {
  if (request.method !== "GET" && request.method !== "HEAD") return res;
  const url = new URL(request.url);
  const meta = url.pathname === "/sitemap.xml" || url.pathname === "/robots.txt";
  if (!meta && !PAGE_RE.test(url.pathname)) return res;
  if (url.searchParams.has("q") || url.searchParams.has("_rsc")) return res;
  if (request.headers.has("rsc") || request.headers.has("next-router-prefetch") || request.headers.has("next-action")) return res;
  if (res.headers.has("set-cookie")) return res;

  let value: string | null = null;
  if (res.status === 200) value = meta ? META_CACHE : PAGE_CACHE;
  else if (res.status === 404 && url.pathname.startsWith("/a/")) value = MISS_CACHE;
  if (!value) return res;

  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", value);
  return out;
}

/**
 * 直接用 workers.dev 網址（不是經由 Vercel 等對外網域轉進來）瀏覽時，轉到正式網址。
 * 在進入 Next.js 之前就處理掉，爬蟲或舊連結不會再讓這份網站去查資料庫，省下 D1 的每日讀取額度。
 * 經由 Vercel 轉進來的請求會帶 x-forwarded-host，不受影響；後台、API、檔案與靜態資源也維持原樣。
 */
function canonicalRedirect(request: Request, env: CloudflareEnv): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  if (!url.hostname.endsWith(".workers.dev") || request.headers.has("x-forwarded-host")) return null;
  if (/^\/(admin|api|_next|files|brand)(\/|$)/.test(url.pathname)) return null;
  let target: URL;
  try {
    target = new URL((env as unknown as Record<string, string | undefined>).SITE_URL ?? "");
  } catch {
    return null; // 沒有設定對外網址就不轉址
  }
  if (target.host === url.host) return null;
  return Response.redirect(new URL(url.pathname + url.search, target).toString(), 301);
}

export default {
  async fetch(request, env, ctx) {
    const redirect = canonicalRedirect(request, env);
    if (redirect) return redirect;
    return withEdgeCache(request, await handler.fetch(request, env, ctx));
  },

  /** 每 5 分鐘：發布到期的排程公告、下架已結束（或到了指定時間）的公告。只有兩句 SQL，不經過 Next.js。 */
  async scheduled(_event, env) {
    await env.DB.batch(lifecycleStatements(new Date()).map((s) => env.DB.prepare(s.sql).bind(...s.params)));
  },
} satisfies ExportedHandler<CloudflareEnv>;
