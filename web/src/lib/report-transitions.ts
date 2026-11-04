// Which status a report can move to next. Same rules as the backend (STATUS_TRANSITIONS in
// backend/src/modules/admin-reports/admin-reports.service.js); the backend still enforces them.
import type { ReportStatus } from "@/types/api";

export const NEXT_STATUSES: Record<ReportStatus, readonly ReportStatus[]> = {
  pending: ["in_progress", "rejected"],
  in_progress: ["completed", "rejected"],
  completed: [],
  rejected: [],
};

// Completed and rejected are final: nothing about the report can change any more.
export function isClosed(status: ReportStatus) {
  return NEXT_STATUSES[status].length === 0;
}

// Moving to one of these can't be undone, so the form asks for confirmation first.
export function isFinalStatus(status: ReportStatus) {
  return status === "completed" || status === "rejected";
}
