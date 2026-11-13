"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AnnouncementStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertAdmin, hashPassword, login, logout } from "@/lib/auth";
import { fromInputValue } from "@/lib/format";
import { htmlToText, sanitizeContent } from "@/lib/sanitize";
import { randomSlug } from "@/lib/slug";
import { deleteObject, keyFromUrl } from "@/lib/storage";
import { SETTING_DEFAULTS, type SettingKey } from "@/lib/settings";
import {
  announcementSchema,
  categorySchema,
  firstZodError,
  SAVE_INTENTS,
  settingsSchema,
  type SaveIntent,
} from "@/lib/validation";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

async function guard(): Promise<Fail | null> {
  try {
    await assertAdmin();
    return null;
  } catch {
    return fail("尚未登入或登入已過期，請重新登入。");
  }
}

function refreshPublic() {
  revalidatePath("/", "layout");
}

/** 刪除已經沒有任何公告引用的實體檔案 */
async function cleanupFiles(urls: (string | null | undefined)[]) {
  const unique = [...new Set(urls.filter((u): u is string => Boolean(u)))];
  for (const url of unique) {
    const key = keyFromUrl(url);
    if (!key) continue;
    const [cover, att, img, inline, setting] = await Promise.all([
      db.announcement.count({ where: { coverImage: url } }),
      db.attachment.count({ where: { fileUrl: url } }),
      db.announcementImage.count({ where: { url } }),
      db.announcement.count({ where: { content: { contains: url } } }),
      db.siteSetting.count({ where: { value: url } }),
    ]);
    if (cover + att + img + inline + setting === 0) await deleteObject(key);
  }
}

// ───────────────────────── 登入 / 登出 ─────────────────────────

export async function loginAction(_prev: { error: string; account: string } | null, formData: FormData) {
  const account = String(formData.get("account") ?? "");
  const password = String(formData.get("password") ?? "");
  let result;
  try {
    result = await login(account, password);
  } catch {
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
  let user;
  try {
    user = await assertAdmin();
  } catch {
    return fail("尚未登入或登入已過期，請重新登入。");
  }
  if (next.length < 10) return fail("新密碼至少需要 10 個字元。");
  if (next.length > 200) return fail("新密碼過長。");
  const row = await db.user.findUnique({ where: { id: user.id } });
  if (!row || !(await bcrypt.compare(current, row.passwordHash))) return fail("目前的密碼不正確。");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  return { ok: true as const };
}

// ───────────────────────── 公告 ─────────────────────────

export async function saveAnnouncement(id: string | null, raw: unknown, intent: SaveIntent) {
  const denied = await guard();
  if (denied) return denied;
  if (!SAVE_INTENTS.includes(intent)) return fail("不支援的操作。");

  const parsed = announcementSchema.safeParse(raw);
  if (!parsed.success) return fail(firstZodError(parsed.error));
  const d = parsed.data;

  const existing = id ? await db.announcement.findUnique({ where: { id }, include: { attachments: true, images: true } }) : null;
  if (id && !existing) return fail("找不到這則公告，可能已被刪除。");

  const startAt = fromInputValue(d.startAt);
  const endAt = fromInputValue(d.endAt);
  const registrationDeadline = fromInputValue(d.registrationDeadline);
  let scheduledAt = fromInputValue(d.scheduledAt);
  if (startAt && endAt && endAt < startAt) return fail("活動結束時間不可早於開始時間。");

  const slugOwner = await db.announcement.findUnique({ where: { slug: d.slug }, select: { id: true } });
  if (slugOwner && slugOwner.id !== id) return fail("這個網址代稱已被其他公告使用，請換一個。");

  const now = new Date();
  let status: AnnouncementStatus = existing?.status ?? "DRAFT";
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

  // 分類：只接受資料庫中真的存在的 id；自訂標籤不存在就建立
  const cats = d.categoryIds.length
    ? await db.category.findMany({ where: { id: { in: d.categoryIds }, kind: { in: ["SOURCE", "EVENT_TYPE"] } }, select: { id: true } })
    : [];
  const tagIds: string[] = [];
  for (const name of [...new Set(d.customTags)]) {
    const tag = await db.category.upsert({
      where: { kind_name: { kind: "TAG", name } },
      update: {},
      create: { kind: "TAG", name, slug: `t-${crypto.randomBytes(4).toString("hex")}`, color: "#55657A" },
    });
    tagIds.push(tag.id);
  }
  const connect = [...cats.map((c) => c.id), ...tagIds].map((cid) => ({ id: cid }));

  const content = sanitizeContent(d.content);
  const nullable = (v: string) => (v === "" ? null : v);
  const data = {
    title: d.title,
    subtitle: nullable(d.subtitle),
    summary: nullable(d.summary),
    slug: d.slug,
    coverImage: nullable(d.coverImage),
    content,
    contentText: htmlToText(content).slice(0, 20000),
    feeType: d.feeType,
    feeAmount: d.feeType === "FREE" ? 0 : d.feeAmount,
    feeDescription: nullable(d.feeDescription),
    startAt,
    endAt,
    registrationDeadline,
    location: nullable(d.location),
    organizer: nullable(d.organizer),
    coOrganizer: nullable(d.coOrganizer),
    targetAudience: nullable(d.targetAudience),
    registrationUrl: nullable(d.registrationUrl),
    registrationMethod: nullable(d.registrationMethod),
    contactName: nullable(d.contactName),
    contactEmail: nullable(d.contactEmail),
    contactPhone: nullable(d.contactPhone),
    contactLine: nullable(d.contactLine),
    contactOther: nullable(d.contactOther),
    invitationText: nullable(d.invitationText),
    customShareText: nullable(d.customShareText),
    isFeatured: d.isFeatured,
    isPinned: d.isPinned,
    status,
    scheduledAt,
    publishedAt,
  } satisfies Prisma.AnnouncementUpdateInput;

  const attachments = d.attachments.map((a, i) => ({ ...a, sortOrder: i }));
  const images = d.images.map((img, i) => ({ url: img.url, alt: img.alt || null, sortOrder: i }));

  let saved;
  try {
    saved = await db.$transaction(async (tx) => {
      if (existing) {
        await tx.attachment.deleteMany({ where: { announcementId: existing.id } });
        await tx.announcementImage.deleteMany({ where: { announcementId: existing.id } });
        return tx.announcement.update({
          where: { id: existing.id },
          data: {
            ...data,
            categories: { set: connect },
            attachments: { create: attachments },
            images: { create: images },
          },
        });
      }
      return tx.announcement.create({
        data: {
          ...data,
          categories: { connect },
          attachments: { create: attachments },
          images: { create: images },
        },
      });
    });
  } catch {
    return fail("儲存失敗，請稍後再試。");
  }

  if (existing) {
    await cleanupFiles([existing.coverImage, ...existing.attachments.map((a) => a.fileUrl), ...existing.images.map((i) => i.url)]);
  }
  refreshPublic();
  return { ok: true as const, id: saved.id, slug: saved.slug, status: saved.status };
}

export async function duplicateAnnouncement(id: string) {
  const denied = await guard();
  if (denied) return denied;
  const src = await db.announcement.findUnique({
    where: { id },
    include: { categories: { select: { id: true } }, attachments: true, images: true },
  });
  if (!src) return fail("找不到這則公告。");
  const {
    id: _id, slug: _slug, createdAt: _c, updatedAt: _u, status: _s, publishedAt: _p, scheduledAt: _sch,
    isFeatured: _f, isPinned: _pin, categories, attachments, images, ...rest
  } = src;
  void [_id, _slug, _c, _u, _s, _p, _sch, _f, _pin];
  const copy = await db.announcement.create({
    data: {
      ...rest,
      title: `${src.title}（複製）`.slice(0, 120),
      slug: await randomSlug(),
      status: "DRAFT",
      categories: { connect: categories },
      attachments: {
        create: attachments.map(({ fileName, displayName, fileUrl, fileType, fileSize, sortOrder }) => ({
          fileName, displayName, fileUrl, fileType, fileSize, sortOrder,
        })),
      },
      images: { create: images.map(({ url, alt, sortOrder }) => ({ url, alt, sortOrder })) },
    },
  });
  revalidatePath("/admin", "layout");
  return { ok: true as const, id: copy.id };
}

export async function setAnnouncementStatus(id: string, status: "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED" | "DRAFT") {
  const denied = await guard();
  if (denied) return denied;
  if (!["PUBLISHED", "UNPUBLISHED", "ARCHIVED", "DRAFT"].includes(status)) return fail("不支援的狀態。");
  const a = await db.announcement.findUnique({ where: { id }, select: { publishedAt: true } });
  if (!a) return fail("找不到這則公告。");
  await db.announcement.update({
    where: { id },
    data: {
      status,
      scheduledAt: null,
      publishedAt: status === "PUBLISHED" ? (a.publishedAt ?? new Date()) : a.publishedAt,
    },
  });
  refreshPublic();
  return { ok: true as const };
}

export async function toggleFlag(id: string, flag: "isPinned" | "isFeatured") {
  const denied = await guard();
  if (denied) return denied;
  if (flag !== "isPinned" && flag !== "isFeatured") return fail("不支援的操作。");
  const a = await db.announcement.findUnique({ where: { id }, select: { isPinned: true, isFeatured: true } });
  if (!a) return fail("找不到這則公告。");
  const value = !a[flag];
  await db.announcement.update({ where: { id }, data: { [flag]: value } });
  refreshPublic();
  return { ok: true as const, value };
}

export async function deleteAnnouncement(id: string) {
  const denied = await guard();
  if (denied) return denied;
  const a = await db.announcement.findUnique({ where: { id }, include: { attachments: true, images: true } });
  if (!a) return fail("找不到這則公告，可能已被刪除。");
  await db.announcement.delete({ where: { id } });
  const inline = [...a.content.matchAll(/\/files\/images\/\d{4}\/\d{2}\/[a-f0-9]{24}\.[a-z0-9]{1,5}/g)].map((m) => m[0]);
  await cleanupFiles([a.coverImage, ...a.attachments.map((x) => x.fileUrl), ...a.images.map((x) => x.url), ...inline]);
  refreshPublic();
  return { ok: true as const };
}

// ───────────────────────── 分類 ─────────────────────────

export async function createCategory(raw: unknown) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return fail(firstZodError(parsed.error));
  const { kind, name, color } = parsed.data;
  if (await db.category.findUnique({ where: { kind_name: { kind, name } } })) return fail("已經有相同名稱的分類。");
  const last = await db.category.findFirst({ where: { kind }, orderBy: { sortOrder: "desc" } });
  await db.category.create({
    data: { kind, name, color, slug: `c-${crypto.randomBytes(4).toString("hex")}`, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
  refreshPublic();
  return { ok: true as const };
}

export async function updateCategory(id: string, raw: unknown) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return fail(firstZodError(parsed.error));
  const { kind, name, color } = parsed.data;
  const dup = await db.category.findUnique({ where: { kind_name: { kind, name } } });
  if (dup && dup.id !== id) return fail("已經有相同名稱的分類。");
  try {
    await db.category.update({ where: { id }, data: { name, color } });
  } catch {
    return fail("找不到這個分類。");
  }
  refreshPublic();
  return { ok: true as const };
}

/** 分類被公告使用時，先回傳使用數量讓管理者確認；確認後才真的刪除（公告本身不受影響） */
export async function deleteCategory(id: string, confirmed: boolean) {
  const denied = await guard();
  if (denied) return denied;
  const cat = await db.category.findUnique({ where: { id }, include: { _count: { select: { announcements: true } } } });
  if (!cat) return fail("找不到這個分類。");
  if (cat._count.announcements > 0 && !confirmed) {
    return { ok: true as const, deleted: false, inUse: cat._count.announcements };
  }
  await db.category.delete({ where: { id } });
  refreshPublic();
  return { ok: true as const, deleted: true, inUse: 0 };
}

export async function reorderCategories(ids: string[]) {
  const denied = await guard();
  if (denied) return denied;
  if (!Array.isArray(ids) || ids.length > 200 || ids.some((i) => typeof i !== "string")) return fail("資料格式不正確。");
  await db.$transaction(ids.map((cid, i) => db.category.updateMany({ where: { id: cid }, data: { sortOrder: i + 1 } })));
  refreshPublic();
  return { ok: true as const };
}

// ───────────────────────── 系統設定 ─────────────────────────

export async function saveSettings(raw: unknown) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return fail(firstZodError(parsed.error));
  const old = await db.siteSetting.findUnique({ where: { key: "logoUrl" } });
  const entries = Object.entries(parsed.data) as [SettingKey, string][];
  await db.$transaction(
    entries.map(([key, value]) => {
      const v = key === "logoUrl" && value === "" ? SETTING_DEFAULTS.logoUrl : value;
      return db.siteSetting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } });
    }),
  );
  if (old && old.value !== parsed.data.logoUrl) await cleanupFiles([old.value]);
  refreshPublic();
  return { ok: true as const };
}
