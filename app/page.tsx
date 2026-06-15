"use client";

import { Button, Skeleton } from "antd";
import {
  ApartmentOutlined,
  ArrowRightOutlined,
  BookOutlined,
  DashboardOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useOverview } from "@/hooks/useOverview";
import { useEngagement } from "@/hooks/useEngagement";

const SECTIONS = [
  {
    icon: <DashboardOutlined className="text-2xl text-blue-700" />,
    title: "Programme Overview",
    href: "/dashboard",
    description:
      "See the headline numbers at a glance — total enrolled fellows, active vs at-risk counts, average completion rate, and the top 20 learners by engagement. Fast-loading KPIs update separately from heavier charts.",
  },
  {
    icon: <BookOutlined className="text-2xl text-violet-600" />,
    title: "Course Progress",
    href: "/dashboard/modules",
    description:
      "Module-by-module completion rates with enrolled vs completed counts, an enrolment funnel from start to finish, and drop-off trends across modules. Completion data is further broken down by gender, geopolitical region, and state.",
  },
  {
    icon: <ThunderboltOutlined className="text-2xl text-amber-600" />,
    title: "Engagement",
    href: "/dashboard/engagement",
    description:
      "Daily, weekly, and monthly active user counts. An activity trend chart (switch between weekly and monthly, filter by date range) and a login heatmap by day and hour. Includes risk tier breakdown and activity split by gender, region, and state.",
  },
  {
    icon: <UserOutlined className="text-2xl text-cyan-600" />,
    title: "Fellow Profiles",
    href: "/dashboard/learners",
    description:
      "Search and filter all enrolled fellows by name, state, region, or gender. Drill into any individual profile for module-by-module progress, quiz scores per module, engagement score, and last activity.",
  },
  {
    icon: <ApartmentOutlined className="text-2xl text-slate-400" />,
    title: "Course Structure",
    href: "/dashboard/course-structure",
    description:
      " Explore the full course content map pulled directly from the NJFP Moodle LMS — sections, modules, and activity types.",
  },
];

function StatItem({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-4">
      {loading ? (
        <Skeleton.Input active size="small" style={{ width: 64, marginBottom: 4 }} />
      ) : (
        <span className="text-white text-2xl font-bold leading-tight">{value}</span>
      )}
      <span className="text-blue-300 text-xs mt-1 tracking-wide">{label}</span>
    </div>
  );
}

export default function HomePage() {
  const { data: overview, isLoading: overviewLoading } = useOverview();
  const { data: engagement, isLoading: engagementLoading } = useEngagement();

  const stats = overview?.stats;

  return (
    <div className="bg-slate-50 min-h-screen font-sans">

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 to-blue-900 py-20 px-8 text-center">
        <span className="text-blue-300 text-xs tracking-widest uppercase font-semibold">
          NJFP · Entrepreneurship Skills Training
        </span>
        <h1 className="text-white text-4xl font-bold mt-4 mb-4 leading-tight">
          Programme Analytics Dashboard
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          A single command centre for monitoring enrolled fellows across
          course progress, engagement, and risk intervention.
        </p>
        {/* Live stats bar */}
        <div className="mt-10 inline-flex flex-wrap justify-center divide-x divide-blue-800 border border-blue-800 rounded-xl bg-white/5 backdrop-blur-sm mx-auto">
          <StatItem
            label="Fellows Enrolled"
            value={stats?.totalFellows.toLocaleString() ?? "—"}
            loading={overviewLoading}
          />
          <StatItem
            label="Active This Week"
            value={engagement?.wau.toLocaleString() ?? "—"}
            loading={engagementLoading}
          />
          <StatItem
            label="Active This Month"
            value={engagement?.mau.toLocaleString() ?? "—"}
            loading={engagementLoading}
          />
          <StatItem
            label="At Risk"
            value={stats?.atRiskCount.toLocaleString() ?? "—"}
            loading={overviewLoading}
          />
          <StatItem
            label="Never Started"
            value={stats?.neverStarted.toLocaleString() ?? "—"}
            loading={overviewLoading}
          />
        </div>

        <div className="mt-10">
          <Link href="/dashboard">
            <Button type="primary" size="large">
              Open Dashboard <ArrowRightOutlined />
            </Button>
          </Link>
        </div>
      </section>

      {/* Section cards */}
      <section className="py-16 px-8 max-w-6xl mx-auto">
        <h2 className="text-center text-2xl font-semibold text-slate-900 mb-2">
          What the dashboard tracks
        </h2>
        <p className="text-center text-slate-500 text-sm mb-10">
          Four specialised views — each built for a different angle of programme performance.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} className="block h-full">
              <div className="bg-white border border-slate-200 rounded-lg p-6 h-full hover:shadow-md hover:border-blue-300 transition-all">
                <div className="mb-3">{s.icon}</div>
                <h3 className="text-slate-900 font-semibold text-base mb-2">
                  {s.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {s.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 px-8 border-t border-slate-200 text-slate-400 text-xs">
        NJFP Entrepreneurship Training · Internal Use Only
      </footer>

    </div>
  );
}
