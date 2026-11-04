import { Suspense } from "react";
import Link from "next/link";
import { ReportDetail } from "@/components/reports/ReportDetail";
import { ReportUpdateForm } from "@/components/reports/ReportUpdateForm";
import { ErrorState } from "@/components/ui/ErrorState";
import { getReport } from "@/lib/admin-data";
import { ApiError } from "@/lib/api";
import { parseReportFilters, reportsHref } from "@/lib/report-filters";
import type { AdminReportDetail } from "@/types/api";

type Props = PageProps<"/reports/[id]">;

export default function ReportDetailPage({ params, searchParams }: Props) {
  return (
    <section className="space-y-4">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading report…</p>}>
        <ReportDetailContent params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function ReportDetailContent({ params, searchParams }: Props) {
  const { id } = await params;
  // The list's filters travel with the link, so "Back to reports" returns to the same filtered page.
  const backHref = reportsHref(parseReportFilters(await searchParams));
  const backLink = (
    <Link href={backHref} className="text-sm text-blue-700 hover:underline">
      ← Back to reports
    </Link>
  );

  let report: AdminReportDetail;
  try {
    ({ report } = await getReport(id));
  } catch (error) {
    // Only API errors become a message; redirects (expired session) must pass through.
    if (!(error instanceof ApiError)) {
      throw error;
    }
    if (error.status === 404) {
      return (
        <div className="space-y-4">
          {backLink}
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center">
            <h1 className="text-lg font-semibold">Report not found</h1>
            <p className="mt-1 text-sm text-zinc-500">It may have been removed, or the link is wrong.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {backLink}
        <ErrorState title="Couldn't load the report" message={error.message} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {backLink}
      <h1 className="text-xl font-semibold">Report</h1>
      <ReportDetail report={report}>
        <ReportUpdateForm report={report} />
      </ReportDetail>
    </div>
  );
}
