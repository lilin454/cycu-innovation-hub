import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_SORTS, listAdmin, listCategories, parseAdminFilters } from "@/lib/announcements";
import { FEE_LABEL, FEE_TYPES, STATUS_LABEL, STATUSES } from "@/lib/constants";
import { feeBadge, formatDateTime, formatRange } from "@/lib/format";
import { getBaseUrl } from "@/lib/settings";
import { buildDigestBlock, buildShareText, shareUrl } from "@/lib/share";
import { RowActions } from "@/components/admin/RowActions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { BulkProvider, BulkRow, RowCheck, SelectAll } from "@/components/admin/BulkSelect";

export const metadata: Metadata = { title: "公告管理" };

type SP = Record<string, string | string[] | undefined>;

export default async function AdminAnnouncementsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireAdmin();
  const { filters, raw } = parseAdminFilters(await searchParams);
  const { q, fee, category, sort } = filters;
  const statusRaw = raw.status;
  const feeRaw = raw.fee;
  const [{ items, total, pages, page: current }, cats, base] = await Promise.all([
    listAdmin(filters),
    listCategories(["SOURCE", "EVENT_TYPE"]),
    getBaseUrl(),
  ]);

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
          <BulkProvider
            ids={items.map((a) => a.id)}
            isOwner={me.role === "OWNER"}
            baseUrl={base}
            digests={Object.fromEntries(items.map((a) => [a.id, { start: a.startAt ? a.startAt.getTime() : null, text: buildDigestBlock(a, base) }]))}
          >
          <p className="mt-3 hidden text-xs text-muted md:block">小技巧：按住 Shift 點選可以一次選一整段，按住 Ctrl（Mac 用 ⌘）點列可以加選。選好後可以「複製文案」整理成近期活動清單。</p>
        <div className="panel mt-3">
          <div className="flex items-center gap-4 border-b-2 border-ink bg-paper-2 px-4 py-2 text-xs font-black xl:grid xl:grid-cols-[1.5rem_minmax(0,2.2fr)_minmax(0,1.3fr)_6.5rem_minmax(0,1.2fr)_5.5rem_9.5rem]">
            <SelectAll />
            <span className="hidden xl:inline">標題</span>
            <span className="hidden xl:inline">來源／類型</span>
            <span className="hidden xl:inline">費用</span>
            <span className="hidden xl:inline">活動日期／最後更新</span>
            <span className="hidden xl:inline">狀態</span>
            <span className="hidden text-right xl:inline">操作</span>
          </div>
          <ul>
            {items.map((a) => {
              const url = shareUrl(base, a.slug);
              return (
                <BulkRow key={a.id} id={a.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-b-0 has-[input:checked]:bg-sun-soft/60 xl:grid-cols-[1.5rem_minmax(0,2.2fr)_minmax(0,1.3fr)_6.5rem_minmax(0,1.2fr)_5.5rem_9.5rem] xl:items-center">
                  <div className="row-span-6 pt-0.5 xl:row-span-1 xl:pt-0"><RowCheck id={a.id} title={a.title} /></div>
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
                    hasSurvey={a.surveyEnabled}
                  />
                </BulkRow>
              );
            })}
          </ul>
        </div>
        </BulkProvider>
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
