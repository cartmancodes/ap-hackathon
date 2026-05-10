import { useUI } from "../store";
import { t } from "../i18n";
import { ChevronRight, GraduationCap, Languages } from "lucide-react";
import type { Role } from "../types";

const ROLES: Role[] = ["state", "district", "mandal", "headmaster", "teacher"];

export function TopBar({ tab, setTab }: { tab: string; setTab: (s: string) => void }) {
  const { role, setRole, lang, setLang } = useUI();
  const TABS: [string, string][] = [
    ["dashboard", "Dashboard"],
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
        <nav className="flex items-center gap-1 ml-4">
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
