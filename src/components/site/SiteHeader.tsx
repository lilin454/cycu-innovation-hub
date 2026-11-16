"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

const ALL_NAV = [
  { href: "/", label: "首頁" },
  { href: "/announcements", label: "最新公告" },
  { href: "/calendar", label: "行事曆" },
  { href: "/records", label: "活動紀錄" },
  { href: "/categories", label: "活動分類" },
  { href: "/about", label: "關於創創社" },
];

export function SiteHeader({
  siteName,
  siteNameEn,
  logoUrl,
  showAbout,
  showCalendar,
  showRecords,
}: {
  siteName: string;
  siteNameEn: string;
  logoUrl: string;
  showAbout: boolean;
  showCalendar: boolean;
  showRecords: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hidden = [!showAbout && "/about", !showCalendar && "/calendar", !showRecords && "/records"];
  const NAV = ALL_NAV.filter((n) => !hidden.includes(n.href));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper">
      <div className="wrap flex h-16 items-center justify-between gap-4 md:h-[4.5rem]">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={`${siteName} 首頁`}>
          <Logo src={logoUrl} size={44} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[0.98rem] font-black tracking-wide md:text-[1.05rem]">{siteName}</span>
            <span className="eyebrow hidden truncate text-[0.58rem] text-muted sm:block">{siteNameEn}</span>
          </span>
        </Link>

        <nav aria-label="主要導覽" className="hidden items-center gap-5 xl:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={`relative py-1 text-[0.95rem] font-bold after:absolute after:inset-x-0 after:-bottom-0.5 after:h-[3px] after:origin-left after:bg-flame after:transition-transform ${
                isActive(n.href) ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100"
              }`}
            >
              {n.label}
            </Link>
          ))}
          <Link href="/announcements" className="btn btn-ink btn-sm !min-h-10 !px-4 !text-[0.9rem]">
            探索活動 <span aria-hidden>→</span>
          </Link>
        </nav>

        <button
          type="button"
          className="flex h-11 w-11 flex-none items-center justify-center border-2 border-ink xl:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "關閉選單" : "開啟選單"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="relative block h-3.5 w-5" aria-hidden>
            <span className={`absolute left-0 h-0.5 w-5 bg-ink transition-transform ${open ? "top-1.5 rotate-45" : "top-0"}`} />
            <span className={`absolute left-0 top-1.5 h-0.5 w-5 bg-ink transition-opacity ${open ? "opacity-0" : ""}`} />
            <span className={`absolute left-0 h-0.5 w-5 bg-ink transition-transform ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
          </span>
        </button>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="行動版導覽"
          className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-navy text-paper md:top-[4.5rem] xl:hidden"
        >
          <ul className="wrap py-4">
            {NAV.map((n, i) => (
              <li key={n.href} className="border-b border-paper/20">
                <Link href={n.href} className="flex items-baseline gap-4 py-5" onClick={() => setOpen(false)}>
                  <span className="eyebrow text-sun">0{i + 1}</span>
                  <span className="text-2xl font-black">{n.label}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="wrap pb-10">
            <Link href="/announcements" className="btn btn-sun w-full" onClick={() => setOpen(false)}>
              探索活動 →
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
