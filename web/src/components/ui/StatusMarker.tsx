import { STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ReportStatus } from "@/types/api";

// Status has no color: a small square that fills up as the report moves along, plus the label.
//   pending = empty, in progress = half filled, completed = filled with a check, rejected = crossed out.
function Square({ status, className }: { status: ReportStatus; className: string }) {
  return (
    <svg viewBox="0 0 12 12" className={cn("shrink-0", className)} aria-hidden="true">
      {status === "in_progress" && <rect x="0" y="6" width="12" height="6" className="fill-ink" />}
      {status === "completed" && (
        <>
          <rect x="0" y="0" width="12" height="12" className="fill-ink" />
          <path d="M2.8 6.2 5 8.4 9.3 3.8" fill="none" strokeWidth="1.6" className="stroke-snow" />
        </>
      )}
      {status === "rejected" && <path d="M1.5 1.5 10.5 10.5M10.5 1.5 1.5 10.5" strokeWidth="1.5" className="stroke-ink" />}
      <rect x="0.75" y="0.75" width="10.5" height="10.5" fill="none" strokeWidth="1.5" className="stroke-ink" />
    </svg>
  );
}

// size "lg" is for the status next to a page title (as prominent as the title deserves).
export function StatusMarker({ status, size = "sm", className }: { status: ReportStatus; size?: "sm" | "lg"; className?: string }) {
  const large = size === "lg";
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap text-ink",
        large ? "gap-3 text-heading font-bold" : "gap-2 text-small",
        className
      )}
    >
      <Square status={status} className={large ? "size-5" : "size-3"} />
      <span className={cn(status === "rejected" && "line-through decoration-1")}>{STATUS_LABELS[status]}</span>
    </span>
  );
}
