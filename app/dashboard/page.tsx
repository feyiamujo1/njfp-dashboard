"use client";

import { Card, Row, Col, Skeleton, Result, Button } from "antd";
import {
  TeamOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  TrophyOutlined,
  FileTextOutlined,
  AlertOutlined,
} from "@ant-design/icons";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import KPICard from "@/components/cards/KPICard";
import ModuleBarChart from "@/components/charts/ModuleBarChart";
import RiskDonutChart from "@/components/charts/RiskDonutChart";
import { useOverview } from "@/hooks/useOverview";
import { CHART_COLORS } from "@/lib/constants";

export default function OverviewPage() {
  const { data, isLoading, isError, error, refetch } = useOverview();

  if (isError) {
    return (
      <Result
        status="error"
        title="Failed to load overview"
        subTitle={(error as Error)?.message}
        extra={<Button onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  const stats = data?.stats;
  const loading = isLoading || !data;

  return (
    <div className="space-y-6">
      {/* KPI row — 3 per row on large screens */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <KPICard
            title="Total Fellows"
            value={stats?.totalFellows.toLocaleString() ?? "—"}
            icon={<TeamOutlined />}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <KPICard
            title="Active Fellows"
            value={stats?.activeFellows.toLocaleString() ?? "—"}
            suffix={
              stats
                ? ` (${Math.round((stats.activeFellows / stats.totalFellows) * 100)}%)`
                : ""
            }
            icon={<ThunderboltOutlined />}
            trend={{ direction: "up", label: "vs last week" }}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <KPICard
            title="At-Risk Fellows"
            value={stats?.atRiskCount.toLocaleString() ?? "—"}
            suffix={
              stats
                ? ` (${Math.round((stats.atRiskCount / stats.totalFellows) * 100)}%)`
                : ""
            }
            icon={<AlertOutlined />}
            valueColor="#DC2626"
            trend={{ direction: "down", label: "needs attention" }}
            loading={loading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <KPICard
            title="Completion Rate"
            value={stats?.completionRate ?? "—"}
            suffix="%"
            icon={<CheckCircleOutlined />}
            valueColor="#1D4ED8"
            trend={{ direction: "up", label: "2% this month" }}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <KPICard
            title="Avg Quiz Score"
            value={stats?.avgQuizScore ?? "—"}
            suffix="%"
            icon={<TrophyOutlined />}
            trend={{ direction: "flat", label: "stable" }}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <KPICard
            title="Assignment Completion"
            value={stats?.assignmentCompletionRate ?? "—"}
            suffix="%"
            icon={<FileTextOutlined />}
            trend={{ direction: "up", label: "3% this month" }}
            loading={loading}
          />
        </Col>
      </Row>

      {/* Module completion — full width */}
      <Card title="Module Completion Rate"className="mb-5!">
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <ModuleBarChart data={data?.moduleCompletion ?? []} />
        )}
      </Card>

      {/* Weekly activity + risk distribution */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Weekly Active Fellows">
            {loading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={data?.weeklyActive ?? []}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v: unknown) => [
                      Number(v).toLocaleString(),
                      "Active Fellows",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="active"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Risk Distribution">
            {loading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <RiskDonutChart data={data?.riskDistribution ?? { active: 0, atRisk: 0, inactive: 0 }} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
