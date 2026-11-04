// Display labels for report statuses and categories. Shared by the dashboard and the reports pages.
import type { ReportCategory, ReportStatus } from "@/types/api";

// Same order as the backend (pending -> in_progress -> completed/rejected).
export const REPORT_STATUSES: readonly ReportStatus[] = ["pending", "in_progress", "completed", "rejected"];
export const REPORT_CATEGORIES: readonly ReportCategory[] = ["organic", "paper", "plastic"];

export const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  rejected: "Rejected",
};

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  organic: "Organic",
  paper: "Paper",
  plastic: "Plastic",
};

export function isReportStatus(value: unknown): value is ReportStatus {
  return typeof value === "string" && (REPORT_STATUSES as readonly string[]).includes(value);
}

export function isReportCategory(value: unknown): value is ReportCategory {
  return typeof value === "string" && (REPORT_CATEGORIES as readonly string[]).includes(value);
}
