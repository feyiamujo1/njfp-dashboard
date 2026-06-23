import type { Fellow, FellowSummary, FellowDetail, FellowQuizDetail } from "@/lib/types";

export const fellowService = {
  async getFellowList(): Promise<FellowSummary[]> {
    const res = await fetch("/api/fellows", { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    const { fellows } = await res.json();
    return fellows as FellowSummary[];
  },

  async getFellowDetail(id: number, lastCourseAccess?: number): Promise<FellowDetail | null> {
    const url = lastCourseAccess
      ? `/api/fellows/${id}?lastCourseAccess=${lastCourseAccess}`
      : `/api/fellows/${id}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<FellowDetail>;
  },

  async getFellowQuizStats(id: number, completionPct: number): Promise<FellowQuizDetail> {
    const res = await fetch(
      `/api/fellows/${id}/quiz?completionPct=${completionPct}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<FellowQuizDetail>;
  },
};
