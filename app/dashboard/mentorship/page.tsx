"use client";

import { useState, useMemo } from "react";
import {
  Card, Row, Col, Skeleton, Result, Button, Table, Tag, Avatar,
  Progress, Collapse, Input, Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import {
  CheckCircleOutlined, StopOutlined, UsergroupAddOutlined,
  SearchOutlined, InfoCircleOutlined, DownloadOutlined, RiseOutlined,
} from "@ant-design/icons";
import moment from "moment";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import KPICard from "@/components/cards/KPICard";
import { useMentorship } from "@/hooks/useMentorship";
import { CHART_COLORS, TABLE_PAGE_SIZE } from "@/lib/constants";
import type { MentorshipMember, MentorshipGroup, RiskLevel } from "@/lib/types";
import { downloadCsv } from "@/lib/export";

const GROUP_COLORS = ["#1D4ED8", "#7C3AED", "#16A34A"];
const GROUP_TAG_COLORS = ["blue", "purple", "green"];

const RISK_COLORS: Record<RiskLevel, string> = {
  active: "success",
  at_risk: "warning",
  inactive: "error",
};
const RISK_LABELS: Record<RiskLevel, string> = {
  active: "Active",
  at_risk: "At Risk",
  inactive: "Inactive",
};

const MEMBER_CSV_HEADERS = [
  "Name", "Email", "State", "Gender",
  "Completion %", "Engagement Score", "Risk", "Last Active",
];

function memberCsvRows(members: MentorshipMember[]) {
  return members.map(m => [
    m.fullname, m.email, m.state ?? "", m.gender ?? "",
    m.completionPct, m.engagementScore,
    RISK_LABELS[m.riskLevel],
    m.lastcourseaccess ? moment.unix(m.lastcourseaccess).format("YYYY-MM-DD") : "Never",
  ]);
}

const COMPLETION_COLORS = {
  completed: "#16A34A",
  inProgress: "#1D4ED8",
  notStarted: "#94A3B8",
};

// ── Shared member table ────────────────────────────────────────────────────────

function MemberTable({ members }: { members: MentorshipMember[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m => {
      const hay = [m.fullname, m.email, m.state ?? ""].join(" ").toLowerCase();
      return q.split(/\s+/).every(w => hay.includes(w));
    });
  }, [members, search]);

  const columns: ColumnsType<MentorshipMember> = [
    {
      title: "Fellow",
      key: "fellow",
      render: (_, r) => (
        <div className="flex items-center gap-2">
          <Avatar src={r.profileimageurl} size={28}>{r.fullname[0]}</Avatar>
          <div>
            <div className="font-medium text-sm text-slate-900">{r.fullname}</div>
            <div className="text-xs text-slate-400">{r.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: "State",
      dataIndex: "state",
      key: "state",
      width: 110,
      render: (v: string | null) => (
        <span className="text-slate-600 text-sm">{v ?? "—"}</span>
      ),
    },
    {
      title: "Completion",
      key: "completion",
      width: 190,
      sorter: (a, b) => b.completionPct - a.completionPct,
      render: (_, r) => (
        <div className="flex items-center gap-2">
          <Progress
            percent={r.completionPct}
            showInfo={false}
            size="small"
            strokeColor={
              r.completionPct === 100 ? CHART_COLORS.success
                : r.completionPct >= 50 ? CHART_COLORS.primary
                : r.completionPct > 0 ? CHART_COLORS.warning
                : CHART_COLORS.neutral
            }
            styles={{ rail: { background: "#f1f5f9" } }}
            style={{ flex: 1 }}
          />
          <span className="text-xs text-slate-500 w-10 text-right shrink-0">
            {r.completionPct}%
          </span>
        </div>
      ),
    },
    {
      title: "Engagement",
      dataIndex: "engagementScore",
      key: "engagement",
      width: 100,
      sorter: (a, b) => b.engagementScore - a.engagementScore,
      render: (v: number) => <span className="text-slate-600 text-sm">{v}</span>,
    },
    {
      title: "Risk",
      dataIndex: "riskLevel",
      key: "risk",
      width: 95,
      render: (v: RiskLevel) => (
        <Tag color={RISK_COLORS[v]} className="m-0">{RISK_LABELS[v]}</Tag>
      ),
      filters: [
        { text: "Active", value: "active" },
        { text: "At Risk", value: "at_risk" },
        { text: "Inactive", value: "inactive" },
      ],
      onFilter: (value, record) => record.riskLevel === value,
    },
    {
      title: "Last Active",
      dataIndex: "lastcourseaccess",
      key: "lastActive",
      render: (ts: number) => (
        <span className="text-xs text-slate-500">
          {ts ? moment.unix(ts).fromNow() : "Never"}
        </span>
      ),
      sorter: (a, b) => (b.lastcourseaccess ?? 0) - (a.lastcourseaccess ?? 0),
    },
  ];

  return (
    <div>
      <div className="mb-3">
        <Input
          prefix={<SearchOutlined className="text-slate-400" />}
          placeholder="Search by name, email, state..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          size="small"
          className="w-56"
          allowClear
        />
      </div>
      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        size="small"
        onRow={r => ({
          onClick: () => router.push(`/dashboard/learners/${r.id}`),
          className: "cursor-pointer hover:bg-blue-50",
        })}
        pagination={{
          pageSize: TABLE_PAGE_SIZE,
          showSizeChanger: false,
          showTotal: t => `${t} members`,
          position: ["bottomRight"],
        }}
      />
    </div>
  );
}

// ── Per-group detail panel ─────────────────────────────────────────────────────

function GroupDetailPanel({ group, colorIndex }: { group: MentorshipGroup; colorIndex: number }) {
  const color = GROUP_COLORS[colorIndex] ?? CHART_COLORS.primary;
  const total = group.memberCount || 1;

  const completionPieData = [
    { name: "Completed", value: group.completionBreakdown.completed, fill: COMPLETION_COLORS.completed },
    { name: "In Progress", value: group.completionBreakdown.inProgress, fill: COMPLETION_COLORS.inProgress },
    { name: "Not Started", value: group.completionBreakdown.notStarted, fill: COMPLETION_COLORS.notStarted },
  ].filter(d => d.value > 0);

  const riskPieData = [
    { name: "Active", value: group.riskBreakdown.active, fill: "#16A34A" },
    { name: "At-Risk", value: group.riskBreakdown.atRisk, fill: "#D97706" },
    { name: "Inactive", value: group.riskBreakdown.inactive, fill: "#DC2626" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 pt-2">
      {/* Mini stats */}
      <Row gutter={[12, 12]}>
        {[
          {
            label: "Avg Completion",
            tooltip: "Average course completion % across all members of this group.",
            value: `${group.avgCompletionPct}%`, bg: "bg-slate-50", style: { color },
          },
          {
            label: "Avg Engagement",
            tooltip: "Average engagement score across group members. Currently mirrors completion % and will incorporate quiz performance when available.",
            value: group.avgEngagementScore, bg: "bg-slate-50", style: { color: "#374151" },
          },
          {
            label: "Active",
            tooltip: "Members who accessed the course in the last 7 days, or have completed ≥80% of all activities.",
            value: group.riskBreakdown.active, bg: "bg-green-50", style: { color: "#15803D" },
          },
          {
            label: "Inactive",
            tooltip: "Members with no course activity in over 14 days, or who have never accessed the course.",
            value: group.riskBreakdown.inactive, bg: "bg-red-50", style: { color: "#DC2626" },
          },
        ].map(s => (
          <Col xs={12} sm={6} key={s.label}>
            <div className={`text-center p-3 ${s.bg} rounded-lg`}>
              <div className="text-2xl font-bold" style={s.style}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center justify-center gap-0.5">
                {s.label}
                <Tooltip title={s.tooltip} styles={{ root: { maxWidth: 260 } }}>
                  <InfoCircleOutlined className="text-slate-300 text-[10px] cursor-help" />
                </Tooltip>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Charts + tables */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
              Completion Status
              <Tooltip title="Completed = every tracked activity in the course is done (100%). In Progress = at least one activity completed. Not Started = no activities completed yet." styles={{ root: { maxWidth: 280 } }}>
                <InfoCircleOutlined className="text-slate-400 cursor-help text-xs font-normal" />
              </Tooltip>
            </h4>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={completionPieData} cx="50%" cy="50%" outerRadius={65} dataKey="value">
                  {completionPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <ChartTooltip formatter={(v: unknown) => [Number(v), "Fellows"]} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <table className="w-full text-xs mt-3 border-t border-slate-200">
              <thead>
                <tr className="text-slate-400">
                  <th className="text-left py-1.5 font-medium">Status</th>
                  <th className="text-right py-1.5 font-medium">Count</th>
                  <th className="text-right py-1.5 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Completed", count: group.completionBreakdown.completed },
                  { label: "In Progress", count: group.completionBreakdown.inProgress },
                  { label: "Not Started", count: group.completionBreakdown.notStarted },
                ].map(row => (
                  <tr key={row.label} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-600">{row.label}</td>
                    <td className="py-1.5 text-right font-medium">{row.count}</td>
                    <td className="py-1.5 text-right text-slate-400">
                      {Math.round((row.count / total) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Col>

        <Col xs={24} md={12}>
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
              Risk Distribution
              <Tooltip title="Active: accessed course in last 7 days, or ≥80% complete. At-Risk: last access 7–14 days ago with low completion. Inactive: no access in 14+ days or never accessed." styles={{ root: { maxWidth: 280 } }}>
                <InfoCircleOutlined className="text-slate-400 cursor-help text-xs font-normal" />
              </Tooltip>
            </h4>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={riskPieData} cx="50%" cy="50%" outerRadius={65} dataKey="value">
                  {riskPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <ChartTooltip formatter={(v: unknown) => [Number(v), "Fellows"]} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <table className="w-full text-xs mt-3 border-t border-slate-200">
              <thead>
                <tr className="text-slate-400">
                  <th className="text-left py-1.5 font-medium">Risk Level</th>
                  <th className="text-right py-1.5 font-medium">Count</th>
                  <th className="text-right py-1.5 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Active", count: group.riskBreakdown.active, color: "success" as const },
                  { label: "At-Risk", count: group.riskBreakdown.atRisk, color: "warning" as const },
                  { label: "Inactive", count: group.riskBreakdown.inactive, color: "error" as const },
                ].map(row => (
                  <tr key={row.label} className="border-t border-slate-100">
                    <td className="py-1.5">
                      <Tag color={row.color} className="m-0 text-xs">{row.label}</Tag>
                    </td>
                    <td className="py-1.5 text-right font-medium">{row.count}</td>
                    <td className="py-1.5 text-right text-slate-400">
                      {Math.round((row.count / total) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Col>
      </Row>

      {/* Description */}
      <div
        className="text-sm text-slate-600 bg-blue-50 rounded-lg p-4 border border-blue-100"
        dangerouslySetInnerHTML={{ __html: group.description }}
      />

      {/* Member table */}
      <div>
        <div className="text-sm font-semibold text-slate-700 mb-3">
          Members ({group.memberCount})
        </div>
        <MemberTable members={group.members} />
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MentorshipPage() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useMentorship();
  const [unassignedSearch, setUnassignedSearch] = useState("");

  const filteredUnassigned = useMemo(() => {
    if (!data?.unassigned) return [];
    const q = unassignedSearch.trim().toLowerCase();
    if (!q) return data.unassigned;
    return data.unassigned.filter(m => {
      const hay = [m.fullname, m.email, m.state ?? ""].join(" ").toLowerCase();
      return q.split(/\s+/).every(w => hay.includes(w));
    });
  }, [data?.unassigned, unassignedSearch]);

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

  const loading = isLoading || !data;

  const comparisonChartData = data?.groups.map((g, i) => ({
    name: g.idnumber,
    fullName: g.name,
    completion: g.avgCompletionPct,
    engagement: g.avgEngagementScore,
    color: GROUP_COLORS[i] ?? CHART_COLORS.primary,
  })) ?? [];

  const collapseItems = data?.groups.map((g, i) => ({
    key: String(g.id),
    label: (
      <div className="flex items-center gap-2">
        <Tag color={GROUP_TAG_COLORS[i]} className="m-0">{g.idnumber}</Tag>
        <span className="font-semibold">{g.name}</span>
        <span className="text-slate-400 font-normal text-sm">— {g.memberCount} members</span>
      </div>
    ),
    extra: (
      <Button
        size="small"
        icon={<DownloadOutlined />}
        onClick={e => {
          e.stopPropagation();
          downloadCsv(
            `${g.idnumber}-${g.name.replace(/\s+/g, "-")}-members.csv`,
            MEMBER_CSV_HEADERS,
            memberCsvRows(g.members)
          );
        }}
      >
        Export
      </Button>
    ),
    children: <GroupDetailPanel group={g} colorIndex={i} />,
  })) ?? [];

  const unassignedColumns: ColumnsType<MentorshipMember> = [
    {
      title: "Fellow",
      key: "fellow",
      render: (_, r) => (
        <div className="flex items-center gap-2">
          <Avatar src={r.profileimageurl} size={28}>{r.fullname[0]}</Avatar>
          <div>
            <div className="font-medium text-sm text-slate-900">{r.fullname}</div>
            <div className="text-xs text-slate-400">{r.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: "State",
      dataIndex: "state",
      key: "state",
      width: 110,
      render: (v: string | null) => (
        <span className="text-slate-600 text-sm">{v ?? "—"}</span>
      ),
    },
    {
      title: "Completion",
      key: "completion",
      width: 190,
      sorter: (a, b) => b.completionPct - a.completionPct,
      render: (_, r) => (
        <div className="flex items-center gap-2">
          <Progress
            percent={r.completionPct}
            showInfo={false}
            size="small"
            strokeColor={
              r.completionPct === 100 ? CHART_COLORS.success
                : r.completionPct >= 50 ? CHART_COLORS.primary
                : r.completionPct > 0 ? CHART_COLORS.warning
                : CHART_COLORS.neutral
            }
            styles={{ rail: { background: "#f1f5f9" } }}
            style={{ flex: 1 }}
          />
          <span className="text-xs text-slate-500 w-10 text-right shrink-0">
            {r.completionPct}%
          </span>
        </div>
      ),
    },
    {
      title: "Risk",
      dataIndex: "riskLevel",
      key: "risk",
      width: 95,
      render: (v: RiskLevel) => (
        <Tag color={RISK_COLORS[v]} className="m-0">{RISK_LABELS[v]}</Tag>
      ),
      filters: [
        { text: "Active", value: "active" },
        { text: "At Risk", value: "at_risk" },
        { text: "Inactive", value: "inactive" },
      ],
      onFilter: (value, record) => record.riskLevel === value,
    },
    {
      title: "Last Active",
      dataIndex: "lastcourseaccess",
      key: "lastActive",
      render: (ts: number) => (
        <span className="text-xs text-slate-500">
          {ts ? moment.unix(ts).fromNow() : "Never"}
        </span>
      ),
      sorter: (a, b) => (b.lastcourseaccess ?? 0) - (a.lastcourseaccess ?? 0),
    },
  ];

  return (
    <div className="!space-y-6">
      {/* KPI row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <KPICard
            title="Total Groups"
            value={data?.totalGroups ?? "—"}
            icon={<UsergroupAddOutlined />}
            loading={loading}
            tooltip="Number of mentorship self-selection groups in the course."
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KPICard
            title="Assigned Fellows"
            value={data?.assignedCount ?? "—"}
            suffix={data ? ` (${Math.round((data.assignedCount / data.totalEnrolled) * 100)}%)` : ""}
            icon={<CheckCircleOutlined />}
            valueColor="#16A34A"
            loading={loading}
            tooltip="Fellows who have joined a mentorship group."
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KPICard
            title="Unassigned Fellows"
            value={data?.unassignedCount ?? "—"}
            suffix={data ? ` (${Math.round((data.unassignedCount / data.totalEnrolled) * 100)}%)` : ""}
            icon={<StopOutlined />}
            valueColor="#D97706"
            loading={loading}
            tooltip="Enrolled fellows who have not yet joined any mentorship group."
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KPICard
            title="Overall Avg Completion"
            value={data?.overallAvgCompletion ?? "—"}
            suffix={data ? "%" : ""}
            icon={<RiseOutlined />}
            valueColor="#1D4ED8"
            loading={loading}
            tooltip="Average course completion % across all fellows who are in a group."
          />
        </Col>
      </Row>

      {/* Cross-group comparison */}
      <Card
        title={
          <span className="flex items-center gap-1.5">
            Group Performance Comparison
            <Tooltip title="Side-by-side comparison of average completion % and average engagement score per group.">
              <InfoCircleOutlined className="text-slate-400 cursor-help text-xs font-normal" />
            </Tooltip>
          </span>
        }
        extra={
          !loading && data && (
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() =>
                downloadCsv(
                  "group-comparison.csv",
                  [
                    "Group ID", "Group Name", "Members",
                    "Avg Completion %", "Avg Engagement",
                    "Active", "At-Risk", "Inactive",
                    "Completed", "In Progress", "Not Started",
                  ],
                  data.groups.map(g => [
                    g.idnumber, g.name, g.memberCount,
                    g.avgCompletionPct, g.avgEngagementScore,
                    g.riskBreakdown.active, g.riskBreakdown.atRisk, g.riskBreakdown.inactive,
                    g.completionBreakdown.completed, g.completionBreakdown.inProgress, g.completionBreakdown.notStarted,
                  ])
                )
              }
            >
              Export
            </Button>
          )
        }
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <>
            <Row gutter={[24, 24]}>
              <Col xs={24} md={12}>
                <div className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wide">
                  Avg Completion %
                </div>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart
                    data={comparisonChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 36, left: 12, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={36} />
                    <ChartTooltip
                      formatter={(v: unknown) => [`${Number(v)}%`, "Avg Completion"]}
                      labelFormatter={(label: unknown) =>
                        comparisonChartData.find(d => d.name === String(label))?.fullName ?? String(label)
                      }
                    />
                    <Bar dataKey="completion" radius={[0, 4, 4, 0]} maxBarSize={32}>
                      {comparisonChartData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Col>

              <Col xs={24} md={12}>
                <div className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wide">
                  Avg Engagement Score
                </div>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart
                    data={comparisonChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 36, left: 12, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={36} />
                    <ChartTooltip
                      formatter={(v: unknown) => [Number(v), "Avg Engagement"]}
                      labelFormatter={(label: unknown) =>
                        comparisonChartData.find(d => d.name === String(label))?.fullName ?? String(label)
                      }
                    />
                    <Bar dataKey="engagement" radius={[0, 4, 4, 0]} maxBarSize={32}>
                      {comparisonChartData.map((d, i) => (
                        <Cell key={i} fill={d.color} fillOpacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Col>
            </Row>

            {/* Summary table */}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400">
                    <th className="text-left py-2 font-medium">Group</th>
                    <th className="text-right py-2 font-medium">Members</th>
                    <th className="text-right py-2 font-medium">Avg Completion</th>
                    <th className="text-right py-2 font-medium">
                      <Tooltip title="Average engagement score per group. Currently mirrors completion % — will incorporate quiz scores when available." styles={{ root: { maxWidth: 260 } }}>
                        <span className="cursor-help border-b border-dashed border-slate-300">Avg Engagement</span>
                      </Tooltip>
                    </th>
                    <th className="text-right py-2 font-medium text-green-600">Active</th>
                    <th className="text-right py-2 font-medium text-amber-600">At-Risk</th>
                    <th className="text-right py-2 font-medium text-red-500">Inactive</th>
                    <th className="text-right py-2 font-medium">Completed</th>
                    <th className="text-right py-2 font-medium">In Progress</th>
                    <th className="text-right py-2 font-medium">Not Started</th>
                  </tr>
                </thead>
                <tbody>
                  {data.groups.map((g, i) => (
                    <tr key={g.id} className="border-b border-slate-100">
                      <td className="py-2">
                        <div className="flex items-center gap-1.5">
                          <Tag color={GROUP_TAG_COLORS[i]} className="m-0">{g.idnumber}</Tag>
                          <span className="font-medium text-slate-700">{g.name}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right text-slate-600">{g.memberCount}</td>
                      <td className="py-2 text-right font-semibold" style={{ color: GROUP_COLORS[i] }}>
                        {g.avgCompletionPct}%
                      </td>
                      <td className="py-2 text-right text-slate-600">{g.avgEngagementScore}</td>
                      <td className="py-2 text-right text-green-600 font-medium">{g.riskBreakdown.active}</td>
                      <td className="py-2 text-right text-amber-600 font-medium">{g.riskBreakdown.atRisk}</td>
                      <td className="py-2 text-right text-red-500 font-medium">{g.riskBreakdown.inactive}</td>
                      <td className="py-2 text-right text-green-600">{g.completionBreakdown.completed}</td>
                      <td className="py-2 text-right text-blue-600">{g.completionBreakdown.inProgress}</td>
                      <td className="py-2 text-right text-slate-400">{g.completionBreakdown.notStarted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Per-group detail with member lists */}
      <Card
        title={
          <span className="flex items-center gap-1.5">
            Group Details & Members
            <Tooltip title="Expand a group to see its completion status breakdown, risk distribution charts, and the full member list. Click any row to view a fellow's profile.">
              <InfoCircleOutlined className="text-slate-400 cursor-help text-xs font-normal" />
            </Tooltip>
          </span>
        }
        extra={
          !loading && data && (
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() =>
                downloadCsv(
                  "all-group-members.csv",
                  ["Group ID", "Group Name", ...MEMBER_CSV_HEADERS],
                  data.groups.flatMap(g =>
                    g.members.map(m => [g.idnumber, g.name, ...memberCsvRows([m])[0]])
                  )
                )
              }
            >
              Export All Members
            </Button>
          )
        }
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <Collapse items={collapseItems} />
        )}
      </Card>

      {/* Unassigned fellows */}
      <Card
        title={
          <span className="flex items-center gap-1.5">
            Unassigned Fellows
            <Tooltip title="Fellows enrolled in the course who have not yet joined any mentorship group. Consider following up to encourage participation.">
              <InfoCircleOutlined className="text-slate-400 cursor-help text-xs font-normal" />
            </Tooltip>
          </span>
        }
        extra={
          !loading && !!data?.unassigned.length && (
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() =>
                downloadCsv("unassigned-fellows.csv", MEMBER_CSV_HEADERS, memberCsvRows(data.unassigned))
              }
            >
              Export ({data.unassigned.length})
            </Button>
          )
        }
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <>
            <div className="mb-4">
              <Input
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="Search by name, email or state..."
                value={unassignedSearch}
                onChange={e => setUnassignedSearch(e.target.value)}
                size="small"
                className="w-64"
                allowClear
              />
            </div>
            <Table
              columns={unassignedColumns}
              dataSource={filteredUnassigned}
              rowKey="id"
              size="small"
              onRow={r => ({
                onClick: () => router.push(`/dashboard/learners/${r.id}`),
                className: "cursor-pointer hover:bg-blue-50",
              })}
              pagination={{
                pageSize: TABLE_PAGE_SIZE,
                showSizeChanger: false,
                showTotal: t => `${t} fellows`,
                position: ["bottomRight"],
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
}
