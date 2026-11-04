import Link from "next/link";
import { reportsHref, type ReportFilters } from "@/lib/report-filters";

type Props = { filters: ReportFilters; total: number; totalPages: number };

const linkClass = "rounded border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-100";
const disabledClass = "rounded border border-zinc-200 px-3 py-1.5 text-zinc-400";

export function Pagination({ filters, total, totalPages }: Props) {
  const { page } = filters;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
      <p className="text-zinc-600">
        Page {page} of {totalPages} · {total} {total === 1 ? "report" : "reports"}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={reportsHref({ ...filters, page: page - 1 })} className={linkClass}>
            Previous
          </Link>
        ) : (
          <span className={disabledClass}>Previous</span>
        )}
        {page < totalPages ? (
          <Link href={reportsHref({ ...filters, page: page + 1 })} className={linkClass}>
            Next
          </Link>
        ) : (
          <span className={disabledClass}>Next</span>
        )}
      </div>
    </nav>
  );
}
