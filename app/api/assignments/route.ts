import { NextResponse } from "next/server";

// Phase 2: mod_assign_get_assignments | courseids[0]=6
export async function GET() {
  return NextResponse.json({ assignments: [] });
}
