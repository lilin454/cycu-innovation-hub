// 日期與費用格式化。所有時間一律以台北時間（UTC+8）呈現與輸入。
import { FEE_LABEL, type FeeTypeKey } from "./constants";

const TZ = "Asia/Taipei";
const WEEK: Record<string, string> = { Sun: "日", Mon: "一", Tue: "二", Wed: "三", Thu: "四", Fri: "五", Sat: "六" };

type DateLike = Date | string | null | undefined;

function toDate(d: DateLike): Date | null {
  if (!d) return null;
  const v = d instanceof Date ? d : new Date(d);
  return isNaN(v.getTime()) ? null : v;
}

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

export function dateParts(d: DateLike) {
  const v = toDate(d);
  if (!v) return null;
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(v)) p[part.type] = part.value;
  return {
    y: p.year,
    m: p.month,
    d: p.day,
    hh: p.hour === "24" ? "00" : p.hour,
    mm: p.minute,
    w: WEEK[p.weekday] ?? "",
  };
}

export function formatDate(d: DateLike): string {
  const p = dateParts(d);
  return p ? `${p.y}/${p.m}/${p.d}` : "";
}

export function formatDateW(d: DateLike): string {
  const p = dateParts(d);
  return p ? `${p.y}/${p.m}/${p.d}（${p.w}）` : "";
}

export function formatDateTime(d: DateLike): string {
  const p = dateParts(d);
  return p ? `${p.y}/${p.m}/${p.d}（${p.w}）${p.hh}:${p.mm}` : "";
}

/** 2026/12/20（日）14:00–16:00 或跨日的完整區間 */
export function formatRange(start: DateLike, end: DateLike): string {
  const s = dateParts(start);
  const e = dateParts(end);
  if (!s && !e) return "";
  if (s && !e) return formatDateTime(start);
  if (!s && e) return `至 ${formatDateTime(end)}`;
  if (s!.y === e!.y && s!.m === e!.m && s!.d === e!.d) {
    return `${formatDateTime(start)}–${e!.hh}:${e!.mm}`;
  }
  return `${formatDateTime(start)} – ${formatDateTime(end)}`;
}

/** 給 <input type="datetime-local"> 用的值（台北時間） */
export function toInputValue(d: DateLike): string {
  const p = dateParts(d);
  return p ? `${p.y}-${p.m}-${p.d}T${p.hh}:${p.mm}` : "";
}

/** 把 datetime-local 的值（視為台北時間）轉成 Date */
export function fromInputValue(v: string | null | undefined): Date | null {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return null;
  const d = new Date(`${v.slice(0, 16)}:00+08:00`);
  return isNaN(d.getTime()) ? null : d;
}

export function formatMoney(n: number): string {
  return `NT$${n.toLocaleString("en-US")}`;
}

/** 完整費用說明：免費 / NT$500 / 保證金 NT$1,000（完成後退還） */
export function formatFee(feeType: FeeTypeKey, amount?: number | null, desc?: string | null): string {
  let base: string;
  if (feeType === "FREE") base = "免費";
  else if (feeType === "PAID") base = amount ? formatMoney(amount) : "付費";
  else if (feeType === "DEPOSIT") base = amount ? `保證金 ${formatMoney(amount)}` : "保證金";
  else base = FEE_LABEL.VARIES;
  const extra = desc?.trim();
  return extra ? `${base}（${extra}）` : base;
}

/** 標籤上用的簡短費用文字 */
export function feeBadge(feeType: FeeTypeKey, amount?: number | null): string {
  if (feeType === "FREE") return "免費";
  if (feeType === "PAID") return amount ? `付費 ${formatMoney(amount)}` : "付費";
  if (feeType === "DEPOSIT") return amount ? `保證金 ${formatMoney(amount)}` : "保證金";
  return "費用依內容而定";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
