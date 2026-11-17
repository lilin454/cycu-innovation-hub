-- 自動下架與「活動紀錄」勾選。只新增欄位，預設值不會改變任何既有公告的狀態。
-- unpublishMode：DEFAULT＝跟隨全站設定、ENDED＝活動結束後下架、AT＝指定時間下架、NEVER＝不要自動下架
ALTER TABLE "Announcement" ADD COLUMN "unpublishMode" TEXT NOT NULL DEFAULT 'DEFAULT';
ALTER TABLE "Announcement" ADD COLUMN "unpublishAt" TEXT;
-- 系統自動下架的時間（手動下架不會寫入）
ALTER TABLE "Announcement" ADD COLUMN "autoUnpublishedAt" TEXT;
-- 1＝顯示在前台「活動紀錄」
ALTER TABLE "Announcement" ADD COLUMN "showInRecords" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "Announcement_showInRecords_idx" ON "Announcement" ("showInRecords", "startAt");
