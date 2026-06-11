"use client";

import { Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import moment from "moment";
import type { AssignmentSummary } from "@/lib/types";
import { TABLE_PAGE_SIZE } from "@/lib/constants";

interface Props {
  data: AssignmentSummary[];
  loading?: boolean;
}

export default function AssignmentTable({ data, loading }: Props) {
  const columns: ColumnsType<AssignmentSummary> = [
    {
      title: "Assignment",
      dataIndex: "name",
      key: "name",
      render: (v: string) => (
        <span className="font-medium text-slate-900 text-sm">{v}</span>
      ),
    },
    {
      title: "Module",
      dataIndex: "moduleName",
      key: "module",
      render: (v: string) => (
        <span className="text-slate-500 text-sm">{v}</span>
      ),
    },
    {
      title: "Status",
      dataIndex: "submitted",
      key: "status",
      render: (submitted: boolean) => (
        <Tag color={submitted ? "success" : "default"}>
          {submitted ? "Submitted" : "Not Submitted"}
        </Tag>
      ),
      filters: [
        { text: "Submitted", value: true },
        { text: "Not Submitted", value: false },
      ],
      onFilter: (value, record) => record.submitted === value,
    },
    {
      title: "Submitted At",
      dataIndex: "submittedAt",
      key: "submittedAt",
      render: (ts?: number) =>
        ts ? moment.unix(ts).format("DD MMM YYYY") : "—",
    },
    {
      title: "Grade",
      dataIndex: "grade",
      key: "grade",
      render: (v?: number) =>
        v !== undefined ? (
          <span
            className={`font-semibold ${
              v >= 70
                ? "text-green-600"
                : v >= 50
                ? "text-amber-600"
                : "text-red-600"
            }`}
          >
            {v}%
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      size="middle"
      pagination={{
        pageSize: TABLE_PAGE_SIZE,
        showSizeChanger: false,
        showTotal: (total) => `${total} assignments`,
        position: ["bottomRight"],
      }}
    />
  );
}
