"use client";

import { Card, Tag, Alert, Collapse } from "antd";
import {
  BookOutlined,
  FileTextOutlined,
  MessageOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";

const MODULES = [
  {
    id: 0,
    name: "Course Introduction",
    lessons: [],
    intro: true,
    items: ["Welcome Address", "Course Map", "Learning Activities & Assessment"],
  },
  {
    id: 1,
    name: "Module 1 — Entrepreneurial Mindset and Intention",
    lessons: [
      "Entrepreneurship: Meaning, Types & Nigerian Realities",
      "Mindset — Resilience, Curiosity, and Discipline",
      "Intention & Purpose — Clarifying Your \"Why\"",
      "Overcoming Fear & Failure (The Failure Resume)",
      "Values-Based Entrepreneurship",
      "Growth Mindset & Self-Leadership",
    ],
  },
  {
    id: 2,
    name: "Module 2 — Opportunity Identification & Innovation",
    lessons: [
      "Spotting Market Gaps and Trends",
      "Creative Problem-Solving",
      "Validating Business Ideas",
      "Design Thinking Fundamentals",
      "Minimum Viable Product (MVP)",
      "Innovation in the Nigerian Context",
    ],
  },
  {
    id: 3,
    name: "Module 3 — Customers and Markets",
    lessons: [
      "Understanding Your Target Customer",
      "Market Research Techniques",
      "Customer Segmentation",
      "Value Proposition Design",
      "Pricing Strategies",
      "Competition Analysis",
    ],
  },
  {
    id: 4,
    name: "Module 4 — Resources and Legality",
    lessons: [
      "Human & Financial Resources",
      "Business Registration in Nigeria",
      "Intellectual Property Basics",
      "Contracts and Legal Obligations",
      "Tax Compliance for SMEs",
      "Regulatory Landscape",
    ],
  },
  {
    id: 5,
    name: "Module 5 — Execution",
    lessons: [
      "Business Planning & Roadmapping",
      "Setting Goals and Milestones",
      "Operations Management",
      "Financial Management Basics",
      "Building a Team",
      "Managing Risk",
    ],
  },
  {
    id: 6,
    name: "Module 6 — Communication and Growth",
    lessons: [
      "Storytelling for Entrepreneurs",
      "Pitching to Investors",
      "Digital Marketing Essentials",
      "Social Media Strategy",
      "Networking and Partnerships",
      "Scaling Your Business",
    ],
  },
  {
    id: 7,
    name: "Module 7 — Leadership and People Engagement",
    lessons: [
      "Leadership Styles and Principles",
      "Building Organisational Culture",
      "Delegation and Empowerment",
      "Conflict Resolution",
      "Community and Social Impact",
      "Sustaining Motivation",
    ],
  },
];

export default function CourseStructurePage() {
  const collapseItems = MODULES.map((mod) => ({
    key: String(mod.id),
    label: (
      <div className="flex items-center gap-3">
        <BookOutlined className="text-blue-600" />
        <span className="font-semibold text-slate-800">{mod.name}</span>
        {!mod.intro && (
          <Tag color="blue" className="ml-auto">
            {mod.lessons.length} lessons + quiz + forum
          </Tag>
        )}
      </div>
    ),
    children: (
      <div className="space-y-2 pl-2">
        {mod.intro ? (
          mod.items?.map((item, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              <PlayCircleOutlined className="text-slate-400 text-sm" />
              <span className="text-slate-600 text-sm">{item}</span>
              <Tag className="ml-auto" color="default">
                label
              </Tag>
            </div>
          ))
        ) : (
          <>
            {/* Overview video */}
            <div className="flex items-center gap-2 py-1">
              <PlayCircleOutlined className="text-slate-400 text-sm" />
              <span className="text-slate-500 text-sm italic">
                Module Overview (video)
              </span>
              <Tag className="ml-auto" color="default">
                label
              </Tag>
            </div>

            {/* Lessons */}
            {mod.lessons.map((lesson, i) => (
              <div
                key={i}
                className="flex items-center gap-2 py-1 rounded-md bg-blue-50 px-2"
              >
                <FileTextOutlined className="text-blue-500 text-sm" />
                <span className="text-slate-700 text-sm">
                  Lesson {mod.id}.{i + 1}: {lesson}
                </span>
                <Tag className="ml-auto" color="blue">
                  subsection
                </Tag>
              </div>
            ))}

            {/* Summary video */}
            <div className="flex items-center gap-2 py-1">
              <PlayCircleOutlined className="text-slate-400 text-sm" />
              <span className="text-slate-500 text-sm italic">
                Module Summary (video)
              </span>
              <Tag className="ml-auto" color="default">
                label
              </Tag>
            </div>

            {/* Forum */}
            <div className="flex items-center gap-2 py-1 rounded-md bg-purple-50 px-2">
              <MessageOutlined className="text-purple-500 text-sm" />
              <span className="text-slate-700 text-sm">
                Module {mod.id} — Discussion Forum
              </span>
              <Tag className="ml-auto" color="purple">
                forum
              </Tag>
            </div>
          </>
        )}

        {/* Social forum for intro section */}
        {mod.intro && (
          <div className="flex items-center gap-2 py-1 rounded-md bg-purple-50 px-2">
            <MessageOutlined className="text-purple-500 text-sm" />
            <span className="text-slate-700 text-sm">Social Forum</span>
            <Tag className="ml-auto" color="purple">
              forum
            </Tag>
          </div>
        )}
      </div>
    ),
  }));

  return (
    <div className="space-y-4">
      <Alert
        type="info"
        showIcon
        description="This structure is sourced from the live NJFP Moodle LMS. Completion-trackable items are subsections. Labels (video embeds) have no completion tracking."
      />

      <Card
        title="Course Content Map"
        extra={
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>
              <Tag color="blue">subsection</Tag> trackable
            </span>
            <span>
              <Tag color="purple">forum</Tag> discussion
            </span>
            <span>
              <Tag color="default">label</Tag> video
            </span>
          </div>
        }
      >
        <Collapse
          items={collapseItems}
          defaultActiveKey={["1"]}
          className="bg-transparent!"
        />
      </Card>
    </div>
  );
}
