"use client";

import { Card, Row, Col, Skeleton, Result, Button } from "antd";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import KPICard from "@/components/cards/KPICard";
import LeaderboardTable from "@/components/tables/LeaderboardTable";
import { usePerformance } from "@/hooks/usePerformance";
import { CHART_COLORS } from "@/lib/constants";

export default function AssessmentsPage() {
  const { data, isLoading, isError, error, refetch } = usePerformance();

  if (isError) {
    return (
      <Result
        status="error"
        title="Failed to load performance data"
        subTitle={(error as Error)?.message}
        extra={<Button onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  const quizChartData = data?.quizByModule.map((q) => ({
    ...q,
    fill:
      q.avgScore >= 70
        ? CHART_COLORS.success
        : q.avgScore >= 50
        ? CHART_COLORS.warning
        : CHART_COLORS.error,
  }));

  return (
    <div className="space-y-6">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Avg Quiz Score"
            value={data?.avgQuizScore ?? "—"}
            suffix="%"
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Assignment Submission Rate"
            value={data?.submissionRate ?? "—"}
            suffix="%"
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Pass Rate"
            value={data?.passRate ?? "—"}
            suffix="%"
            trend={{ direction: "up", label: "vs last month" }}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Fail Rate"
            value={data?.failRate ?? "—"}
            suffix="%"
            valueColor="#DC2626"
            trend={{ direction: "down", label: "improving" }}
            loading={isLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Avg Quiz Score by Module">
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={quizChartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="moduleId"
                    tickFormatter={(v) => `M${v}`}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [`${v}%`, "Avg Score"]}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.moduleName ?? ""
                    }
                  />
                  <ReferenceLine
                    y={50}
                    stroke={CHART_COLORS.error}
                    strokeDasharray="4 4"
                    label={{ value: "Pass (50%)", fill: "#DC2626", fontSize: 11 }}
                  />
                  <Bar dataKey="avgScore" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Assignment Completion by Module">
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={data!.assignmentByModule}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="moduleId"
                    tickFormatter={(v) => `M${v}`}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.moduleName ?? ""
                    }
                  />
                  <Legend />
                  <Bar
                    dataKey="submitted"
                    name="Submitted"
                    stackId="a"
                    fill={CHART_COLORS.success}
                  />
                  <Bar
                    dataKey="notSubmitted"
                    name="Not Submitted"
                    stackId="a"
                    fill={CHART_COLORS.neutral}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      <Card title="Top Learners">
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <LeaderboardTable data={data!.topLearners} />
        )}
      </Card>
    </div>
  );
}
