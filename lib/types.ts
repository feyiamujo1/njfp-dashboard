export type RiskLevel = "active" | "at_risk" | "inactive";

export interface Fellow {
  id: number;
  fullname: string;
  email: string;
  lastaccess: number;
  lastcourseaccess: number;
  profileimageurl: string;
  gender: string | null;
  state: string | null;
  lga: string | null;
  region: string | null;
}

export interface FellowSummary extends Fellow {
  completionPct: number;
  avgQuizScore: number;
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
  atRiskCount: number;
  neverStarted: number;
}

export interface TopLearner {
  id: number;
  fullname: string;
  email: string;
  profileimageurl: string;
  lastcourseaccess: number;
  activitiesDone: number;
  totalActivities: number;
  completionPct: number;
}

/** Returned by the separate /api/dashboard/overview/completion route (slow, cached). */
export interface OverviewCompletionStats {
  completionRate: number;
  avgCompletionPct: number;
  completedFellows: number;
  moduleCompletion: ModuleProgress[];
  topLearners: TopLearner[];
}

export interface ActivityEvent {
  id: number;
  description: string;
  timestamp: number;
  type: "quiz" | "login" | "completion";
}

export interface FellowDetail extends FellowSummary {
  moduleProgress: ModuleProgress[];
  quizStats: QuizStat[];
}

/** Returned by the separate /api/fellows/[id]/quiz route (slow, per-user cached). */
export interface FellowQuizDetail {
  avgQuizScore: number;
  engagementScore: number;
  quizStats: QuizStat[];
}

/** Fast path — students cache only. */
export interface EngagementStats {
  dau: number;
  wau: number;
  mau: number;
  weeklyActivity: { week: string; ts: number; logins: number; interactions: number }[];
  monthlyActivity: { month: string; ts: number; logins: number; interactions: number }[];
  heatmapRaw: number[];
}

export interface ActivityDemBreakdown {
  label: string;
  active: number;
  atRisk: number;
  inactive: number;
  total: number;
}

/** Slow path — completion + fellow summaries (Risk + Performance + module views). */
export interface LearnerActivityStats {
  contentViews: number;
  moduleViews: { moduleId: number; moduleName: string; views: number }[];
  risk: {
    inactiveOver7Days: number;
    inactiveOver14Days: number;
    notStartedCount: number;
    distribution: { active: number; atRisk: number; inactive: number };
    fellows: FellowSummary[];
  };
  topLearners: FellowSummary[];
  activityByGender: ActivityDemBreakdown[];
  activityByRegion: ActivityDemBreakdown[];
  activityByState: ActivityDemBreakdown[];
}

/** Fast path — students cache only. */
export interface ProgressStats {
  totalEnrolled: number;
}

export interface DemCompletion {
  label: string;
  total: number;
  started: number;
  startedPct: number;
  midway: number;
  midwayPct: number;
  completed: number;
  completionPct: number;
}

/** Slow path — completion cache (~30-min TTL). */
export interface ProgressCompletionStats {
  startedPct: number;
  completedPct: number;
  avgCompletionRate: number;
  moduleProgress: ModuleProgress[];
  funnel: { stage: string; count: number; pct: number }[];
  dropOff: { moduleId: number; moduleName: string; activePct: number }[];
  completionByGender: DemCompletion[];
  completionByRegion: DemCompletion[];
  completionByState: DemCompletion[];
}
