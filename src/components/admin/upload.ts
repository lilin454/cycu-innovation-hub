"use client";

import { FILE_MAX_BYTES, IMAGE_MAX_BYTES } from "@/lib/constants";

export type Uploaded = { url: string; fileName: string; fileType: string; fileSize: number };

/** 上傳單一檔案到後台 API；失敗時丟出可直接顯示給使用者的訊息 */
export async function uploadFile(file: File, kind: "image" | "file"): Promise<Uploaded> {
  const max = kind === "image" ? IMAGE_MAX_BYTES : FILE_MAX_BYTES;
  if (file.size > max) throw new Error(`「${file.name}」超過 ${Math.round(max / 1024 / 1024)}MB 上限。`);
  const body = new FormData();
  body.append("file", file);
  body.append("kind", kind);
  let res: Response;
  try {
    res = await fetch("/api/admin/upload", { method: "POST", body });
  } catch {
    throw new Error("網路連線錯誤，上傳失敗。");
  }
  let data: { error?: string } & Partial<Uploaded> = {};
  try {
    data = await res.json();
  } catch {
    // 非 JSON 回應
  }
  if (!res.ok || !data.url) throw new Error(data.error || `上傳失敗（${res.status}）。`);
  return data as Uploaded;
}
