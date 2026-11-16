"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAnnouncement } from "@/app/admin/actions";
import {
  FEE_LABEL,
  FEE_TYPES,
  FILE_ACCEPT,
  IMAGE_ACCEPT,
  type FeeTypeKey,
  type StatusKey,
} from "@/lib/constants";
import { formatBytes, formatDateTime, fromInputValue } from "@/lib/format";
import { buildShareText, SHARE_VARIABLES, shareUrl } from "@/lib/share";
import type { AnnouncementInput, SaveIntent } from "@/lib/validation";
import { copyWithToast, toast } from "@/components/Toaster";
import { StatusBadge } from "./StatusBadge";
import { uploadFile } from "./upload";

export type EditorCategory = { id: string; kind: "SOURCE" | "EVENT_TYPE"; name: string; color: string };
export type EditorInitial = AnnouncementInput & { status: StatusKey; publishedAt: string | null; updatedAt: string | null };

const SECTIONS = [
  ["basic", "A", "基本資訊"],
  ["taxonomy", "B", "分類與標籤"],
  ["event", "C", "活動資訊"],
  ["content", "D", "完整公告內文"],
  ["files", "E", "圖片與附件"],
  ["contact", "F", "聯絡與邀請"],
  ["share", "G", "分享設定"],
  ["publish", "H", "發布設定"],
] as const;

function Section({ id, code, title, hint, children }: { id: string; code: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="panel scroll-mt-36 lg:scroll-mt-24">
      <header className="flex items-baseline gap-3 border-b-2 border-ink bg-paper-2 px-4 py-3 md:px-6">
        <span className="eyebrow text-flame-dark">{code}</span>
        <h2 id={`${id}-title`} className="text-lg font-black">{title}</h2>
        {hint && <p className="ml-auto hidden text-xs text-muted md:block">{hint}</p>}
      </header>
      <div className="space-y-5 p-4 md:p-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">
        {label}
        {required && <span className="ml-1 text-danger" aria-hidden>*</span>}
      </span>
      {children}
      {hint && <span className="field-hint block">{hint}</span>}
    </label>
  );
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function AnnouncementEditor({
  id,
  initial,
  categories,
  baseUrl,
}: {
  id: string | null;
  initial: EditorInitial;
  categories: EditorCategory[];
  baseUrl: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<AnnouncementInput>(() => {
    const { status: _s, publishedAt: _p, updatedAt: _u, ...rest } = initial;
    void [_s, _p, _u];
    return rest;
  });
  const [status, setStatus] = useState<StatusKey>(initial.status);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<SaveIntent | "preview" | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(initial.updatedAt);
  const dirtyRef = useRef(false);

  const set = useCallback(<K extends keyof AnnouncementInput>(key: K, value: AnnouncementInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const sources = categories.filter((c) => c.kind === "SOURCE");
  const types = categories.filter((c) => c.kind === "EVENT_TYPE");
  const url = shareUrl(baseUrl, form.slug || "…");
  const sharePreview = useMemo(
    () =>
      buildShareText(
        {
          ...form,
          startAt: fromInputValue(form.startAt),
          endAt: fromInputValue(form.endAt),
          registrationDeadline: fromInputValue(form.registrationDeadline),
        },
        baseUrl,
      ),
    [form, baseUrl],
  );

  // ── 儲存 ───────────────────────────────────────────────
  const submit = async (intent: SaveIntent, opts: { preview?: boolean } = {}): Promise<boolean> => {
    if (busy) return false;
    if (uploading) {
      toast("檔案還在上傳中，請稍候再儲存。", "info");
      return false;
    }
    if (!form.title.trim()) {
      toast("欄位尚未填寫：請先填寫活動標題。", "error");
      document.getElementById("f-title")?.focus();
      return false;
    }
    // 先同步開啟分頁，避免被瀏覽器的彈出視窗封鎖
    const win = opts.preview ? window.open("about:blank", "_blank") : null;
    setBusy(opts.preview ? "preview" : intent);
    try {
      const res = await saveAnnouncement(id, form, intent);
      if (!res.ok) {
        win?.close();
        toast(res.error, "error");
        return false;
      }
      setDirty(false);
      dirtyRef.current = false;
      setStatus(res.status);
      setSavedAt(new Date().toISOString());
      const messages: Record<SaveIntent, string> = {
        save: id ? "儲存成功" : "已儲存為草稿",
        publish: "發布成功，公告已公開在前台",
        schedule: `排程成功，將於 ${formatDateTime(fromInputValue(form.scheduledAt))} 自動發布`,
        unpublish: "已下架，前台不再顯示這則公告",
        archive: "已封存",
        draft: "已移回草稿",
      };
      toast(messages[intent]);
      if (win) win.location.href = `/admin/announcements/${res.id}/preview`;
      if (!id) router.replace(`/admin/announcements/${res.id}`);
      else router.refresh();
      return true;
    } catch {
      win?.close();
      toast("網路連線錯誤，儲存失敗。請確認連線後再試一次。", "error");
      return false;
    } finally {
      setBusy(null);
    }
  };

  // ── 上傳 ───────────────────────────────────────────────
  const withUpload = async (label: string, fn: () => Promise<void>) => {
    setUploading(label);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : "上傳失敗。", "error");
    } finally {
      setUploading(null);
    }
  };

  const onCover = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    void withUpload("cover", async () => {
      const up = await uploadFile(file, "image");
      set("coverImage", up.url);
      toast("封面圖片已上傳");
    });
  };

  const onGallery = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    void withUpload("gallery", async () => {
      const added: AnnouncementInput["images"] = [];
      try {
        for (const file of list) {
          const up = await uploadFile(file, "image");
          added.push({ url: up.url, alt: "" });
        }
      } finally {
        if (added.length) {
          setForm((prev) => ({ ...prev, images: [...prev.images, ...added] }));
          setDirty(true);
          toast(`已上傳 ${added.length} 張圖片`);
        }
      }
    });
  };

  const onAttachments = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    void withUpload("files", async () => {
      const added: AnnouncementInput["attachments"] = [];
      try {
        for (const file of list) {
          const up = await uploadFile(file, "file");
          added.push({
            fileUrl: up.url,
            fileName: up.fileName,
            displayName: up.fileName.replace(/\.[^.]+$/, ""),
            fileType: up.fileType,
            fileSize: up.fileSize,
          });
        }
      } finally {
        if (added.length) {
          setForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...added] }));
          setDirty(true);
          toast(`已上傳 ${added.length} 個附件`);
        }
      }
    });
  };

  const toggleCategory = (cid: string) =>
    set("categoryIds", form.categoryIds.includes(cid) ? form.categoryIds.filter((x) => x !== cid) : [...form.categoryIds, cid]);

  const addTag = () => {
    const name = tagDraft.trim().replace(/^#/, "").slice(0, 20);
    if (!name) return;
    if (!form.customTags.includes(name)) set("customTags", [...form.customTags, name]);
    setTagDraft("");
  };

  const text = (key: keyof AnnouncementInput) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value as never),
  });

  const isContest = categories.some((c) => c.kind === "EVENT_TYPE" && c.name.includes("競賽") && form.categoryIds.includes(c.id));
  const isPublished = status === "PUBLISHED";
  const isScheduled = status === "SCHEDULED";
  const saving = busy !== null;

  return (
    <div className="pb-24">
      {/* 頂部操作列 */}
      <div className="sticky top-14 z-20 -mx-4 border-b-2 border-ink bg-paper px-4 py-2.5 md:-mx-8 md:px-8 lg:top-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link href="/admin/announcements" className="text-sm font-bold underline underline-offset-4">← 公告列表</Link>
          <StatusBadge status={status} />
          <p className="min-w-0 flex-1 truncate text-xs text-muted" aria-live="polite">
            {uploading ? "檔案上傳中…" : dirty ? "有尚未儲存的變更" : savedAt ? `已儲存・${formatDateTime(savedAt)}` : "尚未儲存"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm" disabled={saving} onClick={() => submit("save", { preview: true })}>
              {busy === "preview" ? "儲存中…" : "儲存並預覽"}
            </button>
            <button type="button" className="btn btn-sm bg-white" disabled={saving} onClick={() => submit("save")}>
              {busy === "save" ? "儲存中…" : isPublished ? "儲存變更" : isScheduled ? "儲存" : "儲存草稿"}
            </button>
            {!isPublished && (
              <button type="button" className="btn btn-ink btn-sm" disabled={saving} onClick={() => submit("publish")}>
                {busy === "publish" ? "發布中…" : "立即發布"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[11rem_minmax(0,1fr)]">
        {/* 側邊目錄 */}
        <nav aria-label="表單區塊" className="hidden lg:block">
          <ol className="sticky top-20 space-y-0.5 border-l-2 border-ink">
            {SECTIONS.map(([sid, code, title]) => (
              <li key={sid}>
                <a href={`#${sid}`} className="flex gap-2.5 px-3 py-1.5 text-sm font-bold hover:bg-sun-soft">
                  <span className="eyebrow text-[0.65rem] text-flame-dark">{code}</span>
                  {title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-6">
          {/* A 基本資訊 */}
          <Section id="basic" code="A" title="基本資訊">
            <Field label="活動標題" required>
              <input id="f-title" className="input text-lg font-bold" maxLength={120} placeholder="例如：2026 青年創業提案競賽" {...text("title")} />
            </Field>
            <Field label="活動副標題">
              <input className="input" maxLength={160} {...text("subtitle")} />
            </Field>
            <Field label="活動摘要" hint="一到兩句話說明這個活動，會顯示在公告列表與社群分享預覽。">
              <textarea className="input" rows={3} maxLength={400} {...text("summary")} />
            </Field>

            <div>
              <span className="field-label">封面圖片</span>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="relative aspect-[16/10] w-full flex-none overflow-hidden border-2 border-ink bg-paper-2 sm:w-64">
                  {form.coverImage ? (
                    <img src={form.coverImage} alt="封面預覽" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-sm text-muted">尚未上傳封面</span>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="btn btn-sm cursor-pointer bg-white">
                    {uploading === "cover" ? "上傳中…" : form.coverImage ? "替換圖片" : "上傳封面"}
                    <input type="file" accept={IMAGE_ACCEPT} hidden disabled={!!uploading} onChange={(e) => { onCover(e.target.files); e.target.value = ""; }} />
                  </label>
                  {form.coverImage && (
                    <button type="button" className="btn btn-sm btn-danger ml-2" onClick={() => set("coverImage", "")}>移除</button>
                  )}
                  <p className="field-hint">建議橫式 16:10、寬度 1200px 以上。支援 JPG / PNG / WebP / GIF，8MB 以內。沒有封面時前台會自動顯示品牌色塊。</p>
                </div>
              </div>
            </div>

            <Field label="公告專屬網址" required hint="發布後請不要再修改，否則已經分享出去的連結會失效。修改標題不會影響這個網址。">
              <div className="flex items-stretch">
                <span className="flex items-center border-2 border-r-0 border-[#9aa7b6] bg-paper-2 px-2 font-mono text-xs text-muted">/a/</span>
                <input
                  className="input font-mono"
                  maxLength={60}
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                />
              </div>
            </Field>
          </Section>

          {/* B 分類與標籤 */}
          <Section id="taxonomy" code="B" title="分類與標籤" hint="來源與類型都可以複選">
            <fieldset>
              <legend className="field-label">活動來源（可複選）</legend>
              <div className="flex flex-wrap gap-1.5">
                {sources.map((c) => (
                  <button key={c.id} type="button" className="chip bg-white" aria-pressed={form.categoryIds.includes(c.id)} onClick={() => toggleCategory(c.id)}>
                    <span className="tag-dot" style={{ background: c.color }} aria-hidden />
                    {c.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="field-label">活動類型（可複選）</legend>
              <div className="flex flex-wrap gap-1.5">
                {types.map((c) => (
                  <button key={c.id} type="button" className="chip bg-white" aria-pressed={form.categoryIds.includes(c.id)} onClick={() => toggleCategory(c.id)}>
                    <span className="tag-dot" style={{ background: c.color }} aria-hidden />
                    {c.name}
                  </button>
                ))}
              </div>
              <p className="field-hint">
                找不到適合的分類？到 <Link href="/admin/categories" className="font-bold underline">分類管理</Link> 新增。
              </p>
            </fieldset>

            <fieldset>
              <legend className="field-label">費用屬性<span className="ml-1 text-danger" aria-hidden>*</span></legend>
              <div className="flex flex-wrap gap-1.5">
                {FEE_TYPES.map((k) => (
                  <button key={k} type="button" className="chip bg-white" aria-pressed={form.feeType === k} onClick={() => set("feeType", k as FeeTypeKey)}>
                    {FEE_LABEL[k]}
                  </button>
                ))}
              </div>
            </fieldset>
            {form.feeType !== "FREE" && (
              <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                <Field label={form.feeType === "DEPOSIT" ? "保證金金額（NT$）" : "費用金額（NT$）"}>
                  <input
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={form.feeAmount ?? ""}
                    onChange={(e) => set("feeAmount", e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  />
                </Field>
                <Field label="費用說明" hint="例如：完成指定條件後退還、含午餐與材料費">
                  <input className="input" maxLength={200} {...text("feeDescription")} />
                </Field>
              </div>
            )}

            <Field
              label={isContest ? "獎金（競賽請務必填寫）" : "獎金（選填）"}
              hint="例如：總獎金 NT$100,000、首獎 3 萬元。填寫後會以醒目標示出現在活動頁最上方、公告列表與轉傳文案的開頭。"
            >
              <input
                className={`input max-w-md ${isContest && !form.prize.trim() ? "!border-flame-dark" : ""}`}
                maxLength={60}
                placeholder="總獎金 NT$100,000"
                {...text("prize")}
              />
              {isContest && !form.prize.trim() && (
                <span className="mt-1 block text-xs font-bold text-flame-dark">這則公告勾選了「競賽」，建議標註總獎金或獎金金額。</span>
              )}
            </Field>

            <div>
              <span className="field-label">自訂標籤</span>
              <div className="flex gap-2">
                <input
                  className="input max-w-xs"
                  value={tagDraft}
                  maxLength={20}
                  placeholder="輸入後按 Enter 新增"
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <button type="button" className="btn btn-sm bg-white" onClick={addTag}>新增</button>
              </div>
              {form.customTags.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {form.customTags.map((t) => (
                    <li key={t} className="flex items-center gap-1 border border-line bg-paper-2 py-0.5 pl-2 text-sm font-medium">
                      #{t}
                      <button type="button" className="px-1.5 font-bold hover:text-danger" aria-label={`移除標籤 ${t}`} onClick={() => set("customTags", form.customTags.filter((x) => x !== t))}>×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          {/* C 活動資訊 */}
          <Section id="event" code="C" title="活動資訊" hint="沒有填寫的欄位不會顯示在前台">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="活動開始時間"><input type="datetime-local" className="input" {...text("startAt")} /></Field>
              <Field label="活動結束時間"><input type="datetime-local" className="input" {...text("endAt")} /></Field>
              <Field label="報名截止時間"><input type="datetime-local" className="input" {...text("registrationDeadline")} /></Field>
            </div>
            <p className="field-hint !mt-0">所有時間皆為台灣時間（UTC+8）。</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="活動地點"><input className="input" maxLength={200} {...text("location")} /></Field>
              <Field label="活動對象"><input className="input" maxLength={200} placeholder="例如：全國大專院校學生" {...text("targetAudience")} /></Field>
              <Field label="主辦單位"><input className="input" maxLength={200} {...text("organizer")} /></Field>
              <Field label="協辦單位"><input className="input" maxLength={300} {...text("coOrganizer")} /></Field>
            </div>
            <Field label="報名連結" hint="填寫後，前台會出現「前往報名」按鈕。">
              <input className="input" type="url" inputMode="url" maxLength={500} placeholder="https://" {...text("registrationUrl")} />
            </Field>
            <Field label="YouTube 影片連結（選填）" hint="貼上 YouTube 影片網址，影片會直接內嵌在活動頁面。不需要就留空。">
              <input className="input" type="url" inputMode="url" maxLength={300} placeholder="https://www.youtube.com/watch?v=…" {...text("youtubeUrl")} />
            </Field>
            <Field label="報名方式">
              <textarea className="input" rows={2} maxLength={300} placeholder="例如：線上報名，額滿為止" {...text("registrationMethod")} />
            </Field>
          </Section>

          {/* D 內文 */}
          <Section id="content" code="D" title="完整公告內文" hint="純文字加上簡易標記">
            <textarea
              className="input min-h-[22rem] font-sans leading-relaxed"
              rows={16}
              maxLength={50000}
              aria-label="公告內文"
              placeholder={"在這裡撰寫活動介紹、報名辦法、活動流程、注意事項…\n\n# 活動流程\n- 13:30 報到\n- 14:00 開場\n\n報名網址會自動變成連結：https://example.com"}
              {...text("content")}
            />
            <div className="border-2 border-line bg-paper-2 p-3 text-xs leading-relaxed">
              <p className="font-black">排版小技巧（直接打在文字裡即可）</p>
              <ul className="mt-1 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
                <li><code className="font-mono font-bold"># 文字</code>　大標題</li>
                <li><code className="font-mono font-bold">## 文字</code>　小標題</li>
                <li><code className="font-mono font-bold">- 文字</code>　條列清單</li>
                <li><code className="font-mono font-bold">1. 文字</code>　編號清單</li>
                <li><code className="font-mono font-bold">&gt; 文字</code>　引言區塊</li>
                <li><code className="font-mono font-bold">---</code>　分隔線</li>
                <li><code className="font-mono font-bold">**文字**</code>　粗體</li>
                <li>空一行＝換段；網址會自動變成連結</li>
              </ul>
              <p className="mt-1 text-muted">圖片請放在下方「活動圖片」，表格類資料建議上傳成附件。按「儲存並預覽」可以看實際效果。</p>
            </div>
          </Section>

          {/* E 圖片與附件 */}
          <Section id="files" code="E" title="圖片與附件">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="field-label !mb-0">活動圖片（{form.images.length}）</span>
                <label className="btn btn-sm cursor-pointer bg-white">
                  {uploading === "gallery" ? "上傳中…" : "＋ 上傳圖片"}
                  <input type="file" accept={IMAGE_ACCEPT} multiple hidden disabled={!!uploading} onChange={(e) => { onGallery(e.target.files); e.target.value = ""; }} />
                </label>
              </div>
              {form.images.length === 0 ? (
                <p className="mt-2 border-2 border-dashed border-line p-5 text-center text-sm text-muted">尚未上傳活動圖片。可一次選取多張。</p>
              ) : (
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {form.images.map((img, i) => (
                    <li key={img.url} className="border-2 border-ink bg-white">
                      <div className="aspect-[4/3] overflow-hidden bg-paper-2">
                        <img src={img.url} alt={img.alt || `活動圖片 ${i + 1}`} className="h-full w-full object-cover" />
                      </div>
                      <div className="space-y-2 border-t-2 border-ink p-2">
                        <input
                          className="input !min-h-9 text-sm"
                          placeholder="圖片說明（選填）"
                          maxLength={120}
                          value={img.alt}
                          onChange={(e) => set("images", form.images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))}
                        />
                        <div className="flex gap-1.5">
                          <button type="button" className="btn btn-sm flex-1" disabled={i === 0} aria-label="往前移" onClick={() => set("images", move(form.images, i, i - 1))}>←</button>
                          <button type="button" className="btn btn-sm flex-1" disabled={i === form.images.length - 1} aria-label="往後移" onClick={() => set("images", move(form.images, i, i + 1))}>→</button>
                          <button type="button" className="btn btn-sm btn-danger flex-1" onClick={() => set("images", form.images.filter((_, j) => j !== i))}>刪除</button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-line pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="field-label !mb-0">附件（{form.attachments.length}）</span>
                <label className="btn btn-sm cursor-pointer bg-white">
                  {uploading === "files" ? "上傳中…" : "＋ 上傳附件"}
                  <input type="file" accept={FILE_ACCEPT} multiple hidden disabled={!!uploading} onChange={(e) => { onAttachments(e.target.files); e.target.value = ""; }} />
                </label>
              </div>
              <p className="field-hint">支援 PDF、Word、Excel、PowerPoint、ODF、TXT、CSV、ZIP 與圖片，每個檔案 20MB 以內。</p>
              {form.attachments.length === 0 ? (
                <p className="mt-2 border-2 border-dashed border-line p-5 text-center text-sm text-muted">尚未上傳附件，例如活動簡章 PDF、報名表。</p>
              ) : (
                <ul className="mt-3 border-2 border-ink">
                  {form.attachments.map((f, i) => (
                    <li key={f.fileUrl} className="flex flex-wrap items-center gap-3 border-b border-line bg-white p-3 last:border-b-0">
                      <span className="flex h-10 w-11 flex-none items-center justify-center bg-ink font-mono text-[0.65rem] font-bold uppercase text-sun" aria-hidden>{f.fileType}</span>
                      <div className="min-w-[12rem] flex-1">
                        <input
                          className="input !min-h-9 text-sm font-bold"
                          aria-label="附件顯示名稱"
                          maxLength={150}
                          value={f.displayName}
                          onChange={(e) => set("attachments", form.attachments.map((x, j) => (j === i ? { ...x, displayName: e.target.value } : x)))}
                        />
                        <p className="mt-1 truncate text-xs text-muted">原始檔名：{f.fileName}・{formatBytes(f.fileSize)}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button type="button" className="btn btn-sm" disabled={i === 0} aria-label="上移" onClick={() => set("attachments", move(form.attachments, i, i - 1))}>↑</button>
                        <button type="button" className="btn btn-sm" disabled={i === form.attachments.length - 1} aria-label="下移" onClick={() => set("attachments", move(form.attachments, i, i + 1))}>↓</button>
                        <a className="btn btn-sm" href={f.fileUrl} target="_blank" rel="noopener noreferrer">檢視</a>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => set("attachments", form.attachments.filter((_, j) => j !== i))}>刪除</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          {/* F 聯絡與邀請 */}
          <Section id="contact" code="F" title="聯絡與邀請資訊">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="聯絡人"><input className="input" maxLength={80} {...text("contactName")} /></Field>
              <Field label="聯絡 Email"><input className="input" type="email" maxLength={120} {...text("contactEmail")} /></Field>
              <Field label="聯絡電話"><input className="input" type="tel" maxLength={60} {...text("contactPhone")} /></Field>
              <Field label="LINE 聯絡資訊"><input className="input" maxLength={120} placeholder="LINE ID 或官方帳號" {...text("contactLine")} /></Field>
            </div>
            <Field label="其他聯絡方式"><textarea className="input" rows={2} maxLength={300} {...text("contactOther")} /></Field>
            <Field label="對外邀請文案" hint="寫給大家看的一段邀請文字。有填寫時，會取代「活動摘要」出現在自動產生的轉傳文案開頭。">
              <textarea className="input" rows={4} maxLength={1000} placeholder="想了解青年創業資源與實際創業經驗嗎？歡迎有興趣的同學一起參與！" {...text("invitationText")} />
            </Field>
          </Section>

          {/* G 分享設定 */}
          <Section id="share" code="G" title="分享設定">
            <div>
              <span className="field-label">專屬分享網址</span>
              <div className="flex items-stretch border-2 border-ink bg-white">
                <p className="min-w-0 flex-1 truncate px-3 py-2 font-mono text-sm">{url}</p>
                <button type="button" className="flex-none border-l-2 border-ink bg-ink px-3 text-sm font-bold text-paper hover:bg-flame-dark" onClick={() => copyWithToast(url, "已複製活動網址")}>
                  複製連結
                </button>
              </div>
              {!isPublished && <p className="field-hint">公告發布後，這個連結才能公開瀏覽。</p>}
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <div>
                <Field label="自訂分享文案" hint="留空就使用右方系統自動組成的版本。">
                  <textarea className="input font-sans" rows={12} maxLength={2000} placeholder="（留空＝使用自動產生的文案）" {...text("customShareText")} />
                </Field>
                <div className="mt-2">
                  <p className="text-xs font-bold">可插入的變數（點一下加入）：</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {SHARE_VARIABLES.map(([token, label]) => (
                      <button
                        key={token}
                        type="button"
                        title={label}
                        className="border border-line bg-paper-2 px-1.5 py-0.5 font-mono text-xs hover:border-ink"
                        onClick={() => set("customShareText", `${form.customShareText}${token}`)}
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="field-label !mb-0">分享預覽{form.customShareText.trim() ? "（自訂文案）" : "（自動產生）"}</span>
                  <button type="button" className="btn btn-sm btn-ink" onClick={() => copyWithToast(sharePreview, "已複製分享文案")}>複製分享文案</button>
                </div>
                <pre className="mt-2 max-h-[22rem] min-h-40 overflow-auto whitespace-pre-wrap break-words border-2 border-ink bg-sun-soft p-3 font-sans text-sm leading-relaxed">
                  {sharePreview}
                </pre>
              </div>
            </div>
          </Section>

          {/* H 發布設定 */}
          <Section id="publish" code="H" title="發布設定">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold">目前狀態</span>
              <StatusBadge status={status} />
              {initial.publishedAt && <span className="text-sm text-muted">首次發布：{formatDateTime(initial.publishedAt)}</span>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3 border-2 border-line bg-white p-3 has-[:checked]:border-ink has-[:checked]:bg-sun-soft">
                <input type="checkbox" className="mt-1 h-5 w-5 accent-[#0b2a4a]" checked={form.isPinned} onChange={(e) => set("isPinned", e.target.checked)} />
                <span>
                  <span className="block font-bold">置頂公告</span>
                  <span className="text-xs text-muted">在「最新公告」列表中排在最前面。</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 border-2 border-line bg-white p-3 has-[:checked]:border-ink has-[:checked]:bg-sun-soft">
                <input type="checkbox" className="mt-1 h-5 w-5 accent-[#0b2a4a]" checked={form.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} />
                <span>
                  <span className="block font-bold">設為精選活動</span>
                  <span className="text-xs text-muted">顯示在首頁「精選活動」，最多呈現 3 則。</span>
                </span>
              </label>
            </div>

            {!isPublished && (
              <div className="border-2 border-ink bg-white p-4">
                <p className="font-black">預定發布</p>
                <p className="field-hint !mt-1">設定時間後按「設定排程」，系統會在指定時間自動發布，不需要再手動操作。</p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <Field label="預定發布時間（台灣時間）">
                    <input type="datetime-local" className="input" {...text("scheduledAt")} />
                  </Field>
                  <button type="button" className="btn" disabled={saving || !form.scheduledAt} onClick={() => submit("schedule")}>
                    {busy === "schedule" ? "設定中…" : isScheduled ? "更新排程" : "設定排程"}
                  </button>
                  {isScheduled && (
                    <button type="button" className="btn btn-danger" disabled={saving} onClick={() => submit("draft")}>取消排程</button>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-line pt-5">
              <button type="button" className="btn bg-white" disabled={saving} onClick={() => submit("save")}>
                {isPublished ? "儲存變更" : isScheduled ? "儲存" : "儲存草稿"}
              </button>
              <button type="button" className="btn" disabled={saving} onClick={() => submit("save", { preview: true })}>儲存並預覽</button>
              {!isPublished && (
                <button type="button" className="btn btn-ink" disabled={saving} onClick={() => submit("publish")}>立即發布</button>
              )}
              {isPublished && (
                <>
                  <a className="btn" href={`/a/${form.slug}`} target="_blank" rel="noopener noreferrer">查看前台頁面 ↗</a>
                  <button type="button" className="btn btn-danger" disabled={saving} onClick={() => submit("unpublish")}>下架公告</button>
                </>
              )}
              {id && status !== "ARCHIVED" && (
                <button type="button" className="btn" disabled={saving} onClick={() => submit("archive")}>封存</button>
              )}
              {id && (status === "UNPUBLISHED" || status === "ARCHIVED") && (
                <button type="button" className="btn" disabled={saving} onClick={() => submit("draft")}>移回草稿</button>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
