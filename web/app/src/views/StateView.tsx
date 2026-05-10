import { useMemo, useState } from "react";
import { useAppData } from "../data";
import { useUI } from "../store";
import { t } from "../i18n";
import { KPI, Section, TrendArrow, ProgressBar, Tag } from "../components/UI";
import { Breadcrumb } from "../components/Layout";
import { driverLabels } from "../util";
import { AlertTriangle, Users, ShieldCheck, ArrowUpRight, MapPin, Building2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ScatterChart, Scatter, ZAxis } from "recharts";
import { DistrictView } from "./DistrictView";
import type { District } from "../types";

export function StateView() {
  const { data } = useAppData();
  const { selection, drillTo, lang } = useUI();
  const [scenarioBudget, setScenarioBudget] = useState(10000);
  const [stateNote, setStateNote] = useState<string>("");

  // Hooks MUST be called on every render in the same order — keep them above
  // any conditional/early returns. (Bug fixed: useMemo below an early return
  // crashed the app the moment a district was clicked.)
  const districts = data?.districts ?? [];
  const scenarioPlan = useMemo(() => {
    const sorted = [...districts].sort((a, b) => (b.critical * 2 + b.high_risk) - (a.critical * 2 + a.high_risk));
    const plan: { district: string; covers: number }[] = [];
    let remaining = scenarioBudget;
    for (const d of sorted) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, d.high_risk);
      if (take > 0) plan.push({ district: d.district_name, covers: take });
      remaining -= take;
    }
    return plan;
  }, [districts, scenarioBudget]);

  if (!data) return <div className="p-6 text-slate-500">Loading…</div>;
  if (selection.district) return <DistrictView />;

  const { state } = data;

  const districts_sorted = [...districts].sort((a, b) => b.high_risk - a.high_risk);
  const worsening = [...districts].sort((a, b) => b.risk_change_pct - a.risk_change_pct).slice(0, 5);
  const improving = [...districts].sort((a, b) => a.risk_change_pct - b.risk_change_pct).slice(0, 5);
  const lowest_completion = [...districts].sort((a, b) => a.intervention_completion_pct - b.intervention_completion_pct).slice(0, 5);

  // policy-level driver aggregation
  const driverTotals: Record<string, number> = {};
  for (const d of districts) for (const [k, v] of d.top_drivers) driverTotals[k] = (driverTotals[k] || 0) + v;
  const drivers = Object.entries(driverTotals).sort((a, b) => b[1] - a[1]).slice(0, 7);

  return (
    <div>
      <Breadcrumb items={[{ label: "State (Andhra Pradesh)" }]} />

      <h1 className="text-xl font-semibold mb-1">{t("needs_attention_today", lang)}</h1>
      <div className="text-sm text-slate-500 mb-4">{t("state_overview", lang)} · sample: {state.students_in_sample.toLocaleString()} students from FY 23-24 across {state.districts} districts, {state.mandals} mandals, {state.schools} schools</div>

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <KPI icon={<AlertTriangle className="w-3.5 h-3.5" />} label={t("high_risk_students", lang)} value={state.high_risk_total.toLocaleString()} sub={`${state.critical_total.toLocaleString()} critical · ${state.watch_total.toLocaleString()} watch`} tone="bad" />
        <KPI icon={<ShieldCheck className="w-3.5 h-3.5" />} label={t("high_recov", lang)} value={state.high_recoverability_total.toLocaleString()} sub="where action has highest impact" tone="good" />
        <KPI icon={<Users className="w-3.5 h-3.5" />} label="Confirmed dropouts" value={state.dropouts_23_24.toLocaleString()} sub={`raw 23-24: ${state.raw_dropouts_23_24.toLocaleString()} · 24-25 (label-only): ${state.raw_dropouts_24_25.toLocaleString()}`} />
        <KPI icon={<MapPin className="w-3.5 h-3.5" />} label="Districts" value={state.districts} sub={`avg attendance ${state.avg_attendance}% · avg risk ${state.avg_risk}`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Section title="District action table" sub="Where governance, prioritisation and accountability should focus">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">District</th>
                  <th className="table-th">High-risk</th>
                  <th className="table-th">{t("risk_change", lang)}</th>
                  <th className="table-th">Dominant driver</th>
                  <th className="table-th">{t("intervention_completion", lang)}</th>
                  <th className="table-th">{t("unresolved_escalations", lang)}</th>
                  <th className="table-th">State action</th>
                </tr>
              </thead>
              <tbody>
                {districts_sorted.slice(0, 18).map((d) => (
                  <tr key={d.district_name} className="hover:bg-slate-50 cursor-pointer" onClick={() => drillTo({ district: d.district_name })}>
                    <td className="table-td font-medium">{d.district_name}</td>
                    <td className="table-td">{d.high_risk.toLocaleString()} <span className="text-xs text-red-600">({d.critical} crit)</span></td>
                    <td className="table-td"><TrendArrow change={d.risk_change_pct} /></td>
                    <td className="table-td"><Tag color="violet">{driverLabels[d.top_drivers[0]?.[0]] || "—"}</Tag></td>
                    <td className="table-td"><div className="flex items-center gap-2 w-32"><ProgressBar value={d.intervention_completion_pct} tone={d.intervention_completion_pct < 50 ? "red" : d.intervention_completion_pct < 75 ? "amber" : "emerald"} /><span className="text-xs">{d.intervention_completion_pct.toFixed(0)}%</span></div></td>
                    <td className="table-td">{d.unresolved_escalations}</td>
                    <td className="table-td"><RecommendStateAction d={d} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title={t("hotspot_map", lang)} sub="Bubble = high-risk students, position = avg attendance vs avg risk">
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 8, left: 0, right: 8, bottom: 8 }}>
                  <CartesianGrid stroke="#f1f5f9" />
                  <XAxis dataKey="avg_attendance" name="Avg attendance %" domain={[60, 100]} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="avg_risk" name="Avg risk score" domain={[0, 60]} tick={{ fontSize: 11 }} />
                  <ZAxis dataKey="high_risk" range={[40, 800]} />
                  <Tooltip content={({ active, payload }) => active && payload && payload[0] ? (
                    <div className="card p-2 text-xs">
                      <div className="font-semibold">{payload[0].payload.district_name}</div>
                      <div>Avg risk: {payload[0].payload.avg_risk}</div>
                      <div>High-risk: {payload[0].payload.high_risk}</div>
                      <div>Attendance: {payload[0].payload.avg_attendance}%</div>
                    </div>
                  ) : null} />
                  <Scatter data={districts} fill="#ef4444" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>

        <div>
          <Section title="Districts worsening" sub="vs previous period (synthetic Δ)">
            <ul className="text-sm space-y-1.5">
              {worsening.map((d) => (
                <li key={d.district_name} className="flex justify-between hover:bg-slate-50 rounded-md px-1 cursor-pointer" onClick={() => drillTo({ district: d.district_name })}>
                  <span>{d.district_name}</span><TrendArrow change={d.risk_change_pct} />
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Districts improving">
            <ul className="text-sm space-y-1.5">
              {improving.map((d) => (
                <li key={d.district_name} className="flex justify-between hover:bg-slate-50 rounded-md px-1 cursor-pointer" onClick={() => drillTo({ district: d.district_name })}>
                  <span>{d.district_name}</span><TrendArrow change={d.risk_change_pct} />
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Lowest action completion" sub="Where directions aren't being acted upon">
            <ul className="text-sm space-y-1.5">
              {lowest_completion.map((d) => (
                <li key={d.district_name} className="flex justify-between hover:bg-slate-50 rounded-md px-1 cursor-pointer" onClick={() => drillTo({ district: d.district_name })}>
                  <span>{d.district_name}</span><span className="text-xs text-orange-600">{d.intervention_completion_pct.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title={t("policy_insights", lang)} sub="Most common risk drivers across the state">
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <BarChart layout="vertical" data={drivers.map(([k, v]) => ({ k: driverLabels[k] || k, v }))} margin={{ top: 4, left: 8, right: 8, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="k" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip />
                  <Bar dataKey="v" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>
      </div>

      <Section title={t("scenario", lang)} sub={t("if_we_can_intervene", lang)}>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label className="text-sm text-slate-700">Capacity (students this month):</label>
          <input type="range" min={2000} max={Math.max(2000, state.high_risk_total)} step={500} value={scenarioBudget} onChange={(e) => setScenarioBudget(parseInt(e.target.value))} className="w-72" />
          <span className="font-semibold text-slate-900">{scenarioBudget.toLocaleString()}</span>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <table className="w-full text-sm">
            <thead><tr><th className="table-th">District (priority order)</th><th className="table-th">Students covered</th></tr></thead>
            <tbody>
              {scenarioPlan.map((p, i) => (
                <tr key={i}><td className="table-td font-medium">{p.district}</td><td className="table-td">{p.covers.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm">
            <div className="font-medium text-blue-900">Plan summary</div>
            <ul className="list-disc pl-5 text-blue-900 mt-1 space-y-1">
              <li>{scenarioPlan.length} districts covered</li>
              <li>{scenarioPlan.reduce((s, p) => s + p.covers, 0).toLocaleString()} high-risk students reached</li>
              <li>Coverage prioritises districts with highest critical-tier students.</li>
              <li>System will track action completion and report back.</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Issue review note" sub="Send a written direction to district officers">
        <textarea
          rows={2}
          placeholder="e.g. 'Districts with worsening trend must complete home visits within 14 days and report back.'"
          value={stateNote}
          onChange={(e) => setStateNote(e.target.value)}
          className="w-full text-sm rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <div className="flex gap-2 mt-2">
          <button onClick={() => alert("Note dispatched to district officers (demo)")} className="btn-primary"><ArrowUpRight className="w-4 h-4" /> Send to all districts</button>
          <button onClick={() => alert("Field visit scheduled (demo)")} className="btn-ghost border border-slate-200"><Building2 className="w-4 h-4" /> Schedule field review</button>
        </div>
      </Section>
    </div>
  );
}

function RecommendStateAction({ d }: { d: District }) {
  // Simple rules to translate metrics into a state-level prescriptive action
  if (d.intervention_completion_pct < 50) return <Tag color="red">Tighten follow-up</Tag>;
  if (d.unresolved_escalations >= 5) return <Tag color="orange">Clear escalations</Tag>;
  if (d.risk_change_pct > 5) return <Tag color="orange">Field review</Tag>;
  if (d.dropouts_23_24 > d.high_risk * 0.4) return <Tag color="violet">Welfare audit</Tag>;
  return <Tag color="emerald">Monitor</Tag>;
}
