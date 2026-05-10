# Pending Work — Comprehensive Rebuild (status: shipped this session)

The earlier prototype read as a "static dashboard". This session implements the
rebuild promised in the previous version of this file. **All the items below are
now in place**; a short list of follow-ups (limited by the raw CSV being absent
from the repo) is at the bottom.

## What shipped

### 1. New data pipeline (5 stages, modular)

- `web/scripts/01_features.py` — feature extraction. Streams the raw FY 23-24
  CSV in 25k-row chunks when present; falls back to the previously-generated
  `students.json` checkpoint when the raw CSV isn't bundled (this repo bundle).
  Computes full-year + first-8-week features per student.
- `web/scripts/02_train.py` — trains **three** real sklearn models with 5-fold
  stratified cross-validation:
  - `LogisticRegression` (interpretable baseline; coefficients saved)
  - `GradientBoostingClassifier` (stronger non-linear estimator; feature
    importances saved)
  - `LogisticRegression` on first-8-week features (hyper-early)
  Each model's PoC inclusion / exclusion error (per the brief) is computed and
  saved.
- `web/scripts/03_score.py` — scores every student. Produces:
  - rules-based score + named drivers (compat with v1)
  - logistic probability
  - GBM probability
  - hyper-early probability
  - blended score
  - per-student linear-SHAP-equivalent contributions (`coef × standardised value`)
- `web/scripts/04_aggregate.py` — aggregates to school / mandal / district /
  state. Writes:
  - `students.json` (top-1500 by risk; lightweight)
  - `bundles/<district>.json` (full per-district student bundles; lazy-loaded)
  - `index.json` (manifest of bundles)
  - `search.json` (all visible students for the global search)
  - `forecast.json` (Holt linear projection per district, 30/60-day horizons)
  - `catalog.json` (provenance entry for every data point — 41 documented)
  - `meta.json` (real / derived / synthetic / future-LEAP buckets)
- `web/scripts/05_counsellor.py` — generates per-student counsellor artefacts:
  - 160-char parent SMS (EN + TE)
  - 5–8 point conversation guide (sensitive-topic + escalation flags)
  - 4-week remediation plan (owner + success criterion per step)

Run `python3 web/scripts/01_features.py && python3 web/scripts/02_train.py && python3 web/scripts/03_score.py && python3 web/scripts/04_aggregate.py && python3 web/scripts/05_counsellor.py`.

### 2. Anonymisation

- All client-side IDs are hashed: `SHA-256(salt::CHILD_SNO)[:8]`.
- Real names are masked by default; role-gated reveal records to the action
  log. Full role-based access matrix in `docs/access_matrix.md`.

### 3. Hyper-early detection — new "Hyper-early" tab

- Surfaces the first-8-week model. Lists students by early-probability,
  histogram of state-wide distribution, district ranking by early-flagged
  count, and per-student weeks-1–8 contributions inside Student Detail.

### 4. Closed-loop feedback

- Every "Done" action increments the `feedbackRows` counter in the store and
  triggers a "Outcome captured · model learning row +1" toast.
- The Model Audit page shows the counter prominently with a "Simulate
  retrain" button that records a timestamp.

### 5. GenAI Counsellor Assist — new "Counsellor" tab

- Pick a district → list of flagged students with sensitive-topic / escalation
  badges. Pick a student → three artefacts (SMS, guide, plan) shown side by
  side. Telugu / English toggle works on SMS and guide.

### 6. Forecasting — new "Forecast" tab

- State-level projection chart with 4 historical + 8 projected weeks.
- "Districts likely to deteriorate" table sorted by week-over-week slope.

### 7. Frontend rework

- Lazy per-district loading (no more 17 MB single JSON load — top-1500 only
  initially, full bundle on drill).
- Global search (`/` shortcut, modal) across students / schools / mandals /
  districts.
- Student Detail page rebuilt to mirror the LEAP app layout (Profile,
  Attendance, Marks, Entitlements, Action) with our risk / drivers /
  recoverability / model contributions / counsellor signal sections on top.
- New tabs: **Hyper-early**, **Counsellor**, **Forecast** alongside the
  existing dashboard / LEAP / Model audit / About.

### 8. Model Audit additions

- Three-model side-by-side card: ROC-AUC, PR-AUC, top-10% precision,
  PoC inclusion / exclusion pass/fail badges per the brief's targets.
- Logistic coefficients table + GBM feature-importance chart.
- Closed-loop feedback counter + simulated retrain trigger.
- Anonymisation panel surfacing the hash scheme + audit-trail commitments.

### 9. Observability layer

- **Every metric in the UI carries a provenance chip** indicating whether it
  is real / derived / derived-proxy / synthetic / synthetic-ops / model-output
  / forecast / anonymised.
- Hovering on a `DataPoint` or KPI shows the source, formula, and unit.
- Global "Provenance" toggle in the top bar reveals every chip at once.
- **About → Data observability** tab lists the full 41-point catalog with
  search and kind filter.

## Out of scope (unchanged)

- Real LEAP API calls (no public docs).
- Live database — the prototype stays static-served.
- Real LLM call — the counsellor templates are deterministic; a GenAI swap is
  a ~50-line change once a key is provisioned.

## Remaining follow-ups

- **Raw FY 23-24 CSV** is not bundled with this repo. Stage 1 transparently
  falls back to the existing `students.json` checkpoint and the first-8-week
  features become `derived_proxy` (flagged in `catalog.json`). When the raw
  CSV is supplied, Stage 1 takes the real-data path and the hyper-early model
  metrics will reflect actual weeks-1–8 features. This is the single biggest
  lift remaining and is mechanical.
- **Real action-log / prior-period snapshot** integration — the period-over-
  period Δ%, intervention completion %, overdue counts and forecasts are
  currently synthesised from the seed. Wiring these to a persistent store +
  LEAP write-back is straightforward.
- **Anthropic LLM swap** in `05_counsellor.py` — drop in a `messages.create`
  call with the existing template-selection rule as the prompt skeleton.
