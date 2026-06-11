import { NextResponse } from "next/server";

// Phase 2: gradereport_user_get_grades_table | courseid=6&userid={id}
export async function GET() {
  return NextResponse.json({ grades: [] });
}
