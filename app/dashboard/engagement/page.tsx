"use client";

import { Card, Row, Col, Skeleton, Result, Button } from "antd";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import KPICard from "@/components/cards/KPICard";
import ActivityLineChart from "@/components/charts/ActivityLineChart";
import HeatmapGrid from "@/components/charts/HeatmapGrid";
import { useEngagement } from "@/hooks/useEngagement";
import { CHART_COLORS } from "@/lib/constants";

export default function EngagementPage() {
  const { data, isLoading, isError, error, refetch } = useEngagement();

  if (isError) {
    return (
      <Result
        status="error"
        title="Failed to load engagement data"
        subTitle={(error as Error)?.message}
        extra={<Button onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Daily Active Users"
            value={data?.dau.toLocaleString() ?? "—"}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Weekly Active Users"
            value={data?.wau.toLocaleString() ?? "—"}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Monthly Active Users"
            value={data?.mau.toLocaleString() ?? "—"}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Content Views"
            value={data?.contentViews.toLocaleString() ?? "—"}
            loading={isLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Weekly Activity Trend — Logins & Interactions">
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <ActivityLineChart data={data!.weeklyActivity} />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Login Heatmap — Hour × Day of Week">
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 8 }} />
            ) : (
              <HeatmapGrid data={data!.heatmap} />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="Most Viewed Modules">
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={data!.moduleViews.map((d, i) => ({
                ...d,
                fill: CHART_COLORS.modules[i % CHART_COLORS.modules.length],
              }))}
              layout="vertical"
              margin={{ top: 10, right: 40, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                dataKey="moduleName"
                type="category"
                tick={{ fontSize: 12 }}
                width={160}
              />
              <Tooltip
                formatter={(v: unknown) => [Number(v).toLocaleString(), "Views"]}
              />
              <Bar dataKey="views" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
