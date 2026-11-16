-- Cloudflare D1（SQLite）資料表。日期一律以 ISO 8601 UTC 字串儲存，布林值以 0/1 儲存。

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "account" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'EDITOR' CHECK ("role" IN ('OWNER', 'EDITOR')),
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE TABLE "Session" (
  "id" TEXT PRIMARY KEY,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES "User" ("id") ON DELETE CASCADE,
  "expiresAt" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "userAgent" TEXT
);
CREATE INDEX "Session_userId_idx" ON "Session" ("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session" ("expiresAt");

CREATE TABLE "LoginAttempt" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL
);
CREATE INDEX "LoginAttempt_key_createdAt_idx" ON "LoginAttempt" ("key", "createdAt");

CREATE TABLE "Announcement" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "summary" TEXT,
  "content" TEXT NOT NULL DEFAULT '',
  "coverImage" TEXT,
  "feeType" TEXT NOT NULL DEFAULT 'FREE' CHECK ("feeType" IN ('FREE', 'PAID', 'DEPOSIT', 'VARIES')),
  "feeAmount" INTEGER,
  "feeDescription" TEXT,
  "prize" TEXT,
  "startAt" TEXT,
  "endAt" TEXT,
  "registrationDeadline" TEXT,
  "location" TEXT,
  "organizer" TEXT,
  "coOrganizer" TEXT,
  "targetAudience" TEXT,
  "registrationUrl" TEXT,
  "registrationMethod" TEXT,
  "youtubeUrl" TEXT,
  "contactName" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "contactLine" TEXT,
  "contactOther" TEXT,
  "invitationText" TEXT,
  "customShareText" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED')),
  "isFeatured" INTEGER NOT NULL DEFAULT 0,
  "isPinned" INTEGER NOT NULL DEFAULT 0,
  "scheduledAt" TEXT,
  "publishedAt" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);
CREATE INDEX "Announcement_status_publishedAt_idx" ON "Announcement" ("status", "publishedAt");
CREATE INDEX "Announcement_status_scheduledAt_idx" ON "Announcement" ("status", "scheduledAt");
CREATE INDEX "Announcement_startAt_idx" ON "Announcement" ("startAt");

CREATE TABLE "Category" (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('SOURCE', 'EVENT_TYPE', 'TAG')),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "color" TEXT NOT NULL DEFAULT '#0E3A66',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  UNIQUE ("kind", "name")
);
CREATE INDEX "Category_kind_sortOrder_idx" ON "Category" ("kind", "sortOrder");

CREATE TABLE "AnnouncementCategory" (
  "announcementId" TEXT NOT NULL REFERENCES "Announcement" ("id") ON DELETE CASCADE,
  "categoryId" TEXT NOT NULL REFERENCES "Category" ("id") ON DELETE CASCADE,
  PRIMARY KEY ("announcementId", "categoryId")
);
CREATE INDEX "AnnouncementCategory_categoryId_idx" ON "AnnouncementCategory" ("categoryId");

CREATE TABLE "Attachment" (
  "id" TEXT PRIMARY KEY,
  "announcementId" TEXT NOT NULL REFERENCES "Announcement" ("id") ON DELETE CASCADE,
  "fileName" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "Attachment_announcementId_idx" ON "Attachment" ("announcementId", "sortOrder");

CREATE TABLE "AnnouncementImage" (
  "id" TEXT PRIMARY KEY,
  "announcementId" TEXT NOT NULL REFERENCES "Announcement" ("id") ON DELETE CASCADE,
  "url" TEXT NOT NULL,
  "alt" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "AnnouncementImage_announcementId_idx" ON "AnnouncementImage" ("announcementId", "sortOrder");

CREATE TABLE "SiteSetting" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL
);
