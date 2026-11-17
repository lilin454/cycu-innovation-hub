"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteSurveyResponse } from "@/app/admin/actions";
import { formatDateTime } from "@/lib/format";
import { answerText, SURVEY_TYPE_LABEL, type SurveyQuestion, type SurveyResponse } from "@/lib/survey";
import { copyWithToast, toast } from "@/components/Toaster";
import { ConfirmDialog } from "./ConfirmDialog";

type Filter = { qid: string; value: string } | null;

const matches = (r: SurveyResponse, f: Filter) => {
  if (!f) return true;
  const v = r.answers[f.qid];
  return Array.isArray(v) ? v.includes(f.value) : v === f.value;
};

export function SurveyResponses({ title, questions, responses }: { title: string; questions: SurveyQuestion[]; responses: SurveyResponse[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(null);
  const [toDelete, setToDelete] = useState<SurveyResponse | null>(null);
  const [pending, start] = useTransition();

  // 題目被改過之後，舊回覆可能有已經不存在的題目；仍然要在表格與 CSV 裡看得到
  const columns = useMemo(() => {
    const known = new Set(questions.map((q) => q.id));
    const extra = [...new Set(responses.flatMap((r) => Object.keys(r.answers)))].filter((k) => !known.has(k));
    return [...questions.map((q) => ({ id: q.id, title: q.title })), ...extra.map((k) => ({ id: k, title: `（已刪除的題目 ${k}）` }))];
  }, [questions, responses]);

  const stats = questions
    .filter((q) => q.type === "single" || q.type === "multi" || q.type === "scale")
    .map((q) => {
      const values = q.type === "scale" ? ["1", "2", "3", "4", "5"] : q.options;
      // 選項改名後，舊回覆的答案也要算進來
      const seen = responses.flatMap((r) => {
        const v = r.answers[q.id];
        return v === undefined ? [] : Array.isArray(v) ? v : [v];
      });
      const all = [...new Set([...values, ...seen])];
      const counts = all.map((v) => ({ value: v, n: seen.filter((x) => x === v).length }));
      const answered = responses.filter((r) => r.answers[q.id] !== undefined).length;
      const avg = q.type === "scale" && seen.length ? seen.reduce((s, x) => s + Number(x), 0) / seen.length : null;
      return { q, counts, answered, avg };
    });

  const shown = responses.filter((r) => matches(r, filter));
  const label = (r: SurveyResponse) => {
    const extra = questions
      .filter((q) => q.type === "short" && q.role !== "name")
      .map((q) => answerText(r.answers[q.id]))
      .filter(Boolean);
    return extra.length ? `${r.name}（${extra.join("，")}）` : r.name;
  };

  const asText = () => {
    const lines = [`${title}｜問卷回覆（共 ${responses.length} 筆）`, ""];
    const group = questions.find((q) => q.type === "single");
    if (group) {
      lines.push(`依「${group.title}」分組`, "");
      const values = [...new Set([...group.options, ...responses.map((r) => answerText(r.answers[group.id])).filter(Boolean)])];
      for (const v of values) {
        const names = responses.filter((r) => r.answers[group.id] === v).map(label);
        lines.push(`【${v}】${names.length} 人`, names.length ? names.join("、") : "（無）", "");
      }
    } else {
      lines.push(...responses.map(label));
    }
    return lines.join("\n").trim();
  };

  const downloadCsv = () => {
    const cell = (v: string) => `"${v.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;
    const rows = [
      [...columns.map((c) => c.title), "填寫時間"],
      ...responses.map((r) => [...columns.map((c) => answerText(r.answers[c.id])), formatDateTime(r.createdAt)]),
    ];
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
      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3 border-b-2 border-ink pb-4">
        <p>
          <span className="font-display text-5xl font-black leading-none">{responses.length}</span>
          <span className="ml-2 font-bold">筆回覆</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm bg-white" disabled={!responses.length} onClick={() => copyWithToast(asText(), "已複製名單")}>複製名單文字</button>
          <button type="button" className="btn btn-sm bg-white" disabled={!responses.length} onClick={downloadCsv}>下載 CSV（Excel）</button>
          <button type="button" className="btn btn-sm bg-white" onClick={() => router.refresh()}>重新整理</button>
        </div>
      </div>

      {stats.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {stats.map(({ q, counts, answered, avg }) => {
            const max = Math.max(1, ...counts.map((c) => c.n));
            return (
              <section key={q.id} className="panel min-w-0">
                <header className="border-b-2 border-ink bg-paper-2 px-4 py-2.5">
                  <h2 className="font-black leading-snug">{q.title}</h2>
                  <p className="text-xs text-muted">
                    {SURVEY_TYPE_LABEL[q.type]}・{answered} 人作答
                    {avg !== null && <>・平均 <b className="text-ink">{avg.toFixed(2)}</b> 分</>}
                  </p>
                </header>
                <ul className="space-y-1 p-3">
                  {counts.map(({ value, n }) => {
                    const active = filter?.qid === q.id && filter.value === value;
                    return (
                      <li key={value}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setFilter(active ? null : { qid: q.id, value })}
                          className={`grid w-full grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3 px-2 py-1.5 text-left text-sm hover:bg-sun-soft ${active ? "bg-sun" : ""}`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-bold">
                              {q.type === "scale"
                                ? `${value} 分${value === "1" && q.scaleMin ? `（${q.scaleMin}）` : ""}${value === "5" && q.scaleMax ? `（${q.scaleMax}）` : ""}`
                                : value}
                            </span>
                            <span className="mt-1 block h-1.5 bg-paper-2">
                              <span className="block h-full bg-ink" style={{ width: `${(n / max) * 100}%` }} />
                            </span>
                          </span>
                          <span className="text-right font-display text-lg font-black">{n}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <section className="panel mt-6">
        <h2 className="flex flex-wrap items-center gap-2 border-b-2 border-ink bg-paper-2 px-4 py-2.5 font-black">
          {filter ? (
            <>
              <span>
                「{questions.find((q) => q.id === filter.qid)?.title}」回答「{filter.value}」的人（{shown.length}）
              </span>
              <button type="button" className="text-sm font-bold underline underline-offset-4" onClick={() => setFilter(null)}>顯示全部</button>
            </>
          ) : (
            `所有回覆（${shown.length}）`
          )}
        </h2>
        {shown.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">{responses.length ? "沒有符合的回覆。" : "還沒有人填寫。把活動連結傳出去，回覆就會出現在這裡。"}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b-2 border-ink">
                <tr>
                  {columns.map((c) => (
                    <th key={c.id} scope="col" className="max-w-[16rem] px-3 py-2 align-bottom font-black">{c.title}</th>
                  ))}
                  <th scope="col" className="px-3 py-2 align-bottom font-black">填寫時間</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">操作</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b border-line align-top last:border-b-0">
                    {columns.map((c) => (
                      <td key={c.id} className="max-w-[16rem] whitespace-pre-wrap break-words px-3 py-2">{answerText(r.answers[c.id]) || <span className="text-muted">—</span>}</td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{formatDateTime(r.createdAt)}</td>
                    <td className="px-3 py-2">
                      <button type="button" className="btn btn-sm btn-danger" disabled={pending} onClick={() => setToDelete(r)}>刪除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        <p>「{toDelete?.name}」的回覆會被刪除，無法復原。</p>
      </ConfirmDialog>
    </>
  );
}
