export const COURSE_ID = Number(process.env.NEXT_COURSE_ID ?? 6);
export const TABLE_PAGE_SIZE = 20;
export const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export const MODULES = [
  { id: 1, name: "Entrepreneurial Mindset and Intention" },
  { id: 2, name: "Opportunity Identification & Innovation" },
  { id: 3, name: "Customers and Markets" },
  { id: 4, name: "Resources and Legality" },
  { id: 5, name: "Execution" },
  { id: 6, name: "Communication and Growth" },
  { id: 7, name: "Leadership and People Engagement" },
];

export const CHART_COLORS = {
  primary: "#1D4ED8",
  success: "#16A34A",
  warning: "#D97706",
  error: "#DC2626",
  neutral: "#94A3B8",
  modules: [
    "#1D4ED8",
    "#7C3AED",
    "#DB2777",
    "#EA580C",
    "#CA8A04",
    "#16A34A",
    "#0891B2",
  ],
};
