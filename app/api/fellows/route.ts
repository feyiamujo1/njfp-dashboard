import { NextResponse } from "next/server";
import { getCachedStudents } from "@/lib/server/sharedData";

export const maxDuration = 120;

export async function GET() {
  try {
    const students = await getCachedStudents();
    return NextResponse.json({ fellows: students });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
