import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { listAdminMilestones, listRecordCandidates } from "@/lib/milestones";
import { MilestoneManager } from "@/components/admin/MilestoneManager";
import { RecordPicker } from "@/components/admin/RecordPicker";

export const metadata: Metadata = { title: "活動紀錄" };

export default async function AdminRecordsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const user = await requireAdmin();
  const { edit } = await searchParams;
  const [items, candidates] = await Promise.all([listAdminMilestones(), listRecordCandidates()]);
  return (
    <div className="mx-auto max-w-4xl">
      <p className="eyebrow text-flame-dark">Records</p>
      <h1 className="mt-1 text-3xl font-black">活動紀錄</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        記錄創創社、幹部與社員的獲獎、參訪交流與活動成果。公開的紀錄會依年份顯示在前台的「活動紀錄」頁面。
        社團自己辦過的活動，直接在下方勾選就能加入；獲獎、參訪等其他紀錄可以另外新增。
      </p>
      {edit ? (
        <MilestoneManager key={edit} items={items} canDelete={user.role === "OWNER"} editId={edit} />
      ) : (
        <MilestoneManager items={items} canDelete={user.role === "OWNER"} />
      )}
      <RecordPicker items={candidates} />
    </div>
  );
}
