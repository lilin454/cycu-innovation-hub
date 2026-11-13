// 本機開發用 PostgreSQL（不需要另外安裝 Docker 或 PostgreSQL）
// 用法：npm run db:start   （保持這個視窗開著，Ctrl+C 可停止）
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Windows 上 PostgreSQL 對含非英文字元的路徑支援不佳，預設把資料放在純英文路徑
const defaultDir =
  process.platform === "win32"
    ? path.join(process.env.SystemDrive || "C:", "\\cycu-board-pgdata")
    : path.join(os.homedir(), ".cycu-board-pgdata");
const dataDir = process.env.DEV_PG_DATA_DIR || defaultDir;
const port = Number(process.env.DEV_PG_PORT || 54329);
const dbName = "cycu_board";

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
  onLog: () => {},
  onError: (e) => console.error(String(e)),
});

const fresh = !fs.existsSync(path.join(dataDir, "PG_VERSION"));
if (fresh) {
  console.log(`[dev-db] 初始化資料庫於 ${dataDir} ...`);
  await pg.initialise();
}
await pg.start();
if (fresh) await pg.createDatabase(dbName);
console.log(`[dev-db] PostgreSQL 已啟動：postgresql://postgres:postgres@localhost:${port}/${dbName}`);
console.log("[dev-db] 按 Ctrl+C 停止");

const stop = async () => {
  await pg.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
