import { useEffect, useState } from "react";
import type {
  Audit, BundleIndexEntry, Catalog, District, ForecastBundle, Mandal, Meta,
  School, SearchEntry, StateSummary, Student, CounsellorArtefact,
} from "./types";

export interface AppData {
  /** Top-1500 highest-risk students — lightweight overview surface. */
  students: Student[];
  schools: School[];
  mandals: Mandal[];
  districts: District[];
  state: StateSummary;
  audit: Audit;
  meta: Meta;
  catalog: Catalog;
  forecast: ForecastBundle;
  bundleIndex: BundleIndexEntry[];
  search: SearchEntry[];
}

let cache: AppData | null = null;
const districtCache = new Map<string, Student[]>();
const counsellorCache = new Map<string, CounsellorArtefact[]>();

function join(p: string) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/${p}`;
}

export async function loadAll(): Promise<AppData> {
  if (cache) return cache;
  const [students, schools, mandals, districts, state, audit, meta, catalog, forecast, bundleIndex, search] = await Promise.all([
    fetch(join("data/students.json")).then((r) => r.json()),
    fetch(join("data/schools.json")).then((r) => r.json()),
    fetch(join("data/mandals.json")).then((r) => r.json()),
    fetch(join("data/districts.json")).then((r) => r.json()),
    fetch(join("data/state_summary.json")).then((r) => r.json()),
    fetch(join("data/audit.json")).then((r) => r.json()),
    fetch(join("data/meta.json")).then((r) => r.json()),
    fetch(join("data/catalog.json")).then((r) => r.json()),
    fetch(join("data/forecast.json")).then((r) => r.json()),
    fetch(join("data/index.json")).then((r) => r.json()),
    fetch(join("data/search.json")).then((r) => r.json()),
  ]);
  cache = { students, schools, mandals, districts, state, audit, meta, catalog, forecast, bundleIndex, search };
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

/** Lazy-load the full per-district bundle (used by district / mandal / school drill-downs). */
export async function loadDistrictStudents(district: string): Promise<Student[]> {
  const key = district.toLowerCase();
  const hit = districtCache.get(key);
  if (hit) return hit;
  const data = await loadAll();
  const entry = data.bundleIndex.find((b) => b.district.toLowerCase() === key);
  if (!entry) return [];
  const list = await fetch(join("data/" + entry.file)).then((r) => r.json());
  districtCache.set(key, list);
  return list;
}

export function useDistrictStudents(district?: string): { students: Student[] | null; loading: boolean } {
  const [students, setStudents] = useState<Student[] | null>(district ? districtCache.get(district.toLowerCase()) ?? null : null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!district) { setStudents(null); return; }
    const hit = districtCache.get(district.toLowerCase());
    if (hit) { setStudents(hit); return; }
    setLoading(true);
    loadDistrictStudents(district)
      .then((s) => { setStudents(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, [district]);
  return { students, loading };
}

export async function loadCounsellorBundle(district: string): Promise<CounsellorArtefact[]> {
  const key = district.toLowerCase();
  const hit = counsellorCache.get(key);
  if (hit) return hit;
  // counsellor file shares the same slug naming as bundles
  const data = await loadAll();
  const entry = data.bundleIndex.find((b) => b.district.toLowerCase() === key);
  if (!entry) return [];
  const counsellorPath = entry.file.replace(/^bundles\//, "counsellor/");
  const list = await fetch(join("data/" + counsellorPath)).then((r) => r.json());
  counsellorCache.set(key, list);
  return list;
}

export function useCounsellorBundle(district?: string) {
  const [data, setData] = useState<CounsellorArtefact[] | null>(district ? counsellorCache.get(district.toLowerCase()) ?? null : null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!district) { setData(null); return; }
    const hit = counsellorCache.get(district.toLowerCase());
    if (hit) { setData(hit); return; }
    setLoading(true);
    loadCounsellorBundle(district).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [district]);
  return { data, loading };
}
