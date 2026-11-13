import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBySlug, getRelated } from "@/lib/announcements";
import { formatRange } from "@/lib/format";
import { getBaseUrl, getSettings } from "@/lib/settings";
import { buildShareText, shareUrl } from "@/lib/share";
import { AnnouncementMini } from "@/components/site/AnnouncementRow";
import { AnnouncementView } from "@/components/site/AnnouncementView";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublicBySlug(slug);
  if (!a) return { title: "找不到公告", robots: { index: false } };
  const [base, s] = await Promise.all([getBaseUrl(), getSettings()]);
  const url = shareUrl(base, a.slug);
  const when = formatRange(a.startAt, a.endAt);
  const description = (a.summary || a.contentText || s.heroIntro).slice(0, 150) + (when ? `｜${when}` : "");
  const image = a.coverImage || s.logoUrl || "/brand/logo.jpg";
  return {
    title: a.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: a.title,
      description,
      siteName: s.siteName,
      locale: "zh_TW",
      publishedTime: a.publishedAt?.toISOString(),
      images: [{ url: image, alt: a.title }],
    },
    twitter: { card: a.coverImage ? "summary_large_image" : "summary", title: a.title, description, images: [image] },
  };
}

export default async function AnnouncementPage({ params }: Props) {
  const { slug } = await params;
  const a = await getPublicBySlug(slug);
  if (!a) notFound();
  const [base, related] = await Promise.all([getBaseUrl(), getRelated(a)]);
  const url = shareUrl(base, a.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: a.title,
    description: a.summary ?? undefined,
    startDate: a.startAt?.toISOString(),
    endDate: a.endAt?.toISOString(),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: a.location ? { "@type": "Place", name: a.location } : undefined,
    organizer: a.organizer ? { "@type": "Organization", name: a.organizer } : undefined,
    image: a.coverImage ? `${base}${a.coverImage}` : undefined,
    isAccessibleForFree: a.feeType === "FREE",
    url,
  };

  return (
    <>
      {a.startAt && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      <AnnouncementView a={a} url={url} shareText={buildShareText(a, base)} />

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="wrap mt-20">
          <div className="flex items-end justify-between border-b-2 border-ink pb-3">
            <h2 id="related-title" className="text-2xl font-black md:text-3xl">你可能也有興趣</h2>
            <span className="eyebrow text-muted">Related</span>
          </div>
          <div className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <AnnouncementMini key={r.id} a={r} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
