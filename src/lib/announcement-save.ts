import "server-only";
import { revalidatePath } from "next/cache";
import { all, batch, first, newId, nowIso, placeholders, stmt } from "./db";
import { getAnnouncementById } from "./announcements";
import type { StatusKey } from "./constants";
import { fromInputValue } from "./format";
import { deleteObject, keyFromUrl } from "./storage";
import { normalizeQuestions } from "./survey";
import { wouldUnpublish } from "./lifecycle-sql";
import { announcementSchema, firstZodError, SAVE_INTENTS, type SaveIntent } from "./validation";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });
export type SaveResult = Fail | { ok: true; id: string; slug: string; status: StatusKey };

export const randomHex = (bytes: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");

/** 刪除已經沒有任何地方引用的實體檔案（一次查詢檢查全部候選檔案） */
export async function cleanupFiles(urls: (string | null | undefined)[]) {
  const unique = [...new Set(urls.filter((u): u is string => Boolean(u && keyFromUrl(u))))].slice(0, 20);
  if (!unique.length) return;
  const ph = placeholders(unique.length);
  const used = await all<{ u: string }>(
    `SELECT "coverImage" AS u FROM "Announcement" WHERE "coverImage" IN (${ph})
     UNION SELECT "fileUrl" FROM "Attachment" WHERE "fileUrl" IN (${ph})
     UNION SELECT "url" FROM "AnnouncementImage" WHERE "url" IN (${ph})
     UNION SELECT "value" FROM "SiteSetting" WHERE "value" IN (${ph})
     UNION SELECT "coverImage" FROM "Milestone" WHERE "coverImage" IN (${ph})
     UNION SELECT "photoUrl" FROM "Officer" WHERE "photoUrl" IN (${ph})
     UNION SELECT "logoUrl" FROM "Organization" WHERE "logoUrl" IN (${ph})`,
    ...unique, ...unique, ...unique, ...unique, ...unique, ...unique, ...unique,
  );
  const usedSet = new Set(used.map((r) => r.u));
  await Promise.all(unique.filter((u) => !usedSet.has(u)).map((u) => deleteObject(keyFromUrl(u)!)));
}

// ───────────────────────── 登入 / 登出 ─────────────────────────

export const ANNOUNCEMENT_COLUMNS = [
  "slug", "title", "subtitle", "summary", "content", "coverImage", "feeType", "feeAmount", "feeDescription", "prize",
  "startAt", "endAt", "registrationDeadline", "location", "organizer", "coOrganizer", "targetAudience",
  "registrationUrl", "registrationMethod", "youtubeUrl", "contactName", "contactEmail", "contactPhone", "contactLine",
  "contactOther", "invitationText", "customShareText", "surveyEnabled", "surveyQuestions", "status", "isFeatured", "isPinned", "scheduledAt", "publishedAt",
  "unpublishMode", "unpublishAt", "autoUnpublishedAt",
] as const;
type Column = (typeof ANNOUNCEMENT_COLUMNS)[number];
export type ColumnValues = Record<Column, string | number | null>;

export function insertAnnouncement(id: string, v: ColumnValues, now: string) {
  const cols = ["id", ...ANNOUNCEMENT_COLUMNS, "createdAt", "updatedAt"];
  return stmt(
    `INSERT INTO "Announcement" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders(cols.length)})`,
    id, ...ANNOUNCEMENT_COLUMNS.map((c) => v[c]), now, now,
  );
}

export function childInserts(
  id: string,
  categoryIds: string[],
  attachments: { fileUrl: string; fileName: string; displayName: string; fileType: string; fileSize: number }[],
  images: { url: string; alt: string | null }[],
) {
  return [
    ...categoryIds.map((cid) => stmt(`INSERT OR IGNORE INTO "AnnouncementCategory" ("announcementId", "categoryId") VALUES (?, ?)`, id, cid)),
    ...attachments.map((a, i) =>
      stmt(
        `INSERT INTO "Attachment" ("id", "announcementId", "fileName", "displayName", "fileUrl", "fileType", "fileSize", "sortOrder") VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        newId(), id, a.fileName, a.displayName, a.fileUrl, a.fileType, a.fileSize, i,
      ),
    ),
    ...images.map((img, i) =>
      stmt(`INSERT INTO "AnnouncementImage" ("id", "announcementId", "url", "alt", "sortOrder") VALUES (?, ?, ?, ?, ?)`, newId(), id, img.url, img.alt, i),
    ),
  ];
}

/**
 * 新增或更新公告的核心邏輯（後台編輯器與 AI 匯入接口共用）。
 * 呼叫前必須先確認登入身分與權限，這裡不再檢查。
 */
export async function saveAnnouncementCore(id: string | null, raw: unknown, intent: SaveIntent): Promise<SaveResult> {
  if (!SAVE_INTENTS.includes(intent)) return fail("不支援的操作。");

  const parsed = announcementSchema.safeParse(raw);
  if (!parsed.success) return fail(firstZodError(parsed.error));
  const d = parsed.data;

  const existing = id ? await getAnnouncementById(id) : null;
  if (id && !existing) return fail("找不到這則公告，可能已被刪除。");

  const startAt = fromInputValue(d.startAt);
  const endAt = fromInputValue(d.endAt);
  const registrationDeadline = fromInputValue(d.registrationDeadline);
  let scheduledAt = fromInputValue(d.scheduledAt);
  if (startAt && endAt && endAt < startAt) return fail("活動結束時間不可早於開始時間。");
  if (d.surveyEnabled && !d.surveyQuestions.length) return fail("問卷至少要有一個題目。");
  const unpublishAt = d.unpublishMode === "AT" ? fromInputValue(d.unpublishAt) : null;
  if (d.unpublishMode === "AT" && !unpublishAt) return fail("請設定自動下架的時間。");

  const slugOwner = await first<{ id: string }>(`SELECT "id" FROM "Announcement" WHERE "slug" = ?`, d.slug);
  if (slugOwner && slugOwner.id !== id) return fail("這個網址代稱已被其他公告使用，請換一個。");

  const now = new Date();
  let status: StatusKey = existing?.status ?? "DRAFT";
  let publishedAt = existing?.publishedAt ?? null;
  switch (intent) {
    case "publish":
      status = "PUBLISHED";
      publishedAt = publishedAt ?? now;
      scheduledAt = null;
      break;
    case "schedule":
      if (!scheduledAt) return fail("請先設定預定發布時間。");
      if (scheduledAt <= now) return fail("預定發布時間必須晚於現在。");
      status = "SCHEDULED";
      publishedAt = null;
      break;
    case "unpublish":
      status = "UNPUBLISHED";
      scheduledAt = null;
      break;
    case "archive":
      status = "ARCHIVED";
      scheduledAt = null;
      break;
    case "draft":
      status = "DRAFT";
      scheduledAt = null;
      break;
    case "save":
      if (status === "SCHEDULED") {
        if (!scheduledAt || scheduledAt <= now) return fail("這則公告已排程，預定發布時間必須晚於現在。");
      } else {
        scheduledAt = null;
      }
      break;
  }

  // 發布中的公告如果會被自動下架規則立刻撤下，先提醒，不要讓它一發布就消失
  if (status === "PUBLISHED") {
    const globalOn = (await first<{ value: string }>(`SELECT "value" FROM "SiteSetting" WHERE "key" = 'autoUnpublishEnded'`))?.value === "1";
    if (wouldUnpublish({ unpublishMode: d.unpublishMode, unpublishAt, startAt, endAt }, globalOn, now)) {
      return fail(
        d.unpublishMode === "AT"
          ? "自動下架時間已經過了，發布後會立刻被下架。請改一個之後的時間，或選「不要自動下架」。"
          : "這個活動已經結束，依照自動下架設定會立刻被下架。若要繼續公開，請在「發布設定」把自動下架改成「不要自動下架」。",
      );
    }
  }

  // 分類：只接受資料庫中真的存在的 id；自訂標籤不存在就建立
  const wanted = [...new Set(d.categoryIds)].slice(0, 40);
  const cats = wanted.length
    ? await all<{ id: string }>(
        `SELECT "id" FROM "Category" WHERE "kind" IN ('SOURCE', 'EVENT_TYPE') AND "id" IN (${placeholders(wanted.length)})`,
        ...wanted,
      )
    : [];
  const tagNames = [...new Set(d.customTags)];
  let tagIds: string[] = [];
  if (tagNames.length) {
    await batch(
      tagNames.map((name) =>
        stmt(
          `INSERT OR IGNORE INTO "Category" ("id", "kind", "name", "slug", "color", "sortOrder") VALUES (?, 'TAG', ?, ?, '#55657A', 0)`,
          newId(), name, `t-${randomHex(4)}`,
        ),
      ),
    );
    tagIds = (
      await all<{ id: string }>(`SELECT "id" FROM "Category" WHERE "kind" = 'TAG' AND "name" IN (${placeholders(tagNames.length)})`, ...tagNames)
    ).map((t) => t.id);
  }
  const categoryIds = [...cats.map((c) => c.id), ...tagIds];

  const nullable = (v: string) => (v === "" ? null : v);
  const iso = (v: Date | null) => (v ? v.toISOString() : null);
  const values: ColumnValues = {
    slug: d.slug,
    title: d.title,
    subtitle: nullable(d.subtitle),
    summary: nullable(d.summary),
    content: d.content,
    coverImage: nullable(d.coverImage),
    feeType: d.feeType,
    feeAmount: d.feeType === "FREE" ? 0 : d.feeAmount,
    feeDescription: nullable(d.feeDescription),
    prize: nullable(d.prize),
    startAt: iso(startAt),
    endAt: iso(endAt),
    registrationDeadline: iso(registrationDeadline),
    location: nullable(d.location),
    organizer: nullable(d.organizer),
    coOrganizer: nullable(d.coOrganizer),
    targetAudience: nullable(d.targetAudience),
    registrationUrl: nullable(d.registrationUrl),
    registrationMethod: nullable(d.registrationMethod),
    youtubeUrl: nullable(d.youtubeUrl),
    contactName: nullable(d.contactName),
    contactEmail: nullable(d.contactEmail),
    contactPhone: nullable(d.contactPhone),
    contactLine: nullable(d.contactLine),
    contactOther: nullable(d.contactOther),
    invitationText: nullable(d.invitationText),
    customShareText: nullable(d.customShareText),
    surveyEnabled: d.surveyEnabled ? 1 : 0,
    // 題目存成 JSON；舊版的 surveyQuestion / surveyOptions 欄位保留不動
    surveyQuestions: d.surveyQuestions.length ? JSON.stringify(normalizeQuestions(d.surveyQuestions)) : null,
    status,
    isFeatured: d.isFeatured ? 1 : 0,
    isPinned: d.isPinned ? 1 : 0,
    scheduledAt: iso(scheduledAt),
    publishedAt: iso(publishedAt),
    unpublishMode: d.unpublishMode,
    unpublishAt: iso(unpublishAt),
    // 只有「維持自動下架狀態、單純儲存內容」時保留標記；其他狀態變更都視為人工處理（行事曆依此判斷）
    autoUnpublishedAt: status === "UNPUBLISHED" && intent === "save" ? iso(existing?.autoUnpublishedAt ?? null) : null,
  };

  const savedId = existing?.id ?? newId();
  const nowStr = nowIso();
  const images = d.images.map((img) => ({ url: img.url, alt: img.alt || null }));
  try {
    // 整批寫入是一個交易：全部成功或全部不變
    await batch([
      existing
        ? stmt(
            `UPDATE "Announcement" SET ${ANNOUNCEMENT_COLUMNS.map((c) => `"${c}" = ?`).join(", ")}, "updatedAt" = ? WHERE "id" = ?`,
            ...ANNOUNCEMENT_COLUMNS.map((c) => values[c]), nowStr, savedId,
          )
        : insertAnnouncement(savedId, values, nowStr),
      stmt(`DELETE FROM "AnnouncementCategory" WHERE "announcementId" = ?`, savedId),
      stmt(`DELETE FROM "Attachment" WHERE "announcementId" = ?`, savedId),
      stmt(`DELETE FROM "AnnouncementImage" WHERE "announcementId" = ?`, savedId),
      ...childInserts(savedId, categoryIds, d.attachments, images),
    ]);
  } catch (e) {
    console.error("[saveAnnouncement]", e);
    return fail("儲存失敗，請稍後再試。");
  }

  if (existing) {
    await cleanupFiles([existing.coverImage, ...existing.attachments.map((a) => a.fileUrl), ...existing.images.map((i) => i.url)]);
  }
  revalidatePath("/", "layout");
  return { ok: true as const, id: savedId, slug: d.slug, status };
}
