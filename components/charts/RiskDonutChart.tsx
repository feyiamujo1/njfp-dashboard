"use client";

import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/constants";

interface Props {
  data: { active: number; atRisk: number; inactive: number };
  height?: number;
}

const SLICES = [
  { key: "active", label: "Active", color: CHART_COLORS.success },
  { key: "atRisk", label: "At Risk", color: CHART_COLORS.warning },
  { key: "inactive", label: "Inactive", color: CHART_COLORS.error },
] as const;

export default function RiskDonutChart({ data, height = 300 }: Props) {
  const chartData = SLICES.map((s) => ({
    name: s.label,
    value: data[s.key],
    fill: s.color,
  }));

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={3}
          dataKey="value"
        />
        <Tooltip
          formatter={(val: unknown) => [
            `${Number(val).toLocaleString()} (${Math.round((Number(val) / total) * 100)}%)`,
            "",
          ]}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
