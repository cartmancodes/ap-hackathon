import { useEffect, useRef, useState } from "react";
import { useUI } from "../store";
import { useAppData } from "../data";
import { t } from "../i18n";
import { ChevronRight, GraduationCap, Languages, Search as SearchIcon, X } from "lucide-react";
import type { Role, SearchEntry } from "../types";
import { ProvenanceToggle } from "./DataPoint";

const ROLES: Role[] = ["state", "district", "mandal", "headmaster", "teacher"];

export function TopBar({ tab, setTab }: { tab: string; setTab: (s: string) => void }) {
  const { role, setRole, lang, setLang } = useUI();
  const TABS: [string, string][] = [
    ["dashboard", "Dashboard"],
    ["early", "Hyper-early"],
    ["counsellor", "Counsellor"],
    ["forecast", "Forecast"],
    ["leap", t("leap_integration", lang)],
    ["audit", t("model_audit", lang)],
    ["about", t("about", lang)],
  ];
  return (
    <header className="bg-slate-900 text-white">
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2 mr-2">
          <GraduationCap className="w-6 h-6 text-blue-400" />
          <div>
            <div className="font-semibold leading-tight">{t("app_title", lang)}</div>
            <div className="text-xs text-slate-400 leading-tight">{t("app_subtitle", lang)}</div>
          </div>
        </div>
        <nav className="flex items-center gap-1 ml-4 flex-wrap">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === k ? "bg-slate-700" : "hover:bg-slate-800"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <GlobalSearch setTab={setTab} />
          <ProvenanceToggle />
          <button
            onClick={() => setLang(lang === "en" ? "te" : "en")}
            className="btn-ghost !text-white !hover:bg-slate-800"
            title={t("language_toggle", lang)}
          >
            <Languages className="w-4 h-4" />
            {lang === "en" ? "తెలుగు" : "English"}
          </button>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="bg-slate-800 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-700"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{t(`role_${r}`, lang)}</option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}

function GlobalSearch({ setTab }: { setTab: (s: string) => void }) {
  const { data } = useAppData();
  const { drillTo } = useUI();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const matches = data && q.length >= 1 ? matchSearch(data.search, q, 12) : [];

  return (
    <>
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        className="bg-slate-800 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 inline-flex items-center gap-1.5"
        title="Search (press /)"
      >
        <SearchIcon className="w-3.5 h-3.5" /> Search <kbd className="text-[10px] bg-slate-700 px-1 rounded">/</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 flex items-start justify-center pt-20" onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl mx-4 bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center px-4 py-3 border-b border-slate-100">
              <SearchIcon className="w-4 h-4 text-slate-400 mr-2" />
              <input
                ref={inputRef}
                placeholder="Search student, school, mandal, district…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="flex-1 outline-none text-sm text-slate-900"
              />
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {matches.map((m) => (
                <li key={`${m.kind}-${m.key}`}
                  className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer"
                  onClick={() => {
                    setOpen(false);
                    setTab("dashboard");
                    if (m.kind === "student") drillTo({ district: m.entry.district, mandal: m.entry.mandal, udise: m.entry.udise, studentId: m.entry.id });
                    else if (m.kind === "school") drillTo({ district: m.entry.district, mandal: m.entry.mandal, udise: m.entry.udise });
                    else if (m.kind === "mandal") drillTo({ district: m.entry.district, mandal: m.entry.mandal });
                    else if (m.kind === "district") drillTo({ district: m.entry.district });
                  }}>
                  <div className="text-xs uppercase tracking-wide text-slate-400">{m.kind}</div>
                  <div className="text-sm font-medium text-slate-900">{m.title}</div>
                  <div className="text-xs text-slate-500">{m.sub}</div>
                </li>
              ))}
              {q.length >= 1 && matches.length === 0 && (
                <li className="px-4 py-6 text-sm text-slate-500 text-center">No matches. Try a different term.</li>
              )}
              {q.length === 0 && (
                <li className="px-4 py-3 text-xs text-slate-500">Type to search · use <kbd className="bg-slate-100 px-1 rounded">/</kbd> from anywhere · esc to close</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

type Match =
  | { kind: "student"; key: string; entry: SearchEntry; title: string; sub: string }
  | { kind: "school"; key: string; entry: { district: string; mandal: string; udise: number; school_name: string; high_risk?: number }; title: string; sub: string }
  | { kind: "mandal"; key: string; entry: { district: string; mandal: string }; title: string; sub: string }
  | { kind: "district"; key: string; entry: { district: string }; title: string; sub: string };

function matchSearch(search: SearchEntry[], q: string, limit: number): Match[] {
  const t = q.toLowerCase();
  const out: Match[] = [];
  const seenSchools = new Set<number>();
  const seenMandals = new Set<string>();
  const seenDistricts = new Set<string>();
  for (const s of search) {
    if (out.length >= limit) break;
    if (s.name.toLowerCase().includes(t) || String(s.id).includes(t) || (s.anon_id || "").toLowerCase().includes(t)) {
      out.push({ kind: "student", key: `s${s.id}`, entry: s, title: s.name, sub: `${s.school_name} · ${s.mandal}, ${s.district} · risk ${s.risk}` });
    }
  }
  for (const s of search) {
    if (out.length >= limit) break;
    if (!seenSchools.has(s.udise) && s.school_name.toLowerCase().includes(t)) {
      seenSchools.add(s.udise);
      out.push({ kind: "school", key: `sch${s.udise}`, entry: { district: s.district, mandal: s.mandal, udise: s.udise, school_name: s.school_name }, title: s.school_name, sub: `${s.mandal}, ${s.district}` });
    }
  }
  for (const s of search) {
    if (out.length >= limit) break;
    if (!seenMandals.has(s.mandal) && s.mandal.toLowerCase().includes(t)) {
      seenMandals.add(s.mandal);
      out.push({ kind: "mandal", key: `m${s.mandal}`, entry: { district: s.district, mandal: s.mandal }, title: s.mandal, sub: s.district });
    }
  }
  for (const s of search) {
    if (out.length >= limit) break;
    if (!seenDistricts.has(s.district) && s.district.toLowerCase().includes(t)) {
      seenDistricts.add(s.district);
      out.push({ kind: "district", key: `d${s.district}`, entry: { district: s.district }, title: s.district, sub: "District" });
    }
  }
  return out;
}

export function Breadcrumb({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <div className="flex items-center gap-1 text-sm text-slate-500 mb-3">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
          {it.onClick ? (
            <button onClick={it.onClick} className="hover:text-blue-600 hover:underline">{it.label}</button>
          ) : (
            <span className="text-slate-800 font-medium">{it.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}
