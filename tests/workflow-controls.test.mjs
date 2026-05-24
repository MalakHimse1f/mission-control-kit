import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  resolveBuildVendorSkills,
  resolveReviewChain,
  resolvePlanVendorSkills,
  buildBuildStagePickupLines,
  buildWorkflowPromptLines,
  normalizeBuildMode,
  normalizeReviewChain,
} from '../control/lib/workflow-controls.mjs';
import {
  getStageVendorSkills,
  resolveDispatch,
  buildContextPacket,
  buildDispatchPlan,
} from '../lib/mc-router.mjs';
import {
  DEFAULT_ORCHESTRATOR_CONTROLS,
  writeOrchestratorControls,
  readOrchestratorControls,
} from '../control/lib/orchestrator-controls.mjs';
import { buildPickupPrompt } from '../control/scripts/dashboard-data.mjs';

/** Expected build-stage routing for each workflow mode (disk → mc-router). */
const BUILD_ROUTING_MATRIX = [
  {
    label: 'sdd+tdd default',
    controls: {},
    vendorSkills: ['subagent-driven-development', 'test-driven-development'],
    reviewChain: 'full',
  },
  {
    label: 'sdd with spec-only review',
    controls: { buildWorkflow: { mode: 'sdd', reviewChain: 'spec-only' } },
    vendorSkills: ['subagent-driven-development'],
    reviewChain: 'spec-only',
  },
  {
    label: 'sdd with no review',
    controls: { buildWorkflow: { mode: 'sdd', reviewChain: 'none' } },
    vendorSkills: ['subagent-driven-development'],
    reviewChain: 'none',
  },
  {
    label: 'tdd-lite ignores reviewChain setting',
    controls: { buildWorkflow: { mode: 'tdd-lite', reviewChain: 'full' } },
    vendorSkills: ['test-driven-development'],
    reviewChain: 'none',
  },
];

describe('workflow-controls normalization', () => {
  it('defaults invalid build mode to sdd+tdd', () => {
    assert.equal(normalizeBuildMode('bogus'), 'sdd+tdd');
    assert.equal(normalizeBuildMode(undefined), 'sdd+tdd');
  });

  it('defaults invalid review chain to full', () => {
    assert.equal(normalizeReviewChain('bogus'), 'full');
  });
});

describe('workflow-controls resolution', () => {
  it('defaults to sdd+tdd with full review', () => {
    assert.deepEqual(resolveBuildVendorSkills({}), [
      'subagent-driven-development',
      'test-driven-development',
    ]);
    assert.equal(resolveReviewChain({}), 'full');
  });

  it('sdd mode drops TDD vendor skill', () => {
    assert.deepEqual(
      resolveBuildVendorSkills({ buildWorkflow: { mode: 'sdd' } }),
      ['subagent-driven-development'],
    );
  });

  it('tdd-lite forces no review chain', () => {
    const controls = { buildWorkflow: { mode: 'tdd-lite', reviewChain: 'full' } };
    assert.deepEqual(resolveBuildVendorSkills(controls), ['test-driven-development']);
    assert.equal(resolveReviewChain(controls), 'none');
  });

  it('plan executing-plans adds vendor skill', () => {
    assert.deepEqual(
      resolvePlanVendorSkills({ planWorkflow: { mode: 'executing-plans' } }),
      ['writing-plans', 'executing-plans'],
    );
  });

  it('pickup lines reflect tdd-lite', () => {
    const lines = buildBuildStagePickupLines({ buildWorkflow: { mode: 'tdd-lite' } });
    assert.ok(lines.some((l) => l.includes('no reviewer subagents')));
  });
});

describe('mc-router build routing from controls', () => {
  for (const row of BUILD_ROUTING_MATRIX) {
    it(`${row.label}: vendor skills + reviewChain on add-feature build`, () => {
      const skills = getStageVendorSkills('add-feature', 'build', row.controls);
      assert.deepEqual(skills, row.vendorSkills, `skills for ${row.label}`);

      const dispatch = resolveDispatch('add-feature', 'build', row.controls);
      assert.equal(dispatch.actor, 'subagent');
      assert.equal(dispatch.subagent, 'implementer');
      assert.deepEqual(dispatch.vendorSkills, row.vendorSkills);
      assert.equal(dispatch.reviewChain, row.reviewChain);
    });
  }

  it('build without controls falls back to SDD-only stage default', () => {
    assert.deepEqual(getStageVendorSkills('add-feature', 'build', null), [
      'subagent-driven-development',
    ]);
    const dispatch = resolveDispatch('add-feature', 'build', null);
    assert.equal(dispatch.reviewChain, null);
  });

  it('non-build stages ignore buildWorkflow controls', () => {
    const controls = { buildWorkflow: { mode: 'tdd-lite' } };
    assert.deepEqual(getStageVendorSkills('add-feature', 'explore', controls), []);
    assert.deepEqual(getStageVendorSkills('add-feature', 'prd', controls), ['prd-generator']);
    const explore = resolveDispatch('add-feature', 'explore', controls);
    assert.equal(explore.reviewChain, null);
  });

  it('plan stage uses planWorkflow controls', () => {
    const controls = { planWorkflow: { mode: 'executing-plans' } };
    assert.deepEqual(getStageVendorSkills('add-feature', 'plan', controls), [
      'writing-plans',
      'executing-plans',
    ]);
    const dispatch = resolveDispatch('add-feature', 'plan', controls);
    assert.equal(dispatch.subagent, 'mc-platform-plan');
    assert.equal(dispatch.reviewChain, null);
  });
});

describe('buildDispatchPlan workflow integration', () => {
  it('only build stage changes when toggling buildWorkflow', () => {
    const baseline = buildDispatchPlan('add-feature', { workstream: 'ux' });
    const tddLite = buildDispatchPlan('add-feature', {
      workstream: 'ux',
      controls: { buildWorkflow: { mode: 'tdd-lite' } },
    });

    for (const stage of ['explore', 'clarify', 'prd', 'mock', 'plan']) {
      const base = baseline.find((s) => s.stage === stage);
      const lite = tddLite.find((s) => s.stage === stage);
      assert.deepEqual(lite.vendorSkills, base.vendorSkills, `${stage} unchanged`);
      assert.equal(lite.reviewChain, base.reviewChain, `${stage} reviewChain unchanged`);
    }

    const buildBase = baseline.find((s) => s.stage === 'build');
    const buildLite = tddLite.find((s) => s.stage === 'build');
    assert.deepEqual(buildBase.vendorSkills, ['subagent-driven-development']);
    assert.deepEqual(buildLite.vendorSkills, ['test-driven-development']);
    assert.equal(buildLite.reviewChain, 'none');
  });

  it('sdd+tdd controls match production default routing', () => {
    const fromDefaults = buildDispatchPlan('add-feature', {
      workstream: 'ux',
      controls: DEFAULT_ORCHESTRATOR_CONTROLS,
    });
    const build = fromDefaults.find((s) => s.stage === 'build');
    assert.deepEqual(build.vendorSkills, [
      'subagent-driven-development',
      'test-driven-development',
    ]);
    assert.equal(build.reviewChain, 'full');
  });
});

describe('buildContextPacket honors workflow controls', () => {
  it('build packet skills follow tdd-lite controls', () => {
    const packet = buildContextPacket({
      workflowType: 'add-feature',
      stage: 'build',
      subagent: 'implementer',
      slug: 'notifications',
      controlRoot: 'docs/superpowers/control',
      taskId: '1.1',
      controls: { buildWorkflow: { mode: 'tdd-lite' } },
    });
    assert.deepEqual(packet.skills, ['test-driven-development']);
  });

  it('plan packet skills follow executing-plans controls', () => {
    const packet = buildContextPacket({
      workflowType: 'add-feature',
      stage: 'plan',
      subagent: 'mc-platform-plan',
      slug: 'notifications',
      controlRoot: 'docs/superpowers/control',
      controls: { planWorkflow: { mode: 'executing-plans' } },
    });
    assert.deepEqual(packet.skills, ['writing-plans', 'executing-plans']);
  });
});

describe('disk → routing (orchestrator-controls.json)', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-wf-route-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('persisted buildWorkflow drives resolveDispatch after read', () => {
    writeOrchestratorControls(tmp, {
      buildWorkflow: { mode: 'sdd', reviewChain: 'spec-only' },
    });
    const controls = readOrchestratorControls(tmp);
    const dispatch = resolveDispatch('add-feature', 'build', controls);
    assert.deepEqual(dispatch.vendorSkills, ['subagent-driven-development']);
    assert.equal(dispatch.reviewChain, 'spec-only');
  });

  it('defaults include buildWorkflow and planWorkflow when file missing', () => {
    const controls = readOrchestratorControls(tmp);
    assert.deepEqual(controls.buildWorkflow, DEFAULT_ORCHESTRATOR_CONTROLS.buildWorkflow);
    assert.deepEqual(controls.planWorkflow, DEFAULT_ORCHESTRATOR_CONTROLS.planWorkflow);
  });
});

describe('pickup prompt embeds active workflow routing', () => {
  const buildStage = { key: 'build', label: 'Build' };
  const baseArgs = {
    workstream: 'feature',
    slug: 'alpha',
    stage: buildStage,
    status: { pipelineStage: 'build', tasks: [{ id: '1.1', status: 'backlog' }] },
    global: { phase: 'idle' },
  };

  it('includes workflow prompt lines for sdd+tdd', () => {
    const prompt = buildPickupPrompt({
      ...baseArgs,
      controls: DEFAULT_ORCHESTRATOR_CONTROLS,
    });
    assert.ok(prompt.includes('buildWorkflow.mode: sdd+tdd'));
    assert.ok(prompt.includes('subagent-driven-development'));
    assert.ok(prompt.includes('test-driven-development'));
    assert.ok(prompt.includes('spec reviewer → quality reviewer'));
  });

  it('includes tdd-lite routing with no reviewers', () => {
    const prompt = buildPickupPrompt({
      ...baseArgs,
      controls: { buildWorkflow: { mode: 'tdd-lite', reviewChain: 'none' } },
    });
    assert.ok(prompt.includes('buildWorkflow.mode: tdd-lite'));
    assert.ok(prompt.includes('NO spec/quality reviewer subagents'));
    assert.ok(prompt.includes('Build workflow: tdd-lite · review: none'));
  });

  it('plan stage mentions executing-plans when toggled', () => {
    const prompt = buildPickupPrompt({
      ...baseArgs,
      stage: { key: 'plan', label: 'Plan' },
      status: { pipelineStage: 'plan' },
      controls: { planWorkflow: { mode: 'executing-plans' } },
    });
    assert.ok(prompt.includes('planWorkflow.mode: executing-plans'));
    assert.ok(prompt.includes('parallel session with executing-plans'));
  });
});

describe('workflow prompt lines match review chain', () => {
  it('full chain mentions quality reviewer', () => {
    const lines = buildWorkflowPromptLines({ buildWorkflow: { mode: 'sdd+tdd', reviewChain: 'full' } });
    assert.ok(lines.some((l) => l.includes('quality reviewer')));
  });

  it('spec-only chain skips quality reviewer', () => {
    const lines = buildWorkflowPromptLines({ buildWorkflow: { mode: 'sdd', reviewChain: 'spec-only' } });
    assert.ok(lines.some((l) => l.includes('skip quality reviewer')));
  });

  it('none chain goes straight to gates', () => {
    const lines = buildWorkflowPromptLines({ buildWorkflow: { mode: 'sdd', reviewChain: 'none' } });
    assert.ok(lines.some((l) => l.includes('Review chain: none')));
  });
});
