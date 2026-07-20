"use client";

import { Table, Tag, Button, Input, Progress } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { SearchOutlined, WarningFilled } from "@ant-design/icons";
import moment from "moment";
import type { FellowSummary, RiskLevel } from "@/lib/types";
import { TABLE_PAGE_SIZE, CHART_COLORS } from "@/lib/constants";

const RISK_TAG: Record<RiskLevel, { color: string; label: string }> = {
  active: { color: "success", label: "Active" },
  at_risk: { color: "warning", label: "At Risk" },
  inactive: { color: "error", label: "Inactive" },
};

type FilterTab = "all" | RiskLevel;

interface Props {
  data: FellowSummary[];
  loading?: boolean;
}

export default function RiskTable({ data, loading }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return data.filter((f) => {
      const matchesTab = activeTab === "all" || f.riskLevel === activeTab;
      const words = search.trim().toLowerCase().split(/\s+/);
      const haystack = [f.fullname, f.email, f.state ?? ""].join(" ").toLowerCase();
      const matchesSearch = !words[0] || words.every(w => haystack.includes(w));
      return matchesTab && matchesSearch;
    });
  }, [data, activeTab, search]);

  const TAB_LABELS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "at_risk", label: "At Risk" },
    { key: "inactive", label: "Inactive" },
  ];

  const columns: ColumnsType<FellowSummary> = [
    {
      title: "Name",
      key: "name",
      render: (_: unknown, r: FellowSummary) => (
        <span className="font-medium text-slate-900 flex items-center gap-1.5">
          {r.lastcourseaccess === 0 && (
            <WarningFilled className="text-red-500 shrink-0" title="Never logged in" />
          )}
          {r.fullname}
        </span>
      ),
    },
    {
      title: "Last Activity",
      dataIndex: "lastcourseaccess",
      key: "lastActive",
      render: (ts: number) => ts === 0 ? "Never" : moment.unix(ts).fromNow(),
      sorter: (a, b) => b.lastcourseaccess - a.lastcourseaccess,
    },
    {
      title: "Completion",
      key: "completion",
      width: 220,
      sorter: (a, b) => b.completionPct - a.completionPct,
      render: (_: unknown, r: FellowSummary) => (
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
      title: "Risk Level",
      dataIndex: "riskLevel",
      key: "risk",
      render: (v: RiskLevel) => (
        <Tag color={RISK_TAG[v].color}>{RISK_TAG[v].label}</Tag>
      ),
    },
    {
      title: "Action",
      key: "action",
      render: (_, r) => (
        <Button
          size="small"
          type="link"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/dashboard/learners/${r.id}`);
          }}
        >
          View Profile
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        {/* Filter tabs */}
        <div className="flex gap-1">
          {TAB_LABELS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                activeTab === t.key
                  ? "bg-blue-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Input
          prefix={<SearchOutlined className="text-slate-400" />}
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
          size="small"
          allowClear
        />
      </div>

      <Table
        columns={columns}
        dataSource={filtered}
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
    </div>
  );
}
