import Link from "next/link";
import { CategoryLabel } from "@/components/ui/CategoryLabel";
import { StatusMarker } from "@/components/ui/StatusMarker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatPercent } from "@/lib/format";
import { coordinatesLabel, shortLocation } from "@/lib/location";
import { reportDetailHref, type ReportFilters } from "@/lib/report-filters";
import type { AdminReport } from "@/types/api";
import { ReportThumbnail } from "./ReportThumbnail";

// Full address (or coordinates) for the hover title of the short location.
function fullLocation(report: AdminReport) {
  return report.address || coordinatesLabel(report.latitude, report.longitude);
}

// Dense and scannable: rules instead of cards, the category and status read by shape/swatch, numbers and
// dates in mono. The link sits on the reporter cell and stretches over the whole row.
export function ReportsTable({ reports, filters }: { reports: AdminReport[]; filters: ReportFilters }) {
  return (
    <Table className="md:min-w-[880px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-14">
            <span className="sr-only">Photo</span>
          </TableHead>
          <TableHead>Reporter</TableHead>
          <TableHead>Category</TableHead>
          <TableHead numeric className="hidden md:table-cell">AI conf.</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Location</TableHead>
          <TableHead numeric className="hidden md:table-cell">Created (WIB)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.map((report) => (
          <TableRow key={report.id} className="relative">
            <TableCell className="py-2">
              <ReportThumbnail imageUrl={report.image_url} size={40} />
            </TableCell>
            <TableCell>
              <Link
                href={reportDetailHref(report.id, filters)}
                className="font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ink"
              >
                {report.reporter_name}
              </Link>
              <p className="hidden font-mono text-micro text-gray-600 md:block">{report.reporter_email}</p>
            </TableCell>
            <TableCell>
              <CategoryLabel category={report.category} />
            </TableCell>
            <TableCell numeric className="hidden md:table-cell">
              {report.ai_confidence === null ? <span className="text-gray-500">—</span> : formatPercent(report.ai_confidence)}
            </TableCell>
            <TableCell>
              <StatusMarker status={report.status} />
            </TableCell>
            <TableCell className="hidden md:table-cell max-w-56 truncate text-gray-700" title={fullLocation(report)}>
              {shortLocation(report)}
            </TableCell>
            <TableCell numeric className="hidden md:table-cell whitespace-nowrap text-gray-700">
              {formatDateTime(report.created_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
