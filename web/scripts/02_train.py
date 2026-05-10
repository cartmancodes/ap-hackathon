"""Stage 2 — train two real ML models on the feature set.

Models:
1. `LogisticRegression`  — interpretable baseline; coefficients are saved and used
   downstream to produce per-student linear-SHAP-equivalent explanations
   (coef * standardised_feature_value).
2. `GradientBoostingClassifier` — stronger non-linear model. Used for the
   reported risk-percentile and for stress-testing the rules baseline.
3. `Hyper-early model` — logistic trained only on first-8-week features.

Outputs (under _cache/):
  - models.json        : coefficients + scaler stats + thresholds + metrics
  - audit.json         : evaluation metrics incl. PoC inclusion / exclusion error
"""
from __future__ import annotations
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, roc_auc_score,
                             precision_recall_curve, confusion_matrix)
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler

CACHE = Path(__file__).resolve().parent / "_cache"
FEAT = CACHE / "features.json"


FEATURE_KEYS = [
    "attendance_pct",
    "recent_attendance_pct",
    "attendance_delta_30d",
    "longest_absence_streak",
    "repeated_absence_clusters",
    "absent_days",
    "fa_avg",
    "sa_avg",
    "overall_marks",
    "marks_trend",
]
SYN_KEYS = [
    "seasonal_migration_possibility",
    "financial_stress",
    "child_labour_concern",
    "early_marriage_concern",
    "behavioural_disengagement",
    "transport_difficulty",
    "peer_isolation",
]
SYN_PARENT_LOW = "parent_engagement"  # categorical → 1 if Low

EARLY_KEYS = [
    "first8_attendance_pct",
    "first8_absent_days",
    "first8_longest_streak",
]


def _to_float(v):
    if v is None:
        return 0.0
    try:
        x = float(v)
        if np.isnan(x) or np.isinf(x):
            return 0.0
        return x
    except (TypeError, ValueError):
        return 0.0


def build_full_matrix(rows: list[dict]):
    X = []
    y = []
    for r in rows:
        f = r["f"]; syn = r.get("syn") or {}
        x = [_to_float(f.get(k)) for k in FEATURE_KEYS]
        for k in SYN_KEYS:
            x.append(1.0 if syn.get(k) else 0.0)
        x.append(1.0 if syn.get(SYN_PARENT_LOW) == "Low" else 0.0)
        X.append(x)
        y.append(1 if r["dropped_23_24"] else 0)
    return np.array(X, float), np.array(y, int)


def build_early_matrix(rows: list[dict]):
    X = []; y = []
    for r in rows:
        e = r["first8"]
        X.append([_to_float(e.get(k)) for k in EARLY_KEYS])
        y.append(1 if r["dropped_23_24"] else 0)
    return np.array(X, float), np.array(y, int)


def fit_logistic(X, y):
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    model = LogisticRegression(max_iter=300, class_weight="balanced", C=0.7, random_state=7)
    model.fit(Xs, y)
    return model, scaler


def cv_metrics(X, y, mk, n_splits=5):
    """Out-of-fold metrics — avoids overfitting bias on the same data."""
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=7)
    proba = np.zeros(len(y), float)
    for tr, te in skf.split(X, y):
        m, s = mk(X[tr], y[tr])
        proba[te] = m.predict_proba(s.transform(X[te]))[:, 1]
    return proba


def gbm_proba(X, y):
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=7)
    proba = np.zeros(len(y), float)
    for tr, te in skf.split(X, y):
        m = GradientBoostingClassifier(
            n_estimators=120, max_depth=3, learning_rate=0.1, random_state=7
        )
        m.fit(X[tr], y[tr])
        proba[te] = m.predict_proba(X[te])[:, 1]
    return proba


def topk_metrics(proba, y, k_pct):
    order = np.argsort(-proba)
    cutoff = max(1, int(len(y) * k_pct))
    selected = order[:cutoff]
    captured = int(y[selected].sum())
    total_pos = int(y.sum())
    precision = captured / cutoff
    recall = captured / max(1, total_pos)
    return {"k_pct": k_pct, "n_selected": cutoff,
            "precision": round(precision, 4), "recall": round(recall, 4),
            "captured": captured, "total_dropouts": total_pos}


def poc_errors(proba, y, threshold_percentile=20):
    """PoC criteria from the brief:
      - **inclusion error** = false-positive rate among flagged ≤ 80% (we report
        the fraction of FLAGGED who didn't drop; <80% means most flagged are
        true positives — note: the brief's threshold is permissive).
      - **exclusion error** = false-negative rate among NOT flagged ≤ 20%
        (fraction of actual dropouts that the model missed in the flagged set).
    We pick a percentile cutoff (top-20% by default) as the flag boundary.
    """
    order = np.argsort(-proba)
    flag = np.zeros_like(y); flag[order[: max(1, int(len(y) * threshold_percentile / 100))]] = 1
    tn, fp, fn, tp = confusion_matrix(y, flag).ravel()
    inclusion_err = fp / max(1, fp + tp)              # of those flagged, fraction false
    exclusion_err = fn / max(1, fn + tp)              # of all positives, fraction missed
    return {
        "threshold_percentile": threshold_percentile,
        "true_positive": int(tp), "false_positive": int(fp),
        "true_negative": int(tn), "false_negative": int(fn),
        "inclusion_error": round(inclusion_err, 4),
        "exclusion_error": round(exclusion_err, 4),
        "inclusion_target": 0.80,
        "exclusion_target": 0.20,
        "inclusion_pass": bool(inclusion_err < 0.80),
        "exclusion_pass": bool(exclusion_err < 0.20),
    }


def main():
    print("[stage 2] loading features...")
    rows = json.loads(FEAT.read_text())
    print(f"[stage 2] {len(rows):,} rows; dropouts={sum(r['dropped_23_24'] for r in rows):,}")

    print("[stage 2] building matrices...")
    X_full, y = build_full_matrix(rows)
    X_early, _ = build_early_matrix(rows)

    print("[stage 2] training logistic (full features)...")
    log_model, log_scaler = fit_logistic(X_full, y)
    log_proba = cv_metrics(X_full, y, fit_logistic)

    print("[stage 2] training GBM (full features)...")
    gbm_p = gbm_proba(X_full, y)
    # also fit on full data for downstream use
    full_gbm = GradientBoostingClassifier(n_estimators=120, max_depth=3, learning_rate=0.1, random_state=7).fit(X_full, y)

    print("[stage 2] training hyper-early logistic (first-8-week features)...")
    early_model, early_scaler = fit_logistic(X_early, y)
    early_proba = cv_metrics(X_early, y, fit_logistic)

    # ---------- metrics ----------
    def md(name, proba):
        return {
            "name": name,
            "roc_auc": round(roc_auc_score(y, proba), 4),
            "pr_auc": round(average_precision_score(y, proba), 4),
            "top10": topk_metrics(proba, y, 0.10),
            "top20": topk_metrics(proba, y, 0.20),
            "poc_top20": poc_errors(proba, y, 20),
        }

    audit = {
        "n": int(len(y)),
        "dropouts": int(y.sum()),
        "models": {
            "logistic": md("Logistic (interpretable baseline)", log_proba),
            "gbm": md("Gradient Boosting", gbm_p),
            "hyper_early": md("Hyper-early (weeks 1-8 only)", early_proba),
        },
    }

    # Persist models -----------------------------------------------------------
    models = {
        "logistic": {
            "feature_keys": FEATURE_KEYS + [f"syn::{k}" for k in SYN_KEYS] + ["syn::parent_engagement_low"],
            "coefficients": log_model.coef_[0].tolist(),
            "intercept": float(log_model.intercept_[0]),
            "scaler_mean": log_scaler.mean_.tolist(),
            "scaler_scale": log_scaler.scale_.tolist(),
        },
        "hyper_early": {
            "feature_keys": EARLY_KEYS,
            "coefficients": early_model.coef_[0].tolist(),
            "intercept": float(early_model.intercept_[0]),
            "scaler_mean": early_scaler.mean_.tolist(),
            "scaler_scale": early_scaler.scale_.tolist(),
        },
        "gbm_feature_importance": dict(zip(
            FEATURE_KEYS + [f"syn::{k}" for k in SYN_KEYS] + ["syn::parent_engagement_low"],
            [float(x) for x in full_gbm.feature_importances_],
        )),
    }
    (CACHE / "models.json").write_text(json.dumps(models, indent=2))
    (CACHE / "audit.json").write_text(json.dumps(audit, indent=2))

    # CV probabilities — used by stage 3 for honest per-student scoring
    np.save(CACHE / "log_proba.npy", log_proba)
    np.save(CACHE / "gbm_proba.npy", gbm_p)
    np.save(CACHE / "early_proba.npy", early_proba)

    print("[stage 2] audit summary:")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
