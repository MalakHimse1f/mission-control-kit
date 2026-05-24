import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  suggestPipelineScope,
  shouldStopForPlanningOnly,
  shouldSkipPlanningForBuildOnly,
  shouldPauseForDecisionReview,
  resolveSessionIntent,
  normalizePipelineScope,
  normalizeDecisionReview,
  buildSessionIntentPromptLines,
} from '../control/lib/session-intent.mjs';
import { mergeOrchestratorControls, DEFAULT_ORCHESTRATOR_CONTROLS } from '../control/lib/orchestrator-controls.mjs';
import { collectSkillFindings } from '../control/scripts/dashboard-content.mjs';
import { collectItemRow, buildPickupPrompt } from '../control/scripts/dashboard-data.mjs';
import { buildDashboardHtml } from '../control/scripts/dashboard-template.mjs';
import { buildResearchPage, cardSection } from '../control/lib/research-layout.mjs';

const kitControlRoot = path.join(process.cwd(), 'control');

function setupTmpControl(tmp) {
  fs.mkdirSync(path.join(tmp, 'layout'), { recursive: true });
  fs.copyFileSync(
    path.join(kitControlRoot, 'layout/wireframe.css'),
    path.join(tmp, 'layout/wireframe.css'),
  );
}

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

  it('suggests full-pipeline when plan is ready with approved spec', () => {
    assert.equal(
      suggestPipelineScope({ pipelineStage: 'plan', specStatus: 'approved', hasTasks: true, hasPhases: true }),
      'full-pipeline',
    );
  });

  it('suggests full-pipeline when feature is done', () => {
    assert.equal(
      suggestPipelineScope({ pipelineStage: 'done', specStatus: 'approved', hasTasks: true, hasPhases: true }),
      'full-pipeline',
    );
  });

  it('normalizes invalid pipeline scope to full-pipeline', () => {
    assert.equal(normalizePipelineScope('bogus'), 'full-pipeline');
    assert.equal(normalizePipelineScope(undefined), 'full-pipeline');
    assert.equal(normalizePipelineScope('planning-only'), 'planning-only');
  });

  it('normalizes invalid decision review to review-first', () => {
    assert.equal(normalizeDecisionReview('bogus'), 'review-first');
    assert.equal(normalizeDecisionReview(undefined), 'review-first');
    assert.equal(normalizeDecisionReview('auto-proceed'), 'auto-proceed');
  });

  it('resolveSessionIntent merges defaults for partial controls', () => {
    assert.deepEqual(resolveSessionIntent({ sessionIntent: { pipelineScope: 'build-only' } }), {
      pipelineScope: 'build-only',
      decisionReview: 'review-first',
    });
  });

  it('stops planning-only at build gate', () => {
    const controls = mergeOrchestratorControls(DEFAULT_ORCHESTRATOR_CONTROLS, {
      sessionIntent: { pipelineScope: 'planning-only' },
    });
    assert.equal(shouldStopForPlanningOnly(controls, 'build'), true);
    assert.equal(shouldStopForPlanningOnly(controls, 'plan'), false);
  });

  it('skips planning for build-only when plan artifacts exist', () => {
    const controls = { sessionIntent: { pipelineScope: 'build-only' } };
    assert.equal(
      shouldSkipPlanningForBuildOnly(controls, { hasPhases: true, hasTasks: true, specStatus: 'approved' }),
      true,
    );
    assert.equal(
      shouldSkipPlanningForBuildOnly(controls, { hasPhases: false, hasTasks: true, specStatus: 'approved' }),
      false,
    );
    assert.equal(
      shouldSkipPlanningForBuildOnly(
        { sessionIntent: { pipelineScope: 'full-pipeline' } },
        { hasPhases: true, hasTasks: true, specStatus: 'approved' },
      ),
      false,
    );
  });

  it('pauses for decision review on skill stages when review-first', () => {
    const controls = { sessionIntent: { decisionReview: 'review-first' } };
    assert.equal(shouldPauseForDecisionReview(controls, 'research'), true);
    assert.equal(shouldPauseForDecisionReview(controls, 'explore'), true);
    assert.equal(shouldPauseForDecisionReview(controls, 'plan'), true);
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
    assert.match(text, /stop when pipelineStage would advance to build/);
  });

  it('buildSessionIntentPromptLines describes build-only and auto-proceed', () => {
    const text = buildSessionIntentPromptLines({
      sessionIntent: { pipelineScope: 'build-only', decisionReview: 'auto-proceed' },
    }).join('\n');
    assert.match(text, /skip braindump–plan/);
    assert.match(text, /Auto-proceed/);
  });
});

describe('pickup prompt embeds session intent', () => {
  it('includes session intent lines and AskQuestion reminder', () => {
    const prompt = buildPickupPrompt({
      workstream: 'feature',
      slug: 'alpha',
      stage: { key: 'plan', label: 'Plan' },
      status: { pipelineStage: 'plan' },
      global: {},
      controls: {
        sessionIntent: { pipelineScope: 'planning-only', decisionReview: 'review-first' },
      },
    });
    assert.match(prompt, /SESSION START: Ask pipeline scope \+ decision review/);
    assert.match(prompt, /sessionIntent/);
    assert.match(prompt, /pipelineScope: planning-only/);
    assert.match(prompt, /decisionReview: review-first/);
    assert.match(prompt, /SESSION-INTENT\.md/);
  });
});

describe('collectItemRow skillFindings integration', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-row-skill-'));
    setupTmpControl(tmp);
    const slugDir = path.join(tmp, 'features', 'demo');
    fs.mkdirSync(slugDir, { recursive: true });
    fs.writeFileSync(
      path.join(slugDir, 'status.json'),
      JSON.stringify({ pipelineStage: 'research', specStatus: 'draft', tasks: [] }),
    );
    fs.writeFileSync(
      path.join(slugDir, 'research.html'),
      buildResearchPage({
        title: 'Research',
        sections: [cardSection({ title: 'Finding', body: 'Findings here.' })],
      }),
    );
    fs.writeFileSync(
      path.join(slugDir, 'interaction.html'),
      buildResearchPage({
        title: 'Interaction',
        sections: [cardSection({ title: 'Flow', body: 'Flows defined.' })],
      }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('attaches skillFindings from disk to feature row', () => {
    const row = collectItemRow(tmp, 'feature', 'demo', {}, -1);
    assert.equal(row.skillFindings.length, 2);
    assert.equal(row.skillFindings[0].file, 'research.html');
    assert.equal(row.skillFindings[0].format, 'html');
    assert.match(row.skillFindings[1].html, /Flows defined/);
  });

  it('embeds session intent in row pickupPrompt from orchestrator controls', () => {
    fs.mkdirSync(path.join(tmp, '.mc'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, '.mc', 'orchestrator-controls.json'),
      JSON.stringify({
        sessionIntent: { pipelineScope: 'planning-only', decisionReview: 'auto-proceed' },
      }),
    );
    const row = collectItemRow(tmp, 'feature', 'demo', {}, -1);
    assert.match(row.pickupPrompt, /pipelineScope: planning-only/);
    assert.match(row.pickupPrompt, /decisionReview: auto-proceed/);
  });

  it('returns empty skillFindings for tech-stack rows', () => {
    const techDir = path.join(tmp, 'tech-stack', 'next-app');
    fs.mkdirSync(techDir, { recursive: true });
    fs.writeFileSync(path.join(techDir, 'status.json'), JSON.stringify({ pipelineStage: 'braindump' }));
    const row = collectItemRow(tmp, 'tech-stack', 'next-app', {}, -1);
    assert.deepEqual(row.skillFindings, []);
  });
});

describe('dashboard embeds skillFindings', () => {
  it('includes skill findings section and serializes findings in MC_ITEMS', () => {
    const html = buildDashboardHtml({
      generatedAt: new Date().toISOString(),
      handoff: '',
      stack: { techStackStatus: 'established', summary: '—', projectMode: '—', layoutTargets: [] },
      global: {},
      rows: [
        {
          id: 'demo',
          workstream: 'feature',
          type: 'Feature',
          stage: 'Research',
          stageKey: 'research',
          pipelineStage: 'research',
          specStatus: 'draft',
          layoutStatus: '—',
          targetCodebases: [],
          stepTimeline: [],
          progress: { done: 0, total: 0, pct: 0 },
          lastUpdated: null,
          lastUpdatedDisplay: '—',
          currentTaskId: '—',
          currentTaskTitle: '',
          workingTaskId: null,
          workingTaskTitle: '',
          hasWorkingTask: false,
          branch: '—',
          order: null,
          inProgress: true,
          isBuilding: false,
          nextCommand: '/mc',
          pickupPrompt: 'pickup',
          tasks: [],
          braindump: null,
          spec: null,
          layoutDoc: null,
          exploreDocs: [],
          skillFindings: [
            {
              file: 'research.html',
              label: 'UX research',
              source: 'design-research',
              format: 'html',
              html: '<!DOCTYPE html><html><body><div class="wf-card">Persona: admin user</div></body></html>',
            },
          ],
          phaseDocs: [],
          journalEntries: [],
          wireframes: [],
          screenshots: [],
        },
      ],
      defaultSort: 'lastUpdated',
      kitVersion: null,
      controls: null,
    });

    assert.match(html, /id="detail-skill-findings"/);
    assert.match(html, /Skill findings/);

    const start = html.indexOf('window.MC_ITEMS = ');
    const end = html.indexOf('</script>', start);
    const json = html.slice(start, end).replace(/^window\.MC_ITEMS = /, '').replace(/;window\.MC_DEFAULT_SORT.*$/, '');
    const items = JSON.parse(json);
    assert.equal(items[0].skillFindings[0].label, 'UX research');
    assert.match(items[0].skillFindings[0].html, /admin user/);
    assert.match(html, /renderResearchPages/);
  });
});

describe('migration 4.6.0-session-intent', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-migrate-460-'));
    fs.mkdirSync(path.join(tmp, '.mc'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, '.mc', 'orchestrator-controls.json'),
      JSON.stringify({ advanceToNextFeature: true, version: 2 }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('adds sessionIntent defaults without clobbering existing controls', async () => {
    const { up } = await import('../migrations/4.6.0-session-intent.mjs');
    await up({ controlRoot: tmp });
    const raw = JSON.parse(fs.readFileSync(path.join(tmp, '.mc', 'orchestrator-controls.json'), 'utf8'));
    assert.equal(raw.advanceToNextFeature, true);
    assert.deepEqual(raw.sessionIntent, {
      pipelineScope: 'full-pipeline',
      decisionReview: 'review-first',
    });
  });

  it('preserves existing sessionIntent partial patch', async () => {
    fs.writeFileSync(
      path.join(tmp, '.mc', 'orchestrator-controls.json'),
      JSON.stringify({
        sessionIntent: { pipelineScope: 'planning-only' },
      }),
    );
    const { up } = await import('../migrations/4.6.0-session-intent.mjs');
    await up({ controlRoot: tmp });
    const raw = JSON.parse(fs.readFileSync(path.join(tmp, '.mc', 'orchestrator-controls.json'), 'utf8'));
    assert.equal(raw.sessionIntent.pipelineScope, 'planning-only');
    assert.equal(raw.sessionIntent.decisionReview, 'review-first');
  });
});

describe('collectSkillFindings legacy markdown fallback', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-skill-findings-'));
    setupTmpControl(tmp);
    const slugDir = path.join(tmp, 'features', 'demo');
    fs.mkdirSync(slugDir, { recursive: true });
    fs.writeFileSync(path.join(slugDir, 'research.md'), '# Research\nPersonas defined.');
    fs.writeFileSync(path.join(slugDir, 'ux-strategy.md'), '# Strategy\nIA map.');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('converts legacy markdown skill outputs to HTML for dashboard', () => {
    const findings = collectSkillFindings(tmp, 'features', 'demo');
    assert.equal(findings.length, 2);
    assert.equal(findings[0].format, 'html');
    assert.equal(findings[0].label, 'UX research');
    assert.match(findings[0].html, /Personas defined/);
    assert.match(findings[1].html, /IA map/);
  });

  it('omits missing interaction artifact', () => {
    const findings = collectSkillFindings(tmp, 'features', 'demo');
    assert.ok(!findings.some((f) => f.file === 'interaction.html' || f.file === 'interaction.md'));
  });
});
