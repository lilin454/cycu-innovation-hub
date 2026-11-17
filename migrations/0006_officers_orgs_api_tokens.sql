-- 幹部名單、合作單位／活動資訊來源、AI 匯入用的 API 金鑰

CREATE TABLE "Officer" (
  "id" TEXT PRIMARY KEY,
  "role" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "photoUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);
CREATE INDEX "Officer_sortOrder_idx" ON "Officer" ("sortOrder");

CREATE TABLE "Organization" (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('PARTNER', 'SOURCE')),
  "name" TEXT NOT NULL,
  "logoUrl" TEXT,
  "linkUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);
CREATE INDEX "Organization_kind_sortOrder_idx" ON "Organization" ("kind", "sortOrder");

CREATE TABLE "ApiToken" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "prefix" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "User" ("id") ON DELETE CASCADE,
  "canPublish" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "lastUsedAt" TEXT,
  "revokedAt" TEXT
);
CREATE INDEX "ApiToken_userId_idx" ON "ApiToken" ("userId");

-- 原本在系統設定裡的社長、副社長搬進幹部名單（沒有存過設定時使用原本的預設值）
INSERT INTO "Officer" ("id", "role", "name", "sortOrder", "createdAt", "updatedAt")
SELECT 'officer-president', '社長', v, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (SELECT COALESCE((SELECT "value" FROM "SiteSetting" WHERE "key" = 'presidentName'), '林立') AS v)
WHERE trim(v) <> '';

INSERT INTO "Officer" ("id", "role", "name", "sortOrder", "createdAt", "updatedAt")
SELECT 'officer-vice', '副社長', v, 2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (SELECT COALESCE((SELECT "value" FROM "SiteSetting" WHERE "key" = 'vicePresidentName'), '楊士霆') AS v)
WHERE trim(v) <> '';

-- 原本寫死在關於頁的六個活動資訊來源
INSERT INTO "Organization" ("id", "kind", "name", "logoUrl", "linkUrl", "sortOrder", "createdAt", "updatedAt") VALUES
  ('source-ciec', 'SOURCE', '中原大學創新創業發展中心', '/brand/ciec.jpg', '/announcements?source=ciec', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('source-youth', 'SOURCE', '桃園市政府青年事務局', '/brand/youth-bureau.png', '/announcements?source=youth-bureau', 2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('source-taoyuan', 'SOURCE', '桃園市政府', '/brand/taoyuan.png', '/announcements?source=youth-bureau', 3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('source-alumni', 'SOURCE', '中原大學台北校友會', '/brand/alumni-taipei.png', '/announcements?source=alumni-taipei', 4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('source-bhuntr', 'SOURCE', '獎金獵人', '/brand/bhuntr.png', '/announcements?source=bhuntr', 5, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('source-cycu', 'SOURCE', '中原大學網站', '/brand/cycu.png', '/announcements?source=cycu-web', 6, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- 原本「關於頁｜活動資訊來源」關閉的話，新的顯示位置設定也維持不顯示
INSERT INTO "SiteSetting" ("key", "value")
SELECT 'sourcesPlacement', 'none' FROM "SiteSetting" WHERE "key" = 'showSources' AND "value" = '0'
ON CONFLICT ("key") DO NOTHING;
