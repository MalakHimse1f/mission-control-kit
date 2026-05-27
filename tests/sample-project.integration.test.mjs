import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildDispatchPlan,
  buildContextPacket,
  validateRouteCard,
  classifyCommand,
  getNextStage,
} from '../lib/mc-router.mjs';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sampleRoot = path.join(kitRoot, 'sample-project');
const controlRoot = path.join(sampleRoot, 'docs/superpowers/control');

function run(cmd, cwd = kitRoot) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

describe('sample project install', () => {
  before(() => {
    run(`bash "${path.join(kitRoot, 'install.sh')}" "${sampleRoot}" both`);
  });

  // v5.2.0: v4 control docs (ROUTER.md, PROJECT-START-PIPELINE.md, etc.)
  // are no longer synced into the user project — install.sh runs v5
  // migrations only. The test that asserted those files were copied has
  // been retired; the routing.test.mjs unit tests still cover the v4
  // dispatch logic itself.

  it('installs mc-start and mc-feature skills', () => {
    assert.ok(fs.existsSync(path.join(sampleRoot, '.claude/skills/mc-start/SKILL.md')));
    assert.ok(fs.existsSync(path.join(sampleRoot, '.claude/skills/mc-feature/SKILL.md')));
    assert.ok(fs.existsSync(path.join(sampleRoot, '.claude/skills/mc-setup-skills/SKILL.md')));
  });

  it('bundles vendor skills into sample project', () => {
    const check = run(`node "${path.join(kitRoot, 'scripts/check-vendor-skills.mjs')}" "${sampleRoot}" all`);
    assert.ok(check.includes('VENDOR_SKILLS_OK'));
  });

  it('bundles prd-generator skill for add-feature workflow', () => {
    const prdSkill = path.join(sampleRoot, '.claude/skills/vendor/prd-generator/SKILL.md');
    assert.ok(fs.existsSync(prdSkill), 'missing prd-generator/SKILL.md');
    const content = fs.readFileSync(prdSkill, 'utf8');
    assert.ok(content.includes('name: prd-generator'));
    const check = run(`node "${path.join(kitRoot, 'scripts/check-vendor-skills.mjs')}" "${sampleRoot}" add-feature`);
    assert.ok(check.includes('prd-generator'));
  });

  it('bundles superpowers skills for both workflows', () => {
    for (const skill of [
      'brainstorming',
      'writing-plans',
      'subagent-driven-development',
      'verification-before-completion',
    ]) {
      const p = path.join(sampleRoot, '.claude/skills/vendor/superpowers', skill, 'SKILL.md');
      assert.ok(fs.existsSync(p), `missing superpowers/${skill}`);
    }
    const check = run(`node "${path.join(kitRoot, 'scripts/check-vendor-skills.mjs')}" "${sampleRoot}" all`);
    assert.ok(check.includes('superpowers'));
  });

  // v5.2.0: the v4 static dashboard generator is no longer wired into the
  // installer (the v5 dashboard is served live from
  // `mission-control-kit/control/scripts/v5/dashboard-server.mjs`).
});

describe('orchestrator routing simulation on sample project', () => {
  it('project-start never dispatches mc-explore at validate', () => {
    const plan = buildDispatchPlan('project-start');
    const validate = plan.find((s) => s.stage === 'validate');
    assert.equal(validate.actor, 'orchestrator');
    assert.deepEqual(validate.vendorSkills, ['startup-design']);
    const explore = plan.find((s) => s.subagent === 'mc-explore');
    assert.equal(explore, undefined);
  });

  it('add-feature explore dispatches mc-explore not orchestrator', () => {
    const plan = buildDispatchPlan('add-feature', { workstream: 'ux' });
    const explore = plan.find((s) => s.stage === 'explore');
    assert.equal(explore.subagent, 'mc-explore');
    assert.equal(explore.actor, 'subagent');
  });

  it('add-feature prd dispatches mc-prd with prd-generator skill', () => {
    const plan = buildDispatchPlan('add-feature', { workstream: 'ux' });
    const prd = plan.find((s) => s.stage === 'prd');
    assert.equal(prd.subagent, 'mc-prd');
    assert.ok(prd.vendorSkills.includes('prd-generator'));
  });

  it('add-feature research requires design-research via orchestrator', () => {
    const plan = buildDispatchPlan('add-feature', { workstream: 'ux' });
    const research = plan.find((s) => s.stage === 'research');
    assert.equal(research.actor, 'orchestrator');
    assert.ok(research.vendorSkills.includes('design-research'));
  });

  it('tech-stack path skips research after explore', () => {
    assert.equal(getNextStage('add-feature', 'explore', { workstream: 'tech-stack' }), 'clarify');
  });

  it('every subagent stage has valid route card with skip list', () => {
    const plan = buildDispatchPlan('add-feature', { workstream: 'ux' });
    for (const step of plan) {
      if (step.actor !== 'subagent') continue;
      const packet = buildContextPacket({
        workflowType: 'add-feature',
        stage: step.stage,
        subagent: step.subagent,
        slug: 'habit-log',
        controlRoot: 'docs/superpowers/control',
        taskId: '1.1',
      });
      const result = validateRouteCard({
        workflow: 'add-feature',
        stage: step.stage,
        subagent: step.subagent,
        read: packet.read.length ? packet.read : ['docs/superpowers/control/features/habit-log/braindump.md'],
        skip: packet.skip.length ? packet.skip : ['features/other-slug/**'],
        skills: packet.skills,
        outputs: [`features/habit-log/journal/${step.stage}.md`],
        gates: [],
        stop: 'DONE',
      });
      assert.equal(result.ok, true, `${step.stage}: ${result.errors.join(', ')}`);
    }
  });
});

describe('sample project scaffold (project-start + add-feature)', () => {
  it('can scaffold project-start artifacts', () => {
    const projectDir = path.join(controlRoot, 'project');
    fs.mkdirSync(projectDir, { recursive: true });
    const projectMd = path.join(projectDir, 'PROJECT.md');
    fs.writeFileSync(
      projectMd,
      '# Habit Tracker\n\nSample product for MC v4 validation.\n',
    );
    fs.writeFileSync(
      path.join(projectDir, 'status.json'),
      JSON.stringify({ workflowType: 'project-start', projectStartStage: 'validate' }, null, 2),
    );
    assert.ok(fs.existsSync(projectMd));
    const packet = buildContextPacket({
      workflowType: 'project-start',
      stage: 'validate',
      subagent: null,
      slug: 'project',
      controlRoot: 'docs/superpowers/control',
    });
    assert.ok(packet.read.some((r) => r.includes('PROJECT.md')));
    assert.ok(packet.skip.some((s) => s.includes('features')));
  });

  it('can scaffold add-feature braindump for habit-log', () => {
    const slug = 'habit-log';
    const featureDir = path.join(controlRoot, 'features', slug);
    fs.mkdirSync(path.join(featureDir, 'journal'), { recursive: true });
    fs.writeFileSync(
      path.join(featureDir, 'braindump.md'),
      '# Habit log\n\nDaily check-in flow for sample app.\n',
    );
    fs.writeFileSync(
      path.join(featureDir, 'status.json'),
      JSON.stringify({ pipelineStage: 'explore', slug }, null, 2),
    );
    const dispatch = buildDispatchPlan('add-feature', { workstream: 'ux' }).find((s) => s.stage === 'explore');
    assert.equal(dispatch.subagent, 'mc-explore');
    const packet = buildContextPacket({
      workflowType: 'add-feature',
      stage: 'explore',
      subagent: 'mc-explore',
      slug,
      controlRoot: 'docs/superpowers/control',
    });
    assert.ok(packet.read.some((r) => r.includes('habit-log')));
  });

  it('classifyCommand matches installed skill entry points', () => {
    const mcStartSkill = fs.readFileSync(path.join(sampleRoot, '.claude/skills/mc-start/SKILL.md'), 'utf8');
    const mcFeatureSkill = fs.readFileSync(path.join(sampleRoot, '.claude/skills/mc-feature/SKILL.md'), 'utf8');
    assert.ok(mcStartSkill.includes('startup-design'));
    assert.ok(mcFeatureSkill.includes('design-research'));
    assert.ok(mcFeatureSkill.includes('prd-generator'));
    assert.equal(classifyCommand('/mc-start').requiredVendor, 'startup-skill');
    assert.equal(classifyCommand('/mc-feature').requiredVendor, 'designer-skills');
    assert.deepEqual(classifyCommand('/mc-feature').requiredVendors, ['designer-skills', 'prd-generator']);
  });
});
