import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { FEE_SLUG, FEE_TYPES, SORTS, type FeeTypeKey, type SortKey } from "./constants";

export const PAGE_SIZE = 8;

/**
 * 排程發布：把到期的「已排程」公告改為「已發布」。
 * 由三個地方觸發，確保任何部署方式都會真的執行：
 * 1. 伺服器啟動後每 30 秒（src/instrumentation.ts）
 * 2. 外部 Cron 呼叫 /api/cron/publish（Serverless 環境）
 * 3. 前台每次讀取公告之前（最後一道保險）
 */
export async function publishDue(): Promise<number> {
  const now = new Date();
  const due = await db.announcement.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true, scheduledAt: true },
  });
  for (const a of due) {
    await db.announcement.updateMany({
      where: { id: a.id, status: "SCHEDULED" },
      data: { status: "PUBLISHED", publishedAt: a.scheduledAt ?? now, scheduledAt: null },
    });
  }
  return due.length;
}

export const cardInclude = {
  categories: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
} satisfies Prisma.AnnouncementInclude;

export type AnnouncementCard = Prisma.AnnouncementGetPayload<{ include: typeof cardInclude }>;

export const detailInclude = {
  categories: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
  attachments: { orderBy: { sortOrder: "asc" } },
  images: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.AnnouncementInclude;

export type AnnouncementDetail = Prisma.AnnouncementGetPayload<{ include: typeof detailInclude }>;

export type PublicFilters = {
  q: string;
  sources: string[];
  types: string[];
  fee: FeeTypeKey | null;
  sort: SortKey;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const list = (v: string | string[] | undefined) =>
  first(v)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{1,40}$/.test(s))
    .slice(0, 20);

export function parseFilters(sp: RawParams): PublicFilters {
  const feeSlug = first(sp.fee);
  const fee = FEE_TYPES.find((f) => FEE_SLUG[f] === feeSlug) ?? null;
  const sortRaw = first(sp.sort);
  const page = Math.max(1, Math.min(500, parseInt(first(sp.page), 10) || 1));
  return {
    q: first(sp.q).trim().slice(0, 60),
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

function publicWhere(f: PublicFilters): Prisma.AnnouncementWhereInput {
  const and: Prisma.AnnouncementWhereInput[] = [{ status: "PUBLISHED" }];
  if (f.q) {
    const contains = { contains: f.q, mode: "insensitive" as const };
    and.push({
      OR: [
        { title: contains },
        { subtitle: contains },
        { summary: contains },
        { contentText: contains },
        { organizer: contains },
        { location: contains },
        { categories: { some: { name: contains } } },
      ],
    });
  }
  // 不同分類之間為「且」，同一分類內多選為「或」
  if (f.sources.length) and.push({ categories: { some: { kind: "SOURCE", slug: { in: f.sources } } } });
  if (f.types.length) and.push({ categories: { some: { kind: "EVENT_TYPE", slug: { in: f.types } } } });
  if (f.fee) and.push({ feeType: f.fee });
  return { AND: and };
}

export async function listPublic(f: PublicFilters, pageSize = PAGE_SIZE) {
  await publishDue();
  const where = publicWhere(f);
  const orderBy: Prisma.AnnouncementOrderByWithRelationInput[] =
    f.sort === "event_asc"
      ? [{ startAt: { sort: "asc", nulls: "last" } }, { publishedAt: "desc" }]
      : f.sort === "event_desc"
        ? [{ startAt: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }]
        : [{ isPinned: "desc" }, { publishedAt: "desc" }];
  const total = await db.announcement.count({ where });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(f.page, pages);
  const items = await db.announcement.findMany({
    where,
    orderBy,
    include: cardInclude,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { items, total, pages, page };
}

export async function getFeatured(): Promise<AnnouncementCard[]> {
  await publishDue();
  return db.announcement.findMany({
    where: { status: "PUBLISHED", isFeatured: true },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
    include: cardInclude,
    take: 3,
  });
}

export async function getNextUp(): Promise<AnnouncementCard | null> {
  return db.announcement.findFirst({
    where: { status: "PUBLISHED", startAt: { gte: new Date() } },
    orderBy: { startAt: "asc" },
    include: cardInclude,
  });
}

export async function getPublicStats() {
  const now = new Date();
  const [total, upcoming, free] = await Promise.all([
    db.announcement.count({ where: { status: "PUBLISHED" } }),
    db.announcement.count({ where: { status: "PUBLISHED", startAt: { gte: now } } }),
    db.announcement.count({ where: { status: "PUBLISHED", feeType: "FREE" } }),
  ]);
  return { total, upcoming, free };
}

export async function getPublicBySlug(slug: string): Promise<AnnouncementDetail | null> {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  await publishDue();
  return db.announcement.findFirst({ where: { slug, status: "PUBLISHED" }, include: detailInclude });
}

export async function getRelated(a: AnnouncementDetail, take = 3): Promise<AnnouncementCard[]> {
  const catIds = a.categories.filter((c) => c.kind !== "TAG").map((c) => c.id);
  const base: Prisma.AnnouncementWhereInput = { status: "PUBLISHED", id: { not: a.id } };
  const related = catIds.length
    ? await db.announcement.findMany({
        where: { ...base, categories: { some: { id: { in: catIds } } } },
        orderBy: { publishedAt: "desc" },
        include: cardInclude,
        take,
      })
    : [];
  if (related.length >= take) return related;
  const more = await db.announcement.findMany({
    where: { ...base, id: { notIn: [a.id, ...related.map((r) => r.id)] } },
    orderBy: { publishedAt: "desc" },
    include: cardInclude,
    take: take - related.length,
  });
  return [...related, ...more];
}

/** 分類與其「已發布」公告數量 */
export async function getCategoriesWithCounts() {
  const cats = await db.category.findMany({
    where: { kind: { in: ["SOURCE", "EVENT_TYPE"] } },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { announcements: { where: { status: "PUBLISHED" } } } } },
  });
  return cats.map((c) => ({
    id: c.id,
    kind: c.kind,
    name: c.name,
    slug: c.slug,
    color: c.color,
    count: c._count.announcements,
  }));
}

export type CategoryWithCount = Awaited<ReturnType<typeof getCategoriesWithCounts>>[number];
