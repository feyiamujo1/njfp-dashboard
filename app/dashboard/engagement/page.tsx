"use client";

import {
  Card,
  Row,
  Col,
  Skeleton,
  Result,
  Button,
  Tooltip,
  Table,
  Slider,
  Segmented,
  DatePicker
} from "antd";
import { InfoCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { useState, useMemo } from "react";
import type { Dayjs } from "dayjs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import KPICard from "@/components/cards/KPICard";
import ActivityLineChart from "@/components/charts/ActivityLineChart";
import HeatmapGrid from "@/components/charts/HeatmapGrid";
import RiskDonutChart from "@/components/charts/RiskDonutChart";
import RiskTable from "@/components/tables/RiskTable";
import LeaderboardTable from "@/components/tables/LeaderboardTable";
import { useEngagement } from "@/hooks/useEngagement";
import { useLearnerActivity } from "@/hooks/useLearnerActivity";
import { CHART_COLORS } from "@/lib/constants";
import type { ActivityDemBreakdown } from "@/lib/types";

const { RangePicker } = DatePicker;

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

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap">
        {children}
      </span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

const ACT_COLORS = {
  active: "#22c55e",
  atRisk: "#f59e0b",
  inactive: "#f87171"
};

function actPct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

const ACT_COLUMNS = [
  {
    title: "Total",
    dataIndex: "total",
    key: "total",
    align: "right" as const,
    render: (v: number) => v.toLocaleString()
  },
  {
    title: "Active",
    key: "active",
    align: "right" as const,
    render: (_: unknown, r: ActivityDemBreakdown) => (
      <span style={{ color: ACT_COLORS.active }} className="font-medium">
        {r.active.toLocaleString()}{" "}
        <span className="text-slate-400 text-xs font-normal">
          ({actPct(r.active, r.total)}%)
        </span>
      </span>
    )
  },
  {
    title: "At-Risk",
    key: "atRisk",
    align: "right" as const,
    render: (_: unknown, r: ActivityDemBreakdown) => (
      <span style={{ color: ACT_COLORS.atRisk }} className="font-medium">
        {r.atRisk.toLocaleString()}{" "}
        <span className="text-slate-400 text-xs font-normal">
          ({actPct(r.atRisk, r.total)}%)
        </span>
      </span>
    )
  },
  {
    title: "Inactive",
    key: "inactive",
    align: "right" as const,
    render: (_: unknown, r: ActivityDemBreakdown) => (
      <span style={{ color: ACT_COLORS.inactive }} className="font-medium">
        {r.inactive.toLocaleString()}{" "}
        <span className="text-slate-400 text-xs font-normal">
          ({actPct(r.inactive, r.total)}%)
        </span>
      </span>
    )
  }
];

export default function LearnerActivityPage() {
  const { data: fast, isLoading, isError, error, refetch } = useEngagement();
  const { data: slow, isLoading: slowLoading } = useLearnerActivity();

  const [topStates, setTopStates] = useState(15);

  // Trend filters
  const [trendView, setTrendView] = useState<"week" | "month">("week");
  const [trendRange, setTrendRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);

  // Heatmap filters
  const [heatmapRange, setHeatmapRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);

  // ── Filtered trend data ────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    if (trendView === "month") {
      const monthly = fast?.monthlyActivity ?? [];
      if (!trendRange || (!trendRange[0] && !trendRange[1]))
        return monthly.map(d => ({
          week: d.month,
          logins: d.logins,
          interactions: d.interactions
        }));
      const from = trendRange[0]?.startOf("month").unix() ?? 0;
      const to = trendRange[1]?.endOf("month").unix() ?? Infinity;
      return monthly
        .filter(d => d.ts >= from && d.ts <= to)
        .map(d => ({
          week: d.month,
          logins: d.logins,
          interactions: d.interactions
        }));
    }
    // weekly
    const weekly = fast?.weeklyActivity ?? [];
    if (!trendRange || (!trendRange[0] && !trendRange[1])) return weekly;
    const from = trendRange[0]?.unix() ?? 0;
    const to = (trendRange[1]?.unix() ?? 0) + 7 * 86400;
    return weekly.filter(d => d.ts >= from && d.ts <= to);
  }, [fast?.weeklyActivity, fast?.monthlyActivity, trendView, trendRange]);

  // ── Heatmap computed client-side from raw timestamps ──────────────────────
  const heatmapData = useMemo(() => {
    const raw = fast?.heatmapRaw ?? [];
    const hmFrom = heatmapRange?.[0]?.startOf("month").unix() ?? 0;
    const hmTo = heatmapRange?.[1]?.endOf("month").unix() ?? Infinity;
    const grid: number[][] = Array.from({ length: 7 }, () =>
      new Array(24).fill(0)
    );
    raw.forEach(ts => {
      if (!ts) return;
      if (hmFrom && ts < hmFrom) return;
      if (hmTo !== Infinity && ts > hmTo) return;
      const d = new Date(ts * 1000);
      const dayIdx = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
      const hour = d.getHours();
      grid[dayIdx][hour]++;
    });
    const result: { day: number; hour: number; count: number }[] = [];
    for (let dy = 0; dy < 7; dy++)
      for (let h = 0; h < 24; h++)
        result.push({ day: dy, hour: h, count: grid[dy][h] });
    return result;
  }, [fast?.heatmapRaw, heatmapRange]);

  const heatmapRangeLabel = useMemo(() => {
    if (!heatmapRange || (!heatmapRange[0] && !heatmapRange[1])) {
      return "Default: all time — showing each fellow's most recent course access";
    }
    const from = heatmapRange[0]?.format("MMM YYYY") ?? "—";
    const to = heatmapRange[1]?.format("MMM YYYY") ?? "—";
    return `Showing fellows last active between ${from} – ${to}`;
  }, [heatmapRange]);

  const stateChartData = useMemo(
    () => (slow?.activityByState ?? []).slice(0, topStates),
    [slow?.activityByState, topStates]
  );

  if (isError) {
    return (
      <Result
        status="error"
        title="Failed to load learner activity"
        subTitle={(error as Error)?.message}
        extra={<Button onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  const risk = slow?.risk;
  const totalRisk = risk
    ? risk.distribution.active +
      risk.distribution.atRisk +
      risk.distribution.inactive
    : 0;

  return (
    <div className="space-y-6!">
      {/* ── Activity ──────────────────────────────────────────────────────── */}
      <SectionLabel>Activity</SectionLabel>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <KPICard
            title="Daily Active Users"
            value={fast?.dau.toLocaleString() ?? "—"}
            loading={isLoading}
            tooltip="Fellows who accessed the course at least once in the past 24 hours, based on last course access timestamp."
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KPICard
            title="Weekly Active Users"
            value={fast?.wau.toLocaleString() ?? "—"}
            loading={isLoading}
            tooltip="Fellows who accessed the course at least once in the past 7 days."
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KPICard
            title="Monthly Active Users"
            value={fast?.mau.toLocaleString() ?? "—"}
            loading={isLoading}
            tooltip="Fellows who accessed the course at least once in the past 30 days."
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KPICard
            title="Total Content Views"
            value={slow?.contentViews.toLocaleString() ?? "—"}
            loading={slowLoading}
            tooltip="Total number of tracked activity completions recorded across all fellows — a proxy for cumulative content engagement."
          />
        </Col>
      </Row>

      {/* Weekly Activity Trend — own full-width row */}
      <Card
        title={
          <CardTitle
            title="Activity Trend"
            hint="Number of distinct fellows who logged into the platform (Logins) and accessed the course specifically (Interactions) per period. Switch between weekly and monthly views, or filter to a custom date range."
          />
        }>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Segmented
                size="small"
                value={trendView}
                onChange={v => {
                  setTrendView(v as "week" | "month");
                  setTrendRange(null);
                }}
                options={[
                  { label: "Weekly", value: "week" },
                  { label: "Monthly", value: "month" }
                ]}
              />
              <RangePicker
                size="small"
                picker={trendView === "month" ? "month" : "week"}
                value={trendRange}
                onChange={vals =>
                  setTrendRange(vals as [Dayjs | null, Dayjs | null] | null)
                }
                separator="-"
                allowClear
                suffixIcon={null}
                placeholder={
                  trendView === "month"
                    ? ["From month", "To month"]
                    : ["From week", "To week"]
                }
              />
              {trendRange && (trendRange[0] || trendRange[1]) && (
                <button
                  className="text-xs text-slate-400 flex items-center gap-1 hover:text-slate-600 transition-colors"
                  onClick={() => setTrendRange(null)}>
                  <CloseCircleOutlined /> Clear
                </button>
              )}
              <span className="text-xs text-slate-400 ml-auto">
                {trendData.length} {trendView === "month" ? "months" : "weeks"}{" "}
                shown
              </span>
            </div>
            <ActivityLineChart data={trendData} />
          </>
        )}
      </Card>

      {/* Login Heatmap — own full-width row, horizontal (days × hours) */}
      <Card
        title={
          <CardTitle
            title="Login Heatmap"
            hint="When fellows are most active — each row is a day of the week, each column is an hour (00–23). Darker cells = more logins. Hover a cell to see exact counts. Filter by month range to narrow the view."
          />
        }>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="text-sm text-slate-500 font-medium">
                Filter by month:
              </span>
              <RangePicker
                size="small"
                picker="month"
                value={heatmapRange}
                onChange={vals =>
                  setHeatmapRange(vals as [Dayjs | null, Dayjs | null] | null)
                }
                separator="-"
                suffixIcon={null}
                allowClear
                placeholder={["From month", "To month"]}
              />
              {heatmapRange && (heatmapRange[0] || heatmapRange[1]) && (
                <button
                  className="text-xs text-slate-400 flex items-center gap-1 hover:text-slate-600 transition-colors"
                  onClick={() => setHeatmapRange(null)}>
                  <CloseCircleOutlined /> Clear
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-4 m-0 italic">
              {heatmapRangeLabel}
            </p>
            <HeatmapGrid data={heatmapData} />
          </>
        )}
      </Card>

      {/* ── Risk & Intervention ───────────────────────────────────────────── */}
      <SectionLabel>Risk & Intervention</SectionLabel>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <KPICard
            title="Inactive > 7 Days"
            value={risk?.inactiveOver7Days.toLocaleString() ?? "—"}
            valueColor="#D97706"
            loading={slowLoading}
            trend={{ direction: "down", label: "needs follow-up" }}
            tooltip="Fellows whose last course access was more than 7 days ago. Candidates for a re-engagement nudge before they become fully inactive."
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <KPICard
            title="Inactive > 14 Days"
            value={risk?.inactiveOver14Days.toLocaleString() ?? "—"}
            valueColor="#DC2626"
            loading={slowLoading}
            trend={{ direction: "down", label: "critical" }}
            tooltip="Fellows who have not accessed the course in over 14 days. At high risk of dropping out — require direct outreach."
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <KPICard
            title="No Activities Done"
            value={risk?.notStartedCount.toLocaleString() ?? "—"}
            loading={slowLoading}
            tooltip="Fellows who have not completed any tracked course activity yet (0% completion). They may have logged in but haven't engaged with course content."
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card
            title={
              <CardTitle
                title="Risk Distribution"
                hint="Active: course access in the last 7 days. At-Risk: last access was 7–30 days ago. Inactive: no course activity in over 30 days or never logged in."
              />
            }
            className="h-full">
            {slowLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <RiskDonutChart data={risk!.distribution} />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card
            title={
              <CardTitle
                title="Cohort Breakdown"
                hint="Headcount and percentage split across the three risk tiers."
              />
            }
            className="h-full">
            {slowLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    label: "Active Learners",
                    count: risk!.distribution.active,
                    color: "#16A34A",
                    bg: "#F0FDF4"
                  },
                  {
                    label: "At-Risk Learners",
                    count: risk!.distribution.atRisk,
                    color: "#D97706",
                    bg: "#FFFBEB"
                  },
                  {
                    label: "Inactive Learners",
                    count: risk!.distribution.inactive,
                    color: "#DC2626",
                    bg: "#FEF2F2"
                  }
                ].map(item => (
                  <div
                    key={item.label}
                    className="rounded-lg p-5 flex flex-col items-center justify-center text-center"
                    style={{ backgroundColor: item.bg }}>
                    <div
                      className="text-3xl font-bold"
                      style={{ color: item.color }}>
                      {item.count.toLocaleString()}
                    </div>
                    <div className="text-sm font-medium text-slate-700 mt-1">
                      {item.label}
                    </div>
                    <div
                      className="text-xs mt-1 font-semibold"
                      style={{ color: item.color }}>
                      {totalRisk > 0
                        ? Math.round((item.count / totalRisk) * 100)
                        : 0}
                      %
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <CardTitle
            title="Learners — Risk Overview"
            hint="Full list of enrolled fellows with their risk level, completion progress, and last activity. Use the tab filters to drill into active, at-risk, or inactive cohorts."
          />
        }>
        {slowLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <RiskTable data={risk!.fellows} />
        )}
      </Card>

      {/* ── Learning Performance ──────────────────────────────────────────── */}
      <SectionLabel>Learning Performance</SectionLabel>

      <Card
        title={
          <CardTitle
            title="Most Viewed Modules"
            hint="For each module, the number of fellows who have completed at least one activity in it — a measure of reach rather than completion."
          />
        }>
        {slowLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={(slow?.moduleViews ?? []).map(
                (
                  d: { moduleId: number; moduleName: string; views: number },
                  i: number
                ) => ({
                  ...d,
                  fill: CHART_COLORS.modules[i % CHART_COLORS.modules.length]
                })
              )}
              layout="vertical"
              margin={{ top: 10, right: 40, left: 10, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                horizontal={false}
              />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                dataKey="moduleName"
                type="category"
                tick={{ fontSize: 12 }}
                width={160}
              />
              <ChartTooltip
                formatter={(v: unknown) => [
                  Number(v).toLocaleString(),
                  "Fellows Started"
                ]}
              />
              <Bar dataKey="views" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card
        title={
          <CardTitle
            title="Top Learners by Engagement"
            hint="The 20 most engaged active fellows ranked by engagement score (composite of completion % and activity). Only fellows active in the past 7 days are included."
          />
        }>
        {slowLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <LeaderboardTable data={slow?.topLearners ?? []} />
        )}
      </Card>

      {/* ── Activity by Demographics ──────────────────────────────────────── */}
      <SectionLabel>Activity by Demographics</SectionLabel>

      {/* Gender */}
      <Card
        title={
          <CardTitle
            title="Activity by Gender"
            hint="Active, at-risk, and inactive fellow counts by gender. Active = accessed in last 7 days; At-Risk = 7–30 days; Inactive = 30+ days or never."
          />
        }>
        {slowLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-96 shrink-0">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={slow?.activityByGender ?? []}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <ChartTooltip
                    formatter={(v: unknown, name: unknown) => [
                      Number(v).toLocaleString(),
                      name as string
                    ]}
                  />
                  <Legend />
                  <Bar
                    dataKey="active"
                    name="Active"
                    fill={ACT_COLORS.active}
                    radius={[4, 4, 0, 0]}
                    barSize={28}
                  />
                  <Bar
                    dataKey="atRisk"
                    name="At-Risk"
                    fill={ACT_COLORS.atRisk}
                    radius={[4, 4, 0, 0]}
                    barSize={28}
                  />
                  <Bar
                    dataKey="inactive"
                    name="Inactive"
                    fill={ACT_COLORS.inactive}
                    radius={[4, 4, 0, 0]}
                    barSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 min-w-0">
              <Table<ActivityDemBreakdown>
                size="small"
                dataSource={slow?.activityByGender ?? []}
                rowKey="label"
                pagination={false}
                columns={[
                  {
                    title: "Gender",
                    dataIndex: "label",
                    key: "label",
                    render: (v: string) => (
                      <span className="font-medium">{v}</span>
                    )
                  },
                  ...ACT_COLUMNS
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
            title="Activity by Geopolitical Region"
            hint="Active, at-risk, and inactive fellow counts across Nigeria's 6 geopolitical zones. Stacked bars show the full cohort size and engagement split per region."
          />
        }>
        {slowLoading ? (
          <Skeleton active paragraph={{ rows: 7 }} />
        ) : (
          <>
            <ResponsiveContainer
              width="100%"
              height={Math.max(
                280,
                (slow?.activityByRegion?.length ?? 0) * 52
              )}>
              <BarChart
                data={slow?.activityByRegion ?? []}
                layout="vertical"
                margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={140}
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip
                  formatter={(v: unknown, name: unknown) => [
                    Number(v).toLocaleString(),
                    name as string
                  ]}
                />
                <Legend />
                <Bar
                  dataKey="active"
                  name="Active"
                  stackId="a"
                  fill={ACT_COLORS.active}
                  barSize={22}
                />
                <Bar
                  dataKey="atRisk"
                  name="At-Risk"
                  stackId="a"
                  fill={ACT_COLORS.atRisk}
                  barSize={22}
                />
                <Bar
                  dataKey="inactive"
                  name="Inactive"
                  stackId="a"
                  fill={ACT_COLORS.inactive}
                  radius={[0, 4, 4, 0]}
                  barSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
            <Table<ActivityDemBreakdown>
              size="small"
              dataSource={slow?.activityByRegion ?? []}
              rowKey="label"
              pagination={false}
              className="mt-4"
              columns={[
                {
                  title: "Region",
                  dataIndex: "label",
                  key: "label",
                  render: (v: string) => (
                    <span className="font-medium">{v}</span>
                  )
                },
                ...ACT_COLUMNS
              ]}
            />
          </>
        )}
      </Card>

      {/* State */}
      <Card
        title={
          <CardTitle
            title="Activity by State"
            hint="Active, at-risk, and inactive fellow counts per state of origin. Sorted by total enrolment. Use the slider to focus on the top states."
          />
        }>
        {slowLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <span className="text-sm text-slate-500 whitespace-nowrap">
                Top {topStates} of {slow?.activityByState?.length ?? 0} states
              </span>
              <Slider
                min={5}
                max={Math.min(slow?.activityByState?.length ?? 5, 37)}
                value={topStates}
                onChange={setTopStates}
                className="flex-1 min-w-[120px]"
                tooltip={{ formatter: v => `Top ${v}` }}
              />
            </div>
            <ResponsiveContainer
              width="100%"
              height={Math.max(300, topStates * 36)}>
              <BarChart
                data={stateChartData}
                layout="vertical"
                margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={130}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  formatter={(v: unknown, name: unknown) => [
                    Number(v).toLocaleString(),
                    name as string
                  ]}
                />
                <Legend />
                <Bar
                  dataKey="active"
                  name="Active"
                  stackId="a"
                  fill={ACT_COLORS.active}
                  barSize={18}
                />
                <Bar
                  dataKey="atRisk"
                  name="At-Risk"
                  stackId="a"
                  fill={ACT_COLORS.atRisk}
                  barSize={18}
                />
                <Bar
                  dataKey="inactive"
                  name="Inactive"
                  stackId="a"
                  fill={ACT_COLORS.inactive}
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
            <Table<ActivityDemBreakdown>
              size="small"
              dataSource={slow?.activityByState ?? []}
              rowKey="label"
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
                showTotal: t => `${t} states`
              }}
              className="mt-4"
              columns={[
                {
                  title: "State",
                  dataIndex: "label",
                  key: "label",
                  render: (v: string) => (
                    <span className="font-medium">{v}</span>
                  )
                },
                ...ACT_COLUMNS
              ]}
            />
          </>
        )}
      </Card>
    </div>
  );
}
