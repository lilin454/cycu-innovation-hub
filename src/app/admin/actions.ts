"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { batch, first, newId, nowIso, run, stmt } from "@/lib/db";
import { assertAdmin, hashPassword, login, logout, verifyPassword, type CurrentUser } from "@/lib/auth";
import { getAnnouncementById, randomSlug } from "@/lib/announcements";
import { SETTING_DEFAULTS, type SettingKey } from "@/lib/settings";
import { resolveSurveyQuestions } from "@/lib/survey";
import { SHOULD_UNPUBLISH, SHOULD_UNPUBLISH_PARAMS } from "@/lib/lifecycle-sql";
import {
  childInserts,
  cleanupFiles,
  insertAnnouncement,
  randomHex,
  saveAnnouncementCore,
  type ColumnValues,
} from "@/lib/announcement-save";
import { createApiToken } from "@/lib/api-token";
import { PLACEMENTS, type Placement } from "@/lib/organization-types";
import {
  categorySchema,
  milestoneSchema,
  firstZodError,
  officerSchema,
  orgSchema,
  settingsSchema,
  userCreateSchema,
  type SaveIntent,
} from "@/lib/validation";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

/** 每個後台操作都在伺服器端驗證登入；ownerOnly=true 時只有總管理員可以執行 */
async function guard(ownerOnly = false): Promise<{ user: CurrentUser; denied: null } | { user: null; denied: Fail }> {
  try {
    const user = await assertAdmin();
    if (ownerOnly && user.role !== "OWNER") return { user: null, denied: fail("這項操作只有總管理員可以執行。") };
    return { user, denied: null };
  } catch {
    return { user: null, denied: fail("尚未登入或登入已過期，請重新登入。") };
  }
}

function refreshPublic() {
  revalidatePath("/", "layout");
}


export async function loginAction(_prev: { error: string; account: string } | null, formData: FormData) {
  const account = String(formData.get("account") ?? "");
  const password = String(formData.get("password") ?? "");
  let result;
  try {
    result = await login(account, password);
  } catch (e) {
    console.error("[login]", e);
    return { error: "系統暫時無法登入，請稍後再試。", account };
  }
  if (!result.ok) return { error: result.error, account };
  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

export async function changePassword(current: string, next: string) {
  const { user, denied } = await guard();
  if (denied) return denied;
  if (typeof next !== "string" || next.length < 10) return fail("新密碼至少需要 10 個字元。");
  if (next.length > 200) return fail("新密碼過長。");
  const row = await first<{ passwordHash: string }>(`SELECT "passwordHash" FROM "User" WHERE "id" = ?`, user.id);
  if (!row || !(await verifyPassword(String(current), row.passwordHash))) return fail("目前的密碼不正確。");
  await run(`UPDATE "User" SET "passwordHash" = ?, "updatedAt" = ? WHERE "id" = ?`, await hashPassword(next), nowIso(), user.id);
  return { ok: true as const };
}

// ───────────────────────── 公告 ─────────────────────────

export async function saveAnnouncement(id: string | null, raw: unknown, intent: SaveIntent) {
  const { denied } = await guard();
  if (denied) return denied;
  return saveAnnouncementCore(id, raw, intent);
}

export async function duplicateAnnouncement(id: string) {
  const { denied } = await guard();
  if (denied) return denied;
  const src = await getAnnouncementById(id);
  if (!src) return fail("找不到這則公告。");
  const iso = (v: Date | null) => (v ? v.toISOString() : null);
  const values: ColumnValues = {
    slug: await randomSlug(),
    title: `${src.title}（複製）`.slice(0, 120),
    subtitle: src.subtitle,
    summary: src.summary,
    content: src.content,
    coverImage: src.coverImage,
    feeType: src.feeType,
    feeAmount: src.feeAmount,
    feeDescription: src.feeDescription,
    prize: src.prize,
    startAt: iso(src.startAt),
    endAt: iso(src.endAt),
    registrationDeadline: iso(src.registrationDeadline),
    location: src.location,
    organizer: src.organizer,
    coOrganizer: src.coOrganizer,
    targetAudience: src.targetAudience,
    registrationUrl: src.registrationUrl,
    registrationMethod: src.registrationMethod,
    youtubeUrl: src.youtubeUrl,
    contactName: src.contactName,
    contactEmail: src.contactEmail,
    contactPhone: src.contactPhone,
    contactLine: src.contactLine,
    contactOther: src.contactOther,
    invitationText: src.invitationText,
    customShareText: src.customShareText,
    surveyEnabled: src.surveyEnabled ? 1 : 0,
    surveyQuestions: src.surveyEnabled || src.surveyQuestions ? JSON.stringify(resolveSurveyQuestions(src)) : null,
    // 複製出來的一律是草稿：不沿用發布狀態、排程、置頂與精選
    status: "DRAFT",
    isFeatured: 0,
    isPinned: 0,
    scheduledAt: null,
    publishedAt: null,
    // 指定的下架時間不沿用，其餘下架方式照舊
    unpublishMode: src.unpublishMode === "AT" ? "DEFAULT" : src.unpublishMode,
    unpublishAt: null,
    autoUnpublishedAt: null,
  };
  const copyId = newId();
  await batch([
    insertAnnouncement(copyId, values, nowIso()),
    ...childInserts(copyId, src.categories.map((c) => c.id), src.attachments, src.images),
  ]);
  revalidatePath("/admin", "layout");
  return { ok: true as const, id: copyId };
}

export async function setAnnouncementStatus(id: string, status: "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED" | "DRAFT") {
  const { denied } = await guard();
  if (denied) return denied;
  if (!["PUBLISHED", "UNPUBLISHED", "ARCHIVED", "DRAFT"].includes(status)) return fail("不支援的狀態。");
  const now = nowIso();
  // 重新發布時保留原本的發布時間；
  // 手動重新發布已經符合自動下架條件的公告時，改成「不要自動下架」，否則會馬上又被撤下
  const changed = await run(
    `UPDATE "Announcement" SET "status" = ?, "scheduledAt" = NULL,
       "publishedAt" = CASE WHEN ? = 'PUBLISHED' THEN COALESCE("publishedAt", ?) ELSE "publishedAt" END, "updatedAt" = ?,
       "autoUnpublishedAt" = NULL,
       "unpublishMode" = CASE WHEN ? = 'PUBLISHED' AND ${SHOULD_UNPUBLISH} THEN 'NEVER' ELSE "unpublishMode" END,
       "unpublishAt" = CASE WHEN ? = 'PUBLISHED' AND "unpublishMode" = 'AT' AND "unpublishAt" <= ? THEN NULL ELSE "unpublishAt" END
     WHERE "id" = ?`,
    status, status, now, now, status, ...SHOULD_UNPUBLISH_PARAMS(new Date(now)), status, now, String(id),
  );
  if (!changed) return fail("找不到這則公告。");
  refreshPublic();
  return { ok: true as const };
}

export async function toggleFlag(id: string, flag: "isPinned" | "isFeatured") {
  const { denied } = await guard();
  if (denied) return denied;
  if (flag !== "isPinned" && flag !== "isFeatured") return fail("不支援的操作。");
  const changed = await run(`UPDATE "Announcement" SET "${flag}" = 1 - "${flag}", "updatedAt" = ? WHERE "id" = ?`, nowIso(), String(id));
  if (!changed) return fail("找不到這則公告。");
  refreshPublic();
  return { ok: true as const };
}

export async function deleteAnnouncement(id: string) {
  const { denied } = await guard(true);
  if (denied) return denied;
  const a = await getAnnouncementById(id);
  if (!a) return fail("找不到這則公告，可能已被刪除。");
  await run(`DELETE FROM "Announcement" WHERE "id" = ?`, a.id);
  await cleanupFiles([a.coverImage, ...a.attachments.map((x) => x.fileUrl), ...a.images.map((x) => x.url)]);
  refreshPublic();
  return { ok: true as const };
}

// ───────────────────────── 分類（僅總管理員） ─────────────────────────

export async function createCategory(raw: unknown) {
  const { denied } = await guard(true);
  if (denied) return denied;
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return fail(firstZodError(parsed.error));
  const { kind, name, color } = parsed.data;
  if (await first(`SELECT 1 AS x FROM "Category" WHERE "kind" = ? AND "name" = ?`, kind, name)) return fail("已經有相同名稱的分類。");
  const last = await first<{ n: number | null }>(`SELECT MAX("sortOrder") AS n FROM "Category" WHERE "kind" = ?`, kind);
  await run(
    `INSERT INTO "Category" ("id", "kind", "name", "slug", "color", "sortOrder") VALUES (?, ?, ?, ?, ?, ?)`,
    newId(), kind, name, `c-${randomHex(4)}`, color, (last?.n ?? 0) + 1,
  );
  refreshPublic();
  return { ok: true as const };
}

export async function updateCategory(id: string, raw: unknown) {
  const { denied } = await guard(true);
  if (denied) return denied;
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return fail(firstZodError(parsed.error));
  const { kind, name, color } = parsed.data;
  const dup = await first<{ id: string }>(`SELECT "id" FROM "Category" WHERE "kind" = ? AND "name" = ?`, kind, name);
  if (dup && dup.id !== id) return fail("已經有相同名稱的分類。");
  const changed = await run(`UPDATE "Category" SET "name" = ?, "color" = ? WHERE "id" = ?`, name, color, String(id));
  if (!changed) return fail("找不到這個分類。");
  refreshPublic();
  return { ok: true as const };
}

/** 分類被公告使用時，先回傳使用數量讓管理者確認；確認後才真的刪除（公告本身不受影響） */
export async function deleteCategory(id: string, confirmed: boolean) {
  const { denied } = await guard(true);
  if (denied) return denied;
  const cat = await first<{ id: string; inUse: number }>(
    `SELECT c."id", (SELECT COUNT(*) FROM "AnnouncementCategory" ac WHERE ac."categoryId" = c."id") AS inUse FROM "Category" c WHERE c."id" = ?`,
    String(id),
  );
  if (!cat) return fail("找不到這個分類。");
  if (cat.inUse > 0 && !confirmed) return { ok: true as const, deleted: false, inUse: cat.inUse };
  await batch([
    stmt(`DELETE FROM "AnnouncementCategory" WHERE "categoryId" = ?`, cat.id),
    stmt(`DELETE FROM "Category" WHERE "id" = ?`, cat.id),
  ]);
  refreshPublic();
  return { ok: true as const, deleted: true, inUse: 0 };
}

export async function reorderCategories(ids: string[]) {
  const { denied } = await guard(true);
  if (denied) return denied;
  if (!Array.isArray(ids) || ids.length > 200 || ids.some((i) => typeof i !== "string")) return fail("資料格式不正確。");
  await batch(ids.map((cid, i) => stmt(`UPDATE "Category" SET "sortOrder" = ? WHERE "id" = ?`, i + 1, cid)));
  refreshPublic();
  return { ok: true as const };
}

// ───────────────────────── 系統設定（僅總管理員） ─────────────────────────

export async function saveSettings(raw: unknown) {
  const { denied } = await guard(true);
  if (denied) return denied;
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return fail(firstZodError(parsed.error));
  const old = await first<{ value: string }>(`SELECT "value" FROM "SiteSetting" WHERE "key" = 'logoUrl'`);
  const entries = Object.entries(parsed.data) as [SettingKey, string][];
  await batch(
    entries.map(([key, value]) =>
      stmt(
        `INSERT INTO "SiteSetting" ("key", "value") VALUES (?, ?) ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value"`,
        key,
        key === "logoUrl" && value === "" ? SETTING_DEFAULTS.logoUrl : value,
      ),
    ),
  );
  if (old && old.value !== parsed.data.logoUrl) await cleanupFiles([old.value]);
  refreshPublic();
  return { ok: true as const };
}

// ───────────────────────── 管理員帳號（僅總管理員） ─────────────────────────

const ownerCount = async () => (await first<{ n: number }>(`SELECT COUNT(*) AS n FROM "User" WHERE "role" = 'OWNER'`))?.n ?? 0;

export async function createUser(raw: unknown) {
  const { denied } = await guard(true);
  if (denied) return denied;
  const parsed = userCreateSchema.safeParse(raw);
  if (!parsed.success) return fail(firstZodError(parsed.error));
  const { account, displayName, password, role } = parsed.data;
  if (await first(`SELECT 1 AS x FROM "User" WHERE "account" = ?`, account)) return fail("這個帳號已經存在。");
  const now = nowIso();
  await run(
    `INSERT INTO "User" ("id", "account", "passwordHash", "displayName", "role", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)`,
    newId(), account, await hashPassword(password), displayName, role, now, now,
  );
  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function updateUser(id: string, raw: { displayName: string; role: "OWNER" | "EDITOR" }) {
  const { user, denied } = await guard(true);
  if (denied) return denied;
  const displayName = String(raw?.displayName ?? "").trim().slice(0, 40);
  const role = raw?.role === "OWNER" ? "OWNER" : raw?.role === "EDITOR" ? "EDITOR" : null;
  if (!displayName) return fail("請填寫顯示名稱。");
  if (!role) return fail("權限設定不正確。");
  const target = await first<{ id: string; role: string }>(`SELECT "id", "role" FROM "User" WHERE "id" = ?`, String(id));
  if (!target) return fail("找不到這個帳號。");
  if (target.role === "OWNER" && role === "EDITOR") {
    if (target.id === user.id) return fail("不能把自己降為一般管理員。");
    if ((await ownerCount()) <= 1) return fail("至少要保留一位總管理員。");
  }
  await run(`UPDATE "User" SET "displayName" = ?, "role" = ?, "updatedAt" = ? WHERE "id" = ?`, displayName, role, nowIso(), target.id);
  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function resetUserPassword(id: string, password: string) {
  const { denied } = await guard(true);
  if (denied) return denied;
  if (typeof password !== "string" || password.length < 10) return fail("密碼至少需要 10 個字元。");
  if (password.length > 200) return fail("密碼過長。");
  const target = await first<{ id: string }>(`SELECT "id" FROM "User" WHERE "id" = ?`, String(id));
  if (!target) return fail("找不到這個帳號。");
  // 重設密碼後，登出該帳號的所有裝置
  await batch([
    stmt(`UPDATE "User" SET "passwordHash" = ?, "updatedAt" = ? WHERE "id" = ?`, await hashPassword(password), nowIso(), target.id),
    stmt(`DELETE FROM "Session" WHERE "userId" = ?`, target.id),
  ]);
  return { ok: true as const };
}

export async function deleteUser(id: string) {
  const { user, denied } = await guard(true);
  if (denied) return denied;
  if (id === user.id) return fail("不能刪除自己正在使用的帳號。");
  const target = await first<{ id: string; role: string }>(`SELECT "id", "role" FROM "User" WHERE "id" = ?`, String(id));
  if (!target) return fail("找不到這個帳號。");
  if (target.role === "OWNER" && (await ownerCount()) <= 1) return fail("至少要保留一位總管理員。");
  await run(`DELETE FROM "User" WHERE "id" = ?`, target.id);
  revalidatePath("/admin/users");
  return { ok: true as const };
}

// ───────────────────────── 問卷回覆 ─────────────────────────

export async function deleteSurveyResponse(id: string) {
  const { denied } = await guard();
  if (denied) return denied;
  const changed = await run(`DELETE FROM "SurveyResponse" WHERE "id" = ?`, String(id));
  if (!changed) return fail("找不到這筆回覆，可能已被刪除。");
  return { ok: true as const };
}

// ───────────────────────── 活動紀錄 ─────────────────────────

export async function saveMilestone(id: string | null, raw: unknown) {
  const { denied } = await guard();
  if (denied) return denied;
  const parsed = milestoneSchema.safeParse(raw);
  if (!parsed.success) return fail(firstZodError(parsed.error));
  const d = parsed.data;
  const nullable = (v: string) => (v === "" ? null : v);
  const status = d.published ? "PUBLISHED" : "DRAFT";
  const now = nowIso();
  if (id) {
    const old = await first<{ coverImage: string | null }>(`SELECT "coverImage" FROM "Milestone" WHERE "id" = ?`, String(id));
    if (!old) return fail("找不到這筆紀錄，可能已被刪除。");
    await run(
      `UPDATE "Milestone" SET "title" = ?, "kind" = ?, "subject" = ?, "people" = ?, "occurredOn" = ?, "location" = ?, "content" = ?,
         "coverImage" = ?, "linkUrl" = ?, "status" = ?, "updatedAt" = ? WHERE "id" = ?`,
      d.title, d.kind, d.subject, nullable(d.people), d.occurredOn, nullable(d.location), d.content,
      nullable(d.coverImage), nullable(d.linkUrl), status, now, String(id),
    );
    if (old.coverImage && old.coverImage !== d.coverImage) await cleanupFiles([old.coverImage]);
  } else {
    await run(
      `INSERT INTO "Milestone" ("id", "title", "kind", "subject", "people", "occurredOn", "location", "content", "coverImage", "linkUrl", "status", "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId(), d.title, d.kind, d.subject, nullable(d.people), d.occurredOn, nullable(d.location), d.content,
      nullable(d.coverImage), nullable(d.linkUrl), status, now, now,
    );
  }
  refreshPublic();
  return { ok: true as const };
}

/** 勾選／取消：把已結束的活動公告顯示在前台「活動紀錄」 */
export async function setShowInRecords(id: string, show: boolean) {
  const { denied } = await guard();
  if (denied) return denied;
  const changed = await run(`UPDATE "Announcement" SET "showInRecords" = ? WHERE "id" = ?`, show ? 1 : 0, String(id));
  if (!changed) return fail("找不到這則公告。");
  refreshPublic();
  return { ok: true as const };
}

export async function deleteMilestone(id: string) {
  const { denied } = await guard(true);
  if (denied) return denied;
  const old = await first<{ coverImage: string | null }>(`SELECT "coverImage" FROM "Milestone" WHERE "id" = ?`, String(id));
  if (!old) return fail("找不到這筆紀錄，可能已被刪除。");
  await run(`DELETE FROM "Milestone" WHERE "id" = ?`, String(id));
  await cleanupFiles([old.coverImage]);
  refreshPublic();
  return { ok: true as const };
}

// ───────────────────────── 社團資訊：幹部、合作單位、資訊來源（僅總管理員） ─────────────────────────

const nullIfEmpty = (v: string) => (v === "" ? null : v);

export async function saveOfficer(id: string | null, raw: unknown) {
  const { denied } = await guard(true);
  if (denied) return denied;
  const parsed = officerSchema.safeParse(raw);
  if (!parsed.success) return fail(firstZodError(parsed.error));
  const d = parsed.data;
  const now = nowIso();
  if (id) {
    const old = await first<{ photoUrl: string | null }>(`SELECT "photoUrl" FROM "Officer" WHERE "id" = ?`, String(id));
    if (!old) return fail("找不到這位幹部，可能已被刪除。");
    await run(`UPDATE "Officer" SET "role" = ?, "name" = ?, "photoUrl" = ?, "updatedAt" = ? WHERE "id" = ?`, d.role, d.name, nullIfEmpty(d.photoUrl), now, String(id));
    if (old.photoUrl && old.photoUrl !== d.photoUrl) await cleanupFiles([old.photoUrl]);
  } else {
    const last = await first<{ n: number | null }>(`SELECT MAX("sortOrder") AS n FROM "Officer"`);
    if (((await first<{ n: number }>(`SELECT COUNT(*) AS n FROM "Officer"`))?.n ?? 0) >= 60) return fail("幹部最多 60 位。");
    await run(
      `INSERT INTO "Officer" ("id", "role", "name", "photoUrl", "sortOrder", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)`,
      newId(), d.role, d.name, nullIfEmpty(d.photoUrl), (last?.n ?? 0) + 1, now, now,
    );
  }
  refreshPublic();
  return { ok: true as const };
}

export async function deleteOfficer(id: string) {
  const { denied } = await guard(true);
  if (denied) return denied;
  const old = await first<{ photoUrl: string | null }>(`SELECT "photoUrl" FROM "Officer" WHERE "id" = ?`, String(id));
  if (!old) return fail("找不到這位幹部，可能已被刪除。");
  await run(`DELETE FROM "Officer" WHERE "id" = ?`, String(id));
  await cleanupFiles([old.photoUrl]);
  refreshPublic();
  return { ok: true as const };
}

export async function saveOrg(id: string | null, raw: unknown) {
  const { denied } = await guard(true);
  if (denied) return denied;
  const parsed = orgSchema.safeParse(raw);
  if (!parsed.success) return fail(firstZodError(parsed.error));
  const d = parsed.data;
  const now = nowIso();
  if (id) {
    const old = await first<{ logoUrl: string | null }>(`SELECT "logoUrl" FROM "Organization" WHERE "id" = ?`, String(id));
    if (!old) return fail("找不到這個單位，可能已被刪除。");
    await run(
      `UPDATE "Organization" SET "name" = ?, "logoUrl" = ?, "linkUrl" = ?, "updatedAt" = ? WHERE "id" = ?`,
      d.name, nullIfEmpty(d.logoUrl), nullIfEmpty(d.linkUrl), now, String(id),
    );
    if (old.logoUrl && old.logoUrl !== d.logoUrl) await cleanupFiles([old.logoUrl]);
  } else {
    if (((await first<{ n: number }>(`SELECT COUNT(*) AS n FROM "Organization" WHERE "kind" = ?`, d.kind))?.n ?? 0) >= 60) {
      return fail("每一類最多 60 個。");
    }
    const last = await first<{ n: number | null }>(`SELECT MAX("sortOrder") AS n FROM "Organization" WHERE "kind" = ?`, d.kind);
    await run(
      `INSERT INTO "Organization" ("id", "kind", "name", "logoUrl", "linkUrl", "sortOrder", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      newId(), d.kind, d.name, nullIfEmpty(d.logoUrl), nullIfEmpty(d.linkUrl), (last?.n ?? 0) + 1, now, now,
    );
  }
  refreshPublic();
  return { ok: true as const };
}

export async function deleteOrg(id: string) {
  const { denied } = await guard(true);
  if (denied) return denied;
  const old = await first<{ logoUrl: string | null }>(`SELECT "logoUrl" FROM "Organization" WHERE "id" = ?`, String(id));
  if (!old) return fail("找不到這個單位，可能已被刪除。");
  await run(`DELETE FROM "Organization" WHERE "id" = ?`, String(id));
  await cleanupFiles([old.logoUrl]);
  refreshPublic();
  return { ok: true as const };
}

/** 依照畫面上的順序重新編號（幹部或同一類單位） */
export async function reorderItems(table: "Officer" | "Organization", ids: string[]) {
  const { denied } = await guard(true);
  if (denied) return denied;
  if (table !== "Officer" && table !== "Organization") return fail("不支援的操作。");
  if (!Array.isArray(ids) || ids.length > 100) return fail("資料格式不正確。");
  await batch(ids.map((id, i) => stmt(`UPDATE "${table}" SET "sortOrder" = ? WHERE "id" = ?`, i + 1, String(id))));
  refreshPublic();
  return { ok: true as const };
}

export async function setPlacement(key: "partnersPlacement" | "sourcesPlacement", value: Placement) {
  const { denied } = await guard(true);
  if (denied) return denied;
  if ((key !== "partnersPlacement" && key !== "sourcesPlacement") || !PLACEMENTS.includes(value)) return fail("不支援的設定。");
  await run(
    `INSERT INTO "SiteSetting" ("key", "value") VALUES (?, ?) ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value"`,
    key, value,
  );
  refreshPublic();
  return { ok: true as const };
}

// ───────────────────────── AI 匯入：API 金鑰（僅總管理員） ─────────────────────────

export async function createAiToken(raw: { name: string; canPublish: boolean; days: number }) {
  const { user, denied } = await guard(true);
  if (denied) return denied;
  const name = String(raw?.name ?? "").trim().slice(0, 40);
  const days = [7, 30, 90, 365].includes(Number(raw?.days)) ? Number(raw.days) : 30;
  if (!name) return fail("請幫這把金鑰取個名字，例如「ChatGPT 上架用」。");
  const active = await first<{ n: number }>(
    `SELECT COUNT(*) AS n FROM "ApiToken" WHERE "revokedAt" IS NULL AND "expiresAt" > ?`, nowIso(),
  );
  if ((active?.n ?? 0) >= 10) return fail("有效的金鑰最多 10 把，請先停用不用的金鑰。");
  const token = await createApiToken(user.id, name, Boolean(raw?.canPublish), days);
  revalidatePath("/admin/ai");
  return { ok: true as const, token };
}

export async function revokeAiToken(id: string) {
  const { denied } = await guard(true);
  if (denied) return denied;
  const changed = await run(`UPDATE "ApiToken" SET "revokedAt" = ? WHERE "id" = ? AND "revokedAt" IS NULL`, nowIso(), String(id));
  if (!changed) return fail("找不到這把金鑰，或已經停用。");
  revalidatePath("/admin/ai");
  return { ok: true as const };
}
