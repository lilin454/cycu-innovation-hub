import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/settings";

/** /robots.txt：讓搜尋引擎收錄公開頁面，後台與 API 不收錄，並告訴它網站地圖在哪裡 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getBaseUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/files/docs/"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
