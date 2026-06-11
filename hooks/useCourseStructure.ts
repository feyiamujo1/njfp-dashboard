import { useQuery } from "@tanstack/react-query";
import { STALE_TIME } from "@/lib/constants";

export interface CourseModule {
  id: number;
  name: string;
  modname: string;
  completion: number;
  url: string | null;
}

export interface CourseSection {
  id: number;
  name: string;
  section: number;
  summary: string;
  totalModules: number;
  trackedCount: number;
  modules: CourseModule[];
}

async function fetchCourseStructure(): Promise<{ sections: CourseSection[] }> {
  const res = await fetch("/api/course/contents", { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export function useCourseStructure() {
  return useQuery({
    queryKey: ["course-structure"],
    queryFn: fetchCourseStructure,
    staleTime: STALE_TIME,
  });
}
