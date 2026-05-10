import { useMemo } from "react";
import { useAppData } from "../data";
import { useUI } from "../store";
import { t } from "../i18n";
import { KPI, Section, ProgressBar, Tag } from "../components/UI";
import { Breadcrumb } from "../components/Layout";
import { driverLabels } from "../util";
import { AlertTriangle, ShieldCheck, Building2 } from "lucide-react";
import { SchoolView } from "./SchoolView";

export function MandalView() {
  const { data } = useAppData();
  const { selection, drillTo, lang, back } = useUI();

  if (!data) return null;
  if (selection.udise) return <SchoolView />;

  const district = selection.district!;
  const mandal = selection.mandal!;
  const m = data.mandals.find((x) => x.district_name === district && x.mandal_name === mandal)!;
  const schools = useMemo(() => data.schools.filter((s) => s.district_name === district && s.mandal_name === mandal), [data, district, mandal]);
  const students = useMemo(() => data.students.filter((s) => s.district === district && s.mandal === mandal), [data, district, mandal]);

  const sortedSchools = [...schools].sort((a, b) => b.high_risk - a.high_risk);
  const homeVisitQueue = students
    .filter((s) => s.tier === "Critical Support Needed" || s.tier === "High Support Needed")
    .filter((s) => s.syn?.seasonal_migration_possibility || (s.f.attendance_pct ?? 100) < 50)
    .slice(0, 12);

  return (
    <div>
      <Breadcrumb items={[
        { label: district, onClick: back },
        { label: mandal },
      ]} />

      <h1 className="text-xl font-semibold mb-1">{mandal} — {t("mandal_overview", lang)}</h1>
      <div className="text-sm text-slate-500 mb-4">{schools.length} schools · {students.length} students needing support</div>

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <KPI icon={<AlertTriangle className="w-3.5 h-3.5" />} label={t("high_risk_students", lang)} value={m.high_risk} sub={`${m.critical} critical`} tone="bad" />
        <KPI icon={<ShieldCheck className="w-3.5 h-3.5" />} label={t("high_recov", lang)} value={m.high_recoverability_count} tone="good" />
        <KPI label="Action completion" value={`${m.intervention_completion_pct.toFixed(0)}%`} tone={m.intervention_completion_pct < 50 ? "bad" : "neutral"} />
        <KPI label="Overdue actions" value={m.overdue_actions} sub={`Pending home visits: ${m.pending_home_visits}`} tone="warn" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Section title={t("drill_mandal_to_school", lang)} sub="School-level risk queue + follow-up compliance">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">School</th>
                  <th className="table-th">High-risk</th>
                  <th className="table-th">Avg attendance</th>
                  <th className="table-th">Overdue</th>
                  <th className="table-th">Pending parent calls</th>
                  <th className="table-th">Top driver</th>
                </tr>
              </thead>
              <tbody>
                {sortedSchools.map((s) => (
                  <tr key={s.udise_code} className="hover:bg-slate-50 cursor-pointer" onClick={() => drillTo({ udise: s.udise_code })}>
                    <td className="table-td font-medium">{s.school_name}</td>
                    <td className="table-td">{s.high_risk}</td>
                    <td className="table-td">{s.avg_attendance.toFixed(0)}%</td>
                    <td className="table-td">{s.overdue_actions}</td>
                    <td className="table-td">{s.pending_parent_calls}</td>
                    <td className="table-td"><Tag color="violet">{driverLabels[s.top_drivers[0]?.[0]] || "—"}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Home visit queue" sub="Students likely needing in-person follow-up">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Student</th>
                  <th className="table-th">School</th>
                  <th className="table-th">Attendance</th>
                  <th className="table-th">Reason</th>
                  <th className="table-th">Owner</th>
                </tr>
              </thead>
              <tbody>
                {homeVisitQueue.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => drillTo({ udise: st.udise, studentId: st.id })}>
                    <td className="table-td font-medium">{st.name}</td>
                    <td className="table-td">{st.school_name}</td>
                    <td className="table-td">{st.f.attendance_pct?.toFixed(0)}%</td>
                    <td className="table-td">{st.act.reason}</td>
                    <td className="table-td">Mandal Officer</td>
                  </tr>
                ))}
                {homeVisitQueue.length === 0 && <tr><td className="table-td text-slate-500" colSpan={5}>No home visits pending.</td></tr>}
              </tbody>
            </table>
          </Section>
        </div>

        <div>
          <Section title="Action ageing" sub="Overdue intervention bands">
            <div className="space-y-2 text-sm">
              <Band label="Pending 3+ days" value={Math.round(m.overdue_actions * 0.5)} tone="amber" max={Math.max(1, m.overdue_actions)} />
              <Band label="Pending 7+ days" value={Math.round(m.overdue_actions * 0.3)} tone="orange" max={Math.max(1, m.overdue_actions)} />
              <Band label="Pending 14+ days" value={Math.round(m.overdue_actions * 0.15)} tone="red" max={Math.max(1, m.overdue_actions)} />
            </div>
            <button className="btn-danger mt-3" onClick={() => alert("Escalated to district officer (demo)")}><Building2 className="w-4 h-4" /> Escalate stale items</button>
          </Section>

          <Section title="Repeated absenteeism cluster" sub="Schools where the same students miss school repeatedly">
            <ul className="text-sm space-y-1.5">
              {sortedSchools.slice(0, 6).map((s) => (
                <li key={s.udise_code} className="flex justify-between hover:bg-slate-50 rounded-md px-1 cursor-pointer" onClick={() => drillTo({ udise: s.udise_code })}>
                  <span>{s.school_name}</span><span className="text-xs text-slate-500">{s.high_risk} students</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Remarks">
            <textarea rows={3} placeholder="Log mandal review note..." className="w-full text-sm rounded-lg border border-slate-200 p-2" />
            <button className="btn-primary mt-2" onClick={() => alert("Remarks saved (demo)")}>Save</button>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Band({ label, value, max, tone }: { label: string; value: number; max: number; tone: "amber" | "orange" | "red" }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1"><span>{label}</span><span>{value}</span></div>
      <ProgressBar value={value} max={max} tone={tone} />
    </div>
  );
}
