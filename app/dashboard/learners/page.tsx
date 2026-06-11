"use client";

import { Card, Input, Empty, Skeleton, Result, Button } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useState, useMemo } from "react";
import FellowsTable from "@/components/tables/FellowsTable";
import { useFellows } from "@/hooks/useFellows";

export default function LearnersPage() {
  const { data, isLoading, isError, error, refetch } = useFellows();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (f) =>
        f.fullname.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q)
    );
  }, [data, search]);

  if (isError) {
    return (
      <Result
        status="error"
        title="Failed to load learners"
        subTitle={(error as Error)?.message}
        extra={<Button onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          prefix={<SearchOutlined className="text-slate-400" />}
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72"
          allowClear
        />
        {!isLoading && data && (
          <span className="text-slate-400 text-sm">
            {filtered.length.toLocaleString()} of {data.length.toLocaleString()} fellows
          </span>
        )}
      </div>

      <Card>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : filtered.length === 0 ? (
          <Empty description="No fellows match your search" />
        ) : (
          <FellowsTable data={filtered} />
        )}
      </Card>
    </div>
  );
}
