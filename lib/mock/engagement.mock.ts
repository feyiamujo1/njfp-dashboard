import type { EngagementStats } from "@/lib/types";

const now = Math.floor(Date.now() / 1000);
const week = 7 * 86400;

export const engagementMock: EngagementStats = {
  dau: 520,
  wau: 2900,
  mau: 4200,
  weeklyActivity: Array.from({ length: 52 }, (_, i) => {
    const weeksAgo = 51 - i;
    const ts = now - weeksAgo * week;
    const d = new Date(ts * 1000);
    const label = d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
    const base = 1800 + i * 22;
    return { week: label, ts, logins: base, interactions: Math.round(base * 1.8) };
  }),
  monthlyActivity: Array.from({ length: 12 }, (_, i) => {
    const monthsAgo = 11 - i;
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - monthsAgo);
    const ts = Math.floor(d.getTime() / 1000);
    const label = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    const base = 7500 + i * 90;
    return { month: label, ts, logins: base, interactions: Math.round(base * 1.8) };
  }),
  heatmapRaw: Array.from({ length: 500 }, () => now - Math.floor(Math.random() * 30 * 86400)),
};
