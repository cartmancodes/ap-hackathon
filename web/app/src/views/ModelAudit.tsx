import { useAppData } from "../data";
import { KPI, Section, Tag } from "../components/UI";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

export function ModelAudit() {
  const { data } = useAppData();
  if (!data) return null;
  const { audit, meta } = data;

  const byGender = Object.entries(audit.by_gender).map(([k, v]) => ({ k, ...v }));
  const byCaste = Object.entries(audit.by_caste).map(([k, v]) => ({ k, ...v }));

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Model audit & fairness</h1>
      <p className="text-sm text-slate-600 mb-4 max-w-3xl">
        We use a transparent rules-based interpretable risk score with weighted, named drivers — no black-box model.
        Every score is explainable, every driver is named, and the audit below shows how the score actually performs against confirmed 23-24 dropouts.
        Performance is evaluated honestly on the ~25,000 sampled students (not just the visible Watch+ cohort).
      </p>

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <KPI label="Sample size" value={audit.rows_total.toLocaleString()} />
        <KPI label="Confirmed dropouts in sample" value={audit.actual_dropouts_in_sample.toLocaleString()} />
        <KPI label="Top-10% precision" value={`${(audit.top_10pct_precision * 100).toFixed(1)}%`} sub="of top 10%, fraction who actually dropped out" tone="good" />
        <KPI label="Top-10% capture rate" value={`${(audit.top_10pct_capture_rate * 100).toFixed(1)}%`} sub="of all dropouts captured in top 10%" />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Section title="Score separation" sub="Average risk score by actual outcome">
          <div className="text-sm text-slate-700 space-y-1">
            <div className="flex justify-between"><span>Avg risk — actual dropouts</span><b className="text-red-700">{audit.avg_risk_dropouts.toFixed(1)}</b></div>
            <div className="flex justify-between"><span>Avg risk — non-dropouts</span><b className="text-emerald-700">{audit.avg_risk_non_dropouts.toFixed(1)}</b></div>
            <div className="flex justify-between"><span>Δ separation</span><b>{(audit.avg_risk_dropouts - audit.avg_risk_non_dropouts).toFixed(1)} pts</b></div>
          </div>
          <div className="text-xs text-slate-500 mt-2">A larger gap = the score discriminates dropouts from non-dropouts more cleanly.</div>
        </Section>

        <Section title="Top-decile capture (recall)" sub="Fraction of dropouts captured in top N%">
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span>Top 10%</span><b>{(audit.top_10pct_capture_rate * 100).toFixed(1)}%</b></div>
            <div className="flex justify-between"><span>Top 20%</span><b>{(audit.top_20pct_capture_rate * 100).toFixed(1)}%</b></div>
            <div className="flex justify-between"><span>Top 10% precision</span><b>{(audit.top_10pct_precision * 100).toFixed(1)}%</b></div>
            <div className="flex justify-between"><span>Top 20% precision</span><b>{(audit.top_20pct_precision * 100).toFixed(1)}%</b></div>
          </div>
        </Section>

        <Section title="Improvement plan" sub="What strengthens the model over time">
          <ul className="text-sm list-disc pl-5 space-y-1 text-slate-700">
            <li>Add LEAP teacher observations (real behavioural data)</li>
            <li>Connect welfare / scholarship / transport data</li>
            <li>Capture intervention outcomes to learn what works</li>
            <li>Periodic retraining on rolling-quarter dropout labels</li>
            <li>Track model drift and fairness metrics in this section</li>
          </ul>
        </Section>
      </div>

      <Section title="Fairness — by gender" sub="Dropout rate and average risk by gender; the model should not over-flag any group">
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

      <Section title="Fairness — by caste / social category" sub="Watch for systematic over-flagging of any category">
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
                  <td className="table-td">{r.avg_risk.toFixed(1)}{overflag > 1.5 && <Tag color="amber">watch over-flagging</Tag>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="text-xs text-slate-500 mt-2">Where avg-risk significantly exceeds the actual dropout rate, the system flags it for human review of weighting and drivers.</div>
      </Section>

      <Section title="Model drivers (named, no SHAP)" sub="The system never shows 'SHAP value' to a teacher; technical detail lives only here">
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">From real data</div>
            <ul className="list-disc pl-5 text-slate-700 space-y-0.5">
              <li>low_attendance (weight up to 35)</li>
              <li>recent_decline / Δ vs overall (up to 18)</li>
              <li>longest_absence_streak (up to 14)</li>
              <li>repeated_absence_clusters (up to 6)</li>
              <li>low_marks (up to 10)</li>
              <li>marks_decline (up to 8)</li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Synthetic / future LEAP</div>
            <ul className="list-disc pl-5 text-slate-700 space-y-0.5">
              <li>seasonal_migration_possibility (up to 6)</li>
              <li>financial_stress (up to 5)</li>
              <li>child_labour (up to 7)</li>
              <li>early_marriage (up to 8)</li>
              <li>behavioural_disengagement (up to 4)</li>
              <li>transport_difficulty (up to 3)</li>
              <li>parent_engagement_low (up to 3)</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Provenance" sub="Real vs synthetic vs future">
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <Block title="Real (uploaded)" tone="emerald">{meta.data_provenance.real_from_uploaded_data}</Block>
          <Block title="Synthetic for demo" tone="violet">{meta.data_provenance.synthetic_for_demo_only}</Block>
          <Block title="Future integration" tone="blue">{meta.data_provenance.future_integration_ready}</Block>
        </div>
        <div className="text-xs text-slate-500 mt-3">{meta.data_provenance.note_on_data}</div>
      </Section>
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
