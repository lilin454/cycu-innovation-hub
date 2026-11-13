"use client";

import { useEffect, useState } from "react";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; message: string; kind: ToastKind };

const EVENT = "app:toast";

/** 在任何 Client Component 中呼叫，顯示操作結果提示 */
export function toast(message: string, kind: ToastKind = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind } }));
}

/** 複製文字到剪貼簿（含舊瀏覽器與非 HTTPS 環境的備援） */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 改用備援方式
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function copyWithToast(text: string, okMessage: string) {
  const ok = await copyText(text);
  toast(ok ? okMessage : "複製失敗，請手動選取文字複製。", ok ? "success" : "error");
  return ok;
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    let seq = 0;
    const onToast = (e: Event) => {
      const { message, kind } = (e as CustomEvent<{ message: string; kind: ToastKind }>).detail;
      const id = ++seq;
      setItems((prev) => [...prev.slice(-2), { id, message, kind }]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), kind === "error" ? 5000 : 2800);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-8"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex max-w-md items-center gap-3 border-2 px-4 py-2.5 text-sm font-bold shadow-[4px_4px_0_var(--color-ink)] ${
            t.kind === "error"
              ? "border-ink bg-white text-danger"
              : t.kind === "info"
                ? "border-ink bg-white text-ink"
                : "border-ink bg-sun text-deep"
          }`}
          style={{ animation: "toast-in .18s ease-out" }}
        >
          <span aria-hidden className="font-mono">
            {t.kind === "error" ? "✕" : t.kind === "info" ? "i" : "✓"}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
