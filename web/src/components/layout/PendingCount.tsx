import { listReports } from "@/lib/admin-data";
import { ApiError } from "@/lib/api";

// Number of pending reports for the Reports nav item: an ink mono number on a red-orange chip
// (red-orange text on snow would fail AA at this size: 3.24:1; ink on red orange is 5.57:1).
export async function PendingCount() {
  let total: number;
  try {
    ({
      pagination: { total },
    } = await listReports({ page: 1, status: "pending" }));
  } catch (error) {
    if (error instanceof ApiError) {
      return null; // the badge is optional; the page itself shows any error
    }
    throw error;
  }
  if (total === 0) {
    return null;
  }
  return (
    <span className="bg-signal px-1.5 py-0.5 font-mono text-micro font-semibold text-ink" title={`${total} pending reports`}>
      {total}
      <span className="sr-only"> pending</span>
    </span>
  );
}
