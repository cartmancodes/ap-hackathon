import { useState } from "react";
import type { Student } from "../types";
import { useUI } from "../store";
import { RiskBadge, Section, SyntheticBadge, Tag, ProgressBar } from "./UI";
import { ActionDialog } from "./ActionDialog";
import { driverLabels } from "../util";
import { ArrowLeft, ArrowUpRight, Phone, MessageSquare } from "lucide-react";

export function StudentDetail({ student, supportiveLanguage = false }: { student: Student; supportiveLanguage?: boolean }) {
  const { back, actionLog, studentObservations } = useUI();
  const [showAction, setShowAction] = useState(false);

  const myActions = actionLog.filter((a) => a.studentId === student.id);
  const myObs = studentObservations[student.id] || [];

  return (
    <div>
      <button onClick={back} className="btn-ghost text-sm mb-2"><ArrowLeft className="w-4 h-4" /> Back</button>

      <div className="card p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Student · ID {student.id}</div>
            <div className="text-2xl font-semibold mt-1">{student.name}</div>
            <div className="text-sm text-slate-600">
              Class {student.class}-{student.section} · {student.gender} · {student.caste}
              <br />
              {student.school_name} · {student.mandal}, {student.district}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <RiskBadge tier={student.tier} supportive={supportiveLanguage} />
            <Tag color={student.rec.startsWith("High") ? "emerald" : student.rec.startsWith("Medium") ? "amber" : "slate"}>
              {student.rec}
            </Tag>
            <div className="text-xs text-slate-500">Risk score {student.risk}</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <Section title="Why flagged" sub="Plain-language risk drivers">
            <div className="space-y-2">
              {(student.drv || []).map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="text-xs text-slate-500 w-44">{driverLabels[d.key] || d.key}</div>
                  <div className="flex-1"><ProgressBar value={d.weight} max={35} tone={d.weight >= 18 ? "red" : d.weight >= 10 ? "amber" : "blue"} /></div>
                  <div className="text-xs text-slate-700 w-72">{d.label}</div>
                </div>
              ))}
              {(!student.drv || student.drv.length === 0) && <div className="text-sm text-slate-500">No active drivers — student is currently stable.</div>}
            </div>
          </Section>

          <Section title="Recommended next action" right={
            <div className="flex gap-2">
              <button className="btn-ghost border border-slate-200"><MessageSquare className="w-4 h-4" /> Parent SMS</button>
              <button className="btn-ghost border border-slate-200"><Phone className="w-4 h-4" /> Parent call</button>
              <button onClick={() => setShowAction(true)} className="btn-primary">Mark action <ArrowUpRight className="w-4 h-4" /></button>
            </div>
          }>
            <div className="text-slate-800">
              <div className="font-medium">{student.act.action}</div>
              <div className="text-sm text-slate-600 mt-1">Owner: {student.act.owner} · Due in {student.act.due_in_days} days</div>
              <div className="text-sm text-slate-500 mt-1">Reason: {student.act.reason}</div>
            </div>
          </Section>

          <Section title="Action history">
            <ul className="space-y-2">
              {(student.hist || []).map((h, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-24 text-slate-500">{h.date}</div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">{h.action} <span className="text-xs text-slate-500">· {h.owner}</span></div>
                    <div className="text-slate-600">{h.remarks || "—"}</div>
                  </div>
                  <Tag color={h.status === "Done" ? "emerald" : "amber"}>{h.status}</Tag>
                </li>
              ))}
              {myActions.map((a, i) => (
                <li key={`me${i}`} className="flex items-start gap-3 text-sm">
                  <div className="w-24 text-slate-500">{a.at.slice(0, 10)}</div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">{a.action} <span className="text-xs text-blue-600">· just now</span></div>
                    <div className="text-slate-600">{a.outcome || "—"}</div>
                  </div>
                  <Tag color={a.status === "Done" ? "emerald" : a.status === "Escalated" ? "red" : "amber"}>{a.status}</Tag>
                </li>
              ))}
              {(!student.hist || student.hist.length === 0) && myActions.length === 0 && (
                <div className="text-sm text-slate-500">No prior actions logged.</div>
              )}
            </ul>
            {myObs.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="text-xs uppercase text-slate-500 font-medium tracking-wide mb-1">Teacher observations</div>
                <ul className="list-disc pl-5 text-sm text-slate-700 space-y-0.5">
                  {myObs.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Marks & attendance">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Attendance" value={`${student.f.attendance_pct ?? "—"}%`} />
              <Stat label="Last 30 days" value={`${student.f.recent_attendance_pct ?? "—"}%`} />
              <Stat label="Δ vs overall" value={`${student.f.attendance_delta_30d ?? 0}pp`} tone={(student.f.attendance_delta_30d ?? 0) < -10 ? "bad" : "neutral"} />
              <Stat label="Longest streak" value={`${student.f.longest_absence_streak} d`} />
              <Stat label="Avg marks" value={`${student.f.overall_marks ?? "—"}`} />
              <Stat label="Marks trend" value={`${student.f.marks_trend ?? 0}`} tone={(student.f.marks_trend ?? 0) < -25 ? "bad" : "neutral"} />
            </div>
          </Section>

          <Section title="Social / behavioural signals" right={<SyntheticBadge />}>
            {student.syn ? (
              <div className="text-sm space-y-1.5">
                {student.syn.seasonal_migration_possibility && <SignalRow label="Seasonal migration possibility" />}
                {student.syn.financial_stress && <SignalRow label="Household financial stress" />}
                {student.syn.child_labour_concern && <SignalRow label="Child labour concern" tone="red" />}
                {student.syn.early_marriage_concern && <SignalRow label="Early marriage vulnerability" tone="red" />}
                {student.syn.behavioural_disengagement && <SignalRow label="Behavioural disengagement" />}
                {student.syn.transport_difficulty && <SignalRow label="Transport difficulty" />}
                {student.syn.disability_support_need && <SignalRow label="Disability support need" />}
                <div className="text-slate-600">Parent engagement: <b>{student.syn.parent_engagement}</b></div>
                <div className="text-slate-600">Household support: <b>{student.syn.household_support_level}</b></div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No signals captured.</div>
            )}
          </Section>

          <Section title="Escalation status">
            <div className="text-sm">
              <Tag color={student.esc === "None" ? "slate" : "orange"}>{student.esc}</Tag>
              <div className="text-slate-500 mt-2">Pending: {student.pending} days</div>
            </div>
          </Section>
        </div>
      </div>

      {showAction && <ActionDialog student={student} onClose={() => setShowAction(false)} />}
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "bad" }) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-500 tracking-wide">{label}</div>
      <div className={`font-semibold ${tone === "bad" ? "text-red-700" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}

function SignalRow({ label, tone = "amber" }: { label: string; tone?: "amber" | "red" }) {
  return (
    <div className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${tone === "red" ? "bg-red-500" : "bg-amber-500"}`} />{label}</div>
  );
}
