import { NextResponse } from "next/server";

// Phase 2: mod_quiz_get_user_attempts | quizid={id}&userid={id}&status=finished
export async function GET() {
  return NextResponse.json({ attempts: [] });
}
