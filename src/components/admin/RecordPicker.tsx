"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setShowInRecords } from "@/app/admin/actions";
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
        勾選後會以「活動成果・創創社」顯示在前台活動紀錄，內容使用公告的標題、日期、地點、摘要與封面。活動結束、下架或封存的公告都會列在這裡。
      </p>
      {shown.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">
          {onlyChecked ? "還沒有勾選任何活動。" : "目前還沒有已結束的活動。活動結束或下架後就會出現在這裡。"}
        </p>
      ) : (
        <ul>
          {shown.map((it) => (
            <li key={it.id} className="border-b border-line last:border-b-0">
              <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-sun-soft has-[:checked]:bg-sun-soft/60">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 flex-none accent-[#0b2a4a]"
                  checked={Boolean(checked[it.id])}
                  disabled={busyId === it.id}
                  onChange={(e) => toggle(it, e.target.checked)}
                />
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
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
