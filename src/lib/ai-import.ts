import "server-only";
import { z } from "zod";
import { all } from "./db";
import { randomSlug } from "./announcements";
import { FEE_TYPES } from "./constants";
import { toInputValue } from "./format";
import { UNPUBLISH_MODES } from "./lifecycle-sql";
import { defaultSurveyQuestions, resolveSurveyQuestions, SURVEY_TYPES } from "./survey";
import type { AnnouncementDetail } from "./types";
import type { AnnouncementInput, SaveIntent } from "./validation";

/**
 * AI 匯入：把 AI 整理好的「寬鬆」JSON 轉成後台編輯器使用的公告格式。
 * 分類用名稱指定（不用 id），時間可用台北時間或帶時區的 ISO 字串，缺的欄位自動補空白。
 * 轉換後一律再經過 announcementSchema 驗證，規則和人工在後台儲存完全相同。
 */

const str = (max: number) => z.string().trim().max(max).optional().default("");
const time = z.string().trim().max(40).optional().default("");

export const aiAnnouncementSchema = z.object({
  action: z.enum(["draft", "publish", "schedule"]).optional().default("draft"),
  scheduledAt: time,
  title: z.string().trim().min(1, "title 不可空白").max(120),
  subtitle: str(160),
  summary: str(400),
  content: z.string().max(50_000).optional().default(""),
  slug: z.string().trim().toLowerCase().max(60).optional().default(""),
  startAt: time,
  endAt: time,
  registrationDeadline: time,
  location: str(200),
  organizer: str(200),
  coOrganizer: str(300),
  targetAudience: str(200),
  feeType: z.enum(FEE_TYPES).optional().default("FREE"),
  feeAmount: z.number().int().min(0).max(10_000_000).nullable().optional().default(null),
  feeDescription: str(200),
  prize: str(60),
  registrationUrl: str(500),
  registrationMethod: str(300),
  youtubeUrl: str(300),
  contactName: str(80),
  contactEmail: str(120),
  contactPhone: str(60),
  contactLine: str(120),
  contactOther: str(300),
  invitationText: str(1000),
  customShareText: str(2000),
  sources: z.array(z.string().trim().max(20)).max(10).optional().default([]),
  eventTypes: z.array(z.string().trim().max(20)).max(10).optional().default([]),
  tags: z.array(z.string().trim().min(1).max(20)).max(12).optional().default([]),
  coverImage: str(200),
  images: z.array(z.object({ url: z.string(), alt: str(120) })).max(30).optional().default([]),
  attachments: z
    .array(
      z.object({
        url: z.string(),
        fileName: z.string().trim().min(1).max(150),
        fileType: z.string(),
        fileSize: z.number().int().min(0),
        displayName: str(150),
      }),
    )
    .max(20)
    .optional()
    .default([]),
  survey: z
    .object({
      enabled: z.boolean(),
      questions: z.array(z.unknown()).max(20).optional(),
    })
    .optional(),
  isFeatured: z.boolean().optional().default(false),
  isPinned: z.boolean().optional().default(false),
  unpublishMode: z.enum(UNPUBLISH_MODES).optional().default("DEFAULT"),
  unpublishAt: time,
});
export type AiAnnouncement = z.infer<typeof aiAnnouncementSchema>;

/** 轉成台北時間的 datetime-local 字串；只有日期時，開始類補 00:00、結束類補 23:59 */
export function toTaipeiInput(v: string, endOfDay = false): string | null {
  if (!v) return "";
  const s = v.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T${endOfDay ? "23:59" : "00:00"}`;
  // 沒有時區：視為台北時間
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) return s.slice(0, 16);
  // 有時區（Z 或 +08:00）：換算成台北時間
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : toInputValue(d);
  }
  return null;
}

export type Converted = { input: AnnouncementInput; intent: SaveIntent; warnings: string[] };

export async function convertAiAnnouncement(a: AiAnnouncement): Promise<{ ok: true; value: Converted } | { ok: false; error: string }> {
  const warnings: string[] = [];

  const times: Record<string, string> = {};
  for (const [key, endOfDay] of [
    ["startAt", false], ["endAt", true], ["registrationDeadline", true], ["scheduledAt", false], ["unpublishAt", false],
  ] as const) {
    const t = toTaipeiInput(a[key], endOfDay);
    if (t === null) return { ok: false, error: `${key} 的時間格式看不懂：「${a[key]}」。請用 2026-12-01T14:00（台北時間）。` };
    times[key] = t;
  }

  // 分類用名稱比對（不分大小寫、忽略空白）；找不到的回報在 warnings
  const cats = await all<{ id: string; kind: string; name: string }>(
    `SELECT "id", "kind", "name" FROM "Category" WHERE "kind" IN ('SOURCE', 'EVENT_TYPE')`,
  );
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const pick = (kind: "SOURCE" | "EVENT_TYPE", names: string[], label: string) =>
    names.flatMap((n) => {
      const hit = cats.find((c) => c.kind === kind && norm(c.name) === norm(n));
      if (!hit) warnings.push(`${label}「${n}」不存在，已略過（可用的名稱請看 GET /api/ai 的 categories）。`);
      return hit ? [hit.id] : [];
    });
  const categoryIds = [...pick("SOURCE", a.sources, "活動來源"), ...pick("EVENT_TYPE", a.eventTypes, "活動類型")];

  let slug = a.slug;
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    warnings.push(`slug「${slug}」格式不符，已改用自動產生的代稱。`);
    slug = "";
  }
  if (!slug) slug = await randomSlug();

  // 有給題目就沿用（即使問卷關閉也保留，之後打開不用重設）；開啟問卷但沒給題目時用預設題目
  const surveyEnabled = Boolean(a.survey?.enabled);
  const surveyQuestions = (
    a.survey?.questions?.length ? a.survey.questions : surveyEnabled ? defaultSurveyQuestions() : []
  ) as AnnouncementInput["surveyQuestions"];

  const intent: SaveIntent = a.action === "publish" ? "publish" : a.action === "schedule" ? "schedule" : "draft";
  const input: AnnouncementInput = {
    title: a.title,
    subtitle: a.subtitle,
    summary: a.summary,
    slug,
    coverImage: a.coverImage,
    content: a.content,
    categoryIds,
    customTags: [...new Set(a.tags)],
    feeType: a.feeType,
    feeAmount: a.feeType === "FREE" ? null : a.feeAmount,
    feeDescription: a.feeDescription,
    startAt: times.startAt,
    endAt: times.endAt,
    registrationDeadline: times.registrationDeadline,
    location: a.location,
    organizer: a.organizer,
    coOrganizer: a.coOrganizer,
    targetAudience: a.targetAudience,
    registrationUrl: a.registrationUrl,
    registrationMethod: a.registrationMethod,
    contactName: a.contactName,
    contactEmail: a.contactEmail,
    contactPhone: a.contactPhone,
    contactLine: a.contactLine,
    contactOther: a.contactOther,
    invitationText: a.invitationText,
    customShareText: a.customShareText,
    prize: a.prize,
    surveyEnabled,
    surveyQuestions,
    youtubeUrl: a.youtubeUrl,
    isFeatured: a.isFeatured,
    isPinned: a.isPinned,
    scheduledAt: times.scheduledAt,
    unpublishMode: a.unpublishMode,
    unpublishAt: times.unpublishAt,
    attachments: a.attachments.map((f) => ({
      fileUrl: f.url,
      fileName: f.fileName,
      displayName: f.displayName || f.fileName,
      fileType: f.fileType,
      fileSize: f.fileSize,
    })),
    images: a.images.map((i) => ({ url: i.url, alt: i.alt })),
  };
  return { ok: true, value: { input, intent, warnings } };
}

/** GET /api/ai 回傳的說明：讓 AI 知道有哪些分類、欄位與限制 */
export async function aiManifest() {
  const cats = await all<{ kind: string; name: string }>(
    `SELECT "kind", "name" FROM "Category" WHERE "kind" IN ('SOURCE', 'EVENT_TYPE') ORDER BY "kind", "sortOrder"`,
  );
  return {
    timezone: "Asia/Taipei",
    now: toInputValue(new Date()),
    categories: {
      sources: cats.filter((c) => c.kind === "SOURCE").map((c) => c.name),
      eventTypes: cats.filter((c) => c.kind === "EVENT_TYPE").map((c) => c.name),
    },
    feeTypes: { FREE: "免費", PAID: "需付費（feeAmount 填金額）", DEPOSIT: "保證金（feeAmount 填金額）", VARIES: "依方案不同（說明寫在 feeDescription）" },
    surveyTypes: { short: "簡答", long: "詳答", single: "單選", multi: "多選", scale: "五點量表" },
    surveyTypeKeys: SURVEY_TYPES,
    contentMarkup: "純文字＋簡易標記：# 大標題、## 小標題、- 條列、1. 編號、> 引言、--- 分隔線、**粗體**；網址會自動變成連結。不支援 HTML。",
    limits: {
      title: 120, subtitle: 160, summary: 400, content: 50000, tags: 12, images: 30, attachments: 20,
      imageMaxMB: 8, fileMaxMB: 20,
      imageTypes: ["jpg", "jpeg", "png", "webp", "gif"],
      fileTypes: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "zip", "txt", "csv"],
    },
    endpoints: {
      "GET /api/ai": "這份說明",
      "GET /api/ai/announcements?q=關鍵字": "查詢最近的公告（避免重複上架）",
      "POST /api/ai/files": "multipart/form-data，欄位 file；回傳 url、fileName、fileType、fileSize",
      "POST /api/ai/announcements": "JSON；新增公告（預設存成草稿）",
      "GET /api/ai/announcements/{id}": "讀取單一公告的完整內容（AI 格式）",
      "PATCH /api/ai/announcements/{id}": "修改草稿：只送要改的欄位，其餘保留（需要「可編輯、刪除草稿」權限）",
      "DELETE /api/ai/announcements/{id}": "刪除草稿（需要「可編輯、刪除草稿」權限）",
    },
  };
}

/** 把資料庫裡的公告轉回 AI 使用的格式（GET 單筆、PATCH 合併修改時使用） */
export function aiFromExisting(a: AnnouncementDetail) {
  const t = (d: Date | null) => (d ? toInputValue(d) : "");
  return {
    id: a.id,
    status: a.status,
    slug: a.slug,
    title: a.title,
    subtitle: a.subtitle ?? "",
    summary: a.summary ?? "",
    content: a.content,
    startAt: t(a.startAt),
    endAt: t(a.endAt),
    registrationDeadline: t(a.registrationDeadline),
    location: a.location ?? "",
    organizer: a.organizer ?? "",
    coOrganizer: a.coOrganizer ?? "",
    targetAudience: a.targetAudience ?? "",
    feeType: a.feeType,
    feeAmount: a.feeType === "FREE" ? null : a.feeAmount,
    feeDescription: a.feeDescription ?? "",
    prize: a.prize ?? "",
    registrationUrl: a.registrationUrl ?? "",
    registrationMethod: a.registrationMethod ?? "",
    youtubeUrl: a.youtubeUrl ?? "",
    contactName: a.contactName ?? "",
    contactEmail: a.contactEmail ?? "",
    contactPhone: a.contactPhone ?? "",
    contactLine: a.contactLine ?? "",
    contactOther: a.contactOther ?? "",
    invitationText: a.invitationText ?? "",
    customShareText: a.customShareText ?? "",
    sources: a.categories.filter((c) => c.kind === "SOURCE").map((c) => c.name),
    eventTypes: a.categories.filter((c) => c.kind === "EVENT_TYPE").map((c) => c.name),
    tags: a.categories.filter((c) => c.kind === "TAG").map((c) => c.name),
    coverImage: a.coverImage ?? "",
    images: a.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })),
    attachments: a.attachments.map((f) => ({
      url: f.fileUrl, fileName: f.fileName, fileType: f.fileType, fileSize: f.fileSize, displayName: f.displayName,
    })),
    survey: { enabled: a.surveyEnabled, questions: resolveSurveyQuestions(a) },
    isFeatured: a.isFeatured,
    isPinned: a.isPinned,
    unpublishMode: a.unpublishMode,
    unpublishAt: t(a.unpublishAt),
  };
}
