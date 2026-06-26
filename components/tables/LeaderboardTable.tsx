"use client";

import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { FellowSummary } from "@/lib/types";
import { TABLE_PAGE_SIZE } from "@/lib/constants";

interface Props {
  data: FellowSummary[];
  loading?: boolean;
}

export default function LeaderboardTable({ data, loading }: Props) {
  const ranked = data.map((f, i) => ({ ...f, rank: i + 1 }));

  const columns: ColumnsType<(typeof ranked)[0]> = [
    {
      title: "#",
      dataIndex: "rank",
      key: "rank",
      width: 50,
      render: (v: number) => (
        <span
          className={`font-bold text-sm ${
            v === 1
              ? "text-yellow-500"
              : v === 2
              ? "text-slate-400"
              : v === 3
              ? "text-amber-600"
              : "text-slate-500"
          }`}
        >
          {v}
        </span>
      ),
    },
    {
      title: "Fellow Name",
      dataIndex: "fullname",
      key: "name",
      render: (v: string) => (
        <span className="font-medium text-slate-900">{v}</span>
      ),
    },
    {
      title: "Completion %",
      dataIndex: "completionPct",
      key: "completion",
      render: (v: number) => (
        <span className="font-semibold text-blue-700">{v}%</span>
      ),
      sorter: (a, b) => b.completionPct - a.completionPct,
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={ranked}
      rowKey="id"
      loading={loading}
      size="middle"
      pagination={{
        pageSize: TABLE_PAGE_SIZE,
        showSizeChanger: false,
        showTotal: (total) => `${total} fellows`,
        position: ["bottomRight"],
      }}
    />
  );
}
