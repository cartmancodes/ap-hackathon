import { useMemo, useState } from "react";
import { useAppData } from "../data";
import { useUI } from "../store";
import { KPI, Section, RiskBadge, Tag } from "../components/UI";
import { StudentDetail } from "../components/StudentDetail";
import type { Student } from "../types";
import { ChevronRight } from "lucide-react";

const HM_SAMPLE_KEY = "hm_school";

export function HeadmasterView() {
  const { data } = useAppData();
  const { selection, drillTo } = useUI();
  const [pickedSchool, setPickedSchool] = useState<number | null>(() => {
    const cached = localStorage.getItem(HM_SAMPLE_KEY);
    return cached ? parseInt(cached) : null;
  });

  if (!data) return null;

  // Derive default school: pick a school with the most high-risk students for a believable demo
  const defaultSchool = useMemo(() => {
    return [...data.schools].sort((a, b) => b.high_risk - a.high_risk)[0];
  }, [data]);

  const udise = pickedSchool ?? defaultSchool.udise_code;
  const school = data.schools.find((s) => s.udise_code === udise) || defaultSchool;
  const students = useMemo(() => data.students.filter((s) => s.udise === udise), [data, udise]);

  if (selection.studentId) {
    const st = students.find((s) => s.id === selection.studentId);
    if (st) return <StudentDetail student={st} />;
  }

  const today = students.sort((a, b) => b.risk - a.risk).slice(0, 12);
  const recoverableHigh = students.filter((s) => s.rec.startsWith("High") && (s.tier === "High Support Needed" || s.tier === "Critical Support Needed"));
  const sudden = students.filter((s) => (s.f.attendance_delta_30d ?? 0) < -10);
  const declining = students.filter((s) => (s.f.marks_trend ?? 0) < -25);

  // class-wise rising absenteeism
  const byClass: Record<string, Student[]> = {};
  for (const s of students) (byClass[`${s.class}-${s.section}`] ||= []).push(s);
  const classRisk = Object.entries(byClass).map(([k, v]) => ({
    k, n: v.length,
    avg_att: v.reduce((s, x) => s + (x.f.attendance_pct || 0), 0) / Math.max(1, v.length),
    high: v.filter((x) => x.tier !== "Watch").length,
  })).sort((a, b) => b.high - a.high);

  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold">Headmaster — {school.school_name}</h1>
          <div className="text-sm text-slate-500">UDISE {school.udise_code} · {school.mandal_name}, {school.district_name}</div>
        </div>
        <select
          className="text-sm rounded-lg border border-slate-200 px-3 py-1.5 bg-white"
          value={udise}
          onChange={(e) => { const v = parseInt(e.target.value); setPickedSchool(v); localStorage.setItem(HM_SAMPLE_KEY, String(v)); }}
        >
          {[...data.schools].sort((a, b) => b.high_risk - a.high_risk).slice(0, 25).map((s) => (
            <option key={s.udise_code} value={s.udise_code}>{s.school_name} — {s.high_risk} high-risk</option>
          ))}
        </select>
      </div>

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <KPI label="Students needing support today" value={school.high_risk} sub={`${school.critical} critical`} tone="bad" />
        <KPI label="High recoverability" value={school.high_recoverability_count} tone="good" />
        <KPI label="Pending parent calls" value={school.pending_parent_calls} tone="warn" />
        <KPI label="Overdue actions" value={school.overdue_actions} tone="warn" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Section title="Today's student action queue" sub="Top priority students to act on">
            <ul className="divide-y divide-slate-100">
              {today.map((st) => (
                <li key={st.id} className="py-3 flex items-start gap-3 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-md" onClick={() => drillTo({ studentId: st.id })}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{st.name}</span>
                      <span className="text-xs text-slate-500">Class {st.class}-{st.section}</span>
                      <RiskBadge tier={st.tier} />
                      <Tag color={st.rec.startsWith("High") ? "emerald" : st.rec.startsWith("Medium") ? "amber" : "slate"}>{st.rec}</Tag>
                    </div>
                    <div className="text-sm text-slate-600 mt-0.5">{st.act.reason} → <b>{st.act.action}</b></div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 mt-1" />
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Class-wise risk view">
            <table className="w-full">
              <thead>
                <tr><th className="table-th">Class</th><th className="table-th">Avg attendance</th><th className="table-th">Students needing support</th><th className="table-th">Status</th></tr>
              </thead>
              <tbody>
                {classRisk.map((c) => (
                  <tr key={c.k} className="hover:bg-slate-50">
                    <td className="table-td font-medium">{c.k}</td>
                    <td className="table-td">{c.avg_att.toFixed(0)}%</td>
                    <td className="table-td">{c.high}</td>
                    <td className="table-td">{c.high > 5 ? <Tag color="red">High</Tag> : c.high > 2 ? <Tag color="amber">Watch</Tag> : <Tag color="emerald">OK</Tag>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>

        <div>
          <Section title="High recoverability" sub="High risk but likely to respond to timely action — best ROI for the school">
            <ul className="text-sm space-y-1.5">
              {recoverableHigh.slice(0, 8).map((s) => (
                <li key={s.id} className="hover:bg-slate-50 cursor-pointer px-1 rounded-md flex justify-between" onClick={() => drillTo({ studentId: s.id })}>
                  <span>{s.name} <span className="text-xs text-slate-500">· {s.class}-{s.section}</span></span>
                  <Tag color="emerald">act this week</Tag>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Sudden attendance drop" sub="Last 30 days vs overall">
            <ul className="text-sm space-y-1.5">
              {sudden.slice(0, 6).map((s) => (
                <li key={s.id} className="hover:bg-slate-50 cursor-pointer px-1 rounded-md flex justify-between" onClick={() => drillTo({ studentId: s.id })}>
                  <span>{s.name}</span>
                  <span className="text-xs text-red-600">{(s.f.attendance_delta_30d || 0).toFixed(0)}pp</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Academic decline" sub="Marks trend dropping">
            <ul className="text-sm space-y-1.5">
              {declining.slice(0, 6).map((s) => (
                <li key={s.id} className="hover:bg-slate-50 cursor-pointer px-1 rounded-md flex justify-between" onClick={() => drillTo({ studentId: s.id })}>
                  <span>{s.name}</span>
                  <span className="text-xs text-orange-600">Δ {s.f.marks_trend}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
