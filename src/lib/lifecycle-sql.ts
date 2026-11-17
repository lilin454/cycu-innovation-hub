// 公告自動發布／自動下架的 SQL。Worker 的 Cron（custom-worker.ts）與網站本體共用，
// 所以這個檔案不能引入任何伺服器端模組。

export const UNPUBLISH_MODES = ["DEFAULT", "ENDED", "AT", "NEVER"] as const;
export type UnpublishMode = (typeof UNPUBLISH_MODES)[number];

/** 只有開始時間、沒有結束時間的活動，開始後過多久算「結束」 */
export const ENDED_GRACE_MS = 24 * 3600_000;

/** 「活動已結束」的條件。參數順序：now, nowMinusGrace */
const ENDED = `(("endAt" IS NOT NULL AND "endAt" <= ?) OR ("endAt" IS NULL AND "startAt" IS NOT NULL AND "startAt" <= ?))`;

/** 這則公告「現在」是否該被自動下架。參數順序：now, now, nowMinusGrace */
export const SHOULD_UNPUBLISH = `(
  ("unpublishMode" = 'AT' AND "unpublishAt" IS NOT NULL AND "unpublishAt" <= ?)
  OR (
    ("unpublishMode" = 'ENDED'
      OR ("unpublishMode" = 'DEFAULT' AND COALESCE((SELECT "value" FROM "SiteSetting" WHERE "key" = 'autoUnpublishEnded'), '0') = '1'))
    AND ${ENDED}
  )
)`;

export const SHOULD_UNPUBLISH_PARAMS = (now: Date) => {
  const iso = now.toISOString();
  return [iso, iso, new Date(now.getTime() - ENDED_GRACE_MS).toISOString()];
};

/** 排程發布。參數：now(updatedAt), now */
export const PUBLISH_DUE_SQL = `UPDATE "Announcement" SET "status" = 'PUBLISHED', "publishedAt" = "scheduledAt", "scheduledAt" = NULL, "updatedAt" = ?
  WHERE "status" = 'SCHEDULED' AND "scheduledAt" <= ?`;

/**
 * 自動下架。指定時間觸發後清掉該時間並改回「跟隨全站設定」，之後手動重新發布才不會又被立刻下架。
 * 參數：now(autoUnpublishedAt), now(updatedAt), ...SHOULD_UNPUBLISH_PARAMS
 */
export const UNPUBLISH_DUE_SQL = `UPDATE "Announcement" SET "status" = 'UNPUBLISHED', "autoUnpublishedAt" = ?, "updatedAt" = ?,
    "unpublishMode" = CASE WHEN "unpublishMode" = 'AT' THEN 'DEFAULT' ELSE "unpublishMode" END,
    "unpublishAt" = CASE WHEN "unpublishMode" = 'AT' THEN NULL ELSE "unpublishAt" END
  WHERE "status" = 'PUBLISHED' AND ${SHOULD_UNPUBLISH}`;

/** 與 SHOULD_UNPUBLISH 相同的判斷，給儲存前檢查用 */
export function wouldUnpublish(
  a: { unpublishMode: UnpublishMode; unpublishAt: Date | null; startAt: Date | null; endAt: Date | null },
  globalOn: boolean,
  now = new Date(),
): boolean {
  if (a.unpublishMode === "AT") return Boolean(a.unpublishAt && a.unpublishAt <= now);
  if (a.unpublishMode === "NEVER" || (a.unpublishMode === "DEFAULT" && !globalOn)) return false;
  if (a.endAt) return a.endAt <= now;
  return Boolean(a.startAt && a.startAt.getTime() <= now.getTime() - ENDED_GRACE_MS);
}

export function lifecycleStatements(now: Date): { sql: string; params: string[] }[] {
  const iso = now.toISOString();
  return [
    { sql: PUBLISH_DUE_SQL, params: [iso, iso] },
    { sql: UNPUBLISH_DUE_SQL, params: [iso, iso, ...SHOULD_UNPUBLISH_PARAMS(now)] },
  ];
}
