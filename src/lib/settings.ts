import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { all, getVar } from "./db";

export const SETTING_DEFAULTS = {
  siteName: "中原大學創新創業發展社",
  siteShortName: "創創社｜活動公告平台",
  siteNameEn: "CYCU Innovation & Entrepreneurship Development Club",
  logoUrl: "/brand/logo.jpg",
  heroTagline: "讓創意發生，讓想法走進現場。",
  heroIntro:
    "創創社把校內外的競賽、講座、工作坊與創業資源整理在同一個地方。找到想參加的活動，一鍵轉傳給一起行動的夥伴。",
  aboutText:
    "中原大學創新創業發展社（創創社）是一群對創新、創業、科技與設計有興趣的學生所組成的社團。我們串連校內創新創業發展中心、桃園市政府青年事務局與各界合作夥伴，把值得參與的活動資訊帶給每一位想把想法付諸行動的同學。",
  instagramUrl: "https://www.instagram.com/cycu__innovation/",
  facebookUrl: "",
  lineUrl: "",
  otherSocialUrl: "",
  contactEmail: "",
  contactOther: "",
  cycuInfo: "中原大學｜320 桃園市中壢區中北路 200 號",
  footerText: "創意不該只留在腦中。來現場，和我們一起把它做出來。",
  presidentName: "林立",
  // 板塊顯示開關："1" 顯示、"0" 隱藏
  showNextUp: "1",
  showStats: "1",
  showFeatured: "1",
  showCategoryIndex: "1",
  showSources: "1",
  showAbout: "1",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = Record<SettingKey, string>;

export const getSettings = cache(async (): Promise<Settings> => {
  const out: Settings = { ...SETTING_DEFAULTS };
  try {
    const rows = await all<{ key: string; value: string }>(`SELECT "key", "value" FROM "SiteSetting"`);
    for (const row of rows) {
      if (row.key in out) out[row.key as SettingKey] = row.value;
    }
  } catch {
    // 資料庫暫時無法連線時仍以預設值顯示
  }
  return out;
});

/** 網站對外網址：優先使用 SITE_URL，否則從請求標頭推得 */
export async function getBaseUrl(): Promise<string> {
  const fromEnv = getVar("SITE_URL").replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
