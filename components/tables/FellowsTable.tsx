"use client";

import { Table, Avatar, Tag, Progress } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import moment from "moment";
import type { FellowSummary, RiskLevel } from "@/lib/types";
import { TABLE_PAGE_SIZE, CHART_COLORS } from "@/lib/constants";

const GENDER_COLOR: Record<string, string> = {
  Female: "pink",
  Male: "blue",
};

const RISK_TAG: Record<RiskLevel, { color: string; label: string }> = {
  active: { color: "success", label: "Active" },
  at_risk: { color: "warning", label: "At Risk" },
  inactive: { color: "error", label: "Inactive" },
};

interface Props {
  data: FellowSummary[];
  loading?: boolean;
}

export default function FellowsTable({ data, loading }: Props) {
  const router = useRouter();

  const columns: ColumnsType<FellowSummary> = [
    {
      title: "Fellow",
      key: "fellow",
      render: (_, r) => (
        <div className="flex items-center gap-3">
          <Avatar src={r.profileimageurl} size={36}>
            {r.fullname.charAt(0)}
          </Avatar>
          <div>
            <div className="font-medium text-slate-900 text-sm">{r.fullname}</div>
            <div className="text-slate-400 text-xs">{r.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: "Gender",
      dataIndex: "gender",
      key: "gender",
      width: 90,
      render: (v: string | null) =>
        v ? (
          <Tag color={GENDER_COLOR[v] ?? "default"} className="m-0">
            {v}
          </Tag>
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        ),
    },
    {
      title: "State",
      dataIndex: "state",
      key: "state",
      render: (v: string | null) => (
        <span className="text-slate-600 text-sm">{v ?? "—"}</span>
      ),
    },
    {
      title: "Completion",
      key: "completion",
      width: 220,
      sorter: (a, b) => b.completionPct - a.completionPct,
      render: (_, r) => (
        <div className="flex items-center gap-2">
          <Progress
            percent={r.completionPct}
            showInfo={false}
            size="small"
            strokeColor={
              r.completionPct === 100
                ? CHART_COLORS.success
                : r.completionPct >= 50
                ? CHART_COLORS.primary
                : r.completionPct > 0
                ? CHART_COLORS.warning
                : CHART_COLORS.neutral
            }
            styles={{ rail: { background: "#f1f5f9" } }}
            style={{ flex: 1 }}
          />
          <span className="text-xs text-slate-500 w-24 text-right shrink-0">
            {r.activitiesDone}/{r.totalActivities} · {r.completionPct}%
          </span>
        </div>
      ),
    },
    {
      title: "Risk",
      dataIndex: "riskLevel",
      key: "risk",
      width: 100,
      render: (v: RiskLevel) => (
        <Tag color={RISK_TAG[v].color} className="m-0">
          {RISK_TAG[v].label}
        </Tag>
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
        <span className="text-slate-500 text-xs">
          {ts ? moment.unix(ts).fromNow() : "Never"}
        </span>
      ),
      sorter: (a, b) => (b.lastcourseaccess ?? 0) - (a.lastcourseaccess ?? 0),
      defaultSortOrder: "ascend",
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      size="middle"
      onRow={(r) => ({
        onClick: () => router.push(`/dashboard/learners/${r.id}`),
        className: "cursor-pointer hover:bg-blue-50",
      })}
      pagination={{
        pageSize: TABLE_PAGE_SIZE,
        showSizeChanger: false,
        showTotal: (total) => `${total} fellows`,
        position: ["bottomRight"],
      }}
    />
  );
}
