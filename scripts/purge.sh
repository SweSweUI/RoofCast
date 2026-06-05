#!/usr/bin/env bash
# scripts/purge.sh — Altis hackathon data purge
#
# Removes all local Altis data and triggers cloud Supabase purge.
# NEVER deletes source code, Next.js pages, or pipeline scripts.
#
# Usage:
#   bash scripts/purge.sh          # interactive (type DELETE to confirm)
#   bash scripts/purge.sh --yes    # skip prompt (automation / CI)
#   bash scripts/purge.sh -y       # same as --yes
#
# See DATA_HANDLING.md for the full governance policy.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BOLD='\033[1m'
RESET='\033[0m'

say()  { echo -e "${BOLD}$*${RESET}"; }
ok()   { echo -e "${GREEN}  ok${RESET}  $*"; }
warn() { echo -e "${YELLOW}  warn${RESET} $*"; }
fail() { echo -e "${RED}  FAIL${RESET} $*" >&2; }

removed_items=()
mark_removed() { removed_items+=("$1"); }

# ---------------------------------------------------------------------------
# parse flags
# ---------------------------------------------------------------------------
YES=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y) YES=1 ;;
  esac
done

# ---------------------------------------------------------------------------
# banner
# ---------------------------------------------------------------------------
echo ""
echo -e "${RED}${BOLD}============================================================${RESET}"
echo -e "${RED}${BOLD}  ALTIS HACKATHON DATA PURGE${RESET}"
echo -e "${RED}${BOLD}============================================================${RESET}"
echo ""
echo -e "${YELLOW}  Altis source data is anonymised and for the hackathon only.${RESET}"
echo -e "${YELLOW}  All copies must be deleted within 3 days after the event.${RESET}"
echo ""
echo "  This script will permanently remove:"
echo "    - data/raw/                  (extracted Excel source files)"
echo "    - data/altis.db*             (SQLite database)"
echo "    - data/cache/                (API caches)"
echo "    - data/artifacts/*           (derived data; .gitkeep kept)"
echo "    - ios/build/                 (compiled iOS build output)"
echo "    - ios/Altis/Secrets.swift    (generated credentials)"
echo "    - Supabase altis_* tables, views, functions, and @altis.demo users"
echo ""
echo "  Source code is NOT deleted."
echo ""

# ---------------------------------------------------------------------------
# confirmation
# ---------------------------------------------------------------------------
if [[ "$YES" -eq 0 ]]; then
  echo -e "${BOLD}Type DELETE (all caps) and press Enter to proceed, or Ctrl-C to abort:${RESET}"
  read -r CONFIRM
  if [[ "$CONFIRM" != "DELETE" ]]; then
    echo "Aborted — nothing was deleted."
    exit 1
  fi
else
  say "  --yes flag set; skipping confirmation prompt."
fi

echo ""
say "=== Phase 1: Local data removal ==="
echo ""

# ---------------------------------------------------------------------------
# data/raw/
# ---------------------------------------------------------------------------
RAW_DIR="${REPO_ROOT}/data/raw"
if [[ -d "$RAW_DIR" ]]; then
  rm -rf "$RAW_DIR"
  ok "Removed data/raw/"
  mark_removed "data/raw/"
else
  warn "data/raw/ not found (already gone)"
fi

# ---------------------------------------------------------------------------
# data/altis.db (+ WAL / SHM)
# ---------------------------------------------------------------------------
for f in "${REPO_ROOT}/data/altis.db" \
          "${REPO_ROOT}/data/altis.db-shm" \
          "${REPO_ROOT}/data/altis.db-wal"; do
  if [[ -f "$f" ]]; then
    rm -f "$f"
    ok "Removed $(basename "$f")"
    mark_removed "data/$(basename "$f")"
  fi
done

# ---------------------------------------------------------------------------
# data/cache/
# ---------------------------------------------------------------------------
CACHE_DIR="${REPO_ROOT}/data/cache"
if [[ -d "$CACHE_DIR" ]]; then
  rm -rf "$CACHE_DIR"
  ok "Removed data/cache/"
  mark_removed "data/cache/"
else
  warn "data/cache/ not found (already gone)"
fi

# ---------------------------------------------------------------------------
# data/artifacts/* (preserve .gitkeep)
# ---------------------------------------------------------------------------
ARTIFACTS_DIR="${REPO_ROOT}/data/artifacts"
if [[ -d "$ARTIFACTS_DIR" ]]; then
  find "$ARTIFACTS_DIR" -mindepth 1 -not -name ".gitkeep" -delete
  ok "Cleared data/artifacts/* (kept .gitkeep)"
  mark_removed "data/artifacts/*"
else
  warn "data/artifacts/ not found (already gone)"
fi

# ---------------------------------------------------------------------------
# ios/build/
# ---------------------------------------------------------------------------
IOS_BUILD="${REPO_ROOT}/ios/build"
if [[ -d "$IOS_BUILD" ]]; then
  rm -rf "$IOS_BUILD"
  ok "Removed ios/build/"
  mark_removed "ios/build/"
else
  warn "ios/build/ not found (already gone or not yet created)"
fi

# ---------------------------------------------------------------------------
# ios/Altis/Secrets.swift
# ---------------------------------------------------------------------------
SECRETS_SWIFT="${REPO_ROOT}/ios/Altis/Secrets.swift"
if [[ -f "$SECRETS_SWIFT" ]]; then
  rm -f "$SECRETS_SWIFT"
  ok "Removed ios/Altis/Secrets.swift"
  mark_removed "ios/Altis/Secrets.swift"
else
  warn "ios/Altis/Secrets.swift not found (already gone or not yet created)"
fi

echo ""
say "=== Phase 2: Supabase cloud purge ==="
echo ""

ENV_FILE="${REPO_ROOT}/.env.local"
PURGE_PY="${REPO_ROOT}/pipeline/purge_supabase.py"

if [[ ! -f "$ENV_FILE" ]]; then
  warn ".env.local not found — cannot run cloud purge automatically."
  warn "Restore .env.local and run manually:"
  warn "  python3 pipeline/purge_supabase.py --yes"
elif [[ ! -f "$PURGE_PY" ]]; then
  fail "pipeline/purge_supabase.py not found — cannot run cloud purge."
  exit 1
else
  python3 "$PURGE_PY" --yes
  mark_removed "Supabase altis_* objects + @altis.demo users"
fi

# ---------------------------------------------------------------------------
# summary
# ---------------------------------------------------------------------------
echo ""
say "=== Purge complete ==="
echo ""
if [[ ${#removed_items[@]} -gt 0 ]]; then
  echo "Items removed:"
  for item in "${removed_items[@]}"; do
    echo "  - $item"
  done
else
  echo "  (nothing to remove; everything was already gone)"
fi
echo ""
echo -e "${YELLOW}  Reminder: rotate your SUPABASE_ACCESS_TOKEN in the Supabase dashboard.${RESET}"
echo -e "${YELLOW}  See DATA_HANDLING.md section 5 for the full responsible-deletion checklist.${RESET}"
echo ""
