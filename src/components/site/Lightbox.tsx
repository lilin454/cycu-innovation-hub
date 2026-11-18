"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Img = { src: string; alt: string };

/**
 * 站內看圖：點到帶有 data-lightbox 的圖片連結時，不開新分頁，直接在同一頁放大顯示。
 * 同一組（data-lightbox 的值相同）的圖片可以左右切換；支援方向鍵、Esc 與手機左右滑動。
 * 連結本身仍保留圖片網址，JavaScript 沒載入時照樣可以點開。
 */
export function Lightbox() {
  const [list, setList] = useState<Img[]>([]);
  const [index, setIndex] = useState(-1);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const touchX = useRef<number | null>(null);
  const open = index >= 0 && index < list.length;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-lightbox]");
      if (!a) return;
      e.preventDefault();
      const group = a.dataset.lightbox;
      const anchors = [...document.querySelectorAll<HTMLAnchorElement>("a[data-lightbox]")].filter((x) => x.dataset.lightbox === group);
      lastFocus.current = a;
      setList(anchors.map((x) => ({ src: x.href, alt: x.dataset.caption ?? x.querySelector("img")?.alt ?? "" })));
      setIndex(Math.max(0, anchors.indexOf(a)));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const close = useCallback(() => {
    setIndex(-1);
    lastFocus.current?.focus();
  }, []);
  const go = useCallback((d: number) => setIndex((i) => (list.length ? (i + d + list.length) % list.length : -1)), [list.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, go]);

  if (!open) return null;
  const img = list[index];
  const many = list.length > 1;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/90 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={img.alt || "圖片"}
      onClick={close}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null || !many) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
        <span className="font-bold tabular-nums">{many ? `${index + 1} / ${list.length}` : ""}</span>
        <div className="flex items-center gap-2">
          <a href={img.src} target="_blank" rel="noopener noreferrer" className="px-2 py-1 font-bold underline-offset-4 hover:underline">原圖 ↗</a>
          <button ref={closeRef} type="button" onClick={close} className="flex h-10 w-10 items-center justify-center text-3xl leading-none hover:text-sun" aria-label="關閉">×</button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-2 md:px-16">
        <img
          key={img.src}
          src={img.src}
          alt={img.alt}
          className="max-h-full max-w-full select-none object-contain"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />
        {many && (
          <>
            <button type="button" aria-label="上一張" onClick={(e) => (e.stopPropagation(), go(-1))} className="absolute left-1 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-black/40 text-3xl hover:bg-black/70 md:left-3">‹</button>
            <button type="button" aria-label="下一張" onClick={(e) => (e.stopPropagation(), go(1))} className="absolute right-1 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-black/40 text-3xl hover:bg-black/70 md:right-3">›</button>
          </>
        )}
      </div>

      {img.alt && (
        <p className="px-4 pb-5 text-center text-sm text-white/80" onClick={(e) => e.stopPropagation()}>{img.alt}</p>
      )}
    </div>
  );
}
