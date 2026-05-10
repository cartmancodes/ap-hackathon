import { useAppData } from "../data";
import { useUI } from "../store";
import { KPI, Section, Tag, CriterionBadge } from "../components/UI";
import { DataPoint } from "../components/DataPoint";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { Cpu, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";

export function ModelAudit() {
  const { data } = useAppData();
  const { feedbackRows, lastRetrain, triggerRetrain } = useUI();
  if (!data) return null;
  const { audit, meta } = data;
  const log = audit.models.logistic;
  const gbm = audit.models.gbm;
  const early = audit.models.hyper_early;

  const byGender = Object.entries(audit.by_gender).map(([k, v]) => ({ k, ...v }));
  const byCaste = Object.entries(audit.by_caste).map(([k, v]) => ({ k, ...v }));

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Model audit & fairness</h1>
      <p className="text-sm text-slate-600 mb-4 max-w-3xl">
        Three independent estimators ship together. Logistic regression is the interpretable baseline
        (coefficients shown below); gradient boosting is the stronger non-linear estimator; hyper-early
        is a logistic trained only on first-8-week features. All metrics below are <b>5-fold cross-validated</b> —
        no train-test bias.
      </p>

      {/* POC PASS / FAIL CARD ---------------------------------------------- */}
      <Section title="Brief PoC criteria" sub="Stay-In School brief asks: inclusion error < 80%, exclusion error < 20%. Evaluated at top-20% flag cutoff.">
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { name: "Logistic", m: log },
            { name: "Gradient Boosting", m: gbm },
            { name: "Hyper-early (weeks 1–8)", m: early },
          ].map(({ name, m }) => (
            <div key={name} className="rounded-lg border border-slate-200 p-3 bg-white">
              <div className="text-xs uppercase tracking-wide text-slate-500 font-medium flex items-center gap-2"><Cpu className="w-3 h-3" />{name}</div>
              <div className="text-2xl font-semibold text-slate-900 mt-1">ROC-AUC {m.roc_auc.toFixed(3)}</div>
              <div className="text-xs text-slate-500 mt-1">PR-AUC {m.pr_auc.toFixed(3)} · top-10% precision {(m.top10.precision * 100).toFixed(0)}%</div>
              <div className="mt-3 flex flex-col gap-1">
                <CriterionBadge pass={m.poc_top20.inclusion_pass} label={`Inclusion error ${(m.poc_top20.inclusion_error * 100).toFixed(0)}% (<80%)`} />
                <CriterionBadge pass={m.poc_top20.exclusion_pass} label={`Exclusion error ${(m.poc_top20.exclusion_error * 100).toFixed(0)}% (<20%)`} />
              </div>
              <div className="text-[10px] text-slate-500 mt-2">
                TP {m.poc_top20.true_positive.toLocaleString()} · FP {m.poc_top20.false_positive.toLocaleString()} · FN {m.poc_top20.false_negative.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-500 mt-3">
          <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-amber-500" />
          Exclusion-error currently does <b>not</b> meet the brief's &lt;20% target on this sample — driven by the
          high base rate (~36% positives in the kept sample). When the full 1.4M-row dataset is processed the
          base rate falls and exclusion-error improves automatically. The frontend will continue to show pass/fail
          honestly so officers see when the model graduates the bar.
        </div>
      </Section>

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <KPI pointKey="rules_risk_score" label="Sample size" value={audit.n.toLocaleString()} />
        <KPI label="Confirmed dropouts" value={audit.dropouts.toLocaleString()} sub={`${((audit.dropouts / Math.max(1, audit.n)) * 100).toFixed(0)}% positives`} />
        <KPI pointKey="logistic_proba" label="Best top-10% precision" value={`${(Math.max(log.top10.precision, gbm.top10.precision) * 100).toFixed(0)}%`} sub="of flagged, fraction who dropped" tone="good" />
        <KPI pointKey="logistic_proba" label="Best top-20% recall" value={`${(Math.max(log.top20.recall, gbm.top20.recall) * 100).toFixed(0)}%`} sub="of dropouts captured" />
      </div>

      {/* CLOSED-LOOP FEEDBACK ---------------------------------------------- */}
      <Section title="Closed-loop feedback" sub="Every action logged in the system becomes a training row for the next quarterly retrain.">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-3xl font-semibold text-emerald-700">{feedbackRows.toLocaleString()}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">feedback rows captured</div>
          </div>
          <div className="flex flex-col text-sm">
            <span>Last retrain: <b>{lastRetrain ? new Date(lastRetrain).toLocaleString() : "—"}</b></span>
            <span className="text-xs text-slate-500">Cadence: quarterly · ingests last 90 days of action outcomes joined with attendance recovery.</span>
          </div>
          <button onClick={triggerRetrain} className="btn-primary"><RefreshCw className="w-4 h-4" /> Simulate retrain</button>
        </div>
      </Section>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Logistic coefficients" sub="Feature → standardised weight (signed)">
          {audit.logistic_coefficients ? (
            <table className="w-full text-xs">
              <thead><tr><th className="table-th">Feature</th><th className="table-th">Coefficient</th></tr></thead>
              <tbody>
                {Object.entries(audit.logistic_coefficients).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([k, v]) => (
                  <tr key={k}><td className="table-td">{k}</td><td className={`table-td ${v >= 0 ? "text-red-700" : "text-emerald-700"}`}>{v.toFixed(3)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <div className="text-sm text-slate-500">No coefficients in audit payload.</div>}
        </Section>

        <Section title="GBM feature importance" sub="Top features contributing to the tree ensemble's splits">
          {audit.feature_importance_gbm ? (
            <div style={{ height: 300 }}>
              <ResponsiveContainer>
                <BarChart layout="vertical"
                  data={Object.entries(audit.feature_importance_gbm).map(([k, v]) => ({ k, v }))}
                  margin={{ top: 4, left: 8, right: 8, bottom: 4 }}>
                  <CartesianGrid stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="k" width={200} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="v" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="text-sm text-slate-500">No importances in audit payload.</div>}
        </Section>
      </div>

      <Section title="Fairness — by gender" sub="Watch for over-flagging">
        <div style={{ height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={byGender} margin={{ top: 8, left: 8, right: 8, bottom: 8 }}>
              <CartesianGrid stroke="#f1f5f9" />
              <XAxis dataKey="k" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="dropout_rate" name="actual dropout rate" fill="#ef4444" />
              <Bar dataKey="avg_risk" name="avg risk (÷100)" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Fairness — by caste / social category">
        <table className="w-full text-sm">
          <thead><tr><th className="table-th">Category</th><th className="table-th">N</th><th className="table-th">Actual dropout rate</th><th className="table-th">Avg risk score</th></tr></thead>
          <tbody>
            {byCaste.map((r) => {
              const overflag = r.avg_risk / Math.max(1, r.dropout_rate * 100);
              return (
                <tr key={r.k}>
                  <td className="table-td font-medium">{r.k}</td>
                  <td className="table-td">{r.n.toLocaleString()}</td>
                  <td className="table-td">{(r.dropout_rate * 100).toFixed(1)}%</td>
                  <td className="table-td">{r.avg_risk.toFixed(1)} {overflag > 1.5 && <Tag color="amber">watch over-flagging</Tag>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      {audit.by_district_top_overflag && audit.by_district_top_overflag.length > 0 && (
        <Section title="Districts to scrutinise" sub="Highest avg-risk vs actual dropout rate — investigate before scaling action there">
          <ul className="text-sm space-y-1">
            {audit.by_district_top_overflag.map(([d, ratio]) => (
              <li key={d} className="flex justify-between"><span>{d}</span><span className="text-amber-700">over-flag ratio {ratio.toFixed(1)}</span></li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Anonymisation & PDPB 2023 alignment">
        <div className="text-sm text-slate-700 space-y-1.5">
          <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> All client-side IDs are hashed: <code className="text-xs bg-slate-100 px-1 rounded">{meta.anonymisation?.id_scheme || "SHA-256(salt::CHILD_SNO)[:8]"}</code></div>
          <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Real student names appear only under role-gated reveal (audit trail recorded).</div>
          <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Every automated recommendation is recorded in the action log — see <code>docs/access_matrix.md</code>.</div>
          <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Bias check matrix above is part of every release — model audit page is public.</div>
        </div>
      </Section>

      <Section title="Provenance" sub="Real vs derived vs synthetic vs future">
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <Block title="Real (uploaded)" tone="emerald">{meta.data_provenance.real_from_uploaded_data}</Block>
          <Block title="Derived from real data" tone="blue">{meta.data_provenance.derived_from_real_data}</Block>
          <Block title="Synthetic for demo" tone="violet">{meta.data_provenance.synthetic_for_demo_only}</Block>
        </div>
        <div className="text-xs text-slate-500 mt-3">{meta.data_provenance.note_on_data}</div>
      </Section>

      <DataPoint pointKey="rules_risk_score" label="Risk-score schema" value="see rules table above" sub="all 41 data points are documented in catalog.json" />
    </div>
  );
}

function Block({ title, tone, children }: { title: string; tone: "emerald" | "violet" | "blue"; children: string[] }) {
  const map = { emerald: "border-emerald-200 bg-emerald-50", violet: "border-violet-200 bg-violet-50", blue: "border-blue-200 bg-blue-50" };
  return (
    <div className={`rounded-lg border ${map[tone]} p-3`}>
      <div className="font-medium text-slate-800 mb-1">{title}</div>
      <ul className="list-disc pl-5 text-slate-700 space-y-0.5">{children.map((c, i) => <li key={i}>{c}</li>)}</ul>
    </div>
  );
}
