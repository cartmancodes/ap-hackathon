import { useState, type ReactNode } from "react";
import { Info, Database, Sparkles, ShieldCheck, AlertTriangle, FlaskConical, TrendingUp, Cpu, Lock } from "lucide-react";
import { useAppData } from "../data";
import { useUI } from "../store";
import type { CatalogPoint } from "../types";

const KIND_META: Record<string, { tone: string; chip: string; icon: ReactNode; label: string }> = {
  real:            { tone: "ring-emerald-300 bg-emerald-50",  chip: "bg-emerald-100 text-emerald-800 ring-emerald-200",  icon: <Database className="w-3 h-3" />,        label: "Real data" },
  derived:         { tone: "ring-sky-300 bg-sky-50",          chip: "bg-sky-100 text-sky-800 ring-sky-200",              icon: <Sparkles className="w-3 h-3" />,        label: "Derived from real data" },
  derived_proxy:   { tone: "ring-amber-300 bg-amber-50",      chip: "bg-amber-100 text-amber-800 ring-amber-200",        icon: <FlaskConical className="w-3 h-3" />,    label: "Derived proxy (raw not in repo)" },
  model_output:    { tone: "ring-indigo-300 bg-indigo-50",    chip: "bg-indigo-100 text-indigo-800 ring-indigo-200",     icon: <Cpu className="w-3 h-3" />,             label: "Model output" },
  synthetic:       { tone: "ring-violet-300 bg-violet-50",    chip: "bg-violet-100 text-violet-800 ring-violet-200",     icon: <FlaskConical className="w-3 h-3" />,    label: "Synthetic (pending integration)" },
  synthetic_ops:   { tone: "ring-violet-300 bg-violet-50",    chip: "bg-violet-100 text-violet-800 ring-violet-200",     icon: <FlaskConical className="w-3 h-3" />,    label: "Synthetic ops field" },
  forecast:        { tone: "ring-blue-300 bg-blue-50",        chip: "bg-blue-100 text-blue-800 ring-blue-200",           icon: <TrendingUp className="w-3 h-3" />,      label: "Forecast" },
  anonymised:      { tone: "ring-slate-300 bg-slate-50",      chip: "bg-slate-100 text-slate-800 ring-slate-200",        icon: <Lock className="w-3 h-3" />,            label: "Anonymised" },
};

export function kindMeta(kind: string) {
  return KIND_META[kind] || KIND_META.real;
}

export function useCatalog() {
  const { data } = useAppData();
  return data?.catalog?.points || {};
}

/** Compact provenance chip — used in tables / KPIs to mark a single metric. */
export function ProvChip({ pointKey, size = "xs" }: { pointKey: string; size?: "xs" | "sm" }) {
  const points = useCatalog();
  const p = points[pointKey];
  if (!p) return null;
  const m = kindMeta(p.kind);
  const cls = size === "sm" ? "text-[10px] py-0.5 px-1.5" : "text-[9px] py-0 px-1";
  return (
    <span className={`inline-flex items-center gap-1 rounded ring-1 ${m.chip} ${cls}`} title={`${m.label}\n${p.source}${p.formula ? `\n${p.formula}` : ""}`}>
      {m.icon}{p.kind === "derived_proxy" ? "proxy" : p.kind === "synthetic_ops" ? "synth" : p.kind === "model_output" ? "model" : m.label.split(" ")[0].toLowerCase()}
    </span>
  );
}

/** Full DataPoint: value + label + provenance hover (or always-shown when global toggle is on). */
export function DataPoint({
  pointKey, label, value, sub, tone = "neutral", className = "",
}: {
  pointKey: string;
  label?: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "good" | "bad" | "warn";
  className?: string;
}) {
  const points = useCatalog();
  const { showProvenance } = useUI();
  const [open, setOpen] = useState(false);
  const p: CatalogPoint | undefined = points[pointKey];
  const m = p ? kindMeta(p.kind) : null;
  const toneCls = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : tone === "warn" ? "text-orange-700" : "text-slate-900";
  return (
    <div className={`relative ${className}`}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
    >
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium flex items-center gap-1">
        {label ?? p?.label}
        {p && <ProvChip pointKey={pointKey} />}
      </div>
      <div className={`text-lg font-semibold mt-0.5 ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
      {p && (open || showProvenance) && (
        <div className={`absolute z-30 mt-1 left-0 w-72 rounded-lg shadow-lg ring-1 ${m!.tone} p-2 text-[11px] text-slate-700 pointer-events-none`}>
          <div className="font-semibold text-slate-900 mb-0.5">{p.label}</div>
          <div className="text-slate-600 mb-1">{p.source}</div>
          {p.formula && <div className="text-slate-500"><b>Formula:</b> {p.formula}</div>}
          {p.unit && <div className="text-slate-500"><b>Unit:</b> {p.unit}</div>}
          <div className="mt-1 flex items-center gap-1 text-[10px]">
            <span className={`inline-flex items-center gap-1 rounded ring-1 ${m!.chip} px-1.5 py-0.5`}>{m!.icon}{m!.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Inline observable metric — used inside tables, paragraphs, etc. */
export function ObservableValue({ pointKey, children, mute = false }: { pointKey: string; children: ReactNode; mute?: boolean }) {
  const points = useCatalog();
  const { showProvenance } = useUI();
  const p = points[pointKey];
  if (!p) return <>{children}</>;
  const m = kindMeta(p.kind);
  const dot =
    p.kind === "real" ? "bg-emerald-500" :
    p.kind === "derived" ? "bg-sky-500" :
    p.kind === "derived_proxy" ? "bg-amber-500" :
    p.kind === "model_output" ? "bg-indigo-500" :
    p.kind === "forecast" ? "bg-blue-500" :
    p.kind === "anonymised" ? "bg-slate-500" :
    "bg-violet-500";
  return (
    <span className="inline-flex items-center gap-1 relative group">
      {children}
      {!mute && <span className={`w-1 h-1 rounded-full ${dot} inline-block`} aria-hidden />}
      {showProvenance && (
        <span className={`hidden group-hover:inline-flex items-center gap-1 rounded ring-1 text-[9px] px-1 py-0 ${m.chip}`}>{m.icon}{m.label}</span>
      )}
    </span>
  );
}

/** Global toggle button — sits in the top bar. */
export function ProvenanceToggle() {
  const { showProvenance, toggleProvenance } = useUI();
  return (
    <button
      onClick={toggleProvenance}
      className={`text-xs px-2.5 py-1.5 rounded-lg border ${showProvenance ? "bg-blue-50 border-blue-300 text-blue-800" : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"}`}
      title="Show data provenance for every metric"
    >
      <span className="inline-flex items-center gap-1">
        {showProvenance ? <ShieldCheck className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
        Provenance
      </span>
    </button>
  );
}

/** Sensitive-data warning — shown next to fields that have potential PII implications. */
export function SensitiveBadge({ reason }: { reason?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 ring-1 ring-orange-200" title={reason}>
      <AlertTriangle className="w-3 h-3" /> sensitive
    </span>
  );
}

/** Floating toasts driven by store. */
export function ToastStack() {
  const { toasts, dismissToast } = useUI();
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-xs">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className="bg-slate-900 text-white text-sm rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 text-left hover:bg-slate-800"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{t.text}</span>
        </button>
      ))}
    </div>
  );
}
