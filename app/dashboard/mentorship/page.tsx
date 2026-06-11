"use client";

import { Card, Row, Col, Alert, Skeleton, Result, Button } from "antd";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
} from "recharts";
import KPICard from "@/components/cards/KPICard";
import LeaderboardTable from "@/components/tables/LeaderboardTable";
import { useMentorship } from "@/hooks/useMentorship";
import { CHART_COLORS } from "@/lib/constants";

export default function MentorshipPage() {
  const { data, isLoading, isError, error, refetch } = useMentorship();

  if (isError) {
    return (
      <Result
        status="error"
        title="Failed to load mentorship data"
        subTitle={(error as Error)?.message}
        extra={<Button onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  const radialData = [
    { name: "Pod Participation", value: data?.podParticipation ?? 0, fill: CHART_COLORS.neutral },
    { name: "Mentor Sessions", value: data?.mentorSessions ?? 0, fill: CHART_COLORS.warning },
    { name: "Webinar Attendance", value: data?.webinarAttendance ?? 0, fill: CHART_COLORS.primary },
  ];

  return (
    <div className="space-y-6">
      <Alert
        type="info"
        showIcon
        description="Mentorship data is currently using placeholder values pending API configuration."
        className="mb-2"
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Webinar Attendance"
            value={data?.webinarAttendance ?? "—"}
            suffix="%"
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Mentor Sessions"
            value={data?.mentorSessions ?? "—"}
            suffix="%"
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Pod Participation"
            value={data?.podParticipation ?? "—"}
            suffix="%"
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Total Forum Posts"
            value={data?.forumPosts.toLocaleString() ?? "—"}
            loading={isLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="Attendance Rates">
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={120}
                  data={radialData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={6}
                    background={{ fill: "#f1f5f9" }}
                    label={{
                      position: "insideStart",
                      fill: "#fff",
                      fontSize: 11,
                      formatter: (v: unknown) =>
                        v != null ? `${v}%` : "",
                    }}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [`${v ?? ""}%`, ""]}
                  />
                  <Legend
                    iconSize={10}
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card title="Forum Engagement by Module">
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={data!.forumByModule}
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
                    dataKey="posts"
                    name="New Posts"
                    stackId="a"
                    fill={CHART_COLORS.primary}
                  />
                  <Bar
                    dataKey="replies"
                    name="Replies"
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

      <Card title="Engagement Leaderboard">
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <LeaderboardTable data={data!.leaderboard} />
        )}
      </Card>
    </div>
  );
}
