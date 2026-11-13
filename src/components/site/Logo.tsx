"use client";

import { useState } from "react";

/** 社團 Logo；圖片載入失敗時顯示文字替代，不會出現破圖 */
export function Logo({ src, size = 44, className = "" }: { src: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (failed || !src) {
    return (
      <span
        style={box}
        className={`flex flex-none items-center justify-center bg-navy text-sm font-black text-sun ${className}`}
        aria-hidden
      >
        創創
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={box}
      className={`flex-none object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
