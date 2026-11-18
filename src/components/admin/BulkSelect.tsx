"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import { bulkAnnouncements, type BulkOp } from "@/app/admin/actions";
import { copyText, toast } from "@/components/Toaster";
import { buildDigest } from "@/lib/share";
import { ConfirmDialog } from "./ConfirmDialog";

type Ctx = {
  selected: Set<string>;
  ids: string[];
  setAll: (on: boolean) => void;
  /** 點選一列：shift＝從上次點的那列選到這列；其他情況只切換這一列 */
  pick: (id: string, on: boolean, shift: boolean) => void;
};
export type Digest = { start: number | null; text: string };
const BulkCtx = createContext<Ctx | null>(null);

const OPS: { op: BulkOp; label: string; done: string; ownerOnly?: boolean; danger?: boolean }[] = [
  { op: "publish", label: "發布", done: "發布" },
  { op: "unpublish", label: "下架", done: "下架" },
  { op: "archive", label: "封存", done: "封存" },
  { op: "draft", label: "移回草稿", done: "移回草稿" },
  { op: "delete", label: "刪除", done: "刪除", ownerOnly: true, danger: true },
];

/** 公告管理的批量操作：包住整個列表，每列有勾選框，選取後畫面下方出現操作列 */
export function BulkProvider({
  ids,
  isOwner,
  digests,
  baseUrl,
  children,
}: {
  ids: string[];
  isOwner: boolean;
  digests: Record<string, Digest>;
  baseUrl: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<(typeof OPS)[number] | null>(null);
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<string | null>(null);
  const anchor = useRef<string | null>(null);

  // 換頁或篩選後，只保留還在畫面上的勾選
  const key = ids.join(",");
  useEffect(() => setSelected((s) => new Set([...s].filter((id) => ids.includes(id)))), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (id: string, on: boolean, shift: boolean) => {
    const from = anchor.current ? ids.indexOf(anchor.current) : -1;
    const to = ids.indexOf(id);
    const range = shift && from >= 0 && to >= 0 ? ids.slice(Math.min(from, to), Math.max(from, to) + 1) : [id];
    setSelected((s) => {
      const n = new Set(s);
      for (const x of range) {
        if (on) n.add(x);
        else n.delete(x);
      }
      return n;
    });
    anchor.current = id;
  };

  const openDigest = () => {
    const list = ids.filter((id) => selected.has(id) && digests[id]).map((id) => digests[id]);
    setDraft(buildDigest(list, baseUrl));
  };
  const copyDigest = async () => {
    if (draft === null) return;
    if (await copyText(draft)) {
      toast("已複製活動整理文案", "success");
      setDraft(null);
    } else toast("複製失敗，請手動選取文字複製", "error");
  };
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
    <BulkCtx.Provider value={{ selected, ids, setAll, pick }}>
      {children}
      {selected.size > 0 && (
        <div role="region" aria-label="批量操作" className="sticky bottom-3 z-30 mt-3 flex flex-wrap items-center gap-2 border-2 border-ink bg-deep px-3 py-2.5 text-paper shadow-[4px_4px_0_var(--color-ink)]">
          <span className="mr-1 text-sm font-black">已選 {selected.size} 則</span>
          <button type="button" disabled={pending} onClick={openDigest} className="btn btn-sm btn-sun !shadow-none">複製文案</button>
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
      {draft !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-deep/60 p-4" role="dialog" aria-modal="true" aria-labelledby="digest-title" onClick={() => setDraft(null)}>
          <div className="flex max-h-[90dvh] w-full max-w-xl flex-col border-2 border-ink bg-paper p-5 shadow-[6px_6px_0_var(--color-ink)]" onClick={(e) => e.stopPropagation()}>
            <h2 id="digest-title" className="text-lg font-black">複製活動整理文案</h2>
            <p className="mt-1 text-sm text-muted">已依活動日期排序，可以先修改再複製，貼到 IG、LINE 群組都可以。</p>
            <textarea
              className="input mt-3 min-h-[18rem] flex-1 font-[inherit] text-sm leading-relaxed"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="活動整理文案"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn bg-white" onClick={() => setDraft(null)}>取消</button>
              <button type="button" className="btn btn-ink" onClick={copyDigest} autoFocus>複製</button>
            </div>
          </div>
        </div>
      )}
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
      onChange={() => {}}
      onClick={(e) => {
        e.stopPropagation();
        c.pick(id, e.currentTarget.checked, e.shiftKey);
      }}
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

/**
 * 公告列表的一列。除了勾選框，也可以直接點整列：
 * - Ctrl（Mac 用 ⌘）＋點：加選／取消這一列
 * - Shift＋點：從上次點的那列一路選到這列
 * - 已經有勾選時，單純點列的空白處也會切換勾選
 * 點到標題連結、按鈕等互動元件時不受影響。
 */
export function BulkRow({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const c = useContext(BulkCtx)!;
  const on = c.selected.has(id);
  return (
    <li
      className={className}
      onMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault(); // 避免 Shift＋點時反白一大段文字
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input, select, textarea, label, [role=menu]")) return;
        const mod = e.ctrlKey || e.metaKey;
        if (!mod && !e.shiftKey && c.selected.size === 0) return;
        if (window.getSelection()?.toString()) return; // 使用者正在選取文字
        c.pick(id, e.shiftKey ? true : !on, e.shiftKey);
      }}
    >
      {children}
    </li>
  );
}
