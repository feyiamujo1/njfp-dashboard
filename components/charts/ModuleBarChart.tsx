"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { CHART_COLORS } from "@/lib/constants";
import type { ModuleProgress } from "@/lib/types";

interface Props {
  data: ModuleProgress[];
  height?: number;
}

export default function ModuleBarChart({ data, height = 300 }: Props) {
  const chartData = data.map((d) => ({
    name: `M${d.moduleId}`,
    completion: d.completionPct,
    fullName: d.moduleName,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(val) => [`${val}%`, "Completion"]}
          labelFormatter={(_, payload) =>
            payload?.[0]?.payload?.fullName ?? ""
          }
        />
        <Bar dataKey="completion" radius={[4, 4, 0, 0]}>
          {chartData.map((_, i) => (
            <Cell
              key={i}
              fill={CHART_COLORS.modules[i % CHART_COLORS.modules.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
