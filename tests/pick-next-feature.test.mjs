import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { DEFAULT_ORCHESTRATOR_CONTROLS } from '../control/lib/orchestrator-controls.mjs';
import { pickNextFeature } from '../control/lib/pick-next-feature.mjs';

function writeFeature(controlRoot, slug, status, { withPlan = false } = {}) {
  const dir = path.join(controlRoot, 'features', slug);
  fs.mkdirSync(path.join(dir, 'phases'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(status, null, 2));
  if (withPlan) {
    fs.writeFileSync(path.join(dir, 'phases', 'phase-1.md'), '# Phase 1\n');
  }
}

describe('pickNextFeature', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pick-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('returns null when auto-advance off', () => {
    const global = { buildOrder: ['a', 'b'], portfolioReviewStatus: 'approved' };
    const result = pickNextFeature(tmp, global, DEFAULT_ORCHESTRATOR_CONTROLS);
    assert.equal(result.slug, null);
    assert.equal(result.blocked, 'gate');
  });

  it('returns null when portfolio not approved', () => {
    const controls = { ...DEFAULT_ORCHESTRATOR_CONTROLS, advanceToNextFeature: true };
    const global = { buildOrder: ['a'], portfolioReviewStatus: 'draft' };
    const result = pickNextFeature(tmp, global, controls);
    assert.equal(result.slug, null);
  });

  it('picks first build-ready feature in order', () => {
    const controls = { ...DEFAULT_ORCHESTRATOR_CONTROLS, advanceToNextFeature: true };
    const global = { buildOrder: ['done-f', 'ready-f', 'later-f'], portfolioReviewStatus: 'approved' };

    writeFeature(tmp, 'done-f', { pipelineStage: 'done', specStatus: 'approved', tasks: [{ id: '1.1', status: 'done' }] }, { withPlan: true });
    writeFeature(tmp, 'ready-f', {
      pipelineStage: 'build',
      specStatus: 'approved',
      tasks: [{ id: '1.1', status: 'backlog', title: 'First task' }],
    }, { withPlan: true });
    writeFeature(tmp, 'later-f', { pipelineStage: 'braindump' }, { withPlan: false });

    const result = pickNextFeature(tmp, global, controls);
    assert.equal(result.slug, 'ready-f');
    assert.equal(result.order, 2);
  });

  it('skips features without plan/tasks for build-only scope', () => {
    const controls = { ...DEFAULT_ORCHESTRATOR_CONTROLS, advanceToNextFeature: true };
    const global = { buildOrder: ['plan-only'], portfolioReviewStatus: 'approved' };
    writeFeature(tmp, 'plan-only', { pipelineStage: 'plan', specStatus: 'approved', tasks: [] }, { withPlan: true });

    const result = pickNextFeature(tmp, global, controls);
    assert.equal(result.slug, null);
    assert.equal(result.blocked, 'exhausted');
  });
});
