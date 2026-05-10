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

export interface Student {
  id: number;
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
  syn?: SyntheticSignals;
  risk: number;
  tier: Tier;
  rec: string;
  drv?: Driver[];
  act: ActionRec;
  drop: boolean;
  hist?: ActionHistory[];
  esc: string;
  pending: number;
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
  dropouts_23_24: number;
  avg_attendance: number;
  avg_risk: number;
  districts: number;
  mandals: number;
  schools: number;
  raw_dropouts_23_24: number;
  raw_dropouts_24_25: number;
}

export interface Audit {
  rows_total: number;
  actual_dropouts_in_sample: number;
  top_10pct_capture_rate: number;
  top_20pct_capture_rate: number;
  top_10pct_precision: number;
  top_20pct_precision: number;
  avg_risk_dropouts: number;
  avg_risk_non_dropouts: number;
  by_gender: Record<string, { n: number; dropout_rate: number; avg_risk: number }>;
  by_caste: Record<string, { n: number; dropout_rate: number; avg_risk: number }>;
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
  generated_at: string;
}

export type Role = "state" | "district" | "mandal" | "headmaster" | "teacher";

export type Lang = "en" | "te";
