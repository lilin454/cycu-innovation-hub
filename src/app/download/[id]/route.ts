import { first } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { extOf, getObject, keyFromUrl, mimeForKey } from "@/lib/storage";

// 附件下載：保留原始／顯示檔名，且未發布公告的附件只有管理者能下載
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const att = /^[a-z0-9]{1,40}$/i.test(id)
    ? await first<{ fileName: string; displayName: string; fileUrl: string; status: string }>(
        `SELECT t."fileName", t."displayName", t."fileUrl", a."status"
         FROM "Attachment" t JOIN "Announcement" a ON a."id" = t."announcementId" WHERE t."id" = ?`,
        id,
      )
    : null;
  if (!att) return new Response("找不到檔案", { status: 404 });
  if (att.status !== "PUBLISHED" && !(await getCurrentUser())) return new Response("找不到檔案", { status: 404 });

  const key = keyFromUrl(att.fileUrl);
  const body = key ? await getObject(key) : null;
  if (!key || !body) return new Response("找不到檔案", { status: 404 });

  const ext = extOf(key);
  let name = att.displayName.trim() || att.fileName;
  if (extOf(name) !== ext) name = `${name}.${ext}`;
  name = name.replace(/[\u0000-\u001f"\\/]/g, "_");
  const ascii = name.replace(/[^\x20-\x7e]/g, "_");
  return new Response(body, {
    headers: {
      "Content-Type": mimeForKey(key),
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
