-- 新增功能：公告問卷、活動紀錄。
-- 這個遷移「只新增、不修改」：不會更動或刪除任何既有的公告、草稿、分類與附件。
-- 既有公告的問卷預設為關閉（surveyEnabled = 0）。

ALTER TABLE "Announcement" ADD COLUMN "surveyEnabled" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Announcement" ADD COLUMN "surveyQuestion" TEXT;
ALTER TABLE "Announcement" ADD COLUMN "surveyOptions" TEXT;

CREATE TABLE "SurveyResponse" (
  "id" TEXT PRIMARY KEY,
  "announcementId" TEXT NOT NULL REFERENCES "Announcement" ("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "note" TEXT,
  "ipHash" TEXT,
  "createdAt" TEXT NOT NULL
);
CREATE INDEX "SurveyResponse_announcementId_idx" ON "SurveyResponse" ("announcementId", "createdAt");
CREATE INDEX "SurveyResponse_ipHash_idx" ON "SurveyResponse" ("ipHash", "createdAt");

-- 活動紀錄：獲獎、參訪、活動等過往成果
CREATE TABLE "Milestone" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'AWARD' CHECK ("kind" IN ('AWARD', 'VISIT', 'EVENT', 'OTHER')),
  "subject" TEXT NOT NULL DEFAULT 'CLUB' CHECK ("subject" IN ('CLUB', 'OFFICER', 'MEMBER')),
  "people" TEXT,
  "occurredOn" TEXT NOT NULL,
  "location" TEXT,
  "content" TEXT NOT NULL DEFAULT '',
  "coverImage" TEXT,
  "linkUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'PUBLISHED')),
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);
CREATE INDEX "Milestone_status_occurredOn_idx" ON "Milestone" ("status", "occurredOn");
