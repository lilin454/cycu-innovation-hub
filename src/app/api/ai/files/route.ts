import { extOf, saveUpload, UploadError } from "@/lib/storage";
import { json, withAi } from "../_shared";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

/** POST /api/ai/files：上傳封面、活動圖片或附件（multipart/form-data，欄位名稱 file） */
export async function POST(req: Request) {
  return withAi(req, true, async () => {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return json({ ok: false, error: "請用 multipart/form-data 上傳，欄位名稱為 file；檔案可能過大。" }, 400);
    }
    const file = form.get("file");
    if (!(file instanceof File)) return json({ ok: false, error: "沒有收到檔案（欄位名稱要是 file）。" }, 400);
    const kind = IMAGE_EXTS.has(extOf(file.name)) ? "image" : "file";
    try {
      const s = await saveUpload(file, kind);
      return json({ ok: true, kind, url: s.url, fileName: s.fileName, fileType: s.fileType, fileSize: s.fileSize }, 201);
    } catch (e) {
      if (e instanceof UploadError) return json({ ok: false, error: e.message }, 400);
      throw e;
    }
  });
}
