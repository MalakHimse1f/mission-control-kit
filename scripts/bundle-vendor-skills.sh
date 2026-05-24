#!/usr/bin/env bash
# Clone or update pinned vendor skill repos into the kit and/or project.
set -euo pipefail

KIT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ROOT="${1:-}"
TARGET="${2:-project}" # kit | project | both

MANIFEST="$KIT_ROOT/vendor/manifest.json"
if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing vendor/manifest.json" >&2
  exit 1
fi

clone_bundle() {
  local id="$1" repo="$2" ref="$3" dest="$4"
  if [[ -d "$dest/.git" ]]; then
    echo "Updating $id at $dest"
    git -C "$dest" fetch --depth 1 origin "$ref" 2>/dev/null || git -C "$dest" fetch origin
    git -C "$dest" checkout "$ref" 2>/dev/null || git -C "$dest" checkout "origin/$ref" 2>/dev/null || true
    git -C "$dest" pull --ff-only 2>/dev/null || true
  else
    echo "Cloning $id from $repo ($ref) -> $dest"
    mkdir -p "$(dirname "$dest")"
    git clone --depth 1 --branch "$ref" "$repo" "$dest" 2>/dev/null || git clone --depth 1 "$repo" "$dest"
  fi
}

extract_subpath() {
  local src="$1" subpath="$2" dest="$3"
  if [[ ! -d "$src/$subpath" ]]; then
    echo "ERROR: missing subpath $subpath in $src" >&2
    exit 1
  fi
  mkdir -p "$dest"
  rsync -a --delete "$src/$subpath/" "$dest/"
}

install_bundle() {
  local id="$1" repo="$2" ref="$3" installPath="$4" projectSkillsPath="$5" sourceSubpath="$6"
  local kit_dest="$KIT_ROOT/$installPath"
  local kit_clone="$KIT_ROOT/vendor/.cache-$id"

  if [[ -n "$sourceSubpath" ]]; then
    if [[ "$TARGET" == "kit" || "$TARGET" == "both" ]]; then
      clone_bundle "$id" "$repo" "$ref" "$kit_clone"
      extract_subpath "$kit_clone" "$sourceSubpath" "$kit_dest"
    fi
    if [[ -n "$PROJECT_ROOT" && ("$TARGET" == "project" || "$TARGET" == "both") ]]; then
      local project_dest="$PROJECT_ROOT/$projectSkillsPath"
      mkdir -p "$(dirname "$project_dest")"
      if [[ -d "$kit_dest" && "$(ls -A "$kit_dest" 2>/dev/null)" ]]; then
        rsync -a --delete "$kit_dest/" "$project_dest/"
        echo "Installed $id -> $project_dest (from kit cache)"
      else
        clone_bundle "$id" "$repo" "$ref" "$kit_clone"
        extract_subpath "$kit_clone" "$sourceSubpath" "$project_dest"
        echo "Installed $id -> $project_dest (direct clone)"
      fi
    fi
  else
    if [[ "$TARGET" == "kit" || "$TARGET" == "both" ]]; then
      clone_bundle "$id" "$repo" "$ref" "$kit_dest"
    fi
    if [[ -n "$PROJECT_ROOT" && ("$TARGET" == "project" || "$TARGET" == "both") ]]; then
      local project_dest="$PROJECT_ROOT/$projectSkillsPath"
      mkdir -p "$(dirname "$project_dest")"
      if [[ -d "$kit_dest" && "$(ls -A "$kit_dest" 2>/dev/null)" ]]; then
        rsync -a --delete "$kit_dest/" "$project_dest/"
        echo "Installed $id -> $project_dest (from kit cache)"
      elif [[ -n "$PROJECT_ROOT" ]]; then
        clone_bundle "$id" "$repo" "$ref" "$project_dest"
        echo "Installed $id -> $project_dest (direct clone)"
      else
        echo "WARN: cannot install $id — no kit cache and no project root" >&2
      fi
    fi
  fi
}

node -e '
const fs = require("fs");
const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
for (const b of m.bundles) {
  console.log([
    b.id,
    b.repo,
    b.ref,
    b.installPath,
    b.projectSkillsPath,
    b.sourceSubpath || "",
  ].join("\t"));
}
' "$MANIFEST" | while IFS=$'\t' read -r id repo ref installPath projectSkillsPath sourceSubpath; do
  install_bundle "$id" "$repo" "$ref" "$installPath" "$projectSkillsPath" "$sourceSubpath"
done

if command -v node >/dev/null 2>&1 && [[ -n "$PROJECT_ROOT" ]]; then
  node "$KIT_ROOT/scripts/check-vendor-skills.mjs" "$PROJECT_ROOT" || true
fi

echo "Vendor skill bundle step complete."
