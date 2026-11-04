import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { weekSummary } from "@/lib/dashboard";
import type { Stats } from "@/types/api";
import { VolumeArea } from "./TrendCharts";

function Delta({ now, before }: { now: number; before: number }) {
  const diff = now - before;
  if (diff === 0) {
    return <span className="text-gray-600">same as last week</span>;
  }
  return (
    <span className="text-gray-600">
      {diff > 0 ? "+" : "−"}
      {Math.abs(diff)} vs last week
    </span>
  );
}

// The first thing an admin sees: how many reports are waiting for a crew (the one red-orange number),
// how this week compares, and the single primary action.
export function NeedsAction({ stats }: { stats: Stats }) {
  const { pending, in_progress } = stats.totals.by_status;
  const week = weekSummary(stats.reports_per_day);

  return (
    <section className="flex min-w-0 flex-col border-t-2 border-ink pt-4">
      <p className="label-micro text-gray-600">Needs action now</p>
      <p className="font-wide mt-3 text-display font-extrabold tracking-tight text-signal">{pending}</p>
      <p className="mt-2 text-heading font-semibold text-ink">
        {pending === 1 ? "report is" : "reports are"} waiting for a crew
      </p>
      <p className="mt-1 text-small text-gray-700">
        <span className="font-mono">{in_progress}</span> already in progress.
      </p>

      <dl className="mt-6 grid grid-cols-2 border-t border-gray-200">
        <div className="border-r border-gray-200 py-3 pr-3">
          <dt className="label-micro text-gray-600">New this week</dt>
          <dd className="mt-1 font-mono text-heading font-semibold text-ink">{week.newThisWeek}</dd>
          <dd className="font-mono text-micro">
            <Delta now={week.newThisWeek} before={week.newLastWeek} />
          </dd>
        </div>
        <div className="py-3 pl-3">
          <dt className="label-micro text-gray-600">Completed this week</dt>
          <dd className="mt-1 font-mono text-heading font-semibold text-ink">{week.completedThisWeek}</dd>
          <dd className="font-mono text-micro">
            <Delta now={week.completedThisWeek} before={week.completedLastWeek} />
          </dd>
        </div>
      </dl>

      <Link href="/reports?status=pending" className={`${buttonVariants({ variant: "primary" })} mt-6 w-full sm:w-fit`}>
        Review pending reports
      </Link>

      <div className="mt-8">
        <p className="label-micro text-gray-600">New reports per day · 30 days</p>
        <VolumeArea days={stats.reports_per_day} />
      </div>
    </section>
  );
}
