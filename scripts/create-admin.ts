// 建立（或重設）管理員帳號
// 用法：在 .env 設定 ADMIN_ACCOUNT / ADMIN_PASSWORD / ADMIN_DISPLAY_NAME 後執行 `npm run admin:create`
// 同一個帳號再執行一次 = 重設密碼（忘記密碼時使用）
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const account = (process.env.ADMIN_ACCOUNT ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const displayName = (process.env.ADMIN_DISPLAY_NAME ?? "").trim() || "創創社管理員";
  // ADMIN_ROLE=OWNER 總管理員；EDITOR 一般管理員。未設定時：第一個帳號為總管理員，其餘為一般管理員
  const roleEnv = (process.env.ADMIN_ROLE ?? "").trim().toUpperCase();
  const forcedRole = roleEnv === "OWNER" || roleEnv === "EDITOR" ? roleEnv : null;

  // --if-missing：給正式環境啟動時使用。沒設定帳號密碼就略過；帳號已存在就不動它（不會重設密碼）
  const ifMissing = process.argv.includes("--if-missing");
  if (ifMissing && (!account || !password)) {
    console.log("[admin] 未設定 ADMIN_ACCOUNT / ADMIN_PASSWORD，略過建立管理員。");
    return;
  }

  if (!/^[a-z0-9._-]{3,64}$/.test(account)) {
    throw new Error("ADMIN_ACCOUNT 必須是 3–64 個字元的英文小寫、數字或 . _ -");
  }
  if (password.length < 10 || /請改成/.test(password)) {
    throw new Error("ADMIN_PASSWORD 至少需要 10 個字元，且不可使用範例文字。請先修改 .env。");
  }

  const existing = await db.user.findUnique({ where: { account } });
  if (existing && ifMissing) {
    console.log(`[admin] 管理員「${account}」已存在，不做變更。`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  if (existing) {
    await db.user.update({ where: { account }, data: { passwordHash, displayName, ...(forcedRole ? { role: forcedRole } : {}) } });
    await db.session.deleteMany({ where: { userId: existing.id } });
    console.log(`已重設管理員「${account}」的密碼，並登出該帳號的所有裝置。`);
  } else {
    const isFirst = (await db.user.count()) === 0;
    await db.user.create({ data: { account, passwordHash, displayName, role: forcedRole ?? (isFirst ? "OWNER" : "EDITOR") } });
    console.log(`已建立管理員「${account}」。請至 /admin/login 登入。`);
  }
  console.log("提醒：建立完成後，可以把 .env 中的 ADMIN_PASSWORD 清空。");
}

main()
  .catch((e) => {
    console.error("建立管理員失敗：", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
