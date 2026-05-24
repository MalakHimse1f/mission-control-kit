import fs from 'node:fs';
import path from 'node:path';
import { canAutoAdvance } from './orchestrator-controls.mjs';

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hasPlanFiles(controlRoot, slug) {
  const phasesDir = path.join(controlRoot, 'features', slug, 'phases');
  if (!fs.existsSync(phasesDir)) return false;
  return fs.readdirSync(phasesDir).some((f) => f.endsWith('.md') && !f.startsWith('README'));
}

function readFeatureStatus(controlRoot, slug) {
  return readJson(path.join(controlRoot, 'features', slug, 'status.json')) ?? {};
}

function isFeatureDone(status) {
  return status.pipelineStage === 'done';
}

function isBuildQueueEligible(controlRoot, slug, scope) {
  const status = readFeatureStatus(controlRoot, slug);
  if (isFeatureDone(status)) return false;
  if (status.specStatus && status.specStatus !== 'approved') return false;

  const tasks = status.tasks ?? [];
  const hasPlan = hasPlanFiles(controlRoot, slug);

  if (scope === 'build-only') {
    if (!hasPlan || !tasks.length) return false;
    const stage = status.pipelineStage;
    if (['braindump', 'explore', 'clarify', 'prd', 'mock', 'plan'].includes(stage)) return false;
    if (tasks.every((t) => t.status === 'done') && stage !== 'validate') return false;
    return true;
  }

  if (scope === 'resume-only') {
    return !isFeatureDone(status);
  }

  return !isFeatureDone(status);
}

/**
 * Pick the next UX feature slug from buildOrder for unattended advance.
 * @returns {{ slug: string|null, order: number|null, reason: string|null, blocked: string|null }}
 */
export function pickNextFeature(controlRoot, global, controls) {
  const gate = canAutoAdvance(global, controls);
  if (!gate.allowed) {
    return { slug: null, order: null, reason: gate.reason, blocked: 'gate' };
  }

  const buildOrder = global?.buildOrder ?? [];
  if (!buildOrder.length) {
    return { slug: null, order: null, reason: 'buildOrder is empty.', blocked: 'no-order' };
  }

  const scope = controls.autoAdvanceScope ?? 'build-only';

  for (let i = 0; i < buildOrder.length; i += 1) {
    const slug = buildOrder[i];
    if (!fs.existsSync(path.join(controlRoot, 'features', slug))) continue;
    const status = readFeatureStatus(controlRoot, slug);
    if (isFeatureDone(status)) continue;
    if (isBuildQueueEligible(controlRoot, slug, scope)) {
      return {
        slug,
        order: i + 1,
        reason: null,
        blocked: null,
      };
    }
  }

  return {
    slug: null,
    order: null,
    reason: 'No eligible features remain in build order for the current auto-advance scope.',
    blocked: 'exhausted',
  };
}

export function hasQueuedWork(controlRoot, global, controls) {
  const active = global?.activeFeature;
  if (active) {
    const status = readFeatureStatus(controlRoot, active);
    if (!isFeatureDone(status)) return true;
  }
  const next = pickNextFeature(controlRoot, global, controls);
  return Boolean(next.slug);
}
