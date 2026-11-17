import Link from "next/link";
import type { AnnouncementDetail } from "@/lib/announcements";
import { formatBytes, formatDate, formatDateTime, formatFee, formatRange } from "@/lib/format";
import { DEFAULT_SURVEY_QUESTION, parseSurveyOptions } from "@/lib/survey";
import { youtubeEmbedUrl, youtubeId } from "@/lib/youtube";
import { Content } from "./Content";
import { Cover } from "./Cover";
import { ShareBar } from "./ShareBar";
import { SurveyForm } from "./SurveyForm";
import { TagList } from "./Tags";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 border-b border-line py-3 last:border-b-0">
      <dt className="text-sm font-black">{label}</dt>
      <dd className="min-w-0 break-words text-[0.95rem]">{children}</dd>
    </div>
  );
}

/** 公告詳細內容。前台頁面與後台預覽共用；沒有填寫的欄位不會出現。 */
export function AnnouncementView({
  a,
  url,
  shareText,
  preview = false,
}: {
  a: AnnouncementDetail;
  url: string;
  shareText: string;
  preview?: boolean;
}) {
  const when = formatRange(a.startAt, a.endAt);
  const deadline = formatDateTime(a.registrationDeadline);
  const deadlinePassed = a.registrationDeadline ? a.registrationDeadline < new Date() : false;
  const ended = (a.endAt ?? a.startAt) ? (a.endAt ?? a.startAt)! < new Date() : false;
  const typeName = a.categories.find((c) => c.kind === "EVENT_TYPE")?.name ?? "活動";
  const hasContact = a.contactName || a.contactEmail || a.contactPhone || a.contactLine || a.contactOther;
  const hasContent = a.content.trim().length > 0;
  const videoId = youtubeId(a.youtubeUrl);

  return (
    <article className="pb-28 lg:pb-0">
      {/* 標題區 */}
      <header className="border-b-2 border-ink">
        <div className="wrap pb-8 pt-6 md:pb-12 md:pt-10">
          <nav aria-label="麵包屑" className="eyebrow mb-6 flex flex-wrap gap-2 text-[0.65rem] text-muted">
            <Link href="/" className="hover:text-ink">首頁</Link>
            <span aria-hidden>/</span>
            <Link href="/announcements" className="hover:text-ink">最新公告</Link>
            <span aria-hidden>/</span>
            <span className="text-ink">{a.slug}</span>
          </nav>
          {a.prize?.trim() && (
            <p className="mb-4 inline-flex items-stretch border-2 border-ink text-base font-black leading-none md:text-lg">
              <span className="flex items-center bg-ink px-3 py-2.5 text-sun">獎金</span>
              <span className="flex items-center bg-sun px-4 py-2.5 text-deep">{a.prize.trim()}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {ended && <span className="tag bg-muted text-white">活動已結束</span>}
            <TagList categories={a.categories} feeType={a.feeType} feeAmount={a.feeAmount} showCustom />
          </div>
          <h1 className="mt-5 max-w-4xl text-[1.9rem] font-black leading-tight md:text-5xl md:leading-[1.15]">{a.title}</h1>
          {a.subtitle && <p className="mt-3 max-w-3xl text-lg font-bold text-navy md:text-2xl">{a.subtitle}</p>}
          {a.summary && <p className="mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-muted md:text-lg">{a.summary}</p>}
          <p className="eyebrow mt-6 text-[0.68rem] text-muted">
            發布於 {formatDate(a.publishedAt ?? a.createdAt)}
            {a.organizer && <span className="ml-3 normal-case tracking-normal">・{a.organizer}</span>}
          </p>
        </div>
      </header>

      <div className="wrap grid grid-cols-[minmax(0,1fr)] gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14 lg:pt-12">
        {/* 主要內容 */}
        <div className="min-w-0">
          {a.coverImage && <Cover src={a.coverImage} alt={`${a.title} 活動封面`} seed={a.slug} label={typeName} ratio="16 / 9" priority />}

          {/* 手機版：活動資訊緊接在封面之後 */}
          <div className="mt-8 lg:hidden">
            <InfoSheet />
          </div>

          {hasContent && (
            <section aria-label="活動內容" className={a.coverImage ? "mt-10" : "mt-10 lg:mt-0"}>
              <Content text={a.content} />
            </section>
          )}

          {a.surveyEnabled && (
            <SurveyForm
              announcementId={a.id}
              question={a.surveyQuestion?.trim() || DEFAULT_SURVEY_QUESTION}
              options={parseSurveyOptions(a.surveyOptions)}
              preview={preview}
            />
          )}

          {videoId && (
            <section aria-labelledby="video-title" className="mt-14">
              <h2 id="video-title" className="border-t-2 border-ink pt-4 text-2xl font-black">活動影片</h2>
              <div className="mt-5 aspect-video border-2 border-ink bg-deep">
                <iframe
                  src={youtubeEmbedUrl(videoId)}
                  title={`${a.title} 活動影片`}
                  loading="lazy"
                  className="h-full w-full"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </section>
          )}

          {a.images.length > 0 && (
            <section aria-labelledby="gallery-title" className="mt-14">
              <h2 id="gallery-title" className="border-t-2 border-ink pt-4 text-2xl font-black">活動圖片</h2>
              <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                {a.images.map((img, i) => (
                  <li key={img.id} className={i === 0 && a.images.length % 2 === 1 ? "col-span-2 md:col-span-1" : ""}>
                    <a href={img.url} target="_blank" rel="noopener noreferrer" aria-label={`開啟圖片：${img.alt || `活動圖片 ${i + 1}`}`}>
                      <Cover src={img.url} alt={img.alt || `活動圖片 ${i + 1}`} seed={img.id} label="圖片" ratio="4 / 3" />
                    </a>
                    {img.alt && <p className="mt-1 text-xs text-muted">{img.alt}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {a.attachments.length > 0 && (
            <section aria-labelledby="files-title" className="mt-14">
              <h2 id="files-title" className="border-t-2 border-ink pt-4 text-2xl font-black">附件下載</h2>
              <ul className="mt-5 border-2 border-ink bg-white">
                {a.attachments.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 border-b border-line p-3 last:border-b-0 md:gap-4 md:p-4">
                    <span className="flex h-11 w-12 flex-none items-center justify-center bg-ink font-mono text-[0.68rem] font-bold uppercase text-sun" aria-hidden>
                      {f.fileType}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-bold leading-snug">{f.displayName}</span>
                      <span className="text-xs text-muted">{f.fileType.toUpperCase()}・{formatBytes(f.fileSize)}</span>
                    </span>
                    {preview ? (
                      <span className="btn btn-sm flex-none opacity-60">下載</span>
                    ) : (
                      <a href={`/download/${f.id}`} className="btn btn-sm flex-none" download aria-label={`下載 ${f.displayName}`}>
                        下載 <span aria-hidden>↓</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasContact && (
            <section aria-labelledby="contact-title" className="mt-14">
              <h2 id="contact-title" className="border-t-2 border-ink pt-4 text-2xl font-black">聯絡資訊</h2>
              <dl className="mt-3">
                {a.contactName && <Info label="聯絡人">{a.contactName}</Info>}
                {a.contactEmail && (
                  <Info label="Email">
                    <a className="font-bold text-flame-dark underline underline-offset-4" href={`mailto:${a.contactEmail}`}>{a.contactEmail}</a>
                  </Info>
                )}
                {a.contactPhone && (
                  <Info label="電話">
                    <a className="font-bold underline underline-offset-4" href={`tel:${a.contactPhone.replace(/[^\d+#*]/g, "")}`}>{a.contactPhone}</a>
                  </Info>
                )}
                {a.contactLine && <Info label="LINE">{a.contactLine}</Info>}
                {a.contactOther && <Info label="其他"><span className="whitespace-pre-line">{a.contactOther}</span></Info>}
              </dl>
            </section>
          )}
        </div>

        {/* 側欄：活動資訊＋分享 */}
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="hidden lg:block">
            <InfoSheet />
          </div>
          <ShareBar url={url} title={a.title} shareText={shareText} />
        </aside>
      </div>

      {/* 手機版底部固定操作列 */}
      {!preview && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-paper p-3 lg:hidden">
          <div className="flex gap-2">
            {a.registrationUrl && !deadlinePassed && (
              <a href={a.registrationUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ink flex-[1.4] !px-2">
                前往報名
              </a>
            )}
            <div className="flex-[2]">
              <ShareBar url={url} title={a.title} shareText={shareText} variant="compact" />
            </div>
          </div>
        </div>
      )}
    </article>
  );

  function InfoSheet() {
    return (
      <section aria-label="活動資訊" className="border-2 border-ink bg-white">
        <div className="flex items-center justify-between bg-ink px-4 py-2 text-paper">
          <h2 className="font-black">活動資訊</h2>
          <span className="eyebrow text-[0.6rem] text-sun">Info</span>
        </div>
        <dl className="px-4">
          {a.prize?.trim() && (
            <Info label="活動獎金">
              <span className="font-black text-flame-dark">{a.prize.trim()}</span>
            </Info>
          )}
          {when && <Info label="活動時間">{when}</Info>}
          {deadline && (
            <Info label="報名截止">
              {deadline}
              {deadlinePassed && <span className="ml-2 text-sm font-bold text-danger">（已截止）</span>}
            </Info>
          )}
          {a.location && <Info label="活動地點">{a.location}</Info>}
          <Info label="活動費用">
            <span className="font-bold">{formatFee(a.feeType, a.feeAmount, a.feeDescription)}</span>
          </Info>
          {a.targetAudience && <Info label="活動對象">{a.targetAudience}</Info>}
          {a.organizer && <Info label="主辦單位">{a.organizer}</Info>}
          {a.coOrganizer && <Info label="協辦單位">{a.coOrganizer}</Info>}
          {a.registrationMethod && <Info label="報名方式"><span className="whitespace-pre-line">{a.registrationMethod}</span></Info>}
        </dl>
        {a.registrationUrl && (
          <div className="border-t-2 border-ink p-4">
            {deadlinePassed ? (
              <p className="text-center text-sm font-bold text-muted">報名已截止</p>
            ) : (
              <a href={a.registrationUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sun w-full">
                前往報名 <span aria-hidden>↗</span>
              </a>
            )}
          </div>
        )}
      </section>
    );
  }
}
