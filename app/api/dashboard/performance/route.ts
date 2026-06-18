import { NextResponse } from "next/server";
import { buildAllFellowSummaries } from "@/lib/server/sharedData";

export const maxDuration = 120;

export async function GET() {
  try {
    const allFellows = await buildAllFellowSummaries();

    const topLearners = allFellows
      .filter((s) => s.riskLevel === "active")
      .sort((a, b) =>
        b.engagementScore !== a.engagementScore
          ? b.engagementScore - a.engagementScore
          : b.completionPct - a.completionPct
      );

    return NextResponse.json({ topLearners });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
