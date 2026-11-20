"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createMilestoneFromAnnouncement, setShowInRecords } from "@/app/admin/actions";
import { formatDateTime } from "@/lib/format";
import type { RecordCandidate } from "@/lib/milestones";
import { toast } from "@/components/Toaster";

const STATUS_LABEL: Record<string, string> = { PUBLISHED: "仍公開中", UNPUBLISHED: "已下架", ARCHIVED: "已封存" };

/** 後台「活動紀錄」：勾選已結束的活動公告，讓它顯示在前台活動紀錄 */
export function RecordPicker({ items }: { items: RecordCandidate[] }) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.id, i.showInRecords === 1])));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [onlyChecked, setOnlyChecked] = useState(false);
  const [, start] = useTransition();

  const toggle = (it: RecordCandidate, next: boolean) => {
    setChecked((p) => ({ ...p, [it.id]: next }));
    setBusyId(it.id);
    start(async () => {
      try {
        const res = await setShowInRecords(it.id, next);
        if (!res.ok) {
          setChecked((p) => ({ ...p, [it.id]: !next }));
          toast(res.error, "error");
          return;
        }
        toast(next ? "已加入活動紀錄" : "已從活動紀錄移除");
        router.refresh();
      } catch {
        setChecked((p) => ({ ...p, [it.id]: !next }));
        toast("網路連線錯誤，請稍後再試。", "error");
      } finally {
        setBusyId(null);
      }
    });
  };

  /** 轉成可編輯的紀錄（或打開已轉過的紀錄）後，跳到上方的編輯表單 */
  const edit = (it: RecordCandidate) => {
    setBusyId(it.id);
    start(async () => {
      try {
        const res = it.milestoneId ? { ok: true as const, id: it.milestoneId } : await createMilestoneFromAnnouncement(it.id);
        if (!res.ok) {
          toast(res.error, "error");
          return;
        }
        if (!it.milestoneId) toast("已建立活動紀錄，可以開始編輯文字與照片");
        router.push(`/admin/records?edit=${res.id}`);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        toast("網路連線錯誤，請稍後再試。", "error");
      } finally {
        setBusyId(null);
      }
    });
  };

  const count = Object.values(checked).filter(Boolean).length;
  const shown = onlyChecked ? items.filter((i) => checked[i.id]) : items;

  return (
    <section className="panel mt-6" aria-labelledby="picker-title">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-ink bg-paper-2 px-4 py-2.5">
        <h2 id="picker-title" className="font-black">從已結束的活動加入</h2>
        <span className="text-sm text-muted">已勾選 {count} 個</span>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-sm font-bold">
          <input type="checkbox" className="h-4 w-4 accent-[#0b2a4a]" checked={onlyChecked} onChange={(e) => setOnlyChecked(e.target.checked)} />
          只看已勾選
        </label>
      </header>
      <p className="border-b border-line px-4 py-2 text-xs text-muted">
        想寫活動成效、放現場照片：按「轉成可編輯紀錄」，會用公告的標題、日期、地點與封面建立一筆活動紀錄，之後文字與照片都能自由編輯（原公告不受影響）。
        只勾選則直接沿用公告的標題、日期、地點、摘要與封面顯示。活動結束、下架或封存的公告都會列在這裡。
      </p>
      {shown.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">
          {onlyChecked ? "還沒有勾選任何活動。" : "目前還沒有已結束的活動。活動結束或下架後就會出現在這裡。"}
        </p>
      ) : (
        <ul>
          {shown.map((it) => (
            <li key={it.id} className="border-b border-line last:border-b-0">
              <div className="flex items-start gap-3 px-4 py-3 hover:bg-sun-soft">
                {it.milestoneId ? (
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center border-2 border-ink bg-ink text-xs font-black text-paper" title="已建立可編輯的活動紀錄" aria-label="已建立可編輯的活動紀錄">✓</span>
                ) : (
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 flex-none cursor-pointer accent-[#0b2a4a]"
                    aria-label={`直接加入活動紀錄：${it.title}`}
                    checked={Boolean(checked[it.id])}
                    disabled={busyId === it.id}
                    onChange={(e) => toggle(it, e.target.checked)}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-bold leading-snug">{it.title}</span>
                  <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                    {it.startAt && <span>{formatDateTime(it.startAt)}</span>}
                    {it.location && <span className="max-w-full truncate">{it.location}</span>}
                    <span className="font-bold">
                      {STATUS_LABEL[it.status] ?? it.status}
                      {it.autoUnpublishedAt && it.status === "UNPUBLISHED" ? "（自動下架）" : ""}
                    </span>
                  </span>
                </span>
                <button type="button" className="btn btn-sm flex-none bg-white" disabled={busyId === it.id} onClick={() => edit(it)}>
                  {it.milestoneId ? "編輯紀錄" : "轉成可編輯紀錄"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
