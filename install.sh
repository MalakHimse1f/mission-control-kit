#!/usr/bin/env bash
# Mission Control v5 installer — delegates safe migration runs to mc-upgrade.
# v5.2.0+ uses the v5-native layout: control plane at {project}/control/,
# install stamp at {project}/.mc/install.json. No more docs/superpowers/.
set -euo pipefail

KIT_ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="${1:-}"
TARGET="${2:-both}"

get_default_project_root() {
  local kit_name parent desktop
  kit_name="$(basename "$KIT_ROOT")"
  [[ "$kit_name" =~ ^mission-control-kit(-v[0-9]+)?$ ]] || return 1
  parent="$(cd "$KIT_ROOT/.." && pwd)"
  desktop="$HOME/Desktop"
  [[ "$KIT_ROOT" == "$desktop"* ]] && return 1
  echo "$parent"
}

select_project_folder() {
  osascript -e 'POSIX path of (choose folder with prompt "Select your project folder")' 2>/dev/null | tr -d '\n'
}

publish_user_guide() {
  local proj="$1" kit="$2" kit_name
  kit_name="$(basename "$kit")"
  [[ -f "$kit/User-Guide.html" ]] || return 0
  sed \
    -e "s|href=\"Run-Installer\\.hta\"|href=\"$kit_name/Run-Installer.hta\"|g" \
    -e "s|href=\"Run-Updater\\.hta\"|href=\"$kit_name/Run-Updater.hta\"|g" \
    -e "s|href=\"Run-Installer\\.command\"|href=\"$kit_name/Run-Installer.command\"|g" \
    -e "s|\&amp; \"\\.\\\\install\\.ps1\"|\&amp; \"./$kit_name/install.ps1\"|g" \
    -e "s|data-copy='& \"\\.\\\\install\\.ps1\"'|data-copy='& \"./$kit_name/install.ps1\"'|g" \
    -e "s|data-mac-install=\"kit\"|data-mac-install=\"$kit_name\"|g" \
    -e 's|Run PowerShell from <strong>this kit folder</strong>|Run PowerShell from the <strong>'"$kit_name"'</strong> folder in this project|g' \
    -e 's|Go to this kit folder (the one with|Go to the <strong>'"$kit_name"'</strong> folder in this project (the one with|g' \
    "$kit/User-Guide.html" > "$proj/User-Guide.html"
  echo "Created User-Guide.html at project root"
}

if [[ -z "$PROJECT_ROOT" ]]; then
  echo ""
  echo "Mission Control installer (macOS)"
  if default="$(get_default_project_root)"; then
    echo "Kit is inside a project - installing into:"
    echo "  $default"
    echo ""
    PROJECT_ROOT="$default"
  else
    echo "Pick your project folder in the dialog."
    echo ""
    PROJECT_ROOT="$(select_project_folder)" || { echo "Install cancelled."; exit 1; }
  fi
fi

echo ""
case "$TARGET" in
  cursor) echo "Installing Mission Control (Cursor) into:" ;;
  claude) echo "Installing Mission Control (Claude Code) into:" ;;
  *) echo "Installing Mission Control (Cursor + Claude Code) into:" ;;
esac
echo "  $PROJECT_ROOT"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js required for Mission Control install/upgrade." >&2
  exit 1
fi

echo "Running v5 install (user specs preserved, no docs/superpowers wrapping)..."
node "$KIT_ROOT/scripts/mc-upgrade.mjs" "$PROJECT_ROOT" --install --target="$TARGET"

publish_user_guide "$PROJECT_ROOT" "$KIT_ROOT"

echo ""
echo "Done! Launch the v5 dashboard with:"
echo "  cd $PROJECT_ROOT && node mission-control-kit/control/scripts/v5/dashboard-server.mjs ."
echo ""
echo "To upgrade later: double-click Run-Updater.command, /mc-upgrade, or:"
echo "  node $KIT_ROOT/scripts/mc-upgrade.mjs ."
echo ""
