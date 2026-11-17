import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listPublicMilestones, parseMilestoneFilters } from "@/lib/milestones";
import {
  MILESTONE_KIND_LABEL,
  MILESTONE_KINDS,
  MILESTONE_SUBJECT_LABEL,
  MILESTONE_SUBJECTS,
  type Milestone,
} from "@/lib/milestone-types";
import { getSettings } from "@/lib/settings";
import { Content } from "@/components/site/Content";
import { Cover } from "@/components/site/Cover";

export const metadata: Metadata = {
  title: "活動紀錄",
  description: "創創社、幹部與社員的獲獎、參訪交流與活動成果紀錄。",
  alternates: { canonical: "/records" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RecordsPage({ searchParams }: Props) {
  const s = await getSettings();
  if (s.showRecords === "0") notFound();
  const f = parseMilestoneFilters(await searchParams);
  const items = await listPublicMilestones(f);

  const href = (patch: Partial<typeof f>) => {
    const next = { ...f, ...patch };
    const p = new URLSearchParams();
    if (next.kind) p.set("kind", next.kind.toLowerCase());
    if (next.subject) p.set("who", next.subject.toLowerCase());
    const q = p.toString();
    return `/records${q ? `?${q}` : ""}`;
  };

  // 依年份分組
  const years = new Map<string, Milestone[]>();
  for (const it of items) {
    const y = it.occurredOn.slice(0, 4);
    years.set(y, [...(years.get(y) ?? []), it]);
  }
  const filtered = Boolean(f.kind || f.subject);

  return (
    <div className="wrap pt-10 md:pt-14">
      <header className="border-b-2 border-ink pb-6">
        <p className="eyebrow text-[0.68rem] text-flame-dark">Records</p>
        <h1 className="mt-2 text-4xl font-black md:text-6xl">活動紀錄</h1>
        <p className="mt-3 max-w-xl text-muted">創創社、幹部與社員一路走來拿過的獎、去過的地方、做過的事。</p>
      </header>

      <div className="mt-8 border-2 border-ink bg-white">
        <div className="grid gap-2 border-b border-line px-4 py-3 md:grid-cols-[6rem_minmax(0,1fr)] md:items-center">
          <p className="text-sm font-black">類型</p>
          <div className="flex flex-wrap gap-1.5">
            <Link href={href({ kind: null })} scroll={false} className="chip" aria-pressed={!f.kind}>全部</Link>
            {MILESTONE_KINDS.map((k) => (
              <Link key={k} href={href({ kind: f.kind === k ? null : k })} scroll={false} className="chip" aria-pressed={f.kind === k}>
                {MILESTONE_KIND_LABEL[k]}
              </Link>
            ))}
          </div>
        </div>
        <div className="grid gap-2 px-4 py-3 md:grid-cols-[6rem_minmax(0,1fr)] md:items-center">
          <p className="text-sm font-black">對象</p>
          <div className="flex flex-wrap gap-1.5">
            <Link href={href({ subject: null })} scroll={false} className="chip" aria-pressed={!f.subject}>全部</Link>
            {MILESTONE_SUBJECTS.map((k) => (
              <Link key={k} href={href({ subject: f.subject === k ? null : k })} scroll={false} className="chip" aria-pressed={f.subject === k}>
                {MILESTONE_SUBJECT_LABEL[k]}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-2 border-y-2 border-ink py-16 text-center">
          <h2 className="text-xl font-black">{filtered ? "沒有符合條件的紀錄" : "還沒有活動紀錄"}</h2>
          <p className="mx-auto mt-2 max-w-sm text-muted">
            {filtered ? "換一個類型或對象再看看。" : "新的成果與紀錄發布後會出現在這裡。"}
          </p>
          {filtered && <Link href="/records" className="btn mt-5">清除篩選</Link>}
        </div>
      ) : (
        [...years.entries()].map(([year, list]) => (
          <section key={year} aria-labelledby={`y-${year}`} className="mt-12 grid gap-x-10 gap-y-4 md:grid-cols-[9rem_minmax(0,1fr)]">
            <h2 id={`y-${year}`} className="font-display text-6xl font-black leading-none text-sun [-webkit-text-stroke:2px_var(--color-ink)] md:sticky md:top-24 md:self-start md:text-7xl">
              {year}
            </h2>
            <ol className="border-t-2 border-ink">
              {list.map((it) => (
                <li key={it.id} className="grid gap-4 border-b-2 border-ink py-6 sm:grid-cols-[minmax(0,1fr)_12rem] sm:gap-8">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-display font-black">
                        {Number(it.occurredOn.slice(5, 7))}/{Number(it.occurredOn.slice(8, 10))}
                      </span>
                      <span className={`tag ${it.kind === "AWARD" ? "tag-free" : "tag-type"}`}>{MILESTONE_KIND_LABEL[it.kind]}</span>
                      <span className="tag tag-source">{MILESTONE_SUBJECT_LABEL[it.subject]}</span>
                    </p>
                    <h3 className="mt-2 text-xl font-black leading-snug md:text-2xl">{it.title}</h3>
                    {(it.people || it.location) && (
                      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                        {it.people && (
                          <div className="flex gap-1.5"><dt className="font-bold">成員</dt><dd className="text-muted">{it.people}</dd></div>
                        )}
                        {it.location && (
                          <div className="flex gap-1.5"><dt className="font-bold">地點</dt><dd className="text-muted">{it.location}</dd></div>
                        )}
                      </dl>
                    )}
                    {it.content.trim() && (
                      <div className="mt-3 text-[0.95rem]">
                        <Content text={it.content} />
                      </div>
                    )}
                    {it.linkUrl && (
                      <p className="mt-3">
                        <a href={it.linkUrl} target="_blank" rel="noopener noreferrer" className="link-arrow text-sm">相關連結 <span aria-hidden>↗</span></a>
                      </p>
                    )}
                  </div>
                  {it.coverImage && (
                    <a href={it.coverImage} target="_blank" rel="noopener noreferrer" aria-label={`開啟圖片：${it.title}`}>
                      <Cover src={it.coverImage} alt={it.title} seed={it.id} label={MILESTONE_KIND_LABEL[it.kind]} ratio="4 / 3" />
                    </a>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
