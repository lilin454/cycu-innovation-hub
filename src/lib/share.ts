// 分享文案產生器（純函式，前後端共用）
import type { FeeTypeKey } from "./constants";
import { formatDateTime, formatFee, formatRange } from "./format";

type DateLike = Date | string | null | undefined;

export type ShareSource = {
  slug: string;
  title: string;
  summary?: string | null;
  feeType: FeeTypeKey;
  feeAmount?: number | null;
  feeDescription?: string | null;
  startAt?: DateLike;
  endAt?: DateLike;
  registrationDeadline?: DateLike;
  location?: string | null;
  targetAudience?: string | null;
  registrationMethod?: string | null;
  registrationUrl?: string | null;
  invitationText?: string | null;
  customShareText?: string | null;
};

export const SHARE_VARIABLES = [
  ["{標題}", "活動標題"],
  ["{摘要}", "活動摘要"],
  ["{活動時間}", "活動時間"],
  ["{活動地點}", "活動地點"],
  ["{費用}", "費用"],
  ["{活動對象}", "活動對象"],
  ["{報名截止}", "報名截止時間"],
  ["{報名連結}", "報名連結"],
  ["{短連結}", "活動專屬短連結"],
] as const;

export function shareUrl(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/a/${slug}`;
}

const FEE_HEAD: Record<FeeTypeKey, string> = {
  FREE: "免費活動",
  PAID: "付費活動",
  DEPOSIT: "保證金活動",
  VARIES: "活動資訊",
};

export function buildAutoShareText(a: ShareSource, baseUrl: string): string {
  const url = shareUrl(baseUrl, a.slug);
  const lines: string[] = [`【${FEE_HEAD[a.feeType]}｜${a.title.trim() || "未命名活動"}】`];

  const intro = (a.invitationText || a.summary || "").trim();
  if (intro) lines.push("", intro);

  const info: string[] = [];
  const time = formatRange(a.startAt, a.endAt);
  if (time) info.push(`活動時間｜${time}`);
  if (a.location?.trim()) info.push(`活動地點｜${a.location.trim()}`);
  info.push(`活動費用｜${formatFee(a.feeType, a.feeAmount, a.feeDescription)}`);
  if (a.targetAudience?.trim()) info.push(`活動對象｜${a.targetAudience.trim()}`);
  const deadline = formatDateTime(a.registrationDeadline);
  if (deadline) info.push(`報名截止｜${deadline}`);
  if (a.registrationMethod?.trim()) info.push(`報名方式｜${a.registrationMethod.trim()}`);
  lines.push("", ...info);

  lines.push("", "活動簡章與報名資訊：", url, "", "歡迎轉傳給有興趣的朋友！");
  return lines.join("\n");
}

export function buildShareText(a: ShareSource, baseUrl: string): string {
  const custom = a.customShareText?.trim();
  if (!custom) return buildAutoShareText(a, baseUrl);
  const vars: Record<string, string> = {
    "{標題}": a.title,
    "{摘要}": a.summary ?? "",
    "{活動時間}": formatRange(a.startAt, a.endAt),
    "{活動地點}": a.location ?? "",
    "{費用}": formatFee(a.feeType, a.feeAmount, a.feeDescription),
    "{活動對象}": a.targetAudience ?? "",
    "{報名截止}": formatDateTime(a.registrationDeadline),
    "{報名連結}": a.registrationUrl ?? "",
    "{短連結}": shareUrl(baseUrl, a.slug),
  };
  return custom.replace(/\{[^{}\n]{1,8}\}/g, (m) => (m in vars ? vars[m] : m));
}
