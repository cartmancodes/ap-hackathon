import { useMemo } from "react";
import { useAppData } from "../data";
import { useUI } from "../store";
import { KPI, Section, Tag } from "../components/UI";
import { ProvChip } from "../components/DataPoint";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { TrendingUp, AlertTriangle } from "lucide-react";

/**
 * Forecast view — short-horizon (30/60 day) projections of high-risk count
 * per district, using a Holt linear pass over a synthesised 4-week series.
 */
export function Forecast() {
  const { data } = useAppData();
  const { drillTo } = useUI();

  // Hooks first — never below conditional returns.
  const forecast = data?.forecast;
  const stateSeries = useMemo(() => {
    if (!forecast) return [];
    const len = 4;
    const summed = Array(len).fill(0);
    for (const d of forecast.districts) for (let i = 0; i < len; i++) summed[i] += d.series_weekly_high_risk[i] || 0;
    const slopeSum = forecast.districts.reduce((s, d) => s + d.slope_per_week, 0);
    const future = [];
    for (let i = 1; i <= 8; i++) future.push(Math.max(0, Math.round(summed[len - 1] + slopeSum * i)));
    return [
      ...summed.map((v, i) => ({ week: `W-${4 - i}`, actual: v, projected: null as number | null })),
      ...future.map((v, i) => ({ week: `W+${i + 1}`, actual: null as number | null, projected: v })),
    ];
  }, [forecast]);

  if (!data || !forecast) return null;

  // Aggregate state-level projection: sum of district projections
  const stateProj30 = forecast.districts.reduce((s, d) => s + d.projection_30d, 0);
  const stateProj60 = forecast.districts.reduce((s, d) => s + d.projection_60d, 0);
  const stateCurrent = forecast.districts.reduce((s, d) => s + d.series_weekly_high_risk[d.series_weekly_high_risk.length - 1], 0);
  const top20 = forecast.top_deteriorating;

  return (
    <div>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Forecast — schools likely to deteriorate
            <ProvChip pointKey="forecast_projection_30d" />
          </h1>
          <div className="text-sm text-slate-500 max-w-3xl">
            {forecast.method}. Districts are ranked by week-on-week slope of the high-risk count. Use this view
            to identify <b>where action is needed before the trend confirms</b>.
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <KPI label="Current high-risk (state)" value={stateCurrent.toLocaleString()} pointKey="rules_risk_score" />
        <KPI label="Projected — 30 days" value={stateProj30.toLocaleString()} sub={`${stateProj30 > stateCurrent ? "+" : ""}${(stateProj30 - stateCurrent).toLocaleString()} vs today`} tone={stateProj30 > stateCurrent ? "bad" : "good"} pointKey="forecast_projection_30d" />
        <KPI label="Projected — 60 days" value={stateProj60.toLocaleString()} sub={`${stateProj60 > stateCurrent ? "+" : ""}${(stateProj60 - stateCurrent).toLocaleString()} vs today`} tone={stateProj60 > stateCurrent ? "bad" : "good"} pointKey="forecast_projection_60d" />
        <KPI label="Districts deteriorating" value={top20.length} sub={`top ${Math.min(20, top20.length)} on slope`} tone={top20.length > 0 ? "warn" : "neutral"} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Section title="State-level projection" sub="4 historical weeks (filled) + 8 projected weeks (dashed)">
            <div style={{ height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={stateSeries}>
                  <CartesianGrid stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <ReferenceLine x="W-0" stroke="#94a3b8" />
                  <Line type="monotone" dataKey="actual" stroke="#1f2937" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="projected" stroke="#2563eb" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="Districts likely to deteriorate" sub="Sorted by week-on-week slope of high-risk count">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">District</th>
                  <th className="table-th">Current</th>
                  <th className="table-th">+30d</th>
                  <th className="table-th">+60d</th>
                  <th className="table-th">Slope / week</th>
                </tr>
              </thead>
              <tbody>
                {top20.map((f) => (
                  <tr key={f.district} className="hover:bg-slate-50 cursor-pointer" onClick={() => drillTo({ district: f.district })}>
                    <td className="table-td font-medium">{f.district}</td>
                    <td className="table-td">{f.series_weekly_high_risk[f.series_weekly_high_risk.length - 1]}</td>
                    <td className="table-td">{f.projection_30d}</td>
                    <td className="table-td">{f.projection_60d}</td>
                    <td className="table-td">{f.slope_per_week > 0 ? <Tag color="red">+{f.slope_per_week.toFixed(2)}</Tag> : <Tag color="emerald">{f.slope_per_week.toFixed(2)}</Tag>}</td>
                  </tr>
                ))}
                {top20.length === 0 && <tr><td className="table-td text-slate-500" colSpan={5}>No districts currently deteriorating.</td></tr>}
              </tbody>
            </table>
          </Section>
        </div>

        <div>
          <Section title="How this is computed" pointKey="forecast_projection_30d">
            <ol className="text-sm list-decimal pl-5 space-y-1 text-slate-700">
              <li>Take the last 4 weekly snapshots of high-risk count per district (synthesised here).</li>
              <li>Fit a Holt linear model (α=0.5, β=0.4) to extract level + trend.</li>
              <li>Project level + 4·trend (30 days) and level + 8·trend (60 days).</li>
              <li>Flag district as "deteriorating" when trend &gt; 1 student/week.</li>
            </ol>
          </Section>

          <Section title="What to do with this">
            <ul className="text-sm space-y-1.5 list-disc pl-5 text-slate-700">
              <li><AlertTriangle className="w-3.5 h-3.5 text-orange-500 inline mr-1" />Schedule district reviews for the top-5 deteriorating districts this week.</li>
              <li>Cross-reference with the <b>Hyper-early</b> tab — if both flag the same district, it's a strong signal.</li>
              <li>Tighten action completion% target in the next month for those districts.</li>
              <li>Use scenario planning on the State tab to size interventions.</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
