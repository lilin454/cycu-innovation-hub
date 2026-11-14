import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { publishDue } from "@/lib/announcements";
import { FEE_LABEL, FEE_TYPES, STATUS_LABEL, STATUSES, type FeeTypeKey, type StatusKey } from "@/lib/constants";
import { feeBadge, formatDateTime, formatRange } from "@/lib/format";
import { getBaseUrl } from "@/lib/settings";
import { buildShareText, shareUrl } from "@/lib/share";
import { RowActions } from "@/components/admin/RowActions";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const metadata: Metadata = { title: "公告管理" };

const PAGE_SIZE = 15;
const ADMIN_SORTS = {
  updated: "最後更新",
  published: "發布時間",
  event_asc: "活動日期（近→遠）",
  event_desc: "活動日期（遠→近）",
} as const;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminAnnouncementsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireAdmin();
  await publishDue();
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 60);
  const statusRaw = one(sp.status);
  const status = (STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as StatusKey) : null;
  const showAll = statusRaw === "all";
  const feeRaw = one(sp.fee);
  const fee = (FEE_TYPES as readonly string[]).includes(feeRaw) ? (feeRaw as FeeTypeKey) : null;
  const category = one(sp.category);
  const sort = (one(sp.sort) in ADMIN_SORTS ? one(sp.sort) : "updated") as keyof typeof ADMIN_SORTS;
  const page = Math.max(1, parseInt(one(sp.page), 10) || 1);

  const and: Prisma.AnnouncementWhereInput[] = [];
  if (status) and.push({ status });
  else if (!showAll) and.push({ status: { not: "ARCHIVED" } });
  if (fee) and.push({ feeType: fee });
  if (category) and.push({ categories: { some: { id: category } } });
  if (q) {
    const contains = { contains: q, mode: "insensitive" as const };
    and.push({ OR: [{ title: contains }, { summary: contains }, { organizer: contains }, { slug: contains }, { contentText: contains }] });
  }
  const where: Prisma.AnnouncementWhereInput = { AND: and };
  const orderBy: Prisma.AnnouncementOrderByWithRelationInput[] =
    sort === "event_asc"
      ? [{ startAt: { sort: "asc", nulls: "last" } }]
      : sort === "event_desc"
        ? [{ startAt: { sort: "desc", nulls: "last" } }]
        : sort === "published"
          ? [{ publishedAt: { sort: "desc", nulls: "last" } }]
          : [{ updatedAt: "desc" }];

  const [total, cats, base] = await Promise.all([
    db.announcement.count({ where }),
    db.category.findMany({ where: { kind: { in: ["SOURCE", "EVENT_TYPE"] } }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] }),
    getBaseUrl(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const items = await db.announcement.findMany({
    where,
    orderBy: [{ isPinned: "desc" }, ...orderBy],
    include: { categories: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] } },
    skip: (current - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { q, status: statusRaw, fee: feeRaw, category, sort: sort === "updated" ? "" : sort, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/announcements${s ? `?${s}` : ""}`;
  };
  const filtered = Boolean(q || statusRaw || fee || category);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-flame-dark">Announcements</p>
          <h1 className="mt-1 text-3xl font-black">公告管理</h1>
        </div>
        <Link href="/admin/announcements/new" className="btn btn-ink">＋ 新增公告</Link>
      </div>

      <form method="get" className="panel mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-end 2xl:grid-cols-[1.6fr_1fr_1fr_1fr_1fr_auto]">
        <label className="block sm:col-span-2 lg:col-span-3 2xl:col-span-1">
          <span className="field-label">關鍵字</span>
          <input name="q" type="search" defaultValue={q} className="input" placeholder="標題、主辦單位、網址代稱…" maxLength={60} />
        </label>
        <label className="block">
          <span className="field-label">發布狀態</span>
          <select name="status" defaultValue={statusRaw} className="input">
            <option value="">全部（不含封存）</option>
            <option value="all">全部（含封存）</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">分類</span>
          <select name="category" defaultValue={category} className="input">
            <option value="">全部分類</option>
            <optgroup label="活動來源">
              {cats.filter((c) => c.kind === "SOURCE").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
            <optgroup label="活動類型">
              {cats.filter((c) => c.kind === "EVENT_TYPE").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          </select>
        </label>
        <label className="block">
          <span className="field-label">費用</span>
          <select name="fee" defaultValue={feeRaw} className="input">
            <option value="">全部</option>
            {FEE_TYPES.map((k) => <option key={k} value={k}>{FEE_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">排序</span>
          <select name="sort" defaultValue={sort} className="input">
            {Object.entries(ADMIN_SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-ink">套用</button>
          {filtered && <Link href="/admin/announcements" className="btn bg-white">清除</Link>}
        </div>
      </form>

      <p className="mt-4 text-sm font-bold">共 {total} 則公告</p>

      {items.length === 0 ? (
        <div className="panel mt-3 p-10 text-center">
          <p className="text-lg font-black">{filtered ? "沒有符合條件的公告" : "還沒有任何公告"}</p>
          <p className="mt-1 text-sm text-muted">{filtered ? "調整篩選條件後再試一次。" : "按右上角「新增公告」建立第一則活動資訊。"}</p>
        </div>
      ) : (
        <div className="panel mt-3">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_6.5rem_minmax(0,1.2fr)_5.5rem_9.5rem] gap-4 border-b-2 border-ink bg-paper-2 px-4 py-2 text-xs font-black xl:grid">
            <span>標題</span>
            <span>來源／類型</span>
            <span>費用</span>
            <span>活動日期／最後更新</span>
            <span>狀態</span>
            <span className="text-right">操作</span>
          </div>
          <ul>
            {items.map((a) => {
              const url = shareUrl(base, a.slug);
              return (
                <li key={a.id} className="grid gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-b-0 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_6.5rem_minmax(0,1.2fr)_5.5rem_9.5rem] xl:items-center">
                  <div className="min-w-0">
                    <Link href={`/admin/announcements/${a.id}`} className="font-bold leading-snug hover:underline">
                      {a.isPinned && <span className="mr-1.5 bg-flame px-1 text-[0.68rem] text-white">置頂</span>}
                      {a.isFeatured && <span className="mr-1.5 bg-sun px-1 text-[0.68rem] text-deep">精選</span>}
                      {a.title}
                    </Link>
                    <p className="truncate font-mono text-[0.7rem] text-muted">/a/{a.slug}</p>
                  </div>
                  <p className="text-xs leading-relaxed">
                    <span className="font-bold">{a.categories.filter((c) => c.kind === "SOURCE").map((c) => c.name).join("、") || "—"}</span>
                    <br />
                    <span className="text-muted">{a.categories.filter((c) => c.kind === "EVENT_TYPE").map((c) => c.name).join("、") || "—"}</span>
                  </p>
                  <p className="text-xs font-bold">
                    {feeBadge(a.feeType, a.feeAmount)}
                    {a.prize && <span className="block text-flame-dark">獎金｜{a.prize}</span>}
                  </p>
                  <p className="text-xs leading-relaxed">
                    {a.status === "SCHEDULED" && a.scheduledAt ? (
                      <span className="font-bold text-teal-dark">預定 {formatDateTime(a.scheduledAt)} 發布</span>
                    ) : (
                      <span>{a.startAt ? formatRange(a.startAt, a.endAt) : "未設定活動日期"}</span>
                    )}
                    <br />
                    <span className="text-muted">更新 {formatDateTime(a.updatedAt)}</span>
                  </p>
                  <div><StatusBadge status={a.status} /></div>
                  <RowActions
                    id={a.id}
                    title={a.title}
                    status={a.status}
                    isPinned={a.isPinned}
                    isFeatured={a.isFeatured}
                    url={url}
                    shareText={buildShareText(a, base)}
                    canDelete={me.role === "OWNER"}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="分頁" className="mt-5 flex items-center justify-between">
          {current > 1 ? <Link className="btn btn-sm bg-white" href={qs({ page: String(current - 1) })}>← 上一頁</Link> : <span />}
          <span className="text-sm font-bold">第 {current} / {pages} 頁</span>
          {current < pages ? <Link className="btn btn-sm bg-white" href={qs({ page: String(current + 1) })}>下一頁 →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
