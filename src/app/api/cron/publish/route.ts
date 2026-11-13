import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { publishDue } from "@/lib/announcements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 給外部排程服務（Vercel Cron、cron-job.org、主機 crontab）呼叫：
//   GET /api/cron/publish   Header: Authorization: Bearer <CRON_SECRET>
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET 尚未設定" }, { status: 503 });
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  if (!crypto.timingSafeEqual(a, b)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const published = await publishDue();
  if (published > 0) revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, published });
}
