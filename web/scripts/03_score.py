"""Stage 3 — score every student.

Combines:
  - rules-based score (carried over from v1; deterministic, explainable)
  - logistic probability (interpretable real ML)
  - GBM probability (stronger non-linear ML)
  - hyper-early probability (first-8-week-only ML)
And produces honest per-student feature contributions
(coef * standardised_feature_value) for the linear model — this is the
local explanation surfaced in the UI alongside the named rule drivers.

Output: _cache/students_scored.json
"""
from __future__ import annotations
import json
import random
from pathlib import Path

import numpy as np

CACHE = Path(__file__).resolve().parent / "_cache"
FEAT = CACHE / "features.json"
MODELS = CACHE / "models.json"


DRIVER_LABEL = {
    "attendance_pct": "Attendance",
    "recent_attendance_pct": "Recent attendance",
    "attendance_delta_30d": "Attendance trend (last 30d)",
    "longest_absence_streak": "Longest absence streak",
    "repeated_absence_clusters": "Repeated absence pattern",
    "absent_days": "Days absent",
    "fa_avg": "FA marks avg",
    "sa_avg": "SA marks avg",
    "overall_marks": "Overall marks",
    "marks_trend": "Marks trend",
    "syn::seasonal_migration_possibility": "Seasonal migration risk",
    "syn::financial_stress": "Financial stress",
    "syn::child_labour_concern": "Child labour concern",
    "syn::early_marriage_concern": "Early marriage concern",
    "syn::behavioural_disengagement": "Behavioural disengagement",
    "syn::transport_difficulty": "Transport difficulty",
    "syn::peer_isolation": "Peer isolation",
    "syn::parent_engagement_low": "Low parent engagement",
}


# Same rules-based score as v1 — preserved for compatibility & explainability.
def rules_score(f: dict, syn: dict) -> tuple[float, list[dict]]:
    drv = []; sc = 0.0
    att = f.get("attendance_pct") or 0
    if att < 50: sc += 35; drv.append({"key": "low_attendance", "weight": 35, "label": f"Attendance {att:.0f}% (severe)"})
    elif att < 65: sc += 22; drv.append({"key": "low_attendance", "weight": 22, "label": f"Attendance {att:.0f}% (low)"})
    elif att < 75: sc += 10; drv.append({"key": "low_attendance", "weight": 10, "label": f"Attendance {att:.0f}% (below norm)"})
    delta = f.get("attendance_delta_30d") or 0
    if delta < -15: sc += 18; drv.append({"key": "recent_decline", "weight": 18, "label": f"Attendance fell {abs(delta):.0f}pp in last 30 days"})
    elif delta < -7: sc += 9; drv.append({"key": "recent_decline", "weight": 9, "label": f"Attendance fell {abs(delta):.0f}pp recently"})
    streak = f.get("longest_absence_streak", 0)
    if streak >= 14: sc += 14; drv.append({"key": "long_streak", "weight": 14, "label": f"Longest absence streak: {streak} days"})
    elif streak >= 7: sc += 7; drv.append({"key": "long_streak", "weight": 7, "label": f"Long absence streak: {streak} days"})
    clusters = f.get("repeated_absence_clusters", 0)
    if clusters >= 8: sc += 6; drv.append({"key": "patterned_absence", "weight": 6, "label": f"Repeated absence pattern ({clusters} clusters)"})
    marks = f.get("overall_marks")
    trend = f.get("marks_trend")
    if marks is not None:
        if marks < 100: sc += 10; drv.append({"key": "low_marks", "weight": 10, "label": f"Average marks {marks:.0f} (low)"})
        elif marks < 150: sc += 5; drv.append({"key": "low_marks", "weight": 5, "label": f"Average marks {marks:.0f} (below norm)"})
    if trend is not None and trend < -25:
        sc += 8; drv.append({"key": "marks_decline", "weight": 8, "label": f"Marks declined by {abs(trend):.0f}"})

    if syn.get("seasonal_migration_possibility"):
        sc += 6; drv.append({"key": "migration_risk", "weight": 6, "label": "Seasonal migration risk"})
    if syn.get("financial_stress"):
        sc += 5; drv.append({"key": "financial_stress", "weight": 5, "label": "Household financial stress"})
    if syn.get("child_labour_concern"):
        sc += 7; drv.append({"key": "child_labour", "weight": 7, "label": "Child labour concern"})
    if syn.get("early_marriage_concern"):
        sc += 8; drv.append({"key": "early_marriage", "weight": 8, "label": "Early marriage vulnerability"})
    if syn.get("behavioural_disengagement"):
        sc += 4; drv.append({"key": "behaviour", "weight": 4, "label": "Behavioural disengagement reported"})
    if syn.get("transport_difficulty"):
        sc += 3; drv.append({"key": "transport", "weight": 3, "label": "Transport difficulty"})
    if syn.get("parent_engagement") == "Low":
        sc += 3; drv.append({"key": "parent_engagement", "weight": 3, "label": "Low parent engagement"})

    return min(100.0, sc), drv


def tier(score: float) -> str:
    if score < 20: return "Low"
    if score < 40: return "Watch"
    if score < 65: return "High Support Needed"
    return "Critical Support Needed"


def recoverability(f: dict, score: float) -> str:
    marks = f.get("overall_marks") or 0
    delta = f.get("attendance_delta_30d") or 0
    trend = f.get("marks_trend") or 0
    streak = f.get("longest_absence_streak", 0)
    if score >= 65:
        if marks >= 130 and streak < 21 and trend > -40:
            return "High Recoverability"
        return "Low Recoverability"
    if score >= 40:
        if delta > -10 and marks >= 100:
            return "High Recoverability"
        return "Medium Recoverability"
    return "Stable"


def recommended_action(f: dict, syn: dict, score: float) -> dict:
    if syn.get("child_labour_concern") or syn.get("early_marriage_concern"):
        return {"action": "Counselling + Headmaster Meeting", "owner": "Headmaster",
                "reason": "Sensitive social risk indicator", "due_in_days": 2}
    if syn.get("seasonal_migration_possibility") and (f.get("attendance_delta_30d") or 0) < -10:
        return {"action": "Migration Verification (home visit)", "owner": "Mandal Officer",
                "reason": "Seasonal migration suspected with recent attendance fall", "due_in_days": 3}
    if (f.get("longest_absence_streak", 0) >= 7) or (f.get("attendance_pct") or 0) < 60:
        return {"action": "Home Visit + Parent Call", "owner": "Teacher",
                "reason": "Sustained absenteeism", "due_in_days": 2}
    if (f.get("marks_trend") or 0) < -25 or (f.get("overall_marks") or 999) < 120:
        return {"action": "Academic Remediation", "owner": "Teacher",
                "reason": "Academic decline", "due_in_days": 5}
    if syn.get("transport_difficulty"):
        return {"action": "Transport Support Verification", "owner": "Mandal Officer",
                "reason": "Possible transport difficulty", "due_in_days": 7}
    if score >= 40:
        return {"action": "Parent SMS + Teacher Check-in", "owner": "Teacher",
                "reason": "Watchlist case", "due_in_days": 3}
    return {"action": "Routine attendance monitoring", "owner": "Teacher",
            "reason": "Stable", "due_in_days": 14}


# --- Synthetic display name (kept here so the JSON stays self-contained) ----
M_NAMES = ["Ravi","Kiran","Suresh","Naveen","Bhanu","Vikram","Mahesh","Ramesh","Ajay","Praveen","Srinivas","Rohit","Krishna","Anand","Ganesh","Pavan"]
F_NAMES = ["Lakshmi","Anjali","Priya","Divya","Sneha","Kavya","Pavithra","Bhavana","Padma","Sandhya","Meena","Sushma","Aruna","Kalyani","Madhuri"]
SURNAMES = ["Reddy","Rao","Naidu","Sharma","Kumar","Devi","Sastry","Babu","Murthy","Chowdary"]


def synth_name(child_sno: int, gender: str) -> str:
    rng = random.Random(int(child_sno))
    first = rng.choice(M_NAMES if gender == "Male" else F_NAMES)
    last = rng.choice(SURNAMES)
    return f"{first} {last}"


def _standardise(x: list[float], mean: list[float], scale: list[float]) -> list[float]:
    out = []
    for v, m, s in zip(x, mean, scale):
        s = s if s != 0 else 1.0
        out.append((v - m) / s)
    return out


def featurise(r: dict, feature_keys: list[str]):
    f = r["f"]; syn = r.get("syn") or {}
    x = []
    for k in feature_keys:
        if k.startswith("syn::"):
            key = k[5:]
            if key == "parent_engagement_low":
                x.append(1.0 if syn.get("parent_engagement") == "Low" else 0.0)
            else:
                x.append(1.0 if syn.get(key) else 0.0)
        else:
            v = f.get(k)
            try:
                x.append(0.0 if v is None else float(v))
            except (TypeError, ValueError):
                x.append(0.0)
    return x


def main():
    print("[stage 3] loading features + models...")
    rows = json.loads(FEAT.read_text())
    models = json.loads(MODELS.read_text())
    log = models["logistic"]
    early = models["hyper_early"]

    log_proba = np.load(CACHE / "log_proba.npy")
    gbm_proba = np.load(CACHE / "gbm_proba.npy")
    early_proba = np.load(CACHE / "early_proba.npy")

    out = []
    for i, r in enumerate(rows):
        f = r["f"]; syn = r.get("syn") or {}
        # rules-based score (compat with v1 + named drivers)
        rsc, rdrv = rules_score(f, syn)

        # Local logistic contributions (coef * standardised x).
        x = featurise(r, log["feature_keys"])
        xs = _standardise(x, log["scaler_mean"], log["scaler_scale"])
        contrib = []
        for k, c, s in zip(log["feature_keys"], log["coefficients"], xs):
            cval = c * s
            if abs(cval) < 0.05:
                continue
            contrib.append({
                "key": k, "label": DRIVER_LABEL.get(k, k),
                "contribution": round(cval, 3),
                "raw_value": x[log["feature_keys"].index(k)],
            })
        contrib.sort(key=lambda d: -abs(d["contribution"]))

        # Hyper-early contributions
        e = r["first8"]
        ex = [float(e.get(k) or 0) for k in early["feature_keys"]]
        exs = _standardise(ex, early["scaler_mean"], early["scaler_scale"])
        early_contrib = [
            {"key": k, "label": k.replace("first8_", "First-8wk ").replace("_", " "),
             "contribution": round(c * s, 3), "raw_value": ex[idx]}
            for idx, (k, c, s) in enumerate(zip(early["feature_keys"], early["coefficients"], exs))
            if abs(c * s) > 0.02
        ]

        tier_name = tier(rsc)
        score_blend = round(0.4 * rsc + 0.3 * log_proba[i] * 100 + 0.3 * gbm_proba[i] * 100, 1)
        recov = recoverability(f, rsc)
        act = recommended_action(f, syn, rsc)

        out.append({
            "id": r["id"],
            "anon_id": r["anon_id"],
            "name": synth_name(r["id"], r.get("gender", "Male")),
            "gender": r.get("gender"),
            "caste": r.get("caste"),
            "class": r.get("class"),
            "section": r.get("section"),
            "udise": r.get("udise"),
            "school_name": r.get("school_name"),
            "district": r.get("district"),
            "mandal": r.get("mandal"),
            "f": f,
            "first8": r["first8"],
            "syn": syn,
            "drop": r["dropped_23_24"],
            "rules": {"score": round(rsc, 1), "tier": tier_name, "drivers": rdrv[:6]},
            "ml": {
                "logistic_proba": round(float(log_proba[i]), 4),
                "gbm_proba": round(float(gbm_proba[i]), 4),
                "early_proba": round(float(early_proba[i]), 4),
                "blended_score": score_blend,
                "logistic_contrib": contrib[:6],
                "early_contrib": early_contrib,
            },
            "recoverability": recov,
            "action": act,
        })

    (CACHE / "students_scored.json").write_text(json.dumps(out, separators=(",", ":")))
    print(f"[stage 3] wrote {len(out):,} scored students")


if __name__ == "__main__":
    main()
