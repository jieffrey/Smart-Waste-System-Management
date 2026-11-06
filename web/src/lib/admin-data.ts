import "server-only";
import { adminRequest } from "./session";
import { REPORTS_PAGE_SIZE, type ReportFilters } from "./report-filters";
import type { AdminReport, AdminReportDetail, Pagination, Stats } from "@/types/api";

// Server-side reads of admin data. Each call goes to the backend (no caching) as the logged-in admin.

export function getStats() {
  return adminRequest<Stats>("/api/admin/stats");
}

export function listReports({ page, status, category, from, to, q, flag }: ReportFilters) {
  return adminRequest<{ reports: AdminReport[]; pagination: Pagination }>("/api/admin/reports", {
    query: {
      page,
      limit: REPORTS_PAGE_SIZE,
      status,
      category,
      from,
      to,
      q,
      needs_review: flag === "needs_review" ? "true" : undefined,
    },
  });
}

export function getReport(id: string) {
  return adminRequest<{ report: AdminReportDetail }>(`/api/admin/reports/${encodeURIComponent(id)}`);
}
