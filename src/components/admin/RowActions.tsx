"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteAnnouncement, duplicateAnnouncement, setAnnouncementStatus, toggleFlag } from "@/app/admin/actions";
import type { StatusKey } from "@/lib/constants";
import { copyWithToast, toast } from "@/components/Toaster";
import { ConfirmDialog } from "./ConfirmDialog";

export function RowActions({
  id,
  title,
  status,
  isPinned,
  isFeatured,
  url,
  shareText,
  canDelete,
  hasSurvey,
}: {
  id: string;
  title: string;
  status: StatusKey;
  isPinned: boolean;
  isFeatured: boolean;
  url: string;
  shareText: string;
  canDelete: boolean;
  hasSurvey: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMessage: string, after?: () => void) => {
    setOpen(false);
    start(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          toast(res.error ?? "操作失敗。", "error");
          return;
        }
        toast(okMessage);
        if (after) after();
        else router.refresh();
      } catch {
        toast("網路連線錯誤，請稍後再試。", "error");
      }
    });
  };

  const duplicate = () => {
    setOpen(false);
    start(async () => {
      try {
        const res = await duplicateAnnouncement(id);
        if (!res.ok) {
          toast(res.error, "error");
          return;
        }
        toast("已複製為新草稿，請修改日期與報名資訊");
        router.push(`/admin/announcements/${res.id}`);
      } catch {
        toast("網路連線錯誤，請稍後再試。", "error");
      }
    });
  };

  const item = "block w-full px-3 py-2 text-left text-sm font-medium hover:bg-sun-soft disabled:opacity-40";

  return (
    <div ref={ref} className="relative flex items-center justify-start gap-1.5 xl:justify-end">
      <Link href={`/admin/announcements/${id}`} className="btn btn-sm bg-white">編輯</Link>
      <button
        type="button"
        className="btn btn-sm bg-white"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`「${title}」的更多操作`}
        disabled={pending}
        onClick={() => {
          // 靠近畫面底部時改為向上展開，避免選單被切掉
          const rect = ref.current?.getBoundingClientRect();
          setDropUp(Boolean(rect && window.innerHeight - rect.bottom < 400 && rect.top > 400));
          setOpen((v) => !v);
        }}
      >
        {pending ? "…" : "操作 ▾"}
      </button>

      {open && (
        <div role="menu" className={`absolute left-0 z-20 w-44 xl:left-auto xl:right-0 ${dropUp ? "bottom-full mb-1" : "top-full mt-1"} border-2 border-ink bg-white py-1 shadow-[4px_4px_0_var(--color-ink)]`}>
          <Link role="menuitem" className={item} href={`/admin/announcements/${id}/preview`} target="_blank">預覽</Link>
          {hasSurvey && <Link role="menuitem" className={item} href={`/admin/announcements/${id}/responses`}>問卷回覆</Link>}
          <button role="menuitem" type="button" className={item} onClick={duplicate}>複製公告</button>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); void copyWithToast(url, "已複製活動網址"); }}>複製網址</button>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); void copyWithToast(shareText, "已複製分享文案"); }}>複製分享文案</button>
          <hr className="my-1 border-line" />
          <button role="menuitem" type="button" className={item} onClick={() => run(() => toggleFlag(id, "isPinned"), isPinned ? "已取消置頂" : "已置頂")}>
            {isPinned ? "取消置頂" : "設為置頂"}
          </button>
          <button role="menuitem" type="button" className={item} onClick={() => run(() => toggleFlag(id, "isFeatured"), isFeatured ? "已取消精選" : "已設為精選")}>
            {isFeatured ? "取消精選" : "設為精選"}
          </button>
          <hr className="my-1 border-line" />
          {status === "PUBLISHED" ? (
            <button role="menuitem" type="button" className={item} onClick={() => run(() => setAnnouncementStatus(id, "UNPUBLISHED"), "已下架")}>下架</button>
          ) : (
            <button role="menuitem" type="button" className={item} onClick={() => run(() => setAnnouncementStatus(id, "PUBLISHED"), "發布成功")}>立即發布</button>
          )}
          {status !== "ARCHIVED" ? (
            <button role="menuitem" type="button" className={item} onClick={() => run(() => setAnnouncementStatus(id, "ARCHIVED"), "已封存")}>封存</button>
          ) : (
            <button role="menuitem" type="button" className={item} onClick={() => run(() => setAnnouncementStatus(id, "DRAFT"), "已移回草稿")}>移回草稿</button>
          )}
          {canDelete && <button role="menuitem" type="button" className={`${item} font-bold text-danger`} onClick={() => { setOpen(false); setConfirming(true); }}>刪除…</button>}
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="確定要刪除這則公告嗎？"
        confirmLabel="永久刪除"
        danger
        busy={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => run(() => deleteAnnouncement(id), "公告已刪除", () => { setConfirming(false); router.refresh(); })}
      >
        <p>「{title}」以及它的圖片、附件都會被永久刪除，<b>無法復原</b>，已分享出去的連結也會失效。</p>
        <p className="mt-2 text-muted">如果只是暫時不想公開，建議改用「下架」或「封存」。</p>
      </ConfirmDialog>
    </div>
  );
}
