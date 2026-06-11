"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { CHART_COLORS } from "@/lib/constants";

interface FunnelStage {
  stage: string;
  count: number;
  pct: number;
}

interface Props {
  data: FunnelStage[];
  height?: number;
}

const STAGE_COLORS = [
  CHART_COLORS.primary,
  "#7C3AED",
  CHART_COLORS.warning,
  CHART_COLORS.success,
];

export default function FunnelChart({ data, height = 300 }: Props) {
  const chartData = data.map((d, i) => ({
    ...d,
    fill: STAGE_COLORS[i % STAGE_COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 10, right: 60, left: 10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} width={130} />
        <Tooltip
          formatter={(val: unknown, _name, props) => [
            `${Number(val).toLocaleString()} (${(props.payload as FunnelStage).pct}%)`,
            "Fellows",
          ]}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          <LabelList
            dataKey="pct"
            position="right"
            formatter={(v: unknown) => `${v}%`}
            style={{ fontSize: 12, fill: "#64748b" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
