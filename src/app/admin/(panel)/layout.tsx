import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Logo } from "@/components/site/Logo";
import { AdminNav } from "@/components/admin/AdminNav";
import { logoutAction } from "../actions";

export const metadata: Metadata = {
  title: { default: "後台管理", template: "%s｜創創社後台" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const s = await getSettings();

  const logout = (
    <form action={logoutAction}>
      <button type="submit" className="text-sm font-bold underline underline-offset-4 hover:text-sun">登出</button>
    </form>
  );

  return (
    <div className="min-h-dvh bg-[#f4efe3] lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
      {/* 桌面版側欄 */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-deep text-paper lg:flex">
        <Link href="/admin" className="flex items-center gap-3 border-b border-paper/15 p-4">
          <Logo src={s.logoUrl} size={40} />
          <span className="leading-tight">
            <span className="block text-sm font-black">創創社後台</span>
            <span className="eyebrow text-[0.55rem] text-paper/50">Admin</span>
          </span>
        </Link>
        <AdminNav orientation="vertical" />
        <div className="mt-auto space-y-3 border-t border-paper/15 p-4">
          <a href="/" target="_blank" rel="noopener noreferrer" className="block text-sm font-bold hover:text-sun">查看前台 ↗</a>
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-paper/70" title={user.account}>{user.displayName}</p>
            {logout}
          </div>
        </div>
      </aside>

      {/* 手機／平板頂部列 */}
      <header className="sticky top-0 z-30 bg-deep text-paper lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href="/admin" className="flex items-center gap-2 font-black">
            <Logo src={s.logoUrl} size={30} />
            後台
          </Link>
          <AdminNav orientation="horizontal" />
          {logout}
        </div>
      </header>

      <main className="min-w-0 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
