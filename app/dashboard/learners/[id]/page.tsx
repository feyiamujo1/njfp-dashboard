"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Card, Row, Col, Skeleton, Result, Button, Empty, Tooltip as AntTooltip } from "antd";
import { ArrowLeftOutlined, InfoCircleOutlined } from "@ant-design/icons";
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
import FellowHeader from "@/components/features/fellow/FellowHeader";
import FellowModuleProgress from "@/components/features/fellow/FellowModuleProgress";
import { useFellowDetail } from "@/hooks/useFellowDetail";
import { useFellowQuizStats } from "@/hooks/useFellowQuizStats";
import { CHART_COLORS } from "@/lib/constants";
import type { Fellow } from "@/lib/types";

function CardTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {title}
      <AntTooltip title={hint} styles={{ root: { maxWidth: 320 } }}>
        <InfoCircleOutlined className="text-slate-400 cursor-help text-xs font-normal" />
      </AntTooltip>
    </span>
  );
}

export default function LearnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const fellowId = Number(id);

  const queryClient = useQueryClient();
  const cachedFellows = queryClient.getQueryData<Fellow[]>(["fellows"]);
  const cachedBasic = cachedFellows?.find((f) => f.id === fellowId);

  const {
    data: fellow,
    isLoading: detailLoading,
    isError,
    error,
    refetch,
  } = useFellowDetail(fellowId, cachedBasic?.lastcourseaccess);

  const showFullSkeleton = !cachedBasic && detailLoading;
  const detailReady = !!fellow;

  // Quiz stats load separately — first hit takes ~60s (Moodle serial processing),
  // subsequent hits are instant from the 1-hour server cache.
  // Gated on detailReady so completionPct is the real value, not 0 from initial render.
  const {
    data: quizDetail,
    isLoading: quizLoading,
  } = useFellowQuizStats(fellowId, fellow?.completionPct ?? 0, detailReady);
  const quizReady = !!quizDetail;

  // Merge quiz data on top of fast-path data when available
  const avgQuizScore = quizReady ? quizDetail.avgQuizScore : 0;
  const engagementScore = quizReady
    ? quizDetail.engagementScore
    : fellow?.engagementScore ?? 0;
  const quizStats = quizReady ? quizDetail.quizStats : [];

  if (showFullSkeleton) {
    return (
      <div className="space-y-6!">
        <Card>
          <Skeleton active avatar paragraph={{ rows: 2 }} />
        </Card>
        <Row gutter={[16, 16]}>
          {[1, 2, 3].map((i) => (
            <Col key={i} xs={24} sm={12} lg={8}>
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

  if (!cachedBasic && !fellow) {
    return <Empty description={`Learner #${fellowId} not found`} />;
  }

  const headerFellow = fellow ?? cachedBasic!;

  const quizChartData = quizStats.map((q) => ({
    name: `M${q.moduleId}`,
    score: q.avgScore,
    moduleName: q.moduleName,
  }));

  return (
    <div className="space-y-6!">
      <div>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.back()}
          type="text"
          className="text-slate-500 hover:text-slate-900 -ml-2"
        >
          Back to Fellows
        </Button>
      </div>

      <Card>
        <FellowHeader fellow={headerFellow} riskLevel={fellow?.riskLevel} />
      </Card>

      <Row gutter={[16, 16]}>
        {[1, 2, 3].map((i) =>
          detailReady ? null : (
            <Col key={i} xs={24} sm={12} lg={8}>
              <Card>
                <Skeleton active paragraph={{ rows: 2 }} />
              </Card>
            </Col>
          )
        )}
        {detailReady && (
          <>
            <Col xs={24} sm={12} lg={8}>
              <KPICard
                title="Overall Completion"
                tooltip="Percentage of all tracked course activities this fellow has completed, based on activities marked complete across all modules."
                value={fellow.completionPct}
                suffix="%"
                // valueColor="#1D4ED8"
                valueColor={
                    fellow.completionPct >= 70
                      ? "#16A34A"
                      : fellow.completionPct >= 50
                      ? "#D97706"
                      : "#DC2626"
                  }
              />
            </Col>
            <Col xs={24} sm={12} lg={8}>
              {quizReady ? (
                <KPICard
                  title="Avg Quiz Score"
                  tooltip="Average score across all quizzes in this course, based on the fellow's best attempt per quiz. Loads separately — may take up to 60 seconds on the first visit."
                  value={avgQuizScore}
                  suffix="%"
                  valueColor={
                    avgQuizScore >= 70
                      ? "#16A34A"
                      : avgQuizScore >= 50
                      ? "#D97706"
                      : "#DC2626"
                  }
                />
              ) : (
                <Card>
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Card>
              )}
            </Col>
            <Col xs={24} sm={12} lg={8}>
              {quizReady ? (
                <KPICard
                  title="Engagement Score"
                  tooltip="A composite score (0–100) combining completion percentage and quiz performance. Higher scores reflect stronger overall engagement with the course content."
                  value={engagementScore}
                  suffix="/100"
                />
              ) : (
                <Card>
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Card>
              )}
            </Col>
          </>
        )}
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} lg={12} style={{ display: "flex", flexDirection: "column" }}>
          <Card
            title={<CardTitle title="Module Progress" hint="Module-by-module completion status. Each bar shows how many of the tracked activities in that module this fellow has completed." />}
            className="h-full"
            style={{ display: "flex", flexDirection: "column" }}
            styles={{ body: { flex: 1, minHeight: 0, overflow: "auto" } }}
          >
            {detailReady ? (
              <FellowModuleProgress data={fellow.moduleProgress} />
            ) : (
              <Skeleton active paragraph={{ rows: 5 }} />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12} style={{ display: "flex", flexDirection: "column" }}>
          <Card
            title={<CardTitle title="Quiz Performance by Module" hint="Average quiz score per module based on this fellow's best attempt at each quiz. The red dashed line marks the 50% pass threshold." />}
            className="h-full"
            style={{ display: "flex", flexDirection: "column" }}
            styles={{ body: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } }}
          >
            {quizLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : quizReady && quizChartData.length > 0 ? (
              <div style={{ flex: 1, minHeight: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
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
                      label={{ value: "Pass (50%)", fill: "#DC2626", fontSize: 11 }}
                    />
                    <Bar
                      dataKey="score"
                      radius={[4, 4, 0, 0]}
                      fill={CHART_COLORS.primary}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full" style={{ minHeight: 200 }}>
                <Empty description="No quiz attempts yet" />
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
