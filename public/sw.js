// 創創社網站的 Service Worker：只為了讓手機可以「安裝」網站（加入主畫面）。
// 不做任何快取，所有請求照常連線，避免使用者看到舊的公告內容。
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // 不攔截：交給瀏覽器照常處理
});
