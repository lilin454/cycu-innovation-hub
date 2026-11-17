import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAnnouncementById } from "@/lib/announcements";
import { getEditorCategories, toInitial } from "@/lib/editor-data";
import { getBaseUrl, getSettings } from "@/lib/settings";
import { AnnouncementEditor } from "@/components/admin/AnnouncementEditor";

export const metadata: Metadata = { title: "編輯公告" };

export default async function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [a, categories, baseUrl, settings] = await Promise.all([
    getAnnouncementById(id),
    getEditorCategories(),
    getBaseUrl(),
    getSettings(),
  ]);
  if (!a) {
    return (
      <div className="panel mx-auto max-w-lg p-10 text-center">
        <h1 className="text-2xl font-black">找不到這則公告</h1>
        <p className="mt-2 text-sm text-muted">它可能已經被刪除，或網址不正確。</p>
        <Link href="/admin/announcements" className="btn btn-ink mt-6">回公告列表</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 truncate text-2xl font-black">編輯公告</h1>
      {/* key 讓「複製公告」後切換到新草稿時，表單會完整重置 */}
      <AnnouncementEditor key={a.id} id={a.id} initial={toInitial(a)} categories={categories}
        baseUrl={baseUrl}
        autoUnpublishGlobal={settings.autoUnpublishEnded === "1"}
        autoUnpublishedAt={a.autoUnpublishedAt?.toISOString() ?? null}
      />
    </div>
  );
}
