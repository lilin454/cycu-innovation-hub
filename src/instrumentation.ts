// 伺服器啟動時註冊排程：每 30 秒檢查一次是否有到期的「已排程」公告並自動發布。
// 適用於長時間執行的 Node 伺服器（next start、Docker、Railway、Render、VPS）。
// Serverless 環境請另外設定 Cron 呼叫 /api/cron/publish（見 README）。
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __publishTimer?: ReturnType<typeof setInterval> };
  if (g.__publishTimer) return;
  const { publishDue } = await import("./lib/announcements");
  const tick = async () => {
    try {
      const n = await publishDue();
      if (n > 0) console.log(`[scheduler] 已自動發布 ${n} 則排程公告`);
    } catch (e) {
      console.error("[scheduler] 排程檢查失敗：", e instanceof Error ? e.message : e);
    }
  };
  g.__publishTimer = setInterval(tick, 30_000);
  g.__publishTimer.unref?.();
  void tick();
}
