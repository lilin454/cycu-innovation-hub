import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { listAdminMilestones } from "@/lib/milestones";
import { MilestoneManager } from "@/components/admin/MilestoneManager";

export const metadata: Metadata = { title: "活動紀錄" };

export default async function AdminRecordsPage() {
  const user = await requireAdmin();
  const items = await listAdminMilestones();
  return (
    <div className="mx-auto max-w-4xl">
      <p className="eyebrow text-flame-dark">Records</p>
      <h1 className="mt-1 text-3xl font-black">活動紀錄</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        記錄創創社、幹部與社員的獲獎、參訪交流與活動成果。公開的紀錄會依年份顯示在前台的「活動紀錄」頁面。
      </p>
      <MilestoneManager items={items} canDelete={user.role === "OWNER"} />
    </div>
  );
}
