// Pure helpers that turn GET /api/admin/stats into what the dashboard shows. No React, no fetching.
import { CATEGORY_LABELS, REPORT_CATEGORIES } from "./labels";
import type { ReportCategory, Stats } from "@/types/api";

type Day = Stats["reports_per_day"][number];

// The last 7 days (today included) vs the 7 days before, from the 30-day series.
export function weekSummary(days: Day[]) {
  const sum = (slice: Day[], key: "count" | "completed_count") => slice.reduce((total, day) => total + day[key], 0);
  const thisWeek = days.slice(-7);
  const lastWeek = days.slice(-14, -7);
  return {
    newThisWeek: sum(thisWeek, "count"),
    newLastWeek: sum(lastWeek, "count"),
    completedThisWeek: sum(thisWeek, "completed_count"),
    completedLastWeek: sum(lastWeek, "completed_count"),
  };
}

// Handling flow as a funnel: how many reports reached each step. Rejected reports leave the flow, so
// they are reported next to it, not as a step.
export function handlingFunnel(byStatus: Stats["totals"]["by_status"]) {
  const reachedPending = byStatus.pending + byStatus.in_progress + byStatus.completed;
  const reachedInProgress = byStatus.in_progress + byStatus.completed;
  return {
    stages: [
      { label: "Reported", value: reachedPending },
      { label: "In progress", value: reachedInProgress },
      { label: "Completed", value: byStatus.completed },
    ],
    rejected: byStatus.rejected,
  };
}

// AI category -> current category as Sankey nodes and links. Only pairs with reports are drawn
// (empty nodes would collapse to nothing anyway). Node names are what the chart shows as labels.
export function aiFlowSankey(flow: Stats["ai_flow"]) {
  const used = flow.filter((pair) => pair.count > 0);
  const sources = REPORT_CATEGORIES.filter((category) => used.some((pair) => pair.ai_category === category));
  const targets = REPORT_CATEGORIES.filter((category) => used.some((pair) => pair.category === category));

  const nodes = [
    ...sources.map((category) => ({ name: `AI: ${CATEGORY_LABELS[category]}`, category, side: "ai" as const })),
    ...targets.map((category) => ({ name: `Final: ${CATEGORY_LABELS[category]}`, category, side: "final" as const })),
  ];
  const links = used.map((pair) => ({
    source: sources.indexOf(pair.ai_category),
    target: sources.length + targets.indexOf(pair.category),
    value: pair.count,
    corrected: pair.ai_category !== pair.category,
    to: pair.category,
  }));

  const total = used.reduce((sum, pair) => sum + pair.count, 0);
  const corrected = used.filter((pair) => pair.ai_category !== pair.category).reduce((sum, pair) => sum + pair.count, 0);
  return { nodes, links, total, corrected };
}

export type SankeyNodeInfo = { name: string; category: ReportCategory; side: "ai" | "final" };
