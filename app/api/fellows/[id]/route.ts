import { NextResponse } from "next/server";

// Phase 2: aggregates completion, quizzes, assignments, forums, risk for one fellow
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({ fellow: null, id });
}
