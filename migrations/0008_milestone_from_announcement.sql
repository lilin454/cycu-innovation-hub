-- 活動紀錄可由已結束的公告「轉成可編輯紀錄」，並可附多張照片。只新增，不更動既有資料。
ALTER TABLE "Milestone" ADD COLUMN "announcementId" TEXT;
CREATE UNIQUE INDEX "Milestone_announcementId_uq" ON "Milestone" ("announcementId") WHERE "announcementId" IS NOT NULL;

CREATE TABLE "MilestoneImage" (
  "id" TEXT PRIMARY KEY,
  "milestoneId" TEXT NOT NULL REFERENCES "Milestone" ("id") ON DELETE CASCADE,
  "url" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "MilestoneImage_milestoneId_idx" ON "MilestoneImage" ("milestoneId", "sortOrder");
