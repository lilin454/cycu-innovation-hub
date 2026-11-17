// Worker 進入點：網站本體交給 OpenNext 產生的處理器，另外加上 Cron Trigger 的排程發布與自動下架。
// @ts-ignore `.open-next/worker.js` 是建置時才產生的檔案
import { default as handler } from "./.open-next/worker.js";
import { lifecycleStatements } from "./src/lib/lifecycle-sql";

export default {
  fetch: handler.fetch,

  /** 每 5 分鐘：發布到期的排程公告、下架已結束（或到了指定時間）的公告。只有兩句 SQL，不經過 Next.js。 */
  async scheduled(_event, env) {
    await env.DB.batch(lifecycleStatements(new Date()).map((s) => env.DB.prepare(s.sql).bind(...s.params)));
  },
} satisfies ExportedHandler<CloudflareEnv>;
