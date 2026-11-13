import "server-only";
import crypto from "node:crypto";
import { db } from "./db";

/** 產生不重複的 7 碼短網址代稱（排除容易混淆的字元） */
export async function randomSlug(): Promise<string> {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  for (let attempt = 0; attempt < 8; attempt++) {
    const bytes = crypto.randomBytes(7);
    const slug = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    if (!(await db.announcement.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return crypto.randomBytes(8).toString("hex");
}
