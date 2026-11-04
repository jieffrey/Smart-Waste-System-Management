import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Pagination } from "@/components/ui/Pagination";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportsTable } from "@/components/reports/ReportsTable";
import { ErrorState } from "@/components/ui/ErrorState";
import { listReports } from "@/lib/admin-data";
import { ApiError } from "@/lib/api";
import { hasActiveFilters, parseReportFilters, REPORTS_PAGE_SIZE, reportsHref, type ReportFilters as Filters } from "@/lib/report-filters";

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Reports</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading reports…</p>}>
        <ReportsContent searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function ReportsContent({ searchParams }: { searchParams: PageProps<"/reports">["searchParams"] }) {
  const filters = parseReportFilters(await searchParams);

  return (
    <div className="space-y-4">
      <ReportFilters filters={filters} />
      {/* Keyed by the URL, so changing a filter shows the loading state for the results only. */}
      <Suspense key={reportsHref(filters)} fallback={<p className="text-sm text-zinc-500">Loading reports…</p>}>
        <ReportsResults filters={filters} />
      </Suspense>
    </div>
  );
}

async function ReportsResults({ filters }: { filters: Filters }) {
  let data: Awaited<ReturnType<typeof listReports>>;
  try {
    data = await listReports(filters);
  } catch (error) {
    // Only API errors become an error state; redirects (expired session) must pass through.
    if (error instanceof ApiError) {
      return <ErrorState title="Couldn't load the reports" message={error.message} />;
    }
    throw error;
  }

  const { reports, pagination } = data;
  const totalPages = Math.max(1, Math.ceil(pagination.total / REPORTS_PAGE_SIZE));

  // A page past the end (e.g. ?page=999 or after filtering): go to the last page that exists.
  if (reports.length === 0 && filters.page > totalPages) {
    redirect(reportsHref({ ...filters, page: totalPages }));
  }

  if (pagination.total === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
        {hasActiveFilters(filters) ? "No reports match these filters." : "No reports yet."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ReportsTable reports={reports} />
      <Pagination
        page={filters.page}
        totalPages={totalPages}
        total={pagination.total}
        noun={{ one: "report", many: "reports" }}
        hrefForPage={(page) => reportsHref({ ...filters, page })}
      />
    </div>
  );
}
