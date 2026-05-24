import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveBuildVendorSkills,
  resolveReviewChain,
  resolvePlanVendorSkills,
  buildBuildStagePickupLines,
} from '../control/lib/workflow-controls.mjs';
import { getStageVendorSkills, resolveDispatch } from '../lib/mc-router.mjs';

describe('workflow-controls', () => {
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

describe('mc-router with workflow controls', () => {
  it('build stage uses controls for vendor skills', () => {
    const skills = getStageVendorSkills('add-feature', 'build', {
      buildWorkflow: { mode: 'tdd-lite' },
    });
    assert.deepEqual(skills, ['test-driven-development']);
  });

  it('resolveDispatch includes reviewChain on build', () => {
    const d = resolveDispatch('add-feature', 'build', {
      buildWorkflow: { mode: 'sdd', reviewChain: 'spec-only' },
    });
    assert.equal(d.reviewChain, 'spec-only');
    assert.deepEqual(d.vendorSkills, ['subagent-driven-development']);
  });
});
