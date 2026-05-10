# Stay-In School · Student Retention Intelligence

Prototype for the **Stay-In School Hackathon** (School Education Department, Government of Andhra Pradesh).

> *From early warning to verified action — the system helps every level of the department know where dropout risk is rising, why it is rising, who must act, and whether action worked.*

## What this is

A role-aware, action-first prototype that goes beyond a generic dropout dashboard:

- **State Officer** — district-comparison view, risk trends, scenario planning ("if we can act on only 10,000 students this month, focus where?"), policy insights, hotspot map, escalation backlog.
- **District Officer** — mandal & school priority list, this-week action plan, ability to assign tasks to MEOs, intervention completion tracking.
- **Mandal Officer (MEO)** — school-level risk queue, home visit queue, action ageing (3 / 7 / 14 days), escalation to district.
- **Headmaster** — today's student action queue, class-wise risk, sudden attendance drops, academic decline, recoverable students.
- **Class Teacher** — 5–10 priority students with plain-language reasons, one-tap parent SMS / call / mark-action-done, supportive (non-stigmatising) wording, Telugu / English toggle, in-line behavioural flagging.

Every drill-down preserves context: **State → District → Mandal → School → Class → Student**, with a back trail.

Plus: a **LEAP integration concept** (what's pulled, what's pushed, role-based access, privacy) and a **Model audit & fairness panel** (top-decile precision/capture, score separation, gender & caste fairness, named drivers — no SHAP shown to officers).

## Running

```bash
# 1. (Optional) preprocess data — only needed if you change the raw inputs.
#    The repo already ships generated JSON under web/app/public/data/.
pip install pandas openpyxl numpy scikit-learn pyarrow

python3 web/scripts/01_features.py     # feature extraction (CSV stream or JSON fallback)
python3 web/scripts/02_train.py        # logistic + GBM + hyper-early models (5-fold CV)
python3 web/scripts/03_score.py        # per-student scores + local explanations
python3 web/scripts/04_aggregate.py    # state / district / mandal / school + forecast + catalog
python3 web/scripts/05_counsellor.py   # SMS / guide / remediation plan per student

# 2. Run the web app
cd web/app
npm install
npm run dev    # http://localhost:5173 (or next free port)
```

Switch role from the dropdown in the top bar. Tabs: **Dashboard · Hyper-early · Counsellor · Forecast · LEAP integration · Model audit · About**.
Press `/` from anywhere to open the global search.

## Data

| File | What we use it for |
| --- | --- |
| `data_FIN_YEAR_2023-2024 (1).csv` | student-level daily attendance (322 columns) + FA/SA marks for 2023-24 — primary feature source |
| `CHILDSNO_Dropped_2023_24 (2).xlsx` | 23-24 dropout label (ground-truth for model evaluation) |
| `CHILDSNO_Dropped_2024_25 (2).xlsx` | 24-25 dropout IDs (label-only — 24-25 full data is not present, so we don't fabricate it) |
| `School Location Master Data (1).csv` | UDISE → district / mandal / cluster / lat-lng |

The prototype processes a stratified 25,000-student sample (all 6,000 dropouts encountered + ~19,000 non-dropouts) for fast load. The system is designed to scale to the full dataset.

## What's real vs synthetic vs future

The **About** and **Model audit** tabs spell this out. In short:

- **Real (from uploaded data):** attendance %, recent attendance Δ, longest absence streak, repeated-absence clusters, FA/SA marks & trend, gender, caste, school → district / mandal / cluster, dropout labels.
- **Synthetic (clearly marked):** student first names (display only), behavioural & social signals (migration, financial stress, child-labour concern, early-marriage concern, etc.), intervention completion %, period-over-period change, action history seeds.
- **Future LEAP integration ready:** teacher observations, parent communications, welfare/scholarship data, transport allowance data, ration-card / migration proxy.

## Risk model

Transparent, rules-based, interpretable (no black box):

```
risk = low_attendance(0..35) + recent_decline(0..18) + long_streak(0..14)
     + patterned_absence(0..6) + low_marks(0..10) + marks_decline(0..8)
     + synthetic boosters: migration, financial_stress, child_labour,
                           early_marriage, behaviour, transport, parent_engagement
```

Tiering: `Low (<20) · Watch (<40) · High Support Needed (<65) · Critical Support Needed (≥65)`.
Each tier maps to a recommended next-best-action with owner, due date, and escalation chain.

A **Recoverability** layer separates "high risk + high recoverability" (best ROI for action) from "high risk + low recoverability".

### Honest evaluation (on the full 25k sample)

| Metric | Value |
| --- | --- |
| Top-10% precision | **56.3%** |
| Top-10% capture rate | 23.4% |
| Top-20% precision | 51.2% |
| Top-20% capture rate | 42.7% |
| Avg risk — actual dropouts | 44.8 |
| Avg risk — non-dropouts | 23.8 |
| Score separation | 21 pts |

These come from `web/app/public/data/audit.json`, computed in [`web/scripts/preprocess.py`](web/scripts/preprocess.py).

## File map

```
web/
  scripts/preprocess.py     # CSV/XLSX → JSON pipeline
  app/                      # Vite + React + Tailwind
    src/
      App.tsx
      data.ts               # JSON loader
      store.ts              # zustand: role, language, drill selection, action log
      i18n.ts               # English / Telugu strings
      types.ts
      util.ts
      components/
        Layout.tsx          # top bar, breadcrumb, role switcher
        UI.tsx              # KPI, RiskBadge, Tag, ProgressBar, Section
        ActionDialog.tsx    # mark action / escalate / observation
        StudentDetail.tsx   # drill-down student view
      views/
        StateView.tsx
        DistrictView.tsx
        MandalView.tsx
        SchoolView.tsx
        HeadmasterView.tsx
        TeacherView.tsx
        LeapIntegration.tsx
        ModelAudit.tsx
        About.tsx
    public/data/            # generated JSON (~17MB, gzip ~3MB)
```
