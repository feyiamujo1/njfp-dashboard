"use client";

import { useState } from "react";
import { Layout } from "antd";
import Sidebar from "./Sidebar";
import DashboardHeader from "./Header";

const { Content } = Layout;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Layout className="min-h-screen">
      <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />
      <Layout className="overflow-hidden">
        <DashboardHeader />
        <Content className="p-6 bg-[#F8FAFC] overflow-y-auto h-[calc(100vh-64px)]">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
