import { all, likePattern } from "@/lib/db";
import { aiAnnouncementSchema, convertAiAnnouncement } from "@/lib/ai-import";
import { saveAnnouncementCore } from "@/lib/announcement-save";
import { getBaseUrl } from "@/lib/settings";
import { json, withAi } from "../_shared";

/** GET /api/ai/announcements?q=關鍵字：列出最近的公告，讓 AI 上架前先檢查有沒有重複 */
export async function GET(req: Request) {
  return withAi(req, false, async () => {
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
    const rows = await all<{ id: string; slug: string; title: string; status: string; startAt: string | null; createdAt: string }>(
      `SELECT "id", "slug", "title", "status", "startAt", "createdAt" FROM "Announcement"
       ${q ? `WHERE "title" LIKE ? ESCAPE '\\' OR "summary" LIKE ? ESCAPE '\\'` : ""}
       ORDER BY "createdAt" DESC LIMIT 30`,
      ...(q ? [likePattern(q), likePattern(q)] : []),
    );
    return json({ ok: true, items: rows });
  });
}

/** POST /api/ai/announcements：新增一則公告。預設存成草稿，由總管理員在後台確認後再發布 */
export async function POST(req: Request) {
  return withAi(req, true, async (caller) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "請送出 JSON（Content-Type: application/json）。" }, 400);
    }
    const parsed = aiAnnouncementSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return json({ ok: false, error: `${issue?.path.join(".") || "資料"}：${issue?.message ?? "格式不正確"}` }, 400);
    }
    if (parsed.data.action !== "draft" && !caller.canPublish) {
      return json({ ok: false, error: "這把金鑰只能存成草稿（action: \"draft\"）。要直接發布，請在後台建立允許發布的金鑰。" }, 403);
    }
    const converted = await convertAiAnnouncement(parsed.data);
    if (!converted.ok) return json({ ok: false, error: converted.error }, 400);
    const { input, intent, warnings } = converted.value;

    const res = await saveAnnouncementCore(null, input, intent);
    if (!res.ok) return json({ ok: false, error: res.error, warnings }, 400);
    const base = await getBaseUrl();
    return json(
      {
        ok: true,
        id: res.id,
        slug: res.slug,
        status: res.status,
        editUrl: `${base}/admin/announcements/${res.id}`,
        publicUrl: res.status === "PUBLISHED" ? `${base}/a/${res.slug}` : null,
        warnings,
      },
      201,
    );
  });
}
