import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/SiteShell";

export const metadata: Metadata = { title: "找不到頁面", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <SiteShell>
      <div className="wrap grid gap-8 py-20 md:grid-cols-[auto_1fr] md:items-center md:py-28">
        <p className="font-display text-[7rem] font-black leading-none text-sun [-webkit-text-stroke:3px_var(--color-ink)] md:text-[11rem]">404</p>
        <div>
          <p className="eyebrow text-flame-dark">Page not found</p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">這則公告不在這裡</h1>
          <p className="mt-3 max-w-md text-muted">可能是活動已經下架、網址打錯了，或這個頁面從來沒有存在過。回到公告列表找找其他活動吧。</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/announcements" className="btn btn-ink">瀏覽最新公告</Link>
            <Link href="/" className="btn">回首頁</Link>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
