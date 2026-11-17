import "server-only";
import { all, first, likePattern, nowIso, placeholders, run } from "./db";
import { FEE_SLUG, FEE_TYPES, SORTS, STATUSES, type FeeTypeKey, type SortKey, type StatusKey } from "./constants";
import {
  mapAnnouncement,
  type Announcement,
  type AnnouncementCard,
  type AnnouncementDetail,
  type AnnouncementImage,
  type AnnouncementRow,
  type Attachment,
  type Category,
} from "./types";

export type { AnnouncementCard, AnnouncementDetail } from "./types";

export const PAGE_SIZE = 8;

/**
 * 排程發布：把到期的「已排程」公告改為「已發布」（單一 SQL，成本很低）。
 * 由兩個地方觸發：
 * 1. Cloudflare Cron Trigger 每 5 分鐘執行一次（custom-worker.ts）
 * 2. 前台與後台每次讀取公告之前（保證訪客看到的一定是最新狀態）
 */
export async function publishDue(): Promise<number> {
  const now = nowIso();
  return run(
    `UPDATE "Announcement" SET "status" = 'PUBLISHED', "publishedAt" = "scheduledAt", "scheduledAt" = NULL, "updatedAt" = ?
     WHERE "status" = 'SCHEDULED' AND "scheduledAt" <= ?`,
    now,
    now,
  );
}

/** 一次查詢取回多則公告的分類，避免逐筆查詢 */
async function withCategories(items: Announcement[]): Promise<AnnouncementCard[]> {
  if (!items.length) return [];
  const ids = items.slice(0, 90).map((a) => a.id);
  const rows = await all<Category & { announcementId: string }>(
    `SELECT ac."announcementId", c.* FROM "AnnouncementCategory" ac JOIN "Category" c ON c."id" = ac."categoryId"
     WHERE ac."announcementId" IN (${placeholders(ids.length)}) ORDER BY c."sortOrder", c."name"`,
    ...ids,
  );
  const map = new Map<string, Category[]>();
  for (const { announcementId, ...c } of rows) {
    const list = map.get(announcementId) ?? [];
    list.push(c);
    map.set(announcementId, list);
  }
  return items.map((a) => ({ ...a, categories: map.get(a.id) ?? [] }));
}

async function toDetail(a: Announcement): Promise<AnnouncementDetail> {
  const [[card], attachments, images] = await Promise.all([
    withCategories([a]),
    all<Attachment>(`SELECT * FROM "Attachment" WHERE "announcementId" = ? ORDER BY "sortOrder"`, a.id),
    all<AnnouncementImage>(`SELECT * FROM "AnnouncementImage" WHERE "announcementId" = ? ORDER BY "sortOrder"`, a.id),
  ]);
  return { ...card, attachments, images };
}

// ───────────────────────── 前台篩選 ─────────────────────────

export type PublicFilters = {
  q: string;
  sources: string[];
  types: string[];
  fee: FeeTypeKey | null;
  sort: SortKey;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const list = (v: string | string[] | undefined) =>
  one(v)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{1,40}$/.test(s))
    .slice(0, 20);

export function parseFilters(sp: RawParams): PublicFilters {
  const feeSlug = one(sp.fee);
  const fee = FEE_TYPES.find((f) => FEE_SLUG[f] === feeSlug) ?? null;
  const sortRaw = one(sp.sort);
  const page = Math.max(1, Math.min(500, parseInt(one(sp.page), 10) || 1));
  return {
    q: one(sp.q).trim().slice(0, 60),
    sources: list(sp.source),
    types: list(sp.type),
    fee,
    sort: sortRaw in SORTS ? (sortRaw as SortKey) : "latest",
    page,
  };
}

export function filtersToQuery(f: Partial<PublicFilters>): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.sources?.length) p.set("source", f.sources.join(","));
  if (f.types?.length) p.set("type", f.types.join(","));
  if (f.fee) p.set("fee", FEE_SLUG[f.fee]);
  if (f.sort && f.sort !== "latest") p.set("sort", f.sort);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function hasActiveFilters(f: PublicFilters): boolean {
  return Boolean(f.q || f.sources.length || f.types.length || f.fee);
}

type Where = { sql: string[]; params: (string | number)[] };

const SEARCH_COLUMNS = ["title", "subtitle", "summary", "content", "organizer", "location", "slug"];

function addSearch(w: Where, q: string) {
  const pattern = likePattern(q);
  const cols = SEARCH_COLUMNS.map((c) => `a."${c}" LIKE ? ESCAPE '\\'`);
  w.sql.push(
    `(${cols.join(" OR ")} OR EXISTS (SELECT 1 FROM "AnnouncementCategory" ac JOIN "Category" c ON c."id" = ac."categoryId"
      WHERE ac."announcementId" = a."id" AND c."name" LIKE ? ESCAPE '\\'))`,
  );
  w.params.push(...SEARCH_COLUMNS.map(() => pattern), pattern);
}

function addCategoryFilter(w: Where, kind: "SOURCE" | "EVENT_TYPE", slugs: string[]) {
  w.sql.push(
    `EXISTS (SELECT 1 FROM "AnnouncementCategory" ac JOIN "Category" c ON c."id" = ac."categoryId"
      WHERE ac."announcementId" = a."id" AND c."kind" = '${kind}' AND c."slug" IN (${placeholders(slugs.length)}))`,
  );
  w.params.push(...slugs);
}

export async function listPublic(f: PublicFilters, pageSize = PAGE_SIZE) {
  await publishDue();
  const w: Where = { sql: [`a."status" = 'PUBLISHED'`], params: [] };
  if (f.q) addSearch(w, f.q);
  // 不同分類之間為「且」，同一分類內多選為「或」
  if (f.sources.length) addCategoryFilter(w, "SOURCE", f.sources);
  if (f.types.length) addCategoryFilter(w, "EVENT_TYPE", f.types);
  if (f.fee) {
    w.sql.push(`a."feeType" = ?`);
    w.params.push(f.fee);
  }
  const where = w.sql.join(" AND ");
  const orderBy =
    f.sort === "event_asc"
      ? `a."startAt" IS NULL, a."startAt" ASC, a."publishedAt" DESC`
      : f.sort === "event_desc"
        ? `a."startAt" IS NULL, a."startAt" DESC, a."publishedAt" DESC`
        : `a."isPinned" DESC, a."publishedAt" DESC`;

  const total = (await first<{ n: number }>(`SELECT COUNT(*) AS n FROM "Announcement" a WHERE ${where}`, ...w.params))?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(f.page, pages);
  const rows = await all<AnnouncementRow>(
    `SELECT a.* FROM "Announcement" a WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    ...w.params,
    pageSize,
    (page - 1) * pageSize,
  );
  return { items: await withCategories(rows.map(mapAnnouncement)), total, pages, page };
}

export async function getFeatured(): Promise<AnnouncementCard[]> {
  const rows = await all<AnnouncementRow>(
    `SELECT * FROM "Announcement" WHERE "status" = 'PUBLISHED' AND "isFeatured" = 1 ORDER BY "isPinned" DESC, "publishedAt" DESC LIMIT 3`,
  );
  return withCategories(rows.map(mapAnnouncement));
}

/** 台北時間的日期字串（YYYY-MM-DD） */
const taipeiDay = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 10);

/**
 * 首頁「下一場活動」。
 * pinnedId 是總管理員在設定裡指定的公告；它已下架或已結束時，自動改回時間最近的一場。
 * sameDay 是同一天（台北時間）開始的其他活動，讓首頁可以列出來。
 */
export async function getNextUp(pinnedId = ""): Promise<{ main: Announcement | null; sameDay: Announcement[] }> {
  const now = nowIso();
  let row: AnnouncementRow | null = null;
  if (/^[a-z0-9]{1,40}$/i.test(pinnedId)) {
    row = await first<AnnouncementRow>(
      `SELECT * FROM "Announcement" WHERE "id" = ? AND "status" = 'PUBLISHED' AND "startAt" IS NOT NULL
         AND ("startAt" >= ? OR COALESCE("endAt", '') >= ?)`,
      pinnedId, now, now,
    );
  }
  row ??= await first<AnnouncementRow>(
    `SELECT * FROM "Announcement" WHERE "status" = 'PUBLISHED' AND "startAt" >= ? ORDER BY "startAt" ASC LIMIT 1`,
    now,
  );
  if (!row?.startAt) return { main: row ? mapAnnouncement(row) : null, sameDay: [] };
  const day = taipeiDay(row.startAt);
  // 台北當天 00:00 ～ 隔天 00:00，換算回 UTC
  const from = new Date(`${day}T00:00:00+08:00`).toISOString();
  const to = new Date(new Date(from).getTime() + 86400_000).toISOString();
  const others = await all<AnnouncementRow>(
    `SELECT * FROM "Announcement" WHERE "status" = 'PUBLISHED' AND "id" != ? AND "startAt" >= ? AND "startAt" < ?
     ORDER BY "startAt" ASC LIMIT 6`,
    row.id, from, to,
  );
  return { main: mapAnnouncement(row), sameDay: others.map(mapAnnouncement) };
}

/** 後台設定用：尚未開始或進行中的已發布活動 */
export async function listUpcomingForPicker(): Promise<{ id: string; startAt: string; title: string }[]> {
  const now = nowIso();
  return all<{ id: string; startAt: string; title: string }>(
    `SELECT "id", "startAt", "title" FROM "Announcement"
     WHERE "status" = 'PUBLISHED' AND "startAt" IS NOT NULL AND ("startAt" >= ? OR COALESCE("endAt", '') >= ?)
     ORDER BY "startAt" ASC LIMIT 60`,
    now, now,
  );
}

export async function getPublicStats() {
  const row = await first<{ total: number; upcoming: number; free: number }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM("startAt" >= ?), 0) AS upcoming,
            COALESCE(SUM("feeType" = 'FREE'), 0) AS free
     FROM "Announcement" WHERE "status" = 'PUBLISHED'`,
    nowIso(),
  );
  return row ?? { total: 0, upcoming: 0, free: 0 };
}

export async function getPublicBySlug(slug: string): Promise<AnnouncementDetail | null> {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  await publishDue();
  const row = await first<AnnouncementRow>(`SELECT * FROM "Announcement" WHERE "slug" = ? AND "status" = 'PUBLISHED'`, slug);
  return row ? toDetail(mapAnnouncement(row)) : null;
}

export async function getRelated(a: AnnouncementDetail, take = 3): Promise<AnnouncementCard[]> {
  const catIds = a.categories.filter((c) => c.kind !== "TAG").map((c) => c.id);
  // 有共同分類的排前面，其餘以最新發布補滿
  const rows = await all<AnnouncementRow>(
    `SELECT a.*, ${
      catIds.length
        ? `EXISTS (SELECT 1 FROM "AnnouncementCategory" ac WHERE ac."announcementId" = a."id" AND ac."categoryId" IN (${placeholders(catIds.length)}))`
        : "0"
    } AS related
     FROM "Announcement" a WHERE a."status" = 'PUBLISHED' AND a."id" != ?
     ORDER BY related DESC, a."publishedAt" DESC LIMIT ?`,
    ...catIds,
    a.id,
    take,
  );
  return withCategories(rows.map(mapAnnouncement));
}

/** 行事曆：取得某個月份（台灣時間）內有舉辦的已發布活動，含跨月的活動 */
export async function getCalendarMonth(year: number, month: number): Promise<Announcement[]> {
  await publishDue();
  // 台灣時間當月 1 日 00:00 = UTC 前一天 16:00
  const start = new Date(Date.UTC(year, month - 1, 1) - 8 * 3600_000).toISOString();
  const end = new Date(Date.UTC(year, month, 1) - 8 * 3600_000).toISOString();
  const rows = await all<AnnouncementRow>(
    `SELECT * FROM "Announcement" WHERE "status" = 'PUBLISHED' AND "startAt" IS NOT NULL
       AND "startAt" < ? AND COALESCE("endAt", "startAt") >= ? ORDER BY "startAt" ASC LIMIT 300`,
    end,
    start,
  );
  return rows.map(mapAnnouncement);
}

/** 分類與其「已發布」公告數量 */
export async function getCategoriesWithCounts() {
  return all<Category & { count: number }>(
    `SELECT c.*, (SELECT COUNT(*) FROM "AnnouncementCategory" ac JOIN "Announcement" a ON a."id" = ac."announcementId"
                  WHERE ac."categoryId" = c."id" AND a."status" = 'PUBLISHED') AS count
     FROM "Category" c WHERE c."kind" IN ('SOURCE', 'EVENT_TYPE') ORDER BY c."kind", c."sortOrder", c."name"`,
  );
}

export type CategoryWithCount = Awaited<ReturnType<typeof getCategoriesWithCounts>>[number];

// ───────────────────────── 後台查詢 ─────────────────────────

export async function getAnnouncementById(id: string): Promise<AnnouncementDetail | null> {
  if (!/^[a-z0-9]{1,40}$/i.test(id)) return null;
  const row = await first<AnnouncementRow>(`SELECT * FROM "Announcement" WHERE "id" = ?`, id);
  return row ? toDetail(mapAnnouncement(row)) : null;
}

export const ADMIN_SORTS = {
  updated: "最後更新",
  published: "發布時間",
  event_asc: "活動日期（近→遠）",
  event_desc: "活動日期（遠→近）",
} as const;
export type AdminSort = keyof typeof ADMIN_SORTS;

export type AdminFilters = {
  q: string;
  status: StatusKey | null;
  showAll: boolean;
  fee: FeeTypeKey | null;
  category: string;
  sort: AdminSort;
  page: number;
};

export function parseAdminFilters(sp: RawParams) {
  const statusRaw = one(sp.status);
  const feeRaw = one(sp.fee);
  const sortRaw = one(sp.sort);
  const filters: AdminFilters = {
    q: one(sp.q).trim().slice(0, 60),
    status: (STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as StatusKey) : null,
    showAll: statusRaw === "all",
    fee: (FEE_TYPES as readonly string[]).includes(feeRaw) ? (feeRaw as FeeTypeKey) : null,
    category: /^[a-z0-9_]{1,40}$/i.test(one(sp.category)) ? one(sp.category) : "",
    sort: sortRaw in ADMIN_SORTS ? (sortRaw as AdminSort) : "updated",
    page: Math.max(1, parseInt(one(sp.page), 10) || 1),
  };
  return { filters, raw: { status: statusRaw, fee: feeRaw } };
}

export async function listAdmin(f: AdminFilters, pageSize = 15) {
  await publishDue();
  const w: Where = { sql: [], params: [] };
  if (f.status) {
    w.sql.push(`a."status" = ?`);
    w.params.push(f.status);
  } else if (!f.showAll) {
    w.sql.push(`a."status" != 'ARCHIVED'`);
  }
  if (f.fee) {
    w.sql.push(`a."feeType" = ?`);
    w.params.push(f.fee);
  }
  if (f.category) {
    w.sql.push(`EXISTS (SELECT 1 FROM "AnnouncementCategory" ac WHERE ac."announcementId" = a."id" AND ac."categoryId" = ?)`);
    w.params.push(f.category);
  }
  if (f.q) addSearch(w, f.q);
  const where = w.sql.length ? w.sql.join(" AND ") : "1 = 1";
  const orderBy = {
    updated: `a."updatedAt" DESC`,
    published: `a."publishedAt" IS NULL, a."publishedAt" DESC`,
    event_asc: `a."startAt" IS NULL, a."startAt" ASC`,
    event_desc: `a."startAt" IS NULL, a."startAt" DESC`,
  }[f.sort];

  const total = (await first<{ n: number }>(`SELECT COUNT(*) AS n FROM "Announcement" a WHERE ${where}`, ...w.params))?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(f.page, pages);
  const rows = await all<AnnouncementRow>(
    `SELECT a.* FROM "Announcement" a WHERE ${where} ORDER BY a."isPinned" DESC, ${orderBy} LIMIT ? OFFSET ?`,
    ...w.params,
    pageSize,
    (page - 1) * pageSize,
  );
  return { items: await withCategories(rows.map(mapAnnouncement)), total, pages, page };
}

export async function getDashboard() {
  await publishDue();
  const now = nowIso();
  const [groups, upcoming, recent, scheduled] = await Promise.all([
    all<{ status: StatusKey; n: number }>(`SELECT "status", COUNT(*) AS n FROM "Announcement" GROUP BY "status"`),
    all<AnnouncementRow>(`SELECT * FROM "Announcement" WHERE "status" = 'PUBLISHED' AND "startAt" >= ? ORDER BY "startAt" ASC LIMIT 5`, now),
    all<AnnouncementRow>(`SELECT * FROM "Announcement" WHERE "status" != 'ARCHIVED' ORDER BY "updatedAt" DESC LIMIT 6`),
    all<AnnouncementRow>(`SELECT * FROM "Announcement" WHERE "status" = 'SCHEDULED' ORDER BY "scheduledAt" ASC LIMIT 5`),
  ]);
  const upcomingCount =
    (await first<{ n: number }>(`SELECT COUNT(*) AS n FROM "Announcement" WHERE "status" = 'PUBLISHED' AND "startAt" >= ?`, now))?.n ?? 0;
  return {
    counts: Object.fromEntries(groups.map((g) => [g.status, g.n])) as Partial<Record<StatusKey, number>>,
    total: groups.reduce((n, g) => n + g.n, 0),
    upcomingCount,
    upcoming: upcoming.map(mapAnnouncement),
    recent: recent.map(mapAnnouncement),
    scheduled: scheduled.map(mapAnnouncement),
  };
}

export async function listCategories(kinds: ("SOURCE" | "EVENT_TYPE" | "TAG")[]) {
  return all<Category>(
    `SELECT * FROM "Category" WHERE "kind" IN (${placeholders(kinds.length)}) ORDER BY "kind", "sortOrder", "name"`,
    ...kinds,
  );
}

export async function listCategoriesWithUsage() {
  return all<Category & { count: number }>(
    `SELECT c.*, (SELECT COUNT(*) FROM "AnnouncementCategory" ac WHERE ac."categoryId" = c."id") AS count
     FROM "Category" c ORDER BY c."kind", c."sortOrder", c."name"`,
  );
}

/** 產生不重複的 7 碼短網址代稱（排除容易混淆的字元） */
export async function randomSlug(): Promise<string> {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  for (let attempt = 0; attempt < 5; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(7));
    const slug = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    if (!(await first(`SELECT 1 AS x FROM "Announcement" WHERE "slug" = ?`, slug))) return slug;
  }
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}
