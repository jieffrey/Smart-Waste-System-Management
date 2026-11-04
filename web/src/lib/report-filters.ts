// Filters for /reports live in the URL. This file turns searchParams into safe values and back into links.
// Used on the server (page) and in the browser (filter controls), so it must not import server-only code.
import { isReportCategory, isReportStatus } from "./labels";
import type { ReportCategory, ReportStatus } from "@/types/api";

export const REPORTS_PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 100; // same limit as the backend

export type ReportFilters = {
  status?: ReportStatus;
  category?: ReportCategory;
  from?: string; // YYYY-MM-DD, a calendar date in Asia/Jakarta (the backend counts days there)
  to?: string; // YYYY-MM-DD, inclusive
  q?: string;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// Accepts only real calendar dates like 2026-11-04 (not 2026-02-31).
function parseDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isReal = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isReal ? value : undefined;
}

function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

// Invalid or unknown values are dropped, so a hand-edited URL never breaks the page.
export function parseReportFilters(params: SearchParams): ReportFilters {
  const status = first(params.status);
  const category = first(params.category);
  const from = parseDate(first(params.from));
  let to = parseDate(first(params.to));
  // The backend rejects to < from; keep "from" and drop "to".
  if (from && to && to < from) {
    to = undefined;
  }
  const q = first(params.q)?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined;

  return {
    status: isReportStatus(status) ? status : undefined,
    category: isReportCategory(category) ? category : undefined,
    from,
    to,
    q,
    page: parsePage(first(params.page)),
  };
}

export function hasActiveFilters(filters: ReportFilters) {
  return Boolean(filters.status || filters.category || filters.from || filters.to || filters.q);
}

// Link to /reports with these filters. Empty values and page 1 are left out to keep URLs short.
export function reportsHref(filters: Partial<ReportFilters>) {
  const params = new URLSearchParams();
  for (const key of ["status", "category", "from", "to", "q"] as const) {
    const value = filters[key];
    if (value) {
      params.set(key, value);
    }
  }
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }
  const query = params.toString();
  return query ? `/reports?${query}` : "/reports";
}
