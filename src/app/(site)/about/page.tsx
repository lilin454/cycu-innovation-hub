import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { Logo } from "@/components/site/Logo";

export const metadata: Metadata = {
  title: "關於創創社",
  description: "認識中原大學創新創業發展社，以及我們彙整活動資訊的來源。",
  alternates: { canonical: "/about" },
};

// 活動資訊來源：href 對應「活動來源」分類的篩選結果
const SOURCES = [
  { src: "/brand/ciec.jpg", name: "中原大學創新創業發展中心", href: "/announcements?source=ciec" },
  { src: "/brand/youth-bureau.png", name: "桃園市政府青年事務局", href: "/announcements?source=youth-bureau" },
  { src: "/brand/taoyuan.png", name: "桃園市政府", href: "/announcements?source=youth-bureau" },
  { src: "/brand/alumni-taipei.png", name: "中原大學台北校友會", href: "/announcements?source=alumni-taipei" },
  { src: "/brand/bhuntr.png", name: "獎金獵人", href: "/announcements?source=bhuntr" },
  { src: "/brand/cycu.png", name: "中原大學網站", href: "/announcements?source=cycu-web" },
];

export default async function AboutPage() {
  const s = await getSettings();
  if (s.showAbout === "0") notFound();
  const president = s.presidentName.trim();
  const vicePresident = s.vicePresidentName.trim();

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
        <div>
          <p className="eyebrow text-muted">Who we are</p>
          <h2 className="mt-1 text-2xl font-black">我們是誰</h2>
        </div>
        <div className="max-w-2xl space-y-5 text-lg leading-loose">
          {s.aboutText.split(/\n{1,}/).filter(Boolean).map((p, i) => (
            <p key={i}>{p}</p>
          ))}

          {(president || vicePresident) && (
            <div className="flex flex-wrap gap-3">
              {[["社長", president], ["副社長", vicePresident]].filter(([, n]) => n).map(([role, n]) => (
                <dl key={role} className="inline-flex items-stretch border-2 border-ink bg-white text-base leading-none">
                  <dt className="flex items-center bg-ink px-4 py-3 font-bold text-sun">{role}</dt>
                  <dd className="flex items-center px-5 py-3 text-xl font-black">{n}</dd>
                </dl>
              ))}
            </div>
          )}

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

      {s.showSources !== "0" && (
        <section className="grid gap-8 border-t-2 border-ink py-12 md:grid-cols-[14rem_minmax(0,1fr)]">
          <div>
            <p className="eyebrow text-muted">Sources</p>
            <h2 className="mt-1 text-2xl font-black">活動資訊來源</h2>
            <p className="mt-2 text-sm text-muted">本平台彙整下列單位與網站對外公開的活動資訊，點選可查看相關公告。</p>
          </div>
          <ul className="grid grid-cols-2 border-l-2 border-t-2 border-ink lg:grid-cols-3">
            {SOURCES.map((p) => (
              <li key={p.name} className="border-b-2 border-r-2 border-ink bg-white">
                <Link href={p.href} className="flex h-full flex-col items-center justify-between gap-4 p-5 text-center hover:bg-sun-soft">
                  <img src={p.src} alt="" className="h-16 w-full object-contain" loading="lazy" />
                  <span className="text-sm font-bold leading-snug">{p.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
