import { NextResponse } from "next/server";

// Phase 2: computed server-side — combines fellow data, completion, quizzes, forums
// Risk levels: active | at_risk | inactive
export async function GET() {
  return NextResponse.json({ fellows: [], summary: { active: 0, atRisk: 0, inactive: 0 } });
}
