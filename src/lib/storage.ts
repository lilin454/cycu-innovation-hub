import "server-only";
import { env } from "./db";
import { FILE_MAX_BYTES, IMAGE_MAX_BYTES } from "./constants";

/**
 * 檔案儲存：Cloudflare Workers KV（免費方案即可使用，不需要綁定付款方式）。
 * 對外網址一律是 /files/<key>，由 Route Handler 讀出後輸出。
 * 免費額度：總容量 1GB、單一檔案 25MB、每天 1,000 次寫入、100,000 次讀取。
 */

type FileRule = { mime: string; accept: string[]; magic: "jpeg" | "png" | "gif" | "webp" | "pdf" | "zip" | "ole" | "text" };

const OOXML = "application/vnd.openxmlformats-officedocument.";
const ODF = "application/vnd.oasis.opendocument.";

const RULES: Record<string, FileRule> = {
  jpg: { mime: "image/jpeg", accept: ["image/jpeg"], magic: "jpeg" },
  jpeg: { mime: "image/jpeg", accept: ["image/jpeg"], magic: "jpeg" },
  png: { mime: "image/png", accept: ["image/png"], magic: "png" },
  gif: { mime: "image/gif", accept: ["image/gif"], magic: "gif" },
  webp: { mime: "image/webp", accept: ["image/webp"], magic: "webp" },
  pdf: { mime: "application/pdf", accept: ["application/pdf"], magic: "pdf" },
  doc: { mime: "application/msword", accept: ["application/msword"], magic: "ole" },
  xls: { mime: "application/vnd.ms-excel", accept: ["application/vnd.ms-excel"], magic: "ole" },
  ppt: { mime: "application/vnd.ms-powerpoint", accept: ["application/vnd.ms-powerpoint"], magic: "ole" },
  docx: { mime: `${OOXML}wordprocessingml.document`, accept: [`${OOXML}wordprocessingml.document`], magic: "zip" },
  xlsx: { mime: `${OOXML}spreadsheetml.sheet`, accept: [`${OOXML}spreadsheetml.sheet`], magic: "zip" },
  pptx: { mime: `${OOXML}presentationml.presentation`, accept: [`${OOXML}presentationml.presentation`], magic: "zip" },
  odt: { mime: `${ODF}text`, accept: [`${ODF}text`], magic: "zip" },
  ods: { mime: `${ODF}spreadsheet`, accept: [`${ODF}spreadsheet`], magic: "zip" },
  odp: { mime: `${ODF}presentation`, accept: [`${ODF}presentation`], magic: "zip" },
  zip: { mime: "application/zip", accept: ["application/zip", "application/x-zip-compressed"], magic: "zip" },
  txt: { mime: "text/plain; charset=utf-8", accept: ["text/plain"], magic: "text" },
  csv: { mime: "text/csv; charset=utf-8", accept: ["text/csv", "application/vnd.ms-excel", "text/plain"], magic: "text" },
};

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

function startsWith(buf: Uint8Array, bytes: number[], offset = 0): boolean {
  return bytes.every((b, i) => buf[offset + i] === b);
}

function checkMagic(buf: Uint8Array, kind: FileRule["magic"]): boolean {
  switch (kind) {
    case "jpeg":
      return startsWith(buf, [0xff, 0xd8, 0xff]);
    case "png":
      return startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "gif":
      return startsWith(buf, [0x47, 0x49, 0x46, 0x38]) && (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61;
    case "webp":
      return startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8);
    case "pdf":
      return startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    case "zip":
      return startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) || startsWith(buf, [0x50, 0x4b, 0x05, 0x06]);
    case "ole":
      return startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case "text":
      return !buf.subarray(0, 4096).includes(0);
  }
}

export class UploadError extends Error {}

export type StoredFile = { key: string; url: string; fileName: string; fileType: string; fileSize: number };

export function extOf(name: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

/** 驗證副檔名、MIME Type、檔案大小與檔頭，通過後才寫入儲存空間 */
export async function saveUpload(file: File, kind: "image" | "file"): Promise<StoredFile> {
  const originalName = (file.name || "file")
    .split(/[\\/]/)
    .pop()!
    .replace(/[\u0000-\u001f<>:"|?*]/g, "_")
    .slice(0, 150);
  const ext = extOf(originalName);
  const rule = RULES[ext];
  if (!rule || (kind === "image" && !IMAGE_EXTS.has(ext))) {
    throw new UploadError(
      kind === "image" ? "圖片僅支援 JPG、PNG、WebP、GIF 格式。" : `不支援的檔案格式${ext ? `（.${ext}）` : ""}。`,
    );
  }
  const max = kind === "image" ? IMAGE_MAX_BYTES : FILE_MAX_BYTES;
  if (file.size === 0) throw new UploadError("檔案是空的。");
  if (file.size > max) throw new UploadError(`檔案超過 ${Math.round(max / 1024 / 1024)}MB 上限。`);

  const clientMime = (file.type || "").toLowerCase();
  const mimeOk =
    rule.accept.includes(clientMime) ||
    // 部分作業系統對 Office 文件不會回報 MIME，改由檔頭把關
    (!IMAGE_EXTS.has(ext) && (clientMime === "" || clientMime === "application/octet-stream"));
  if (!mimeOk) throw new UploadError("檔案類型與副檔名不符。");

  const data = await file.arrayBuffer();
  if (!checkMagic(new Uint8Array(data, 0, Math.min(data.byteLength, 4096)), rule.magic)) {
    throw new UploadError("檔案內容與副檔名不符，請確認檔案沒有損壞。");
  }

  const now = new Date();
  const random = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
  const key = [
    kind === "image" ? "images" : "docs",
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${random}.${ext}`,
  ].join("/");
  await env().FILES.put(key, data);
  return { key, url: `/files/${key}`, fileName: originalName, fileType: ext, fileSize: data.byteLength };
}

export function mimeForKey(key: string): string {
  return RULES[extOf(key)]?.mime ?? "application/octet-stream";
}

export function isImageKey(key: string): boolean {
  return IMAGE_EXTS.has(extOf(key));
}

/** 只接受我們自己產生的 key 格式 */
export function isValidKey(key: string): boolean {
  return /^(images|docs)\/\d{4}\/\d{2}\/[a-f0-9]{24}\.[a-z0-9]{1,5}$/.test(key);
}

export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("/files/")) return null;
  const key = url.slice("/files/".length);
  return isValidKey(key) ? key : null;
}

export async function getObject(key: string): Promise<ArrayBuffer | null> {
  if (!isValidKey(key)) return null;
  return env().FILES.get(key, "arrayBuffer");
}

export async function deleteObject(key: string): Promise<void> {
  if (isValidKey(key)) await env().FILES.delete(key);
}
