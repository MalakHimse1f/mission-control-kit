import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyCommand,
  getPipelineStages,
  getNextStage,
  resolveDispatch,
  buildContextPacket,
  validateRouteCard,
  isOrchestratorStage,
  requiredVendorBundle,
  requiredVendorBundles,
} from '../lib/mc-router.mjs';

describe('classifyCommand', () => {
  it('maps /mc-start to project-start workflow', () => {
    assert.deepEqual(classifyCommand('/mc-start'), {
      workflowType: 'project-start',
      requiredVendor: 'startup-skill',
      pipelineDoc: 'PROJECT-START-PIPELINE.md',
    });
  });

  it('maps /mc-feature to add-feature workflow', () => {
    assert.deepEqual(classifyCommand('/mc-feature'), {
      workflowType: 'add-feature',
      requiredVendor: 'designer-skills',
      requiredVendors: ['designer-skills', 'prd-generator'],
      pipelineDoc: 'ADD-FEATURE-PIPELINE.md',
    });
  });

  it('maps /mc-braindump legacy alias to add-feature', () => {
    const result = classifyCommand('/mc-braindump');
    assert.equal(result.workflowType, 'add-feature');
  });

  it('maps /mc-init to setup with no vendor bundle', () => {
    const result = classifyCommand('/mc-init');
    assert.equal(result.workflowType, null);
    assert.equal(result.requiredVendor, null);
  });
});

describe('requiredVendorBundle', () => {
  it('returns startup-skill for project-start', () => {
    assert.equal(requiredVendorBundle('project-start'), 'startup-skill');
  });

  it('returns designer-skills for add-feature', () => {
    assert.equal(requiredVendorBundle('add-feature'), 'designer-skills');
  });
});

describe('requiredVendorBundles', () => {
  it('returns both designer-skills and prd-generator for add-feature', () => {
    assert.deepEqual(requiredVendorBundles('add-feature'), ['designer-skills', 'prd-generator']);
  });

  it('returns startup-skill only for project-start', () => {
    assert.deepEqual(requiredVendorBundles('project-start'), ['startup-skill']);
  });
});

describe('getPipelineStages', () => {
  it('returns project-start stages in order', () => {
    const stages = getPipelineStages('project-start');
    assert.deepEqual(stages, [
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
    ]);
  });

  it('returns add-feature UX stages in order', () => {
    const stages = getPipelineStages('add-feature', { workstream: 'ux' });
    assert.ok(stages.includes('research'));
    assert.ok(stages.includes('interaction'));
    assert.ok(stages.includes('mock'));
  });

  it('skips design stages for tech-stack add-feature', () => {
    const stages = getPipelineStages('add-feature', { workstream: 'tech-stack' });
    assert.ok(!stages.includes('research'));
    assert.ok(!stages.includes('mock'));
    assert.ok(!stages.includes('interaction'));
    assert.ok(stages.includes('explore'));
    assert.ok(stages.includes('prd'));
  });
});

describe('getNextStage', () => {
  it('advances project-start from braindump to validate', () => {
    assert.equal(getNextStage('project-start', 'braindump'), 'validate');
  });

  it('advances add-feature from explore to research for UX', () => {
    assert.equal(getNextStage('add-feature', 'explore', { workstream: 'ux' }), 'research');
  });

  it('advances add-feature from explore to clarify for tech-stack', () => {
    assert.equal(getNextStage('add-feature', 'explore', { workstream: 'tech-stack' }), 'clarify');
  });

  it('returns null after done', () => {
    assert.equal(getNextStage('project-start', 'done'), null);
  });
});

describe('resolveDispatch', () => {
  it('dispatches mc-setup-skills at vendor-setup', () => {
    const d = resolveDispatch('add-feature', 'vendor-setup');
    assert.equal(d.actor, 'subagent');
    assert.equal(d.subagent, 'mc-setup-skills');
  });

  it('dispatches mc-explore at explore stage', () => {
    const d = resolveDispatch('add-feature', 'explore');
    assert.equal(d.subagent, 'mc-explore');
    assert.equal(d.actor, 'subagent');
  });

  it('requires startup-design skill at validate stage', () => {
    const d = resolveDispatch('project-start', 'validate');
    assert.equal(d.actor, 'orchestrator');
    assert.deepEqual(d.vendorSkills, ['startup-design']);
  });

  it('requires design-research at research stage', () => {
    const d = resolveDispatch('add-feature', 'research');
    assert.deepEqual(d.vendorSkills, ['design-research']);
  });

  it('uses orchestrator for clarify not a subagent file', () => {
    const d = resolveDispatch('add-feature', 'clarify');
    assert.equal(d.actor, 'orchestrator');
    assert.equal(d.subagent, null);
  });

  it('never assigns implementer to explore', () => {
    const d = resolveDispatch('add-feature', 'explore');
    assert.notEqual(d.subagent, 'implementer');
  });

  it('requires prd-generator at prd stage via mc-prd subagent', () => {
    const d = resolveDispatch('add-feature', 'prd');
    assert.equal(d.subagent, 'mc-prd');
    assert.equal(d.actor, 'subagent');
    assert.deepEqual(d.vendorSkills, ['prd-generator']);
  });
});

describe('isOrchestratorStage', () => {
  it('clarify is orchestrator-only', () => {
    assert.equal(isOrchestratorStage('add-feature', 'clarify'), true);
  });

  it('explore is not orchestrator-only', () => {
    assert.equal(isOrchestratorStage('add-feature', 'explore'), false);
  });
});

describe('buildContextPacket', () => {
  it('scopes mc-explore read list to braindump and skips other features', () => {
    const packet = buildContextPacket({
      workflowType: 'add-feature',
      stage: 'explore',
      subagent: 'mc-explore',
      slug: 'notifications',
      controlRoot: 'docs/superpowers/control',
    });
    assert.ok(packet.read.some((r) => r.includes('braindump')));
    assert.ok(packet.skip.some((s) => s.includes('features/other-slug') || s.includes('other features')));
    assert.ok(packet.skip.some((s) => s.includes('project/market-brief') || s.includes('market-brief')));
  });

  it('scopes project-start validate to PROJECT.md only', () => {
    const packet = buildContextPacket({
      workflowType: 'project-start',
      stage: 'validate',
      subagent: null,
      slug: 'project',
      controlRoot: 'docs/superpowers/control',
    });
    assert.ok(packet.read.some((r) => r.includes('PROJECT.md')));
    assert.ok(packet.skip.some((s) => s.includes('features/')));
  });

  it('includes prd-generator in mc-prd context packet skills', () => {
    const packet = buildContextPacket({
      workflowType: 'add-feature',
      stage: 'prd',
      subagent: 'mc-prd',
      slug: 'notifications',
      controlRoot: 'docs/superpowers/control',
    });
    assert.ok(packet.skills.includes('prd-generator'));
  });

  it('includes BUILD-GATES reference for build stage implementer', () => {
    const packet = buildContextPacket({
      workflowType: 'add-feature',
      stage: 'build',
      subagent: 'implementer',
      slug: 'notifications',
      controlRoot: 'docs/superpowers/control',
      taskId: '1.1',
    });
    assert.ok(packet.read.some((r) => r.includes('BUILD-GATES') || r.includes('phase-')));
    assert.ok(packet.skip.some((s) => s.toLowerCase().includes('portfolio') || s.includes('full')));
  });
});

describe('validateRouteCard', () => {
  it('accepts a complete route card', () => {
    const result = validateRouteCard({
      workflow: 'add-feature',
      stage: 'explore',
      subagent: 'mc-explore',
      read: ['features/x/braindump.md'],
      skip: ['features/other-slug/**'],
      skills: [],
      outputs: ['features/x/explore/web.md'],
      gates: [],
      stop: 'DONE',
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
  });

  it('rejects route card missing skip list', () => {
    const result = validateRouteCard({
      workflow: 'add-feature',
      stage: 'explore',
      subagent: 'mc-explore',
      read: ['features/x/braindump.md'],
      outputs: [],
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes('skip')));
  });

  it('rejects orchestrator dispatching implementer at explore', () => {
    const result = validateRouteCard({
      workflow: 'add-feature',
      stage: 'explore',
      subagent: 'implementer',
      read: ['all'],
      skip: [],
      outputs: [],
    });
    assert.equal(result.ok, false);
  });
});
