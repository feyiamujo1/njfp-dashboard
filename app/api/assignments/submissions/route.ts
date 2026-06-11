import { NextResponse } from "next/server";

// Phase 2: mod_assign_get_submissions | assignmentids[0]={id}
export async function GET() {
  return NextResponse.json({ submissions: [] });
}
