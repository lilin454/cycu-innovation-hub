import type { MetadataRoute } from "next";
import { all } from "@/lib/db";
import { getBaseUrl, getSettings } from "@/lib/settings";

// 每次請求都重新產生，新公告發布後馬上就會出現在網站地圖裡
export const dynamic = "force-dynamic";

/** /sitemap.xml：列出所有公開頁面與已發布的公告，讓 Google 更快找到新活動 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [base, s] = await Promise.all([getBaseUrl(), getSettings()]);
  let rows: { slug: string; updatedAt: string }[] = [];
  try {
    rows = await all<{ slug: string; updatedAt: string }>(
      `SELECT "slug", "updatedAt" FROM "Announcement" WHERE "status" = 'PUBLISHED' ORDER BY "publishedAt" DESC LIMIT 5000`,
    );
  } catch {
    // 資料庫暫時無法連線時仍回傳固定頁面
  }
  const latest = rows.reduce((m, r) => (r.updatedAt > m ? r.updatedAt : m), "");
  const lastModified = latest ? new Date(latest) : new Date();

  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${base}/announcements`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/categories`, lastModified, changeFrequency: "weekly", priority: 0.5 },
  ];
  if (s.showCalendar !== "0") pages.push({ url: `${base}/calendar`, lastModified, changeFrequency: "daily", priority: 0.6 });
  if (s.showRecords !== "0") pages.push({ url: `${base}/records`, changeFrequency: "weekly", priority: 0.5 });
  if (s.showAbout !== "0") pages.push({ url: `${base}/about`, changeFrequency: "monthly", priority: 0.6 });

  return [
    ...pages,
    ...rows.map((r) => ({
      url: `${base}/a/${encodeURIComponent(r.slug)}`,
      lastModified: new Date(r.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
