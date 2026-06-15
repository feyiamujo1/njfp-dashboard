export function toTitleCase(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeGender(raw: string | null | undefined): string {
  const g = raw?.trim().toLowerCase();
  return g === "female" ? "Female" : g === "male" ? "Male" : "Not Specified";
}

export const REGION_ALIASES: Record<string, string> = {
  "north east": "North East",    "north-east": "North East",    "northeast": "North East",
  "north central": "North Central", "north-central": "North Central", "northcentral": "North Central",
  "north west": "North West",    "north-west": "North West",    "northwest": "North West",
  "south east": "South East",    "south-east": "South East",    "southeast": "South East",
  "south south": "South South",  "south-south": "South South",  "southsouth": "South South",
  "south west": "South West",    "south-west": "South West",    "southwest": "South West",
};

export function normalizeRegion(raw: string | null | undefined): string {
  if (!raw?.trim()) return "Not Specified";
  return REGION_ALIASES[raw.trim().toLowerCase()] ?? "Not Specified";
}

export const STATE_ALIASES: Record<string, string> = {
  "fct": "Abuja",              "abuja": "Abuja",
  "fct abuja": "Abuja",        "fct, abuja": "Abuja",
  "abuja fct": "Abuja",        "abuja and fct": "Abuja",
  "abuja & fct": "Abuja",      "federal capital territory": "Abuja",
  "f.c.t": "Abuja",            "f.c.t.": "Abuja",
};

export function normalizeState(raw: string | null | undefined): string {
  if (!raw?.trim()) return "Not Specified";
  const stripped = raw.trim().replace(/\s+state$/i, "").trim();
  const key = stripped.toLowerCase();
  return STATE_ALIASES[key] ?? toTitleCase(stripped);
}
