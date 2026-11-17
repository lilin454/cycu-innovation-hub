import Link from "next/link";
import type { AnnouncementCard } from "@/lib/announcements";
import { dateParts, formatDate, formatRange } from "@/lib/format";
import { Cover } from "./Cover";
import { TagList } from "./Tags";

export function typeLabel(a: AnnouncementCard): string {
  return a.categories.find((c) => c.kind === "EVENT_TYPE")?.name ?? a.categories.find((c) => c.kind === "SOURCE")?.name ?? "活動";
}

/** 公告列表的一列：左側大日期、中間內容、右側縮圖。手機版改為上下堆疊。 */
export function AnnouncementRow({ a }: { a: AnnouncementCard }) {
  const d = dateParts(a.startAt);
  return (
    <article className="group relative grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-4 gap-y-3 border-b-2 border-ink py-6 md:grid-cols-[6.5rem_minmax(0,1fr)_13rem] md:gap-x-8 md:py-8">
      {/* 活動日期 */}
      <div className="datebox row-span-2 md:row-span-1">
        {d ? (
          <>
            <p className="eyebrow text-[0.62rem] text-muted">{d.y}</p>
            <p className="text-[2.6rem] font-black leading-none tracking-tight md:text-[3.6rem]">{d.d}</p>
            <p className="mt-1 text-sm font-bold">
              {Number(d.m)} 月<span className="text-muted">・週{d.w}</span>
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow text-[0.62rem] text-muted">DATE</p>
            <p className="mt-1 text-lg font-black leading-tight">日期<br />另行公告</p>
          </>
        )}
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {a.isPinned && <span className="tag bg-flame text-white">置頂</span>}
          <TagList categories={a.categories} feeType={a.feeType} feeAmount={a.feeAmount} prize={a.prize} max={3} />
        </div>
        <h3 className="text-xl font-black leading-snug md:text-2xl">
          <Link href={`/a/${a.slug}`} className="after:absolute after:inset-0 group-hover:text-flame-dark">
            {a.title}
          </Link>
        </h3>
        {a.summary && <p className="mt-2 line-clamp-2 text-[0.95rem] text-muted">{a.summary}</p>}
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.8rem]">
          {a.startAt && (
            <div className="flex gap-1.5">
              <dt className="font-bold">活動</dt>
              <dd className="text-muted">{formatRange(a.startAt, a.endAt)}</dd>
            </div>
          )}
          {a.location && (
            <div className="flex gap-1.5">
              <dt className="font-bold">地點</dt>
              <dd className="text-muted">{a.location}</dd>
            </div>
          )}
          <div className="flex gap-1.5">
            <dt className="font-bold">發布</dt>
            <dd className="text-muted">{formatDate(a.publishedAt)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm font-bold" aria-hidden>
          <span className="border-b-2 border-ink pb-px group-hover:border-flame-dark group-hover:text-flame-dark">查看詳情 →</span>
        </p>
      </div>

      <div className="col-span-2 md:col-span-1" style={{ containerType: "inline-size" }}>
        <Cover src={a.coverImage} alt="" seed={a.slug} label={typeLabel(a)} ratio="16 / 10" />
      </div>
    </article>
  );
}

/** 小型卡片：用於相關活動 */
export function AnnouncementMini({ a }: { a: AnnouncementCard }) {
  return (
    <article className="group relative flex flex-col" style={{ containerType: "inline-size" }}>
      <Cover src={a.coverImage} alt="" seed={a.slug} label={typeLabel(a)} ratio="16 / 10" />
      <TagList categories={a.categories} feeType={a.feeType} feeAmount={a.feeAmount} prize={a.prize} max={2} className="mt-3" />
      <h3 className="mt-2 text-lg font-black leading-snug">
        <Link href={`/a/${a.slug}`} className="after:absolute after:inset-0 group-hover:text-flame-dark">
          {a.title}
        </Link>
      </h3>
      {a.startAt && <p className="mt-1 text-sm text-muted">{formatRange(a.startAt, a.endAt)}</p>}
    </article>
  );
}
