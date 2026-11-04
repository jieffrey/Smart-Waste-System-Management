import { Pagination as SharedPagination } from "@/components/ui/Pagination";
import { reportsHref, type ReportFilters } from "@/lib/report-filters";

// The shared Pagination, with links that keep the current report filters.
export function Pagination({ filters, total, totalPages }: { filters: ReportFilters; total: number; totalPages: number }) {
  return (
    <SharedPagination
      page={filters.page}
      totalPages={totalPages}
      total={total}
      noun={{ one: "report", many: "reports" }}
      hrefForPage={(page) => reportsHref({ ...filters, page })}
    />
  );
}
