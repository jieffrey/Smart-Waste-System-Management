import { formatDay } from "@/lib/format";
import type { Stats } from "@/types/api";

// Last 30 days (Jakarta calendar days), newest first. Days without reports show 0.
export function ReportsPerDayTable({ days }: { days: Stats["reports_per_day"] }) {
  const newestFirst = [...days].reverse();
  const total = days.reduce((sum, day) => sum + day.count, 0);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-medium">Reports per day (last 30 days)</h2>
        <p className="text-sm text-zinc-500">{total} total</p>
      </div>
      <div className="mt-3 max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white text-left text-zinc-500">
            <tr>
              <th className="py-2 font-normal">Date</th>
              <th className="py-2 text-right font-normal">Reports</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {newestFirst.map((day) => (
              <tr key={day.date}>
                <td className="py-1.5">{formatDay(day.date)}</td>
                <td className={`py-1.5 text-right ${day.count === 0 ? "text-zinc-400" : "font-medium"}`}>{day.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
