import type { MentorshipStats } from "@/lib/types";
import { fellowsMock } from "./fellows.mock";

const leaderboard = [...fellowsMock]
  .sort((a, b) => b.engagementScore - a.engagementScore)
  .slice(0, 20);

export const mentorshipMock: MentorshipStats = {
  webinarAttendance: 65,
  mentorSessions: 42,
  podParticipation: 38,
  forumPosts: 3700,
  forumByModule: [
    { moduleId: 1, moduleName: "Entrepreneurial Mindset", posts: 680, replies: 420 },
    { moduleId: 2, moduleName: "Opportunity Identification", posts: 590, replies: 360 },
    { moduleId: 3, moduleName: "Customers and Markets", posts: 540, replies: 320 },
    { moduleId: 4, moduleName: "Resources and Legality", posts: 480, replies: 290 },
    { moduleId: 5, moduleName: "Execution", posts: 520, replies: 310 },
    { moduleId: 6, moduleName: "Communication and Growth", posts: 460, replies: 280 },
    { moduleId: 7, moduleName: "Leadership and People", posts: 430, replies: 260 },
  ],
  leaderboard,
};
