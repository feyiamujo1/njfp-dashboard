import { NextResponse } from "next/server";
import { moodleCall } from "@/lib/moodle";
import { COURSE_ID } from "@/lib/constants";

interface MoodleModule {
  id: number;
  instance: number; // used to link subsection modules to their section
  name: string;
  modname: string;
  completion: number;
  visible: number;
  url?: string;
}

interface MoodleSection {
  id: number;
  name: string;
  visible: 1 | 0;
  section: number;
  summary?: string;
  modules: MoodleModule[];
  // null  → top-level section (Module 1-7, Course Intro, Mentorship Track, etc.)
  // "mod_subsection" → this section IS a lesson; it is a child of a top-level section
  component?: string | null;
  // when component === "mod_subsection", itemid equals the instance of the
  // subsection module inside the parent section that links to this lesson section
  itemid?: number | null;
}

function buildSectionData(s: MoodleSection) {
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
      completion: m.completion,
      url: m.url ?? null,
    })),
  };
}

export const maxDuration = 120;

export async function GET() {
  try {
    const sections = await moodleCall<MoodleSection[]>("core_course_get_contents", {
      courseid: COURSE_ID,
    });

    const visible = sections.filter((s) => s.visible === 1);

    type SectionData = ReturnType<typeof buildSectionData>;
    type ParentSection = SectionData & { subSections: SectionData[] };

    // Split: top-level sections vs subsection-sections (actual lesson content)
    const topLevel: ParentSection[] = [];
    const childSections: MoodleSection[] = [];

    // instance → { parentIdx in topLevel, display order within that parent }
    const instanceToParent = new Map<number, { parentIdx: number; order: number }>();

    for (const s of visible) {
      if (s.component === "mod_subsection") {
        childSections.push(s);
      } else {
        const parentIdx = topLevel.length;
        topLevel.push({ ...buildSectionData(s), subSections: [] });

        // Register each subsection module in this parent so we can link back
        let subsectionOrder = 0;
        for (const m of s.modules) {
          if (m.visible !== 0 && m.modname === "subsection") {
            instanceToParent.set(m.instance, { parentIdx, order: subsectionOrder++ });
          }
        }
      }
    }

    // Assign each lesson section to its parent via itemid → subsection module instance
    const assignable = childSections.filter(
      (c) => c.itemid != null && instanceToParent.has(c.itemid!)
    );

    // Sort by parent first, then by the module order within that parent
    assignable.sort((a, b) => {
      const aMap = instanceToParent.get(a.itemid!)!;
      const bMap = instanceToParent.get(b.itemid!)!;
      if (aMap.parentIdx !== bMap.parentIdx) return aMap.parentIdx - bMap.parentIdx;
      return aMap.order - bMap.order;
    });

    for (const child of assignable) {
      const { parentIdx } = instanceToParent.get(child.itemid!)!;
      topLevel[parentIdx].subSections.push(buildSectionData(child));
    }

    return NextResponse.json({ sections: topLevel });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
