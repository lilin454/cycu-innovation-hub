"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { deleteOfficer, deleteOrg, reorderItems, saveOfficer, saveOrg, setPlacement } from "@/app/admin/actions";
import { IMAGE_ACCEPT } from "@/lib/constants";
import {
  ORG_KIND_LABEL,
  PLACEMENT_LABEL,
  PLACEMENTS,
  type Officer,
  type Org,
  type OrgKind,
  type Placement,
} from "@/lib/organization-types";
import { toast } from "@/components/Toaster";
import { ConfirmDialog } from "./ConfirmDialog";
import { uploadFile } from "./upload";

type Result = { ok: true } | { ok: false; error: string };

/** 共用：送出 server action，失敗顯示訊息，成功重新整理 */
function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const exec = (fn: () => Promise<Result>, okMsg?: string, after?: () => void) =>
    start(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          toast(res.error, "error");
          return;
        }
        if (okMsg) toast(okMsg);
        after?.();
        router.refresh();
      } catch {
        toast("網路連線錯誤，請稍後再試。", "error");
      }
    });
  return { pending, exec };
}

function ImagePicker({ value, onChange, label, round }: { value: string; onChange: (v: string) => void; label: string; round?: boolean }) {
  const [uploading, setUploading] = useState(false);
  const onFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      onChange((await uploadFile(file, "image")).url);
    } catch (e) {
      toast(e instanceof Error ? e.message : "上傳失敗。", "error");
    } finally {
      setUploading(false);
    }
  };
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`flex h-20 w-28 flex-none items-center justify-center border-2 border-ink bg-white ${round ? "w-20 overflow-hidden rounded-full" : ""}`}>
          {value ? (
            <img src={value} alt="預覽" className={round ? "h-full w-full object-cover" : "max-h-16 max-w-24 object-contain"} />
          ) : (
            <span className="text-xs text-muted">尚未上傳</span>
          )}
        </span>
        <label className="btn btn-sm cursor-pointer bg-white">
          {uploading ? "上傳中…" : value ? "更換" : "上傳圖片"}
          <input type="file" accept={IMAGE_ACCEPT} hidden disabled={uploading} onChange={(e) => { void onFile(e.target.files); e.target.value = ""; }} />
        </label>
        {value && <button type="button" className="btn btn-sm" onClick={() => onChange("")}>移除</button>}
      </div>
    </div>
  );
}

function MoveButtons({ index, total, onMove, disabled }: { index: number; total: number; onMove: (to: number) => void; disabled: boolean }) {
  return (
    <span className="flex gap-1">
      <button type="button" className="btn btn-sm bg-white !px-2" aria-label="往前移" disabled={disabled || index === 0} onClick={() => onMove(index - 1)}>↑</button>
      <button type="button" className="btn btn-sm bg-white !px-2" aria-label="往後移" disabled={disabled || index === total - 1} onClick={() => onMove(index + 1)}>↓</button>
    </span>
  );
}

function moved<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

// ───────────────────────── 幹部 ─────────────────────────

type OfficerDraft = { id: string | null; role: string; name: string; photoUrl: string };

export function OfficerManager({ items }: { items: Officer[] }) {
  const { pending, exec } = useRun();
  const [list, setList] = useState(items);
  const [draft, setDraft] = useState<OfficerDraft | null>(null);
  const [toDelete, setToDelete] = useState<Officer | null>(null);
  useEffect(() => setList(items), [items]);

  const move = (from: number, to: number) => {
    const next = moved(list, from, to);
    setList(next);
    exec(() => reorderItems("Officer", next.map((o) => o.id)));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const { id, ...data } = draft;
    exec(() => saveOfficer(id, data), id ? "已更新" : "已新增幹部", () => setDraft(null));
  };

  return (
    <section className="panel mt-6" aria-labelledby="officer-title">
      <header className="flex flex-wrap items-center gap-3 border-b-2 border-ink bg-paper-2 px-4 py-2.5">
        <h2 id="officer-title" className="font-black">幹部名單</h2>
        <span className="text-sm text-muted">顯示在「關於創創社」，依照這裡的順序排列</span>
        {!draft && (
          <button type="button" className="btn btn-sm btn-ink ml-auto" onClick={() => setDraft({ id: null, role: "", name: "", photoUrl: "" })}>＋ 新增幹部</button>
        )}
      </header>

      {draft && (
        <form onSubmit={submit} className="space-y-4 border-b-2 border-ink bg-sun-soft/40 p-4 md:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">職稱<span className="ml-1 text-danger" aria-hidden>*</span></span>
              <input className="input" maxLength={20} required autoFocus placeholder="例如：社長、副社長、活動長、公關" list="officer-roles" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
              <datalist id="officer-roles">
                {["社長", "副社長", "執行長", "活動長", "公關長", "美宣長", "財務長", "文書長", "器材長", "指導老師"].map((r) => <option key={r} value={r} />)}
              </datalist>
            </label>
            <label className="block">
              <span className="field-label">姓名<span className="ml-1 text-danger" aria-hidden>*</span></span>
              <input className="input" maxLength={40} required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
          </div>
          <ImagePicker label="大頭照（選填）" round value={draft.photoUrl} onChange={(v) => setDraft({ ...draft, photoUrl: v })} />
          <p className="field-hint !mt-0">姓名與照片會公開在網站上，請先取得本人同意。</p>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-ink" disabled={pending}>{pending ? "儲存中…" : "儲存"}</button>
            <button type="button" className="btn" disabled={pending} onClick={() => setDraft(null)}>取消</button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">還沒有幹部。按「新增幹部」加入第一位。</p>
      ) : (
        <ul>
          {list.map((o, i) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <MoveButtons index={i} total={list.length} disabled={pending} onMove={(to) => move(i, to)} />
              {o.photoUrl ? (
                <img src={o.photoUrl} alt="" className="h-10 w-10 flex-none rounded-full border-2 border-ink object-cover" />
              ) : (
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border-2 border-ink bg-paper-2 font-black">{o.name.slice(0, 1)}</span>
              )}
              <span className="min-w-[8rem] flex-1">
                <span className="mr-2 bg-ink px-1.5 py-0.5 text-xs font-bold text-sun">{o.role}</span>
                <span className="font-bold">{o.name}</span>
              </span>
              <span className="flex gap-1.5">
                <button type="button" className="btn btn-sm bg-white" disabled={pending} onClick={() => setDraft({ id: o.id, role: o.role, name: o.name, photoUrl: o.photoUrl ?? "" })}>編輯</button>
                <button type="button" className="btn btn-sm btn-danger" disabled={pending} onClick={() => setToDelete(o)}>刪除</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={`確定要移除「${toDelete?.role} ${toDelete?.name}」嗎？`}
        confirmLabel="移除"
        danger
        busy={pending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && exec(() => deleteOfficer(toDelete.id), "已移除", () => setToDelete(null))}
      >
        移除後關於頁就不會再顯示這位幹部。
      </ConfirmDialog>
    </section>
  );
}

// ───────────────────────── 合作單位 / 活動資訊來源 ─────────────────────────

type OrgDraft = { id: string | null; name: string; logoUrl: string; linkUrl: string };

export function OrgManager({
  kind,
  items,
  placement,
  sourceLinks,
}: {
  kind: OrgKind;
  items: Org[];
  placement: Placement;
  sourceLinks: { name: string; href: string }[];
}) {
  const { pending, exec } = useRun();
  const [list, setList] = useState(items);
  const [draft, setDraft] = useState<OrgDraft | null>(null);
  const [toDelete, setToDelete] = useState<Org | null>(null);
  const [place, setPlace] = useState(placement);
  useEffect(() => setList(items), [items]);
  useEffect(() => setPlace(placement), [placement]);
  const label = ORG_KIND_LABEL[kind];
  const listId = `links-${kind}`;

  const move = (from: number, to: number) => {
    const next = moved(list, from, to);
    setList(next);
    exec(() => reorderItems("Organization", next.map((o) => o.id)));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const { id, ...data } = draft;
    exec(() => saveOrg(id, { kind, ...data }), id ? "已更新" : `已新增${label}`, () => setDraft(null));
  };

  return (
    <section className="panel mt-6" aria-labelledby={`org-${kind}`}>
      <header className="flex flex-wrap items-center gap-3 border-b-2 border-ink bg-paper-2 px-4 py-2.5">
        <h2 id={`org-${kind}`} className="font-black">{label}</h2>
        <span className="text-sm text-muted">{list.length} 個</span>
        {!draft && (
          <button type="button" className="btn btn-sm btn-ink ml-auto" onClick={() => setDraft({ id: null, name: "", logoUrl: "", linkUrl: "" })}>＋ 新增{label}</button>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <span className="text-sm font-bold">顯示位置</span>
        {PLACEMENTS.map((p) => (
          <label key={p} className="flex cursor-pointer items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={`place-${kind}`}
              className="h-4 w-4 accent-[#0b2a4a]"
              checked={place === p}
              disabled={pending}
              onChange={() => {
                setPlace(p);
                exec(() => setPlacement(kind === "PARTNER" ? "partnersPlacement" : "sourcesPlacement", p), "顯示位置已更新");
              }}
            />
            {PLACEMENT_LABEL[p]}
          </label>
        ))}
      </div>

      {draft && (
        <form onSubmit={submit} className="space-y-4 border-b-2 border-ink bg-sun-soft/40 p-4 md:p-5">
          <label className="block">
            <span className="field-label">名稱<span className="ml-1 text-danger" aria-hidden>*</span></span>
            <input className="input" maxLength={60} required autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <ImagePicker label="Logo（建議去背 PNG，橫式或正方形都可以）" value={draft.logoUrl} onChange={(v) => setDraft({ ...draft, logoUrl: v })} />
          <label className="block">
            <span className="field-label">連結（選填）</span>
            <input className="input" maxLength={500} placeholder="https://… 或 /announcements?source=…" list={listId} value={draft.linkUrl} onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })} />
            <datalist id={listId}>
              {sourceLinks.map((s) => <option key={s.href} value={s.href}>{`本站「${s.name}」的公告`}</option>)}
            </datalist>
            <span className="field-hint block">
              可以填對方的網站，或點輸入框從清單選「本站某個來源的公告」。外部網址會在新分頁開啟。
            </span>
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-ink" disabled={pending}>{pending ? "儲存中…" : "儲存"}</button>
            <button type="button" className="btn" disabled={pending} onClick={() => setDraft(null)}>取消</button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">還沒有{label}。</p>
      ) : (
        <ul>
          {list.map((o, i) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <MoveButtons index={i} total={list.length} disabled={pending} onMove={(to) => move(i, to)} />
              <span className="flex h-12 w-20 flex-none items-center justify-center border-2 border-line bg-white">
                {o.logoUrl ? <img src={o.logoUrl} alt="" className="max-h-10 max-w-[4.5rem] object-contain" /> : <span className="text-[0.65rem] text-muted">無 Logo</span>}
              </span>
              <span className="min-w-[10rem] flex-1">
                <span className="block font-bold leading-snug">{o.name}</span>
                {o.linkUrl && <span className="block max-w-full truncate text-xs text-muted">{o.linkUrl}</span>}
              </span>
              <span className="flex gap-1.5">
                <button type="button" className="btn btn-sm bg-white" disabled={pending} onClick={() => setDraft({ id: o.id, name: o.name, logoUrl: o.logoUrl ?? "", linkUrl: o.linkUrl ?? "" })}>編輯</button>
                <button type="button" className="btn btn-sm btn-danger" disabled={pending} onClick={() => setToDelete(o)}>刪除</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={`確定要刪除「${toDelete?.name}」嗎？`}
        confirmLabel="刪除"
        danger
        busy={pending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && exec(() => deleteOrg(toDelete.id), "已刪除", () => setToDelete(null))}
      >
        刪除後前台就不會再顯示。不會影響已經發布的公告。
      </ConfirmDialog>
    </section>
  );
}
