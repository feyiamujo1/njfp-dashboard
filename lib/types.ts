export type RiskLevel = "active" | "at_risk" | "inactive";

export interface Fellow {
  id: number;
  fullname: string;
  email: string;
  lastaccess: number;
  lastcourseaccess: number;
  profileimageurl: string;
}

export interface FellowSummary extends Fellow {
  completionPct: number;
  avgQuizScore: number;
  assignmentsSubmitted: number;
  assignmentsTotal: number;
  forumPosts: number;
  engagementScore: number;
  riskLevel: RiskLevel;
  daysSinceActive: number;
}

export interface ModuleProgress {
  moduleId: number;
  moduleName: string;
  completionPct: number;
  completedCount: number;
  totalFellows: number;
}

export interface QuizStat {
  moduleId: number;
  moduleName: string;
  avgScore: number;
  passCount: number;
  failCount: number;
  attemptCount: number;
}

export interface OverviewStats {
  totalFellows: number;
  activeFellows: number;
  completionRate: number;
  avgQuizScore: number;
  assignmentCompletionRate: number;
  atRiskCount: number;
}

export interface AssignmentSummary {
  id: number;
  name: string;
  moduleId: number;
  moduleName: string;
  submitted: boolean;
  submittedAt?: number;
  grade?: number;
}

export interface ActivityEvent {
  id: number;
  description: string;
  timestamp: number;
  type: "quiz" | "assignment" | "forum" | "login" | "completion";
}

export interface FellowDetail extends FellowSummary {
  moduleProgress: ModuleProgress[];
  quizStats: QuizStat[];
  assignments: AssignmentSummary[];
  activityTimeline: ActivityEvent[];
}

export interface EngagementStats {
  dau: number;
  wau: number;
  mau: number;
  contentViews: number;
  weeklyActivity: { week: string; logins: number; interactions: number }[];
  heatmap: { day: number; hour: number; count: number }[];
  moduleViews: { moduleId: number; moduleName: string; views: number }[];
}

export interface PerformanceStats {
  avgQuizScore: number;
  submissionRate: number;
  passRate: number;
  failRate: number;
  quizByModule: QuizStat[];
  assignmentByModule: {
    moduleId: number;
    moduleName: string;
    submitted: number;
    notSubmitted: number;
  }[];
  topLearners: FellowSummary[];
}

export interface MentorshipStats {
  webinarAttendance: number | null; // NATVIEW — null until external API wired
  mentorSessions: number | null;    // NATVIEW — null until external API wired
  podParticipation: number | null;  // NATVIEW — null until external API wired
  forumPosts: number;
  forumByModule: {
    moduleId: number;
    moduleName: string;
    posts: number;
    replies: number;
  }[];
  leaderboard: FellowSummary[];
}

export interface RiskStats {
  inactiveOver7Days: number;
  inactiveOver14Days: number;
  lowQuizScore: number;
  noMentorshipEngagement: number;
  distribution: { active: number; atRisk: number; inactive: number };
  fellows: FellowSummary[];
}

export interface ProgressStats {
  totalEnrolled: number;
  startedPct: number;
  completedPct: number;
  avgCompletionRate: number;
  moduleProgress: ModuleProgress[];
  funnel: { stage: string; count: number; pct: number }[];
  dropOff: { moduleId: number; moduleName: string; activePct: number }[];
}
