import { useState } from "react";
import type { Student } from "../types";
import { useUI } from "../store";
import { RiskBadge, Section, SyntheticBadge, Tag, ProgressBar } from "./UI";
import { ProvChip, ObservableValue, SensitiveBadge } from "./DataPoint";
import { ActionDialog } from "./ActionDialog";
import { driverLabels } from "../util";
import { ArrowLeft, ArrowUpRight, Phone, MessageSquare, Eye, EyeOff, Cpu, BookOpen, Activity, Heart } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Cell } from "recharts";

/**
 * Reworked LEAP-native student detail. Layout mirrors the LEAP app sections —
 * Profile, Attendance, Marks, Entitlements, Action — and overlays our risk /
 * drivers / recoverability / counsellor-assist sections on top.
 */
export function StudentDetail({ student, supportiveLanguage = false }: { student: Student; supportiveLanguage?: boolean }) {
  const { back, actionLog, studentObservations, role, revealedIds, reveal } = useUI();
  const [showAction, setShowAction] = useState(false);

  const myActions = actionLog.filter((a) => a.studentId === student.id);
  const myObs = studentObservations[student.id] || [];
  const revealed = revealedIds.has(student.id);

  // Anonymisation: by default, role "state" sees anon ID + first name only;
  // mandal/headmaster/teacher have a click-to-reveal real name interaction.
  // (Audit-trail compliant — every reveal is recorded in the store.)
  const canReveal = role !== "state";
  const displayName = revealed || role === "teacher" || role === "headmaster" ? student.name : `${student.anon_id || student.id} · ${student.name.split(" ")[0]}`;

  return (
    <div>
      <button onClick={back} className="btn-ghost text-sm mb-2"><ArrowLeft className="w-4 h-4" /> Back</button>

      {/* PROFILE (LEAP layout) */}
      <div className="card p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              Student · Anon ID <b>{student.anon_id || `S${student.id}`}</b>
              <ProvChip pointKey="anon_id" />
              <SensitiveBadge reason="Real CHILD_SNO is hashed; reveal is role-gated and audited." />
            </div>
            <div className="text-2xl font-semibold mt-1 flex items-center gap-2">
              {displayName}
              {canReveal && (
                <button onClick={() => reveal(student.id)} className="text-xs px-2 py-0.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1">
                  {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {revealed ? "Hide name" : "Reveal name"}
                </button>
              )}
            </div>
            <div className="text-sm text-slate-600 mt-1">
              Class {student.class}-{student.section} · {student.gender} · {student.caste}
              <br />
              {student.school_name} · {student.mandal}, {student.district}
            </div>
            <div className="text-[11px] text-slate-500 mt-2 flex flex-wrap gap-x-3 gap-y-1">
              <span>UDISE <ObservableValue pointKey="udise_code"><b>{student.udise}</b></ObservableValue></span>
              <span>Admission no. <b>—</b> <Tag color="violet">awaiting LEAP</Tag></span>
              <span>DOB <b>—</b> <Tag color="violet">awaiting LEAP</Tag></span>
              <span>Blood group <b>—</b> <Tag color="violet">awaiting LEAP</Tag></span>
              <span>BMI <b>—</b> <Tag color="violet">awaiting LEAP</Tag></span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <RiskBadge tier={student.tier} supportive={supportiveLanguage} />
            <Tag color={student.rec.startsWith("High") ? "emerald" : student.rec.startsWith("Medium") ? "amber" : "slate"}>
              {student.rec}
            </Tag>
            <div className="text-xs text-slate-500">Rules score <b>{student.risk}</b> · Blended <b>{student.ml_blend ?? "—"}</b></div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          {/* WHY FLAGGED — combine rule drivers + linear ML contributions */}
          <Section title="Why flagged" sub="Rule drivers (named, weighted) + logistic model contributions">
            <div className="space-y-2 mb-3">
              {(student.drv || []).map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="text-xs text-slate-500 w-44">{driverLabels[d.key] || d.key}</div>
                  <div className="flex-1"><ProgressBar value={d.weight} max={35} tone={d.weight >= 18 ? "red" : d.weight >= 10 ? "amber" : "blue"} /></div>
                  <div className="text-xs text-slate-700 w-72">{d.label}</div>
                </div>
              ))}
              {(!student.drv || student.drv.length === 0) && <div className="text-sm text-slate-500">No active rule drivers — student is currently stable.</div>}
            </div>

            {student.log_contrib && student.log_contrib.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-2 flex items-center gap-2">
                  <Cpu className="w-3 h-3" /> Logistic model — local contributions <ProvChip pointKey="logistic_proba" />
                </div>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer>
                    <BarChart data={student.log_contrib} layout="vertical" margin={{ top: 4, left: 8, right: 8, bottom: 4 }}>
                      <CartesianGrid stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={180} />
                      <Tooltip />
                      <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
                        {student.log_contrib.map((d, i) => <Cell key={i} fill={d.contribution >= 0 ? "#ef4444" : "#10b981"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-[10px] text-slate-500">Positive (red) pushes risk up; negative (green) pulls it down. Computed as coef × standardised value.</div>
              </div>
            )}
          </Section>

          {/* HYPER-EARLY contributions */}
          {student.first8 && (
            <Section title="Hyper-early signal (weeks 1–8)" sub={`First-8wk attendance ${student.first8.first8_attendance_pct}% · proba ${(student.ml_early ?? 0).toFixed(2)}`} pointKey="early_proba">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Stat pointKey="first8_attendance_pct" label="Weeks 1–8 attendance" value={`${student.first8.first8_attendance_pct}%`} />
                <Stat pointKey="first8_absent_days" label="Weeks 1–8 absent days" value={`${student.first8.first8_absent_days}`} />
                <Stat pointKey="first8_longest_streak" label="Weeks 1–8 longest streak" value={`${student.first8.first8_longest_streak} d`} />
              </div>
              {student.early_contrib && student.early_contrib.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">Per-feature contributions</div>
                  <ul className="text-xs text-slate-700 space-y-1">
                    {student.early_contrib.map((c, i) => (
                      <li key={i} className="flex justify-between"><span>{c.label}</span><span className={c.contribution >= 0 ? "text-red-700" : "text-emerald-700"}>{c.contribution}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          )}

          {/* RECOMMENDED ACTION */}
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

          {/* ACTION HISTORY */}
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
          {/* ATTENDANCE — LEAP-style */}
          <Section title="Attendance" sub="LEAP-native layout: academic-year overview" right={<Activity className="w-4 h-4 text-slate-400" />}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat pointKey="attendance_pct" label="Overall" value={`${student.f.attendance_pct ?? "—"}%`} />
              <Stat pointKey="recent_attendance_pct" label="Last 30 days" value={`${student.f.recent_attendance_pct ?? "—"}%`} />
              <Stat pointKey="attendance_delta_30d" label="Δ vs overall" value={`${student.f.attendance_delta_30d ?? 0}pp`} tone={(student.f.attendance_delta_30d ?? 0) < -10 ? "bad" : "neutral"} />
              <Stat pointKey="longest_absence_streak" label="Longest streak" value={`${student.f.longest_absence_streak} d`} />
              <Stat pointKey="absent_days" label="Days absent" value={`${student.f.absent_days ?? "—"}`} />
              <Stat pointKey="school_days" label="School days" value={`${student.f.school_days ?? "—"}`} />
            </div>
          </Section>

          {/* MARKS — FA1..SA2 */}
          <Section title="Marks (FA1–SA2)" sub="LEAP-style assessment record" right={<BookOpen className="w-4 h-4 text-slate-400" />}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat pointKey="fa_avg" label="FA average" value={`${student.f.fa_avg ?? "—"}`} />
              <Stat pointKey="sa_avg" label="SA average" value={`${student.f.sa_avg ?? "—"}`} />
              <Stat pointKey="overall_marks" label="Overall" value={`${student.f.overall_marks ?? "—"}`} />
              <Stat pointKey="marks_trend" label="Trend" value={`${student.f.marks_trend ?? 0}`} tone={(student.f.marks_trend ?? 0) < -25 ? "bad" : "neutral"} />
            </div>
          </Section>

          {/* ENTITLEMENTS (LEAP) */}
          <Section title="Entitlements" sub="LEAP shows mid-day meal, books, uniforms — awaiting LEAP API" right={<Heart className="w-4 h-4 text-slate-400" />}>
            <ul className="text-sm space-y-1.5">
              <li className="flex justify-between"><span>Mid-day meals availed</span><Tag color="violet">via LEAP</Tag></li>
              <li className="flex justify-between"><span>Textbook / uniform</span><Tag color="violet">via LEAP</Tag></li>
              <li className="flex justify-between"><span>Scholarship</span><Tag color="violet">via LEAP</Tag></li>
              <li className="flex justify-between"><span>Transport allowance</span><Tag color="violet">via LEAP</Tag></li>
            </ul>
          </Section>

          {/* SOCIAL/BEHAVIOURAL (synthetic) */}
          <Section title="Social / behavioural signals" right={<SyntheticBadge />}>
            {student.syn ? (
              <div className="text-sm space-y-1.5">
                {student.syn.seasonal_migration_possibility && <SignalRow pointKey="syn_seasonal_migration_possibility" label="Seasonal migration possibility" />}
                {student.syn.financial_stress && <SignalRow pointKey="syn_financial_stress" label="Household financial stress" />}
                {student.syn.child_labour_concern && <SignalRow pointKey="syn_child_labour_concern" label="Child labour concern" tone="red" />}
                {student.syn.early_marriage_concern && <SignalRow pointKey="syn_early_marriage_concern" label="Early marriage vulnerability" tone="red" />}
                {student.syn.behavioural_disengagement && <SignalRow pointKey="syn_behavioural_disengagement" label="Behavioural disengagement" />}
                {student.syn.transport_difficulty && <SignalRow pointKey="syn_transport_difficulty" label="Transport difficulty" />}
                {student.syn.disability_support_need && <SignalRow pointKey="syn_disability_support_need" label="Disability support need" />}
                <div className="text-slate-600">Parent engagement: <b>{student.syn.parent_engagement}</b> <ProvChip pointKey="syn_parent_engagement" /></div>
                <div className="text-slate-600">Household support: <b>{student.syn.household_support_level}</b> <ProvChip pointKey="syn_household_support_level" /></div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No signals captured.</div>
            )}
          </Section>

          {/* MODEL outputs */}
          <Section title="Model outputs" sub="Three independent estimators — full transparency">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat pointKey="rules_risk_score" label="Rules score" value={`${student.risk}`} />
              <Stat pointKey="logistic_proba" label="Logistic P" value={(student.ml_log ?? 0).toFixed(2)} />
              <Stat pointKey="gbm_proba" label="GBM P" value={(student.ml_gbm ?? 0).toFixed(2)} />
              <Stat pointKey="early_proba" label="Early P" value={(student.ml_early ?? 0).toFixed(2)} />
            </div>
            <div className="text-[10px] text-slate-500 mt-2">Blended (0.4·rules + 0.3·logistic + 0.3·GBM): <b>{student.ml_blend ?? "—"}</b></div>
          </Section>

          {/* ESCALATION */}
          <Section title="Escalation status">
            <div className="text-sm">
              <Tag color={student.esc === "None" ? "slate" : "orange"}>{student.esc || "None"}</Tag>
              <div className="text-slate-500 mt-2">Pending: {student.pending || 0} days</div>
            </div>
          </Section>
        </div>
      </div>

      {showAction && <ActionDialog student={student} onClose={() => setShowAction(false)} />}
    </div>
  );
}

function Stat({ label, value, tone = "neutral", pointKey }: { label: string; value: string; tone?: "neutral" | "bad"; pointKey?: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-500 tracking-wide flex items-center gap-1">{label}{pointKey && <ProvChip pointKey={pointKey} />}</div>
      <div className={`font-semibold ${tone === "bad" ? "text-red-700" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}

function SignalRow({ label, tone = "amber", pointKey }: { label: string; tone?: "amber" | "red"; pointKey?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full ${tone === "red" ? "bg-red-500" : "bg-amber-500"}`} />
      {label}
      {pointKey && <ProvChip pointKey={pointKey} />}
    </div>
  );
}
