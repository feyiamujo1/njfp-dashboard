"use client";

import { Table, Avatar } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import moment from "moment";
import type { Fellow } from "@/lib/types";
import { TABLE_PAGE_SIZE } from "@/lib/constants";

interface Props {
  data: Fellow[];
  loading?: boolean;
}

export default function FellowsTable({ data, loading }: Props) {
  const router = useRouter();

  const columns: ColumnsType<Fellow> = [
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
