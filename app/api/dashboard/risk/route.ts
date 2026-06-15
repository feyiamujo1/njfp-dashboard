import { NextResponse } from "next/server";
import { buildAllFellowSummaries } from "@/lib/server/sharedData";

export const maxDuration = 120;

export async function GET() {
  try {
    const fellows = await buildAllFellowSummaries();

    let activeCount = 0;
    let atRiskCount = 0;
    let inactiveCount = 0;
    let inactiveOver7 = 0;
    let inactiveOver14 = 0;
    let notStartedCount = 0;

    fellows.forEach((f) => {
      if (f.riskLevel === "active") activeCount++;
      else if (f.riskLevel === "at_risk") atRiskCount++;
      else inactiveCount++;

      if (f.daysSinceActive > 7) inactiveOver7++;
      if (f.daysSinceActive > 14) inactiveOver14++;
      if (f.completionPct === 0) notStartedCount++;
    });

    return NextResponse.json({
      inactiveOver7Days: inactiveOver7,
      inactiveOver14Days: inactiveOver14,
      notStartedCount,
      distribution: {
        active: activeCount,
        atRisk: atRiskCount,
        inactive: inactiveCount,
      },
      fellows,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
