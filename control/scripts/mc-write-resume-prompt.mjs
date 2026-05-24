#!/usr/bin/env node
/**
 * Build and optionally write the ralph-loop resume prompt for the next orchestrator session.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveControlRoot } from '../lib/resolve-control-root.mjs';
import {
  ensureOrchestratorControls,
  readOrchestratorControls,
} from '../lib/orchestrator-controls.mjs';
import { pickNextFeature } from '../lib/pick-next-feature.mjs';
import { advanceToNextFeatureState } from './mc-advance-feature.mjs';
import { buildPickupPrompt } from './dashboard-data.mjs';
import { computeFeatureStage } from './dashboard-helpers.mjs';

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function buildRalphResumePrompt({ controls, pickupPrompt }) {
  const lines = [
    '/mc',
    '',
    'Ralph loop — fresh orchestrator session. Disk is source of truth.',
    '',
    'Read first:',
    '- docs/superpowers/control/.mc/orchestrator-controls.json',
    '- docs/superpowers/control/ORCHESTRATOR-CONTROLS.md',
    '- docs/superpowers/control/ORCHESTRATOR.md',
    '- docs/superpowers/control/HANDOFF.md',
    '- docs/superpowers/control/state.json',
    '',
  ];

  if (controls.advanceToNextFeature) {
    lines.push(
      'Auto-advance is ON (build queue only). When the active feature reaches pipelineStage done,',
      'call mc-advance logic: pick next eligible slug from buildOrder (portfolio must be approved).',
      'Always pause for clarify questions — never guess.',
      '',
    );
  }

  lines.push(pickupPrompt);
  return lines.join('\n');
}

export function resolveActiveSlug(controlRoot, global, controls) {
  const active = global?.activeFeature;
  if (active) {
    const status = readJson(path.join(controlRoot, 'features', active, 'status.json')) ?? {};
    if (status.pipelineStage !== 'done') return active;
  }
  const next = pickNextFeature(controlRoot, global, controls);
  if (next.slug && controls.advanceToNextFeature) {
    const { global: updated } = advanceToNextFeatureState(controlRoot, global, controls);
    return updated.activeFeature;
  }
  return active ?? next.slug;
}

export function buildResumePromptForDisk(controlRoot) {
  ensureOrchestratorControls(controlRoot);
  const global = readJson(path.join(controlRoot, 'state.json')) ?? {};
  const controls = readOrchestratorControls(controlRoot);
  const slug = resolveActiveSlug(controlRoot, global, controls);
  if (!slug) {
    throw new Error('No active or queued feature for resume prompt.');
  }

  const status = readJson(path.join(controlRoot, 'features', slug, 'status.json')) ?? {};
  const stage = computeFeatureStage(controlRoot, slug, status);
  const currentGlobal = readJson(path.join(controlRoot, 'state.json')) ?? global;
  const pickupPrompt = buildPickupPrompt({
    workstream: 'feature',
    slug,
    stage,
    status,
    global: currentGlobal,
  });
  return buildRalphResumePrompt({ controls, pickupPrompt });
}

export function writeRalphResumePrompt(controlRoot, prompt) {
  const out = path.join(controlRoot, '.mc', 'ralph', 'resume-prompt.txt');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${prompt.trim()}\n`);
  return out;
}

function main() {
  const projectRoot = process.argv[2] ?? process.cwd();
  const write = process.argv.includes('--write');
  const controlRoot = resolveControlRoot(projectRoot);
  const prompt = buildResumePromptForDisk(controlRoot);
  if (write) {
    const out = writeRalphResumePrompt(controlRoot, prompt);
    console.log(`Wrote ${out}`);
  } else {
    process.stdout.write(`${prompt}\n`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
