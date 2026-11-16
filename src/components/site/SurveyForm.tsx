"use client";

import { useState, useTransition } from "react";
import { submitSurvey } from "@/app/(site)/actions";
import { toast } from "@/components/Toaster";

/** 活動頁內的簡易問卷（例如是否出席）。回覆只有管理員看得到。 */
export function SurveyForm({
  announcementId,
  question,
  options,
  preview = false,
}: {
  announcementId: string;
  question: string;
  options: string[];
  preview?: boolean;
}) {
  const [name, setName] = useState("");
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [done, setDone] = useState<null | { answer: string; updated: boolean }>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) {
      toast("預覽模式不會真的送出。", "info");
      return;
    }
    if (name.trim().length < 2) {
      toast("請填寫姓名。", "error");
      return;
    }
    if (!answer) {
      toast("請選擇一個選項。", "error");
      return;
    }
    start(async () => {
      try {
        const res = await submitSurvey(announcementId, { name, answer, note, website });
        if (!res.ok) {
          toast(res.error, "error");
          return;
        }
        setDone({ answer, updated: res.updated });
        toast(res.updated ? "已更新你的回覆" : "已收到你的回覆");
      } catch {
        toast("網路連線錯誤，請稍後再試。", "error");
      }
    });
  };

  return (
    <section aria-labelledby="survey-title" className="mt-14 border-2 border-ink bg-white">
      <div className="flex items-center justify-between border-b-2 border-ink bg-sun px-4 py-2">
        <h2 id="survey-title" className="font-black">活動問卷</h2>
        <span className="eyebrow text-[0.6rem]">RSVP</span>
      </div>

      {done ? (
        <div className="p-5" role="status">
          <p className="text-lg font-black">謝謝，已收到你的回覆。</p>
          <p className="mt-1 text-muted">
            你的回答：<b className="text-ink">{done.answer}</b>
          </p>
          <button type="button" className="mt-4 text-sm font-bold underline underline-offset-4" onClick={() => setDone(null)}>
            修改回覆
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 p-5" noValidate>
          <fieldset>
            <legend className="text-lg font-black leading-snug">{question}</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {options.map((opt) => (
                <label
                  key={opt}
                  className="flex min-h-11 cursor-pointer items-center gap-2 border-2 border-line px-4 py-2 font-bold has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper"
                >
                  <input type="radio" name="survey-answer" className="sr-only" value={opt} checked={answer === opt} onChange={() => setAnswer(opt)} />
                  {opt}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">姓名<span className="ml-1 text-danger" aria-hidden>*</span></span>
              <input className="input" value={name} maxLength={40} required autoComplete="name" onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block">
              <span className="field-label">系級／備註（選填）</span>
              <input className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>

          {/* 防機器人用的隱藏欄位，一般使用者看不到也不需要填 */}
          <div className="hidden" aria-hidden>
            <label>
              請勿填寫此欄位
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="submit" className="btn btn-ink" disabled={pending}>{pending ? "送出中…" : "送出回覆"}</button>
            <p className="text-xs text-muted">姓名與回覆只有創創社管理人員看得到，僅用於統計這次活動。</p>
          </div>
        </form>
      )}
    </section>
  );
}
