import { useMemo, useState } from "react";
import { useAppData, useCounsellorBundle } from "../data";
import { useUI } from "../store";
import { Section, RiskBadge, Tag } from "../components/UI";
import { ProvChip } from "../components/DataPoint";
import { MessageSquare, Sparkles, AlertTriangle, BookOpen, Copy } from "lucide-react";
import type { CounsellorArtefact } from "../types";

/**
 * GenAI Counsellor Assist — renders three deterministic-but-LLM-shaped
 * artefacts per student: parent SMS, conversation guide, remediation plan.
 */
export function Counsellor() {
  const { data } = useAppData();
  const { lang } = useUI();
  const [district, setDistrict] = useState<string | null>(null);
  const { data: bundle, loading } = useCounsellorBundle(district || undefined);
  const [pickedId, setPickedId] = useState<number | null>(null);

  const list: CounsellorArtefact[] = useMemo(() => {
    if (!bundle) return [];
    return [...bundle].sort((a, b) => b.risk - a.risk);
  }, [bundle]);

  if (!data) return null;

  const picked = list.find((s) => s.id === pickedId) || list[0];

  return (
    <div>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            Counsellor Assist
          </h1>
          <div className="text-sm text-slate-500 max-w-2xl">
            Three artefacts per flagged student: a 160-char supportive parent SMS, a 5–8 point conversation guide
            keyed to that student's risk drivers, and a 4-week remediation plan. Templates are deterministic now;
            swap in a prompted LLM call when an API key is available.
          </div>
        </div>
        <select value={district ?? ""} onChange={(e) => { setDistrict(e.target.value || null); setPickedId(null); }} className="text-sm rounded-lg border border-slate-200 px-3 py-1.5">
          <option value="">Choose district…</option>
          {data.districts.map((d) => <option key={d.district_name} value={d.district_name}>{d.district_name} ({d.high_risk} high-risk)</option>)}
        </select>
      </div>

      {!district && <div className="card p-8 text-sm text-slate-500 text-center">Choose a district to load counsellor artefacts.</div>}
      {district && loading && <div className="card p-8 text-sm text-blue-600 text-center">Loading counsellor artefacts…</div>}

      {district && !loading && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <Section title={`Students in ${district}`} sub="Sorted by risk score — click to load artefacts">
              <ul className="max-h-[680px] overflow-y-auto divide-y divide-slate-100">
                {list.slice(0, 80).map((s) => (
                  <li key={s.id} className={`py-2 px-1 cursor-pointer rounded-md ${picked?.id === s.id ? "bg-violet-50" : "hover:bg-slate-50"}`}
                    onClick={() => setPickedId(s.id)}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 text-sm">{s.name}</span>
                      <RiskBadge tier={s.tier} />
                      {s.guide.escalation_required && <Tag color="red"><AlertTriangle className="w-3 h-3 inline mr-1" />escalation</Tag>}
                    </div>
                    <div className="text-xs text-slate-500">{s.school_name}</div>
                  </li>
                ))}
                {list.length === 0 && <li className="text-sm text-slate-500 py-4 text-center">No flagged students in this district.</li>}
              </ul>
            </Section>
          </div>

          <div className="lg:col-span-2">
            {picked ? (
              <ArtefactView a={picked} lang={lang} />
            ) : (
              <div className="card p-8 text-sm text-slate-500 text-center">Pick a student from the list.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ArtefactView({ a, lang }: { a: CounsellorArtefact; lang: string }) {
  const [sent, setSent] = useState(false);
  const sms = lang === "te" ? a.sms_te : a.sms_en;

  return (
    <div className="space-y-4">
      <Section
        pointKey="syn_parent_engagement"
        title={`${a.name} · ${a.school_name}`}
        sub={`${a.mandal}, ${a.district} · risk ${a.risk}`}
      >
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <RiskBadge tier={a.tier} />
          {a.guide.escalation_required && <Tag color="red"><AlertTriangle className="w-3 h-3 inline mr-1" />Escalation required</Tag>}
          {a.guide.sensitive_topics.length > 0 && <Tag color="amber">Sensitive topics flagged</Tag>}
        </div>
        <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1 flex items-center gap-2">
          Drivers driving counsellor script <ProvChip pointKey="rules_risk_score" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {a.drivers.map((d, i) => <Tag key={i} color="violet">{d.label}</Tag>)}
        </div>
      </Section>

      <Section title="Parent SMS" sub={`${sms.length} chars · ${lang === "te" ? "Telugu" : "English"}`} right={
        <div className="flex gap-2">
          <button onClick={() => navigator.clipboard.writeText(sms)} className="btn-ghost border border-slate-200"><Copy className="w-3.5 h-3.5" /> Copy</button>
          <button onClick={() => setSent(true)} className={`btn-primary ${sent ? "!bg-emerald-600" : ""}`}><MessageSquare className="w-3.5 h-3.5" /> {sent ? "Sent" : "Send (demo)"}</button>
        </div>
      }>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm">{sms}</div>
        <div className="text-xs text-slate-500 mt-2">
          Generated from a deterministic rule keyed off the student's primary driver. Easy LLM swap-in: replace
          template selection with an Anthropic <code className="text-violet-700">messages.create</code> call.
        </div>
      </Section>

      <Section title="Counsellor conversation guide" sub="5–8 talking points; sensitive items flagged inline" right={<BookOpen className="w-4 h-4 text-slate-400" />}>
        <ol className="space-y-2 text-sm">
          {a.guide.points.map((p, i) => {
            const sensitive = p.type === "sensitive" || p.type === "escalation_required";
            return (
              <li key={i} className={`pl-4 border-l-2 ${sensitive ? "border-red-400 bg-red-50" : "border-slate-200"} py-1.5 px-2 rounded-r`}>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">{p.type.replace("_", " ")}{sensitive && <AlertTriangle className="w-3 h-3 text-red-500" />}</div>
                <div className="text-slate-800">{lang === "te" ? p.te : p.en}</div>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section title="Remediation plan" sub="4-week plan — owner + measurable success criterion per step">
        <table className="w-full text-sm">
          <thead><tr><th className="table-th">When</th><th className="table-th">Action</th><th className="table-th">Owner</th><th className="table-th">Success metric</th></tr></thead>
          <tbody>
            {a.plan.map((p, i) => (
              <tr key={i}>
                <td className="table-td font-medium">{p.week}</td>
                <td className="table-td">{p.action}</td>
                <td className="table-td">{p.owner}</td>
                <td className="table-td">{p.success}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
