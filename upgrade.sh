#!/usr/bin/env bash
# Mission Control v5 — safe upgrade (no reinstall). Preserves features + state.
set -euo pipefail

KIT_ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="${1:-}"
TARGET="${2:-both}"

get_default_project_root() {
  local kit_name parent
  kit_name="$(basename "$KIT_ROOT")"
  [[ "$kit_name" =~ ^mission-control-kit(-v[0-9]+)?$ ]] || return 1
  parent="$(cd "$KIT_ROOT/.." && pwd)"
  echo "$parent"
}

select_project_folder() {
  osascript -e 'POSIX path of (choose folder with prompt "Select your project folder to upgrade")' 2>/dev/null | tr -d '\n'
}

if [[ -z "$PROJECT_ROOT" ]]; then
  echo ""
  echo "Mission Control updater (macOS)"
  if default="$(get_default_project_root)"; then
    PROJECT_ROOT="$default"
  else
    PROJECT_ROOT="$(select_project_folder)" || { echo "Update cancelled."; exit 1; }
  fi
fi

echo ""
echo "Updating Mission Control into: $PROJECT_ROOT"
echo "Your feature specs and journals are preserved."
echo ""

node "$KIT_ROOT/scripts/mc-upgrade.mjs" "$PROJECT_ROOT" --target="$TARGET"

echo ""
echo "Done! Launch the v5 dashboard with:"
echo "  cd $PROJECT_ROOT && node mission-control-kit/control/scripts/v5/dashboard-server.mjs ."
echo ""
