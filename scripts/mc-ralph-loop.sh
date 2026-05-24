#!/usr/bin/env bash
# Ralph loop — spawn fresh orchestrator sessions from disk-written resume prompts.
# Usage: MC_AGENT_CMD='your-agent-launcher' ./mission-control-kit/scripts/mc-ralph-loop.sh [project-root]
set -euo pipefail

ROOT="${1:-.}"
CONTROL="${MC_CONTROL:-$ROOT/docs/superpowers/control}"
PROMPT_FILE="$CONTROL/.mc/ralph/resume-prompt.txt"

if [[ -z "${MC_AGENT_CMD:-}" ]]; then
  echo "Set MC_AGENT_CMD to launch your orchestrator agent, e.g.:"
  echo "  export MC_AGENT_CMD='cursor agent -p'"
  exit 1
fi

while [[ -f "$PROMPT_FILE" ]]; do
  PROMPT="$(cat "$PROMPT_FILE")"
  rm -f "$PROMPT_FILE"
  echo "Ralph loop: spawning orchestrator session…"
  bash -c "${MC_AGENT_CMD} $(printf '%q' "$PROMPT")"
done

echo "Ralph loop: no resume prompt on disk — done."
