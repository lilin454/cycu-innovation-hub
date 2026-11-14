// YouTube 網址解析（純函式，前後端共用）

/** 從各種 YouTube 網址格式取出 11 碼影片 ID；不是有效的 YouTube 網址時回傳 null */
export function youtubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0];
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = /^\/(embed|shorts|live)\/([^/?]+)/.exec(url.pathname);
      id = m ? m[2] : null;
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** 使用不寫入追蹤 Cookie 的隱私加強模式網域 */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
