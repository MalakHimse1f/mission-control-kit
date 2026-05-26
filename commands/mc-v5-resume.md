Invoke skill: mc-v5

Resume the v5 feature named in $ARGUMENTS (expected format: `{slug}` or `{slug} {stage}`).
Read control/v5/features/{slug}/status.json and decisions.json, then call
resolveRoute({ taskType, stage, slug }) from lib/v5/mc-router.mjs. If $ARGUMENTS
omits the stage, derive it from status.json `currentPhase`.
