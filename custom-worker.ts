// Worker 進入點：網站本體交給 OpenNext 產生的處理器，另外加上 Cron Trigger 的排程發布。
// @ts-ignore `.open-next/worker.js` 是建置時才產生的檔案
import { default as handler } from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,

  /** 每 5 分鐘：把到期的「已排程」公告改為「已發布」。只有一句 SQL，不經過 Next.js。 */
  async scheduled(_event, env) {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE "Announcement" SET "status" = 'PUBLISHED', "publishedAt" = "scheduledAt", "scheduledAt" = NULL, "updatedAt" = ?
       WHERE "status" = 'SCHEDULED' AND "scheduledAt" <= ?`,
    )
      .bind(now, now)
      .run();
  },
} satisfies ExportedHandler<CloudflareEnv>;
