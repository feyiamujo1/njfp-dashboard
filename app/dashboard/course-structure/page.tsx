"use client";

import { Card, Tag, Alert, Collapse, Skeleton, Result, Button } from "antd";
import {
  BookOutlined,
  FileTextOutlined,
  MessageOutlined,
  PlayCircleOutlined,
  FormOutlined,
  PaperClipOutlined,
  LinkOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { useCourseStructure } from "@/hooks/useCourseStructure";
import type { CourseModule } from "@/hooks/useCourseStructure";

// ── Activity type config ──────────────────────────────────────────────────────

const MOD_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; tagColor: string; label: string }
> = {
  subsection: {
    icon: <FileTextOutlined className="text-blue-500 text-sm" />,
    color: "bg-blue-50",
    tagColor: "blue",
    label: "lesson",
  },
  forum: {
    icon: <MessageOutlined className="text-purple-500 text-sm" />,
    color: "bg-purple-50",
    tagColor: "purple",
    label: "forum",
  },
  label: {
    icon: <PlayCircleOutlined className="text-slate-400 text-sm" />,
    color: "",
    tagColor: "default",
    label: "video",
  },
  quiz: {
    icon: <QuestionCircleOutlined className="text-orange-500 text-sm" />,
    color: "bg-orange-50",
    tagColor: "orange",
    label: "quiz",
  },
  assign: {
    icon: <FormOutlined className="text-green-500 text-sm" />,
    color: "bg-green-50",
    tagColor: "green",
    label: "assignment",
  },
  resource: {
    icon: <PaperClipOutlined className="text-teal-500 text-sm" />,
    color: "bg-teal-50",
    tagColor: "cyan",
    label: "resource",
  },
  url: {
    icon: <LinkOutlined className="text-teal-500 text-sm" />,
    color: "bg-teal-50",
    tagColor: "cyan",
    label: "link",
  },
};

const DEFAULT_MOD = {
  icon: <BookOutlined className="text-slate-400 text-sm" />,
  color: "",
  tagColor: "default" as const,
  label: "activity",
};

function getModConfig(modname: string) {
  return MOD_CONFIG[modname] ?? DEFAULT_MOD;
}

// ── Activity row ──────────────────────────────────────────────────────────────

function ActivityRow({ mod, index }: { mod: CourseModule; index: number }) {
  const cfg = getModConfig(mod.modname);
  const tracked = mod.completion > 0;

  return (
    <div
      className={`flex items-center gap-2.5 py-1.5 px-2 rounded-md ${cfg.color}`}
    >
      {cfg.icon}
      <span className="text-slate-700 text-sm flex-1 min-w-0 truncate">
        {mod.modname === "subsection" && (
          <span className="text-slate-400 mr-1.5 text-xs">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
        {mod.name}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        {tracked && (
          <Tag color="geekblue" className="text-xs m-0">
            tracked
          </Tag>
        )}
        <Tag color={cfg.tagColor} className="text-xs m-0">
          {cfg.label}
        </Tag>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CourseStructurePage() {
  const { data, isLoading, isError, error, refetch } = useCourseStructure();

  if (isError) {
    return (
      <Result
        status="error"
        title="Failed to load course structure"
        subTitle={(error as Error)?.message}
        extra={<Button onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <Skeleton active paragraph={{ rows: 12 }} />
        </Card>
      </div>
    );
  }

  const sections = data?.sections ?? [];
  const totalTracked = sections.reduce((s, sec) => s + sec.trackedCount, 0);
  const totalActivities = sections.reduce((s, sec) => s + sec.totalModules, 0);

  const collapseItems = sections.map((sec) => {
    const lessonCount = sec.modules.filter((m) => m.modname === "subsection").length;
    const isIntro = sec.section === 0;
    let lessonIdx = 0;

    return {
      key: String(sec.id),
      label: (
        <div className="flex items-center gap-3 min-w-0">
          <BookOutlined className="text-blue-600 shrink-0" />
          <span className="font-semibold text-slate-800 truncate">{sec.name}</span>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {lessonCount > 0 && (
              <Tag color="blue" className="m-0">
                {lessonCount} lesson{lessonCount !== 1 ? "s" : ""}
              </Tag>
            )}
            {sec.trackedCount > 0 && (
              <Tag color="geekblue" className="m-0 hidden sm:inline-flex">
                {sec.trackedCount} tracked
              </Tag>
            )}
          </div>
        </div>
      ),
      children: (
        <div className="space-y-1.5 pl-1">
          {sec.modules.length === 0 ? (
            <p className="text-slate-400 text-sm italic">No activities in this section.</p>
          ) : (
            sec.modules.map((mod) => {
              const idx = mod.modname === "subsection" ? lessonIdx++ : -1;
              return <ActivityRow key={mod.id} mod={mod} index={idx} />;
            })
          )}
          {!isIntro && (
            <p className="text-slate-400 text-xs pt-1 pl-1">
              {sec.trackedCount} of {sec.totalModules} activit
              {sec.totalModules !== 1 ? "ies" : "y"} contribute to completion tracking.
            </p>
          )}
        </div>
      ),
    };
  });

  return (
    <div className="space-y-4">
      <Alert
        type="info"
        showIcon
        description="Live from the NJFP Moodle LMS. Tracked items (subsections) count toward each learner's completion percentage."
      />

      <Card
        title={
          <div className="flex items-center gap-3">
            <span>Course Content Map</span>
            <span className="text-slate-400 text-sm font-normal">
              {sections.length} sections · {totalActivities} activities · {totalTracked} tracked
            </span>
          </div>
        }
        extra={
          <div className="hidden sm:flex items-center gap-3 text-sm text-slate-500">
            <span><Tag color="blue">lesson</Tag> subsection</span>
            <span><Tag color="geekblue">tracked</Tag> counts toward completion</span>
            <span><Tag color="purple">forum</Tag> discussion</span>
          </div>
        }
      >
        <Collapse
          items={collapseItems}
          defaultActiveKey={sections.length > 0 ? [String(sections[1]?.id ?? sections[0]?.id)] : []}
          className="bg-transparent!"
        />
      </Card>
    </div>
  );
}
