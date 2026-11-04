import { StatCard } from "@/components/ui/StatCard";
import { REPORT_STATUSES, STATUS_LABELS } from "@/lib/labels";
import type { Stats } from "@/types/api";

// Total plus one card per status. Every status is shown, with 0 when it has no reports.
export function StatusCards({ totals }: { totals: Stats["totals"] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard label="Total reports" value={totals.reports} />
      {REPORT_STATUSES.map((status) => (
        <StatCard key={status} label={STATUS_LABELS[status]} value={totals.by_status[status] ?? 0} />
      ))}
    </div>
  );
}
