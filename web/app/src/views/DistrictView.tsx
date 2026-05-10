import { useMemo } from "react";
import { useAppData } from "../data";
import { useUI } from "../store";
import { t } from "../i18n";
import { KPI, Section, ProgressBar, Tag } from "../components/UI";
import { Breadcrumb } from "../components/Layout";
import { driverLabels } from "../util";
import { AlertTriangle, ShieldCheck, Users } from "lucide-react";
import { MandalView } from "./MandalView";

export function DistrictView() {
  const { data } = useAppData();
  const { selection, drillTo, lang, resetSelection } = useUI();

  if (!data) return null;
  if (selection.mandal) return <MandalView />;

  const district = selection.district!;
  const districts = data.districts.find((x) => x.district_name === district)!;
  const mandals = useMemo(() => data.mandals.filter((m) => m.district_name === district), [data, district]);
  const schools = useMemo(() => data.schools.filter((s) => s.district_name === district), [data, district]);

  const sortedMandals = [...mandals].sort((a, b) => (b.critical * 2 + b.high_risk) - (a.critical * 2 + a.high_risk));
  const lowCompletion = [...mandals].sort((a, b) => a.intervention_completion_pct - b.intervention_completion_pct).slice(0, 6);
  const top_schools = [...schools].sort((a, b) => b.high_risk - a.high_risk).slice(0, 10);

  return (
    <div>
      <Breadcrumb items={[
        { label: t("role_state", lang), onClick: resetSelection },
        { label: district },
      ]} />

      <h1 className="text-xl font-semibold mb-1">{district} — {t("district_overview", lang)}</h1>
      <div className="text-sm text-slate-500 mb-4">{mandals.length} mandals · {schools.length} schools (in sample)</div>

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <KPI icon={<AlertTriangle className="w-3.5 h-3.5" />} label={t("high_risk_students", lang)} value={districts.high_risk.toLocaleString()} sub={`${districts.critical} critical · ${districts.watch} watch`} tone="bad" />
        <KPI icon={<ShieldCheck className="w-3.5 h-3.5" />} label={t("high_recov", lang)} value={districts.high_recoverability_count.toLocaleString()} tone="good" />
        <KPI icon={<Users className="w-3.5 h-3.5" />} label={t("intervention_completion", lang)} value={`${districts.intervention_completion_pct.toFixed(0)}%`} tone={districts.intervention_completion_pct < 50 ? "bad" : "neutral"} />
        <KPI label={t("unresolved_escalations", lang)} value={districts.unresolved_escalations} sub={`avg attendance ${districts.avg_attendance}%`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Section title={t("drill_district_to_mandal", lang)} sub="Mandal-wise risk + execution status (click to drill)">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Mandal</th>
                  <th className="table-th">High-risk</th>
                  <th className="table-th">Schools w/ pending</th>
                  <th className="table-th">Action completion</th>
                  <th className="table-th">Overdue</th>
                  <th className="table-th">Dominant driver</th>
                </tr>
              </thead>
              <tbody>
                {sortedMandals.map((m) => (
                  <tr key={m.mandal_name} className="hover:bg-slate-50 cursor-pointer" onClick={() => drillTo({ mandal: m.mandal_name })}>
                    <td className="table-td font-medium">{m.mandal_name}</td>
                    <td className="table-td">{m.high_risk} <span className="text-xs text-red-600">({m.critical} crit)</span></td>
                    <td className="table-td">{schools.filter((s) => s.mandal_name === m.mandal_name && s.overdue_actions > 0).length}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-2 w-32">
                        <ProgressBar value={m.intervention_completion_pct} tone={m.intervention_completion_pct < 50 ? "red" : m.intervention_completion_pct < 75 ? "amber" : "emerald"} />
                        <span className="text-xs">{m.intervention_completion_pct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="table-td">{m.overdue_actions}</td>
                    <td className="table-td"><Tag color="violet">{driverLabels[m.top_drivers[0]?.[0]] || "—"}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="High-risk schools in this district" sub="Schools sorted by high-risk concentration">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">School</th>
                  <th className="table-th">Mandal</th>
                  <th className="table-th">High-risk</th>
                  <th className="table-th">Avg attendance</th>
                  <th className="table-th">Overdue actions</th>
                </tr>
              </thead>
              <tbody>
                {top_schools.map((s) => (
                  <tr key={s.udise_code} className="hover:bg-slate-50 cursor-pointer" onClick={() => drillTo({ mandal: s.mandal_name, udise: s.udise_code })}>
                    <td className="table-td font-medium">{s.school_name}</td>
                    <td className="table-td">{s.mandal_name}</td>
                    <td className="table-td">{s.high_risk}</td>
                    <td className="table-td">{s.avg_attendance.toFixed(0)}%</td>
                    <td className="table-td">{s.overdue_actions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>

        <div>
          <Section title="This week's action plan" sub="Suggested district-level priorities">
            <ol className="text-sm list-decimal pl-5 space-y-1.5 text-slate-800">
              <li>Schedule MEO review for top 3 mandals: <b>{sortedMandals.slice(0, 3).map((m) => m.mandal_name).join(", ")}</b></li>
              <li>Clear {districts.unresolved_escalations} pending escalation{districts.unresolved_escalations === 1 ? "" : "s"} this week.</li>
              <li>Force-close overdue home visits in {lowCompletion.slice(0, 2).map((m) => m.mandal_name).join(", ")}.</li>
              <li>Run welfare-linkage check where dominant driver is migration / financial stress.</li>
              <li>Hold a district review by Friday with intervention completion as KPI.</li>
            </ol>
          </Section>

          <Section title="Lowest action completion" sub="Mandals where directions aren't being acted upon">
            <ul className="text-sm space-y-1.5">
              {lowCompletion.map((m) => (
                <li key={m.mandal_name} className="flex justify-between hover:bg-slate-50 rounded-md px-1 cursor-pointer" onClick={() => drillTo({ mandal: m.mandal_name })}>
                  <span>{m.mandal_name}</span><span className="text-xs text-orange-600">{m.intervention_completion_pct.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Assign tasks" sub="Direction → Mandal officer">
            <textarea rows={2} placeholder="e.g. Verify migration claims for Class 8-9 students in target mandals" className="w-full text-sm rounded-lg border border-slate-200 p-2" />
            <button className="btn-primary mt-2" onClick={() => alert("Task assigned to mandal officers (demo)")}>Assign to all mandals</button>
          </Section>
        </div>
      </div>
    </div>
  );
}
