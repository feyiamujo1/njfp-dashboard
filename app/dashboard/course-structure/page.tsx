"use client";

import { Card, Tag, Alert, Collapse, Skeleton, Result, Button, Empty, Tooltip } from "antd";
import {
  BookOutlined,
  FileTextOutlined,
  MessageOutlined,
  PlayCircleOutlined,
  FormOutlined,
  PaperClipOutlined,
  LinkOutlined,
  QuestionCircleOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { downloadCsv } from "@/lib/export";
import { useCourseStructure } from "@/hooks/useCourseStructure";
import type { CourseModule, CourseSection } from "@/hooks/useCourseStructure";

// ── Activity type config ──────────────────────────────────────────────────────

const MOD_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; tagColor: string; label: string }
> = {
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
    label: "content",
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
    label: "file",
  },
  folder: {
    icon: <FolderOpenOutlined className="text-yellow-500 text-sm" />,
    color: "bg-yellow-50",
    tagColor: "gold",
    label: "resources",
  },
  url: {
    icon: <LinkOutlined className="text-teal-500 text-sm" />,
    color: "bg-teal-50",
    tagColor: "cyan",
    label: "link",
  },
  subsection: {
    icon: <FileTextOutlined className="text-blue-500 text-sm" />,
    color: "bg-blue-50",
    tagColor: "blue",
    label: "lesson",
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

// ── Single activity row ───────────────────────────────────────────────────────

function ActivityRow({ mod }: { mod: CourseModule }) {
  const cfg = getModConfig(mod.modname);
  const tracked = mod.completion > 0;

  return (
    <div className={`flex items-center gap-2.5 py-1.5 px-2 rounded-md ${cfg.color}`}>
      {cfg.icon}
      <span className="text-slate-700 text-sm flex-1 min-w-0 truncate">{mod.name}</span>
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

// ── Nested lesson sections (Lesson 1.1 → 5 tracked activities) ───────────────

function LessonList({ subSections }: { subSections: CourseSection[] }) {
  if (subSections.length === 0) return null;

  const items = subSections.map((lesson, lessonIdx) => ({
    key: String(lesson.id),
    label: (
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-slate-400 text-xs shrink-0 w-5 text-right">
          {String(lessonIdx + 1).padStart(2, "0")}
        </span>
        <FileTextOutlined className="text-blue-400 shrink-0 text-xs" />
        <span className="text-slate-700 text-sm truncate flex-1">{lesson.name}</span>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {lesson.trackedCount > 0 && (
            <Tag color="geekblue" className="text-xs m-0">
              {lesson.trackedCount} tracked
            </Tag>
          )}
          {lesson.totalModules > 0 && (
            <Tag color="default" className="text-xs m-0 hidden sm:inline-flex">
              {lesson.totalModules} {lesson.totalModules === 1 ? "activity" : "activities"}
            </Tag>
          )}
        </div>
      </div>
    ),
    children: (
      <div className="space-y-1.5 pl-1">
        {lesson.modules.length === 0 ? (
          <p className="text-slate-400 text-xs italic">No activities in this lesson.</p>
        ) : (
          lesson.modules.map((mod) => <ActivityRow key={mod.id} mod={mod} />)
        )}
      </div>
    ),
  }));

  return (
    <div className="mt-2 border-t border-slate-100 pt-2">
      <p className="text-xs text-slate-400 mb-2 pl-1">
        {subSections.length} lesson{subSections.length !== 1 ? "s" : ""}
      </p>
      <Collapse size="small" items={items} className="bg-slate-50! border-slate-200!" />
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

  if (sections.length === 0) {
    return <Empty description="No course content found." />;
  }

  const totalTracked = sections.reduce(
    (sum, sec) =>
      sum +
      sec.trackedCount +
      sec.subSections.reduce((a, b) => a + b.trackedCount, 0),
    0
  );
  const totalActivities = sections.reduce(
    (sum, sec) =>
      sum +
      sec.totalModules +
      sec.subSections.reduce((a, b) => a + b.totalModules, 0),
    0
  );

  const collapseItems = sections.map((sec) => {
    const hasLessons = sec.subSections.length > 0;

    // Exclude raw "subsection" navigation modules — they are just pointers to the
    // actual lesson sections that already appear in subSections.
    const directModules = hasLessons
      ? sec.modules.filter((m) => m.modname !== "subsection")
      : sec.modules;

    const lessonCount = sec.subSections.length;
    const isEmpty = directModules.length === 0 && lessonCount === 0;

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
          {isEmpty ? (
            <p className="text-slate-400 text-xs italic py-1">
              No content available in this section.
            </p>
          ) : (
            <>
              {/* Activities that belong directly on this section (labels, forum, etc.) */}
              {directModules.map((mod) => (
                <ActivityRow key={mod.id} mod={mod} />
              ))}

              {/* Expandable lesson subsections with their full content */}
              {hasLessons && <LessonList subSections={sec.subSections} />}
            </>
          )}
        </div>
      ),
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <Alert
          type="info"
          showIcon
          description="Live from the NJFP Moodle LMS. Tracked items count toward each learner's completion percentage."
        />
      </div>

      <Card
        extra={
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => {
              const rows: (string | number)[][] = [];
              sections.forEach(sec => {
                if (sec.subSections.length === 0) {
                  sec.modules.forEach(mod =>
                    rows.push([sec.name, "", mod.name, mod.modname, mod.completion > 0 ? "Yes" : "No"])
                  );
                } else {
                  sec.subSections.forEach(lesson =>
                    lesson.modules.forEach(mod =>
                      rows.push([sec.name, lesson.name, mod.name, mod.modname, mod.completion > 0 ? "Yes" : "No"])
                    )
                  );
                }
              });
              downloadCsv("course-structure.csv", ["Module", "Lesson", "Activity", "Type", "Tracked"], rows);
            }}>
            Export Structure
          </Button>
        }
        title={
          <div className="flex items-center gap-3 mt-5!">
            <span>Course Content Map</span>
            <Tooltip
              title="A live map of the NJFP course pulled from Moodle. 'Tracked' activities are those with completion tracking enabled — they count toward each fellow's completion percentage on other pages."
              styles={{ root: { maxWidth: 340 } }}
            >
              <InfoCircleOutlined className="text-slate-400 cursor-help text-xs font-normal" />
            </Tooltip>
            <span className="text-slate-400 text-sm font-normal">
              {sections.length} sections · {totalActivities} activities · {totalTracked} tracked
            </span>
          </div>
        }
        // extra={
        //   <div className="hidden sm:flex items-center gap-3 text-sm text-slate-500">
        //     <span>
        //       <Tag color="blue">lesson</Tag> subsection
        //     </span>
        //     <span>
        //       <Tag color="geekblue">tracked</Tag> counts toward completion
        //     </span>
        //     <span>
        //       <Tag color="purple">forum</Tag> discussion
        //     </span>
        //   </div>
        // }
      >
        <Collapse
          items={collapseItems}
          defaultActiveKey={sections.length > 1 ? [String(sections[1].id)] : [String(sections[0]?.id)]}
          className="bg-transparent!"
        />
      </Card>
    </div>
  );
}
