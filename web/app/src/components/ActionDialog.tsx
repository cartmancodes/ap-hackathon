import { useState } from "react";
import { X, CheckCircle2, ArrowUpRight, MessageSquare, Phone } from "lucide-react";
import { useUI } from "../store";
import type { Student } from "../types";

export function ActionDialog({ student, onClose }: { student: Student; onClose: () => void }) {
  const { logAction, addObservation, role } = useUI();
  const [obs, setObs] = useState("");
  const [outcome, setOutcome] = useState("");

  function handle(action: string, status: "Done" | "Pending" | "Escalated") {
    logAction({ studentId: student.id, action, status, by: role, outcome: outcome || undefined });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <div className="text-sm text-slate-500">Take action for</div>
            <div className="font-semibold text-slate-900 text-lg">{student.name}</div>
            <div className="text-sm text-slate-500">Class {student.class}-{student.section} · {student.school_name}</div>
          </div>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-900">
            <div className="font-medium">Recommended next action</div>
            <div className="mt-0.5">{student.act.action} — owner: {student.act.owner} · due in {student.act.due_in_days} days</div>
            <div className="text-xs text-blue-700 mt-1">Reason: {student.act.reason}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handle("Parent SMS", "Done")} className="btn-ghost border border-slate-200 justify-start"><MessageSquare className="w-4 h-4" /> Send parent SMS</button>
            <button onClick={() => handle("Parent Call", "Done")} className="btn-ghost border border-slate-200 justify-start"><Phone className="w-4 h-4" /> Mark parent call</button>
            <button onClick={() => handle(student.act.action, "Done")} className="btn-primary justify-start"><CheckCircle2 className="w-4 h-4" /> Mark recommended action done</button>
            <button onClick={() => handle(student.act.action, "Escalated")} className="btn-danger justify-start"><ArrowUpRight className="w-4 h-4" /> Escalate</button>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700">Add teacher observation</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="e.g. Family travelling to construction site for 3 weeks" className="mt-1 w-full text-sm rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200" rows={2} />
            <button onClick={() => { if (obs.trim()) { addObservation(student.id, obs); setObs(""); } }} className="btn-ghost border border-slate-200 mt-2">Save observation</button>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700">Intervention outcome (after follow-up)</label>
            <input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. Attendance improved 12pp in 2 weeks" className="mt-1 w-full text-sm rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
