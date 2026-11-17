import type { Metadata, Viewport } from "next";
import { getBaseUrl, getSettings } from "@/lib/settings";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

// 字型由瀏覽器在執行時向 Google Fonts 載入（不在建置階段下載，離線也能建置）；
// 載入失敗時會自動退回系統內建的中文字型。
const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;900&family=JetBrains+Mono:wght@500;700&family=Noto+Sans+TC:wght@400;500;700;900&display=swap";

export async function generateMetadata(): Promise<Metadata> {
  const [s, base] = await Promise.all([getSettings(), getBaseUrl()]);
  const description = s.heroIntro || s.heroTagline;
  return {
    metadataBase: new URL(base),
    title: { default: `${s.siteName}｜活動公告平台`, template: `%s｜${s.siteName}` },
    description,
    openGraph: {
      type: "website",
      siteName: s.siteName,
      locale: "zh_TW",
      title: `${s.siteName}｜活動公告平台`,
      description,
      images: [{ url: s.logoUrl || "/brand/logo.jpg" }],
    },
    icons: { icon: s.logoUrl || "/brand/logo.jpg" },
    ...(s.googleSiteVerification ? { verification: { google: s.googleSiteVerification } } : {}),
  };
}

export const viewport: Viewport = { themeColor: "#0e3a66", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_URL} />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
