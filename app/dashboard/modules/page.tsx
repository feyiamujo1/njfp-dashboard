"use client";

import { Card, Row, Col, Progress, Skeleton, Result, Button } from "antd";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import KPICard from "@/components/cards/KPICard";
import FunnelChart from "@/components/charts/FunnelChart";
import { useProgress } from "@/hooks/useProgress";
import { CHART_COLORS } from "@/lib/constants";

export default function ModulesPage() {
  const { data, isLoading, isError, error, refetch } = useProgress();

  if (isError) {
    return (
      <Result
        status="error"
        title="Failed to load course progress"
        subTitle={(error as Error)?.message}
        extra={<Button onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  const totalEnrolled = data?.totalEnrolled ?? data?.funnel[0]?.count;

  return (
    <div className="space-y-6">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Total Enrolled"
            value={totalEnrolled?.toLocaleString() ?? "—"}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Started Course"
            value={data?.startedPct ?? "—"}
            suffix="%"
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Fully Completed"
            value={data?.completedPct ?? "—"}
            suffix="%"
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Avg Completion Rate"
            value={data?.avgCompletionRate ?? "—"}
            suffix="%"
            valueColor="#1D4ED8"
            loading={isLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12} style={{ display: "flex", flexDirection: "column" }}>
          <Card
            title="Module Completion Progress"
            style={{ flex: 1, display: "flex", flexDirection: "column" }}
            styles={{ body: { flex: 1 } }}
          >
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 8 }} />
            ) : (
              <div className="space-y-5">
                {data!.moduleProgress.map((m, i) => {
                  const color =
                    CHART_COLORS.modules[i % CHART_COLORS.modules.length];
                  return (
                    <div key={m.moduleId}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">
                          <span className="text-slate-400 mr-1.5">
                            M{m.moduleId}
                          </span>
                          {m.moduleName}
                        </span>
                        <span className="text-sm text-slate-500">
                          {m.completedCount.toLocaleString()} learners ·{" "}
                          <span style={{ color }} className="font-semibold">
                            {m.completionPct}%
                          </span>
                        </span>
                      </div>
                      <Progress
                        percent={m.completionPct}
                        showInfo={false}
                        strokeColor={color}
                        styles={{ rail: { background: "#f1f5f9" } }}
                        size="small"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12} style={{ display: "flex", flexDirection: "column" }}>
          <Card
            title="Enrolment Funnel"
            style={{ flex: 1, display: "flex", flexDirection: "column" }}
            styles={{ body: { flex: 1 } }}
          >
            <p className="text-slate-400 text-xs mb-4 m-0">
              Shows how many enrolled fellows progress through each stage of the
              course — from enrolment through to full completion.
            </p>
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <FunnelChart data={data!.funnel} />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="Module Drop-Off — % of Fellows Still Active">
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={data!.dropOff}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="dropOffGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={CHART_COLORS.primary}
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor={CHART_COLORS.primary}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="moduleName"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => v.split(" ")[0]}
              />
              <YAxis
                domain={[60, 100]}
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(v: unknown) => [`${v}%`, "Fellows Active"]}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.moduleName ?? ""
                }
              />
              <Area
                type="monotone"
                dataKey="activePct"
                name="Fellows Active"
                stroke={CHART_COLORS.primary}
                fill="url(#dropOffGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
