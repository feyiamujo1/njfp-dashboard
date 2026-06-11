import type { RiskStats } from "@/lib/types";
import { fellowsMock } from "./fellows.mock";

export const riskMock: RiskStats = {
  inactiveOver7Days: 1350,
  inactiveOver14Days: 450,
  lowQuizScore: 780,
  noMentorshipEngagement: 620,
  distribution: {
    active: 3650,
    atRisk: 900,
    inactive: 450,
  },
  fellows: fellowsMock,
};
