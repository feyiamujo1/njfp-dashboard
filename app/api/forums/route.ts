import { NextResponse } from "next/server";

// Phase 2: mod_forum_get_forums_by_courses | courseids[0]=6
export async function GET() {
  return NextResponse.json({ forums: [] });
}
