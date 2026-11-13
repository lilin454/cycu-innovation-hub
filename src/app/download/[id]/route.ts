import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { extOf, getObject, keyFromUrl, mimeForKey } from "@/lib/storage";

export const runtime = "nodejs";

// 附件下載：保留原始／顯示檔名，且未發布公告的附件只有管理者能下載
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const att = await db.attachment.findUnique({
    where: { id },
    include: { announcement: { select: { status: true } } },
  });
  if (!att) return new Response("找不到檔案", { status: 404 });
  if (att.announcement.status !== "PUBLISHED" && !(await getCurrentUser())) {
    return new Response("找不到檔案", { status: 404 });
  }
  const key = keyFromUrl(att.fileUrl);
  const body = key ? await getObject(key) : null;
  if (!key || !body) return new Response("找不到檔案", { status: 404 });

  const ext = extOf(key);
  let name = att.displayName.trim() || att.fileName;
  if (extOf(name) !== ext) name = `${name}.${ext}`;
  name = name.replace(/[\u0000-\u001f"\\/]/g, "_");
  const ascii = name.replace(/[^\x20-\x7e]/g, "_");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": mimeForKey(key),
      "Content-Length": String(body.length),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
