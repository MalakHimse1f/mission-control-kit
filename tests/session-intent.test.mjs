import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  suggestPipelineScope,
  shouldStopForPlanningOnly,
  shouldPauseForDecisionReview,
  resolveSessionIntent,
  buildSessionIntentPromptLines,
} from '../control/lib/session-intent.mjs';
import { mergeOrchestratorControls, DEFAULT_ORCHESTRATOR_CONTROLS } from '../control/lib/orchestrator-controls.mjs';
import { collectSkillFindings } from '../control/scripts/dashboard-content.mjs';

describe('session-intent', () => {
  it('suggests planning-only during early planning stages', () => {
    assert.equal(
      suggestPipelineScope({ pipelineStage: 'plan', specStatus: 'draft', hasTasks: false, hasPhases: false }),
      'planning-only',
    );
  });

  it('suggests build-only when already in build stage', () => {
    assert.equal(
      suggestPipelineScope({ pipelineStage: 'build', specStatus: 'approved', hasTasks: true, hasPhases: true }),
      'build-only',
    );
  });

  it('stops planning-only at build gate', () => {
    const controls = mergeOrchestratorControls(DEFAULT_ORCHESTRATOR_CONTROLS, {
      sessionIntent: { pipelineScope: 'planning-only' },
    });
    assert.equal(shouldStopForPlanningOnly(controls, 'build'), true);
    assert.equal(shouldStopForPlanningOnly(controls, 'plan'), false);
  });

  it('pauses for decision review on skill stages when review-first', () => {
    const controls = resolveSessionIntent({ sessionIntent: { decisionReview: 'review-first' } });
    assert.equal(shouldPauseForDecisionReview(controls, 'research'), true);
    assert.equal(shouldPauseForDecisionReview(controls, 'build'), false);
  });

  it('does not pause for decision review when auto-proceed', () => {
    const controls = { sessionIntent: { decisionReview: 'auto-proceed' } };
    assert.equal(shouldPauseForDecisionReview(controls, 'research'), false);
  });

  it('buildSessionIntentPromptLines includes scope and review', () => {
    const lines = buildSessionIntentPromptLines({
      sessionIntent: { pipelineScope: 'planning-only', decisionReview: 'review-first' },
    });
    const text = lines.join('\n');
    assert.match(text, /planning-only/);
    assert.match(text, /review-first/);
    assert.match(text, /SESSION-INTENT/);
  });
});

describe('collectSkillFindings', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-skill-findings-'));
    const slugDir = path.join(tmp, 'features', 'demo');
    fs.mkdirSync(slugDir, { recursive: true });
    fs.writeFileSync(path.join(slugDir, 'research.md'), '# Research\nPersonas defined.');
    fs.writeFileSync(path.join(slugDir, 'ux-strategy.md'), '# Strategy\nIA map.');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('collects vendor skill markdown from feature folder', () => {
    const findings = collectSkillFindings(tmp, 'features', 'demo');
    assert.equal(findings.length, 2);
    assert.equal(findings[0].label, 'UX research');
    assert.equal(findings[0].source, 'design-research');
    assert.match(findings[1].content, /IA map/);
  });

  it('omits missing interaction.md', () => {
    const findings = collectSkillFindings(tmp, 'features', 'demo');
    assert.ok(!findings.some((f) => f.file === 'interaction.md'));
  });
});
