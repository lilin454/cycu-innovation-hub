import type { FeeTypeKey } from "@/lib/constants";
import { feeBadge } from "@/lib/format";

type Cat = { id: string; kind: "SOURCE" | "EVENT_TYPE" | "TAG"; name: string; color: string };

export function FeeTag({ feeType, feeAmount }: { feeType: FeeTypeKey; feeAmount?: number | null }) {
  return <span className={`tag ${feeType === "FREE" ? "tag-free" : "tag-paid"}`}>{feeBadge(feeType, feeAmount)}</span>;
}

/** 來源＝實心、類型＝外框、費用＝黃底／橘框；分類顏色只以小方塊點綴 */
export function TagList({
  categories,
  feeType,
  feeAmount,
  prize,
  showCustom = false,
  max,
  className = "",
}: {
  categories: Cat[];
  feeType: FeeTypeKey;
  feeAmount?: number | null;
  prize?: string | null;
  showCustom?: boolean;
  max?: number;
  className?: string;
}) {
  const sources = categories.filter((c) => c.kind === "SOURCE");
  const types = categories.filter((c) => c.kind === "EVENT_TYPE");
  const custom = showCustom ? categories.filter((c) => c.kind === "TAG") : [];
  const main = [...sources, ...types];
  const shown = max ? main.slice(0, max) : main;
  const hidden = main.length - shown.length;
  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${className}`} aria-label="活動分類">
      {prize?.trim() && (
        <li><span className="tag tag-prize">獎金｜{prize.trim()}</span></li>
      )}
      <li><FeeTag feeType={feeType} feeAmount={feeAmount} /></li>
      {shown.map((c) => (
        <li key={c.id}>
          <span className={`tag ${c.kind === "SOURCE" ? "tag-source" : "tag-type"}`}>
            <span className="tag-dot" style={{ background: c.color }} aria-hidden />
            {c.name}
          </span>
        </li>
      ))}
      {hidden > 0 && <li className="text-xs font-bold text-muted">+{hidden}</li>}
      {custom.map((c) => (
        <li key={c.id}><span className="tag tag-custom">#{c.name}</span></li>
      ))}
    </ul>
  );
}
