import { Suspense } from "react";
import { DashSection } from "@/components/dashboard/DashSection";
import { AiAccuracyGauge, AiFlowSankey, CategoryRing, HandlingFunnel } from "@/components/dashboard/FlowCharts";
import { NeedsAction } from "@/components/dashboard/NeedsAction";
import { InVsCompletedChart } from "@/components/dashboard/TrendCharts";
import { CategoryLabel } from "@/components/ui/CategoryLabel";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getStats } from "@/lib/admin-data";
import { ApiError } from "@/lib/api";
import { aiFlowSankey, handlingFunnel, weekSummary } from "@/lib/dashboard";
import { formatPercent } from "@/lib/format";
import { REPORT_CATEGORIES } from "@/lib/labels";
import type { Stats } from "@/types/api";

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <PageHeader kicker="Overview" title="Dashboard" />
      <Suspense fallback={<p className="text-small text-gray-600">Loading statistics…</p>}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

// Fetched on every request, so the numbers are always current.
async function DashboardContent() {
  let stats: Stats;
  try {
    stats = await getStats();
  } catch (error) {
    // Only API errors become an error state; redirects (expired session) must pass through.
    if (error instanceof ApiError) {
      return <ErrorState title="Couldn't load the statistics" message={error.message} />;
    }
    throw error;
  }

  const week = weekSummary(stats.reports_per_day);
  const funnel = handlingFunnel(stats.totals.by_status);
  const flow = aiFlowSankey(stats.ai_flow);
  const { accuracy, reviewed, matching } = stats.ai_accuracy;
  const keepingUp = week.completedThisWeek >= week.newThisWeek;

  return (
    <div className="space-y-12">
      {/* 1. What needs me now, and is the team keeping up? (dominant row) */}
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <NeedsAction stats={stats} />
        </div>
        <DashSection
          className="border-t-2 lg:col-span-8"
          kicker="Trend · last 30 days"
          title="Reports in vs. completed"
          takeaway={
            keepingUp
              ? "This week the team completed at least as many reports as came in."
              : `This week ${week.newThisWeek - week.completedThisWeek} more came in than were completed: the backlog is growing.`
          }
        >
          <div className="mb-2 flex gap-6 text-small text-ink">
            <span className="inline-flex items-center gap-2">
              <span className="size-3 bg-gray-300" aria-hidden="true" /> Reports in
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-0.5 w-4 bg-ink" aria-hidden="true" /> Completed
            </span>
          </div>
          <InVsCompletedChart days={stats.reports_per_day} />
        </DashSection>
      </div>

      {/* 2. Where do reports stall, and can the AI's routing be trusted? */}
      <div className="grid gap-10 lg:grid-cols-12">
        <DashSection
          className="lg:col-span-7"
          kicker="Handling speed"
          title="Handling flow"
          takeaway="How many reports reached each step."
        >
          <HandlingFunnel stages={funnel.stages} />
          <p className="mt-3 border-t border-gray-200 pt-3 text-small text-gray-700">
            <span className="font-mono text-ink">{funnel.rejected}</span> rejected (taken out of the flow, not shown as a
            step).
          </p>
        </DashSection>

        <DashSection
          className="lg:col-span-5"
          kicker="AI trust"
          title="AI accuracy"
          takeaway="Reviewed reports (in progress or completed) where the admin kept the AI's category."
        >
          {accuracy === null ? (
            <p className="py-12 text-heading font-semibold text-ink">No reviewed reports yet</p>
          ) : (
            <>
              <AiAccuracyGauge percent={Number((accuracy * 100).toFixed(1))} />
              <p className="mt-2 text-center font-mono text-small text-gray-700">
                {matching} / {reviewed} kept · {formatPercent(accuracy)}
              </p>
            </>
          )}
        </DashSection>
      </div>

      {/* 3. Patterns: where the AI gets corrected, and what kind of waste comes in */}
      <div className="grid gap-10 lg:grid-cols-12">
        <DashSection
          className="lg:col-span-8"
          kicker="AI routing"
          title="AI category → final category"
          takeaway={
            flow.total === 0
              ? undefined
              : `${flow.corrected} of ${flow.total} reports were corrected by an admin (colored flows). Gray flows are reports the AI got right.`
          }
        >
          {flow.total === 0 ? (
            <p className="py-8 text-small text-gray-600">No reports with an AI prediction yet.</p>
          ) : (
            <AiFlowSankey data={flow} />
          )}
        </DashSection>

        <DashSection className="lg:col-span-4" kicker="Composition" title="What kind of waste">
          <CategoryRing byCategory={stats.totals.by_category} total={stats.totals.reports} />
          <ul className="mt-4 divide-y divide-gray-200 border-t border-gray-200">
            {REPORT_CATEGORIES.map((category) => (
              <li key={category} className="flex items-center justify-between py-2">
                <CategoryLabel category={category} />
                <span className="font-mono text-small text-ink">{stats.totals.by_category[category]}</span>
              </li>
            ))}
          </ul>
        </DashSection>
      </div>

      {/* 4. Reserved: the region map comes in a later phase. */}
      <section aria-label="Region map (planned)" className="border-t border-ink pt-4">
        <p className="label-micro text-gray-600">Planned · next phase</p>
        <div className="mt-4 flex h-48 items-center justify-center border border-dashed border-gray-400 bg-gray-50">
          <p className="max-w-sm text-center text-small text-gray-700">
            Region map slot: where reports come from, by area. Reserved in the layout, not built yet.
          </p>
        </div>
      </section>
    </div>
  );
}
