"use server";

import { headers } from "next/headers";
import { clientIpFrom, first, newId, nowIso, run } from "@/lib/db";
import { answerText, resolveSurveyQuestions, validateAnswers } from "@/lib/survey";

// 前台訪客可以呼叫的操作（不需要登入）。所有輸入都在伺服器端驗證。

const MAX_PER_IP_PER_HOUR = 6;
const MAX_PER_ANNOUNCEMENT = 3000;

async function sha256(v: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function submitSurvey(
  announcementId: string,
  raw: { answers: Record<string, unknown>; website?: string },
): Promise<{ ok: true; updated: boolean } | { ok: false; error: string }> {
  const fail = (error: string) => ({ ok: false as const, error });
  try {
    // 蜜罐欄位：真人看不到這個欄位，有填的就是機器人，假裝成功即可
    if (typeof raw?.website === "string" && raw.website.trim()) return { ok: true, updated: false };
    if (!/^[a-z0-9]{1,40}$/i.test(String(announcementId))) return fail("找不到這個活動。");

    const a = await first<{ id: string; surveyEnabled: number; surveyQuestions: string | null; surveyQuestion: string | null; surveyOptions: string | null }>(
      `SELECT "id", "surveyEnabled", "surveyQuestions", "surveyQuestion", "surveyOptions" FROM "Announcement" WHERE "id" = ? AND "status" = 'PUBLISHED'`,
      announcementId,
    );
    if (!a || a.surveyEnabled !== 1) return fail("這個活動目前沒有開放填寫。");

    const questions = resolveSurveyQuestions(a);
    const checked = validateAnswers(questions, raw?.answers);
    if (!checked.ok) return fail(checked.error);
    const answers = checked.answers;
    if (JSON.stringify(answers).length > 20_000) return fail("回答內容過長。");

    const pick = (role: "name" | "studentId") => {
      const qu = questions.find((x) => x.role === role);
      return qu ? answerText(answers[qu.id]).slice(0, 60) : "";
    };
    const name = pick("name") || pick("studentId") || "（未填姓名）";
    const key = (pick("studentId") || pick("name")).toLowerCase();
    // 舊欄位 answer 不可為空：放第一題單選的答案，方便相容
    const firstChoice = questions.find((x) => x.type === "single");
    const summary = (firstChoice && answerText(answers[firstChoice.id])) || "已填寫";

    const h = await headers();
    const ip = clientIpFrom(h);
    // 只儲存雜湊後的值，用來防止灌票，不保存原始 IP
    const ipHash = await sha256(`${a.id}:${ip}`);
    const now = nowIso();
    const json = JSON.stringify(answers);

    // 同一個裝置用同一個學號（或姓名）再填一次 = 修改自己的回覆
    if (key) {
      const mine = await first<{ id: string }>(
        `SELECT "id" FROM "SurveyResponse" WHERE "announcementId" = ? AND "ipHash" = ? AND "respondentKey" = ?`,
        a.id, ipHash, key,
      );
      if (mine) {
        await run(
          `UPDATE "SurveyResponse" SET "name" = ?, "answer" = ?, "note" = NULL, "answers" = ?, "createdAt" = ? WHERE "id" = ?`,
          name, summary, json, now, mine.id,
        );
        return { ok: true, updated: true };
      }
    }

    const usage = await first<{ recent: number; total: number }>(
      `SELECT COALESCE(SUM("ipHash" = ? AND "createdAt" >= ?), 0) AS recent, COUNT(*) AS total FROM "SurveyResponse" WHERE "announcementId" = ?`,
      ipHash, new Date(Date.now() - 3600_000).toISOString(), a.id,
    );
    if ((usage?.recent ?? 0) >= MAX_PER_IP_PER_HOUR) return fail("送出次數過多，請稍後再試。");
    if ((usage?.total ?? 0) >= MAX_PER_ANNOUNCEMENT) return fail("回覆數量已達上限，請直接聯絡主辦單位。");

    await run(
      `INSERT INTO "SurveyResponse" ("id", "announcementId", "name", "answer", "note", "ipHash", "createdAt", "answers", "respondentKey")
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      newId(), a.id, name, summary, ipHash, now, json, key || null,
    );
    return { ok: true, updated: false };
  } catch (e) {
    console.error("[submitSurvey]", e);
    return fail("系統暫時無法送出，請稍後再試。");
  }
}
