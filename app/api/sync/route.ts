import { NextResponse } from "next/server";
import { runFullSync } from "@/integration/supabase/sync";

// Completions step fetches one Moodle call per active student — allow up to 15 min.
export const maxDuration = 900;

export async function POST(req: Request) {
  const secret = process.env.SYNC_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runFullSync();

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

// GET for quick manual checks — same auth required
export async function GET(req: Request) {
  const secret = process.env.SYNC_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runFullSync();
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
