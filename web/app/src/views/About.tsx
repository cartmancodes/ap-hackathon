import { Section, Tag } from "../components/UI";
import { useAppData } from "../data";
import { useUI } from "../store";
import { kindMeta } from "../components/DataPoint";
import { useState, useMemo } from "react";
import { Search as SearchIcon } from "lucide-react";

export function About() {
  const { data } = useAppData();
  const [tab, setTab] = useState<"narrative" | "observability">("observability");
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Stay-In School — Student Retention Intelligence</h1>
      <p className="text-sm text-slate-700 max-w-3xl mb-4">
        From early warning to verified action — the system helps every level of the department know
        <b> where dropout risk is rising, why it is rising, who must act, and whether the action worked.</b>
      </p>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("observability")} className={`px-3 py-1.5 rounded-lg text-sm ${tab === "observability" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>Data observability</button>
        <button onClick={() => setTab("narrative")} className={`px-3 py-1.5 rounded-lg text-sm ${tab === "narrative" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>Demo narrative</button>
      </div>

      {tab === "observability" && data && <Observability />}
      {tab === "narrative" && <Narrative />}
    </div>
  );
}

function Observability() {
  const { data } = useAppData();
  const { showProvenance, toggleProvenance } = useUI();
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("");
  const points = data?.catalog?.points || {};

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of Object.values(points)) c[p.kind] = (c[p.kind] || 0) + 1;
    return c;
  }, [points]);

  const rows = useMemo(() => {
    return Object.entries(points)
      .filter(([k, p]) =>
        (!kindFilter || p.kind === kindFilter) &&
        (q.length === 0 ||
          k.toLowerCase().includes(q.toLowerCase()) ||
          p.label.toLowerCase().includes(q.toLowerCase()) ||
          p.source.toLowerCase().includes(q.toLowerCase()))
      )
      .sort(([, a], [, b]) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
  }, [points, q, kindFilter]);

  if (!data) return null;
  return (
    <div>
      <Section title="Data-point catalog" sub={`${Object.keys(points).length} observable data points across the prototype — every metric you see in the UI traces back to a row here.`}>
        <div className="grid md:grid-cols-7 gap-2 mb-3 text-xs">
          {Object.entries(counts).map(([k, n]) => {
            const m = kindMeta(k);
            return (
              <button key={k} onClick={() => setKindFilter(kindFilter === k ? "" : k)} className={`rounded-lg px-2 py-1.5 ring-1 ${m.chip} flex items-center justify-between ${kindFilter === k ? "ring-2 ring-offset-1" : ""}`}>
                <span className="flex items-center gap-1">{m.icon}<span className="capitalize">{k.replace("_", " ")}</span></span>
                <b>{n}</b>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <SearchIcon className="w-4 h-4 absolute left-2 top-2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search data points — by label, key, or source" className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200" />
          </div>
          <button onClick={toggleProvenance} className={`text-xs px-3 py-1.5 rounded-lg ${showProvenance ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>
            {showProvenance ? "Hide all-metric provenance" : "Show all-metric provenance"}
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="table-th">Key</th>
              <th className="table-th">Label</th>
              <th className="table-th">Kind</th>
              <th className="table-th">Source</th>
              <th className="table-th">Formula</th>
              <th className="table-th">Unit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, p]) => {
              const m = kindMeta(p.kind);
              return (
                <tr key={k} className="hover:bg-slate-50">
                  <td className="table-td font-mono text-xs">{k}</td>
                  <td className="table-td">{p.label}</td>
                  <td className="table-td"><span className={`pill ring-1 ${m.chip}`}>{m.icon}{p.kind.replace("_", " ")}</span></td>
                  <td className="table-td text-xs text-slate-600">{p.source}</td>
                  <td className="table-td text-xs text-slate-500">{p.formula ?? "—"}</td>
                  <td className="table-td text-xs">{p.unit ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Anonymisation & PDPB alignment" sub="See docs/access_matrix.md for the full role-based access matrix">
        <div className="text-sm text-slate-700 space-y-1">
          <div>ID scheme: <code className="bg-slate-100 px-1 rounded">{data.meta.anonymisation?.id_scheme}</code></div>
          <div>Salt rotation: <code className="bg-slate-100 px-1 rounded">{data.meta.anonymisation?.salt}</code></div>
          <div>Name display: {data.meta.anonymisation?.name_display}</div>
          <div className="text-xs text-slate-500 mt-2"><Tag color="emerald">audit trail</Tag> every reveal, every action, and every counsellor send is recorded.</div>
        </div>
      </Section>
    </div>
  );
}

function Narrative() {
  return (
    <>
      <Section title="Demo narrative">
        <ol className="list-decimal pl-5 text-sm space-y-1.5 text-slate-800">
          <li><b>State officer logs in</b> → sees which districts need attention, which improved or worsened, and which have low intervention completion. Issues a directive or schedules a review.</li>
          <li><b>District officer drills down</b> → sees which mandals and schools are pending, assigns tasks, monitors action completion.</li>
          <li><b>Mandal officer (MEO)</b> sees school-level risk queue, home-visit queue, and overdue actions ageing 3 / 7 / 14 days. Escalates stale items.</li>
          <li><b>Headmaster</b> sees today's student action queue, class-wise risk, sudden attendance drops, and academic decline. Reviews recoverable students.</li>
          <li><b>Class teacher</b> sees 5–10 priority students with plain reasons, one-tap parent SMS / call / mark-action-done. Telugu / English toggle. No stigmatising labels.</li>
          <li><b>Counsellor Assist</b> generates the SMS, conversation guide, and remediation plan for a flagged student in seconds.</li>
          <li><b>Hyper-early</b> tab flags students from weeks 1–8 of school, before any marks exist — opening a 6-month action window.</li>
          <li><b>Forecast</b> tab projects high-risk count 30 / 60 days ahead per district, flagging schools "likely to deteriorate if no action is taken".</li>
          <li><b>Intervention is logged</b> → feedback row +1 → next quarterly retrain ingests it. Closed-loop learning.</li>
        </ol>
      </Section>

      <Section title="What this prototype proves">
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li>Role-aware home views answering <em>"what needs my attention today, and what action should I take?"</em></li>
          <li>Three independent estimators (rules + logistic + GBM) cross-validated; PoC criteria visible in audit.</li>
          <li>Hyper-early detection model trained only on first-8-week features.</li>
          <li>GenAI Counsellor Assist — SMS, conversation guide, remediation plan; deterministic now, LLM-swap-ready.</li>
          <li>Forecasting (Holt linear) per district with 30/60-day horizons.</li>
          <li>Closed-loop feedback simulation — every action increments the model-learning counter.</li>
          <li>End-to-end observability — every data point shown in the UI carries a provenance chip.</li>
          <li>Anonymised IDs by default; role-gated reveal with audit trail. See <code>docs/access_matrix.md</code>.</li>
        </ul>
      </Section>
    </>
  );
}
