import { NextResponse } from "next/server";
import { buildAllFellowSummaries } from "@/lib/server/sharedData";

export const maxDuration = 120;

export async function GET() {
  try {
    const fellows = await buildAllFellowSummaries();
    return NextResponse.json({ fellows });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
