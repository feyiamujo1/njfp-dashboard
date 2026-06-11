"use client";

import { Table, Tag, Avatar } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import moment from "moment";
import type { FellowSummary, RiskLevel } from "@/lib/types";
import { TABLE_PAGE_SIZE } from "@/lib/constants";

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
      title: "Last Active",
      dataIndex: "lastcourseaccess",
      key: "lastActive",
      render: (ts: number) => (
        <span className="text-slate-600 text-sm">
          {moment.unix(ts).fromNow()}
        </span>
      ),
      sorter: (a, b) => b.lastcourseaccess - a.lastcourseaccess,
    },
    {
      title: "Completion",
      dataIndex: "completionPct",
      key: "completion",
      render: (v: number) => (
        <span className="font-medium">{v}%</span>
      ),
      sorter: (a, b) => b.completionPct - a.completionPct,
    },
    {
      title: "Avg Quiz",
      dataIndex: "avgQuizScore",
      key: "quiz",
      render: (v: number) => (
        <span className="font-medium">{v}%</span>
      ),
      sorter: (a, b) => b.avgQuizScore - a.avgQuizScore,
    },
    {
      title: "Risk Level",
      dataIndex: "riskLevel",
      key: "risk",
      render: (v: RiskLevel) => (
        <Tag color={RISK_TAG[v].color}>{RISK_TAG[v].label}</Tag>
      ),
      filters: [
        { text: "Active", value: "active" },
        { text: "At Risk", value: "at_risk" },
        { text: "Inactive", value: "inactive" },
      ],
      onFilter: (value, record) => record.riskLevel === value,
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
