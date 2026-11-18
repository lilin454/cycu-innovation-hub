"use client";

import { useEffect, useRef, useState } from "react";
import { copyText, toast } from "@/components/Toaster";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Guide = "ios" | "android" | "inapp" | null;

function detect() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const inApp = /Line\/|FBAN|FBAV|Instagram|Messenger|MicroMessenger|KAKAOTALK/i.test(ua);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { ios, inApp, standalone };
}

/**
 * 手機版首頁的「加到手機主畫面」按鈕。
 * - Android（Chrome、Edge、Samsung 瀏覽器）：直接跳出系統的「安裝應用程式」視窗。
 * - iPhone／iPad：Apple 不提供直接安裝的功能，改成一步一步教學（分享 → 加入主畫面）。
 * - LINE、Instagram 等 App 內建的瀏覽器不能安裝，提示改用 Safari／Chrome 開啟。
 * - 已經從主畫面開啟時不顯示。
 */
export function InstallButton() {
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [guide, setGuide] = useState<Guide>(null);
  const promptRef = useRef<PromptEvent | null>(null);
  const env = useRef({ ios: false, inApp: false, standalone: false });

  useEffect(() => {
    env.current = detect();
    setHidden(env.current.standalone);
    setReady(true);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onPrompt = (e: Event) => {
      e.preventDefault(); // 不讓瀏覽器自己跳橫幅，改由按鈕觸發
      promptRef.current = e as PromptEvent;
    };
    const onInstalled = () => {
      setHidden(true);
      setGuide(null);
      toast("已加到主畫面，之後點圖示就能開啟");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const onClick = async () => {
    const { ios, inApp } = env.current;
    if (inApp) return setGuide("inapp");
    if (ios) return setGuide("ios");
    const p = promptRef.current;
    if (p) {
      await p.prompt();
      const { outcome } = await p.userChoice;
      promptRef.current = null;
      if (outcome === "accepted") setHidden(true);
      return;
    }
    // 瀏覽器沒有提供安裝視窗（已經裝過、Firefox 等）：改用選單教學
    setGuide("android");
  };

  if (!ready || hidden) return null;

  return (
    <>
      <button type="button" onClick={onClick} className="btn w-full justify-center gap-2 bg-white md:hidden">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <rect x="6" y="2" width="12" height="20" rx="2" />
          <path d="M12 7v7m-3-3 3 3 3-3" />
        </svg>
        加到手機主畫面
      </button>

      {guide && (
        <div className="fixed inset-0 z-50 flex items-end bg-deep/60 md:hidden" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={() => setGuide(null)}>
          <div className="w-full border-t-2 border-ink bg-paper p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <img src="/icons/icon-192.png" alt="" className="h-12 w-12 border-2 border-ink" />
              <div>
                <h2 id="install-title" className="text-lg font-black">加到手機主畫面</h2>
                <p className="text-sm text-muted">之後點圖示就能直接打開創創社網站。</p>
              </div>
            </div>

            {guide === "ios" && (
              <ol className="mt-5 space-y-3 text-[0.95rem]">
                <Step n={1}>
                  點畫面下方（iPad 在右上方）的「分享」按鈕
                  <ShareIcon />
                </Step>
                <Step n={2}>往下滑，點「<b>加入主畫面</b>」</Step>
                <Step n={3}>右上角點「<b>新增</b>」就完成了</Step>
                <p className="pl-9 text-xs text-muted">用 Chrome 的話：點網址列右邊的分享按鈕，同樣選「加入主畫面」。</p>
              </ol>
            )}

            {guide === "android" && (
              <ol className="mt-5 space-y-3 text-[0.95rem]">
                <Step n={1}>點瀏覽器右上角的「⋮」選單</Step>
                <Step n={2}>選「<b>安裝應用程式</b>」或「<b>加到主畫面</b>」</Step>
                <Step n={3}>按「安裝」或「新增」就完成了</Step>
              </ol>
            )}

            {guide === "inapp" && (
              <div className="mt-5 space-y-3 text-[0.95rem]">
                <p>LINE、Instagram 裡開啟的網頁沒辦法加到主畫面。請改用手機的瀏覽器開啟：</p>
                <ol className="space-y-3">
                  <Step n={1}>點右上角（或右下角）的「⋯」選單</Step>
                  <Step n={2}>選「<b>用預設瀏覽器開啟</b>」或「<b>在 Safari／Chrome 中開啟</b>」</Step>
                  <Step n={3}>開啟後再按一次「加到手機主畫面」</Step>
                </ol>
                <button
                  type="button"
                  className="btn btn-sm bg-white"
                  onClick={async () => toast((await copyText(window.location.origin)) ? "已複製網址，可以貼到瀏覽器開啟" : "複製失敗", "info")}
                >
                  複製網址
                </button>
              </div>
            )}

            <button type="button" className="btn btn-ink mt-6 w-full justify-center" onClick={() => setGuide(null)}>知道了</button>
          </div>
        </div>
      )}
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 flex-none items-center justify-center bg-ink font-display text-sm font-black text-sun">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ml-1 inline h-5 w-5 align-[-4px] text-[#0a7aff]" fill="none" stroke="currentColor" strokeWidth="2" aria-label="分享圖示">
      <path d="M12 3v12m-4-8 4-4 4 4" />
      <path d="M6 10H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}
