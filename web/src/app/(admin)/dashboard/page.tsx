import { Suspense } from "react";
import { AiAccuracyCard } from "@/components/dashboard/AiAccuracyCard";
import { CategoryCounts } from "@/components/dashboard/CategoryCounts";
import { ReportsPerDayTable } from "@/components/dashboard/ReportsPerDayTable";
import { StatusCards } from "@/components/dashboard/StatusCards";
import { ErrorState } from "@/components/ui/ErrorState";
import { getStats } from "@/lib/admin-data";
import { ApiError } from "@/lib/api";
import type { Stats } from "@/types/api";

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading statistics…</p>}>
        <DashboardContent />
      </Suspense>
    </section>
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

  return (
    <div className="space-y-6">
      <StatusCards totals={stats.totals} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <CategoryCounts byCategory={stats.totals.by_category} />
          <AiAccuracyCard aiAccuracy={stats.ai_accuracy} />
        </div>
        <ReportsPerDayTable days={stats.reports_per_day} />
      </div>
    </div>
  );
}
