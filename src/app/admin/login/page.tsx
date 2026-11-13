import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Logo } from "@/components/site/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "管理員登入", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/admin");
  const s = await getSettings();
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-navy p-12 text-paper lg:flex">
        <div className="flex items-center gap-4">
          <Logo src={s.logoUrl} size={56} />
          <p className="text-lg font-black">{s.siteName}</p>
        </div>
        <div>
          <p className="eyebrow text-sun">Admin console</p>
          <p className="mt-3 text-5xl font-black leading-tight">公告管理後台</p>
          <p className="mt-4 max-w-sm text-paper/70">新增、編輯、發布活動公告，一鍵複製轉傳文案。</p>
        </div>
        <p className="eyebrow text-[0.6rem] text-paper/50">{s.siteNameEn}</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo src={s.logoUrl} size={44} />
            <p className="font-black">{s.siteName}</p>
          </div>
          <h1 className="text-3xl font-black">管理員登入</h1>
          <p className="mt-2 text-sm text-muted">此頁面僅供創創社管理人員使用，不開放註冊。</p>
          <LoginForm />
          <p className="mt-8 text-sm">
            <Link href="/" className="font-bold underline underline-offset-4">← 回到前台網站</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
