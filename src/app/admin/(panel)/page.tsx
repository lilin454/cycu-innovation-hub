import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { publishDue } from "@/lib/announcements";
import { formatDateTime, formatRange } from "@/lib/format";
import { StatusBadge } from "@/components/admin/StatusBadge";

export default async function DashboardPage() {
  const user = await requireAdmin();
  await publishDue();
  const now = new Date();
  const [groups, upcoming, recent, scheduled] = await Promise.all([
    db.announcement.groupBy({ by: ["status"], _count: { _all: true } }),
    db.announcement.findMany({
      where: { status: "PUBLISHED", startAt: { gte: now } },
      orderBy: { startAt: "asc" },
      take: 5,
      select: { id: true, title: true, startAt: true, endAt: true, location: true },
    }),
    db.announcement.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, title: true, status: true, updatedAt: true },
    }),
    db.announcement.findMany({
      where: { status: "SCHEDULED" },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      select: { id: true, title: true, scheduledAt: true },
    }),
  ]);
  const count = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
  const total = groups.reduce((n, g) => n + g._count._all, 0);
  const upcomingCount = await db.announcement.count({ where: { status: "PUBLISHED", startAt: { gte: now } } });

  const stats = [
    { label: "公告總數", n: total, href: "/admin/announcements?status=all" },
    { label: "已發布", n: count("PUBLISHED"), href: "/admin/announcements?status=PUBLISHED" },
    { label: "草稿", n: count("DRAFT"), href: "/admin/announcements?status=DRAFT" },
    { label: "已排程", n: count("SCHEDULED"), href: "/admin/announcements?status=SCHEDULED" },
    { label: "已下架", n: count("UNPUBLISHED"), href: "/admin/announcements?status=UNPUBLISHED" },
    { label: "即將舉辦", n: upcomingCount, href: "/admin/announcements?status=PUBLISHED&sort=event_asc" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-flame-dark">Dashboard</p>
          <h1 className="mt-1 text-3xl font-black">嗨，{user.displayName}</h1>
        </div>
        <Link href="/admin/announcements/new" className="btn btn-ink">＋ 新增公告</Link>
      </div>

      <ul className="mt-6 grid grid-cols-2 border-l-2 border-t-2 border-ink sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <li key={s.label} className="border-b-2 border-r-2 border-ink bg-white">
            <Link href={s.href} className="block p-4 hover:bg-sun-soft">
              <p className="font-display text-4xl font-black leading-none">{s.n}</p>
              <p className="mt-2 text-sm font-bold">{s.label}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <header className="flex items-center justify-between border-b-2 border-ink bg-paper-2 px-4 py-2.5">
            <h2 className="font-black">最近更新的公告</h2>
            <Link href="/admin/announcements" className="text-sm font-bold underline underline-offset-4">全部公告</Link>
          </header>
          {recent.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">
              還沒有任何公告。<Link href="/admin/announcements/new" className="font-bold underline">建立第一則公告</Link>
            </p>
          ) : (
            <ul>
              {recent.map((a) => (
                <li key={a.id} className="border-b border-line last:border-b-0">
                  <Link href={`/admin/announcements/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sun-soft">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{a.title}</span>
                      <span className="text-xs text-muted">更新於 {formatDateTime(a.updatedAt)}</span>
                    </span>
                    <StatusBadge status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="panel">
            <header className="border-b-2 border-ink bg-paper-2 px-4 py-2.5">
              <h2 className="font-black">即將舉辦的活動</h2>
            </header>
            {upcoming.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">目前沒有即將舉辦的已發布活動。</p>
            ) : (
              <ul>
                {upcoming.map((a) => (
                  <li key={a.id} className="border-b border-line last:border-b-0">
                    <Link href={`/admin/announcements/${a.id}`} className="block px-4 py-3 hover:bg-sun-soft">
                      <span className="block truncate font-bold">{a.title}</span>
                      <span className="text-xs text-muted">{formatRange(a.startAt, a.endAt)}{a.location ? `・${a.location}` : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {scheduled.length > 0 && (
            <section className="panel">
              <header className="border-b-2 border-ink bg-paper-2 px-4 py-2.5">
                <h2 className="font-black">等待自動發布</h2>
              </header>
              <ul>
                {scheduled.map((a) => (
                  <li key={a.id} className="border-b border-line last:border-b-0">
                    <Link href={`/admin/announcements/${a.id}`} className="block px-4 py-3 hover:bg-sun-soft">
                      <span className="block truncate font-bold">{a.title}</span>
                      <span className="text-xs text-teal-dark">預定 {formatDateTime(a.scheduledAt)} 發布</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
