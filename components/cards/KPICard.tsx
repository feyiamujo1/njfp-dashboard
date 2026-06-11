"use client";

import { Card, Statistic, Skeleton } from "antd";
import { ReactNode } from "react";

interface KPICardProps {
  title: string;
  value: string | number;
  suffix?: string;
  prefix?: string;
  icon?: ReactNode;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  valueColor?: string;
  loading?: boolean;
}

const TREND_STYLES: Record<string, { color: string; symbol: string }> = {
  up: { color: "#16A34A", symbol: "↑" },
  down: { color: "#DC2626", symbol: "↓" },
  flat: { color: "#94A3B8", symbol: "→" },
};

export default function KPICard({
  title,
  value,
  suffix,
  prefix,
  icon,
  trend,
  valueColor = "#111827",
  loading = false,
}: KPICardProps) {
  if (loading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    );
  }

  const trendStyle = trend ? TREND_STYLES[trend.direction] : null;

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between mb-3">
        {icon && (
          <div className="text-2xl" style={{ color: valueColor }}>
            {icon}
          </div>
        )}
        {trendStyle && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              color: trendStyle.color,
              backgroundColor: `${trendStyle.color}18`,
            }}
          >
            {trendStyle.symbol} {trend!.label}
          </span>
        )}
      </div>
      <Statistic
        title={<span className="text-slate-500 text-sm font-medium">{title}</span>}
        value={value}
        suffix={suffix}
        prefix={prefix}
        styles={{ value: { color: valueColor, fontSize: 28, fontWeight: 700 } }}
      />
    </Card>
  );
}
