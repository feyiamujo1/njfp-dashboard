"use client";

import { useState, useEffect } from "react";
import { Layout, Space, Typography } from "antd";
import { usePathname } from "next/navigation";
import { toast } from "react-toastify";

const { Header } = Layout;
const { Text, Title } = Typography;

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/modules": "Course Progress",
  "/dashboard/engagement": "Engagement",
  "/dashboard/assessments": "Learning Performance",
  "/dashboard/mentorship": "Mentorship",
  "/dashboard/risk": "Risk & Intervention",
  "/dashboard/learners": "Learners",
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

  return (
    <Header className="!bg-white !px-6 !h-16 !leading-normal border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
      <div className="flex flex-col gap-0.5">
        <Title level={5} className="!m-0 !leading-none">
          {getPageTitle(pathname)}
        </Title>
        {/* {lastUpdated && (
          <Text type="secondary" className="!text-[11px]">
            Last updated: {formatTimestamp(lastUpdated)}
          </Text>
        )} */}
      </div>
    </Header>
  );
}
