import { NextResponse } from "next/server";
import { moodleCall } from "@/lib/moodle";
import { COURSE_ID } from "@/lib/constants";

interface MoodleModule {
  id: number;
  name: string;
  modname: string;
  completion: number; // 0 = none, 1 = manual, 2 = auto
  visible: number;
  url?: string;
  description?: string;
}

interface MoodleSection {
  id: number;
  name: string;
  visible: 1 | 0;
  section: number;
  summary?: string;
  modules: MoodleModule[];
}

export async function GET() {
  try {
    const sections = await moodleCall<MoodleSection[]>("core_course_get_contents", {
      courseid: COURSE_ID,
    });

    const filtered = sections
      .filter((s) => s.visible === 1)
      .map((s) => {
        const visibleModules = s.modules.filter((m) => m.visible !== 0);
        const trackedCount = visibleModules.filter((m) => m.completion > 0).length;

        return {
          id: s.id,
          name: s.name,
          section: s.section,
          summary: s.summary ?? "",
          totalModules: visibleModules.length,
          trackedCount,
          modules: visibleModules.map((m) => ({
            id: m.id,
            name: m.name,
            modname: m.modname,
            completion: m.completion, // 0 = untracked, 1 = manual, 2 = auto
            url: m.url ?? null,
          })),
        };
      });

    return NextResponse.json({ sections: filtered });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
