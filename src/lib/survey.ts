// 公告問卷：前後端共用的純函式與常數（不可引入伺服器端模組）

export const SURVEY_TYPES = ["short", "long", "single", "multi", "scale"] as const;
export type SurveyType = (typeof SURVEY_TYPES)[number];

export const SURVEY_TYPE_LABEL: Record<SurveyType, string> = {
  short: "簡答",
  long: "詳答（多行）",
  single: "單選",
  multi: "多選",
  scale: "五點量表",
};

/** role 用來辨識「姓名」「學號」：回覆列表顯示、同一人重填時覆蓋舊回覆 */
export type SurveyRole = "name" | "studentId";

export type SurveyQuestion = {
  id: string;
  type: SurveyType;
  title: string;
  required: boolean;
  options: string[]; // 單選、多選用
  scaleMin: string; // 五點量表 1 分的說明
  scaleMax: string; // 五點量表 5 分的說明
  role?: SurveyRole;
};

export type SurveyAnswer = string | string[];
export type SurveyAnswers = Record<string, SurveyAnswer>;

export const SURVEY_MAX_QUESTIONS = 20;
export const SURVEY_MAX_OPTIONS = 10;
export const SURVEY_TEXT_MAX = { short: 100, long: 1000 } as const;

const q = (id: string, type: SurveyType, title: string, extra: Partial<SurveyQuestion> = {}): SurveyQuestion => ({
  id,
  type,
  title,
  required: true,
  options: [],
  scaleMin: "",
  scaleMax: "",
  ...extra,
});

/** 新開問卷時的預設題目 */
export function defaultSurveyQuestions(): SurveyQuestion[] {
  return [
    q("sid", "short", "學號", { role: "studentId" }),
    q("name", "short", "姓名", { role: "name" }),
    q("dept", "short", "系級"),
    q("member", "single", "是否為創創社社員？", { options: ["是", "否"] }),
    q("attend", "single", "你會出席這個活動嗎？", { options: ["會出席", "不會出席", "還不確定"] }),
  ];
}

export function newQuestionId(): string {
  return `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function blankQuestion(type: SurveyType): SurveyQuestion {
  return q(newQuestionId(), type, "", {
    required: false,
    options: type === "single" || type === "multi" ? ["選項 1", "選項 2"] : [],
    scaleMin: type === "scale" ? "非常不同意" : "",
    scaleMax: type === "scale" ? "非常同意" : "",
  });
}

/** 舊版（單一題目）問卷的預設值，只用來讀取舊資料 */
const LEGACY_QUESTION = "你會出席這個活動嗎？";
const LEGACY_OPTIONS = ["會出席", "不會出席", "還不確定"];

function legacyOptions(raw: string | null | undefined): string[] {
  const list = [...new Set((raw ?? "").split(/\r?\n/).map((s) => s.trim().slice(0, 40)).filter(Boolean))].slice(0, 6);
  return list.length >= 2 ? list : LEGACY_OPTIONS;
}

/** 把資料庫裡的 JSON 整理成可以信任的題目陣列（格式不對的題目會被略過） */
export function normalizeQuestions(input: unknown): SurveyQuestion[] {
  if (!Array.isArray(input)) return [];
  const out: SurveyQuestion[] = [];
  const seen = new Set<string>();
  for (const raw of input.slice(0, SURVEY_MAX_QUESTIONS)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === "string" && /^[a-z0-9_]{1,40}$/i.test(r.id) ? r.id : null;
    const type = SURVEY_TYPES.includes(r.type as SurveyType) ? (r.type as SurveyType) : null;
    const title = typeof r.title === "string" ? r.title.trim().slice(0, 120) : "";
    if (!id || !type || !title || seen.has(id)) continue;
    seen.add(id);
    const options =
      type === "single" || type === "multi"
        ? [...new Set((Array.isArray(r.options) ? r.options : []).map((o) => String(o ?? "").trim().slice(0, 60)).filter(Boolean))].slice(0, SURVEY_MAX_OPTIONS)
        : [];
    if ((type === "single" || type === "multi") && options.length < 2) continue;
    out.push({
      id,
      type,
      title,
      required: r.required === true,
      options,
      scaleMin: type === "scale" && typeof r.scaleMin === "string" ? r.scaleMin.trim().slice(0, 30) : "",
      scaleMax: type === "scale" && typeof r.scaleMax === "string" ? r.scaleMax.trim().slice(0, 30) : "",
      role: r.role === "name" || r.role === "studentId" ? r.role : undefined,
    });
  }
  return out;
}

/**
 * 一則公告目前的題目。
 * 新版存在 surveyQuestions（JSON）；舊版只有 surveyQuestion / surveyOptions，轉成「姓名＋一題單選」。
 */
export function resolveSurveyQuestions(a: {
  surveyQuestions?: string | null;
  surveyQuestion?: string | null;
  surveyOptions?: string | null;
}): SurveyQuestion[] {
  if (a.surveyQuestions) {
    try {
      const list = normalizeQuestions(JSON.parse(a.surveyQuestions));
      if (list.length) return list;
    } catch {
      // 壞掉的 JSON 就當作舊版處理
    }
  }
  return [
    q("name", "short", "姓名", { role: "name" }),
    q("answer", "single", a.surveyQuestion?.trim() || LEGACY_QUESTION, { options: legacyOptions(a.surveyOptions) }),
    q("note", "short", "系級／備註", { required: false }),
  ];
}

/** 驗證訪客送出的答案；回傳整理過的答案或錯誤訊息 */
export function validateAnswers(
  questions: SurveyQuestion[],
  raw: unknown,
): { ok: true; answers: SurveyAnswers } | { ok: false; error: string } {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const answers: SurveyAnswers = {};
  for (const qu of questions) {
    const v = input[qu.id];
    const label = `「${qu.title}」`;
    if (qu.type === "multi") {
      const list = [...new Set((Array.isArray(v) ? v : []).map((x) => String(x)))].filter((x) => qu.options.includes(x));
      if (qu.required && !list.length) return { ok: false, error: `請回答${label}。` };
      if (list.length) answers[qu.id] = list;
      continue;
    }
    const s = typeof v === "string" ? v.trim().replace(/\r\n/g, "\n") : "";
    if (!s) {
      if (qu.required) return { ok: false, error: `請回答${label}。` };
      continue;
    }
    if (qu.type === "single" && !qu.options.includes(s)) return { ok: false, error: `${label}請從選項中選一個。` };
    if (qu.type === "scale" && !/^[1-5]$/.test(s)) return { ok: false, error: `${label}請選 1 到 5 分。` };
    if (qu.type === "short" && s.length > SURVEY_TEXT_MAX.short) return { ok: false, error: `${label}不可超過 ${SURVEY_TEXT_MAX.short} 字。` };
    if (qu.type === "long" && s.length > SURVEY_TEXT_MAX.long) return { ok: false, error: `${label}不可超過 ${SURVEY_TEXT_MAX.long} 字。` };
    if (qu.role === "name" && s.length < 2) return { ok: false, error: `${label}至少要 2 個字。` };
    answers[qu.id] = qu.type === "short" ? s.replace(/\s+/g, " ") : s;
  }
  return { ok: true, answers };
}

export function answerText(v: SurveyAnswer | undefined): string {
  if (v === undefined) return "";
  return Array.isArray(v) ? v.join("、") : v;
}

export type SurveyResponse = {
  id: string;
  announcementId: string;
  name: string;
  answers: SurveyAnswers;
  createdAt: string;
};

/** 把資料庫的一列回覆轉成統一格式（舊版回覆只有 name / answer / note） */
export function mapResponse(r: {
  id: string;
  announcementId: string;
  name: string;
  answer: string;
  note: string | null;
  answers: string | null;
  createdAt: string;
}): SurveyResponse {
  let answers: SurveyAnswers = {};
  if (r.answers) {
    try {
      const parsed = JSON.parse(r.answers);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) answers = parsed as SurveyAnswers;
    } catch {
      answers = {};
    }
  } else {
    answers = { name: r.name, answer: r.answer, ...(r.note ? { note: r.note } : {}) };
  }
  return { id: r.id, announcementId: r.announcementId, name: r.name, answers, createdAt: r.createdAt };
}
