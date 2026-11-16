import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAnnouncementById } from "@/lib/announcements";
import { STATUS_LABEL } from "@/lib/constants";
import { getBaseUrl } from "@/lib/settings";
import { buildShareText, shareUrl } from "@/lib/share";
import { AnnouncementView } from "@/components/site/AnnouncementView";

export const metadata: Metadata = { title: "預覽公告" };

// 預覽頁在後台路由底下，必須登入才能看到；未發布的公告不會經由前台網址外流
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const a = await getAnnouncementById(id);
  if (!a) notFound();
  const base = await getBaseUrl();
  return (
    <div className="-mx-4 -my-6 md:-mx-8 md:-my-8">
      <div className="sticky top-14 z-20 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-sun px-4 py-2 text-sm font-bold lg:top-0">
        <p>預覽模式・目前狀態：{STATUS_LABEL[a.status]}{a.status !== "PUBLISHED" && "（訪客看不到這個頁面）"}</p>
        <div className="flex gap-2">
          <Link href={`/admin/announcements/${a.id}`} className="btn btn-sm bg-white">回到編輯</Link>
          {a.status === "PUBLISHED" && (
            <a href={`/a/${a.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-ink">前台頁面 ↗</a>
          )}
        </div>
      </div>
      <div className="bg-paper pb-16">
        <AnnouncementView a={a} url={shareUrl(base, a.slug)} shareText={buildShareText(a, base)} preview />
      </div>
    </div>
  );
}
