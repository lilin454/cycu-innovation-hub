import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata: Metadata = { title: "系統設定" };

export default async function SettingsPage() {
  const user = await requireAdmin();
  const settings = await getSettings();
  return (
    <div className="mx-auto max-w-3xl">
      <p className="eyebrow text-flame-dark">Settings</p>
      <h1 className="mt-1 text-3xl font-black">系統設定</h1>
      <p className="mt-2 text-sm text-muted">這裡的內容會顯示在前台的導覽列、首頁、關於頁與頁尾。</p>
      <SettingsForm initial={settings} account={user.account} />
    </div>
  );
}
