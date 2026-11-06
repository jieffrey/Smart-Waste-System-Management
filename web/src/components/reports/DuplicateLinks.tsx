import Link from "next/link";
import { StatusMarker } from "@/components/ui/StatusMarker";
import { formatDateTime } from "@/lib/format";
import type { AdminReportDetail } from "@/types/api";

function shortId(id: string) {
  return `#${id.slice(0, 8)}`;
}

// "Possible duplicate" links on the report detail, in both directions: the earlier report this one may
// duplicate, and the later reports that were linked to this one. Hidden when there are none.
export function DuplicateLinks({ report }: { report: AdminReportDetail }) {
  const later = report.possible_duplicates ?? [];
  if (!report.possible_duplicate_of && later.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-ink pt-4">
      <p className="label-micro text-gray-600">Possible duplicate</p>
      {report.possible_duplicate_of && (
        <p className="mt-2 text-small text-ink">
          An open report of the same category was made within 50 m in the 24 hours before this one:{" "}
          <Link href={`/reports/${report.possible_duplicate_of}`} className="font-mono font-semibold underline underline-offset-2">
            {shortId(report.possible_duplicate_of)}
          </Link>
          . Check both before routing; one crew can handle them together.
        </p>
      )}
      {later.length > 0 && (
        <>
          <p className="mt-2 text-small text-ink">
            {later.length === 1 ? "A later report was" : `${later.length} later reports were`} linked to this one:
          </p>
          <ul className="mt-2 divide-y divide-gray-200 border-y border-gray-200">
            {later.map((linked) => (
              <li key={linked.id} className="flex items-center justify-between gap-4 py-2 text-small">
                <Link href={`/reports/${linked.id}`} className="font-mono font-semibold text-ink underline underline-offset-2">
                  {shortId(linked.id)}
                </Link>
                <span className="font-mono text-micro text-gray-700">{formatDateTime(linked.created_at)}</span>
                <StatusMarker status={linked.status} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
