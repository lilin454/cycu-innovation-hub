import type { Metadata } from "next";
import { listCategoriesWithUsage } from "@/lib/announcements";
import { requireOwner } from "@/lib/auth";
import { CategoryManager, type ManagedCategory } from "@/components/admin/CategoryManager";

export const metadata: Metadata = { title: "分類管理" };

export default async function CategoriesAdminPage() {
  await requireOwner();
  const rows = await listCategoriesWithUsage();
  const categories: ManagedCategory[] = rows.map((c) => ({
    id: c.id,
    kind: c.kind,
    name: c.name,
    color: c.color,
    count: c.count,
  }));
  return (
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow text-flame-dark">Taxonomy</p>
      <h1 className="mt-1 text-3xl font-black">分類管理</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        活動來源與活動類型分開管理，一則公告可以同時勾選多個。費用屬性（免費／付費／保證金／依活動內容而定）是固定欄位，在編輯公告時設定。
      </p>
      <CategoryManager categories={categories} />
    </div>
  );
}
