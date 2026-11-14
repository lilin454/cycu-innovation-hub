"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createUser, deleteUser, resetUserPassword, updateUser } from "@/app/admin/actions";
import { toast } from "@/components/Toaster";
import { ConfirmDialog } from "./ConfirmDialog";

type Role = "OWNER" | "EDITOR";
export type ManagedUser = { id: string; account: string; displayName: string; role: Role; createdAt: string; isMe: boolean };

const ROLE_LABEL: Record<Role, string> = { OWNER: "總管理員", EDITOR: "一般管理員" };

export function UserManager({ users }: { users: ManagedUser[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState({ account: "", displayName: "", password: "", role: "EDITOR" as Role });
  const [showPw, setShowPw] = useState(false);
  const [editing, setEditing] = useState<{ id: string; displayName: string; role: Role } | null>(null);
  const [resetting, setResetting] = useState<{ id: string; account: string; password: string } | null>(null);
  const [toDelete, setToDelete] = useState<ManagedUser | null>(null);

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

  return (
    <>
      <section className="panel mt-6">
        <h2 className="border-b-2 border-ink bg-paper-2 px-4 py-2.5 font-black">目前的管理員（{users.length}）</h2>
        <ul>
          {users.map((u) => (
            <li key={u.id} className="border-b border-line px-4 py-3 last:border-b-0">
              {editing?.id === u.id ? (
                <form
                  className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(() => updateUser(u.id, { displayName: editing.displayName, role: editing.role }), "帳號已更新", () => setEditing(null));
                  }}
                >
                  <label className="block">
                    <span className="field-label">顯示名稱</span>
                    <input className="input" maxLength={40} required value={editing.displayName} onChange={(e) => setEditing({ ...editing, displayName: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="field-label">權限</span>
                    <select className="input" value={editing.role} disabled={u.isMe} onChange={(e) => setEditing({ ...editing, role: e.target.value as Role })}>
                      <option value="EDITOR">一般管理員</option>
                      <option value="OWNER">總管理員</option>
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" className="btn btn-sm btn-ink" disabled={pending}>儲存</button>
                    <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>取消</button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-[10rem] flex-1">
                    <p className="font-bold">
                      {u.displayName}
                      {u.isMe && <span className="ml-2 bg-sun px-1.5 text-xs text-deep">你自己</span>}
                    </p>
                    <p className="font-mono text-xs text-muted">{u.account}・建立於 {u.createdAt}</p>
                  </div>
                  <span className={`border-[1.5px] px-2 py-0.5 text-xs font-bold ${u.role === "OWNER" ? "border-ink bg-ink text-paper" : "border-muted text-muted"}`}>
                    {ROLE_LABEL[u.role]}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className="btn btn-sm" disabled={pending} onClick={() => setEditing({ id: u.id, displayName: u.displayName, role: u.role })}>編輯</button>
                    <button type="button" className="btn btn-sm" disabled={pending} onClick={() => setResetting({ id: u.id, account: u.account, password: "" })}>重設密碼</button>
                    {!u.isMe && (
                      <button type="button" className="btn btn-sm btn-danger" disabled={pending} onClick={() => setToDelete(u)}>刪除</button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <form
        className="panel mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          act(() => createUser(draft), `已新增管理員「${draft.account.trim().toLowerCase()}」`, () =>
            setDraft({ account: "", displayName: "", password: "", role: "EDITOR" }),
          );
        }}
      >
        <h2 className="border-b-2 border-ink bg-paper-2 px-4 py-2.5 font-black">新增管理員</h2>
        <div className="grid gap-4 p-4 sm:grid-cols-2 md:p-6">
          <label className="block">
            <span className="field-label">帳號</span>
            <input className="input font-mono" required minLength={3} maxLength={64} autoCapitalize="none" spellCheck={false} autoComplete="off" value={draft.account} onChange={(e) => setDraft({ ...draft, account: e.target.value })} />
            <span className="field-hint block">英文小寫、數字或 . _ -，3 個字元以上</span>
          </label>
          <label className="block">
            <span className="field-label">顯示名稱</span>
            <input className="input" required maxLength={40} placeholder="例如：活動組 小明" value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} />
          </label>
          <label className="block">
            <span className="field-label">密碼</span>
            <span className="flex items-stretch">
              <input className="input !border-r-0" type={showPw ? "text" : "password"} required minLength={10} maxLength={200} autoComplete="new-password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
              <button type="button" className="flex-none border-[1.5px] border-[#9aa7b6] bg-paper-2 px-3 text-sm font-bold" aria-pressed={showPw} onClick={() => setShowPw((v) => !v)}>
                {showPw ? "隱藏" : "顯示"}
              </button>
            </span>
            <span className="field-hint block">至少 10 個字元。請用安全的方式把密碼交給對方，並請對方登入後自行修改。</span>
          </label>
          <label className="block">
            <span className="field-label">權限</span>
            <select className="input" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>
              <option value="EDITOR">一般管理員（只能管理公告）</option>
              <option value="OWNER">總管理員（所有功能）</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-ink" disabled={pending}>{pending ? "處理中…" : "新增管理員"}</button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={resetting !== null}
        title={`重設「${resetting?.account ?? ""}」的密碼`}
        confirmLabel="重設密碼"
        busy={pending}
        onCancel={() => setResetting(null)}
        onConfirm={() => {
          const r = resetting;
          if (!r) return;
          act(() => resetUserPassword(r.id, r.password), "密碼已重設，該帳號已從所有裝置登出", () => setResetting(null));
        }}
      >
        <label className="block">
          <span className="field-label">新密碼（至少 10 個字元）</span>
          <input className="input" type="text" autoComplete="off" minLength={10} maxLength={200} value={resetting?.password ?? ""} onChange={(e) => resetting && setResetting({ ...resetting, password: e.target.value })} />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={toDelete !== null}
        title={`確定要刪除「${toDelete?.displayName ?? ""}」嗎？`}
        confirmLabel="刪除帳號"
        danger
        busy={pending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const u = toDelete;
          if (!u) return;
          act(() => deleteUser(u.id), `已刪除帳號「${u.account}」`, () => setToDelete(null));
        }}
      >
        <p>帳號 <b className="font-mono">{toDelete?.account}</b> 將無法再登入後台。這個帳號建立過的公告不會受影響。</p>
      </ConfirmDialog>
    </>
  );
}
