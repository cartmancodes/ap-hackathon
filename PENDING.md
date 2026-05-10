# Pending Work — Comprehensive Rebuild

The current build (`web/app/`) is a working role-aware prototype with state / district / mandal / headmaster / teacher views, drill-down, intervention tracking, escalation flow, Telugu / English toggle, LEAP integration concept, and a fairness audit. Risk is computed from a 25,000-student stratified sample of FY 23-24.

After re-reading **all four briefs**, the user flagged that the prototype reads as a "static dashboard". Below is the planned rebuild that addresses this — to be picked up next session.

## Why a rebuild

The three briefs together demand more than precomputed JSON:

1. **Brief — School Education / Stay-In School** — explicit PoC criteria (inclusion error <80%, exclusion error <20%); demands an actual ML model with measurable error rates, not a rules-only score.
2. **RTGS Pre-Orientation** — names three innovation focus areas not yet implemented:
   - **Hyper-Early Detection** (within first 4–8 weeks, before grades exist)
   - **GenAI Counsellor Assist** (parent communication scripts, conversation guides, remediation plans)
   - **Closed-Loop Feedback** (intervention outcome → retraining)
3. **LEAP App User Manual** — the LEAP buckets (School / Student / Teacher / Governance / Communication / Dashboard) and the actual student profile fields (UDISE, admission no., FA1–SA1 marks, days present / absent / meals availed, working days, teacher mapping) need to drive the student-detail surface so the prototype feels native to LEAP, not bolted on.

## Plan

### 1. Data pipeline — process the **full** FY 23-24 dataset

Currently we sample 25,000 students. The CSV has ~1.4M. Stream-process all of it; generate parquet checkpoints to keep memory bounded.

- `web/scripts/preprocess.py` → split into:
  - `01_features.py`: stream `data_FIN_YEAR_2023-2024 (1).csv` in 25k-row chunks, compute per-student features (full-year + first-8-weeks separately for hyper-early), write to `features.parquet`
  - `02_train.py`: train sklearn `LogisticRegression` (interpretable baseline) **and** `GradientBoostingClassifier` (stronger), evaluate with recall / precision / F1 / ROC-AUC / PR-AUC / top-decile capture / inclusion-error / exclusion-error against confirmed 23-24 dropouts. Save coefficients for explainability.
  - `03_score.py`: score every student, write `students.parquet` with risk, tier, recoverability, and per-student feature contributions (linear-model SHAP equivalent — `coef * feature_value` as honest local explanation).
  - `04_aggregate.py`: emit JSON (state / districts / mandals / schools / per-district student bundles for lazy-load).
  - `05_counsellor.py`: rule-based persona templates that produce parent SMS / conversation guide / remediation plan per student — generated text quality similar to LLM output, deterministic, in Telugu and English.

### 2. Anonymisation
- Hash CHILD_SNO with a per-deploy salt before any client output (`H(salt + id)[:8]`).
- Replace synthetic display names with hashed ID + role-only-revealed name.

### 3. Hyper-early detection
A second model trained only on first-8-week features (attendance week 1–8, no marks). Used at start-of-year to flag students whose full-year data isn't available yet. Show a dedicated view per role.

### 4. Closed-loop feedback
- Action log → outcome capture → quarterly retraining.
- Frontend simulates this: when a teacher logs an intervention with positive outcome, a "model learning" toast appears + the model audit page increments a "feedback rows captured" counter.
- Real version: `06_retrain.py` ingests the action log, joins with attendance recovery 30-days later, retrains.

### 5. GenAI Counsellor Assist
- A new tab. Pick a student → generate three artefacts:
  - **Parent SMS** (≤160 chars, supportive wording, Telugu / English).
  - **Conversation guide for the counsellor** — 5–8 talking points keyed to the student's drivers, with sensitive-topic escalation rules (e.g. early-marriage concern → mandal officer must be looped in).
  - **Remediation plan** — concrete weekly actions, owner, success criterion.
- Templates are deterministic now; swap in a prompt-tuned LLM call when an API key is available.

### 6. Forecasting
- School-level rolling 4-week trend → simple Holt linear projection of high-risk count for next 30 / 60 days.
- "Schools likely to deteriorate if no action is taken" — top 20 by trend slope.

### 7. Frontend rework
- **Lazy-load** student lists by district (avoids the 17 MB single JSON load).
- **Global search** across students / schools / mandals with a `/` shortcut.
- **Student detail page** mirrors the LEAP app's actual layout: profile (UDISE, admission no., DOB, gender, blood group, BMI), attendance (academic-year + monthly bar), marks (FA1 / FA2 / FA3 / FA4 / SA1 / SA2 with grade), entitlements, actions — then our risk / drivers / recoverability / counsellor-assist on top.
- **Hyper-Early Detection** view (per role).
- **Forecast** view (state and district level).
- **Counsellor Assist** view.

### 8. Model audit page additions
- Inclusion-error / exclusion-error against the brief's PoC criteria, with pass/fail badge.
- Per-district fairness panel (over-flagging by gender / caste / district).
- Closed-loop feedback counter + simulated retraining timestamp.
- Hyper-early model metrics (separate column from full-year model).

### 9. Anonymisation & PDPB 2023 alignment
- Document role-based access matrix in `docs/access_matrix.md`.
- Audit trail for every automated recommendation (already partially in place via the action log).
- Bias check matrix surfaced in the audit tab.

## Out of scope (intentionally)

- Real LEAP API calls (no public docs).
- Live database — the prototype stays static-served. The `parquet → JSON` pipeline handles "what would normally be an API" cleanly enough for a hackathon demo.
- Real LLM call — the counsellor templates are rule-based; a GenAI swap is a 50-line change once a key is provisioned.
- Full-year 2024-25 analysis — the file is ID-only, so we don't fabricate features (per the brief).

## Files that will change

- `web/scripts/preprocess.py` → split into the five stages above
- `web/app/public/data/` → richer set of JSON files + per-district bundles
- `web/app/src/data.ts` → lazy-load + index
- `web/app/src/views/` → add `Counsellor.tsx`, `EarlyWarning.tsx`, `Forecast.tsx`, `Search.tsx`; rework `StudentDetail.tsx` to LEAP-native layout
- `web/app/src/views/ModelAudit.tsx` → real metrics + PoC pass/fail
- `docs/access_matrix.md` → new

## How to resume

```bash
# 1. (Optional) free disk — the rebuild needs ~3 GB headroom for parquet + sklearn training
df -h /

# 2. Run the new pipeline
.venv/bin/pip install pyarrow scikit-learn  # already installed
.venv/bin/python web/scripts/01_features.py
.venv/bin/python web/scripts/02_train.py
.venv/bin/python web/scripts/03_score.py
.venv/bin/python web/scripts/04_aggregate.py
.venv/bin/python web/scripts/05_counsellor.py

# 3. Frontend
cd web/app && npm run dev
```
