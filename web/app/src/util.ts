import type { Tier } from "./types";

export function tierColor(tier: Tier | string): string {
  if (tier === "Critical Support Needed") return "bg-red-100 text-red-800 ring-1 ring-red-200";
  if (tier === "High Support Needed") return "bg-orange-100 text-orange-800 ring-1 ring-orange-200";
  if (tier === "Watch") return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
}

export function tierDot(tier: Tier | string): string {
  if (tier === "Critical Support Needed") return "bg-red-500";
  if (tier === "High Support Needed") return "bg-orange-500";
  if (tier === "Watch") return "bg-amber-500";
  return "bg-emerald-500";
}

/** Translate stigmatizing tier strings into supportive vocabulary for teacher / parent surfaces. */
export function supportiveTier(tier: Tier | string): string {
  switch (tier) {
    case "Critical Support Needed": return "Needs urgent support";
    case "High Support Needed": return "Needs strong support";
    case "Watch": return "Needs support";
    default: return "Stable";
  }
}

export function pct(n: number | null | undefined, d = 0): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(d)}%`;
}

export function num(n: number | null | undefined, d = 0): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(d);
}

export const driverLabels: Record<string, string> = {
  low_attendance: "Low attendance",
  recent_decline: "Recent attendance fall",
  long_streak: "Long absence streak",
  patterned_absence: "Repeated absence pattern",
  low_marks: "Low marks",
  marks_decline: "Declining marks",
  migration_risk: "Seasonal migration",
  financial_stress: "Financial stress",
  child_labour: "Child labour concern",
  early_marriage: "Early marriage concern",
  behaviour: "Behavioural disengagement",
  transport: "Transport difficulty",
  parent_engagement: "Low parent engagement",
};

export function classify(score: number): string {
  if (score < 20) return "Low";
  if (score < 40) return "Watch";
  if (score < 65) return "High Support Needed";
  return "Critical Support Needed";
}
