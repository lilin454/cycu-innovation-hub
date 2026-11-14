"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; short: string; ownerOnly?: boolean; editorLabel?: string };

const NAV: Item[] = [
  { href: "/admin", label: "總覽", short: "總覽" },
  { href: "/admin/announcements", label: "公告管理", short: "公告" },
  { href: "/admin/categories", label: "分類管理", short: "分類", ownerOnly: true },
  { href: "/admin/users", label: "管理員帳號", short: "帳號", ownerOnly: true },
  { href: "/admin/settings", label: "系統設定", short: "設定", editorLabel: "我的帳號" },
];

export function AdminNav({ orientation, isOwner }: { orientation: "vertical" | "horizontal"; isOwner: boolean }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const items = NAV.filter((n) => isOwner || !n.ownerOnly).map((n) =>
    !isOwner && n.editorLabel ? { ...n, label: n.editorLabel, short: "帳號" } : n,
  );

  if (orientation === "horizontal") {
    return (
      <nav aria-label="後台導覽" className="flex min-w-0 flex-1 justify-center gap-0.5 overflow-x-auto">
        {items.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active(n.href) ? "page" : undefined}
            className={`whitespace-nowrap px-2 py-1.5 text-sm font-bold ${active(n.href) ? "bg-sun text-deep" : "text-paper/80"}`}
          >
            {n.short}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="後台導覽" className="p-3">
      <ul className="space-y-1">
        {items.map((n) => (
          <li key={n.href}>
            <Link
              href={n.href}
              aria-current={active(n.href) ? "page" : undefined}
              className={`block px-3 py-2.5 text-[0.95rem] font-bold ${active(n.href) ? "bg-sun text-deep" : "text-paper/85 hover:bg-paper/10"}`}
            >
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/admin/announcements/new" className="btn btn-sun mt-4 w-full !shadow-none">＋ 新增公告</Link>
    </nav>
  );
}
