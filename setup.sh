#!/usr/bin/env bash
#
# Stay-In School — one-shot setup + run.
#
# What this does, in order:
#   1. Sanity-check Python 3 and Node 20+ are present.
#   2. Create .venv (Python virtual environment) and install pandas, numpy,
#      scikit-learn, pyarrow, openpyxl.
#   3. Run the 5-stage data pipeline (features → train → score → aggregate →
#      counsellor) — only when an input file changed or outputs are missing.
#   4. Run `npm install` for the React app (only if node_modules is missing).
#   5. Start `npm run dev` and print the URL the user should open.
#
# Flags:
#   --skip-pipeline   skip the Python pipeline (use existing JSON in
#                     web/app/public/data/)
#   --skip-deps       skip dependency installation (Python + npm)
#   --no-run          do everything except start the dev server
#   --rebuild         force re-running the pipeline even if outputs exist
#
# Re-run safely. Each step is idempotent.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

VENV="$ROOT/.venv"
APP="$ROOT/web/app"
DATA_DIR="$APP/public/data"
SCRIPTS="$ROOT/web/scripts"

SKIP_PIPELINE=0
SKIP_DEPS=0
NO_RUN=0
REBUILD=0

for arg in "$@"; do
  case "$arg" in
    --skip-pipeline) SKIP_PIPELINE=1 ;;
    --skip-deps)     SKIP_DEPS=1 ;;
    --no-run)        NO_RUN=1 ;;
    --rebuild)       REBUILD=1 ;;
    -h|--help)
      sed -n '2,21p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg" >&2
      echo "Run with --help to see options." >&2
      exit 1
      ;;
  esac
done

# ---- Pretty print helpers ----------------------------------------------------
if [ -t 1 ]; then
  BOLD="$(printf '\033[1m')"
  DIM="$(printf '\033[2m')"
  GREEN="$(printf '\033[32m')"
  YELLOW="$(printf '\033[33m')"
  RED="$(printf '\033[31m')"
  RESET="$(printf '\033[0m')"
else
  BOLD=""; DIM=""; GREEN=""; YELLOW=""; RED=""; RESET=""
fi

step() { printf "\n${BOLD}==> %s${RESET}\n" "$*"; }
info() { printf "    %s\n" "$*"; }
warn() { printf "${YELLOW}    warn: %s${RESET}\n" "$*"; }
fail() { printf "${RED}    error: %s${RESET}\n" "$*" >&2; exit 1; }
ok()   { printf "${GREEN}    ok${RESET} %s\n" "$*"; }

# ---- 1. Sanity checks --------------------------------------------------------
step "Checking prerequisites"

if ! command -v python3 >/dev/null 2>&1; then
  fail "python3 not found. Install Python 3.10+ from https://www.python.org/"
fi
PY_VER="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
info "python3 ${PY_VER} found"

if ! command -v node >/dev/null 2>&1; then
  fail "node not found. Install Node.js 20+ from https://nodejs.org/"
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
info "node $(node -v) found"
if [ "$NODE_MAJOR" -lt 20 ]; then
  warn "Node 20+ recommended. You have $(node -v)."
fi

if ! command -v npm >/dev/null 2>&1; then
  fail "npm not found. It ships with Node.js."
fi
info "npm $(npm -v) found"

# ---- 2. Python venv + deps ---------------------------------------------------
if [ "$SKIP_DEPS" -eq 0 ]; then
  step "Setting up Python virtual environment (${DIM}.venv/${RESET})"
  if [ ! -d "$VENV" ]; then
    python3 -m venv "$VENV"
    ok "created .venv"
  else
    info ".venv already exists"
  fi

  # shellcheck source=/dev/null
  source "$VENV/bin/activate"

  STAMP="$VENV/.deps_installed"
  REQS="pandas numpy scikit-learn pyarrow openpyxl"
  if [ ! -f "$STAMP" ] || [ "$REBUILD" -eq 1 ]; then
    info "installing: $REQS"
    pip install --quiet --upgrade pip
    # shellcheck disable=SC2086
    pip install --quiet $REQS
    touch "$STAMP"
    ok "Python dependencies installed"
  else
    info "Python dependencies already installed (delete $STAMP to force reinstall)"
  fi
else
  step "Skipping Python dependency installation (--skip-deps)"
  if [ -d "$VENV" ]; then
    # shellcheck source=/dev/null
    source "$VENV/bin/activate"
  fi
fi

# ---- 3. Data pipeline --------------------------------------------------------
if [ "$SKIP_PIPELINE" -eq 0 ]; then
  step "Running data pipeline (5 stages)"

  PIPELINE_NEEDED=0
  if [ "$REBUILD" -eq 1 ]; then
    PIPELINE_NEEDED=1
    info "force rebuild requested"
  elif [ ! -f "$DATA_DIR/catalog.json" ] || [ ! -f "$DATA_DIR/forecast.json" ] || [ ! -d "$DATA_DIR/bundles" ]; then
    PIPELINE_NEEDED=1
    info "expected output files missing — running pipeline"
  else
    info "outputs exist in $DATA_DIR — skipping (use --rebuild to force)"
  fi

  if [ "$PIPELINE_NEEDED" -eq 1 ]; then
    info "Stage 1/5: feature extraction"
    python3 "$SCRIPTS/01_features.py"

    info "Stage 2/5: training models (logistic + GBM + hyper-early)"
    python3 "$SCRIPTS/02_train.py" > /tmp/stay-train.log 2>&1 || {
      cat /tmp/stay-train.log >&2
      fail "training stage failed"
    }
    # Print the 6-line ROC-AUC summary
    python3 -c "
import json, pathlib
a = json.loads(pathlib.Path('$SCRIPTS/_cache/audit.json').read_text())
print('     n={n:,} dropouts={d:,}'.format(n=a['n'], d=a['dropouts']))
for k, m in a['models'].items():
    print(f\"     {m['name']:38s}  ROC-AUC {m['roc_auc']:.3f}  PR-AUC {m['pr_auc']:.3f}\")
"

    info "Stage 3/5: scoring every student"
    python3 "$SCRIPTS/03_score.py"

    info "Stage 4/5: aggregating to school/mandal/district + forecasts + catalog"
    python3 "$SCRIPTS/04_aggregate.py"

    info "Stage 5/5: counsellor artefacts (SMS + guide + plan)"
    python3 "$SCRIPTS/05_counsellor.py"

    ok "pipeline complete — outputs in $DATA_DIR"
  fi
else
  step "Skipping data pipeline (--skip-pipeline)"
fi

# ---- 4. npm install ----------------------------------------------------------
if [ "$SKIP_DEPS" -eq 0 ]; then
  step "Installing frontend dependencies"
  if [ ! -d "$APP/node_modules" ] || [ "$APP/package.json" -nt "$APP/node_modules" ]; then
    (cd "$APP" && npm install)
    ok "node_modules ready"
  else
    info "node_modules already up to date"
  fi
else
  step "Skipping npm install (--skip-deps)"
fi

# ---- 5. Start dev server -----------------------------------------------------
if [ "$NO_RUN" -eq 1 ]; then
  step "Setup complete — skipping dev server (--no-run)"
  info "Start the app yourself with: ${BOLD}cd $APP && npm run dev${RESET}"
  exit 0
fi

step "Starting Vite dev server"
info "Press Ctrl+C to stop. The URL prints below."
info ""
exec npm --prefix "$APP" run dev
