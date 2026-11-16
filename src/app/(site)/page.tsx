import Link from "next/link";
import {
  getCategoriesWithCounts,
  getFeatured,
  getNextUp,
  getPublicStats,
  hasActiveFilters,
  listPublic,
  parseFilters,
} from "@/lib/announcements";
import { dateParts, formatDate, formatRange } from "@/lib/format";
import { listPublicMilestones } from "@/lib/milestones";
import { MILESTONE_KIND_LABEL, MILESTONE_SUBJECT_LABEL } from "@/lib/milestone-types";
import { getSettings } from "@/lib/settings";
import { AnnouncementRow, typeLabel } from "@/components/site/AnnouncementRow";
import { Cover } from "@/components/site/Cover";
import { EmptyState, Filters, Pagination } from "@/components/site/Filters";
import { TagList } from "@/components/site/Tags";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function HomePage({ searchParams }: Props) {
  const f = parseFilters(await searchParams);
  const filtering = hasActiveFilters(f) || f.page > 1 || f.sort !== "latest";
  const [s, list, categories, featured, nextUp, stats, records] = await Promise.all([
    getSettings(),
    listPublic(f),
    getCategoriesWithCounts(),
    filtering ? Promise.resolve([]) : getFeatured(),
    getNextUp(),
    getPublicStats(),
    filtering ? Promise.resolve([]) : listPublicMilestones({ kind: null, subject: null }, 3),
  ]);
  const next = dateParts(nextUp?.startAt);
  const on = (k: "showNextUp" | "showStats" | "showFeatured" | "showCategoryIndex") => s[k] !== "0";
  const [lead, ...restFeatured] = on("showFeatured") ? featured : [];

  return (
    <>
      {/* ── Hero：左側標語、右側「下一場活動」──────────────── */}
      <section className="border-b-2 border-ink">
        <div className="wrap grid lg:grid-cols-12">
          <div className={on("showNextUp") ? "py-10 md:py-14 lg:col-span-7 lg:border-r-2 lg:border-ink lg:py-16 lg:pr-12" : "py-10 md:py-14 lg:col-span-12 lg:py-16"}>
            <p className="eyebrow flex items-center gap-3 text-[0.68rem] text-navy">
              <span className="inline-block h-2.5 w-2.5 bg-flame" aria-hidden />
              CYCU Innovation &amp; Entrepreneurship
            </p>
            <h1 className="mt-5 text-[2.5rem] font-black leading-[1.12] tracking-tight sm:text-6xl lg:text-[3.3rem] xl:text-[4.2rem]">
              {s.heroTagline.split(/(?<=[，,、])/).map((part, i) => (
                <span key={i} className={i === 1 ? "block text-flame-dark" : "block"}>
                  {part}
                </span>
              ))}
            </h1>
            {s.heroIntro && <p className="mt-6 max-w-xl text-[1.05rem] leading-relaxed text-muted md:text-lg">{s.heroIntro}</p>}
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href="#latest" className="btn btn-sun">看最新公告 ↓</Link>
              {s.showCalendar !== "0" && <Link href="/calendar" className="link-arrow">看行事曆 <span aria-hidden>→</span></Link>}
              <Link href="/announcements?fee=free" className="link-arrow">只看免費活動 <span aria-hidden>→</span></Link>
            </div>
          </div>

          {on("showNextUp") && (
          <div className="-mx-5 bg-navy text-paper md:-mx-10 lg:col-span-5 lg:mx-0 lg:-mr-10">
            {nextUp && next ? (
              <Link href={`/a/${nextUp.slug}`} className="group flex h-full flex-col justify-between gap-8 p-6 md:p-10">
                <p className="eyebrow flex items-center justify-between text-[0.68rem] text-sun">
                  <span>Next up・下一場活動</span>
                  <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                </p>
                <div>
                  <p className="font-display text-[21vw] font-black leading-[0.85] tracking-tighter text-sun sm:text-[8rem] lg:text-[min(10vw,8rem)]">
                    {next.m}
                    <span className="text-paper/40">/</span>
                    {next.d}
                  </p>
                  <p className="eyebrow mt-3 text-paper/70">
                    {next.y}・週{next.w}・{next.hh}:{next.mm}
                  </p>
                </div>
                <div>
                  <h2 className="text-xl font-black leading-snug group-hover:underline md:text-2xl">{nextUp.title}</h2>
                  {nextUp.location && <p className="mt-2 text-sm text-paper/75">{nextUp.location}</p>}
                </div>
              </Link>
            ) : (
              <div className="flex h-full flex-col justify-between gap-8 p-6 md:p-10">
                <p className="eyebrow text-[0.68rem] text-sun">Next up・下一場活動</p>
                <p className="text-2xl font-black leading-snug">新的活動正在準備中，<br />敬請期待。</p>
                <Link href="/announcements" className="link-arrow self-start text-sun">瀏覽所有公告 →</Link>
              </div>
            )}
          </div>
          )}
        </div>
      </section>

      {/* ── 數字條 ─────────────────────────────────────── */}
      {on("showStats") && (
      <section aria-label="公告統計" className="border-b-2 border-ink bg-sun text-deep">
        <dl className="wrap grid grid-cols-3 divide-x-2 divide-ink">
          {[
            ["公開公告", stats.total],
            ["即將舉辦", stats.upcoming],
            ["免費活動", stats.free],
          ].map(([label, n], i) => (
            <div key={label} className={`flex flex-col-reverse py-3 sm:flex-row sm:items-baseline sm:gap-3 ${i === 0 ? "pr-3" : "px-3 md:px-6"}`}>
              <dd className="font-display text-3xl font-black leading-none md:text-4xl">{String(n).padStart(2, "0")}</dd>
              <dt className="text-xs font-bold sm:text-sm">{label}</dt>
            </div>
          ))}
        </dl>
      </section>
      )}

      {/* ── 精選活動 ───────────────────────────────────── */}
      {lead && (
        <section aria-labelledby="featured-title" className="wrap pt-14 md:pt-20">
          <SectionHead no="01" en="Featured" title="精選活動" id="featured-title" />
          <div className={`mt-8 grid gap-8 ${restFeatured.length ? "lg:grid-cols-12" : ""}`}>
            <article className={`group relative ${restFeatured.length ? "lg:col-span-8" : "grid gap-6 md:grid-cols-2 md:items-center"}`}>
              <Cover src={lead.coverImage} alt="" seed={lead.slug} label={typeLabel(lead)} ratio={restFeatured.length ? "16 / 9" : "4 / 3"} priority />
              <div className={restFeatured.length ? "mt-5" : ""}>
                <TagList categories={lead.categories} feeType={lead.feeType} feeAmount={lead.feeAmount} prize={lead.prize} max={3} />
                <h3 className="mt-3 text-2xl font-black leading-tight md:text-4xl">
                  <Link href={`/a/${lead.slug}`} className="after:absolute after:inset-0 group-hover:text-flame-dark">{lead.title}</Link>
                </h3>
                {lead.summary && <p className="mt-3 line-clamp-3 max-w-2xl text-muted md:text-lg">{lead.summary}</p>}
                <p className="mt-4 text-sm font-bold">
                  {lead.startAt ? formatRange(lead.startAt, lead.endAt) : `發布於 ${formatDate(lead.publishedAt)}`}
                </p>
                <p className="mt-4"><span className="btn btn-ink btn-sm" aria-hidden>查看詳情 →</span></p>
              </div>
            </article>

            {restFeatured.length > 0 && (
              <div className="flex flex-col divide-y-2 divide-ink border-y-2 border-ink lg:col-span-4">
                {restFeatured.map((a, i) => (
                  <article key={a.id} className="group relative flex-1 py-6">
                    <p className="font-display text-5xl font-black leading-none text-sun [-webkit-text-stroke:1.5px_var(--color-ink)]">0{i + 2}</p>
                    <TagList categories={a.categories} feeType={a.feeType} feeAmount={a.feeAmount} prize={a.prize} max={2} className="mt-4" />
                    <h3 className="mt-2 text-xl font-black leading-snug">
                      <Link href={`/a/${a.slug}`} className="after:absolute after:inset-0 group-hover:text-flame-dark">{a.title}</Link>
                    </h3>
                    {a.summary && <p className="mt-2 line-clamp-2 text-sm text-muted">{a.summary}</p>}
                    <p className="mt-3 text-sm font-bold">
                      {a.startAt ? formatRange(a.startAt, a.endAt) : `發布於 ${formatDate(a.publishedAt)}`}
                    </p>
                    <p className="mt-2 text-sm font-bold underline underline-offset-4" aria-hidden>查看詳情 →</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 最新公告＋搜尋篩選 ─────────────────────────── */}
      <section id="latest" aria-labelledby="latest-title" className="wrap pt-14 md:pt-20">
        <SectionHead no={lead ? "02" : "01"} en="Latest" title="最新公告" id="latest-title" />
        <div className="mt-8">
          <Filters f={f} categories={categories} basePath="/" total={list.total} />
        </div>
        <div className="mt-2 border-t-2 border-ink">
          {list.items.length === 0 ? (
            <EmptyState filtered={hasActiveFilters(f)} basePath="/" />
          ) : (
            list.items.map((a) => <AnnouncementRow key={a.id} a={a} />)
          )}
        </div>
        <Pagination f={f} pages={list.pages} page={list.page} basePath="/" />
      </section>

      {/* ── 活動分類入口 ───────────────────────────────── */}
      {/* ── 活動紀錄 ───────────────────────────────────── */}
      {!filtering && s.showRecords !== "0" && records.length > 0 && (
        <section aria-labelledby="records-title" className="wrap pt-14 md:pt-20">
          <div className="flex items-end justify-between gap-4 border-b-2 border-ink pb-3">
            <h2 id="records-title" className="text-3xl font-black md:text-4xl">活動紀錄</h2>
            <Link href="/records" className="link-arrow text-sm">全部紀錄 <span aria-hidden>→</span></Link>
          </div>
          <ol className="grid md:grid-cols-3 md:divide-x-2 md:divide-ink">
            {records.map((r) => (
              <li key={r.id} className="border-b-2 border-ink py-5 md:px-6 md:first:pl-0 md:last:pr-0">
                <p className="font-display text-sm font-black text-flame-dark">{r.occurredOn.replace(/-/g, "/")}</p>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  <span className={`tag ${r.kind === "AWARD" ? "tag-free" : "tag-type"}`}>{MILESTONE_KIND_LABEL[r.kind]}</span>
                  <span className="tag tag-source">{MILESTONE_SUBJECT_LABEL[r.subject]}</span>
                </p>
                <h3 className="mt-2 text-lg font-black leading-snug">
                  <Link href="/records" className="hover:text-flame-dark hover:underline">{r.title}</Link>
                </h3>
                {r.people && <p className="mt-1 text-sm text-muted">{r.people}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {!filtering && on("showCategoryIndex") && <CategoryIndex categories={categories} no={lead ? "03" : "02"} />}
    </>
  );
}

function SectionHead({ no, en, title, id }: { no: string; en: string; title: string; id: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b-2 border-ink pb-3">
      <h2 id={id} className="flex items-baseline gap-3 text-3xl font-black md:text-4xl">
        <span className="eyebrow text-[0.7rem] text-flame-dark">{no}</span>
        {title}
      </h2>
      <span className="eyebrow hidden text-muted sm:block">{en}</span>
    </div>
  );
}

function CategoryIndex({
  categories,
  no,
}: {
  categories: Awaited<ReturnType<typeof getCategoriesWithCounts>>;
  no: string;
}) {
  const types = categories.filter((c) => c.kind === "EVENT_TYPE" && c.count > 0);
  const sources = categories.filter((c) => c.kind === "SOURCE" && c.count > 0);
  if (types.length + sources.length === 0) return null;
  return (
    <section aria-labelledby="cat-title" className="mt-16 bg-navy text-paper md:mt-24">
      <div className="wrap py-14 md:py-20">
        <div className="flex items-end justify-between gap-4 border-b-2 border-paper/30 pb-3">
          <h2 id="cat-title" className="flex items-baseline gap-3 text-3xl font-black md:text-4xl">
            <span className="eyebrow text-[0.7rem] text-sun">{no}</span>
            依分類找活動
          </h2>
          <Link href="/categories" className="link-arrow text-sm text-sun">全部分類 →</Link>
        </div>

        {types.length > 0 && (
          <ul className="mt-8 grid grid-cols-2 border-l-2 border-t-2 border-paper/30 md:grid-cols-3 lg:grid-cols-4">
            {types.map((c) => (
              <li key={c.id} className="border-b-2 border-r-2 border-paper/30">
                <Link href={`/announcements?type=${c.slug}`} className="group flex h-full items-end justify-between gap-2 p-4 transition-colors hover:bg-sun hover:text-deep md:p-6">
                  <span className="text-xl font-black md:text-2xl">{c.name}</span>
                  <span className="font-display text-sm font-bold text-sun group-hover:text-deep">{String(c.count).padStart(2, "0")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {sources.length > 0 && (
          <div className="mt-10">
            <p className="eyebrow text-paper/60">By source・依活動來源</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {sources.map((c) => (
                <li key={c.id}>
                  <Link href={`/announcements?source=${c.slug}`} className="inline-flex items-center gap-2 border-2 border-paper/40 px-3 py-1.5 font-bold transition-colors hover:border-sun hover:bg-sun hover:text-deep">
                    {c.name}
                    <span className="font-mono text-xs opacity-70">{c.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
