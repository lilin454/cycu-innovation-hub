"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { bulkAnnouncements, type BulkOp } from "@/app/admin/actions";
import { toast } from "@/components/Toaster";
import { ConfirmDialog } from "./ConfirmDialog";

type Ctx = { selected: Set<string>; toggle: (id: string, on: boolean) => void; ids: string[]; setAll: (on: boolean) => void };
const BulkCtx = createContext<Ctx | null>(null);

const OPS: { op: BulkOp; label: string; done: string; ownerOnly?: boolean; danger?: boolean }[] = [
  { op: "publish", label: "發布", done: "發布" },
  { op: "unpublish", label: "下架", done: "下架" },
  { op: "archive", label: "封存", done: "封存" },
  { op: "draft", label: "移回草稿", done: "移回草稿" },
  { op: "delete", label: "刪除", done: "刪除", ownerOnly: true, danger: true },
];

/** 公告管理的批量操作：包住整個列表，每列有勾選框，選取後畫面下方出現操作列 */
export function BulkProvider({ ids, isOwner, children }: { ids: string[]; isOwner: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<(typeof OPS)[number] | null>(null);
  const [pending, start] = useTransition();

  // 換頁或篩選後，只保留還在畫面上的勾選
  const key = ids.join(",");
  useEffect(() => setSelected((s) => new Set([...s].filter((id) => ids.includes(id)))), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const setAll = (on: boolean) => setSelected(on ? new Set(ids) : new Set());

  const runOp = (o: (typeof OPS)[number]) => {
    const list = [...selected];
    start(async () => {
      try {
        const res = await bulkAnnouncements(list, o.op);
        if (!res.ok) {
          toast(res.error, "error");
          return;
        }
        toast(res.skipped ? `已${o.done} ${res.count} 則；${res.skipped} 則略過：${res.note}` : `已${o.done} ${res.count} 則公告`, res.skipped ? "info" : "success");
        setSelected(new Set());
        setConfirm(null);
        router.refresh();
      } catch {
        toast("網路連線錯誤，請稍後再試。", "error");
      }
    });
  };

  const ops = OPS.filter((o) => isOwner || !o.ownerOnly);
  return (
    <BulkCtx.Provider value={{ selected, toggle, ids, setAll }}>
      {children}
      {selected.size > 0 && (
        <div role="region" aria-label="批量操作" className="sticky bottom-3 z-30 mt-3 flex flex-wrap items-center gap-2 border-2 border-ink bg-deep px-3 py-2.5 text-paper shadow-[4px_4px_0_var(--color-ink)]">
          <span className="mr-1 text-sm font-black">已選 {selected.size} 則</span>
          {ops.map((o) => (
            <button
              key={o.op}
              type="button"
              disabled={pending}
              onClick={() => setConfirm(o)}
              className={`btn btn-sm !shadow-none ${o.danger ? "border-white bg-danger text-white" : "bg-white text-ink"}`}
            >
              {o.label}
            </button>
          ))}
          <button type="button" className="ml-auto text-sm font-bold underline" disabled={pending} onClick={() => setSelected(new Set())}>取消選取</button>
        </div>
      )}
      <ConfirmDialog
        open={confirm !== null}
        title={`確定要${confirm?.label}這 ${selected.size} 則公告嗎？`}
        confirmLabel={pending ? "處理中…" : confirm?.danger ? "永久刪除" : `確定${confirm?.label ?? ""}`}
        danger={confirm?.danger}
        busy={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && runOp(confirm)}
      >
        {confirm?.op === "delete" ? (
          <p>選取的公告以及它們的圖片、附件、問卷回覆都會被永久刪除，<b>無法復原</b>。只是暫時不公開的話，建議改用「下架」或「封存」。</p>
        ) : confirm?.op === "publish" ? (
          <p>已經結束、發布後會立刻被自動下架的活動會改成「不要自動下架」再發布。排程中的公告會改為立即發布。</p>
        ) : (
          <p>之後可以隨時再改回來。</p>
        )}
      </ConfirmDialog>
    </BulkCtx.Provider>
  );
}

export function RowCheck({ id, title }: { id: string; title: string }) {
  const c = useContext(BulkCtx)!;
  return (
    <input
      type="checkbox"
      className="h-5 w-5 flex-none cursor-pointer accent-[#0b2a4a]"
      aria-label={`選取「${title}」`}
      checked={c.selected.has(id)}
      onChange={(e) => c.toggle(id, e.target.checked)}
    />
  );
}

export function SelectAll() {
  const c = useContext(BulkCtx)!;
  const all = c.ids.length > 0 && c.ids.every((id) => c.selected.has(id));
  const some = !all && c.ids.some((id) => c.selected.has(id));
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs font-black">
      <input
        type="checkbox"
        className="h-5 w-5 cursor-pointer accent-[#0b2a4a]"
        aria-label="全選這一頁"
        checked={all}
        ref={(el) => {
          if (el) el.indeterminate = some;
        }}
        onChange={(e) => c.setAll(e.target.checked)}
      />
      <span className="xl:sr-only">全選這一頁</span>
    </label>
  );
}
