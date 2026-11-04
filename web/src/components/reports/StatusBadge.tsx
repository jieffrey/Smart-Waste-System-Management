import { STATUS_LABELS } from "@/lib/labels";
import type { ReportStatus } from "@/types/api";

const STATUS_CLASSES: Record<ReportStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  rejected: "bg-zinc-200 text-zinc-700",
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
