import { create } from "zustand";
import type { Role, Lang } from "./types";

export type ActionStatus = "Pending" | "Done" | "Escalated";

export interface ActionLogEntry {
  studentId: number;
  action: string;
  status: ActionStatus;
  remarks?: string;
  outcome?: string;
  by: Role;
  at: string;
}

export interface Selection {
  district?: string;
  mandal?: string;
  udise?: number;
  classKey?: string;
  studentId?: number;
}

export interface UIState {
  role: Role;
  lang: Lang;
  selection: Selection;
  actionLog: ActionLogEntry[];
  studentObservations: Record<number, string[]>;
  revealedIds: Set<number>;          // ids whose real name was unmasked (role-based)
  feedbackRows: number;              // simulated closed-loop counter
  lastRetrain: string | null;        // ISO timestamp
  showProvenance: boolean;           // global observability toggle
  toasts: { id: number; text: string }[];
  setRole: (r: Role) => void;
  setLang: (l: Lang) => void;
  drillTo: (s: Selection) => void;
  resetSelection: () => void;
  back: () => void;
  logAction: (e: Omit<ActionLogEntry, "at">) => void;
  addObservation: (studentId: number, text: string) => void;
  reveal: (studentId: number) => void;
  toggleProvenance: () => void;
  pushToast: (text: string) => void;
  dismissToast: (id: number) => void;
  triggerRetrain: () => void;
}

let toastSeq = 1;

export const useUI = create<UIState>((set, get) => ({
  role: "state",
  lang: "en",
  selection: {},
  actionLog: [],
  studentObservations: {},
  revealedIds: new Set<number>(),
  feedbackRows: 1834,                // seeded with a realistic-looking baseline
  lastRetrain: null,
  showProvenance: false,
  toasts: [],
  setRole: (role) => set({ role, selection: {} }),
  setLang: (lang) => set({ lang }),
  drillTo: (s) => set({ selection: { ...get().selection, ...s } }),
  resetSelection: () => set({ selection: {} }),
  back: () => {
    const sel = { ...get().selection };
    if (sel.studentId) delete sel.studentId;
    else if (sel.classKey) delete sel.classKey;
    else if (sel.udise) delete sel.udise;
    else if (sel.mandal) delete sel.mandal;
    else if (sel.district) delete sel.district;
    set({ selection: sel });
  },
  logAction: (e) => {
    const entry = { ...e, at: new Date().toISOString() };
    const next = [...get().actionLog, entry];
    // Closed-loop feedback simulation: every "Done" action adds a feedback row.
    const isDone = e.status === "Done";
    set({
      actionLog: next,
      feedbackRows: get().feedbackRows + (isDone ? 1 : 0),
      toasts: isDone
        ? [...get().toasts, { id: toastSeq++, text: "Outcome captured · model learning row +1" }]
        : get().toasts,
    });
    // auto-dismiss toast in 3.5s
    if (isDone) {
      const tid = toastSeq - 1;
      setTimeout(() => {
        const ts = get().toasts.filter((t) => t.id !== tid);
        set({ toasts: ts });
      }, 3500);
    }
  },
  addObservation: (studentId, text) => {
    const obs = { ...get().studentObservations };
    obs[studentId] = [...(obs[studentId] || []), text];
    set({ studentObservations: obs });
  },
  reveal: (studentId) => {
    const s = new Set(get().revealedIds);
    s.add(studentId);
    set({ revealedIds: s });
  },
  toggleProvenance: () => set({ showProvenance: !get().showProvenance }),
  pushToast: (text) => {
    const id = toastSeq++;
    set({ toasts: [...get().toasts, { id, text }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3500);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  triggerRetrain: () => {
    set({ lastRetrain: new Date().toISOString() });
    const id = toastSeq++;
    set({ toasts: [...get().toasts, { id, text: "Retraining queued · using last quarter's outcomes" }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3500);
  },
}));
