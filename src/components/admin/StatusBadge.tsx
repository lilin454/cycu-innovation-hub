import { STATUS_LABEL, type StatusKey } from "@/lib/constants";

const STYLE: Record<StatusKey, string> = {
  DRAFT: "border-muted text-muted bg-white",
  SCHEDULED: "border-teal-dark text-teal-dark bg-white",
  PUBLISHED: "border-ok bg-ok text-white",
  UNPUBLISHED: "border-flame-dark text-flame-dark bg-white",
  ARCHIVED: "border-line text-muted bg-paper-2",
};

export function StatusBadge({ status }: { status: StatusKey }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border-[1.5px] px-2 py-0.5 text-xs font-bold whitespace-nowrap ${STYLE[status]}`}>
      <span aria-hidden className="h-1.5 w-1.5 bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}
