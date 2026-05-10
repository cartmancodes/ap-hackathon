import { Section } from "../components/UI";

export function About() {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Stay-In School — Student Retention Intelligence</h1>
      <p className="text-sm text-slate-700 max-w-3xl mb-4">
        From early warning to verified action — the system helps every level of the department know
        <b> where dropout risk is rising, why it is rising, who must act, and whether the action worked.</b>
      </p>

      <Section title="Demo narrative">
        <ol className="list-decimal pl-5 text-sm space-y-1.5 text-slate-800">
          <li><b>State officer logs in</b> → sees which districts need attention, which improved or worsened, and which districts have low intervention completion. Issues a directive or schedules a review.</li>
          <li><b>District officer drills down</b> → sees which mandals and schools are pending, assigns tasks to mandal officers, monitors action completion.</li>
          <li><b>Mandal officer (MEO)</b> sees school-level risk queue, home visit queue, and overdue actions ageing 3 / 7 / 14 days. Can escalate stale items to the district officer.</li>
          <li><b>Headmaster</b> sees today's student action queue, class-wise risk, sudden attendance drops, and academic decline. Can view recoverable students.</li>
          <li><b>Class teacher</b> sees 5–10 priority students with plain reasons (e.g. "Attendance dropped 12pp in last 30 days"), one-tap parent SMS / call / mark-action-done. Telugu / English toggle. No stigmatising labels.</li>
          <li><b>Intervention is logged</b> with action, owner, date, outcome. The system tracks whether attendance recovered.</li>
          <li><b>Unresolved cases escalate</b>: teacher → headmaster → mandal → district → state. Every level sees the chain of accountability.</li>
          <li><b>Over time</b>, the model learns which interventions work for which student profiles, recalibrates monthly, and reports drift and fairness publicly in the audit panel.</li>
        </ol>
      </Section>

      <Section title="What this prototype proves">
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li>Role-aware home views — every login answers <em>"what needs my attention today, and what action should I take?"</em></li>
          <li>Drill-down without losing context (state → district → mandal → school → class → student)</li>
          <li>Explainable risk score with named drivers (no black box, no SHAP value shown to officers)</li>
          <li>Recoverability layer — to focus limited manpower on highest-impact cases</li>
          <li>Action queue with owner, due date, status, escalation rule, and outcome capture</li>
          <li>Closed-loop parent engagement (synthetic for now; LEAP-ready)</li>
          <li>Telugu / English toggle, supportive (non-stigmatising) wording on teacher-facing surfaces</li>
          <li>Fairness audit by gender and caste category</li>
          <li>LEAP integration concept — what is pulled, what is pushed, with role-based access and privacy guarantees</li>
        </ul>
      </Section>

      <Section title="What is NOT shown (and why)">
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li>A 2024-25 full-data analysis — the 24-25 file is dropout IDs only, not full student records. We don't fabricate.</li>
          <li>Real LEAP API endpoints — we don't have public docs. The integration concept is illustrative.</li>
          <li>Risk labels to parents or students — by design (dignity).</li>
          <li>Black-box ML. Drivers are named; weights are visible in the audit panel.</li>
        </ul>
      </Section>
    </div>
  );
}
