import { Suspense } from "react";
import Link from "next/link";
import { ReportDetail } from "@/components/reports/ReportDetail";
import { ReportUpdateForm } from "@/components/reports/ReportUpdateForm";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { getReport } from "@/lib/admin-data";
import { ApiError } from "@/lib/api";
import { parseReportFilters, reportsHref } from "@/lib/report-filters";
import { cn } from "@/lib/utils";
import type { AdminReportDetail } from "@/types/api";

type Props = PageProps<"/reports/[id]">;

export default function ReportDetailPage({ params, searchParams }: Props) {
  return (
    <section className="space-y-4">
      <Suspense fallback={<p className="text-small text-gray-600">Loading report…</p>}>
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
    <Link href={backHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-0")}>
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
        <div className="space-y-6">
          {backLink}
          <EmptyState title="Report not found" hint="It may have been removed, or the link is wrong." size="page">
            <Link href={backHref} className={buttonVariants()}>
              Go to all reports
            </Link>
          </EmptyState>
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
    <div className="space-y-6">
      {backLink}
      <ReportDetail report={report}>
        <ReportUpdateForm report={report} />
      </ReportDetail>
    </div>
  );
}
