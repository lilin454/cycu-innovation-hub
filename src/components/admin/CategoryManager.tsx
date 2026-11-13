"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCategory, deleteCategory, reorderCategories, updateCategory } from "@/app/admin/actions";
import { KIND_LABEL, type KindKey } from "@/lib/constants";
import { toast } from "@/components/Toaster";
import { ConfirmDialog } from "./ConfirmDialog";

export type ManagedCategory = { id: string; kind: KindKey; name: string; color: string; count: number };

const SWATCHES = ["#0E3A66", "#D9501E", "#16898A", "#C98A06", "#55657A", "#7A3E9D", "#B42318", "#17794B"];

function ColorPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <span className="flex flex-wrap items-center gap-1" role="group" aria-label={label}>
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`顏色 ${c}`}
          aria-pressed={value.toLowerCase() === c.toLowerCase()}
          onClick={() => onChange(c)}
          className={`h-6 w-6 border-2 ${value.toLowerCase() === c.toLowerCase() ? "border-ink" : "border-white"} outline outline-1 outline-line`}
          style={{ background: c }}
        />
      ))}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-8 cursor-pointer border border-line bg-white p-0" aria-label="自訂顏色" />
    </span>
  );
}

function Group({ kind, items }: { kind: KindKey; items: ManagedCategory[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [editing, setEditing] = useState<{ id: string; name: string; color: string } | null>(null);
  const [toDelete, setToDelete] = useState<ManagedCategory | null>(null);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, okMessage: string, done?: () => void) =>
    start(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          toast(res.error ?? "操作失敗。", "error");
          return;
        }
        toast(okMessage);
        done?.();
        router.refresh();
      } catch {
        toast("網路連線錯誤，請稍後再試。", "error");
      }
    });

  const moveItem = (index: number, dir: -1 | 1) => {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    act(() => reorderCategories(next.map((c) => c.id)), "順序已更新");
  };

  const askDelete = (c: ManagedCategory) => {
    if (c.count > 0) {
      setToDelete(c);
      return;
    }
    act(async () => {
      const res = await deleteCategory(c.id, false);
      if (res.ok && !res.deleted) {
        setToDelete({ ...c, count: res.inUse });
        return { ok: false, error: "這個分類已被公告使用，請再次確認。" };
      }
      return res;
    }, `已刪除「${c.name}」`);
  };

  return (
    <section className="panel" aria-labelledby={`kind-${kind}`}>
      <header className="flex items-baseline justify-between border-b-2 border-ink bg-paper-2 px-4 py-2.5">
        <h2 id={`kind-${kind}`} className="text-lg font-black">{KIND_LABEL[kind]}</h2>
        <span className="text-xs text-muted">{items.length} 個</span>
      </header>

      <ul>
        {items.length === 0 && <li className="p-5 text-center text-sm text-muted">尚未建立。</li>}
        {items.map((c, i) => (
          <li key={c.id} className="border-b border-line px-3 py-2.5">
            {editing?.id === c.id ? (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  act(() => updateCategory(c.id, { kind, name: editing.name, color: editing.color }), "分類已更新", () => setEditing(null));
                }}
              >
                <input className="input !min-h-9" value={editing.name} maxLength={20} autoFocus aria-label="分類名稱" onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <ColorPicker value={editing.color} onChange={(v) => setEditing({ ...editing, color: v })} label="標籤顏色" />
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-sm btn-ink" disabled={pending}>儲存</button>
                  <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>取消</button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 flex-none border border-ink/20" style={{ background: c.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="font-bold">{c.name}</span>
                  <span className="ml-2 text-xs text-muted">{c.count > 0 ? `${c.count} 則公告使用中` : "未使用"}</span>
                </span>
                {kind !== "TAG" && (
                  <>
                    <button type="button" className="btn btn-sm !min-w-8 !px-1.5" disabled={pending || i === 0} aria-label={`將 ${c.name} 上移`} onClick={() => moveItem(i, -1)}>↑</button>
                    <button type="button" className="btn btn-sm !min-w-8 !px-1.5" disabled={pending || i === items.length - 1} aria-label={`將 ${c.name} 下移`} onClick={() => moveItem(i, 1)}>↓</button>
                  </>
                )}
                <button type="button" className="btn btn-sm" disabled={pending} onClick={() => setEditing({ id: c.id, name: c.name, color: c.color })}>編輯</button>
                <button type="button" className="btn btn-sm btn-danger" disabled={pending} onClick={() => askDelete(c)}>刪除</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <form
        className="space-y-2 bg-paper-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            toast("請填寫名稱。", "error");
            return;
          }
          act(() => createCategory({ kind, name, color }), `已新增「${name.trim()}」`, () => setName(""));
        }}
      >
        <p className="text-sm font-black">新增{KIND_LABEL[kind]}</p>
        <div className="flex gap-2">
          <input className="input !min-h-9" value={name} maxLength={20} placeholder="名稱" aria-label={`新的${KIND_LABEL[kind]}名稱`} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn btn-sm btn-ink flex-none" disabled={pending}>新增</button>
        </div>
        <ColorPicker value={color} onChange={setColor} label="標籤顏色" />
      </form>

      <ConfirmDialog
        open={toDelete !== null}
        title={`「${toDelete?.name ?? ""}」正在被使用`}
        confirmLabel="仍要刪除"
        danger
        busy={pending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const c = toDelete;
          if (!c) return;
          act(() => deleteCategory(c.id, true), `已刪除「${c.name}」`, () => setToDelete(null));
        }}
      >
        <p>目前有 <b>{toDelete?.count}</b> 則公告使用這個分類。</p>
        <p className="mt-2">刪除後，這些公告<b>仍會保留</b>，只是不再帶有這個標籤，也無法再用它篩選。如果只是想改名字，請改用「編輯」。</p>
      </ConfirmDialog>
    </section>
  );
}

export function CategoryManager({ categories }: { categories: ManagedCategory[] }) {
  const by = (k: KindKey) => categories.filter((c) => c.kind === k);
  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
      <Group kind="SOURCE" items={by("SOURCE")} />
      <Group kind="EVENT_TYPE" items={by("EVENT_TYPE")} />
      <div className="lg:col-span-2">
        <Group kind="TAG" items={by("TAG")} />
      </div>
    </div>
  );
}
