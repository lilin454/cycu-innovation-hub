-- AI 匯入金鑰：可選擇是否允許編輯、刪除「草稿」狀態的公告
ALTER TABLE "ApiToken" ADD COLUMN "canEditDrafts" INTEGER NOT NULL DEFAULT 0;
