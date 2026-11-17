"use client";

import { useState, useTransition } from "react";
import { submitSurvey } from "@/app/(site)/actions";
import { toast } from "@/components/Toaster";
import { SURVEY_TEXT_MAX, validateAnswers, type SurveyQuestion } from "@/lib/survey";

type Draft = Record<string, string | string[]>;

/** 活動頁內的問卷（多題、多種題型）。回覆只有管理員看得到。 */
export function SurveyForm({
  announcementId,
  questions,
  preview = false,
}: {
  announcementId: string;
  questions: SurveyQuestion[];
  preview?: boolean;
}) {
  const [draft, setDraft] = useState<Draft>({});
  const [website, setWebsite] = useState("");
  const [done, setDone] = useState<null | { updated: boolean }>(null);
  const [pending, start] = useTransition();

  const setOne = (id: string, v: string | string[]) => setDraft((p) => ({ ...p, [id]: v }));
  const toggleMulti = (id: string, opt: string) =>
    setDraft((p) => {
      const cur = Array.isArray(p[id]) ? (p[id] as string[]) : [];
      return { ...p, [id]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // 先在瀏覽器檢查一次，伺服器端還會再檢查
    const checked = validateAnswers(questions, draft);
    if (!checked.ok) {
      toast(checked.error, "error");
      return;
    }
    if (preview) {
      toast("預覽模式不會真的送出。", "info");
      return;
    }
    start(async () => {
      try {
        const res = await submitSurvey(announcementId, { answers: checked.answers, website });
        if (!res.ok) {
          toast(res.error, "error");
          return;
        }
        setDone({ updated: res.updated });
        toast(res.updated ? "已更新你的回覆" : "已收到你的回覆");
      } catch {
        toast("網路連線錯誤，請稍後再試。", "error");
      }
    });
  };

  const chip =
    "flex min-h-11 cursor-pointer items-center gap-2 border-2 border-line px-4 py-2 font-bold has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-flame";

  return (
    <section aria-labelledby="survey-title" className="mt-14 border-2 border-ink bg-white">
      <div className="flex items-center justify-between border-b-2 border-ink bg-sun px-4 py-2">
        <h2 id="survey-title" className="font-black">活動問卷</h2>
        <span className="eyebrow text-[0.6rem]">RSVP</span>
      </div>

      {done ? (
        <div className="p-5" role="status">
          <p className="text-lg font-black">{done.updated ? "已更新你的回覆，謝謝！" : "謝謝，已收到你的回覆。"}</p>
          <p className="mt-1 text-sm text-muted">需要更改的話，用同一個裝置、同一個學號再填一次就會覆蓋。</p>
          <button type="button" className="mt-4 text-sm font-bold underline underline-offset-4" onClick={() => setDone(null)}>
            修改回覆
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="divide-y divide-line" noValidate>
          {questions.map((qu, i) => {
            const val = draft[qu.id];
            const titleEl = (
              <>
                <span className="mr-2 font-display text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
                {qu.title}
                {qu.required ? <span className="ml-1 text-danger" aria-hidden>*</span> : <span className="ml-2 text-xs font-bold text-muted">選填</span>}
              </>
            );
            if (qu.type === "short" || qu.type === "long") {
              return (
                <label key={qu.id} className="block px-5 py-4">
                  <span className="block font-black leading-snug">{titleEl}</span>
                  {qu.type === "short" ? (
                    <input
                      className="input mt-2"
                      value={typeof val === "string" ? val : ""}
                      maxLength={SURVEY_TEXT_MAX.short}
                      required={qu.required}
                      autoComplete={qu.role === "name" ? "name" : "off"}
                      inputMode={qu.role === "studentId" ? "text" : undefined}
                      onChange={(e) => setOne(qu.id, e.target.value)}
                    />
                  ) : (
                    <textarea
                      className="input mt-2"
                      rows={4}
                      value={typeof val === "string" ? val : ""}
                      maxLength={SURVEY_TEXT_MAX.long}
                      required={qu.required}
                      onChange={(e) => setOne(qu.id, e.target.value)}
                    />
                  )}
                </label>
              );
            }
            return (
              <fieldset key={qu.id} className="px-5 py-4">
                <legend className="float-left w-full font-black leading-snug">{titleEl}</legend>
                <div className="clear-both pt-2">
                  {qu.type === "scale" ? (
                    <div>
                      <div className="grid grid-cols-5 gap-1.5 sm:max-w-md">
                        {["1", "2", "3", "4", "5"].map((n) => (
                          <label key={n} className={`${chip} justify-center px-0`}>
                            <input type="radio" name={`q-${qu.id}`} className="sr-only" value={n} checked={val === n} onChange={() => setOne(qu.id, n)} />
                            <span className="font-display text-lg">{n}</span>
                          </label>
                        ))}
                      </div>
                      {(qu.scaleMin || qu.scaleMax) && (
                        <p className="mt-1.5 flex justify-between gap-4 text-xs font-bold text-muted sm:max-w-md">
                          <span>1＝{qu.scaleMin || "最低"}</span>
                          <span className="text-right">5＝{qu.scaleMax || "最高"}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {qu.options.map((opt) => (
                        <label key={opt} className={chip}>
                          {qu.type === "single" ? (
                            <input type="radio" name={`q-${qu.id}`} className="sr-only" value={opt} checked={val === opt} onChange={() => setOne(qu.id, opt)} />
                          ) : (
                            <input
                              type="checkbox"
                              className="sr-only"
                              value={opt}
                              checked={Array.isArray(val) && val.includes(opt)}
                              onChange={() => toggleMulti(qu.id, opt)}
                            />
                          )}
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                  {qu.type === "multi" && <p className="mt-1.5 text-xs text-muted">可以複選</p>}
                </div>
              </fieldset>
            );
          })}

          {/* 防機器人用的隱藏欄位，一般使用者看不到也不需要填 */}
          <div className="hidden" aria-hidden>
            <label>
              請勿填寫此欄位
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
            <button type="submit" className="btn btn-ink" disabled={pending}>{pending ? "送出中…" : "送出回覆"}</button>
            <p className="text-xs text-muted">你的回答只有創創社管理人員看得到，僅用於這次活動的統計與聯繫。</p>
          </div>
        </form>
      )}
    </section>
  );
}
