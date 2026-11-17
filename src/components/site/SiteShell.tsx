import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { SiteHeader } from "./SiteHeader";
import { Logo } from "./Logo";
import { isExternal, listOrgs } from "@/lib/organization";
import { inFooter } from "@/lib/organization-types";

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const socials = [
    { label: "Instagram", href: s.instagramUrl },
    { label: "Facebook", href: s.facebookUrl },
    { label: "LINE", href: s.lineUrl },
    { label: "其他連結", href: s.otherSocialUrl },
  ].filter((x) => x.href);
  const orgs = await listOrgs();
  const logoRows = [
    { title: "合作單位", items: inFooter(s.partnersPlacement) ? orgs.filter((o) => o.kind === "PARTNER") : [] },
    { title: "資訊來源", items: inFooter(s.sourcesPlacement) ? orgs.filter((o) => o.kind === "SOURCE") : [] },
  ].filter((r) => r.items.length > 0);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-sun focus:px-3 focus:py-2 focus:font-bold">
        跳到主要內容
      </a>
      <SiteHeader siteName={s.siteName} siteNameEn={s.siteNameEn} logoUrl={s.logoUrl} showAbout={s.showAbout !== "0"} showCalendar={s.showCalendar !== "0"} showRecords={s.showRecords !== "0"} />
      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="mt-24 bg-deep text-paper">
        <div className="wrap grid gap-10 pb-10 pt-14 md:grid-cols-12">
          <div className="md:col-span-6">
            <div className="flex items-center gap-4">
              <Logo src={s.logoUrl} size={56} />
              <div>
                <p className="text-lg font-black">{s.siteName}</p>
                <p className="eyebrow text-[0.6rem] text-paper/60">{s.siteNameEn}</p>
              </div>
            </div>
            {s.footerText && <p className="mt-6 max-w-md text-xl font-bold leading-relaxed text-sun">{s.footerText}</p>}
          </div>

          <div className="md:col-span-3">
            <p className="eyebrow text-paper/50">Explore</p>
            <ul className="mt-4 space-y-2.5 font-medium">
              <li><Link className="hover:text-sun" href="/announcements">最新公告</Link></li>
              <li><Link className="hover:text-sun" href="/categories">活動分類</Link></li>
              {s.showCalendar !== "0" && <li><Link className="hover:text-sun" href="/calendar">活動行事曆</Link></li>}
              {s.showRecords !== "0" && <li><Link className="hover:text-sun" href="/records">活動紀錄</Link></li>}
              <li><Link className="hover:text-sun" href="/announcements?fee=free">免費活動</Link></li>
              {s.showAbout !== "0" && <li><Link className="hover:text-sun" href="/about">關於創創社</Link></li>}
            </ul>
          </div>

          <div className="md:col-span-3">
            <p className="eyebrow text-paper/50">Contact</p>
            <ul className="mt-4 space-y-2.5 font-medium">
              {socials.map((x) => (
                <li key={x.label}>
                  <a className="hover:text-sun" href={x.href} target="_blank" rel="noopener noreferrer">
                    {x.label} <span aria-hidden>↗</span>
                  </a>
                </li>
              ))}
              {s.contactEmail && (
                <li>
                  <a className="break-all hover:text-sun" href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a>
                </li>
              )}
              {s.contactOther && <li className="text-paper/80">{s.contactOther}</li>}
            </ul>
          </div>
        </div>
        {logoRows.map((row) => (
          <div key={row.title} className="border-t border-paper/15">
            <div className="wrap flex flex-col gap-3 py-6 md:flex-row md:items-center md:gap-8">
              <p className="eyebrow flex-none text-paper/50 md:w-28">{row.title}</p>
              <ul className="flex flex-wrap items-center gap-2.5">
                {row.items.map((o) => {
                  const chip = o.logoUrl ? (
                    <img src={o.logoUrl} alt={o.name} title={o.name} className="h-8 w-auto max-w-[7.5rem] object-contain" loading="lazy" />
                  ) : (
                    <span className="text-xs font-bold text-deep">{o.name}</span>
                  );
                  const cls = "flex h-12 min-w-[3rem] items-center justify-center bg-white px-3";
                  return (
                    <li key={o.id}>
                      {!o.linkUrl ? (
                        <span className={cls}>{chip}</span>
                      ) : isExternal(o.linkUrl) ? (
                        <a href={o.linkUrl} target="_blank" rel="noopener noreferrer" className={`${cls} hover:outline hover:outline-2 hover:outline-sun`}>{chip}</a>
                      ) : (
                        <Link href={o.linkUrl} className={`${cls} hover:outline hover:outline-2 hover:outline-sun`}>{chip}</Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ))}
        <div className="border-t border-paper/15">
          <div className="wrap flex flex-col gap-2 py-5 text-xs text-paper/60 md:flex-row md:items-center md:justify-between">
            <p>{s.cycuInfo}</p>
            <p>
              © {new Date().getFullYear()} {s.siteName}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
