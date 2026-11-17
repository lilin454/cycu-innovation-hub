import Link from "next/link";
import { FEE_LABEL, FEE_TYPES, SORTS, type SortKey } from "@/lib/constants";
import {
  filtersToQuery,
  hasActiveFilters,
  type CategoryWithCount,
  type PublicFilters,
} from "@/lib/announcements";

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/**
 * 搜尋與交叉篩選。全部以網址參數運作（伺服器端查詢資料庫），
 * 所以篩選結果可以直接分享、重新整理後也會保留，且不依賴前端 JavaScript。
 */
export function Filters({
  f,
  categories,
  basePath,
  total,
}: {
  f: PublicFilters;
  categories: CategoryWithCount[];
  basePath: string;
  total: number;
}) {
  const anchor = basePath === "/" ? "#latest" : "";
  const href = (next: Partial<PublicFilters>) => `${basePath}${filtersToQuery({ ...f, page: 1, ...next })}${anchor}`;
  const sources = categories.filter((c) => c.kind === "SOURCE" && (c.count > 0 || f.sources.includes(c.slug)));
  const types = categories.filter((c) => c.kind === "EVENT_TYPE" && (c.count > 0 || f.types.includes(c.slug)));
  const active = hasActiveFilters(f);
  const picked = f.sources.length + f.types.length + (f.fee ? 1 : 0);
  const toggleId = `filters-${basePath === "/" ? "home" : "list"}`;

  return (
    <div className="border-2 border-ink bg-white">
      <form action={basePath + anchor} method="get" role="search" className="flex border-b-2 border-ink">
        {f.sources.length > 0 && <input type="hidden" name="source" value={f.sources.join(",")} />}
        {f.types.length > 0 && <input type="hidden" name="type" value={f.types.join(",")} />}
        {f.fee && <input type="hidden" name="fee" value={f.fee.toLowerCase()} />}
        {f.sort !== "latest" && <input type="hidden" name="sort" value={f.sort} />}
        <label htmlFor="q" className="sr-only">搜尋活動</label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={f.q}
          maxLength={60}
          placeholder="搜尋活動名稱、主辦單位、地點…"
          className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-base font-medium placeholder:text-muted/70 focus:outline-none focus-visible:bg-sun-soft"
        />
        <button type="submit" className="flex-none border-l-2 border-ink bg-ink px-5 font-bold text-paper hover:bg-flame-dark">
          搜尋
        </button>
      </form>

      {/* 手機版：來源、類型、費用收在「篩選條件」裡，點開才顯示，避免一進來就要滑很久才看到公告；
          桌面版一律展開。用 checkbox 切換，不需要 JavaScript */}
      <input type="checkbox" id={toggleId} className="peer sr-only" defaultChecked={picked > 0} />
      <label
        htmlFor={toggleId}
        className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-sm font-black peer-focus-visible:bg-sun-soft md:hidden [&_.chev]:transition-transform peer-checked:[&_.chev]:rotate-180"
      >
        <span>
          篩選條件
          <span className="ml-2 font-medium text-muted">活動來源・類型・費用</span>
          {picked > 0 && <span className="ml-2 bg-flame px-1.5 py-0.5 text-xs text-white">已選 {picked}</span>}
        </span>
        <span className="chev text-base" aria-hidden>▾</span>
      </label>
      <div className="hidden divide-y divide-line border-t border-line peer-checked:block md:block md:border-t-0">
        <FilterGroup label="活動來源" code="SOURCE">
          {sources.map((c) => (
            <Link key={c.id} href={href({ sources: toggle(f.sources, c.slug) })} scroll={false} className="chip" aria-pressed={f.sources.includes(c.slug)}>
              {c.name}
              <span className="chip-count">{c.count}</span>
            </Link>
          ))}
          {sources.length === 0 && <span className="text-sm text-muted">尚無資料</span>}
        </FilterGroup>
        <FilterGroup label="活動類型" code="TYPE">
          {types.map((c) => (
            <Link key={c.id} href={href({ types: toggle(f.types, c.slug) })} scroll={false} className="chip" aria-pressed={f.types.includes(c.slug)}>
              {c.name}
              <span className="chip-count">{c.count}</span>
            </Link>
          ))}
          {types.length === 0 && <span className="text-sm text-muted">尚無資料</span>}
        </FilterGroup>
        <FilterGroup label="費用" code="FEE">
          {FEE_TYPES.map((k) => (
            <Link key={k} href={href({ fee: f.fee === k ? null : k })} scroll={false} className="chip" aria-pressed={f.fee === k}>
              {FEE_LABEL[k]}
            </Link>
          ))}
        </FilterGroup>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink bg-paper-2 px-4 py-2.5 text-sm">
        <p className="font-bold" aria-live="polite">
          共 <span className="font-display text-lg">{total}</span> 則{active ? "符合條件的" : ""}公告
          {active && (
            <Link href={`${basePath}${filtersToQuery({ sort: f.sort })}${anchor}`} scroll={false} className="ml-3 font-bold text-flame-dark underline underline-offset-4">
              清除篩選
            </Link>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
          <span className="eyebrow mr-1 text-[0.62rem] text-muted">Sort</span>
          {(Object.keys(SORTS) as SortKey[]).map((k) => (
            <Link
              key={k}
              href={href({ sort: k })}
              scroll={false}
              aria-current={f.sort === k ? "true" : undefined}
              className={`px-2 py-1 text-[0.82rem] ${f.sort === k ? "bg-ink font-bold text-paper" : "font-medium hover:underline"}`}
            >
              {SORTS[k]}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ label, code, children }: { label: string; code: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 px-4 py-3 md:grid-cols-[7rem_minmax(0,1fr)] md:items-start">
      <p className="pt-1 text-sm font-black">
        {label}
        <span className="eyebrow ml-2 text-[0.58rem] text-muted md:ml-0 md:block">{code}</span>
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function Pagination({ f, pages, page, basePath }: { f: PublicFilters; pages: number; page: number; basePath: string }) {
  if (pages <= 1) return null;
  const anchor = basePath === "/" ? "#latest" : "";
  const href = (p: number) => `${basePath}${filtersToQuery({ ...f, page: p })}${anchor}`;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <nav aria-label="分頁" className="mt-8 flex flex-wrap items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={href(page - 1)} className="btn btn-sm">← 上一頁</Link>
      ) : (
        <span />
      )}
      <ol className="flex items-center gap-1 font-display text-sm font-bold">
        {nums.map((n, i) => (
          <li key={n} className="flex items-center gap-1">
            {i > 0 && nums[i - 1] !== n - 1 && <span className="px-1 text-muted">…</span>}
            <Link
              href={href(n)}
              aria-current={n === page ? "page" : undefined}
              aria-label={`第 ${n} 頁`}
              className={`flex h-9 min-w-9 items-center justify-center border-2 px-2 ${n === page ? "border-ink bg-ink text-paper" : "border-transparent hover:border-ink"}`}
            >
              {n}
            </Link>
          </li>
        ))}
      </ol>
      {page < pages ? (
        <Link href={href(page + 1)} className="btn btn-ink btn-sm">載入下一頁 →</Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function EmptyState({ filtered, basePath }: { filtered: boolean; basePath: string }) {
  return (
    <div className="border-b-2 border-ink py-16 text-center">
      <p className="font-display text-6xl font-black text-sun [-webkit-text-stroke:2px_var(--color-ink)]">{filtered ? "0" : "…"}</p>
      <h3 className="mt-4 text-xl font-black">{filtered ? "找不到符合條件的活動" : "目前還沒有公告"}</h3>
      <p className="mx-auto mt-2 max-w-sm text-muted">
        {filtered ? "試著減少篩選條件，或換一個關鍵字再找找看。" : "新的活動資訊發布後會出現在這裡，歡迎晚點再回來看看。"}
      </p>
      {filtered && (
        <Link href={basePath === "/" ? "/#latest" : basePath} className="btn mt-6">清除所有篩選</Link>
      )}
    </div>
  );
}
