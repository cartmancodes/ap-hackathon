import { tierColor, tierDot, supportiveTier } from "../util";
import type { Tier } from "../types";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ReactNode } from "react";

export function KPI({ label, value, sub, tone = "neutral", icon }: {
  label: string; value: ReactNode; sub?: ReactNode; tone?: "neutral" | "good" | "bad" | "warn"; icon?: ReactNode;
}) {
  const toneCls = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : tone === "warn" ? "text-orange-700" : "text-slate-900";
  return (
    <div className="card p-4">
      <div className="text-xs uppercase text-slate-500 font-medium tracking-wide flex items-center gap-1.5">{icon}{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export function RiskBadge({ tier, supportive = false }: { tier: Tier | string; supportive?: boolean }) {
  return (
    <span className={`pill ${tierColor(tier)}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${tierDot(tier)}`} />
      {supportive ? supportiveTier(tier) : tier}
    </span>
  );
}

export function TrendArrow({ change }: { change: number }) {
  if (Math.abs(change) < 0.5) return <span className="text-slate-500 inline-flex items-center gap-1"><Minus className="w-3 h-3" />{change.toFixed(1)}%</span>;
  if (change > 0) return <span className="text-red-600 inline-flex items-center gap-1"><ArrowUp className="w-3 h-3" />+{change.toFixed(1)}%</span>;
  return <span className="text-emerald-600 inline-flex items-center gap-1"><ArrowDown className="w-3 h-3" />{change.toFixed(1)}%</span>;
}

export function Section({ title, sub, right, children }: { title: string; sub?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-4 mb-4">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {sub && <div className="text-xs text-slate-500">{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Tag({ children, color = "slate" }: { children: ReactNode; color?: "slate" | "amber" | "red" | "emerald" | "blue" | "violet" | "orange" }) {
  const map: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    emerald: "bg-emerald-100 text-emerald-800",
    blue: "bg-blue-100 text-blue-800",
    violet: "bg-violet-100 text-violet-800",
    orange: "bg-orange-100 text-orange-800",
  };
  return <span className={`pill ${map[color]}`}>{children}</span>;
}

export function ProgressBar({ value, max = 100, tone = "blue" }: { value: number; max?: number; tone?: "blue" | "emerald" | "amber" | "red" | "orange" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const map: Record<string, string> = {
    blue: "bg-blue-500", emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", orange: "bg-orange-500",
  };
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`${map[tone]} h-full`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-10 text-slate-400">
      <div className="font-medium text-slate-600">{title}</div>
      {hint && <div className="text-sm mt-1">{hint}</div>}
    </div>
  );
}

export function SyntheticBadge() {
  return (
    <span className="pill bg-violet-50 text-violet-700 ring-1 ring-violet-200" title="Synthetic signal — clearly marked. Will come from LEAP / welfare datasets when integrated.">
      synthetic
    </span>
  );
}
