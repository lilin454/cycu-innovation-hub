import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCalendarMonth } from "@/lib/announcements";
import { dateParts, feeBadge } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "活動行事曆",
  description: "用月曆查看創創社公告的各項活動時間。",
  alternates: { canonical: "/calendar" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
const pad = (n: number) => String(n).padStart(2, "0");

export default async function CalendarPage({ searchParams }: Props) {
  const s = await getSettings();
  if (s.showCalendar === "0") notFound();

  // 所有日期都以台灣時間計算
  const today = dateParts(new Date())!;
  const raw = (await searchParams).m;
  const m = /^(\d{4})-(\d{2})$/.exec((Array.isArray(raw) ? raw[0] : raw) ?? "");
  let year = m ? Number(m[1]) : Number(today.y);
  let month = m ? Number(m[2]) : Number(today.m);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    year = Number(today.y);
    month = Number(today.m);
  }

  const events = await getCalendarMonth(year, month);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

  // 把每個活動放進它涵蓋的每一天（跨日活動會出現在多天）
  const byDay = new Map<number, typeof events>();
  for (const e of events) {
    const sp = dateParts(e.startAt)!;
    const ep = dateParts(e.endAt ?? e.startAt)!;
    const startKey = `${sp.y}-${sp.m}-${sp.d}`;
    const endKey = `${ep.y}-${ep.m}-${ep.d}`;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${pad(month)}-${pad(d)}`;
      if (key >= startKey && key <= endKey) byDay.set(d, [...(byDay.get(d) ?? []), e]);
    }
  }

  const prev = month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`;
  const isThisMonth = Number(today.y) === year && Number(today.m) === month;
  const cells: (number | null)[] = [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const activeDays = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <div className="wrap pt-10 md:pt-14">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-6">
        <div>
          <p className="eyebrow text-[0.68rem] text-flame-dark">Calendar</p>
          <h1 className="mt-2 text-4xl font-black md:text-6xl">活動行事曆</h1>
        </div>
        <nav aria-label="切換月份" className="flex items-center gap-2">
          <Link href={`/calendar?m=${prev}`} className="btn btn-sm bg-white" aria-label="上個月">←</Link>
          <p className="min-w-[8.5rem] text-center font-display text-2xl font-black" aria-live="polite">
            {year} / {pad(month)}
          </p>
          <Link href={`/calendar?m=${next}`} className="btn btn-sm bg-white" aria-label="下個月">→</Link>
          {!isThisMonth && <Link href="/calendar" className="btn btn-sm btn-ink">回到本月</Link>}
        </nav>
      </header>

      {/* 月曆格：桌面版在格子內顯示活動名稱，手機版只顯示有活動的標記，詳細內容看下方清單 */}
      <div className="mt-6 border-l-2 border-t-2 border-ink" role="grid" aria-label={`${year} 年 ${month} 月`}>
        <div className="grid grid-cols-7" role="row">
          {WEEK.map((w, i) => (
            <div key={w} role="columnheader" className={`border-b-2 border-r-2 border-ink bg-ink py-1.5 text-center text-xs font-bold ${i === 0 || i === 6 ? "text-sun" : "text-paper"}`}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const list = d ? (byDay.get(d) ?? []) : [];
            const isToday = d !== null && isThisMonth && Number(today.d) === d;
            return (
              <div
                key={i}
                role="gridcell"
                className={`min-h-[3.4rem] border-b-2 border-r-2 border-ink p-1 md:min-h-[7rem] md:p-1.5 ${d ? (isToday ? "bg-sun-soft" : "bg-white") : "bg-paper-2"}`}
              >
                {d && (
                  <>
                    <p className={`font-display text-sm font-black leading-none md:text-base ${isToday ? "inline-block bg-flame px-1 py-0.5 text-white" : ""}`}>
                      {d}
                      {isToday && <span className="sr-only">（今天）</span>}
                    </p>
                    {list.length > 0 && (
                      <>
                        <a href={`#day-${d}`} className="mt-1 block md:hidden" aria-label={`${month} 月 ${d} 日有 ${list.length} 個活動`}>
                          <span className="inline-flex h-5 min-w-5 items-center justify-center bg-ink px-1 font-display text-[0.7rem] font-bold text-sun">{list.length}</span>
                        </a>
                        <ul className="mt-1 hidden space-y-1 md:block">
                          {list.slice(0, 3).map((e) => (
                            <li key={e.id}>
                              <Link href={`/a/${e.slug}`} title={e.title} className="block truncate bg-ink px-1.5 py-0.5 text-[0.72rem] font-bold leading-snug text-paper hover:bg-flame-dark">
                                {e.title}
                              </Link>
                            </li>
                          ))}
                          {list.length > 3 && (
                            <li><a href={`#day-${d}`} className="text-[0.72rem] font-bold underline">還有 {list.length - 3} 個</a></li>
                          )}
                        </ul>
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 當月活動清單 */}
      <section aria-labelledby="agenda-title" className="mt-12">
        <div className="flex items-end justify-between border-b-2 border-ink pb-3">
          <h2 id="agenda-title" className="text-2xl font-black md:text-3xl">{month} 月的活動</h2>
          <span className="eyebrow text-muted">{events.length} events</span>
        </div>
        {activeDays.length === 0 ? (
          <div className="border-b-2 border-ink py-14 text-center">
            <p className="text-xl font-black">這個月還沒有活動</p>
            <p className="mt-2 text-muted">試試看其他月份，或到公告列表看看尚未排定日期的活動。</p>
            <Link href="/announcements" className="btn mt-5">瀏覽最新公告</Link>
          </div>
        ) : (
          <ol>
            {activeDays.map((d) => {
              const weekday = WEEK[new Date(Date.UTC(year, month - 1, d)).getUTCDay()];
              return (
                <li key={d} id={`day-${d}`} className="grid scroll-mt-24 grid-cols-[4rem_minmax(0,1fr)] gap-4 border-b-2 border-ink py-5 md:grid-cols-[6rem_minmax(0,1fr)] md:gap-8">
                  <div className="datebox">
                    <p className="text-4xl font-black leading-none md:text-5xl">{pad(d)}</p>
                    <p className="mt-1 text-sm font-bold text-muted">週{weekday}</p>
                  </div>
                  <ul className="space-y-4">
                    {byDay.get(d)!.map((e) => {
                      const sp = dateParts(e.startAt)!;
                      const ep = e.endAt ? dateParts(e.endAt)! : null;
                      const sameDay = !ep || (ep.y === sp.y && ep.m === sp.m && ep.d === sp.d);
                      const time = sameDay
                        ? `${sp.hh}:${sp.mm}${ep ? `–${ep.hh}:${ep.mm}` : ""}`
                        : `${Number(sp.m)}/${Number(sp.d)} ${sp.hh}:${sp.mm} – ${Number(ep!.m)}/${Number(ep!.d)} ${ep!.hh}:${ep!.mm}`;
                      return (
                        <li key={e.id}>
                          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            <span className="font-display font-black">{time}</span>
                            <span className={`tag ${e.feeType === "FREE" ? "tag-free" : "tag-paid"}`}>{feeBadge(e.feeType, e.feeAmount)}</span>
                            {e.prize && <span className="tag tag-prize">獎金｜{e.prize}</span>}
                          </p>
                          <h3 className="mt-1 text-lg font-black leading-snug md:text-xl">
                            <Link href={`/a/${e.slug}`} className="hover:text-flame-dark hover:underline">{e.title}</Link>
                          </h3>
                          {e.location && <p className="text-sm text-muted">{e.location}</p>}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
