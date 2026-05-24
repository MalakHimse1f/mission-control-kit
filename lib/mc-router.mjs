/**
 * Mission Control v4 — executable routing rules for orchestrator + subagent dispatch.
 * Source of truth for stage order: control/PROJECT-START-PIPELINE.md, ADD-FEATURE-PIPELINE.md
 */
import {
  resolveBuildVendorSkills,
  resolvePlanVendorSkills,
  resolveReviewChain,
} from '../control/lib/workflow-controls.mjs';

const PROJECT_START_STAGES = [
  'vendor-setup',
  'braindump',
  'validate',
  'compete',
  'position',
  'platforms',
  'stack',
  'portfolio',
  'launch-prep',
  'done',
];

const ADD_FEATURE_UX_STAGES = [
  'vendor-setup',
  'braindump',
  'explore',
  'research',
  'clarify',
  'strategy',
  'prd',
  'interaction',
  'mock',
  'plan',
  'build',
  'validate',
  'done',
];

const ADD_FEATURE_TECH_STAGES = [
  'vendor-setup',
  'braindump',
  'explore',
  'clarify',
  'prd',
  'plan',
  'build',
  'validate',
  'done',
];

const ORCHESTRATOR_ONLY_STAGES = new Set([
  'braindump',
  'clarify',
  'platforms',
  'stack',
  'portfolio',
  'launch-prep',
  'validate',
  'compete',
  'position',
  'research',
  'strategy',
]);

const STAGE_SUBAGENT = {
  'vendor-setup': 'mc-setup-skills',
  explore: 'mc-explore',
  prd: 'mc-prd',
  mock: 'mc-mock',
  plan: 'mc-platform-plan',
  build: 'implementer',
  validate: 'validator',
};

const STAGE_VENDOR_SKILLS = {
  braindump: ['brainstorming'],
  validate: ['startup-design'],
  compete: ['startup-competitors'],
  position: ['startup-positioning'],
  'launch-prep': ['startup-pitch'],
  research: ['design-research'],
  strategy: ['ux-strategy'],
  prd: ['prd-generator'],
  interaction: ['interaction-design'],
  mock: ['visual-critique'],
  plan: ['writing-plans'],
  build: ['subagent-driven-development'],
};

export function getStageVendorSkills(workflowType, stage, controls = null) {
  if (stage === 'validate' && workflowType === 'add-feature') {
    return ['verification-before-completion'];
  }
  if (controls && stage === 'build') {
    return resolveBuildVendorSkills(controls);
  }
  if (controls && stage === 'plan') {
    return resolvePlanVendorSkills(controls);
  }
  return STAGE_VENDOR_SKILLS[stage] ?? [];
}

const CONTEXT_DEFAULTS = {
  'mc-setup-skills': {
    read: ['SKILL-DEPENDENCIES.md', 'vendor/manifest.json'],
    skip: ['features/**', 'project/market-brief.md'],
  },
  'mc-explore': {
    read: ['braindump'],
    skip: ['features/other-slug/**', 'project/market-brief', 'phase plans', 'mock HTML'],
  },
  'mc-prd': {
    read: ['braindump', 'explore/*.html', 'research.html', 'clarify journal', 'features/_template/spec.md'],
    skip: ['unrelated features', 'phase plans'],
    invoke: ['prd-generator'],
  },
  'mc-mock': {
    read: ['spec.md', 'interaction.html', 'layout targets'],
    skip: ['build plans', 'other features'],
  },
  'mc-platform-plan': {
    read: ['spec.md', 'tech-stack/stack.json', 'explore maps'],
    skip: ['market briefs', 'competitor docs'],
  },
  implementer: {
    read: ['phase task', 'BUILD-GATES.md'],
    skip: ['full portfolio', 'unrelated journals'],
  },
  validator: {
    read: ['spec acceptance', 'E2E-TOOLS.md'],
    skip: ['implementation planning debate'],
  },
};

export function classifyCommand(command) {
  const cmd = command.trim().toLowerCase().split(/\s+/)[0];

  if (cmd === '/mc-start' || cmd === 'mc-start') {
    return {
      workflowType: 'project-start',
      requiredVendor: 'startup-skill',
      pipelineDoc: 'PROJECT-START-PIPELINE.md',
    };
  }

  if (cmd === '/mc-feature' || cmd === 'mc-feature' || cmd === '/mc-braindump' || cmd === 'mc-braindump') {
    return {
      workflowType: 'add-feature',
      requiredVendor: 'designer-skills',
      requiredVendors: ['designer-skills', 'prd-generator'],
      pipelineDoc: 'ADD-FEATURE-PIPELINE.md',
    };
  }

  if (cmd === '/mc-init' || cmd === 'mc-init' || cmd === '/mc-portfolio' || cmd === 'mc-portfolio') {
    return { workflowType: null, requiredVendor: null, pipelineDoc: null };
  }

  if (cmd === '/mc' || cmd === 'mc') {
    return { workflowType: 'resume', requiredVendor: null, pipelineDoc: 'ROUTER.md' };
  }

  return { workflowType: null, requiredVendor: null, pipelineDoc: null };
}

export function requiredVendorBundle(workflowType) {
  const bundles = requiredVendorBundles(workflowType);
  return bundles[0] ?? null;
}

export function requiredVendorBundles(workflowType) {
  if (workflowType === 'project-start') return ['startup-skill'];
  if (workflowType === 'add-feature') return ['designer-skills', 'prd-generator'];
  return [];
}

export function getPipelineStages(workflowType, options = {}) {
  if (workflowType === 'project-start') return [...PROJECT_START_STAGES];
  if (workflowType === 'add-feature') {
    return options.workstream === 'tech-stack'
      ? [...ADD_FEATURE_TECH_STAGES]
      : [...ADD_FEATURE_UX_STAGES];
  }
  return [];
}

export function getNextStage(workflowType, currentStage, options = {}) {
  const stages = getPipelineStages(workflowType, options);
  const idx = stages.indexOf(currentStage);
  if (idx === -1 || idx === stages.length - 1) return null;
  return stages[idx + 1];
}

export function isOrchestratorStage(workflowType, stage) {
  if (stage === 'build' || stage === 'validate') return false;
  if (STAGE_SUBAGENT[stage] && !ORCHESTRATOR_ONLY_STAGES.has(stage)) {
    return false;
  }
  return ORCHESTRATOR_ONLY_STAGES.has(stage) || stage === 'braindump';
}

export function resolveDispatch(workflowType, stage, controls = null) {
  const subagent = STAGE_SUBAGENT[stage] ?? null;
  const vendorSkills = getStageVendorSkills(workflowType, stage, controls);
  const reviewChain = stage === 'build' && controls ? resolveReviewChain(controls) : null;
  const orchestrator = isOrchestratorStage(workflowType, stage) || subagent === null;

  if (stage === 'validate' || stage === 'compete' || stage === 'position' || stage === 'research' || stage === 'strategy') {
    return { actor: 'orchestrator', subagent: null, vendorSkills, reviewChain };
  }

  if (orchestrator && !subagent) {
    return { actor: 'orchestrator', subagent: null, vendorSkills, reviewChain };
  }

  return { actor: 'subagent', subagent, vendorSkills, reviewChain };
}

export function buildContextPacket({ workflowType, stage, subagent, slug, controlRoot, taskId, controls = null }) {
  const base = subagent ? CONTEXT_DEFAULTS[subagent] : null;
  const read = [];
  const skip = [];

  if (workflowType === 'project-start' && stage === 'validate') {
    read.push(`${controlRoot}/project/PROJECT.md`);
    skip.push('features/**', 'codebases');
  } else if (workflowType === 'add-feature' && stage === 'explore') {
    read.push(`${controlRoot}/features/${slug}/braindump.md`);
    skip.push('features/other-slug/**', 'project/market-brief', 'other features');
  } else if (workflowType === 'add-feature' && stage === 'build') {
    read.push(`${controlRoot}/features/${slug}/phases/phase-*.md#task-${taskId}`, `${controlRoot}/BUILD-GATES.md`);
    skip.push('full portfolio', 'unrelated journals');
  } else if (base) {
    read.push(...base.read.map((r) => r.replace('{slug}', slug)));
    skip.push(...base.skip);
  } else {
    read.push(`${controlRoot}/project/PROJECT.md`);
    skip.push('features/**');
  }

  return {
    workflowType,
    stage,
    subagent,
    slug,
    read,
    skip,
    skills: getStageVendorSkills(workflowType, stage, controls),
    invoke: base?.invoke ?? [],
    outputs: [],
    stop: 'DONE',
  };
}

export function validateRouteCard(card) {
  const errors = [];
  if (!card.workflow) errors.push('missing workflow');
  if (!card.stage) errors.push('missing stage');
  if (!card.read?.length) errors.push('missing read paths');
  if (!card.skip?.length) errors.push('missing skip list');
  if (!card.outputs?.length) errors.push('missing outputs');

  if (card.stage === 'explore' && card.subagent === 'implementer') {
    errors.push('implementer must not run at explore stage');
  }

  return { ok: errors.length === 0, errors };
}

/** Walk pipeline and produce dispatch plan for simulation / tests */
export function buildDispatchPlan(workflowType, options = {}) {
  const { controls = null, ...pipelineOptions } = options;
  const stages = getPipelineStages(workflowType, pipelineOptions);
  return stages.map((stage) => ({
    stage,
    next: getNextStage(workflowType, stage, pipelineOptions),
    ...resolveDispatch(workflowType, stage, controls),
  }));
}
