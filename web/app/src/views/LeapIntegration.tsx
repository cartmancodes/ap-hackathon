import { Section, Tag } from "../components/UI";
import { ArrowDown, ArrowUp } from "lucide-react";

const PULL = [
  ["student profile", "real-time", "any"],
  ["student ID, school ID", "real-time", "any"],
  ["class & section", "daily", "any"],
  ["attendance (daily marks)", "daily", "teacher writes / system reads"],
  ["marks (FA / SA)", "weekly", "teacher writes / system reads"],
  ["teacher mapping", "daily", "any"],
  ["school details (UDISE, location)", "monthly", "any"],
  ["parent contact", "monthly", "headmaster, mandal"],
  ["entitlement / scheme data", "weekly", "mandal, district, state"],
  ["transport / scholarship indicators", "weekly", "mandal, district, state"],
];

const PUSH = [
  ["risk score / support priority", "on-write", "system → LEAP"],
  ["recommended action", "on-write", "system → LEAP teacher app"],
  ["teacher action queue", "on-write", "system → LEAP teacher app"],
  ["parent communication trigger", "on-write", "system → LEAP parent module"],
  ["intervention status (open / closed / outcome)", "on-write", "system → LEAP"],
  ["teacher observations", "on-write", "system → LEAP"],
  ["behavioural / social indicators (synthetic today)", "on-write", "system → LEAP welfare modules"],
  ["escalation status (chain of accountability)", "on-write", "system → LEAP governance"],
  ["intervention outcome", "on-close", "system → LEAP analytics"],
];

export function LeapIntegration() {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">LEAP integration concept</h1>
      <p className="text-sm text-slate-600 mb-4 max-w-3xl">
        We do not have official LEAP API documentation, so this prototype is built as <b>LEAP-compatible</b>, not falsely LEAP-integrated.
        Below is what the system would <i>pull</i> from LEAP and what it would <i>push back</i> when integrated. Endpoint names are illustrative.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="What we pull from LEAP" sub="Inputs to the risk engine">
          <FlowTable rows={PULL} dir="in" />
        </Section>
        <Section title="What we push back to LEAP" sub="Outputs from the system">
          <FlowTable rows={PUSH} dir="out" />
        </Section>
      </div>

      <Section title="Illustrative API surface" sub="Marked illustrative — not real endpoints">
        <pre className="text-xs bg-slate-900 text-slate-100 rounded-lg p-4 overflow-auto leading-relaxed">{`# Illustrative only — not real LEAP endpoints

GET  /leap/v1/students?school_id={udise}
     -> [{ student_id, name, class, section, gender, ... }]

GET  /leap/v1/attendance?student_id={id}&from=2024-06-12
     -> [{ date, status: "P"|"A"|"H" }]

GET  /leap/v1/marks?student_id={id}
     -> [{ assessment: "FA1", subject, marks }]

POST /leap/v1/risk_signal
     <- { student_id, risk_score, tier, drivers[], recommended_action }

POST /leap/v1/intervention
     <- { student_id, action, owner_role, status, outcome, escalation_status }

POST /leap/v1/teacher_observation
     <- { student_id, observation_text, flags[] }`}</pre>
      </Section>

      <Section title="Sync model & privacy" sub="How data flows and who can see what">
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <Tile title="Sync cadence">
            <ul className="list-disc pl-5 text-slate-700 space-y-0.5">
              <li>Attendance: daily after class register close</li>
              <li>Marks: weekly after assessment</li>
              <li>Risk signal: re-computed nightly + on-update</li>
              <li>Intervention status: on-write</li>
            </ul>
          </Tile>
          <Tile title="Role-based access">
            <ul className="list-disc pl-5 text-slate-700 space-y-0.5">
              <li>Teacher → only own class</li>
              <li>Headmaster → only own school</li>
              <li>Mandal → only own mandal</li>
              <li>District → only own district</li>
              <li>State → all districts (anonymised drill)</li>
            </ul>
          </Tile>
          <Tile title="Privacy guarantees">
            <ul className="list-disc pl-5 text-slate-700 space-y-0.5">
              <li>No risk labels exposed to parents or students</li>
              <li>Audit trail for every automated recommendation</li>
              <li>Bias checks across gender / caste / geography</li>
              <li>Teacher remains final decision-maker</li>
              <li>Anonymised analytics at state level</li>
            </ul>
          </Tile>
        </div>
      </Section>
    </div>
  );
}

function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-3">
      <div className="text-xs uppercase font-semibold text-slate-500 tracking-wide mb-2">{title}</div>
      {children}
    </div>
  );
}

function FlowTable({ rows, dir }: { rows: string[][]; dir: "in" | "out" }) {
  return (
    <table className="w-full text-sm">
      <thead><tr><th className="table-th">Field</th><th className="table-th">Cadence</th><th className="table-th">Visibility</th></tr></thead>
      <tbody>
        {rows.map(([f, c, v]) => (
          <tr key={f}>
            <td className="table-td flex items-center gap-2">{dir === "in" ? <ArrowDown className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowUp className="w-3.5 h-3.5 text-blue-600" />}{f}</td>
            <td className="table-td"><Tag color="slate">{c}</Tag></td>
            <td className="table-td text-slate-600">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
