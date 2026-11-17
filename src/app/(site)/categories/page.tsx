import type { Metadata } from "next";
import Link from "next/link";
import { getCategoriesWithCounts } from "@/lib/announcements";
import { FEE_LABEL, FEE_SLUG, FEE_TYPES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "活動分類",
  description: "依活動來源、活動類型與費用瀏覽創創社的活動公告。",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const categories = await getCategoriesWithCounts();
  const groups = [
    { key: "type", en: "Event type", title: "活動類型", items: categories.filter((c) => c.kind === "EVENT_TYPE") },
    { key: "source", en: "Source", title: "活動來源", items: categories.filter((c) => c.kind === "SOURCE") },
  ];
  return (
    <div className="wrap pt-10 md:pt-14">
      <header className="border-b-2 border-ink pb-6">
        <p className="eyebrow text-[0.68rem] text-flame-dark">Categories</p>
        <h1 className="mt-2 text-4xl font-black md:text-6xl">活動分類</h1>
        <p className="mt-3 max-w-xl text-muted">選一個你有興趣的方向，直接看相關的活動公告。</p>
      </header>

      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`g-${g.key}`} className="mt-12 grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
          <div>
            <p className="eyebrow text-muted">{g.en}</p>
            <h2 id={`g-${g.key}`} className="mt-1 text-2xl font-black">{g.title}</h2>
          </div>
          {g.items.length === 0 ? (
            <p className="text-muted">尚未建立分類。</p>
          ) : (
            <ul className="grid grid-cols-1 border-l-2 border-t-2 border-ink xs:grid-cols-2 lg:grid-cols-3">
              {g.items.map((c) => (
                <li key={c.id} className="border-b-2 border-r-2 border-ink">
                  {c.count > 0 ? (
                    <Link href={`/announcements?${g.key}=${c.slug}`} className="group flex h-full items-center justify-between gap-3 bg-white p-4 transition-colors hover:bg-sun">
                      <span className="flex items-center gap-2.5 text-lg font-black">
                        <span className="h-3 w-3 flex-none" style={{ background: c.color }} aria-hidden />
                        {c.name}
                      </span>
                      <span className="font-display text-sm font-bold">{c.count} 則 →</span>
                    </Link>
                  ) : (
                    <span className="flex h-full items-center justify-between gap-3 p-4 text-muted">
                      <span className="flex items-center gap-2.5 text-lg font-bold">
                        <span className="h-3 w-3 flex-none opacity-40" style={{ background: c.color }} aria-hidden />
                        {c.name}
                      </span>
                      <span className="text-xs">尚無公告</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section aria-labelledby="g-fee" className="mt-12 grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
        <div>
          <p className="eyebrow text-muted">Fee</p>
          <h2 id="g-fee" className="mt-1 text-2xl font-black">費用</h2>
        </div>
        <ul className="flex flex-wrap gap-2">
          {FEE_TYPES.map((k) => (
            <li key={k}>
              <Link href={`/announcements?fee=${FEE_SLUG[k]}`} className="btn bg-white">{FEE_LABEL[k]}</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
