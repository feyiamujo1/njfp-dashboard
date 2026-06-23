"use client";

import { use, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  Row,
  Col,
  Skeleton,
  Result,
  Button,
  Tooltip,
  Table,
  Tag,
  Input,
  Select,
  Progress
} from "antd";
import {
  ArrowLeftOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  SearchOutlined
} from "@ant-design/icons";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import KPICard from "@/components/cards/KPICard";
import { useModuleDetail } from "@/hooks/useModuleDetail";
import { downloadCsv, formatTs } from "@/lib/export";
import { CHART_COLORS, TABLE_PAGE_SIZE } from "@/lib/constants";
import type { ModuleStudentSummary, ModuleDemBreakdown } from "@/lib/types";

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

const STATUS_COLORS: Record<ModuleStudentSummary["status"], string> = {
  completed: "green",
  in_progress: "blue",
  not_started: "default"
};

const STATUS_LABELS: Record<ModuleStudentSummary["status"], string> = {
  completed: "Completed",
  in_progress: "In Progress",
  not_started: "Not Started"
};

const DEM_COLUMNS = [
  {
    title: "Enrolled",
    dataIndex: "total",
    key: "total",
    align: "right" as const,
    render: (v: number) => v.toLocaleString()
  },
  {
    title: "Completed",
    key: "completed",
    align: "right" as const,
    render: (_: unknown, r: ModuleDemBreakdown) => (
      <span className="font-medium">
        {r.completed.toLocaleString()}{" "}
        <Tag
          color={
            r.completionPct >= 20
              ? "green"
              : r.completionPct >= 10
                ? "orange"
                : "default"
          }
          className="text-xs">
          {r.completionPct}%
        </Tag>
      </span>
    )
  }
];

export default function ModuleDetailPage({
  params
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId: moduleIdStr } = use(params);
  const moduleId = Number(moduleIdStr);
  const router = useRouter();

  const { data, isLoading, isError, error, refetch } =
    useModuleDetail(moduleId);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    ModuleStudentSummary["status"] | "all"
  >("all");

  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];
    return data.students.filter(s => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const words = search.trim().toLowerCase().split(/\s+/);
      const haystack = [s.fullname, s.email, s.state ?? ""]
        .join(" ")
        .toLowerCase();
      return words.every(w => haystack.includes(w));
    });
  }, [data?.students, search, statusFilter]);

  if (isError) {
    return (
      <Result
        status="error"
        title="Failed to load module detail"
        subTitle={(error as Error)?.message}
        extra={<Button onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  const total = data?.totalEnrolled ?? 0;

  return (
    <div className="space-y-6!">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.back()}
            type="text"
            className="text-slate-500 hover:text-slate-900 -ml-2">
            Go Back
          </Button>
        </div>
        {isLoading ? (
          <Skeleton.Input active size="small" style={{ width: 260 }} />
        ) : (
          <div>
            {/* <span className="text-slate-400 text-sm mr-2">Module {moduleId}</span> */}
          </div>
        )}
      </div>

      <div>
        <h1 className="text-lg font-semibold text-slate-800">
          {data?.moduleName}
        </h1>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Total Enrolled"
            value={isLoading ? "—" : total.toLocaleString()}
            loading={isLoading}
            tooltip="All fellows currently enrolled in the course."
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Started Module"
            value={isLoading ? "—" : (data?.startedPct ?? "—")}
            suffix={data ? "%" : ""}
            loading={isLoading}
            valueColor="#1D4ED8"
            tooltip="% of enrolled fellows who have completed at least one activity in this module."
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="In Progress"
            value={
              isLoading ? "—" : (data?.inProgressCount.toLocaleString() ?? "—")
            }
            loading={isLoading}
            valueColor="#D97706"
            tooltip="Fellows who have started but not yet finished all activities in this module."
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Fully Completed"
            value={isLoading ? "—" : (data?.completedPct ?? "—")}
            suffix={data ? "%" : ""}
            loading={isLoading}
            valueColor="#16A34A"
            tooltip="% of enrolled fellows who have completed every tracked activity in this module."
          />
        </Col>
      </Row>

      {/* ── Activity Drop-Off ────────────────────────────────────────────────── */}
      <SectionLabel>Activity Completion Within Module</SectionLabel>

      <Card
        title={
          <CardTitle
            title="Activity Drop-Off"
            hint="Completion rate for each individual activity in this module, in the order they appear. Declining bars show where learners stop engaging as they move through the module."
          />
        }
        extra={
          <Button
            size="small"
            icon={<DownloadOutlined />}
            disabled={isLoading || !data?.activities?.length}
            onClick={() =>
              downloadCsv(
                `module-${moduleId}-activities.csv`,
                ["Activity", "Type", "Completed (count)", "Completion %"],
                (data?.activities ?? []).map(a => [
                  a.name,
                  a.modname,
                  a.completedCount,
                  a.completionPct
                ])
              )
            }>
            Export
          </Button>
        }>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : !data?.activities?.length ? (
          <p className="text-sm text-slate-400 text-center py-6">
            No tracked activities found for this module.
          </p>
        ) : (
          <>
            <ResponsiveContainer
              width="100%"
              height={Math.max(240, data.activities.length * 44)}>
              <BarChart
                data={data.activities}
                layout="vertical"
                margin={{ left: 8, right: 56, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={v => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={200}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) =>
                    v.length > 32 ? `${v.slice(0, 32)}…` : v
                  }
                />
                <ChartTooltip
                  formatter={(
                    v: unknown,
                    _: unknown,
                    props: {
                      payload?: { name?: string; completedCount?: number };
                    }
                  ) => [
                    `${v}% (${(props.payload?.completedCount ?? 0).toLocaleString()} fellows)`,
                    "Completion"
                  ]}
                  labelFormatter={(
                    _: unknown,
                    payload: ReadonlyArray<{ payload?: { name?: string } }>
                  ) => payload?.[0]?.payload?.name ?? ""}
                />
                <Bar
                  dataKey="completionPct"
                  name="Completion %"
                  radius={[0, 4, 4, 0]}
                  barSize={22}>
                  {data.activities.map((a, i) => (
                    <Cell
                      key={a.cmid}
                      fill={
                        a.completionPct >= 60
                          ? CHART_COLORS.success
                          : a.completionPct >= 30
                            ? CHART_COLORS.warning
                            : CHART_COLORS.modules[
                                i % CHART_COLORS.modules.length
                              ]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-3">
              {data.activities.map(a => (
                <div key={a.cmid} className="flex items-center gap-3">
                  <Tag className="w-16 text-center shrink-0">{a.modname}</Tag>
                  <span
                    className="text-sm text-slate-700 flex-1 truncate"
                    title={a.name}>
                    {a.name}
                  </span>
                  <Progress
                    percent={a.completionPct}
                    size="small"
                    showInfo={false}
                    strokeColor={
                      a.completionPct >= 60
                        ? CHART_COLORS.success
                        : a.completionPct >= 30
                          ? CHART_COLORS.warning
                          : CHART_COLORS.error
                    }
                    styles={{ rail: { background: "#f1f5f9" } }}
                    style={{ width: 120, flexShrink: 0 }}
                  />
                  <span className="text-xs text-slate-500 w-20 text-right shrink-0">
                    {a.completedCount.toLocaleString()} · {a.completionPct}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* ── Quiz Participation ───────────────────────────────────────────────── */}
      {(isLoading || data?.hasQuiz) && (
        <Card
          title={
            <CardTitle
              title="Quiz Participation"
              hint="Number and % of enrolled fellows who completed the quiz in this module."
            />
          }>
          {isLoading ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : (
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <KPICard
                  title="Quiz Participants"
                  value={data!.quizParticipantCount.toLocaleString()}
                  tooltip="Fellows who completed at least one quiz activity in this module."
                  valueColor="#1D4ED8"
                />
              </Col>
              <Col xs={24} sm={12}>
                <KPICard
                  title="Participation Rate"
                  value={data!.quizParticipationPct}
                  suffix="%"
                  tooltip="% of all enrolled fellows who participated in this module's quiz."
                  valueColor={
                    data!.quizParticipationPct >= 50 ? "#16A34A" : "#D97706"
                  }
                />
              </Col>
            </Row>
          )}
        </Card>
      )}

      {/* ── Completion by Demographics ───────────────────────────────────────── */}
      <SectionLabel>Completion by Demographics</SectionLabel>

      {/* Gender */}
      <Card
        title={
          <CardTitle
            title="Completion by Gender"
            hint="How many fellows from each gender group have fully completed this module."
          />
        }
        extra={
          <Button
            size="small"
            icon={<DownloadOutlined />}
            disabled={isLoading || !data?.completionByGender?.length}
            onClick={() =>
              downloadCsv(
                `module-${moduleId}-gender.csv`,
                ["Gender", "Enrolled", "Completed", "Completion %"],
                (data?.completionByGender ?? []).map(r => [
                  r.label,
                  r.total,
                  r.completed,
                  r.completionPct
                ])
              )
            }>
            Export
          </Button>
        }>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-80 shrink-0">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={data?.completionByGender ?? []}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    tickFormatter={v => `${v}%`}
                  />
                  <ChartTooltip
                    formatter={(v: unknown) => [`${v}%`, "Completion"]}
                  />
                  <Bar
                    dataKey="completionPct"
                    name="Completed %"
                    fill={CHART_COLORS.success}
                    radius={[4, 4, 0, 0]}
                    barSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1">
              <Table<ModuleDemBreakdown>
                size="small"
                dataSource={data?.completionByGender ?? []}
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
                  ...DEM_COLUMNS
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
            title="Completion by Geopolitical Region"
            hint="Module completion rates across Nigeria's 6 geopolitical zones."
          />
        }
        extra={
          <Button
            size="small"
            icon={<DownloadOutlined />}
            disabled={isLoading || !data?.completionByRegion?.length}
            onClick={() =>
              downloadCsv(
                `module-${moduleId}-region.csv`,
                ["Region", "Enrolled", "Completed", "Completion %"],
                (data?.completionByRegion ?? []).map(r => [
                  r.label,
                  r.total,
                  r.completed,
                  r.completionPct
                ])
              )
            }>
            Export
          </Button>
        }>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <>
            <ResponsiveContainer
              width="100%"
              height={Math.max(
                260,
                (data?.completionByRegion?.length ?? 0) * 52
              )}>
              <BarChart
                data={data?.completionByRegion ?? []}
                layout="vertical"
                margin={{ left: 8, right: 56, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={v => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={140}
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip
                  formatter={(v: unknown) => [`${v}%`, "Completed"]}
                />
                <Bar
                  dataKey="completionPct"
                  name="Completed %"
                  fill={CHART_COLORS.primary}
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
            <Table<ModuleDemBreakdown>
              size="small"
              dataSource={data?.completionByRegion ?? []}
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
                ...DEM_COLUMNS
              ]}
            />
          </>
        )}
      </Card>

      {/* State */}
      <Card
        title={
          <CardTitle
            title="Completion by State"
            hint="Module completion counts per state of origin, sorted by total enrolment."
          />
        }
        extra={
          <Button
            size="small"
            icon={<DownloadOutlined />}
            disabled={isLoading || !data?.completionByState?.length}
            onClick={() =>
              downloadCsv(
                `module-${moduleId}-state.csv`,
                ["State", "Enrolled", "Completed", "Completion %"],
                (data?.completionByState ?? []).map(r => [
                  r.label,
                  r.total,
                  r.completed,
                  r.completionPct
                ])
              )
            }>
            Export All States
          </Button>
        }>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <Table<ModuleDemBreakdown>
            size="small"
            dataSource={data?.completionByState ?? []}
            rowKey="label"
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              showTotal: t => `${t} states`
            }}
            columns={[
              {
                title: "State",
                dataIndex: "label",
                key: "label",
                render: (v: string) => <span className="font-medium">{v}</span>
              },
              ...DEM_COLUMNS,
              {
                title: "Completion Rate",
                key: "bar",
                width: 180,
                render: (_: unknown, r: ModuleDemBreakdown) => (
                  <div className="flex items-center gap-2">
                    <Progress
                      percent={r.completionPct}
                      showInfo={false}
                      size="small"
                      strokeColor={
                        r.completionPct >= 20
                          ? CHART_COLORS.success
                          : CHART_COLORS.warning
                      }
                      styles={{ rail: { background: "#f1f5f9" } }}
                      style={{ flex: 1 }}
                    />
                    <span className="text-xs text-slate-500 w-8 text-right">
                      {r.completionPct}%
                    </span>
                  </div>
                )
              }
            ]}
          />
        )}
      </Card>

      {/* ── Student Table ────────────────────────────────────────────────────── */}
      <SectionLabel>All Students</SectionLabel>

      <Card
        title={
          <CardTitle
            title="Student Completion — This Module"
            hint="Every enrolled fellow and their completion status for this module. Filter by status or search by name, email, or state."
          />
        }
        extra={
          <Button
            size="small"
            icon={<DownloadOutlined />}
            disabled={isLoading || !filteredStudents.length}
            onClick={() =>
              downloadCsv(
                `module-${moduleId}-students.csv`,
                [
                  "Name",
                  "Email",
                  "Gender",
                  "State",
                  "LGA",
                  "Region",
                  "Last Access",
                  "Activities Done",
                  "Total Activities",
                  "Completion %",
                  "Status"
                ],
                filteredStudents.map(s => [
                  s.fullname,
                  s.email,
                  s.gender ?? "Not Specified",
                  s.state ?? "Not Specified",
                  s.lga ?? "Not Specified",
                  s.region ?? "Not Specified",
                  formatTs(s.lastcourseaccess),
                  s.activitiesDone,
                  s.totalActivities,
                  s.completionPct,
                  STATUS_LABELS[s.status]
                ])
              )
            }>
            Export
          </Button>
        }>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Input
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="Search name, email or state…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                allowClear
                style={{ maxWidth: 280 }}
                size="small"
              />
              <Select
                size="small"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 148 }}
                options={[
                  { value: "all", label: "All Statuses" },
                  { value: "completed", label: "Completed" },
                  { value: "in_progress", label: "In Progress" },
                  { value: "not_started", label: "Not Started" }
                ]}
              />
              <span className="text-xs text-slate-400 ml-auto">
                {filteredStudents.length.toLocaleString()} of{" "}
                {total.toLocaleString()} fellows
              </span>
            </div>

            <Table<ModuleStudentSummary>
              size="small"
              dataSource={filteredStudents}
              rowKey="id"
              pagination={{
                pageSize: TABLE_PAGE_SIZE,
                showSizeChanger: false,
                showTotal: t => `${t} fellows`,
                position: ["bottomRight"]
              }}
              onRow={record => ({
                onClick: () => router.push(`/dashboard/learners/${record.id}`),
                className: "cursor-pointer hover:bg-slate-50"
              })}
              columns={[
                {
                  title: "Name",
                  dataIndex: "fullname",
                  key: "fullname",
                  render: (v: string) => (
                    <span className="font-medium">{v}</span>
                  ),
                  sorter: (a, b) => a.fullname.localeCompare(b.fullname)
                },
                {
                  title: "State",
                  dataIndex: "state",
                  key: "state",
                  render: (v: string | null) =>
                    v ?? <span className="text-slate-400">—</span>
                },
                {
                  title: "Last Access",
                  dataIndex: "lastcourseaccess",
                  key: "lastcourseaccess",
                  render: (v: number) => (
                    <span className="text-slate-500 text-xs">
                      {formatTs(v)}
                    </span>
                  ),
                  sorter: (a, b) =>
                    (b.lastcourseaccess ?? 0) - (a.lastcourseaccess ?? 0)
                },
                {
                  title: "Progress",
                  key: "progress",
                  width: 180,
                  render: (_: unknown, r: ModuleStudentSummary) => (
                    <div className="flex items-center gap-2">
                      <Progress
                        percent={r.completionPct}
                        showInfo={false}
                        size="small"
                        strokeColor={
                          r.completionPct === 100
                            ? CHART_COLORS.success
                            : r.completionPct > 0
                              ? CHART_COLORS.primary
                              : CHART_COLORS.neutral
                        }
                        styles={{ rail: { background: "#f1f5f9" } }}
                        style={{ flex: 1 }}
                      />
                      <span className="text-xs text-slate-500 shrink-0 w-16 text-right">
                        {r.activitiesDone}/{r.totalActivities} ·{" "}
                        {r.completionPct}%
                      </span>
                    </div>
                  ),
                  sorter: (a, b) => b.completionPct - a.completionPct
                },
                {
                  title: "Status",
                  dataIndex: "status",
                  key: "status",
                  width: 110,
                  render: (v: ModuleStudentSummary["status"]) => (
                    <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v]}</Tag>
                  ),
                  filters: [
                    { text: "Completed", value: "completed" },
                    { text: "In Progress", value: "in_progress" },
                    { text: "Not Started", value: "not_started" }
                  ],
                  onFilter: (value, record) => record.status === value
                }
              ]}
            />
          </>
        )}
      </Card>
    </div>
  );
}
