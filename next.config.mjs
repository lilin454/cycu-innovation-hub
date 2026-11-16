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
