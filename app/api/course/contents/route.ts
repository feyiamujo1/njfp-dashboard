import { NextResponse } from "next/server";
import { moodleCall } from "@/lib/moodle";
import { COURSE_ID } from "@/lib/constants";

interface MoodleModule {
  id: number;
  name: string;
  modname: string;
  completion: number;
  url?: string;
}

interface MoodleSection {
  id: number;
  name: string;
  visible: 1 | 0;
  section: number;
  modules: MoodleModule[];
}

export async function GET() {
  try {
    const sections = await moodleCall<MoodleSection[]>(
      "core_course_get_contents",
      { courseid: COURSE_ID }
    );

    const filtered = sections
      .filter((s) => s.visible === 1 && s.modules.length > 0)
      .map((s) => ({
        id: s.id,
        name: s.name,
        section: s.section,
        subsections: s.modules
          .filter((m) => m.modname === "subsection")
          .map((m) => ({ id: m.id, name: m.name })),
        forums: s.modules
          .filter((m) => m.modname === "forum")
          .map((m) => ({ id: m.id, name: m.name, url: m.url })),
        labels: s.modules
          .filter((m) => m.modname === "label")
          .map((m) => ({ id: m.id, name: m.name })),
      }));

    return NextResponse.json({ sections: filtered });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
