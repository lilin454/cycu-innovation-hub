import type { Metadata } from "next";
import { all } from "@/lib/db";
import type { Role } from "@/lib/types";
import { requireOwner } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { UserManager, type ManagedUser } from "@/components/admin/UserManager";

export const metadata: Metadata = { title: "管理員帳號" };

export default async function UsersPage() {
  const me = await requireOwner();
  const rows = await all<{ id: string; account: string; displayName: string; role: Role; createdAt: string }>(
    `SELECT "id", "account", "displayName", "role", "createdAt" FROM "User" ORDER BY "role" DESC, "createdAt" ASC`,
  );
  const users: ManagedUser[] = rows.map((u) => ({
    id: u.id,
    account: u.account,
    displayName: u.displayName,
    role: u.role,
    createdAt: formatDate(u.createdAt),
    isMe: u.id === me.id,
  }));
  return (
    <div className="mx-auto max-w-4xl">
      <p className="eyebrow text-flame-dark">Admins</p>
      <h1 className="mt-1 text-3xl font-black">管理員帳號</h1>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <p className="border-2 border-ink bg-sun-soft p-3">
          <b>總管理員</b>：可以使用所有功能，包含系統設定、板塊顯示、分類管理、刪除公告，以及新增或移除管理員。
        </p>
        <p className="border-2 border-line bg-white p-3">
          <b>一般管理員</b>：可以新增、編輯、發布、下架、封存、複製公告，以及修改自己的密碼。
        </p>
      </div>
      <UserManager users={users} />
    </div>
  );
}
