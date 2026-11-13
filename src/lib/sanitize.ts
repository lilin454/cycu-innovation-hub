import "server-only";
import sanitizeHtml from "sanitize-html";

const COLOR = [/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i];
const PX = [/^\d{1,4}px$/];

/** 富文字內容消毒：只保留編輯器會產生的標籤與屬性，移除所有腳本與事件處理器 */
export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "h2", "h3", "h4", "p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li",
      "blockquote", "hr", "img", "table", "thead", "tbody", "tr", "th", "td", "colgroup", "col", "span", "code", "pre",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title"],
      span: ["style"],
      td: ["colspan", "rowspan", "colwidth", "style"],
      th: ["colspan", "rowspan", "colwidth", "style"],
      table: ["style"],
      col: ["style"],
    },
    allowedStyles: {
      span: { color: COLOR },
      table: { "min-width": PX, width: PX },
      col: { "min-width": PX, width: PX },
      td: { "text-align": [/^(left|right|center)$/] },
      th: { "text-align": [/^(left|right|center)$/] },
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { href: attribs.href ?? "", target: "_blank", rel: "noopener noreferrer nofollow" },
      }),
    },
  });
}

/** 取出純文字，供搜尋與 meta description 使用 */
export function htmlToText(html: string): string {
  return sanitizeHtml(html.replace(/<\/(p|h\d|li|tr|blockquote)>/gi, " "), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
