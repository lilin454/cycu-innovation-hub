import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { emptyInitial, getEditorCategories } from "@/lib/editor-data";
import { getBaseUrl } from "@/lib/settings";
import { randomSlug } from "@/lib/slug";
import { AnnouncementEditor } from "@/components/admin/AnnouncementEditor";

export const metadata: Metadata = { title: "新增公告" };

export default async function NewAnnouncementPage() {
  await requireAdmin();
  const [categories, baseUrl, slug] = await Promise.all([getEditorCategories(), getBaseUrl(), randomSlug()]);
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 text-2xl font-black">新增公告</h1>
      <AnnouncementEditor id={null} initial={emptyInitial(slug)} categories={categories} baseUrl={baseUrl} />
    </div>
  );
}
