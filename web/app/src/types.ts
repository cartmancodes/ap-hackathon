export type Tier = "Low" | "Watch" | "High Support Needed" | "Critical Support Needed";

export interface Driver {
  key: string;
  weight: number;
  label: string;
}

export interface ActionRec {
  action: string;
  owner: string;
  reason: string;
  due_in_days: number;
}

export interface Features {
  attendance_pct: number | null;
  recent_attendance_pct: number | null;
  attendance_delta_30d: number | null;
  longest_absence_streak: number;
  repeated_absence_clusters: number;
  school_days: number;
  absent_days: number;
  fa_avg: number | null;
  sa_avg: number | null;
  overall_marks: number | null;
  marks_trend: number | null;
}

export interface First8Features {
  first8_attendance_pct: number;
  first8_absent_days: number;
  first8_longest_streak: number;
  first8_late_joiners: boolean;
}

export interface SyntheticSignals {
  seasonal_migration_possibility: boolean;
  parent_engagement: "High" | "Medium" | "Low";
  financial_stress: boolean;
  child_labour_concern: boolean;
  early_marriage_concern: boolean;
  behavioural_disengagement: boolean;
  peer_isolation: boolean;
  disability_support_need: boolean;
  transport_difficulty: boolean;
  household_support_level: "Strong" | "Moderate" | "Weak";
}

export interface ActionHistory {
  action: string;
  status: "Done" | "Pending";
  remarks: string | null;
  owner: string;
  date: string;
}

export interface LinearContrib {
  key: string;
  label: string;
  contribution: number;
  raw_value: number;
}

export interface Student {
  id: number;
  anon_id?: string;
  name: string;
  gender: "Male" | "Female";
  caste: string;
  class: string;
  section: string;
  udise: number;
  school_name: string;
  district: string;
  mandal: string;
  f: Features;
  first8?: First8Features;
  syn?: SyntheticSignals;
  risk: number;
  tier: Tier;
  rec: string;
  drv?: Driver[];
  act: ActionRec;
  drop: boolean;
  hist?: ActionHistory[];
  esc?: string;
  pending?: number;
  ml_log?: number;
  ml_gbm?: number;
  ml_early?: number;
  ml_blend?: number;
  log_contrib?: LinearContrib[];
  early_contrib?: LinearContrib[];
}

export interface School {
  udise_code: number;
  school_name: string;
  district_name: string;
  mandal_name: string;
  cluster_name: string;
  lat: number | null;
  lng: number | null;
  students: number;
  high_risk: number;
  critical: number;
  watch: number;
  avg_risk: number;
  avg_attendance: number;
  dropouts_23_24: number;
  high_recoverability_count: number;
  early_high_risk_count?: number;
  top_drivers: [string, number][];
  overdue_actions: number;
  pending_parent_calls: number;
}

export interface Mandal {
  district_name: string;
  mandal_name: string;
  students: number;
  high_risk: number;
  critical: number;
  watch: number;
  avg_risk: number;
  avg_attendance: number;
  dropouts_23_24: number;
  high_recoverability_count: number;
  early_high_risk_count?: number;
  top_drivers: [string, number][];
  intervention_completion_pct: number;
  overdue_actions: number;
  pending_home_visits: number;
}

export interface District {
  district_name: string;
  students: number;
  high_risk: number;
  critical: number;
  watch: number;
  avg_risk: number;
  avg_attendance: number;
  dropouts_23_24: number;
  high_recoverability_count: number;
  early_high_risk_count?: number;
  top_drivers: [string, number][];
  risk_change_pct: number;
  intervention_completion_pct: number;
  unresolved_escalations: number;
}

export interface StateSummary {
  students_in_sample: number;
  high_risk_total: number;
  critical_total: number;
  watch_total: number;
  high_recoverability_total: number;
  early_high_risk_total: number;
  dropouts_23_24: number;
  avg_attendance: number;
  avg_risk: number;
  districts: number;
  mandals: number;
  schools: number;
  raw_dropouts_23_24: number;
  raw_dropouts_24_25: number;
  actions_logged_simulated?: number;
}

export interface ModelMetrics {
  name: string;
  roc_auc: number;
  pr_auc: number;
  top10: { k_pct: number; n_selected: number; precision: number; recall: number; captured: number; total_dropouts: number };
  top20: { k_pct: number; n_selected: number; precision: number; recall: number; captured: number; total_dropouts: number };
  poc_top20: {
    threshold_percentile: number;
    true_positive: number; false_positive: number; true_negative: number; false_negative: number;
    inclusion_error: number; exclusion_error: number;
    inclusion_target: number; exclusion_target: number;
    inclusion_pass: boolean; exclusion_pass: boolean;
  };
}

export interface Audit {
  n: number;
  dropouts: number;
  models: { logistic: ModelMetrics; gbm: ModelMetrics; hyper_early: ModelMetrics };
  by_gender: Record<string, { n: number; dropout_rate: number; avg_risk: number }>;
  by_caste: Record<string, { n: number; dropout_rate: number; avg_risk: number }>;
  by_district_top_overflag?: Array<[string, number]>;
  feature_importance_gbm?: Record<string, number>;
  logistic_coefficients?: Record<string, number>;
}

export interface Meta {
  data_provenance: {
    real_from_uploaded_data: string[];
    derived_from_real_data: string[];
    synthetic_for_demo_only: string[];
    future_integration_ready: string[];
    note_on_data: string;
  };
  model: any;
  anonymisation?: { id_scheme: string; salt: string; name_display: string };
  generated_at: string;
}

export interface CatalogPoint {
  label: string;
  source: string;
  kind: "real" | "derived" | "derived_proxy" | "synthetic" | "synthetic_ops" | "model_output" | "forecast" | "anonymised";
  formula?: string;
  unit?: string;
  missingness?: string;
}

export interface Catalog {
  version: string;
  generated_at: string;
  points: Record<string, CatalogPoint>;
}

export interface BundleIndexEntry { district: string; file: string; count: number }

export interface ForecastDistrict {
  district: string;
  series_weekly_high_risk: number[];
  projection_30d: number;
  projection_60d: number;
  slope_per_week: number;
  deteriorating: boolean;
}

export interface ForecastBundle {
  districts: ForecastDistrict[];
  top_deteriorating: ForecastDistrict[];
  method: string;
  horizon_days: number[];
}

export interface CounsellorArtefact {
  id: number;
  anon_id?: string;
  name: string;
  school_name: string;
  mandal: string;
  district: string;
  risk: number;
  tier: Tier;
  drivers: Driver[];
  sms_en: string;
  sms_te: string;
  guide: {
    points: Array<{ type: string; en: string; te: string }>;
    escalation_required: boolean;
    sensitive_topics: Array<{ type: string; en: string; te: string }>;
  };
  plan: Array<{ week: string; action: string; owner: string; success: string }>;
}

export interface SearchEntry {
  id: number;
  anon_id?: string;
  name: string;
  udise: number;
  school_name: string;
  district: string;
  mandal: string;
  risk: number;
  tier: Tier;
}

export type Role = "state" | "district" | "mandal" | "headmaster" | "teacher";

export type Lang = "en" | "te";
