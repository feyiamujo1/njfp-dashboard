"use client";

import {
  Avatar,
  Card,
  Row,
  Col,
  Skeleton,
  Result,
  Button,
  Table,
  Tag,
  Tooltip
} from "antd";
import {
  TeamOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  AlertOutlined,
  StopOutlined,
  InfoCircleOutlined,
  TrophyOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { downloadCsv, formatTs } from "@/lib/export";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer
} from "recharts";
import KPICard from "@/components/cards/KPICard";
import ModuleBarChart from "@/components/charts/ModuleBarChart";
import RiskDonutChart from "@/components/charts/RiskDonutChart";
import { useOverview } from "@/hooks/useOverview";
import { useOverviewCompletion } from "@/hooks/useOverviewCompletion";
import { CHART_COLORS } from "@/lib/constants";
import type { TopLearner } from "@/lib/types";

function pct(value: number, total: number): string {
  if (!total) return "";
  return ` (${Math.round((value / total) * 100)}%)`;
}

function CardTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {title}
      <Tooltip
        title={hint}
        styles={{
          root: {
            maxWidth: 300
          }
        }}>
        <InfoCircleOutlined className="text-slate-400 cursor-help text-xs font-normal" />
      </Tooltip>
    </span>
  );
}

export default function OverviewPage() {
  const { data, isLoading, isError, error, refetch } = useOverview();
  const { data: completion, isLoading: completionLoading } =
    useOverviewCompletion();

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
      {/* ── FAST SECTION ── loads immediately from the students cache ──────────── */}

      {/* Row 1 — all 4 headcount KPIs together */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <KPICard
            title="Total Fellows"
            value={stats?.totalFellows.toLocaleString() ?? "—"}
            icon={<TeamOutlined />}
            loading={loading}
            tooltip="All students enrolled in the NJFP course, regardless of whether they have ever logged in or started any activity."
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KPICard
            title="Active Fellows"
            value={stats?.activeFellows.toLocaleString() ?? "—"}
            suffix={stats ? pct(stats.activeFellows, stats.totalFellows) : ""}
            icon={<ThunderboltOutlined />}
            valueColor="#16A34A"
            loading={loading}
            tooltip="Fellows who accessed the course at least once in the past 7 days, based on their last course access timestamp."
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KPICard
            title="At-Risk Fellows"
            value={stats?.atRiskCount.toLocaleString() ?? "—"}
            suffix={stats ? pct(stats.atRiskCount, stats.totalFellows) : ""}
            icon={<AlertOutlined />}
            valueColor="#D97706"
            loading={loading}
            tooltip="Fellows who last accessed the course 7–30 days ago. They are disengaging and likely need a follow-up nudge before they go fully inactive."
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KPICard
            title="Never Started"
            value={stats?.neverStarted.toLocaleString() ?? "—"}
            suffix={stats ? pct(stats.neverStarted, stats.totalFellows) : ""}
            icon={<StopOutlined />}
            valueColor="#DC2626"
            loading={loading}
            tooltip="Fellows enrolled in the course who have never accessed it — their last course access is recorded as zero."
          />
        </Col>
      </Row>

      {/* Row 2 — weekly trend (wide) + risk donut */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <CardTitle
                title="Weekly Active Fellows"
                hint="Number of distinct fellows who accessed the course in each calendar week (Mon–Sun) over the past 8 weeks. A fellow is counted once per week regardless of how many sessions they had."
              />
            }
            extra={
              <Button
                size="small"
                icon={<DownloadOutlined />}
                disabled={loading || !data?.weeklyActive?.length}
                onClick={() =>
                  downloadCsv(
                    "weekly-active-fellows.csv",
                    ["Week", "Active Fellows"],
                    (data?.weeklyActive ?? []).map(r => [r.week, r.active])
                  )
                }>
                Export
              </Button>
            }>
            {loading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={data?.weeklyActive ?? []}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ChartTooltip
                    formatter={(v: unknown) => [
                      Number(v).toLocaleString(),
                      "Active Fellows"
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
          <Card
            title={
              <CardTitle
                title="Risk Distribution"
                hint="Active: accessed the course in the last 7 days. At-Risk: last access was 7–30 days ago. Inactive: no course activity in over 30 days, or never logged in."
              />
            }
            className="h-full"
            extra={
              <Button
                size="small"
                icon={<DownloadOutlined />}
                disabled={loading || !data?.riskDistribution}
                onClick={() => {
                  const dist = data!.riskDistribution;
                  const total = dist.active + dist.atRisk + dist.inactive;
                  downloadCsv(
                    "risk-distribution.csv",
                    ["Risk Tier", "Count", "%"],
                    [
                      ["Active",   dist.active,   total > 0 ? Math.round((dist.active   / total) * 100) : 0],
                      ["At-Risk",  dist.atRisk,   total > 0 ? Math.round((dist.atRisk   / total) * 100) : 0],
                      ["Inactive", dist.inactive, total > 0 ? Math.round((dist.inactive / total) * 100) : 0],
                    ]
                  );
                }}>
                Export
              </Button>
            }>
            {loading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <RiskDonutChart
                data={
                  data?.riskDistribution ?? {
                    active: 0,
                    atRisk: 0,
                    inactive: 0
                  }
                }
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* ── SLOW SECTION ── loads when completion data arrives ────────────────── */}

      {/* Row 3 — completion KPIs */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <KPICard
            title="Completion Rate"
            value={completion?.completionRate ?? "—"}
            suffix={completion ? "%" : ""}
            icon={<CheckCircleOutlined />}
            valueColor="#1D4ED8"
            loading={completionLoading}
            tooltip="% of fellows who have fully completed every tracked activity in at least half the course modules. Uses a strict definition — every activity in a module must be marked complete for that module to count."
          />
        </Col>
        <Col xs={24} sm={12}>
          <KPICard
            title="Avg Completion"
            value={completion?.avgCompletionPct ?? "—"}
            suffix={completion ? "%" : ""}
            icon={<RiseOutlined />}
            loading={completionLoading}
            tooltip="Average % of all course activities completed across every enrolled fellow, including those who have never logged in. The average among active learners only will be significantly higher."
          />
        </Col>
      </Row>

      {/* Module completion chart */}
      <Card
        className="mb-6!"
        title={
          <CardTitle
            title="Module Completion Rate"
            hint="For each module, the % of enrolled fellows who have completed every tracked activity in it. Only fully completed modules count — partial progress is not reflected here."
          />
        }
        extra={
          <Button
            size="small"
            icon={<DownloadOutlined />}
            disabled={completionLoading || !completion?.moduleCompletion?.length}
            onClick={() =>
              downloadCsv(
                "module-completion-rate.csv",
                ["Module ID", "Module Name", "Completed Fellows", "Total Fellows", "Completion %"],
                (completion?.moduleCompletion ?? []).map(m => [
                  m.moduleId, m.moduleName, m.completedCount, m.totalFellows, m.completionPct,
                ])
              )
            }>
            Export
          </Button>
        }>
        {completionLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <ModuleBarChart data={completion?.moduleCompletion ?? []} />
        )}
      </Card>

      {/* Top Learners table */}
      <Card
        title={
          <CardTitle
            title="Top Learners"
            hint="All fellows ranked by course completion percentage, showing only those who have started at least one activity. Ranked by % of all tracked activities completed."
          />
        }
        extra={
          <div className="flex items-center gap-2">
            {!completionLoading && completion && (
              <span className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">
                  {completion.completedFellows.toLocaleString()}
                </span>{" "}
                fellow{completion.completedFellows !== 1 ? "s" : ""} completed
              </span>
            )}
            <TrophyOutlined className="text-amber-400 text-lg" />
            <Button
              size="small"
              icon={<DownloadOutlined />}
              disabled={completionLoading || !completion?.topLearners?.length}
              onClick={() =>
                downloadCsv(
                  "top-learners.csv",
                  ["Rank", "Name", "Email", "Activities Done", "Total Activities", "Completion %", "Last Active"],
                  (completion?.topLearners ?? []).map((r, i) => [
                    i + 1, r.fullname, r.email, r.activitiesDone, r.totalActivities, r.completionPct, formatTs(r.lastcourseaccess),
                  ])
                )
              }>
              Export All
            </Button>
          </div>
        }>
        {completionLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <Table<TopLearner>
            dataSource={completion?.topLearners ?? []}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: false }}
            columns={[
              {
                title: "#",
                key: "rank",
                width: 48,
                render: (_: unknown, __: TopLearner, index: number) => (
                  <span className="text-slate-400 font-medium">
                    {index + 1}
                  </span>
                )
              },
              {
                title: "Fellow",
                key: "fellow",
                render: (_: unknown, r: TopLearner) => (
                  <div className="flex items-center gap-2">
                    <Avatar src={r.profileimageurl} size={28}>
                      {r.fullname[0]}
                    </Avatar>
                    <span className="font-medium">{r.fullname}</span>
                  </div>
                )
              },
              {
                title: "Activities Done",
                key: "activities",
                align: "center" as const,
                render: (_: unknown, r: TopLearner) => (
                  <span className="text-slate-600">
                    {r.activitiesDone} / {r.totalActivities}
                  </span>
                )
              },
              {
                title: "Completion",
                dataIndex: "completionPct",
                key: "completionPct",
                align: "center" as const,
                sorter: (a: TopLearner, b: TopLearner) =>
                  a.completionPct - b.completionPct,
                render: (v: number) => (
                  <Tag
                    color={v >= 60 ? "green" : v >= 30 ? "orange" : "default"}
                    className="font-semibold">
                    {v}%
                  </Tag>
                )
              },
              {
                title: "Last Active",
                dataIndex: "lastcourseaccess",
                key: "lastcourseaccess",
                align: "right" as const,
                render: (ts: number) =>
                  ts
                    ? new Date(ts * 1000).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      })
                    : "Never"
              }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
