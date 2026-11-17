"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createAiToken, revokeAiToken } from "@/app/admin/actions";
import type { ApiTokenRow } from "@/lib/api-token";
import { toast } from "@/components/Toaster";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "short", timeStyle: "short", hour12: false }) : "—";

async function copy(text: string, ok: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(ok);
  } catch {
    toast("複製失敗，請手動選取文字複製。", "error");
  }
}

export function AiTokenManager({ tokens }: { tokens: ApiTokenRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [canPublish, setCanPublish] = useState(false);
  const [days, setDays] = useState(30);
  const [created, setCreated] = useState<string | null>(null);
  const now = new Date().toISOString();

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      try {
        const res = await createAiToken({ name, canPublish, days });
        if (!res.ok) return void toast(res.error, "error");
        setCreated(res.token);
        setName("");
        router.refresh();
      } catch {
        toast("網路連線錯誤，請稍後再試。", "error");
      }
    });
  };

  const revoke = (id: string) =>
    start(async () => {
      try {
        const res = await revokeAiToken(id);
        if (!res.ok) return void toast(res.error, "error");
        toast("金鑰已停用");
        router.refresh();
      } catch {
        toast("網路連線錯誤，請稍後再試。", "error");
      }
    });

  return (
    <section className="panel mt-6" aria-labelledby="token-title">
      <h2 id="token-title" className="border-b-2 border-ink bg-paper-2 px-4 py-2.5 font-black">API 金鑰</h2>

      {created && (
        <div className="border-b-2 border-ink bg-sun-soft p-4">
          <p className="font-bold">金鑰已建立，只會顯示這一次，請現在複製並妥善保存：</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all border-2 border-ink bg-white px-3 py-2 text-sm">{created}</code>
            <button type="button" className="btn btn-sm btn-ink" onClick={() => copy(created, "金鑰已複製")}>複製</button>
            <button type="button" className="btn btn-sm" onClick={() => setCreated(null)}>我已保存</button>
          </div>
          <p className="mt-2 text-xs text-muted">任何拿到這串金鑰的人都能以你的身分新增公告。外流或不再使用時，請立刻按「停用」。</p>
        </div>
      )}

      <form onSubmit={create} className="grid gap-4 border-b border-line p-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end">
        <label className="block">
          <span className="field-label">名稱</span>
          <input className="input" maxLength={40} required placeholder="例如：Claude 上架用" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">有效期限</span>
          <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 30, 90, 365].map((d) => <option key={d} value={d}>{d} 天</option>)}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm font-bold">
          <input type="checkbox" className="h-5 w-5 accent-[#0b2a4a]" checked={canPublish} onChange={(e) => setCanPublish(e.target.checked)} />
          允許直接發布
        </label>
        <button type="submit" className="btn btn-ink" disabled={pending}>{pending ? "建立中…" : "建立金鑰"}</button>
      </form>
      <p className="border-b border-line px-4 py-2 text-xs text-muted">
        沒勾「允許直接發布」的金鑰只能把公告存成草稿，需要你到「公告管理」確認後再發布（建議先用這種）。
      </p>

      {tokens.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">還沒有建立任何金鑰。</p>
      ) : (
        <ul>
          {tokens.map((t) => {
            const state = t.revokedAt ? "已停用" : t.expiresAt <= now ? "已過期" : "有效";
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-b-0">
                <span className="min-w-[12rem] flex-1">
                  <span className="block font-bold">
                    {t.name}
                    <code className="ml-2 text-xs font-normal text-muted">{t.prefix}…</code>
                  </span>
                  <span className="text-xs text-muted">
                    {t.canPublish ? "可直接發布" : "只能存草稿"}・建立 {fmt(t.createdAt)}・到期 {fmt(t.expiresAt)}・最後使用 {fmt(t.lastUsedAt)}
                  </span>
                </span>
                <span className={`border-[1.5px] px-2 py-0.5 text-xs font-bold ${state === "有效" ? "border-ok bg-ok text-white" : "border-muted text-muted"}`}>{state}</span>
                {state === "有效" && (
                  <button type="button" className="btn btn-sm btn-danger" disabled={pending} onClick={() => revoke(t.id)}>停用</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function PromptBox({ prompt }: { prompt: string }) {
  return (
    <section className="panel mt-6" aria-labelledby="prompt-title">
      <header className="flex flex-wrap items-center gap-3 border-b-2 border-ink bg-paper-2 px-4 py-2.5">
        <h2 id="prompt-title" className="font-black">給 AI 的提示詞</h2>
        <button type="button" className="btn btn-sm btn-ink ml-auto" onClick={() => copy(prompt, "提示詞已複製")}>複製提示詞</button>
      </header>
      <p className="border-b border-line px-4 py-2 text-xs text-muted">
        貼到 AI 工具的「系統提示詞／自訂指令」裡，再把上面的 API 金鑰另外設定成密鑰。之後只要把活動簡章、海報丟給它即可。
      </p>
      <textarea readOnly className="block h-96 w-full resize-y border-0 bg-white p-4 font-mono text-xs leading-relaxed" value={prompt} aria-label="提示詞內容" />
    </section>
  );
}
