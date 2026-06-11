"use client";

import { Button } from "antd";
import {
  AlertOutlined,
  ApartmentOutlined,
  ArrowRightOutlined,
  BookOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  UserOutlined,
} from "@ant-design/icons";
import Link from "next/link";


const SECTIONS = [
  {
    icon: <BookOutlined className="text-2xl text-blue-700" />,
    title: "Course Progress",
    href: "/dashboard/modules",
    description:
      "Track module completion rates across all 7 modules. View the enrolment-to-completion funnel and identify where fellows disengage.",
  },
  {
    icon: <ThunderboltOutlined className="text-2xl text-violet-600" />,
    title: "Engagement",
    href: "/dashboard/engagement",
    description:
      "Monitor daily, weekly, and monthly active users. Explore login heatmaps and see which modules drive the most content interactions.",
  },
  {
    icon: <TrophyOutlined className="text-2xl text-amber-600" />,
    title: "Learning Performance",
    href: "/dashboard/assessments",
    description:
      "Analyse quiz scores by module, assignment submission rates, and pass/fail distribution. Surface top learners and those needing support.",
  },
  {
    icon: <TeamOutlined className="text-2xl text-green-600" />,
    title: "Mentorship",
    href: "/dashboard/mentorship",
    description:
      "Evaluate webinar attendance, mentor session participation, pod engagement, and forum activity. View per-fellow engagement scores.",
  },
  {
    icon: <AlertOutlined className="text-2xl text-red-600" />,
    title: "Risk & Intervention",
    href: "/dashboard/risk",
    description:
      "Identify at-risk and inactive fellows based on last activity, quiz scores, and engagement. Act early before fellows fall behind.",
  },
  {
    icon: <UserOutlined className="text-2xl text-cyan-600" />,
    title: "Fellow Profiles",
    href: "/dashboard/learners",
    description:
      "Access individual profiles with module-by-module progress, quiz history, assignment status, and a full activity timeline.",
  },
];

export default function HomePage() {
  return (
    <div className="bg-slate-50 min-h-screen font-sans">

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 to-blue-900 py-24 px-8 text-center">
        <span className="text-blue-300 text-xs tracking-widest uppercase font-semibold">
          NJFP · Entrepreneurship Skills Training
        </span>
        <h1 className="text-white text-4xl font-bold mt-4 mb-4 leading-tight">
          Programme Analytics Dashboard
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          A single command centre for monitoring enrolled fellows across
          course progress, engagement, learning performance, mentorship, and
          risk intervention.
        </p>
        <Link href="/dashboard">
          <Button
            type="primary"
            size="large"
            icon={<ArrowRightOutlined />}
            iconPosition="end"
          >
            Open Dashboard
          </Button>
        </Link>
      </section>

      {/* Section cards */}
      <section className="py-16 px-8 max-w-6xl mx-auto">
        <h2 className="text-center text-2xl font-semibold text-slate-900 mb-2">
          What the dashboard tracks
        </h2>
        <p className="text-center text-slate-500 text-sm mb-10">
          Six specialised views — each built for a different angle of programme
          performance.
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

      {/* Course structure callout */}
      <section className="px-8 pb-16 max-w-6xl mx-auto">
        <Link href="/dashboard/course-structure" className="block">
          <div className="bg-white border border-slate-200 rounded-lg px-8 py-6 flex items-center justify-between hover:shadow-md hover:border-blue-300 transition-all">
            <div className="flex items-center gap-4">
              <ApartmentOutlined className="text-2xl text-slate-400" />
              <div>
                <h3 className="text-slate-900 font-semibold text-base mb-1">
                  Course Structure
                </h3>
                <p className="text-slate-500 text-sm">
                  Explore the full course content map pulled directly from the
                  NJFP Moodle LMS — sections, modules, and activity types.
                </p>
              </div>
            </div>
            <ArrowRightOutlined className="text-slate-400 text-base shrink-0 ml-4" />
          </div>
        </Link>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 px-8 border-t border-slate-200 text-slate-400 text-xs">
        NJFP Entrepreneurship Training · Internal Use Only
      </footer>

    </div>
  );
}
