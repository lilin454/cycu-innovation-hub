import { Fragment, type ReactNode } from "react";

/**
 * 公告內文顯示。內文是純文字加上少量簡易標記：
 *   # 大標題　## 小標題　- 條列　1. 編號　> 引言　---（分隔線）　**粗體**　網址會自動變成連結
 * 全部轉成 React 元素輸出，不會插入任何原始 HTML，所以不需要額外的消毒程式。
 */

const URL_RE = /(https?:\/\/[^\s<>"'）】」』]+[^\s<>"'）】」』.,;:!?。，；：！？])/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  // 先切粗體，再在每一段裡找網址
  text.split(/(\*\*[^*\n]+\*\*)/g).forEach((part, i) => {
    if (!part) return;
    const bold = /^\*\*([^*\n]+)\*\*$/.exec(part);
    const nodes = (bold ? bold[1] : part).split(URL_RE).map((seg, j) =>
      j % 2 === 1 ? (
        <a key={j} href={seg} target="_blank" rel="noopener noreferrer nofollow">
          {seg}
        </a>
      ) : (
        seg
      ),
    );
    out.push(bold ? <strong key={`${keyPrefix}-${i}`}>{nodes}</strong> : <Fragment key={`${keyPrefix}-${i}`}>{nodes}</Fragment>);
  });
  return out;
}

type Block =
  | { type: "h2" | "h3" | "p" | "quote"; lines: string[] }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "hr" };

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  const push = (b: Block | null) => {
    if (b) blocks.push(b);
  };
  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      push(current);
      current = null;
      continue;
    }
    let m: RegExpExecArray | null;
    if (/^-{3,}$/.test(line.trim())) {
      push(current);
      current = null;
      blocks.push({ type: "hr" });
    } else if ((m = /^(#{1,2})\s+(.+)$/.exec(line))) {
      push(current);
      current = null;
      blocks.push({ type: m[1].length === 1 ? "h2" : "h3", lines: [m[2]] });
    } else if ((m = /^\s*[-*•]\s+(.+)$/.exec(line))) {
      if (current?.type !== "ul") {
        push(current);
        current = { type: "ul", items: [] };
      }
      current.items.push(m[1]);
    } else if ((m = /^\s*\d{1,3}[.、)]\s*(.+)$/.exec(line))) {
      if (current?.type !== "ol") {
        push(current);
        current = { type: "ol", items: [] };
      }
      current.items.push(m[1]);
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      if (current?.type !== "quote") {
        push(current);
        current = { type: "quote", lines: [] };
      }
      current.lines.push(m[1]);
    } else {
      if (current?.type !== "p") {
        push(current);
        current = { type: "p", lines: [] };
      }
      current.lines.push(line);
    }
  }
  push(current);
  return blocks;
}

function lines(list: string[], key: string): ReactNode[] {
  return list.flatMap((l, i) => (i === 0 ? inline(l, `${key}-${i}`) : [<br key={`${key}-br-${i}`} />, ...inline(l, `${key}-${i}`)]));
}

export function Content({ text }: { text: string }) {
  const blocks = parse(text);
  if (!blocks.length) return null;
  return (
    <div className="rich">
      {blocks.map((b, i) => {
        const k = `b${i}`;
        switch (b.type) {
          case "hr":
            return <hr key={k} />;
          case "h2":
            return <h2 key={k}>{inline(b.lines[0], k)}</h2>;
          case "h3":
            return <h3 key={k}>{inline(b.lines[0], k)}</h3>;
          case "quote":
            return <blockquote key={k}>{lines(b.lines, k)}</blockquote>;
          case "ul":
            return <ul key={k}>{b.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}</ul>;
          case "ol":
            return <ol key={k}>{b.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}</ol>;
          default:
            return <p key={k}>{lines(b.lines, k)}</p>;
        }
      })}
    </div>
  );
}
