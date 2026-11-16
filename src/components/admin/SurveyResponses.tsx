"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteSurveyResponse } from "@/app/admin/actions";
import { formatDateTime } from "@/lib/format";
import type { SurveyResponse } from "@/lib/survey";
import { copyWithToast, toast } from "@/components/Toaster";
import { ConfirmDialog } from "./ConfirmDialog";

export function SurveyResponses({ title, options, responses }: { title: string; options: string[]; responses: SurveyResponse[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SurveyResponse | null>(null);
  const [pending, start] = useTransition();

  // 選項被改過之後，舊回覆的答案可能不在目前的選項裡，仍然要列出來
  const answers = [...new Set([...options, ...responses.map((r) => r.answer)])];
  const count = (a: string) => responses.filter((r) => r.answer === a).length;
  const shown = filter ? responses.filter((r) => r.answer === filter) : responses;

  const asText = () => {
    const lines = [`${title}｜問卷回覆（共 ${responses.length} 筆）`, ""];
    for (const a of answers) {
      const names = responses.filter((r) => r.answer === a).map((r) => (r.note ? `${r.name}（${r.note}）` : r.name));
      lines.push(`【${a}】${names.length} 人`, names.length ? names.join("、") : "（無）", "");
    }
    return lines.join("\n").trim();
  };

  const downloadCsv = () => {
    const cell = (v: string) => `"${v.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;
    const rows = [["姓名", "回答", "備註", "填寫時間"], ...responses.map((r) => [r.name, r.answer, r.note ?? "", formatDateTime(r.createdAt)])];
    // 加上 BOM，Excel 才能正確顯示中文
    const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `問卷回覆-${title.slice(0, 30)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <ul className="mt-6 grid grid-cols-2 border-l-2 border-t-2 border-ink sm:grid-cols-4">
        <li className="border-b-2 border-r-2 border-ink bg-ink text-paper">
          <button type="button" className="block w-full p-4 text-left" aria-pressed={filter === null} onClick={() => setFilter(null)}>
            <span className="block font-display text-4xl font-black leading-none text-sun">{responses.length}</span>
            <span className="mt-2 block text-sm font-bold">全部回覆</span>
          </button>
        </li>
        {answers.map((a) => (
          <li key={a} className={`border-b-2 border-r-2 border-ink ${filter === a ? "bg-sun" : "bg-white"}`}>
            <button type="button" className="block w-full p-4 text-left hover:bg-sun-soft" aria-pressed={filter === a} onClick={() => setFilter(filter === a ? null : a)}>
              <span className="block font-display text-4xl font-black leading-none">{count(a)}</span>
              <span className="mt-2 block text-sm font-bold">{a}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm bg-white" disabled={!responses.length} onClick={() => copyWithToast(asText(), "已複製名單")}>複製名單文字</button>
        <button type="button" className="btn btn-sm bg-white" disabled={!responses.length} onClick={downloadCsv}>下載 CSV（Excel）</button>
        <button type="button" className="btn btn-sm bg-white" onClick={() => router.refresh()}>重新整理</button>
      </div>

      <section className="panel mt-4">
        <h2 className="border-b-2 border-ink bg-paper-2 px-4 py-2.5 font-black">
          {filter ? `回答「${filter}」的人（${shown.length}）` : `所有回覆（${shown.length}）`}
        </h2>
        {shown.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">{responses.length ? "這個選項還沒有人選。" : "還沒有人填寫。把活動連結傳出去，回覆就會出現在這裡。"}</p>
        ) : (
          <ul>
            {shown.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 last:border-b-0">
                <span className="min-w-[8rem] flex-1">
                  <span className="font-bold">{r.name}</span>
                  {r.note && <span className="ml-2 text-sm text-muted">{r.note}</span>}
                </span>
                <span className="tag tag-type">{r.answer}</span>
                <span className="text-xs text-muted">{formatDateTime(r.createdAt)}</span>
                <button type="button" className="btn btn-sm btn-danger" disabled={pending} onClick={() => setToDelete(r)}>刪除</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={toDelete !== null}
        title="刪除這筆回覆？"
        confirmLabel="刪除"
        danger
        busy={pending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const r = toDelete;
          if (!r) return;
          start(async () => {
            try {
              const res = await deleteSurveyResponse(r.id);
              if (!res.ok) {
                toast(res.error, "error");
                return;
              }
              toast("回覆已刪除");
              setToDelete(null);
              router.refresh();
            } catch {
              toast("網路連線錯誤，請稍後再試。", "error");
            }
          });
        }}
      >
        <p>「{toDelete?.name}」的回覆（{toDelete?.answer}）會被刪除，無法復原。</p>
      </ConfirmDialog>
    </>
  );
}
