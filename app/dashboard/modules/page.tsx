"use client";

import { Card, Row, Col, Progress, Skeleton, Result, Button, Tooltip, Table, Slider, Tag } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { useState, useMemo } from "react";
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import KPICard from "@/components/cards/KPICard";
import FunnelChart from "@/components/charts/FunnelChart";
import { useProgress } from "@/hooks/useProgress";
import { useProgressCompletion } from "@/hooks/useProgressCompletion";
import { CHART_COLORS } from "@/lib/constants";
import type { DemCompletion } from "@/lib/types";

function CardTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {title}
      <Tooltip title={hint} styles={{ root: { maxWidth: 320 } }}>
        <InfoCircleOutlined className="text-slate-400 cursor-help text-xs font-normal" />
      </Tooltip>
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        {children}
      </span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

const DEM_COLUMNS = [
  { title: "Enrolled", dataIndex: "total", key: "total", align: "right" as const,
    render: (v: number) => v.toLocaleString() },
  { title: "Started", key: "started", align: "right" as const,
    render: (_: unknown, r: DemCompletion) => (
      <span>{r.started.toLocaleString()} <span className="text-slate-400 text-xs">({r.startedPct}%)</span></span>
    )},
  { title: "Midway", key: "midway", align: "right" as const,
    render: (_: unknown, r: DemCompletion) => (
      <span>{r.midway.toLocaleString()} <span className="text-slate-400 text-xs">({r.midwayPct}%)</span></span>
    )},
  { title: "Completed", key: "completed", align: "right" as const,
    render: (_: unknown, r: DemCompletion) => (
      <span className="font-medium">{r.completed.toLocaleString()} <Tag color={r.completionPct >= 20 ? "green" : r.completionPct >= 10 ? "orange" : "default"} className="text-xs">{r.completionPct}%</Tag></span>
    )},
];

export default function ModulesPage() {
  const { data: fast, isLoading, isError, error, refetch } = useProgress();
  const { data: slow, isLoading: slowLoading } = useProgressCompletion();

  const [topStates, setTopStates] = useState(15);

  const stateChartData = useMemo(
    () => (slow?.completionByState ?? []).slice(0, topStates),
    [slow?.completionByState, topStates]
  );

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

  return (
    <div className="space-y-6!">
      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Total Enrolled"
            value={fast?.totalEnrolled.toLocaleString() ?? "—"}
            loading={isLoading}
            tooltip="All fellows currently enrolled in the NJFP course, including those who have never logged in or started any activity."
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Started Course"
            value={slow?.startedPct ?? "—"}
            suffix={slow ? "%" : ""}
            loading={slowLoading}
            tooltip="% of enrolled fellows who have completed at least one tracked activity in any module — the first signal that a learner has moved beyond registration."
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Fully Completed"
            value={slow?.completedPct ?? "—"}
            suffix={slow ? "%" : ""}
            loading={slowLoading}
            tooltip="% of fellows who have completed every tracked activity in at least half of all course modules. Strict definition — partial module completion does not count towards this figure."
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Avg Completion Rate"
            value={slow?.avgCompletionRate ?? "—"}
            suffix={slow ? "%" : ""}
            valueColor="#1D4ED8"
            loading={slowLoading}
            tooltip="Average % of all tracked course activities completed per fellow, including those who have never started. The figure among active learners only will be significantly higher."
          />
        </Col>
      </Row>

      {/* ── Module Progress + Funnel ────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12} style={{ display: "flex", flexDirection: "column" }}>
          <Card
            title={
              <CardTitle
                title="Module Completion Progress"
                hint="For each module, the % of enrolled fellows who have completed every tracked activity within it. Strict definition — all activities must be marked complete for a module to count."
              />
            }
            style={{ flex: 1, display: "flex", flexDirection: "column" }}
            styles={{ body: { flex: 1 } }}
          >
            {slowLoading ? (
              <Skeleton active paragraph={{ rows: 8 }} />
            ) : (
              <div className="space-y-5">
                {slow!.moduleProgress.map((m, i) => {
                  const color = CHART_COLORS.modules[i % CHART_COLORS.modules.length];
                  return (
                    <div key={m.moduleId}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">
                          <span className="text-slate-400 mr-1.5">M{m.moduleId}</span>
                          {m.moduleName}
                        </span>
                        <span className="text-sm text-slate-500">
                          {m.completedCount.toLocaleString()} / {m.totalFellows.toLocaleString()} ·{" "}
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
            title={
              <CardTitle
                title="Enrolment Funnel"
                hint="Learner progression from enrolment to completion: Started = at least 1 activity done; Midway = completed the middle module; Completed = finished activities in at least half the modules. Each stage is a subset of the previous."
              />
            }
            style={{ flex: 1, display: "flex", flexDirection: "column" }}
            styles={{ body: { flex: 1 } }}
          >
            <p className="text-slate-400 text-xs mb-4 m-0">
              Shows how many enrolled fellows progress through each stage of the course — from enrolment through to full completion.
            </p>
            {slowLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <FunnelChart data={slow!.funnel} />
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Module Drop-Off ─────────────────────────────────────────────────── */}
      <Card
        title={
          <CardTitle
            title="Module Drop-Off"
            hint="% of enrolled fellows who have started each module (completed at least one activity in it). A declining trend shows where learners disengage as the course progresses."
          />
        }
      >
        {slowLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={slow!.dropOff}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="dropOffGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="moduleName"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => v.split(" ")[0]}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
              <ChartTooltip
                formatter={(v: unknown) => [`${v}%`, "Fellows Started"]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.moduleName ?? ""}
              />
              <Area
                type="monotone"
                dataKey="activePct"
                name="Fellows Started"
                stroke={CHART_COLORS.primary}
                fill="url(#dropOffGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── Demographic breakdowns ──────────────────────────────────────────── */}
      <SectionLabel>Enrolment Funnel by Demographics</SectionLabel>

      {/* Gender */}
      <Card
        title={
          <CardTitle
            title="Funnel by Gender"
            hint="For each gender group, the % who have started, reached midway, and fully completed the course — showing where each group drops off in the learning journey."
          />
        }
      >
        {slowLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-96 shrink-0">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={(slow?.completionByGender ?? [])}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                  <ChartTooltip formatter={(v: unknown, name: unknown) => [`${v}%`, name as string]} />
                  <Legend />
                  <Bar dataKey="startedPct" name="Started %" fill="#60a5fa" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="midwayPct" name="Midway %" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="completionPct" name="Completed %" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1">
              <Table<DemCompletion>
                size="small"
                dataSource={(slow?.completionByGender ?? [])}
                rowKey="label"
                pagination={false}
                columns={[
                  { title: "Gender", dataIndex: "label", key: "label", render: (v: string) => <span className="font-medium">{v}</span> },
                  ...DEM_COLUMNS,
                ]}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Region */}
      <Card
        title={
          <CardTitle
            title="Funnel by Geopolitical Region"
            hint="Started, midway, and completed rates across Nigeria's 6 geopolitical zones. Helps identify where each region drops off in the course."
          />
        }
      >
        {slowLoading ? (
          <Skeleton active paragraph={{ rows: 7 }} />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(280, (slow?.completionByRegion?.length ?? 0) * 56)}>
              <BarChart
                data={(slow?.completionByRegion ?? [])}
                layout="vertical"
                margin={{ left: 8, right: 60, top: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12 }} />
                <ChartTooltip formatter={(v: unknown, name: unknown) => [`${v}%`, name as string]} />
                <Legend />
                <Bar dataKey="startedPct" name="Started %" fill="#60a5fa" radius={[0, 4, 4, 0]} barSize={16} />
                <Bar dataKey="midwayPct" name="Midway %" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={16} />
                <Bar dataKey="completionPct" name="Completed %" fill="#22c55e" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
            <Table<DemCompletion>
              size="small"
              dataSource={(slow?.completionByRegion ?? [])}
              rowKey="label"
              pagination={false}
              className="mt-4"
              columns={[
                { title: "Region", dataIndex: "label", key: "label", render: (v: string) => <span className="font-medium">{v}</span> },
                ...DEM_COLUMNS,
              ]}
            />
          </>
        )}
      </Card>

      {/* State */}
      <Card
        title={
          <CardTitle
            title="Funnel by State"
            hint="Started, midway, and completed counts per state of origin. Use the slider to focus on the top states by enrolment."
          />
        }
      >
        {slowLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm text-slate-500 whitespace-nowrap">
                Top {topStates} of {(slow?.completionByState?.length ?? 0)} states
              </span>
              <Slider
                min={5}
                max={Math.min((slow?.completionByState?.length ?? 0), 37)}
                value={topStates}
                onChange={setTopStates}
                className="flex-1"
                tooltip={{ formatter: (v) => `Top ${v}` }}
              />
            </div>
            <ResponsiveContainer width="100%" height={Math.max(300, topStates * 36)}>
              <BarChart
                data={stateChartData}
                layout="vertical"
                margin={{ left: 8, right: 60, top: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11 }} />
                <ChartTooltip formatter={(v: unknown, name: unknown) => [`${v}`, name as string]} />
                <Legend />
                <Bar dataKey="started" name="Started" fill="#60a5fa" radius={[0, 4, 4, 0]} barSize={16} />
                <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
            <Table<DemCompletion>
              size="small"
              dataSource={(slow?.completionByState ?? [])}
              rowKey="label"
              pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `${t} states` }}
              className="mt-4"
              columns={[
                { title: "State", dataIndex: "label", key: "label", render: (v: string) => <span className="font-medium">{v}</span> },
                ...DEM_COLUMNS,
              ]}
            />
          </>
        )}
      </Card>
    </div>
  );
}
