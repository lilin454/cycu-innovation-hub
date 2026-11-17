import "server-only";
import { NextResponse } from "next/server";
import { ApiAuthError, authenticateAi, type AiCaller } from "@/lib/api-token";

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** 包住每個 AI 接口：統一處理身分驗證與錯誤格式 */
export async function withAi(req: Request, write: boolean, fn: (caller: AiCaller) => Promise<Response>): Promise<Response> {
  let caller: AiCaller;
  try {
    caller = await authenticateAi(req, write);
  } catch (e) {
    if (e instanceof ApiAuthError) return json({ ok: false, error: e.message }, e.status);
    console.error("[ai auth]", e);
    return json({ ok: false, error: "驗證時發生錯誤，請稍後再試。" }, 500);
  }
  try {
    return await fn(caller);
  } catch (e) {
    console.error("[ai]", e);
    return json({ ok: false, error: "伺服器發生錯誤，請稍後再試。" }, 500);
  }
}
