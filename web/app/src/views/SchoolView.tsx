import { useMemo } from "react";
import { useAppData, useDistrictStudents } from "../data";
import { useUI } from "../store";
import { KPI, Section, RiskBadge, Tag } from "../components/UI";
import { Breadcrumb } from "../components/Layout";
import { StudentDetail } from "../components/StudentDetail";
import type { Student } from "../types";

export function SchoolView() {
  const { data } = useAppData();
  const { selection, drillTo, back } = useUI();
  const udise = selection.udise || 0;
  const school = data?.schools.find((s) => s.udise_code === udise);
  const { students: bundle, loading } = useDistrictStudents(school?.district_name);
  const studentsHere = useMemo(() => ((bundle || data?.students) ?? []).filter((s) => s.udise === udise), [bundle, data, udise]);

  if (!data || !school) return null;
  if (selection.studentId) {
    const st = studentsHere.find((s) => s.id === selection.studentId);
    if (st) return <StudentDetail student={st} />;
  }

  const byClass: Record<string, Student[]> = {};
  for (const s of studentsHere) {
    const k = `${s.class}-${s.section}`;
    (byClass[k] ||= []).push(s);
  }
  const classes = Object.entries(byClass).sort((a, b) => b[1].filter(s => s.tier !== "Watch").length - a[1].filter(s => s.tier !== "Watch").length);

  return (
    <div>
      <Breadcrumb items={[
        { label: school?.district_name || "District", onClick: () => { back(); back(); } },
        { label: school?.mandal_name || "Mandal", onClick: back },
        { label: school?.school_name || `School ${udise}` },
      ]} />

      <h1 className="text-xl font-semibold mb-1">{school?.school_name}</h1>
      <div className="text-sm text-slate-500 mb-4">UDISE {udise} · {school?.mandal_name}, {school?.district_name} {loading && <span className="text-blue-600">· loading…</span>}</div>

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <KPI pointKey="rules_risk_score" label="Students needing support" value={school?.high_risk ?? 0} sub={`${school?.critical ?? 0} critical · ${school?.watch ?? 0} watch`} tone="bad" />
        <KPI label="High recoverability" value={school?.high_recoverability_count ?? 0} tone="good" />
        <KPI pointKey="attendance_pct" label="Avg attendance" value={`${school?.avg_attendance?.toFixed(0) ?? "—"}%`} />
        <KPI pointKey="overdue_actions" label="Overdue actions" value={school?.overdue_actions ?? 0} tone="warn" />
      </div>

      <Section title="Class-wise risk view" sub="Click a class to see its students">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Class</th>
              <th className="table-th">Students flagged</th>
              <th className="table-th">Critical</th>
              <th className="table-th">High</th>
              <th className="table-th">Watch</th>
            </tr>
          </thead>
          <tbody>
            {classes.map(([k, list]) => (
              <tr key={k} className="hover:bg-slate-50 cursor-pointer" onClick={() => drillTo({ classKey: k })}>
                <td className="table-td font-medium">{k}</td>
                <td className="table-td">{list.length}</td>
                <td className="table-td">{list.filter((s) => s.tier === "Critical Support Needed").length}</td>
                <td className="table-td">{list.filter((s) => s.tier === "High Support Needed").length}</td>
                <td className="table-td">{list.filter((s) => s.tier === "Watch").length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Today's student action queue" sub="Triaged by risk score">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Student</th>
              <th className="table-th">Class</th>
              <th className="table-th">Risk</th>
              <th className="table-th">Recoverability</th>
              <th className="table-th">Recommended action</th>
              <th className="table-th">Owner</th>
            </tr>
          </thead>
          <tbody>
            {studentsHere.sort((a, b) => b.risk - a.risk).slice(0, 50).map((st) => (
              <tr key={st.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => drillTo({ studentId: st.id })}>
                <td className="table-td font-medium">{st.name}</td>
                <td className="table-td">{st.class}-{st.section}</td>
                <td className="table-td"><RiskBadge tier={st.tier} /></td>
                <td className="table-td"><Tag color={st.rec.startsWith("High") ? "emerald" : st.rec.startsWith("Medium") ? "amber" : "slate"}>{st.rec}</Tag></td>
                <td className="table-td">{st.act.action}</td>
                <td className="table-td">{st.act.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
