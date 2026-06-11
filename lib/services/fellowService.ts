import type { Fellow, FellowDetail } from "@/lib/types";

export const fellowService = {
  async getFellowList(): Promise<Fellow[]> {
    const res = await fetch("/api/fellows", { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    const { fellows } = await res.json();
    return fellows as Fellow[];
  },

  async getFellowDetail(id: number): Promise<FellowDetail | null> {
    const res = await fetch(`/api/fellows/${id}`, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<FellowDetail>;
  },
};
