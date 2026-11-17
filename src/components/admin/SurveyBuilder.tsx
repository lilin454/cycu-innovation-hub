"use client";

import {
  blankQuestion,
  defaultSurveyQuestions,
  SURVEY_MAX_OPTIONS,
  SURVEY_MAX_QUESTIONS,
  SURVEY_TYPE_LABEL,
  SURVEY_TYPES,
  type SurveyQuestion,
  type SurveyType,
} from "@/lib/survey";

/** 後台的問卷題目編輯器：新增、刪除、排序題目，切換題型與必填 */
export function SurveyBuilder({ value, onChange }: { value: SurveyQuestion[]; onChange: (v: SurveyQuestion[]) => void }) {
  const update = (i: number, patch: Partial<SurveyQuestion>) => onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(i, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  const changeType = (i: number, type: SurveyType) => {
    const q = value[i];
    const isChoice = type === "single" || type === "multi";
    update(i, {
      type,
      options: isChoice ? (q.options.length >= 2 ? q.options : ["選項 1", "選項 2"]) : [],
      scaleMin: type === "scale" ? q.scaleMin || "非常不同意" : "",
      scaleMax: type === "scale" ? q.scaleMax || "非常同意" : "",
      // 姓名、學號只能是簡答題
      role: type === "short" ? q.role : undefined,
    });
  };
  const full = value.length >= SURVEY_MAX_QUESTIONS;

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {value.map((q, i) => {
          const isChoice = q.type === "single" || q.type === "multi";
          return (
            <li key={q.id} className="border-2 border-ink bg-white">
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper-2 px-3 py-2">
                <span className="font-display text-sm font-black">Q{i + 1}</span>
                <select
                  className="input !w-auto !py-1 text-sm"
                  aria-label={`第 ${i + 1} 題的題型`}
                  value={q.type}
                  onChange={(e) => changeType(i, e.target.value as SurveyType)}
                >
                  {SURVEY_TYPES.map((t) => (
                    <option key={t} value={t}>{SURVEY_TYPE_LABEL[t]}</option>
                  ))}
                </select>
                <label className="flex cursor-pointer items-center gap-1.5 text-sm font-bold">
                  <input type="checkbox" className="h-4 w-4 accent-[#0b2a4a]" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} />
                  必填
                </label>
                {q.role && <span className="tag tag-type">{q.role === "studentId" ? "用來辨識填寫者" : "顯示為填寫者姓名"}</span>}
                <span className="ml-auto flex gap-1">
                  <button type="button" className="btn btn-sm bg-white" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`第 ${i + 1} 題上移`}>↑</button>
                  <button type="button" className="btn btn-sm bg-white" disabled={i === value.length - 1} onClick={() => move(i, i + 1)} aria-label={`第 ${i + 1} 題下移`}>↓</button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`刪除第 ${i + 1} 題`}>刪除</button>
                </span>
              </div>
              <div className="space-y-3 p-3">
                <label className="block">
                  <span className="sr-only">第 {i + 1} 題題目</span>
                  <input className="input font-bold" maxLength={120} placeholder="輸入題目，例如：你想參加哪一個場次？" value={q.title} onChange={(e) => update(i, { title: e.target.value })} />
                </label>

                {isChoice && (
                  <div className="space-y-1.5">
                    {q.options.map((opt, k) => (
                      <div key={k} className="flex items-center gap-2">
                        <span aria-hidden className={`h-4 w-4 flex-none border-2 border-ink ${q.type === "single" ? "rounded-full" : ""}`} />
                        <input
                          className="input !py-1.5"
                          maxLength={60}
                          aria-label={`第 ${i + 1} 題選項 ${k + 1}`}
                          value={opt}
                          onChange={(e) => update(i, { options: q.options.map((o, m) => (m === k ? e.target.value : o)) })}
                        />
                        <button
                          type="button"
                          className="btn btn-sm bg-white"
                          disabled={q.options.length <= 2}
                          aria-label={`刪除選項 ${k + 1}`}
                          onClick={() => update(i, { options: q.options.filter((_, m) => m !== k) })}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {q.options.length < SURVEY_MAX_OPTIONS && (
                      <button type="button" className="text-sm font-bold underline underline-offset-4" onClick={() => update(i, { options: [...q.options, `選項 ${q.options.length + 1}`] })}>
                        ＋ 新增選項
                      </button>
                    )}
                  </div>
                )}

                {q.type === "scale" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="field-label">1 分代表</span>
                      <input className="input" maxLength={30} value={q.scaleMin} placeholder="非常不同意" onChange={(e) => update(i, { scaleMin: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="field-label">5 分代表</span>
                      <input className="input" maxLength={30} value={q.scaleMax} placeholder="非常同意" onChange={(e) => update(i, { scaleMax: e.target.value })} />
                    </label>
                  </div>
                )}

                {(q.type === "short" || q.type === "long") && (
                  <p className="text-xs text-muted">
                    填寫者會看到一個{q.type === "short" ? "單行" : "多行"}文字框（上限 {q.type === "short" ? 100 : 1000} 字）。
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {value.length === 0 && <p className="border-2 border-dashed border-line p-4 text-center text-sm text-muted">還沒有題目，從下面新增一題。</p>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">新增題目：</span>
        {SURVEY_TYPES.map((t) => (
          <button key={t} type="button" className="btn btn-sm bg-white" disabled={full} onClick={() => onChange([...value, blankQuestion(t)])}>
            ＋ {SURVEY_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>最多 {SURVEY_MAX_QUESTIONS} 題，每題最多 {SURVEY_MAX_OPTIONS} 個選項。</span>
        <button
          type="button"
          className="font-bold underline underline-offset-4"
          onClick={() => {
            if (value.length === 0 || window.confirm("要把題目換回預設的「學號、姓名、系級、是否為社員、是否出席」嗎？目前的題目會被取代。")) {
              onChange(defaultSurveyQuestions());
            }
          }}
        >
          換回預設題目
        </button>
      </div>
    </div>
  );
}
