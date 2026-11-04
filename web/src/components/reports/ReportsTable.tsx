import Link from "next/link";
import { formatDateTime, formatPercent } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/labels";
import { reportDetailHref, type ReportFilters } from "@/lib/report-filters";
import type { AdminReport } from "@/types/api";
import { ReportThumbnail } from "./ReportThumbnail";
import { StatusMarker } from "@/components/ui/StatusMarker";

function location(report: AdminReport) {
  return report.address || `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`;
}

// Each row links to the report detail: the link sits on the reporter cell and stretches over the whole row.
export function ReportsTable({ reports, filters }: { reports: AdminReport[]; filters: ReportFilters }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full min-w-[900px] text-small">
        <thead className="border-b border-zinc-200 text-left text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-normal">Photo</th>
            <th className="px-3 py-2 font-normal">Reporter</th>
            <th className="px-3 py-2 font-normal">Category</th>
            <th className="px-3 py-2 font-normal">AI confidence</th>
            <th className="px-3 py-2 font-normal">Status</th>
            <th className="px-3 py-2 font-normal">Location</th>
            <th className="px-3 py-2 font-normal">Created (WIB)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {reports.map((report) => (
            <tr key={report.id} className="relative hover:bg-zinc-50">
              <td className="px-3 py-2">
                <ReportThumbnail imageUrl={report.image_url} />
              </td>
              <td className="px-3 py-2">
                <Link
                  href={reportDetailHref(report.id, filters)}
                  className="font-medium after:absolute after:inset-0 after:content-[''] focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-zinc-900"
                >
                  {report.reporter_name}
                </Link>
                <p className="text-zinc-500">{report.reporter_email}</p>
              </td>
              <td className="px-3 py-2">{CATEGORY_LABELS[report.category]}</td>
              <td className="px-3 py-2">
                {report.ai_confidence === null ? <span className="text-zinc-400">—</span> : formatPercent(report.ai_confidence)}
              </td>
              <td className="px-3 py-2">
                <StatusMarker status={report.status} />
              </td>
              <td className="max-w-56 truncate px-3 py-2" title={location(report)}>
                {location(report)}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(report.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
