import fs from 'node:fs';
import path from 'node:path';
import { pickNextFeature } from '../lib/pick-next-feature.mjs';

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

/** After a feature completes, advance global state to the next build-queue slug. */
export function advanceToNextFeatureState(controlRoot, global, controls) {
  const next = pickNextFeature(controlRoot, global, controls);
  if (!next.slug) return { global, next: null, reason: next.reason };

  const merged = {
    ...global,
    activeFeature: next.slug,
    activeWorkstream: 'feature',
    phase: 'build',
    currentTaskId: null,
    lastUpdatedAt: new Date().toISOString(),
    lastAutoAdvanceAt: new Date().toISOString(),
    lastAutoAdvanceTo: next.slug,
  };
  writeJson(path.join(controlRoot, 'state.json'), merged);
  return { global: merged, next, reason: null };
}
