import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 所有頁面都是即時從資料庫讀取（沒有使用 Next.js 的增量快取），所以不需要額外的快取儲存。
export default defineCloudflareConfig({});
