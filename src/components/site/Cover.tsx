"use client";

import { useState } from "react";

const PALETTES = [
  { bg: "#0e3a66", fg: "#f9b934" },
  { bg: "#b93c0e", fg: "#fbf7ee" },
  { bg: "#0f6f70", fg: "#fde9b5" },
  { bg: "#f9b934", fg: "#071e36" },
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * 活動封面。沒有圖片或圖片載入失敗時，改以品牌色塊＋活動類型文字呈現，
 * 版面比例固定，不會因為圖片比例不同而跑版。
 */
export function Cover({
  src,
  alt,
  seed,
  label,
  ratio = "16 / 10",
  className = "",
  priority = false,
}: {
  src?: string | null;
  alt: string;
  seed: string;
  label?: string;
  ratio?: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const p = PALETTES[hash(seed) % PALETTES.length];
  return (
    <div className={`relative overflow-hidden border-2 border-ink bg-paper-2 ${className}`} style={{ aspectRatio: ratio, containerType: "inline-size" }}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="cover-fallback absolute inset-0 flex flex-col justify-between p-[7%]"
          style={{ backgroundColor: p.bg, color: p.fg }}
          role="img"
          aria-label={alt}
        >
          <span className="eyebrow text-[0.6rem] opacity-80">CYCU_INNOVATION</span>
          <span className="font-black leading-none" style={{ fontSize: "clamp(1.3rem, 11cqw, 3.2rem)" }}>
            {label || "活動"}
          </span>
        </div>
      )}
    </div>
  );
}
