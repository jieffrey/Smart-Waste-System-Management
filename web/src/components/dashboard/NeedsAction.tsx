import Link from "next/link";
import { CountUp } from "@/components/motion/CountUp";
import { buttonVariants } from "@/components/ui/button";
import { weekSummary } from "@/lib/dashboard";
import type { Stats } from "@/types/api";
import { ColorBlock } from "./ColorBlock";

function Delta({ now, before }: { now: number; before: number }) {
  const diff = now - before;
  if (diff === 0) {
    return <>same as last week</>;
  }
  return (
    <>
      {diff > 0 ? "+" : "−"}
      {Math.abs(diff)} vs last week
    </>
  );
}

// The first thing an admin sees, as a red-orange block: how many reports wait for a crew (the screen's key
// number, in ink on red orange: 5.57:1), how this week compares, and the one action, as an ink button.
export function NeedsAction({ stats }: { stats: Stats }) {
  const { pending, in_progress } = stats.totals.by_status;
  const week = weekSummary(stats.reports_per_day);

  return (
    <ColorBlock color="signal" aria-label="Needs action now" className="flex flex-col">
      <p className="text-heading font-semibold">Needs action now</p>
      <p className="tracking-display mt-2 text-display font-extrabold">
        <CountUp value={pending} />
      </p>
      <p className="mt-2 text-heading font-semibold">{pending === 1 ? "report is" : "reports are"} waiting for a crew</p>
      <p className="mt-1 text-small">
        <span className="font-mono">{in_progress}</span> already in progress.
      </p>
      {(stats.needs_review?.count ?? 0) > 0 && (
        <Link
          href="/reports?flag=needs_review"
          className="mt-3 flex w-fit items-center gap-2 bg-ink px-2 py-1 text-small font-semibold text-highlight underline-offset-4 hover:underline"
        >
          <span className="font-mono">{stats.needs_review.count}</span>
          {stats.needs_review.count === 1 ? "needs" : "need"} review: the AI was unsure →
        </Link>
      )}

      <dl className="mt-6 grid grid-cols-2 border-t border-ink">
        <div className="border-r border-ink py-3 pr-3">
          <dt className="label-micro">New this week</dt>
          <dd className="mt-1 font-mono text-heading font-semibold">
            <CountUp value={week.newThisWeek} />
          </dd>
          <dd className="font-mono text-micro">
            <Delta now={week.newThisWeek} before={week.newLastWeek} />
          </dd>
        </div>
        <div className="py-3 pl-3">
          <dt className="label-micro">Completed this week</dt>
          <dd className="mt-1 font-mono text-heading font-semibold">
            <CountUp value={week.completedThisWeek} />
          </dd>
          <dd className="font-mono text-micro">
            <Delta now={week.completedThisWeek} before={week.completedLastWeek} />
          </dd>
        </div>
      </dl>

      <Link href="/reports?status=pending" className={`${buttonVariants({ variant: "ink" })} mt-6 w-full`}>
        Review pending reports
      </Link>
    </ColorBlock>
  );
}
