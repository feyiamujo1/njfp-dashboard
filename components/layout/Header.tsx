"use client";

import { useState, useEffect } from "react";
import { Layout, Button, DatePicker, Space, Typography } from "antd";
import { CalendarOutlined, ReloadOutlined } from "@ant-design/icons";
import { usePathname } from "next/navigation";
import { toast } from "react-toastify";

const { Header } = Layout;
const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/modules": "Course Progress",
  "/dashboard/engagement": "Engagement",
  "/dashboard/assessments": "Learning Performance",
  "/dashboard/mentorship": "Mentorship",
  "/dashboard/risk": "Risk & Intervention",
  "/dashboard/learners": "Fellows",
  "/dashboard/course-structure": "Course Structure"
};

function getPageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Overview";
  const match = Object.entries(PAGE_TITLES).find(
    ([key]) => key !== "/dashboard" && pathname.startsWith(key)
  );
  return match?.[1] ?? "Dashboard";
}

function formatTimestamp(date: Date): string {
  const datePart = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  const timePart = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  });
  return `${datePart}, ${timePart}`;
}

export default function DashboardHeader() {
  const pathname = usePathname();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    setLastUpdated(new Date());
  }, []);

  const handleRefresh = () => {
    const id = toast.loading("Refreshing...");
    setTimeout(() => {
      toast.dismiss(id);
      toast.success("Data refreshed successfully");
      setLastUpdated(new Date());
    }, 1000);
  };

  return (
    <Header className="!bg-white !px-6 !h-16 !leading-normal border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
      <div className="flex flex-col gap-0.5">
        <Title level={5} className="!m-0 !leading-none">
          {getPageTitle(pathname)}
        </Title>
        {lastUpdated && (
          <Text type="secondary" className="!text-[11px]">
            Last updated: {formatTimestamp(lastUpdated)}
          </Text>
        )}
      </div>

      <Space>
        <RangePicker separator="-" size="small" />
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          size="small"
          iconPlacement={"start"}>
          Refresh
        </Button>
      </Space>
    </Header>
  );
}
