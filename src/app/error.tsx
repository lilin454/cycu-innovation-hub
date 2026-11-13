"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-lg border-2 border-ink bg-white p-8 shadow-[8px_8px_0_var(--color-sun)]">
        <p className="eyebrow text-flame-dark">Something went wrong</p>
        <h1 className="mt-2 text-3xl font-black">網站暫時出了點狀況</h1>
        <p className="mt-3 text-muted">
          資料暫時無法載入，可能是網路或伺服器連線問題。請稍後再試一次；如果問題持續發生，請聯絡創創社。
        </p>
        {error.digest && <p className="mt-3 font-mono text-xs text-muted">錯誤代碼：{error.digest}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn btn-ink" onClick={reset}>重新載入</button>
          {/* 發生錯誤時用完整重新載入回首頁，比前端路由更可靠 */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="btn">回首頁</a>
        </div>
      </div>
    </div>
  );
}
