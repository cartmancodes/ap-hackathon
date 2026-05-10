"""Stage 4 — aggregate scored students to school / mandal / district / state.

Also produces:
- per-district student bundles for lazy loading (`students_<district>.json`)
- index manifest (`index.json`) for the frontend to know what to fetch
- forecast.json (4-week rolling trend + Holt linear projection per district)
- catalog.json (data-point provenance catalog used by the observability layer)
"""
from __future__ import annotations
import json
import math
import random
import re
from collections import defaultdict
from pathlib import Path

CACHE = Path(__file__).resolve().parent / "_cache"
OUT = Path(__file__).resolve().parents[1] / "app" / "public" / "data"
OUT.mkdir(exist_ok=True, parents=True)


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def safe_avg(values):
    vals = [v for v in values if v is not None]
    return round(sum(vals) / len(vals), 2) if vals else None


def main():
    print("[stage 4] loading scored students + audit + models...")
    students = json.loads((CACHE / "students_scored.json").read_text())
    audit = json.loads((CACHE / "audit.json").read_text())
    models = json.loads((CACHE / "models.json").read_text())

    # ---------- per-student client payload ----------
    def slim(s, full=False):
        out = {
            "id": s["id"],
            "anon_id": s["anon_id"],
            "name": s["name"],
            "gender": s["gender"],
            "caste": s["caste"],
            "class": s["class"],
            "section": s["section"],
            "udise": s["udise"],
            "school_name": s["school_name"],
            "district": s["district"],
            "mandal": s["mandal"],
            "f": s["f"],
            "first8": s["first8"],
            "risk": s["rules"]["score"],
            "tier": s["rules"]["tier"],
            "rec": s["recoverability"],
            "act": s["action"],
            "drop": s["drop"],
            "ml_log": s["ml"]["logistic_proba"],
            "ml_gbm": s["ml"]["gbm_proba"],
            "ml_early": s["ml"]["early_proba"],
            "ml_blend": s["ml"]["blended_score"],
        }
        if full:
            out["syn"] = s["syn"]
            out["drv"] = s["rules"]["drivers"]
            out["log_contrib"] = s["ml"]["logistic_contrib"]
            out["early_contrib"] = s["ml"]["early_contrib"]
        return out

    # ---------- aggregate buckets ----------
    schools = defaultdict(lambda: dict(
        students=0, watch=0, high=0, critical=0, drop=0, recov_high=0,
        att_sum=0.0, att_n=0, score_sum=0.0, drivers=defaultdict(int),
        early_high=0))
    mandals = defaultdict(lambda: dict(
        students=0, watch=0, high=0, critical=0, drop=0, recov_high=0,
        att_sum=0.0, att_n=0, score_sum=0.0, drivers=defaultdict(int),
        early_high=0))
    districts = defaultdict(lambda: dict(
        students=0, watch=0, high=0, critical=0, drop=0, recov_high=0,
        att_sum=0.0, att_n=0, score_sum=0.0, drivers=defaultdict(int),
        early_high=0, students_list=[]))

    school_meta = {}
    for s in students:
        sid = (s["udise"],)
        mid = (s["district"], s["mandal"])
        did = (s["district"],)
        for bucket in (schools[sid], mandals[mid], districts[did]):
            bucket["students"] += 1
            bucket["score_sum"] += s["rules"]["score"]
            t = s["rules"]["tier"]
            if t == "Watch": bucket["watch"] += 1
            elif t == "High Support Needed": bucket["high"] += 1
            elif t == "Critical Support Needed": bucket["critical"] += 1
            if s["drop"]: bucket["drop"] += 1
            if s["recoverability"].startswith("High"): bucket["recov_high"] += 1
            att = s["f"].get("attendance_pct")
            if att is not None:
                bucket["att_sum"] += att; bucket["att_n"] += 1
            if s["ml"]["early_proba"] > 0.5:
                bucket["early_high"] += 1
            for d in s["rules"]["drivers"][:3]:
                bucket["drivers"][d["key"]] += 1
        school_meta.setdefault(s["udise"], {
            "udise_code": s["udise"], "school_name": s["school_name"],
            "district_name": s["district"], "mandal_name": s["mandal"],
            "cluster_name": s.get("cluster_name") or "",
            "lat": None, "lng": None,
        })

    def finalize(b):
        n = b["students"] or 1
        return {
            "students": b["students"],
            "high_risk": b["high"] + b["critical"],
            "critical": b["critical"], "watch": b["watch"],
            "avg_risk": round(b["score_sum"] / n, 1),
            "avg_attendance": round(b["att_sum"] / b["att_n"], 1) if b["att_n"] else 0,
            "dropouts_23_24": b["drop"],
            "high_recoverability_count": b["recov_high"],
            "early_high_risk_count": b["early_high"],
            "top_drivers": sorted(b["drivers"].items(), key=lambda x: -x[1])[:5],
        }

    # ---------- school records ----------
    school_recs = []
    for (udise,), b in schools.items():
        sm = school_meta[udise]
        school_recs.append({**sm, **finalize(b)})

    # ---------- mandal records ----------
    mandal_recs = []
    for (district, mandal), b in mandals.items():
        mandal_recs.append({"district_name": district, "mandal_name": mandal, **finalize(b)})

    # ---------- district records ----------
    district_recs = []
    for (district,), b in districts.items():
        district_recs.append({"district_name": district, **finalize(b)})

    # Synthetic period-over-period + ops fields (clearly flagged in catalog).
    rng = random.Random(11)
    for d in district_recs:
        d["risk_change_pct"] = round(rng.gauss(0, 6), 1)
        d["intervention_completion_pct"] = round(40 + rng.uniform(0, 55), 1)
        d["unresolved_escalations"] = rng.randint(0, max(1, d["high_risk"] // 25))
    for m in mandal_recs:
        m["intervention_completion_pct"] = round(35 + rng.uniform(0, 55), 1)
        m["overdue_actions"] = rng.randint(0, max(1, m["high_risk"] // 8))
        m["pending_home_visits"] = rng.randint(0, max(1, m["high_risk"] // 6))
    for s in school_recs:
        s["overdue_actions"] = rng.randint(0, max(1, s["high_risk"] // 4))
        s["pending_parent_calls"] = rng.randint(0, max(1, s["high_risk"] // 3))

    # ---------- state summary ----------
    state = {
        "students_in_sample": len(students),
        "high_risk_total": sum(1 for s in students if s["rules"]["tier"] in ("High Support Needed", "Critical Support Needed")),
        "critical_total": sum(1 for s in students if s["rules"]["tier"] == "Critical Support Needed"),
        "watch_total": sum(1 for s in students if s["rules"]["tier"] == "Watch"),
        "high_recoverability_total": sum(1 for s in students if s["recoverability"].startswith("High")),
        "early_high_risk_total": sum(1 for s in students if s["ml"]["early_proba"] > 0.5),
        "dropouts_23_24": sum(1 for s in students if s["drop"]),
        "avg_attendance": round(sum((s["f"].get("attendance_pct") or 0) for s in students) / len(students), 1),
        "avg_risk": round(sum(s["rules"]["score"] for s in students) / len(students), 1),
        "districts": len(district_recs),
        "mandals": len(mandal_recs),
        "schools": len(school_recs),
        "raw_dropouts_23_24": 6536,
        "raw_dropouts_24_25": 5186,
        "actions_logged_simulated": 0,
    }

    # ---------- write per-district bundles + visible students summary ----------
    visible_tiers = {"Watch", "High Support Needed", "Critical Support Needed"}
    district_idx = {}
    for s in students:
        if s["rules"]["tier"] not in visible_tiers:
            continue
        d = s["district"] or "Unknown"
        district_idx.setdefault(d, []).append(s)

    bundles_dir = OUT / "bundles"
    bundles_dir.mkdir(exist_ok=True)
    manifest = []
    for district, slist in district_idx.items():
        path = bundles_dir / f"{slug(district)}.json"
        path.write_text(json.dumps([slim(s, full=True) for s in slist], separators=(",", ":")))
        manifest.append({"district": district, "file": f"bundles/{path.name}", "count": len(slist)})
    (OUT / "index.json").write_text(json.dumps(manifest, indent=2))
    print(f"[stage 4] wrote {len(manifest)} district bundles, total visible students = {sum(m['count'] for m in manifest):,}")

    # The legacy `students.json` (top 1500 by risk, used by the lightweight
    # state-level views without lazy loading).
    visible = [s for s in students if s["rules"]["tier"] in visible_tiers]
    visible.sort(key=lambda s: -s["rules"]["score"])
    legacy = [slim(s, full=True) for s in visible[:1500]]
    (OUT / "students.json").write_text(json.dumps(legacy, separators=(",", ":")))

    # All visible students slim (used as default search dataset) — id, name, school, district, mandal, risk
    search_payload = [{
        "id": s["id"], "anon_id": s["anon_id"], "name": s["name"],
        "udise": s["udise"], "school_name": s["school_name"],
        "district": s["district"], "mandal": s["mandal"],
        "risk": s["rules"]["score"], "tier": s["rules"]["tier"],
    } for s in visible]
    (OUT / "search.json").write_text(json.dumps(search_payload, separators=(",", ":")))

    (OUT / "schools.json").write_text(json.dumps(school_recs, separators=(",", ":")))
    (OUT / "mandals.json").write_text(json.dumps(mandal_recs, separators=(",", ":")))
    (OUT / "districts.json").write_text(json.dumps(district_recs, separators=(",", ":")))
    (OUT / "state_summary.json").write_text(json.dumps(state, separators=(",", ":")))

    # ---------- forecast (Holt linear) per district ----------
    print("[stage 4] computing per-district forecasts...")
    forecasts = []
    # Synthesise a believable 4-week rolling high-risk-count series from the
    # current counts + a deterministic noisy historical trend (no real time
    # series available — flagged in catalog).
    for d in district_recs:
        rng = random.Random(d["district_name"])
        current = d["high_risk"]
        # Past 4 weeks (week -4 .. -1)
        slope = rng.gauss(d["risk_change_pct"] * 0.6, 2.0)
        series = [max(0, int(current - 3 * slope + rng.gauss(0, current * 0.04))),
                  max(0, int(current - 2 * slope + rng.gauss(0, current * 0.04))),
                  max(0, int(current - 1 * slope + rng.gauss(0, current * 0.04))),
                  current]
        # Holt linear (simple): level + trend extrapolation
        alpha, beta = 0.5, 0.4
        level = series[0]; trend = (series[1] - series[0])
        for v in series[1:]:
            new_level = alpha * v + (1 - alpha) * (level + trend)
            trend = beta * (new_level - level) + (1 - beta) * trend
            level = new_level
        proj30 = max(0, int(level + 4 * trend))
        proj60 = max(0, int(level + 8 * trend))
        forecasts.append({
            "district": d["district_name"],
            "series_weekly_high_risk": series,
            "projection_30d": proj30,
            "projection_60d": proj60,
            "slope_per_week": round(trend, 2),
            "deteriorating": trend > 1,
        })
    forecasts.sort(key=lambda f: -f["slope_per_week"])
    (OUT / "forecast.json").write_text(json.dumps({
        "districts": forecasts,
        "top_deteriorating": [f for f in forecasts if f["deteriorating"]][:20],
        "method": "Holt linear (level + trend), alpha=0.5 beta=0.4",
        "horizon_days": [30, 60],
    }, indent=2))

    # ---------- audit + extended fairness ----------
    print("[stage 4] computing extended audit (fairness)...")
    by_gender = defaultdict(lambda: [0, 0, 0.0])  # n, drop, sumrisk
    by_caste = defaultdict(lambda: [0, 0, 0.0])
    by_district = defaultdict(lambda: [0, 0, 0.0])
    for s in students:
        for d, k in ((by_gender, s["gender"]), (by_caste, s["caste"]), (by_district, s["district"])):
            d[k][0] += 1
            d[k][1] += int(s["drop"])
            d[k][2] += s["rules"]["score"]
    def fairness(d):
        out = {}
        for k, v in d.items():
            out[str(k)] = {
                "n": v[0],
                "dropout_rate": round(v[1] / max(1, v[0]), 3),
                "avg_risk": round(v[2] / max(1, v[0]), 1),
            }
        return out

    audit_full = {
        **audit,
        "by_gender": fairness(by_gender),
        "by_caste": fairness(by_caste),
        "by_district_top_overflag": sorted(
            [(k, v[2] / max(1, v[0]) / max(0.5, v[1] / max(1, v[0]) * 100))
             for k, v in by_district.items() if v[0] > 100],
            key=lambda x: -x[1])[:5],
        "feature_importance_gbm": dict(sorted(
            models["gbm_feature_importance"].items(), key=lambda kv: -kv[1])[:10]),
        "logistic_coefficients": dict(zip(
            models["logistic"]["feature_keys"], [round(c, 3) for c in models["logistic"]["coefficients"]])),
    }
    (OUT / "audit.json").write_text(json.dumps(audit_full, indent=2))

    # ---------- data-point provenance catalog (observability layer) ----------
    catalog = {
        "version": "v2",
        "generated_at": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "points": {
            # attendance
            "attendance_pct": {"label": "Attendance %", "source": "FY 23-24 daily Y/N attendance", "kind": "real", "formula": "present_days / school_days * 100", "unit": "%", "missingness": "computed when ≥1 marked school day"},
            "recent_attendance_pct": {"label": "Last 30-day attendance", "source": "FY 23-24 daily Y/N (last 30 marked days)", "kind": "real", "formula": "rolling 30-day present / total", "unit": "%"},
            "attendance_delta_30d": {"label": "Attendance Δ (last 30d)", "source": "FY 23-24 daily Y/N", "kind": "derived", "formula": "recent_30d - overall", "unit": "pp"},
            "longest_absence_streak": {"label": "Longest absence streak", "source": "FY 23-24 daily Y/N", "kind": "derived", "formula": "max consecutive N days", "unit": "days"},
            "repeated_absence_clusters": {"label": "Absence cluster count", "source": "FY 23-24 daily Y/N", "kind": "derived", "formula": "transitions Y→N counted", "unit": "clusters"},
            "absent_days": {"label": "Days absent", "source": "FY 23-24 daily Y/N", "kind": "real", "formula": "sum of N", "unit": "days"},
            "school_days": {"label": "School days", "source": "FY 23-24 daily Y/N", "kind": "real", "formula": "sum of Y + N", "unit": "days"},
            # marks
            "fa_avg": {"label": "FA marks average", "source": "FY 23-24 FA1–FA4", "kind": "real", "formula": "mean(FA1..FA4)", "unit": "marks"},
            "sa_avg": {"label": "SA marks average", "source": "FY 23-24 SA1/SA2", "kind": "real", "formula": "mean(SA1,SA2)", "unit": "marks"},
            "overall_marks": {"label": "Overall marks", "source": "FY 23-24 FA+SA", "kind": "real", "formula": "mean(all marks)", "unit": "marks"},
            "marks_trend": {"label": "Marks trend", "source": "FY 23-24 FA+SA", "kind": "derived", "formula": "last_valid - first_valid", "unit": "Δ marks"},
            # hyper-early
            "first8_attendance_pct": {"label": "First-8-week attendance", "source": "FY 23-24 weeks 1–8" if False else "Derived from full-year attendance (raw daily not in repo)", "kind": "derived_proxy", "formula": "proxy: full-year + seed-stable noise; replaced with real weeks 1–8 when raw CSV is supplied", "unit": "%"},
            "first8_absent_days": {"label": "First-8-week absent days", "source": "Derived from full-year attendance", "kind": "derived_proxy", "formula": "round(40 * (1 - first8_attendance%/100))", "unit": "days"},
            "first8_longest_streak": {"label": "First-8-week longest streak", "source": "Derived from full-year attendance", "kind": "derived_proxy", "formula": "seed-stable; capped by full-year streak", "unit": "days"},
            # model
            "rules_risk_score": {"label": "Risk score (rules)", "source": "Composite of weighted, named drivers", "kind": "model_output", "formula": "see Model audit", "unit": "0–100"},
            "logistic_proba": {"label": "Logistic probability", "source": "sklearn LogisticRegression — cross-validated", "kind": "model_output", "formula": "P(dropout | full-year features)", "unit": "0–1"},
            "gbm_proba": {"label": "GBM probability", "source": "sklearn GradientBoostingClassifier — cross-validated", "kind": "model_output", "formula": "P(dropout | full-year features)", "unit": "0–1"},
            "early_proba": {"label": "Hyper-early probability", "source": "sklearn LogisticRegression on weeks 1–8 only", "kind": "model_output", "formula": "P(dropout | first-8-week features)", "unit": "0–1"},
            "blended_score": {"label": "Blended risk (0–100)", "source": "0.4·rules + 0.3·logistic + 0.3·gbm", "kind": "model_output", "formula": "weighted blend of three independent estimators", "unit": "0–100"},
            # social signals (synthetic — flagged)
            "syn_seasonal_migration_possibility": {"label": "Seasonal migration possibility", "source": "Synthetic — pending LEAP welfare integration", "kind": "synthetic", "unit": "0/1"},
            "syn_financial_stress": {"label": "Household financial stress", "source": "Synthetic — pending welfare data", "kind": "synthetic", "unit": "0/1"},
            "syn_child_labour_concern": {"label": "Child labour concern", "source": "Synthetic — flagged by teacher in LEAP (future)", "kind": "synthetic", "unit": "0/1"},
            "syn_early_marriage_concern": {"label": "Early marriage concern", "source": "Synthetic — flagged by teacher / counsellor", "kind": "synthetic", "unit": "0/1"},
            "syn_behavioural_disengagement": {"label": "Behavioural disengagement", "source": "Synthetic — teacher LEAP observation", "kind": "synthetic", "unit": "0/1"},
            "syn_transport_difficulty": {"label": "Transport difficulty", "source": "Synthetic — pending transport-allowance integration", "kind": "synthetic", "unit": "0/1"},
            "syn_peer_isolation": {"label": "Peer isolation", "source": "Synthetic — teacher observation", "kind": "synthetic", "unit": "0/1"},
            "syn_parent_engagement": {"label": "Parent engagement", "source": "Synthetic — LEAP parent app", "kind": "synthetic", "unit": "categorical"},
            "syn_household_support_level": {"label": "Household support level", "source": "Synthetic — pending welfare integration", "kind": "synthetic", "unit": "categorical"},
            "syn_disability_support_need": {"label": "Disability support need", "source": "Synthetic — pending CWSN dataset", "kind": "synthetic", "unit": "0/1"},
            # ops
            "intervention_completion_pct": {"label": "Intervention completion %", "source": "Synthetic — would come from LEAP action-log", "kind": "synthetic_ops", "unit": "%"},
            "overdue_actions": {"label": "Overdue actions", "source": "Synthetic — pending action-log integration", "kind": "synthetic_ops", "unit": "count"},
            "pending_home_visits": {"label": "Pending home visits", "source": "Synthetic — pending MEO worklist", "kind": "synthetic_ops", "unit": "count"},
            "pending_parent_calls": {"label": "Pending parent calls", "source": "Synthetic — pending teacher worklist", "kind": "synthetic_ops", "unit": "count"},
            "unresolved_escalations": {"label": "Unresolved escalations", "source": "Synthetic — pending district worklist", "kind": "synthetic_ops", "unit": "count"},
            "risk_change_pct": {"label": "Period-over-period Δ", "source": "Synthetic — needs prior-period snapshot", "kind": "synthetic_ops", "unit": "%"},
            "forecast_projection_30d": {"label": "30-day projection", "source": "Holt linear on synthesised 4-week series", "kind": "forecast", "formula": "level + 4·trend", "unit": "students"},
            "forecast_projection_60d": {"label": "60-day projection", "source": "Holt linear on synthesised 4-week series", "kind": "forecast", "formula": "level + 8·trend", "unit": "students"},
            # geography
            "udise_code": {"label": "UDISE code", "source": "School master CSV", "kind": "real", "unit": "id"},
            "district_name": {"label": "District", "source": "School master CSV", "kind": "real"},
            "mandal_name": {"label": "Mandal", "source": "School master CSV", "kind": "real"},
            "anon_id": {"label": "Anon ID", "source": "Stable SHA-256 hash of CHILD_SNO + per-deploy salt", "kind": "anonymised", "formula": "sha256(salt::CHILD_SNO)[:8]"},
        },
    }
    (OUT / "catalog.json").write_text(json.dumps(catalog, indent=2))
    print(f"[stage 4] catalog has {len(catalog['points'])} data points documented")

    # ---------- meta.json (provenance summary) ----------
    meta = {
        "data_provenance": {
            "real_from_uploaded_data": [
                "Student daily attendance Y/N (2023-24, 322 day-columns)",
                "Student marks FA1..FA4, SA1, SA2 (2023-24)",
                "Confirmed dropout labels CHILD_SNO (2023-24)",
                "Confirmed dropout labels CHILD_SNO (2024-25, label-only)",
                "School master: UDISE → district / mandal / cluster / lat-lng",
                "Student gender and caste category",
            ],
            "derived_from_real_data": [
                "Attendance % overall and last 30 days",
                "Attendance trend (Δ vs overall)",
                "Longest absence streak; repeated-absence cluster count",
                "Marks averages & trend (last - first valid assessment)",
                "Per-student linear contributions (coef · standardised value)",
                "Logistic / GBM cross-validated dropout probabilities",
                "Hyper-early dropout probability (weeks 1-8 features only)",
                "Risk tiering and recoverability score",
                "Next-best-action recommendation",
                "Anonymised ID (8-char SHA-256 prefix)",
            ],
            "synthetic_for_demo_only": [
                "Student first names (display only)",
                "Class & section assignment",
                "First-8-week features (proxy — re-derived from full-year when raw CSV absent)",
                "Behavioural / social signals (migration, child-labour, early-marriage, etc.)",
                "Intervention completion %, overdue / pending counts",
                "Period-over-period Δ %; weekly trend series; 30/60-day forecast",
                "Action history seeds for demo storytelling",
            ],
            "future_integration_ready": [
                "LEAP attendance, marks, profile (per LEAP User Manual)",
                "LEAP teacher observations and parent communications",
                "Welfare / scholarship / ration-card / transport allowance data",
                "Real prior-period snapshots (for Δ% without synthesis)",
                "Real intervention outcome logs (for closed-loop retraining)",
            ],
            "note_on_data": (
                "The raw 1.4M-row FY 23-24 CSV is not bundled with this repo. Stage 1 detects "
                "this and reads the previously-generated 25k-student JSON checkpoint instead. "
                "All real features carry through; first-8-week features fall back to a "
                "deterministic proxy and are clearly marked `derived_proxy` in catalog.json. "
                "When the raw CSV is supplied, Stage 1 takes the real path and produces "
                "weeks-1–8 features directly from the daily series."
            ),
        },
        "model": {
            "type": "ensemble of rules + logistic + GBM, plus hyper-early logistic",
            "tiers": ["Low", "Watch", "High Support Needed", "Critical Support Needed"],
            "explanation_method": "named rule drivers + coef·standardised-value local explanations",
            "validation": "5-fold stratified cross-validation; results in audit.json",
            "poc_targets": {"inclusion_error_max": 0.80, "exclusion_error_max": 0.20},
        },
        "anonymisation": {
            "id_scheme": "SHA-256(salt::CHILD_SNO)[:8]",
            "salt": "per-deploy (`stay-in-school-v2` in this build)",
            "name_display": "Synthetic for demo; real name surfaced only after role-based unmask",
        },
        "generated_at": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
