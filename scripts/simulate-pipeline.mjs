#!/usr/bin/env node
/**
 * Simulate Mission Control v4 orchestrator routing for a sample walkthrough.
 * Does not call LLMs — validates dispatch plan + route cards only.
 */
import { buildDispatchPlan, buildContextPacket, validateRouteCard, classifyCommand } from '../lib/mc-router.mjs';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sampleRoot = path.join(kitRoot, 'sample-project');
const controlRoot = path.join(sampleRoot, 'docs/superpowers/control');

function ensureSampleInstalled() {
  const marker = path.join(controlRoot, 'ROUTER.md');
  if (fs.existsSync(marker)) return;
  console.log('Installing MC v4 into sample-project...');
  execSync(`bash "${path.join(kitRoot, 'install.sh')}" "${sampleRoot}" both`, {
    stdio: 'inherit',
  });
}

function simulateWorkflow(label, workflowType, options) {
  console.log(`\n=== ${label} (${workflowType}) ===\n`);
  const plan = buildDispatchPlan(workflowType, options);
  let errors = 0;

  for (const step of plan) {
    const actor = step.actor === 'orchestrator' ? 'ORCH' : `SUB:${step.subagent}`;
    const skills = step.vendorSkills?.length ? ` skills=[${step.vendorSkills.join(',')}]` : '';
    console.log(`${step.stage.padEnd(14)} → ${actor}${skills}`);

    if (step.subagent && step.subagent !== 'mc-setup-skills') {
      const packet = buildContextPacket({
        workflowType,
        stage: step.stage,
        subagent: step.subagent,
        slug: options.slug ?? 'habit-log',
        controlRoot: 'docs/superpowers/control',
        taskId: '1.1',
      });
      const card = {
        workflow: workflowType,
        stage: step.stage,
        subagent: step.subagent,
        read: packet.read,
        skip: packet.skip,
        skills: packet.skills,
        outputs: [`journal/${step.stage}.md`],
        gates: step.stage === 'build' ? ['lint', 'test'] : [],
        stop: 'DONE',
      };
      const v = validateRouteCard(card);
      if (!v.ok) {
        console.error(`  ROUTE CARD FAIL @ ${step.stage}:`, v.errors);
        errors++;
      }
    }

    if (step.stage === 'explore' && step.subagent === 'implementer') {
      console.error('  FAIL: implementer at explore');
      errors++;
    }
  }

  return errors;
}

ensureSampleInstalled();

const startCmd = classifyCommand('/mc-start');
const featureCmd = classifyCommand('/mc-feature');
console.log('Command routing:');
console.log('  /mc-start  →', startCmd.workflowType, '| vendors:', startCmd.requiredVendors ?? startCmd.requiredVendor);
console.log('  /mc-feature →', featureCmd.workflowType, '| vendors:', featureCmd.requiredVendors ?? featureCmd.requiredVendor);

let totalErrors = 0;
totalErrors += simulateWorkflow('Project START', 'project-start', { slug: 'project' });
totalErrors += simulateWorkflow('Add Feature (UX)', 'add-feature', { workstream: 'ux', slug: 'habit-log' });
totalErrors += simulateWorkflow('Add Feature (tech-stack)', 'add-feature', { workstream: 'tech-stack', slug: 'api-cache' });

if (totalErrors > 0) {
  console.error(`\nSimulation finished with ${totalErrors} routing error(s).`);
  process.exit(1);
}

console.log('\nSimulation OK — orchestrator/subagent routing valid.');
