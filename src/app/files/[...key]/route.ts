import { getObject, isImageKey, isValidKey, mimeForKey } from "@/lib/storage";

export const runtime = "nodejs";

// 公開的圖片與檔案輸出。檔名為 96 bit 隨機值，無法被列舉；
// 附件的正式下載（保留原始檔名、檢查公告是否已發布）走 /download/[id]。
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const key = (await ctx.params).key.join("/");
  if (!isValidKey(key)) return new Response("Not found", { status: 404 });
  const body = await getObject(key);
  if (!body) return new Response("Not found", { status: 404 });
  const image = isImageKey(key);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": mimeForKey(key),
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Content-Disposition": image ? "inline" : "attachment",
    },
  });
}
