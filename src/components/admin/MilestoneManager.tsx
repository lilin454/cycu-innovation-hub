"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMilestone, saveMilestone } from "@/app/admin/actions";
import { IMAGE_ACCEPT } from "@/lib/constants";
import {
  MILESTONE_KIND_LABEL,
  MILESTONE_KINDS,
  MILESTONE_SUBJECT_LABEL,
  MILESTONE_SUBJECTS,
  type Milestone,
  type MilestoneKind,
  type MilestoneSubject,
} from "@/lib/milestone-types";
import { toast } from "@/components/Toaster";
import { ConfirmDialog } from "./ConfirmDialog";
import { uploadFile } from "./upload";

type Draft = {
  id: string | null;
  title: string;
  kind: MilestoneKind;
  subject: MilestoneSubject;
  people: string;
  occurredOn: string;
  location: string;
  content: string;
  coverImage: string;
  linkUrl: string;
  published: boolean;
};

const empty = (): Draft => ({
  id: null, title: "", kind: "AWARD", subject: "CLUB", people: "", occurredOn: "", location: "",
  content: "", coverImage: "", linkUrl: "", published: true,
});

const toDraft = (m: Milestone): Draft => ({
  id: m.id, title: m.title, kind: m.kind, subject: m.subject, people: m.people ?? "", occurredOn: m.occurredOn,
  location: m.location ?? "", content: m.content, coverImage: m.coverImage ?? "", linkUrl: m.linkUrl ?? "",
  published: m.status === "PUBLISHED",
});

export function MilestoneManager({ items, canDelete }: { items: Milestone[]; canDelete: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<Milestone | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (!draft.title.trim()) return toast("請填寫標題。", "error");
    if (!draft.occurredOn) return toast("請選擇日期。", "error");
    start(async () => {
      try {
        const { id, ...data } = draft;
        const res = await saveMilestone(id, data);
        if (!res.ok) {
          toast(res.error, "error");
          return;
        }
        toast(id ? "紀錄已更新" : draft.published ? "紀錄已新增並公開" : "已儲存為草稿");
        setDraft(null);
        router.refresh();
      } catch {
        toast("網路連線錯誤，儲存失敗。", "error");
      }
    });
  };

  const onCover = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadFile(file, "image");
      set("coverImage", up.url);
      toast("圖片已上傳");
    } catch (e) {
      toast(e instanceof Error ? e.message : "上傳失敗。", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {draft ? (
        <form onSubmit={save} className="panel mt-6">
          <h2 className="border-b-2 border-ink bg-paper-2 px-4 py-2.5 font-black">{draft.id ? "編輯紀錄" : "新增紀錄"}</h2>
          <div className="space-y-5 p-4 md:p-6">
            <label className="block">
              <span className="field-label">標題<span className="ml-1 text-danger" aria-hidden>*</span></span>
              <input className="input text-lg font-bold" maxLength={120} required autoFocus placeholder="例如：榮獲 2026 青年創意提案競賽 第一名" value={draft.title} onChange={(e) => set("title", e.target.value)} />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="field-label">類型</span>
                <select className="input" value={draft.kind} onChange={(e) => set("kind", e.target.value as MilestoneKind)}>
                  {MILESTONE_KINDS.map((k) => <option key={k} value={k}>{MILESTONE_KIND_LABEL[k]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="field-label">對象</span>
                <select className="input" value={draft.subject} onChange={(e) => set("subject", e.target.value as MilestoneSubject)}>
                  {MILESTONE_SUBJECTS.map((k) => <option key={k} value={k}>{MILESTONE_SUBJECT_LABEL[k]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="field-label">日期<span className="ml-1 text-danger" aria-hidden>*</span></span>
                <input className="input" type="date" required value={draft.occurredOn} onChange={(e) => set("occurredOn", e.target.value)} />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">成員（選填）</span>
                <input className="input" maxLength={200} placeholder="例如：王小明、陳小華" value={draft.people} onChange={(e) => set("people", e.target.value)} />
                <span className="field-hint block">會公開顯示在前台，刊登姓名前請先取得當事人同意。</span>
              </label>
              <label className="block">
                <span className="field-label">地點（選填）</span>
                <input className="input" maxLength={200} value={draft.location} onChange={(e) => set("location", e.target.value)} />
              </label>
            </div>
            <label className="block">
              <span className="field-label">說明（選填）</span>
              <textarea className="input" rows={5} maxLength={5000} value={draft.content} onChange={(e) => set("content", e.target.value)} />
              <span className="field-hint block">可用和公告內文相同的簡易標記：# 標題、- 清單、**粗體**，網址會自動變成連結。</span>
            </label>
            <label className="block">
              <span className="field-label">相關連結（選填）</span>
              <input className="input" type="url" maxLength={500} placeholder="https://" value={draft.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} />
            </label>
            <div>
              <span className="field-label">照片（選填）</span>
              <div className="flex flex-wrap items-center gap-4">
                {draft.coverImage && <img src={draft.coverImage} alt="照片預覽" className="h-24 w-32 border-2 border-ink object-cover" />}
                <label className="btn btn-sm cursor-pointer bg-white">
                  {uploading ? "上傳中…" : draft.coverImage ? "替換照片" : "上傳照片"}
                  <input type="file" accept={IMAGE_ACCEPT} hidden disabled={uploading} onChange={(e) => { void onCover(e.target.files); e.target.value = ""; }} />
                </label>
                {draft.coverImage && <button type="button" className="btn btn-sm btn-danger" onClick={() => set("coverImage", "")}>移除</button>}
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-3 border-2 border-line bg-white p-3 has-[:checked]:border-ink has-[:checked]:bg-sun-soft">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-[#0b2a4a]" checked={draft.published} onChange={(e) => set("published", e.target.checked)} />
              <span>
                <span className="block font-bold">公開顯示在前台</span>
                <span className="text-xs text-muted">取消勾選會存成草稿，只有管理員看得到。</span>
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-ink" disabled={pending || uploading}>{pending ? "儲存中…" : "儲存"}</button>
              <button type="button" className="btn" onClick={() => setDraft(null)} disabled={pending}>取消</button>
            </div>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-ink mt-6" onClick={() => setDraft(empty())}>＋ 新增紀錄</button>
      )}

      <section className="panel mt-6">
        <h2 className="border-b-2 border-ink bg-paper-2 px-4 py-2.5 font-black">所有紀錄（{items.length}）</h2>
        {items.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">還沒有任何紀錄。按「新增紀錄」寫下第一筆成果。</p>
        ) : (
          <ul>
            {items.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-b-0">
                <span className="font-display text-sm font-black">{m.occurredOn.replace(/-/g, "/")}</span>
                <span className="min-w-[12rem] flex-1">
                  <span className="block font-bold leading-snug">{m.title}</span>
                  <span className="text-xs text-muted">
                    {MILESTONE_KIND_LABEL[m.kind]}・{MILESTONE_SUBJECT_LABEL[m.subject]}
                    {m.people ? `・${m.people}` : ""}
                  </span>
                </span>
                <span className={`border-[1.5px] px-2 py-0.5 text-xs font-bold ${m.status === "PUBLISHED" ? "border-ok bg-ok text-white" : "border-muted text-muted"}`}>
                  {m.status === "PUBLISHED" ? "已公開" : "草稿"}
                </span>
                <span className="flex gap-1.5">
                  <button type="button" className="btn btn-sm bg-white" disabled={pending} onClick={() => { setDraft(toDraft(m)); window.scrollTo({ top: 0, behavior: "smooth" }); }}>編輯</button>
                  {canDelete && <button type="button" className="btn btn-sm btn-danger" disabled={pending} onClick={() => setToDelete(m)}>刪除</button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={toDelete !== null}
        title="確定要刪除這筆紀錄嗎？"
        confirmLabel="永久刪除"
        danger
        busy={pending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const m = toDelete;
          if (!m) return;
          start(async () => {
            try {
              const res = await deleteMilestone(m.id);
              if (!res.ok) {
                toast(res.error, "error");
                return;
              }
              toast("紀錄已刪除");
              setToDelete(null);
              if (draft?.id === m.id) setDraft(null);
              router.refresh();
            } catch {
              toast("網路連線錯誤，請稍後再試。", "error");
            }
          });
        }}
      >
        <p>「{toDelete?.title}」會被永久刪除，無法復原。如果只是暫時不想公開，可以改成草稿。</p>
      </ConfirmDialog>
    </>
  );
}
