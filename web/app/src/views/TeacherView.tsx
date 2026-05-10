import { useMemo, useState } from "react";
import { useAppData } from "../data";
import { useUI } from "../store";
import { t } from "../i18n";
import { Section, RiskBadge, Tag, KPI } from "../components/UI";
import { StudentDetail } from "../components/StudentDetail";
import { ActionDialog } from "../components/ActionDialog";
import { driverLabels } from "../util";
import { Phone, MessageSquare, CheckCircle2, ArrowUpRight } from "lucide-react";
import type { Student } from "../types";

const TEACHER_KEY = "teacher_class";

export function TeacherView() {
  const { data } = useAppData();
  const { selection, drillTo, lang, logAction, role, actionLog } = useUI();
  const [picked, setPicked] = useState<string>(() => localStorage.getItem(TEACHER_KEY) || "");
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);

  if (!data) return null;

  // Build list of available class signatures from one believable school
  const candidateSchools = useMemo(() => [...data.schools].sort((a, b) => b.high_risk - a.high_risk).slice(0, 10), [data]);
  const teacherSchool = candidateSchools[0];
  const teacherStudents = useMemo(() => data.students.filter((s) => s.udise === teacherSchool.udise_code), [data, teacherSchool]);

  const classOptions = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of teacherStudents) map[`${s.class}-${s.section}`] = (map[`${s.class}-${s.section}`] || 0) + 1;
    return Object.keys(map).sort();
  }, [teacherStudents]);

  const myClass = picked || classOptions[0] || "8-A";
  const myStudents = useMemo(() => teacherStudents.filter((s) => `${s.class}-${s.section}` === myClass), [teacherStudents, myClass]);

  if (selection.studentId) {
    const st = myStudents.find((s) => s.id === selection.studentId) || data.students.find((s) => s.id === selection.studentId);
    if (st) return <StudentDetail student={st} supportiveLanguage />;
  }

  const today = [...myStudents].sort((a, b) => b.risk - a.risk).slice(0, 8);
  const improving = myStudents.filter((s) => (s.f.attendance_delta_30d ?? 0) > 5).slice(0, 5);
  const handledIds = new Set(actionLog.map((a) => a.studentId));
  const pendingCount = today.filter((s) => !handledIds.has(s.id)).length;

  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold">{t("teacher_today", lang)}</h1>
          <div className="text-sm text-slate-500">{teacherSchool.school_name} · Class {myClass}</div>
        </div>
        <div className="flex items-center gap-2">
          <select className="text-sm rounded-lg border border-slate-200 px-3 py-1.5 bg-white"
            value={myClass}
            onChange={(e) => { setPicked(e.target.value); localStorage.setItem(TEACHER_KEY, e.target.value); }}
          >
            {classOptions.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <KPI label="Students to act on today" value={pendingCount} tone={pendingCount > 0 ? "warn" : "good"} />
        <KPI label="Parent calls due" value={today.filter((s) => s.act.action.includes("Parent") || s.act.action.includes("SMS")).length} />
        <KPI label="Repeated absentees" value={myStudents.filter((s) => (s.f.attendance_pct ?? 100) < 50).length} tone="bad" />
        <KPI label="Improving" value={improving.length} tone="good" />
      </div>

      <Section title="Today — 5 to 10 priority students" sub="Tap to see why and act in under 2 minutes">
        {today.length === 0 ? (
          <div className="text-sm text-slate-500">No students need action today. Nice work.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {today.map((st) => {
              const handled = handledIds.has(st.id);
              return (
                <li key={st.id} className="py-3 flex items-start gap-3">
                  <div className="flex-1 cursor-pointer" onClick={() => drillTo({ studentId: st.id })}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{st.name}</span>
                      <span className="text-xs text-slate-500">Roll {st.id % 60 + 1}</span>
                      <RiskBadge tier={st.tier} supportive />
                      {handled && <Tag color="emerald">action logged</Tag>}
                    </div>
                    <div className="text-sm text-slate-600 mt-0.5">{plainReason(st)}</div>
                    <div className="text-sm text-blue-700 font-medium mt-0.5">→ {st.act.action}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button title="Parent SMS" className="btn-ghost border border-slate-200" onClick={() => logAction({ studentId: st.id, action: "Parent SMS", status: "Done", by: role })}><MessageSquare className="w-4 h-4" /></button>
                    <button title="Parent Call" className="btn-ghost border border-slate-200" onClick={() => logAction({ studentId: st.id, action: "Parent Call", status: "Done", by: role })}><Phone className="w-4 h-4" /></button>
                    <button title="Mark action done" className="btn-primary" onClick={() => logAction({ studentId: st.id, action: st.act.action, status: "Done", by: role })}><CheckCircle2 className="w-4 h-4" /></button>
                    <button title="Open" className="btn-ghost border border-slate-200" onClick={() => setActiveStudent(st)}>more <ArrowUpRight className="w-4 h-4" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Improving after intervention">
          {improving.length === 0 ? (
            <div className="text-sm text-slate-500">Once you mark interventions, attendance recovery shows up here.</div>
          ) : (
            <ul className="text-sm space-y-1.5">
              {improving.map((s) => (
                <li key={s.id} className="flex justify-between hover:bg-slate-50 cursor-pointer px-1 rounded-md" onClick={() => drillTo({ studentId: s.id })}>
                  <span>{s.name}</span>
                  <span className="text-xs text-emerald-600">+{s.f.attendance_delta_30d?.toFixed(0)}pp</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Add behavioural / social concern" sub="Helps the model learn what teachers see in person">
          <div className="grid grid-cols-2 gap-2">
            {["financial stress", "child labour concern", "early marriage concern", "migration likely", "health issue", "learning difficulty", "low parent engagement"].map((opt) => (
              <button key={opt} onClick={() => alert(`Flag added: ${opt} (demo)`)} className="text-sm py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-left">+ {opt}</button>
            ))}
          </div>
        </Section>
      </div>

      {activeStudent && <ActionDialog student={activeStudent} onClose={() => setActiveStudent(null)} />}
    </div>
  );
}

function plainReason(s: Student): string {
  const drv = s.drv?.[0];
  if (!drv) return "Stable, monitor only";
  switch (drv.key) {
    case "low_attendance": return `Attendance has fallen — current ${s.f.attendance_pct?.toFixed(0)}%`;
    case "recent_decline": return `Attendance dropped ${Math.abs(s.f.attendance_delta_30d || 0).toFixed(0)}pp in the last 30 days`;
    case "long_streak": return `Was absent ${s.f.longest_absence_streak} days in a row`;
    case "low_marks": return `Marks below class average`;
    case "marks_decline": return `Marks declining across assessments`;
    case "patterned_absence": return `Repeated absence pattern this year`;
    default: return driverLabels[drv.key] || drv.label;
  }
}
