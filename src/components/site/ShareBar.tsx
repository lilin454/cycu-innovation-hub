"use client";

import { useEffect, useState } from "react";
import { copyWithToast, toast } from "@/components/Toaster";

/** 活動分享：複製網址、複製轉傳文案、LINE、Facebook、系統原生分享 */
export function ShareBar({
  url,
  title,
  shareText,
  variant = "panel",
}: {
  url: string;
  title: string;
  shareText: string;
  variant?: "panel" | "compact";
}) {
  const [canNative, setCanNative] = useState(false);
  const [showText, setShowText] = useState(false);
  useEffect(() => setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  const line = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text: shareText, url });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast("這個裝置無法開啟分享選單，請改用複製。", "error");
    }
  };

  if (variant === "compact") {
    return (
      <div className="flex gap-2">
        <button type="button" className="btn flex-1 !px-2" onClick={() => copyWithToast(shareText, "已複製轉傳文案，可以直接貼到 LINE 了")}>
          複製文案
        </button>
        {canNative ? (
          <button type="button" className="btn flex-1 !px-2" onClick={nativeShare}>分享</button>
        ) : (
          <button type="button" className="btn flex-1 !px-2" onClick={() => copyWithToast(url, "已複製活動網址")}>複製網址</button>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby="share-title" className="border-2 border-ink bg-sun-soft">
      <div className="flex items-center justify-between border-b-2 border-ink bg-sun px-4 py-2">
        <h2 id="share-title" className="font-black">分享這個活動</h2>
        <span className="eyebrow text-[0.6rem]">Share</span>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-stretch border-2 border-ink bg-white">
          <p className="min-w-0 flex-1 truncate px-3 py-2 font-mono text-[0.8rem]" title={url}>{url}</p>
          <button
            type="button"
            className="flex-none border-l-2 border-ink bg-ink px-3 text-sm font-bold text-paper hover:bg-flame-dark"
            onClick={() => copyWithToast(url, "已複製活動網址")}
          >
            複製網址
          </button>
        </div>
        <button
          type="button"
          className="btn btn-ink w-full"
          onClick={() => copyWithToast(shareText, "已複製轉傳文案，可以直接貼到 LINE 了")}
        >
          一鍵複製轉傳文案
        </button>
        <div className={`grid gap-2 ${canNative ? "grid-cols-3" : "grid-cols-2"}`}>
          <a className="btn btn-sm bg-white" href={line} target="_blank" rel="noopener noreferrer">LINE</a>
          <a className="btn btn-sm bg-white" href={fb} target="_blank" rel="noopener noreferrer">Facebook</a>
          {canNative && (
            <button type="button" className="btn btn-sm bg-white" onClick={nativeShare}>更多…</button>
          )}
        </div>
        <button
          type="button"
          className="text-sm font-bold underline underline-offset-4"
          aria-expanded={showText}
          onClick={() => setShowText((v) => !v)}
        >
          {showText ? "收合文案預覽" : "預覽轉傳文案"}
        </button>
        {showText && (
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-2 border-ink bg-white p-3 font-sans text-[0.85rem] leading-relaxed">
            {shareText}
          </pre>
        )}
      </div>
    </section>
  );
}
