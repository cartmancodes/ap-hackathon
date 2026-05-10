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
  setRole: (r: Role) => void;
  setLang: (l: Lang) => void;
  drillTo: (s: Selection) => void;
  resetSelection: () => void;
  back: () => void;
  logAction: (e: Omit<ActionLogEntry, "at">) => void;
  addObservation: (studentId: number, text: string) => void;
}

export const useUI = create<UIState>((set, get) => ({
  role: "state",
  lang: "en",
  selection: {},
  actionLog: [],
  studentObservations: {},
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
  logAction: (e) =>
    set({
      actionLog: [
        ...get().actionLog,
        { ...e, at: new Date().toISOString() },
      ],
    }),
  addObservation: (studentId, text) => {
    const obs = { ...get().studentObservations };
    obs[studentId] = [...(obs[studentId] || []), text];
    set({ studentObservations: obs });
  },
}));
