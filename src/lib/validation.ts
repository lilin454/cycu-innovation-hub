import { z } from "zod";
import { FEE_TYPES } from "./constants";
import { youtubeId } from "./youtube";

const text = (max: number) => z.string().trim().max(max, `不可超過 ${max} 字`);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "請輸入以 http:// 或 https:// 開頭的完整網址");
const fileUrl = z.string().regex(/^\/files\/(images|docs)\/\d{4}\/\d{2}\/[a-f0-9]{24}\.[a-z0-9]{1,5}$/, "檔案路徑不正確");
const dateInput = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v), "日期格式不正確");

export const announcementSchema = z.object({
  title: text(120).min(1, "請填寫活動標題"),
  subtitle: text(160),
  summary: text(400),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "網址代稱只能使用小寫英文、數字與連字號（-）")
    .min(3, "網址代稱至少 3 個字元")
    .max(60, "網址代稱不可超過 60 個字元"),
  coverImage: z.union([fileUrl, z.literal("")]),
  content: z.string().max(300_000, "內文過長"),
  categoryIds: z.array(z.string().min(1).max(40)).max(40),
  customTags: z.array(text(20).min(1)).max(12),
  feeType: z.enum(FEE_TYPES),
  feeAmount: z.union([z.number().int().min(0).max(10_000_000), z.null()]),
  feeDescription: text(200),
  startAt: dateInput,
  endAt: dateInput,
  registrationDeadline: dateInput,
  location: text(200),
  organizer: text(200),
  coOrganizer: text(300),
  targetAudience: text(200),
  registrationUrl: optionalUrl,
  registrationMethod: text(300),
  contactName: text(80),
  contactEmail: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email 格式不正確"),
  contactPhone: text(60),
  contactLine: text(120),
  contactOther: text(300),
  invitationText: text(1000),
  customShareText: text(2000),
  prize: text(60),
  youtubeUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || youtubeId(v) !== null, "請貼上有效的 YouTube 影片網址"),
  isFeatured: z.boolean(),
  isPinned: z.boolean(),
  scheduledAt: dateInput,
  attachments: z
    .array(
      z.object({
        fileUrl,
        fileName: text(150).min(1),
        displayName: text(150).min(1, "附件顯示名稱不可空白"),
        fileType: z.string().regex(/^[a-z0-9]{1,5}$/),
        fileSize: z.number().int().min(0),
      }),
    )
    .max(20, "附件最多 20 個"),
  images: z.array(z.object({ url: fileUrl, alt: text(120) })).max(30, "活動圖片最多 30 張"),
});

export type AnnouncementInput = z.infer<typeof announcementSchema>;

export const SAVE_INTENTS = ["save", "publish", "schedule", "unpublish", "archive", "draft"] as const;
export type SaveIntent = (typeof SAVE_INTENTS)[number];

export const categorySchema = z.object({
  kind: z.enum(["SOURCE", "EVENT_TYPE", "TAG"]),
  name: text(20).min(1, "請填寫名稱"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "顏色格式不正確"),
});

const flag = z.enum(["1", "0"]);

export const settingsSchema = z.object({
  siteName: text(60).min(1, "請填寫網站名稱"),
  siteShortName: text(60),
  siteNameEn: text(120),
  logoUrl: z.union([fileUrl, z.literal(""), z.literal("/brand/logo.jpg")]),
  heroTagline: text(60).min(1, "請填寫首頁標語"),
  heroIntro: text(300),
  aboutText: text(2000),
  instagramUrl: optionalUrl,
  facebookUrl: optionalUrl,
  lineUrl: optionalUrl,
  otherSocialUrl: optionalUrl,
  contactEmail: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email 格式不正確"),
  contactOther: text(200),
  cycuInfo: text(200),
  footerText: text(200),
  presidentName: text(40),
  showNextUp: flag,
  showStats: flag,
  showFeatured: flag,
  showCategoryIndex: flag,
  showSources: flag,
  showAbout: flag,
});

export const userCreateSchema = z.object({
  account: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,64}$/, "帳號必須是 3–64 個字元的英文小寫、數字或 . _ -"),
  displayName: text(40).min(1, "請填寫顯示名稱"),
  password: z.string().min(10, "密碼至少需要 10 個字元").max(200, "密碼過長"),
  role: z.enum(["OWNER", "EDITOR"]),
});

export function firstZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue?.message ?? "資料格式不正確";
}
