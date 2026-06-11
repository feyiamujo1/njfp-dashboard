"use client";

import { Card, Input, Select, Empty, Skeleton, Result, Button } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useState, useMemo } from "react";
import FellowsTable from "@/components/tables/FellowsTable";
import { useFellows } from "@/hooks/useFellows";
import type { RiskLevel } from "@/lib/types";

type RiskFilter = "all" | RiskLevel;

export default function LearnersPage() {
  const { data, isLoading, isError, error, refetch } = useFellows();
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((f) => {
      const matchesRisk = riskFilter === "all" || f.riskLevel === riskFilter;
      const matchesSearch = f.fullname
        .toLowerCase()
        .includes(search.toLowerCase());
      return matchesRisk && matchesSearch;
    });
  }, [data, search, riskFilter]);

  if (isError) {
    return (
      <Result
        status="error"
        title="Failed to load fellows"
        subTitle={(error as Error)?.message}
        extra={<Button onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          prefix={<SearchOutlined className="text-slate-400" />}
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
          allowClear
        />
        <Select
          value={riskFilter}
          onChange={setRiskFilter}
          className="w-40"
          options={[
            { label: "All Risk Levels", value: "all" },
            { label: "Active", value: "active" },
            { label: "At Risk", value: "at_risk" },
            { label: "Inactive", value: "inactive" },
          ]}
        />
        {!isLoading && (
          <span className="text-slate-400 text-sm">
            {filtered.length.toLocaleString()} fellows
          </span>
        )}
      </div>

      <Card>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : filtered.length === 0 ? (
          <Empty description="No fellows match your filters" />
        ) : (
          <FellowsTable data={filtered} />
        )}
      </Card>
    </div>
  );
}
