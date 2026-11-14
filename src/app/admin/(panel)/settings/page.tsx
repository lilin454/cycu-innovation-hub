import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PasswordForm, SettingsForm } from "@/components/admin/SettingsForm";

export const metadata: Metadata = { title: "系統設定" };

export default async function SettingsPage() {
  const user = await requireAdmin();
  // 一般管理員只能修改自己的密碼；網站設定僅總管理員可以調整（儲存時伺服器端也會再檢查一次）
  if (user.role !== "OWNER") {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow text-flame-dark">Account</p>
        <h1 className="mt-1 text-3xl font-black">我的帳號</h1>
        <p className="mt-2 text-sm text-muted">你目前是「一般管理員」，可以管理公告與修改自己的密碼。網站設定請洽總管理員。</p>
        <PasswordForm account={user.account} />
      </div>
    );
  }
  const settings = await getSettings();
  return (
    <div className="mx-auto max-w-3xl">
      <p className="eyebrow text-flame-dark">Settings</p>
      <h1 className="mt-1 text-3xl font-black">系統設定</h1>
      <p className="mt-2 text-sm text-muted">這裡的內容會顯示在前台的導覽列、首頁、關於頁與頁尾。</p>
      <SettingsForm initial={settings} />
      <PasswordForm account={user.account} />
    </div>
  );
}
