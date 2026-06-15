import { NextResponse } from "next/server";
import { buildAllFellowSummaries } from "@/lib/server/sharedData";

export const maxDuration = 120;

export async function GET() {
  try {
    const allFellows = await buildAllFellowSummaries();

    const leaderboard = allFellows
      .filter((f) => f.riskLevel === "active")
      .sort((a, b) =>
        b.engagementScore !== a.engagementScore
          ? b.engagementScore - a.engagementScore
          : b.completionPct - a.completionPct
      )
      .slice(0, 20);

    return NextResponse.json({
      leaderboard,
      webinarAttendance: null,
      mentorSessions: null,
      podParticipation: null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
