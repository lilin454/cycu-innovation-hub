import { z } from "zod";
import { FEE_TYPES } from "./constants";
import { youtubeId } from "./youtube";
import { UNPUBLISH_MODES } from "./lifecycle-sql";
import { SURVEY_MAX_OPTIONS, SURVEY_MAX_QUESTIONS, SURVEY_TYPES } from "./survey";

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
  content: z.string().max(50_000, "內文過長（上限 5 萬字）"),
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
  surveyEnabled: z.boolean(),
  surveyQuestions: z
    .array(
      z
        .object({
          id: z.string().regex(/^[a-z0-9_]{1,40}$/i, "題目代號不正確"),
          type: z.enum(SURVEY_TYPES),
          title: text(120).min(1, "問卷的每一題都要填寫題目"),
          required: z.boolean(),
          options: z.array(text(60)).max(SURVEY_MAX_OPTIONS, `每題最多 ${SURVEY_MAX_OPTIONS} 個選項`),
          scaleMin: text(30),
          scaleMax: text(30),
          role: z.enum(["name", "studentId"]).optional(),
        })
        .refine(
          (q) => !(q.type === "single" || q.type === "multi") || new Set(q.options.filter((o) => o.trim())).size >= 2,
          "單選或多選題至少要有 2 個不重複的選項",
        ),
    )
    .max(SURVEY_MAX_QUESTIONS, `問卷最多 ${SURVEY_MAX_QUESTIONS} 題`),
  youtubeUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || youtubeId(v) !== null, "請貼上有效的 YouTube 影片網址"),
  isFeatured: z.boolean(),
  isPinned: z.boolean(),
  scheduledAt: dateInput,
  unpublishMode: z.enum(UNPUBLISH_MODES),
  unpublishAt: dateInput,
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
  siteAliases: text(300),
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
  nextUpId: z.string().regex(/^[a-z0-9]{0,40}$/i, "下一場活動的設定不正確"),
  showNextUp: flag,
  showStats: flag,
  showFeatured: flag,
  showCategoryIndex: flag,
  showAbout: flag,
  showCalendar: flag,
  showRecords: flag,
  autoUnpublishEnded: flag,
  // 可以貼整段 <meta name="google-site-verification" content="…"> 或只貼 content 的值
  googleSiteVerification: z
    .string()
    .trim()
    .max(300)
    .transform((v) => /content=["']([^"']+)["']/i.exec(v)?.[1] ?? v)
    .refine((v) => v === "" || /^[A-Za-z0-9_-]{10,100}$/.test(v), "Google 驗證碼格式不正確，請貼上 Search Console 給的 HTML 標記"),
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

export const milestoneSchema = z.object({
  title: text(120).min(1, "請填寫標題"),
  kind: z.enum(["AWARD", "VISIT", "EVENT", "OTHER"]),
  subject: z.enum(["CLUB", "OFFICER", "MEMBER"]),
  people: text(200),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "請選擇日期"),
  location: text(200),
  content: z.string().max(5000, "說明過長（上限 5000 字）"),
  coverImage: z.union([fileUrl, z.literal("")]),
  linkUrl: optionalUrl,
  published: z.boolean(),
});

/** 標誌：自己上傳的檔案或網站內建的 /brand 圖片 */
const logoPath = z.union([
  fileUrl,
  z.string().regex(/^\/brand\/[a-z0-9-]{1,40}\.(png|jpg|jpeg|webp|svg)$/, "標誌路徑不正確"),
  z.literal(""),
]);

export const officerSchema = z.object({
  role: text(20).min(1, "請填寫職稱"),
  name: text(40).min(1, "請填寫姓名"),
  photoUrl: z.union([fileUrl, z.literal("")]),
});

export const orgSchema = z.object({
  kind: z.enum(["PARTNER", "SOURCE"]),
  name: text(60).min(1, "請填寫名稱"),
  logoUrl: logoPath,
  linkUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v) || /^\/(?!\/)[^\s]*$/.test(v),
      "連結請填完整網址（https:// 開頭），或站內路徑（/ 開頭）",
    ),
});

export function firstZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue?.message ?? "資料格式不正確";
}
