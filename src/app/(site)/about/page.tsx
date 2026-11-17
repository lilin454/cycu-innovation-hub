import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { Logo } from "@/components/site/Logo";
import { isExternal, listOfficers, listOrgs } from "@/lib/organization";
import { inAbout, type Org } from "@/lib/organization-types";

export const metadata: Metadata = {
  title: "關於創創社",
  description: "認識中原大學創新創業發展社的幹部、合作單位，以及我們彙整活動資訊的來源。",
  alternates: { canonical: "/about" },
};

function OrgGrid({ items }: { items: Org[] }) {
  return (
    <ul className="grid grid-cols-2 border-l-2 border-t-2 border-ink lg:grid-cols-3">
      {items.map((p) => {
        const inner = (
          <>
            {p.logoUrl ? (
              <img src={p.logoUrl} alt="" className="h-16 w-full object-contain" loading="lazy" />
            ) : (
              <span className="flex h-16 items-center font-display text-3xl font-black text-navy" aria-hidden>{p.name.slice(0, 2)}</span>
            )}
            <span className="text-sm font-bold leading-snug">
              {p.name}
              {isExternal(p.linkUrl) && <span aria-hidden> ↗</span>}
            </span>
          </>
        );
        const cls = "flex h-full flex-col items-center justify-between gap-4 p-5 text-center";
        return (
          <li key={p.id} className="border-b-2 border-r-2 border-ink bg-white">
            {!p.linkUrl ? (
              <div className={cls}>{inner}</div>
            ) : isExternal(p.linkUrl) ? (
              <a href={p.linkUrl} target="_blank" rel="noopener noreferrer" className={`${cls} hover:bg-sun-soft`}>{inner}</a>
            ) : (
              <Link href={p.linkUrl} className={`${cls} hover:bg-sun-soft`}>{inner}</Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SectionHead({ eyebrow, title, note }: { eyebrow: string; title: string; note?: string }) {
  return (
    <div>
      <p className="eyebrow text-muted">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-black">{title}</h2>
      {note && <p className="mt-2 text-sm text-muted">{note}</p>}
    </div>
  );
}

export default async function AboutPage() {
  const s = await getSettings();
  if (s.showAbout === "0") notFound();
  const [officers, orgs] = await Promise.all([listOfficers(), listOrgs()]);
  const partners = inAbout(s.partnersPlacement) ? orgs.filter((o) => o.kind === "PARTNER") : [];
  const sources = inAbout(s.sourcesPlacement) ? orgs.filter((o) => o.kind === "SOURCE") : [];
  const withPhoto = officers.some((o) => o.photoUrl);

  return (
    <div className="wrap pt-10 md:pt-14">
      <header className="grid gap-8 border-b-2 border-ink pb-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="eyebrow text-[0.68rem] text-flame-dark">About us</p>
          <h1 className="mt-2 text-4xl font-black md:text-6xl">關於創創社</h1>
          <p className="mt-4 text-xl font-bold text-navy md:text-2xl">{s.heroTagline}</p>
        </div>
        <Logo src={s.logoUrl} size={128} className="border-2 border-ink" />
      </header>

      <section className="grid gap-8 py-12 md:grid-cols-[14rem_minmax(0,1fr)]">
        <SectionHead eyebrow="Who we are" title="我們是誰" />
        <div className="max-w-2xl space-y-5 text-lg leading-loose">
          {s.aboutText.split(/\n{1,}/).filter(Boolean).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <div className="flex flex-wrap gap-3 pt-2">
            {s.instagramUrl && (
              <a href={s.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ink">
                追蹤 Instagram ↗
              </a>
            )}
            {s.contactEmail && <a href={`mailto:${s.contactEmail}`} className="btn">寫信給我們</a>}
            <Link href="/announcements" className="btn">看看最近的活動</Link>
          </div>
        </div>
      </section>

      {officers.length > 0 && (
        <section className="grid gap-8 border-t-2 border-ink py-12 md:grid-cols-[14rem_minmax(0,1fr)]">
          <SectionHead eyebrow="Team" title="幹部團隊" />
          {withPhoto ? (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {officers.map((o) => (
                <li key={o.id} className="border-2 border-ink bg-white p-4 text-center">
                  {o.photoUrl ? (
                    <img src={o.photoUrl} alt={o.name} className="mx-auto h-24 w-24 rounded-full border-2 border-ink object-cover" loading="lazy" />
                  ) : (
                    <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 border-ink bg-paper-2 text-3xl font-black" aria-hidden>
                      {o.name.slice(0, 1)}
                    </span>
                  )}
                  <p className="mt-3 inline-block bg-ink px-2 py-0.5 text-xs font-bold text-sun">{o.role}</p>
                  <p className="mt-1 text-lg font-black">{o.name}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-wrap content-start gap-3">
              {officers.map((o) => (
                <dl key={o.id} className="inline-flex items-stretch border-2 border-ink bg-white text-base leading-none">
                  <dt className="flex items-center bg-ink px-4 py-3 font-bold text-sun">{o.role}</dt>
                  <dd className="flex items-center px-5 py-3 text-xl font-black">{o.name}</dd>
                </dl>
              ))}
            </div>
          )}
        </section>
      )}

      {partners.length > 0 && (
        <section className="grid gap-8 border-t-2 border-ink py-12 md:grid-cols-[14rem_minmax(0,1fr)]">
          <SectionHead eyebrow="Partners" title="合作單位" note="感謝這些單位與創創社一起推動創新創業。" />
          <OrgGrid items={partners} />
        </section>
      )}

      {sources.length > 0 && (
        <section className="grid gap-8 border-t-2 border-ink py-12 md:grid-cols-[14rem_minmax(0,1fr)]">
          <SectionHead eyebrow="Sources" title="活動資訊來源" note="本平台彙整下列單位與網站對外公開的活動資訊，點選可查看相關公告。" />
          <OrgGrid items={sources} />
        </section>
      )}
    </div>
  );
}
