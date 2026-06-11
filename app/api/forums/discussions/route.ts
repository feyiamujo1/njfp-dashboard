import { NextResponse } from "next/server";

// Phase 2: mod_forum_get_forum_discussions | forumid={id}
export async function GET() {
  return NextResponse.json({ discussions: [] });
}
