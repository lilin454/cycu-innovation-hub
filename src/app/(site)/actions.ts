"use server";

import { headers } from "next/headers";
import { clientIpFrom, first, newId, nowIso, run } from "@/lib/db";
import { parseSurveyOptions } from "@/lib/survey";

// 前台訪客可以呼叫的操作（不需要登入）。所有輸入都在伺服器端驗證。

const MAX_PER_IP_PER_HOUR = 6;
const MAX_PER_ANNOUNCEMENT = 3000;

async function sha256(v: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function submitSurvey(
  announcementId: string,
  raw: { name: string; answer: string; note: string; website?: string },
): Promise<{ ok: true; updated: boolean } | { ok: false; error: string }> {
  const fail = (error: string) => ({ ok: false as const, error });
  try {
    // 蜜罐欄位：真人看不到這個欄位，有填的就是機器人，假裝成功即可
    if (typeof raw?.website === "string" && raw.website.trim()) return { ok: true, updated: false };

    const name = String(raw?.name ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    const answer = String(raw?.answer ?? "").trim();
    const note = String(raw?.note ?? "").trim().slice(0, 200);
    if (name.length < 2) return fail("請填寫姓名（至少 2 個字）。");
    if (!/^[a-z0-9]{1,40}$/i.test(String(announcementId))) return fail("找不到這個活動。");

    const a = await first<{ id: string; surveyEnabled: number; surveyOptions: string | null }>(
      `SELECT "id", "surveyEnabled", "surveyOptions" FROM "Announcement" WHERE "id" = ? AND "status" = 'PUBLISHED'`,
      announcementId,
    );
    if (!a || a.surveyEnabled !== 1) return fail("這個活動目前沒有開放填寫。");
    if (!parseSurveyOptions(a.surveyOptions).includes(answer)) return fail("請選擇一個選項。");

    const h = await headers();
    const ip = clientIpFrom(h);
    // 只儲存雜湊後的值，用來防止灌票，不保存原始 IP
    const ipHash = await sha256(`${a.id}:${ip}`);
    const now = nowIso();

    // 同一個裝置用同一個姓名再填一次 = 修改自己的回覆
    const mine = await first<{ id: string }>(
      `SELECT "id" FROM "SurveyResponse" WHERE "announcementId" = ? AND "ipHash" = ? AND lower("name") = lower(?)`,
      a.id, ipHash, name,
    );
    if (mine) {
      await run(`UPDATE "SurveyResponse" SET "answer" = ?, "note" = ?, "createdAt" = ? WHERE "id" = ?`, answer, note || null, now, mine.id);
      return { ok: true, updated: true };
    }

    const usage = await first<{ recent: number; total: number }>(
      `SELECT COALESCE(SUM("ipHash" = ? AND "createdAt" >= ?), 0) AS recent, COUNT(*) AS total FROM "SurveyResponse" WHERE "announcementId" = ?`,
      ipHash, new Date(Date.now() - 3600_000).toISOString(), a.id,
    );
    if ((usage?.recent ?? 0) >= MAX_PER_IP_PER_HOUR) return fail("送出次數過多，請稍後再試。");
    if ((usage?.total ?? 0) >= MAX_PER_ANNOUNCEMENT) return fail("回覆數量已達上限，請直接聯絡主辦單位。");

    await run(
      `INSERT INTO "SurveyResponse" ("id", "announcementId", "name", "answer", "note", "ipHash", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?)`,
      newId(), a.id, name, answer, note || null, ipHash, now,
    );
    return { ok: true, updated: false };
  } catch (e) {
    console.error("[submitSurvey]", e);
    return fail("系統暫時無法送出，請稍後再試。");
  }
}
