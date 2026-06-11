"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Card, Row, Col, Skeleton, Result, Button, Empty } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import KPICard from "@/components/cards/KPICard";
import FellowHeader from "@/components/fellow/FellowHeader";
import FellowModuleProgress from "@/components/fellow/FellowModuleProgress";
import FellowTimeline from "@/components/fellow/FellowTimeline";
import AssignmentTable from "@/components/tables/AssignmentTable";
import { useFellowDetail } from "@/hooks/useFellowDetail";
import { CHART_COLORS } from "@/lib/constants";

export default function LearnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const fellowId = Number(id);
  const { data: fellow, isLoading, isError, error, refetch } = useFellowDetail(fellowId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <Skeleton active avatar paragraph={{ rows: 2 }} />
        </Card>
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4].map((i) => (
            <Col key={i} xs={24} sm={12} lg={6}>
              <Card>
                <Skeleton active paragraph={{ rows: 2 }} />
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  }

  if (isError) {
    return (
      <Result
        status="error"
        title="Failed to load learner profile"
        subTitle={(error as Error)?.message}
        extra={<Button onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  if (!fellow) {
    return <Empty description={`Learner #${fellowId} not found`} />;
  }

  const quizChartData = fellow.quizStats.map((q) => ({
    name: `M${q.moduleId}`,
    score: q.avgScore,
    moduleName: q.moduleName,
  }));

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.back()}
          type="text"
          className="text-slate-500 hover:text-slate-900 -ml-2"
        >
          Back to Learners
        </Button>
      </div>

      {/* Learner header */}
      <Card>
        <FellowHeader fellow={fellow} />
      </Card>

      {/* KPI row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Overall Completion"
            value={fellow.completionPct}
            suffix="%"
            valueColor="#1D4ED8"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Avg Quiz Score"
            value={fellow.avgQuizScore}
            suffix="%"
            valueColor={
              fellow.avgQuizScore >= 70
                ? "#16A34A"
                : fellow.avgQuizScore >= 50
                ? "#D97706"
                : "#DC2626"
            }
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Assignments Submitted"
            value={`${fellow.assignmentsSubmitted}/${fellow.assignmentsTotal}`}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Engagement Score"
            value={fellow.engagementScore}
            suffix="/100"
          />
        </Col>
      </Row>

      {/* Module progress + quiz chart */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Module Progress">
            <FellowModuleProgress data={fellow.moduleProgress} />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Quiz Performance by Module">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={quizChartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(v: unknown) => [`${v}%`, "Score"]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.moduleName ?? ""
                  }
                />
                <ReferenceLine
                  y={50}
                  stroke={CHART_COLORS.error}
                  strokeDasharray="4 4"
                  label={{
                    value: "Pass (50%)",
                    fill: "#DC2626",
                    fontSize: 11,
                  }}
                />
                <Bar
                  dataKey="score"
                  radius={[4, 4, 0, 0]}
                  fill={CHART_COLORS.primary}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Assignments + timeline */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Assignment Status">
            <AssignmentTable data={fellow.assignments} />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Recent Activity">
            <FellowTimeline events={fellow.activityTimeline} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
