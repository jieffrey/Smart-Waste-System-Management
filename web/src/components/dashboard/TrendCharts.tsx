"use client";

import { curveLinear } from "d3-shape";
import { Area } from "@/components/charts/area";
import { AreaChart } from "@/components/charts/area-chart";
import { ComposedChart } from "@/components/charts/composed-chart";
import { Grid } from "@/components/charts/grid";
import { Line } from "@/components/charts/line";
import { SeriesBar } from "@/components/charts/series-bar";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { YAxis } from "@/components/charts/y-axis";
import type { Stats } from "@/types/api";

type Days = Stats["reports_per_day"];

// "2026-11-04" -> local midnight, so the label never shifts a day because of time zones.
function toRows(days: Days) {
  return days.map((day) => {
    const [year, month, date] = day.date.split("-").map(Number);
    return { date: new Date(year, month - 1, date), reports: day.count, completed: day.completed_count };
  });
}

// Small 30-day volume strip under the key number: flat ink fill, no gradient, no edge fade.
export function VolumeArea({ days }: { days: Days }) {
  return (
    <AreaChart data={toRows(days)} aspectRatio="3 / 1" margin={{ top: 8, right: 0, bottom: 24, left: 0 }}>
      <Area
        dataKey="reports"
        fill="#121212"
        stroke="#121212"
        fillOpacity={0.12}
        gradientToOpacity={0.12}
        strokeWidth={1.5}
        curve={curveLinear}
        fadeEdges={false}
        showHighlight={false}
      />
      <XAxis numTicks={3} />
      <ChartTooltip showDatePill={false} dotHaloScale={0} dotRadiusFraction={0} />
    </AreaChart>
  );
}

// The main trend: reports coming in (cobalt bars at 75%) against reports completed (ink line), per day.
// At 75% the bars keep 3.89:1 against snow and the ink line keeps 4.64:1 where it crosses a bar.
export function InVsCompletedChart({ days }: { days: Days }) {
  return (
    <ComposedChart data={toRows(days)} aspectRatio="16 / 7" margin={{ top: 16, right: 8, bottom: 32, left: 32 }} barGap={0}>
      <Grid horizontal numTicksRows={4} strokeDasharray="0" stroke="#D6D6D3" />
      <SeriesBar dataKey="reports" fill="rgba(43, 75, 216, 0.75)" stroke="#2B4BD8" fadedOpacity={0.45} />
      <Line dataKey="completed" stroke="#121212" strokeWidth={2.5} curve={curveLinear} fadeEdges={false} />
      <YAxis numTicks={4} />
      <XAxis numTicks={6} />
      <ChartTooltip dotHaloScale={0} dotRadiusFraction={0} />
    </ComposedChart>
  );
}
