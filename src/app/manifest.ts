import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";

/** 網頁應用程式資訊：讓手機可以「安裝」網站、在主畫面建立捷徑 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  return {
    id: "/",
    name: s.siteName,
    short_name: "創創社",
    description: s.heroIntro || s.heroTagline,
    lang: "zh-Hant-TW",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbf7ee",
    theme_color: "#0e3a66",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "最新公告", url: "/announcements", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "活動行事曆", url: "/calendar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
