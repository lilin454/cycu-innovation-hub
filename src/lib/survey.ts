// 公告問卷：前後端共用的純函式與常數（不可引入伺服器端模組）

export const DEFAULT_SURVEY_QUESTION = "你會出席這個活動嗎？";
export const DEFAULT_SURVEY_OPTIONS = ["會出席", "不會出席", "還不確定"];
export const SURVEY_MAX_OPTIONS = 6;

/** 把後台輸入的選項文字（一行一個）整理成選項陣列 */
export function parseSurveyOptions(raw: string | null | undefined): string[] {
  const list = [
    ...new Set(
      (raw ?? "")
        .split(/\r?\n/)
        .map((s) => s.trim().slice(0, 40))
        .filter(Boolean),
    ),
  ].slice(0, SURVEY_MAX_OPTIONS);
  return list.length >= 2 ? list : DEFAULT_SURVEY_OPTIONS;
}

export type SurveyResponse = {
  id: string;
  announcementId: string;
  name: string;
  answer: string;
  note: string | null;
  createdAt: string;
};
