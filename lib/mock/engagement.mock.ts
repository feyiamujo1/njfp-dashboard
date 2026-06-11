import type { EngagementStats } from "@/lib/types";

const heatmap = Array.from({ length: 7 * 24 }, (_, i) => {
  const day = Math.floor(i / 24);
  const hour = i % 24;
  const isWeekday = day < 5;
  const isPeak = hour >= 9 && hour <= 17;
  const isBusiness = hour >= 7 && hour <= 21;
  let base: number;
  if (isWeekday && isPeak) base = 65;
  else if (isWeekday && isBusiness) base = 35;
  else if (isWeekday) base = 10;
  else if (isBusiness) base = 30;
  else base = 5;
  const variation = (day * 24 + hour) % 25;
  return { day, hour, count: base + variation };
});

export const engagementMock: EngagementStats = {
  dau: 520,
  wau: 2900,
  mau: 4200,
  contentViews: 18600,
  weeklyActivity: [
    { week: "Wk 1", logins: 1800, interactions: 3200 },
    { week: "Wk 2", logins: 1920, interactions: 3480 },
    { week: "Wk 3", logins: 1850, interactions: 3350 },
    { week: "Wk 4", logins: 2100, interactions: 3900 },
    { week: "Wk 5", logins: 2060, interactions: 3820 },
    { week: "Wk 6", logins: 2300, interactions: 4200 },
    { week: "Wk 7", logins: 2450, interactions: 4480 },
    { week: "Wk 8", logins: 2580, interactions: 4720 },
    { week: "Wk 9", logins: 2640, interactions: 4850 },
    { week: "Wk 10", logins: 2700, interactions: 5000 },
    { week: "Wk 11", logins: 2820, interactions: 5200 },
    { week: "Wk 12", logins: 2900, interactions: 5400 },
  ],
  heatmap,
  moduleViews: [
    { moduleId: 1, moduleName: "Entrepreneurial Mindset", views: 4200 },
    { moduleId: 2, moduleName: "Opportunity Identification", views: 3850 },
    { moduleId: 3, moduleName: "Customers and Markets", views: 3600 },
    { moduleId: 4, moduleName: "Resources and Legality", views: 3200 },
    { moduleId: 5, moduleName: "Execution", views: 3400 },
    { moduleId: 6, moduleName: "Communication and Growth", views: 3100 },
    { moduleId: 7, moduleName: "Leadership and People", views: 2900 },
  ],
};
