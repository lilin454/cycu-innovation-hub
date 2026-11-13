"use client";

import { useEffect, useRef } from "react";

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => e.target === ref.current && onCancel()}
      className="m-auto w-[min(92vw,28rem)] border-2 border-ink bg-white p-0 text-left text-ink shadow-[8px_8px_0_var(--color-ink)] backdrop:bg-deep/60"
    >
      <div className="p-6">
        <h2 className="text-xl font-black">{title}</h2>
        <div className="mt-3 text-sm leading-relaxed">{children}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-sm" onClick={onCancel} disabled={busy}>取消</button>
          <button type="button" className={`btn btn-sm ${danger ? "border-danger bg-danger text-white hover:!bg-ink" : "btn-ink"}`} onClick={onConfirm} disabled={busy}>
            {busy ? "處理中…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
