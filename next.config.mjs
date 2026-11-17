import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  experimental: {
    // allowedOrigins：網站經由 Vercel 網域轉進來時，表單送出的來源網域會和 Worker 的網域不同
    serverActions: { bodySizeLimit: "2mb", allowedOrigins: ["cycuinnovation.vercel.app"] },
  },
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      { source: "/:path*", headers: security },
      {
        // 直接打開 workers.dev 網址（不是經由對外網域轉進來）時，告訴搜尋引擎不要收錄，
        // 避免 Google 把同一個網站收錄成兩份；正式網址以 SITE_URL 為準
        source: "/:path*",
        has: [{ type: "host", value: "(?<sub>.*)\\.workers\\.dev" }],
        missing: [{ type: "header", key: "x-forwarded-host" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
      {
        // 後台頁面一律不快取，登出後按上一頁也不會顯示舊內容
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" }],
      },
    ];
  },
};

// 讓 `npm run dev` 也能使用本機模擬的 D1 與 KV
initOpenNextCloudflareForDev();

export default nextConfig;
