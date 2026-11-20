import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/settings";

/** /robots.txt：讓搜尋引擎收錄公開頁面，後台與 API 不收錄，並告訴它網站地圖在哪裡 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getBaseUrl();
  return {
    // 帶查詢參數的網址（搜尋、篩選、排序、分頁、行事曆換月）組合多到數不完，爬蟲一直抓會耗掉資料庫額度，
    // 而且內容和主要頁面重複，所以不讓爬蟲抓；所有公告都在網站地圖裡，不會因此收錄不到
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/files/docs/", "/*?"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
