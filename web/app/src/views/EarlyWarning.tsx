import { useMemo, useState } from "react";
import { useAppData, useDistrictStudents } from "../data";
import { useUI } from "../store";
import { KPI, Section, RiskBadge, Tag } from "../components/UI";
import { DataPoint, ProvChip } from "../components/DataPoint";
import { Clock4, Sparkles, ChevronRight } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

/**
 * Hyper-early detection view — surfaces the first-8-week model output. The
 * core promise: flag at-risk students before grades exist, while the
 * intervention window is still wide open.
 */
export function EarlyWarning() {
  const { data } = useAppData();
  const { drillTo } = useUI();
  const [pickedDistrict, setPickedDistrict] = useState<string | null>(null);
  const { students: districtStudents, loading } = useDistrictStudents(pickedDistrict || undefined);

  // Histogram of early-proba across visible students (state-level sample)
  const histo = useMemo(() => {
    if (!data) return [];
    const bins = Array(10).fill(0);
    for (const s of data.students) {
      const p = s.ml_early || 0;
      const idx = Math.min(9, Math.floor(p * 10));
      bins[idx]++;
    }
    return bins.map((v, i) => ({ bin: `${i * 10}-${i * 10 + 10}%`, students: v }));
  }, [data]);

  if (!data) return null;

  // Top districts by early-flagged count (derived from aggregate)
  const districts = [...data.districts].sort(
    (a, b) => (b.early_high_risk_count || 0) - (a.early_high_risk_count || 0)
  );

  // List shown depends on whether a district is selected
  const display = pickedDistrict
    ? (districtStudents || []).filter((s) => (s.ml_early || 0) > 0.5).sort((a, b) => (b.ml_early || 0) - (a.ml_early || 0)).slice(0, 200)
    : data.students.filter((s) => (s.ml_early || 0) > 0.5).sort((a, b) => (b.ml_early || 0) - (a.ml_early || 0)).slice(0, 50);

  return (
    <div>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Clock4 className="w-5 h-5 text-blue-600" />
            Hyper-early detection
            <ProvChip pointKey="early_proba" />
          </h1>
          <div className="text-sm text-slate-500 max-w-2xl">
            A second, narrower model trained <b>only on first-8-week attendance features</b>. Used at start-of-year, before
            FA1 marks exist, so headmasters can act while the window is widest.
            Held-out ROC-AUC: <b>{data.audit?.models?.hyper_early?.roc_auc}</b> (vs full-year GBM {data.audit?.models?.gbm?.roc_auc}).
          </div>
        </div>
        <select
          value={pickedDistrict ?? ""}
          onChange={(e) => setPickedDistrict(e.target.value || null)}
          className="text-sm rounded-lg border border-slate-200 px-3 py-1.5"
        >
          <option value="">State sample (top 50)</option>
          {data.districts.map((d) => <option key={d.district_name} value={d.district_name}>{d.district_name}</option>)}
        </select>
      </div>

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <KPI pointKey="early_proba" label="State-wide early-flagged" value={data.state.early_high_risk_total?.toLocaleString() || "—"} tone="warn" sub="Probability > 0.5 from weeks 1–8 only" />
        <KPI pointKey="early_proba" label="Model ROC-AUC (held-out)" value={`${(data.audit?.models?.hyper_early?.roc_auc ?? 0).toFixed(3)}`} sub="5-fold cross-validation" />
        <KPI pointKey="early_proba" label="Top-10% precision" value={`${((data.audit?.models?.hyper_early?.top10?.precision ?? 0) * 100).toFixed(0)}%`} sub="of flagged, fraction who dropped" tone="good" />
        <KPI pointKey="early_proba" label="Top-20% recall" value={`${((data.audit?.models?.hyper_early?.top20?.recall ?? 0) * 100).toFixed(0)}%`} sub="of dropouts captured" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Section title={`Flagged students ${pickedDistrict ? `· ${pickedDistrict}` : "(state sample)"}`} sub="Sorted by hyper-early probability — drill in to see weeks 1–8 contributions">
            {loading && <div className="text-sm text-blue-600">Loading district bundle…</div>}
            <ul className="divide-y divide-slate-100">
              {display.map((s) => (
                <li key={s.id} className="py-2.5 flex items-center gap-3 hover:bg-slate-50 px-1 rounded-md cursor-pointer"
                  onClick={() => drillTo({ district: s.district, mandal: s.mandal, udise: s.udise, studentId: s.id })}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{s.name}</span>
                      <span className="text-xs text-slate-500">{s.school_name}</span>
                      <RiskBadge tier={s.tier} />
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      First-8wk attendance <b>{s.first8?.first8_attendance_pct ?? "—"}%</b>
                      · {s.mandal}, {s.district}
                      {s.first8?.first8_late_joiners && <Tag color="amber">late joiner</Tag>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-indigo-700">{Math.round(((s.ml_early || 0) * 100))}%</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">early proba</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </li>
              ))}
              {display.length === 0 && <li className="py-6 text-sm text-slate-500 text-center">No students above the 50% early-probability cutoff.</li>}
            </ul>
          </Section>

          <Section title="Distribution of early-warning probability" sub="State-sample (top-1500) histogram of P(dropout | weeks 1–8 features)">
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={histo}>
                  <CartesianGrid stroke="#f1f5f9" />
                  <XAxis dataKey="bin" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="students" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>

        <div>
          <Section title="Districts ranked by early-flagged count" sub="State officers should escalate the top of this list">
            <ul className="text-sm space-y-1.5">
              {districts.slice(0, 15).map((d) => (
                <li key={d.district_name} className="flex justify-between hover:bg-slate-50 cursor-pointer rounded-md px-1"
                  onClick={() => { setPickedDistrict(d.district_name); }}>
                  <span>{d.district_name}</span>
                  <span className="text-xs text-indigo-700">{d.early_high_risk_count ?? 0}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="What this gives you">
            <ul className="text-sm list-disc pl-5 space-y-1 text-slate-700">
              <li><Sparkles className="inline w-3.5 h-3.5 text-amber-500 mr-1" />Action window opens in <b>Week 9</b>, not after SA1 in February.</li>
              <li>Surfaces "late joiners" — students who never settled into the academic year.</li>
              <li>Uses <b>only attendance</b>; marks, FA/SA aren't required.</li>
              <li>Per-student weeks-1–8 contributions visible inside Student Detail.</li>
            </ul>
          </Section>

          <DataPoint pointKey="first8_attendance_pct" label="Weeks 1–8 attendance" value="from features.parquet" sub="proxy when raw CSV is absent — see catalog.json" />
        </div>
      </div>
    </div>
  );
}
