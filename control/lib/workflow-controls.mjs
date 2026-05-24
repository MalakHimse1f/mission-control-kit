/** Build + plan workflow resolution from orchestrator controls (disk → routing). */

export const BUILD_MODE_DEFAULT = 'sdd+tdd';
export const REVIEW_CHAIN_DEFAULT = 'full';
export const PLAN_MODE_DEFAULT = 'subagent-driven';

export const BUILD_MODES = {
  'sdd+tdd': {
    label: 'SDD + TDD (default)',
    vendorSkills: ['subagent-driven-development', 'test-driven-development'],
    defaultReviewChain: 'full',
  },
  sdd: {
    label: 'SDD only',
    vendorSkills: ['subagent-driven-development'],
    defaultReviewChain: 'full',
  },
  'tdd-lite': {
    label: 'TDD-lite',
    vendorSkills: ['test-driven-development'],
    defaultReviewChain: 'none',
  },
};

export function normalizeBuildMode(mode) {
  if (mode && BUILD_MODES[mode]) return mode;
  return BUILD_MODE_DEFAULT;
}

export function normalizeReviewChain(chain) {
  if (chain === 'full' || chain === 'spec-only' || chain === 'none') return chain;
  return REVIEW_CHAIN_DEFAULT;
}

export function normalizePlanMode(mode) {
  if (mode === 'executing-plans' || mode === 'subagent-driven') return mode;
  return PLAN_MODE_DEFAULT;
}

export function resolveReviewChain(controls = {}) {
  const buildMode = normalizeBuildMode(controls.buildWorkflow?.mode);
  if (buildMode === 'tdd-lite') return 'none';
  return normalizeReviewChain(controls.buildWorkflow?.reviewChain ?? BUILD_MODES[buildMode].defaultReviewChain);
}

export function resolveBuildVendorSkills(controls = {}) {
  const mode = normalizeBuildMode(controls.buildWorkflow?.mode);
  return [...BUILD_MODES[mode].vendorSkills];
}

export function resolvePlanVendorSkills(controls = {}) {
  const mode = normalizePlanMode(controls.planWorkflow?.mode);
  if (mode === 'executing-plans') return ['writing-plans', 'executing-plans'];
  return ['writing-plans'];
}

export function buildWorkflowSummary(controls = {}) {
  const buildMode = normalizeBuildMode(controls.buildWorkflow?.mode);
  const reviewChain = resolveReviewChain(controls);
  const planMode = normalizePlanMode(controls.planWorkflow?.mode);
  return { buildMode, reviewChain, planMode, buildSkills: resolveBuildVendorSkills(controls) };
}

export function buildWorkflowPromptLines(controls = {}) {
  const { buildMode, reviewChain, planMode, buildSkills } = buildWorkflowSummary(controls);
  const lines = [
    '',
    'Workflow controls (.mc/orchestrator-controls.json):',
    `- buildWorkflow.mode: ${buildMode}`,
    `- buildWorkflow.reviewChain: ${reviewChain}`,
    `- planWorkflow.mode: ${planMode}`,
    `- build vendor skills: ${buildSkills.join(', ')}`,
    'Read docs/superpowers/control/WORKFLOW-CONTROLS.md',
  ];

  if (buildMode === 'sdd+tdd') {
    lines.push(
      'Build: subagent-driven-development — fresh implementer per task; implementer MUST invoke test-driven-development.',
    );
  } else if (buildMode === 'sdd') {
    lines.push(
      'Build: subagent-driven-development — fresh implementer per task; tests required via BUILD-GATES (TDD skill optional).',
    );
  } else {
    lines.push(
      'Build: TDD-lite — one implementer subagent per task with test-driven-development; NO spec/quality reviewer subagents.',
    );
  }

  if (reviewChain === 'full') {
    lines.push('Review chain: implementer → spec reviewer → quality reviewer → gates → commit.');
  } else if (reviewChain === 'spec-only') {
    lines.push('Review chain: implementer → spec reviewer → gates → commit (skip quality reviewer).');
  } else {
    lines.push('Review chain: none — implementer → gates → commit.');
  }

  if (planMode === 'executing-plans') {
    lines.push('Plan: after mc-platform-plan, optional parallel session may use executing-plans for batch build.');
  } else {
    lines.push('Plan: mc-platform-plan subagent; build runs in same orchestrator session (subagent-driven).');
  }

  return lines;
}

export function buildBuildStagePickupLines(controls = {}) {
  const { buildMode, reviewChain } = buildWorkflowSummary(controls);
  const skills = resolveBuildVendorSkills(controls);
  const lines = ['', `Build workflow: ${buildMode} · review: ${reviewChain}`];

  for (const skill of skills) {
    lines.push(`Invoke superpowers:${skill}.`);
  }

  if (buildMode === 'tdd-lite' || reviewChain === 'none') {
    lines.push('Per task: implementer → tests → commit → journal/NNN-build-{task-id}.md (no reviewer subagents).');
  } else if (reviewChain === 'spec-only') {
    lines.push('Per task: implementer → spec reviewer → tests → commit → journal.');
  } else {
    lines.push('Per task: implementer → spec reviewer → quality reviewer → tests → commit → journal.');
  }

  lines.push(
    'After last task: phase-end e2e per layoutTarget (E2E-TOOLS.md).',
    'Then validate inline (same session). Stop only on BLOCKED or user pause.',
  );
  return lines;
}
