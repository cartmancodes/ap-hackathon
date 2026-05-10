import { useEffect, useState } from "react";
import type { Audit, District, Mandal, Meta, School, StateSummary, Student } from "./types";

export interface AppData {
  students: Student[];
  schools: School[];
  mandals: Mandal[];
  districts: District[];
  state: StateSummary;
  audit: Audit;
  meta: Meta;
}

let cache: AppData | null = null;

export async function loadAll(): Promise<AppData> {
  if (cache) return cache;
  const base = import.meta.env.BASE_URL || "/";
  const join = (p: string) => `${base.replace(/\/$/, "")}/${p}`;
  const [students, schools, mandals, districts, state, audit, meta] = await Promise.all([
    fetch(join("data/students.json")).then((r) => r.json()),
    fetch(join("data/schools.json")).then((r) => r.json()),
    fetch(join("data/mandals.json")).then((r) => r.json()),
    fetch(join("data/districts.json")).then((r) => r.json()),
    fetch(join("data/state_summary.json")).then((r) => r.json()),
    fetch(join("data/audit.json")).then((r) => r.json()),
    fetch(join("data/meta.json")).then((r) => r.json()),
  ]);
  cache = { students, schools, mandals, districts, state, audit, meta };
  return cache;
}

export function useAppData() {
  const [data, setData] = useState<AppData | null>(cache);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (cache) return;
    loadAll().then(setData).catch(setError);
  }, []);
  return { data, error };
}
