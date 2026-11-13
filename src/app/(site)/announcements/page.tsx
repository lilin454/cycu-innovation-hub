import type { Metadata } from "next";
import { getCategoriesWithCounts, hasActiveFilters, listPublic, parseFilters } from "@/lib/announcements";
import { AnnouncementRow } from "@/components/site/AnnouncementRow";
import { EmptyState, Filters, Pagination } from "@/components/site/Filters";

export const metadata: Metadata = {
  title: "最新公告",
  description: "瀏覽創創社發布的所有活動公告，可依活動來源、活動類型與費用交叉篩選。",
  alternates: { canonical: "/announcements" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AnnouncementsPage({ searchParams }: Props) {
  const f = parseFilters(await searchParams);
  const [list, categories] = await Promise.all([listPublic(f, 10), getCategoriesWithCounts()]);
  return (
    <div className="wrap pt-10 md:pt-14">
      <header className="border-b-2 border-ink pb-6">
        <p className="eyebrow text-[0.68rem] text-flame-dark">Announcements</p>
        <h1 className="mt-2 text-4xl font-black md:text-6xl">最新公告</h1>
        <p className="mt-3 max-w-xl text-muted">用關鍵字搜尋，或組合「來源 × 類型 × 費用」找到適合你的活動。</p>
      </header>
      <div className="mt-8">
        <Filters f={f} categories={categories} basePath="/announcements" total={list.total} />
      </div>
      <div className="mt-2 border-t-2 border-ink">
        {list.items.length === 0 ? (
          <EmptyState filtered={hasActiveFilters(f)} basePath="/announcements" />
        ) : (
          list.items.map((a) => <AnnouncementRow key={a.id} a={a} />)
        )}
      </div>
      <Pagination f={f} pages={list.pages} page={list.page} basePath="/announcements" />
    </div>
  );
}
