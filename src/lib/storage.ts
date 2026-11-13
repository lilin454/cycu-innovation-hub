import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { FILE_MAX_BYTES, IMAGE_MAX_BYTES } from "./constants";

/**
 * 檔案儲存抽象層。
 * STORAGE_DRIVER=local → 專案下的 uploads/（開發、自架主機）
 * STORAGE_DRIVER=s3    → S3 相容物件儲存（AWS S3 / Cloudflare R2 / MinIO）
 * 不論哪一種，對外網址都是 /files/<key>，由 Route Handler 串流輸出。
 */

type FileRule = { mime: string; accept: string[]; magic: "jpeg" | "png" | "gif" | "webp" | "pdf" | "zip" | "ole" | "text" };

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
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    accept: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    magic: "zip",
  },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    accept: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    magic: "zip",
  },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    accept: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    magic: "zip",
  },
  odt: { mime: "application/vnd.oasis.opendocument.text", accept: ["application/vnd.oasis.opendocument.text"], magic: "zip" },
  ods: {
    mime: "application/vnd.oasis.opendocument.spreadsheet",
    accept: ["application/vnd.oasis.opendocument.spreadsheet"],
    magic: "zip",
  },
  odp: {
    mime: "application/vnd.oasis.opendocument.presentation",
    accept: ["application/vnd.oasis.opendocument.presentation"],
    magic: "zip",
  },
  zip: { mime: "application/zip", accept: ["application/zip", "application/x-zip-compressed"], magic: "zip" },
  txt: { mime: "text/plain; charset=utf-8", accept: ["text/plain"], magic: "text" },
  csv: { mime: "text/csv; charset=utf-8", accept: ["text/csv", "application/vnd.ms-excel", "text/plain"], magic: "text" },
};

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

function checkMagic(buf: Buffer, kind: FileRule["magic"]): boolean {
  const hex = buf.subarray(0, 12).toString("hex");
  switch (kind) {
    case "jpeg":
      return hex.startsWith("ffd8ff");
    case "png":
      return hex.startsWith("89504e470d0a1a0a");
    case "gif":
      return hex.startsWith("474946383761") || hex.startsWith("474946383961");
    case "webp":
      return hex.startsWith("52494646") && buf.subarray(8, 12).toString("ascii") === "WEBP";
    case "pdf":
      return buf.subarray(0, 5).toString("ascii") === "%PDF-";
    case "zip":
      return hex.startsWith("504b0304") || hex.startsWith("504b0506");
    case "ole":
      return hex.startsWith("d0cf11e0a1b11ae1");
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
  const originalName = path.basename(file.name || "file").replace(/[\u0000-\u001f<>:"/\\|?*]/g, "_").slice(0, 150);
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

  const buf = Buffer.from(await file.arrayBuffer());
  if (!checkMagic(buf, rule.magic)) throw new UploadError("檔案內容與副檔名不符，請確認檔案沒有損壞。");

  const now = new Date();
  const key = [
    kind === "image" ? "images" : "docs",
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${crypto.randomBytes(12).toString("hex")}.${ext}`,
  ].join("/");
  await putObject(key, buf, rule.mime);
  return { key, url: `/files/${key}`, fileName: originalName, fileType: ext, fileSize: buf.length };
}

export function mimeForKey(key: string): string {
  return RULES[extOf(key)]?.mime ?? "application/octet-stream";
}

export function isImageKey(key: string): boolean {
  return IMAGE_EXTS.has(extOf(key));
}

/** 只接受我們自己產生的 key 格式，避免路徑穿越 */
export function isValidKey(key: string): boolean {
  return /^(images|docs)\/\d{4}\/\d{2}\/[a-f0-9]{24}\.[a-z0-9]{1,5}$/.test(key);
}

export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("/files/")) return null;
  const key = url.slice("/files/".length);
  return isValidKey(key) ? key : null;
}

const driver = () => (process.env.STORAGE_DRIVER === "s3" ? "s3" : "local");
const localRoot = () => path.resolve(process.env.UPLOAD_DIR || "./uploads");

async function s3() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  const g = globalThis as unknown as { __s3?: InstanceType<typeof S3Client> };
  g.__s3 ??= new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
  });
  return g.__s3;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if (driver() === "s3") {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await s3()).send(
      new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }),
    );
    return;
  }
  const full = path.join(localRoot(), key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
}

export async function getObject(key: string): Promise<Buffer | null> {
  if (!isValidKey(key)) return null;
  try {
    if (driver() === "s3") {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const res = await (await s3()).send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
      if (!res.Body) return null;
      return Buffer.from(await res.Body.transformToByteArray());
    }
    return await fs.readFile(path.join(localRoot(), key));
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (!isValidKey(key)) return;
  try {
    if (driver() === "s3") {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      await (await s3()).send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
      return;
    }
    await fs.unlink(path.join(localRoot(), key));
  } catch {
    // 檔案已不存在就略過
  }
}
