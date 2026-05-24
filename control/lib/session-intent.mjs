/** Session intent — pipeline scope and decision review mode from orchestrator controls. */

export const PIPELINE_SCOPES = {
  'planning-only': {
    label: 'Planning only',
    description: 'Finish research, clarify, PRD, mock, and plan — stop before build subagents.',
  },
  'full-pipeline': {
    label: 'Full pipeline',
    description: 'Advance through planning then dispatch build subagents in this session.',
  },
  'build-only': {
    label: 'Build only',
    description: 'Skip planning stages when plan + tasks exist; dispatch implementers.',
  },
};

export const DECISION_REVIEW_MODES = {
  'review-first': {
    label: 'Review key decisions',
    description: 'Pause after skill findings; summarize decisions and ask before proceeding.',
  },
  'auto-proceed': {
    label: 'Auto-proceed with defaults',
    description: 'Subagents proceed using research findings; document choices in journal for dashboard review.',
  },
};

export const PLANNING_STAGES = new Set([
  'braindump',
  'explore',
  'research',
  'clarify',
  'strategy',
  'interaction',
  'prd',
  'mock',
  'plan',
]);

export const BUILD_STAGES = new Set(['build', 'validate']);

export function normalizePipelineScope(scope) {
  if (scope && PIPELINE_SCOPES[scope]) return scope;
  return 'full-pipeline';
}

export function normalizeDecisionReview(mode) {
  if (mode && DECISION_REVIEW_MODES[mode]) return mode;
  return 'review-first';
}

export function resolveSessionIntent(controls = {}) {
  const intent = controls.sessionIntent ?? {};
  return {
    pipelineScope: normalizePipelineScope(intent.pipelineScope),
    decisionReview: normalizeDecisionReview(intent.decisionReview),
  };
}

/** Infer a suggested scope from disk state for AskQuestion context. */
export function suggestPipelineScope({ pipelineStage, specStatus, hasTasks, hasPhases }) {
  const stage = pipelineStage ?? 'braindump';
  if (BUILD_STAGES.has(stage)) return 'build-only';
  if (stage === 'done') return 'full-pipeline';
  if (PLANNING_STAGES.has(stage)) {
    if (hasPhases && hasTasks && specStatus === 'approved') return 'full-pipeline';
    return 'planning-only';
  }
  return 'full-pipeline';
}

export function shouldStopForPlanningOnly(controls, pipelineStage) {
  const { pipelineScope } = resolveSessionIntent(controls);
  return pipelineScope === 'planning-only' && pipelineStage === 'build';
}

export function shouldSkipPlanningForBuildOnly(controls, { hasPhases, hasTasks, specStatus }) {
  const { pipelineScope } = resolveSessionIntent(controls);
  if (pipelineScope !== 'build-only') return false;
  return !!(hasPhases && hasTasks && specStatus === 'approved');
}

export function shouldPauseForDecisionReview(controls, stage) {
  const { decisionReview } = resolveSessionIntent(controls);
  if (decisionReview !== 'review-first') return false;
  const reviewStages = new Set(['research', 'strategy', 'interaction', 'explore', 'clarify', 'prd', 'mock', 'plan']);
  return reviewStages.has(stage);
}

export function buildSessionIntentPromptLines(controls = {}) {
  const { pipelineScope, decisionReview } = resolveSessionIntent(controls);
  const scopeMeta = PIPELINE_SCOPES[pipelineScope];
  const reviewMeta = DECISION_REVIEW_MODES[decisionReview];
  return [
    '',
    'Session intent (.mc/orchestrator-controls.json → sessionIntent):',
    `- pipelineScope: ${pipelineScope} — ${scopeMeta.description}`,
    `- decisionReview: ${decisionReview} — ${reviewMeta.description}`,
    'Read docs/superpowers/control/SESSION-INTENT.md',
    pipelineScope === 'planning-only'
      ? 'Planning-only: stop when pipelineStage would advance to build; report status and regenerate dashboard.'
      : pipelineScope === 'build-only'
        ? 'Build-only: skip braindump–plan when phases + tasks + approved spec exist; go to build.'
        : 'Full pipeline: continuous run through build unless user pauses.',
    decisionReview === 'review-first'
      ? 'Review-first: after skill stages, summarize key decisions in chat and AskQuestion before next dispatch.'
      : 'Auto-proceed: subagents choose defaults from findings; write journal + skill artifacts for dashboard review.',
  ];
}
