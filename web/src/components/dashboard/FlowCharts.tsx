"use client";

import { FunnelChart } from "@/components/charts/funnel-chart";
import { Gauge } from "@/components/charts/gauge";
import { Ring } from "@/components/charts/ring";
import { RingCenter } from "@/components/charts/ring-center";
import { RingChart } from "@/components/charts/ring-chart";
import { SankeyChart, SankeyLink, SankeyNode, SankeyTooltip } from "@/components/charts/sankey";
import { CATEGORY_COLORS } from "@/lib/categories";
import { CATEGORY_LABELS, REPORT_CATEGORIES } from "@/lib/labels";
import type { aiFlowSankey } from "@/lib/dashboard";
import type { ReportCategory } from "@/types/api";

// Handling flow: reported -> in progress -> completed, as solid ink stages (no grey slabs). Labels and
// values sit in a row underneath, because text inside ink stages would need its own colors.
export function HandlingFunnel({ stages }: { stages: { label: string; value: number }[] }) {
  return (
    <div>
      <FunnelChart
        data={stages}
        color="#121212"
        layers={1}
        edges="straight"
        gap={3}
        grid={false}
        showPercentage
        showValues={false}
        showLabels={false}
        className="h-44"
      />
      <ol className="mt-3 grid grid-cols-3">
        {stages.map((stage) => (
          <li key={stage.label} className="border-l border-ink pl-3">
            <p className="font-mono text-heading font-semibold text-ink">{stage.value}</p>
            <p className="text-small text-gray-700">{stage.label}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

// AI accuracy as a notched gauge, drawn in ink on the yellow block (15.34:1); the track is ink at low opacity.
export function AiAccuracyGauge({ percent }: { percent: number }) {
  return (
    <Gauge
      value={percent}
      totalNotches={30}
      notchCornerRadius={0}
      uniformWidth
      activeFill="#121212"
      inactiveFill="#121212"
      activeFillOpacity={1}
      inactiveFillOpacity={0.14}
      centerValue={percent}
      suffix="%"
      defaultLabel="AI kept"
      formatOptions={{ maximumFractionDigits: 1 }}
      className="mx-auto max-w-72"
    />
  );
}

// Category composition: one ring per category (share of all reports), in the category colors.
export function CategoryRing({ byCategory, total }: { byCategory: Record<ReportCategory, number>; total: number }) {
  const data = REPORT_CATEGORIES.map((category) => ({
    label: CATEGORY_LABELS[category],
    value: byCategory[category] ?? 0,
    maxValue: Math.max(total, 1),
    color: CATEGORY_COLORS[category].hex,
  }));
  return (
    <RingChart data={data} strokeWidth={14} ringGap={6} baseInnerRadius={48} className="mx-auto aspect-square max-w-64">
      {data.map((ring, index) => (
        <Ring key={ring.label} index={index} color={ring.color} showGlow={false} lineCap="butt" />
      ))}
      <RingCenter defaultLabel="reports" valueClassName="font-mono text-heading font-semibold text-ink" labelClassName="label-micro text-gray-600" />
    </RingChart>
  );
}

// AI category -> final category. Flows the AI got right are drawn in their category color at 25% opacity;
// corrections at full color (the category the admin corrected them to), so they stand out at a glance.
export function AiFlowSankey({ data }: { data: ReturnType<typeof aiFlowSankey> }) {
  const { nodes, links } = data;
  return (
    <SankeyChart
      data={{
        nodes: nodes.map((node) => ({ name: node.name, category: node.side === "ai" ? ("source" as const) : ("outcome" as const) })),
        links: links.map(({ source, target, value }) => ({ source, target, value })),
      }}
      aspectRatio="2 / 1"
      nodeWidth={12}
      nodePadding={20}
      margin={{ top: 16, right: 120, bottom: 16, left: 120 }}
    >
      <SankeyLink
        useGradient={false}
        strokeOpacity={1}
        fadedOpacity={0.15}
        getLinkColor={(_link, index) => `${CATEGORY_COLORS[links[index]?.to ?? "paper"].hex}${links[index]?.corrected ? "" : "40"}`}
      />
      <SankeyNode lineCap={0} getNodeColor={(_node, index) => CATEGORY_COLORS[nodes[index]?.category ?? "paper"].hex} />
      <SankeyTooltip />
    </SankeyChart>
  );
}
