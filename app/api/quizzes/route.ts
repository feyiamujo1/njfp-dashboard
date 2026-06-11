import { NextResponse } from "next/server";

// Phase 2: mod_quiz_get_quizzes_by_courses | courseids[0]=6
export async function GET() {
  return NextResponse.json({ quizzes: [] });
}
