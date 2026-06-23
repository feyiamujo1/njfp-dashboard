import { NextResponse } from "next/server";
import { supabase } from "@/integration/supabase/server";
import { COURSE_ID } from "@/lib/constants";

interface MoodleModule {
  id: number;
  instance: number;
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
  component?: string | null;
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

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("course_structure")
      .select("sections")
      .eq("course_id", COURSE_ID)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Course structure not yet synced. Run /api/sync first." },
        { status: 503 }
      );
    }

    const sections = data.sections as MoodleSection[];
    const visible = sections.filter((s) => s.visible === 1);

    type SectionData = ReturnType<typeof buildSectionData>;
    type ParentSection = SectionData & { subSections: SectionData[] };

    const topLevel: ParentSection[] = [];
    const childSections: MoodleSection[] = [];
    const instanceToParent = new Map<number, { parentIdx: number; order: number }>();

    for (const s of visible) {
      if (s.component === "mod_subsection") {
        childSections.push(s);
      } else {
        const parentIdx = topLevel.length;
        topLevel.push({ ...buildSectionData(s), subSections: [] });

        let subsectionOrder = 0;
        for (const m of s.modules) {
          if (m.visible !== 0 && m.modname === "subsection") {
            instanceToParent.set(m.instance, { parentIdx, order: subsectionOrder++ });
          }
        }
      }
    }

    const assignable = childSections.filter(
      (c) => c.itemid != null && instanceToParent.has(c.itemid!)
    );

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
