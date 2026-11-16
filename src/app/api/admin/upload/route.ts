import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { publicHost } from "@/lib/db";
import { saveUpload, UploadError } from "@/lib/storage";

export async function POST(req: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "尚未登入或登入已過期，請重新登入。" }, { status: 401 });
  }
  // 防 CSRF：只接受同源請求
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  // 同源，或來自 SITE_URL 設定的對外網域（經由 Vercel 轉進來時）
  const originHost = origin ? new URL(origin).host : "";
  if (origin && host && originHost !== host && originHost !== publicHost()) {
    return NextResponse.json({ error: "不允許的請求來源。" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "上傳失敗，檔案可能過大。" }, { status: 400 });
  }
  const file = form.get("file");
  const kind = form.get("kind") === "image" ? "image" : "file";
  if (!(file instanceof File)) return NextResponse.json({ error: "沒有收到檔案。" }, { status: 400 });

  try {
    const stored = await saveUpload(file, kind);
    return NextResponse.json({
      url: stored.url,
      fileName: stored.fileName,
      fileType: stored.fileType,
      fileSize: stored.fileSize,
    });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[upload]", e);
    return NextResponse.json({ error: "檔案儲存失敗，請稍後再試。" }, { status: 500 });
  }
}
