import { getAnnouncementById } from "@/lib/announcements";
import { aiAnnouncementSchema, aiFromExisting, convertAiAnnouncement } from "@/lib/ai-import";
import { deleteAnnouncementsCore, saveAnnouncementCore } from "@/lib/announcement-save";
import { getBaseUrl } from "@/lib/settings";
import type { AiCaller } from "@/lib/api-token";
import { json, withAi } from "../../_shared";

type Ctx = { params: Promise<{ id: string }> };

const NOT_DRAFT = "只能修改或刪除「草稿」狀態的公告；已發布、排程、下架或封存的公告請到後台手動處理。";

function needEdit(caller: AiCaller) {
  return caller.canEditDrafts
    ? null
    : json({ ok: false, error: "這把金鑰沒有「可編輯、刪除草稿」的權限，請在後台建立有這個權限的金鑰。" }, 403);
}

/** GET /api/ai/announcements/{id}：讀取單一公告（任何狀態都可讀，方便 AI 比對內容） */
export async function GET(req: Request, { params }: Ctx) {
  return withAi(req, false, async () => {
    const a = await getAnnouncementById((await params).id);
    if (!a) return json({ ok: false, error: "找不到這則公告。" }, 404);
    return json({ ok: true, announcement: aiFromExisting(a) });
  });
}

/**
 * PATCH /api/ai/announcements/{id}：修改草稿。只送要改的欄位，沒送的欄位保留原本的內容。
 * 預設仍存成草稿；送 action: "publish" 需要金鑰同時有「允許直接發布」權限。
 */
export async function PATCH(req: Request, { params }: Ctx) {
  return withAi(req, true, async (caller) => {
    const denied = needEdit(caller);
    if (denied) return denied;
    const existing = await getAnnouncementById((await params).id);
    if (!existing) return json({ ok: false, error: "找不到這則公告。" }, 404);
    if (existing.status !== "DRAFT") return json({ ok: false, error: NOT_DRAFT }, 409);

    let patch: unknown;
    try {
      patch = await req.json();
    } catch {
      return json({ ok: false, error: "請送出 JSON（Content-Type: application/json）。" }, 400);
    }
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return json({ ok: false, error: "請送出 JSON 物件。" }, 400);

    // 原本的內容當底，用 AI 送來的欄位覆蓋；id、status 不能改
    const { id: _id, status: _status, ...base } = aiFromExisting(existing);
    const { id: _pid, status: _pstatus, ...changes } = patch as Record<string, unknown>;
    void _id; void _status; void _pid; void _pstatus;
    const parsed = aiAnnouncementSchema.safeParse({ ...base, action: "draft", ...changes });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return json({ ok: false, error: `${issue?.path.join(".") || "資料"}：${issue?.message ?? "格式不正確"}` }, 400);
    }
    if (parsed.data.action !== "draft" && !caller.canPublish) {
      return json({ ok: false, error: "這把金鑰只能存成草稿（action: \"draft\"）。" }, 403);
    }
    const converted = await convertAiAnnouncement(parsed.data);
    if (!converted.ok) return json({ ok: false, error: converted.error }, 400);
    const { input, intent, warnings } = converted.value;

    const res = await saveAnnouncementCore(existing.id, input, intent);
    if (!res.ok) return json({ ok: false, error: res.error, warnings }, 400);
    const base2 = await getBaseUrl();
    return json({
      ok: true,
      id: res.id,
      slug: res.slug,
      status: res.status,
      editUrl: `${base2}/admin/announcements/${res.id}`,
      publicUrl: res.status === "PUBLISHED" ? `${base2}/a/${res.slug}` : null,
      warnings,
    });
  });
}

/** DELETE /api/ai/announcements/{id}：刪除草稿（連同它的圖片、附件） */
export async function DELETE(req: Request, { params }: Ctx) {
  return withAi(req, true, async (caller) => {
    const denied = needEdit(caller);
    if (denied) return denied;
    const existing = await getAnnouncementById((await params).id);
    if (!existing) return json({ ok: false, error: "找不到這則公告。" }, 404);
    if (existing.status !== "DRAFT") return json({ ok: false, error: NOT_DRAFT }, 409);
    await deleteAnnouncementsCore([existing.id]);
    return json({ ok: true, deleted: existing.id });
  });
}
