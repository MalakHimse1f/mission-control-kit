import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  DEFAULT_ORCHESTRATOR_CONTROLS,
  mergeOrchestratorControls,
  writeOrchestratorControls,
  readOrchestratorControls,
  canAutoAdvance,
  ensureOrchestratorControls,
} from '../control/lib/orchestrator-controls.mjs';

describe('orchestrator-controls', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-controls-'));
    fs.writeFileSync(path.join(tmp, 'state.json'), JSON.stringify({ portfolioReviewStatus: 'draft' }));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('merges defaults with patch', () => {
    const merged = mergeOrchestratorControls(DEFAULT_ORCHESTRATOR_CONTROLS, {
      advanceToNextFeature: true,
      ralphLoop: { enabled: true },
    });
    assert.equal(merged.advanceToNextFeature, true);
    assert.equal(merged.ralphLoop.enabled, true);
    assert.equal(merged.ralphLoop.spawnFreshSession, true);
    assert.deepEqual(merged.buildWorkflow, DEFAULT_ORCHESTRATOR_CONTROLS.buildWorkflow);
    assert.deepEqual(merged.planWorkflow, DEFAULT_ORCHESTRATOR_CONTROLS.planWorkflow);
    assert.deepEqual(merged.sessionIntent, DEFAULT_ORCHESTRATOR_CONTROLS.sessionIntent);
  });

  it('merges nested sessionIntent patches', () => {
    const merged = mergeOrchestratorControls(DEFAULT_ORCHESTRATOR_CONTROLS, {
      sessionIntent: { pipelineScope: 'planning-only' },
    });
    assert.equal(merged.sessionIntent.pipelineScope, 'planning-only');
    assert.equal(merged.sessionIntent.decisionReview, 'review-first');
  });

  it('merges nested buildWorkflow and planWorkflow patches', () => {
    const merged = mergeOrchestratorControls(DEFAULT_ORCHESTRATOR_CONTROLS, {
      buildWorkflow: { mode: 'sdd', reviewChain: 'spec-only' },
      planWorkflow: { mode: 'executing-plans' },
    });
    assert.equal(merged.buildWorkflow.mode, 'sdd');
    assert.equal(merged.buildWorkflow.reviewChain, 'spec-only');
    assert.equal(merged.planWorkflow.mode, 'executing-plans');
  });

  it('writes and reads controls file under .mc', () => {
    const saved = writeOrchestratorControls(tmp, { advanceToNextFeature: true });
    assert.ok(saved.updatedAt);
    const read = readOrchestratorControls(tmp);
    assert.equal(read.advanceToNextFeature, true);
    assert.ok(fs.existsSync(path.join(tmp, '.mc', 'orchestrator-controls.json')));
  });

  it('ensureOrchestratorControls creates file once', () => {
    ensureOrchestratorControls(tmp);
    ensureOrchestratorControls(tmp);
    const read = readOrchestratorControls(tmp);
    assert.equal(read.advanceToNextFeature, false);
  });

  it('canAutoAdvance blocks when portfolio draft', () => {
    const controls = { ...DEFAULT_ORCHESTRATOR_CONTROLS, advanceToNextFeature: true };
    const gate = canAutoAdvance({ portfolioReviewStatus: 'draft' }, controls);
    assert.equal(gate.allowed, false);
  });

  it('canAutoAdvance allows when portfolio approved', () => {
    const controls = { ...DEFAULT_ORCHESTRATOR_CONTROLS, advanceToNextFeature: true };
    const gate = canAutoAdvance({ portfolioReviewStatus: 'approved' }, controls);
    assert.equal(gate.allowed, true);
  });
});
