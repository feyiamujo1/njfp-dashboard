"use client";

import { Layout, Menu } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardOutlined,
  BookOutlined,
  ThunderboltOutlined,
  UserOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";

const { Sider } = Layout;

const NAV_ITEMS = [
  {
    key: "/dashboard",
    icon: <DashboardOutlined />,
    label: <Link href="/dashboard">Overview</Link>,
  },
  {
    key: "/dashboard/learners",
    icon: <UserOutlined />,
    label: <Link href="/dashboard/learners">Fellows</Link>,
  },
  {
    key: "/dashboard/course-structure",
    icon: <ApartmentOutlined />,
    label: <Link href="/dashboard/course-structure">Course Structure</Link>,
  },
  {
    key: "/dashboard/modules",
    icon: <BookOutlined />,
    label: <Link href="/dashboard/modules">Course Progress</Link>,
  },
  {
    key: "/dashboard/engagement",
    icon: <ThunderboltOutlined />,
    label: <Link href="/dashboard/engagement">Learner Engagement</Link>,
  },
];

const NESTED_KEYS = [
  "/dashboard/modules",
  "/dashboard/engagement",
  "/dashboard/assessments",
  "/dashboard/mentorship",
  "/dashboard/risk",
  "/dashboard/learners",
  "/dashboard/course-structure",
];

function getSelectedKey(pathname: string): string {
  if (pathname === "/dashboard") return "/dashboard";
  const match = NESTED_KEYS.find((key) => pathname.startsWith(key));
  return match ?? "/dashboard";
}

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
}

export default function Sidebar({ collapsed, onCollapse }: SidebarProps) {
  const pathname = usePathname();
  const selectedKey = getSelectedKey(pathname);

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      width={240}
      theme="light"
      className="!bg-[#F0F2F6] !border-r !border-[#DDE1EA] sticky top-0 !h-screen overflow-auto"
    >
      {/* Logo */}
      <div
        className={`h-16 flex items-center border-b border-[#DDE1EA] overflow-hidden transition-[padding] duration-200 ${
          collapsed ? "px-7" : "px-5"
        }`}
      >
        {collapsed ? (
          <span className="text-blue-700 font-extrabold text-base tracking-tight">
            NJ
          </span>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="text-slate-900 font-extrabold text-[15px] tracking-tight leading-none">
              NJFP
            </span>
            <span className="text-slate-500 text-[11px] leading-none">
              Entrepreneurship Training
            </span>
          </div>
        )}
      </div>

      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={NAV_ITEMS}
        theme="light"
        className="!bg-[#F4F4F4] !border-r-0 mt-5!"
      />
    </Sider>
  );
}
