import { aiManifest } from "@/lib/ai-import";
import { json, withAi } from "./_shared";

/** GET /api/ai：確認金鑰有效，並取得分類名稱、欄位限制與可用接口 */
export async function GET(req: Request) {
  return withAi(req, false, async (caller) =>
    json({
      ok: true,
      caller: { name: caller.user.displayName, via: caller.via, canPublish: caller.canPublish, canEditDrafts: caller.canEditDrafts },
      ...(await aiManifest()),
    }),
  );
}
