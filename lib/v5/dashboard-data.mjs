/**
 * v5 dashboard data loader.
 *
 * Reads from disk (paths are relative to the project root, the directory
 * containing `control/v5/`):
 *   - {controlRoot}/control/v5/state.json          (optional, currently unused but reserved)
 *   - {controlRoot}/control/v5/features/<slug>/status.json
 *   - {controlRoot}/control/v5/features/<slug>/decisions.json (optional)
 *
 * Returns the bucketed shape the dashboard renderer expects:
 *   { liveAgents, upNext, allItems, filterCounts }
 *
 * Canonical stage values:
 *   "needs-input" | "ready" | "in-progress" | "complete"
 *
 * Notes:
 *   - status.stage is the canonical field (Task 5). The sample-project
 *     status.json files still carry a duplicate pipelineStage for
 *     backwards-compat with the v5 server's earlier shape; Task 4 cleans up.
 *   - Unknown / missing stages fall through to "needs-input" so they show up
 *     in the dashboard rather than disappearing silently.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const KNOWN_STAGES = new Set(['needs-input', 'ready', 'in-progress', 'complete']);

async function readJsonOrNull(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    return null; // best-effort: don't blow up the dashboard on a malformed file
  }
}

/**
 * Read a single feature's record. Returns:
 *   { slug, stage, currentPhase, lastUpdatedAt, description, tasks?, decisions? }
 * or null if the feature has no status.json at all.
 */
async function readFeature(featuresRoot, slug) {
  const statusPath = path.join(featuresRoot, slug, 'status.json');
  const decisionsPath = path.join(featuresRoot, slug, 'decisions.json');
  const status = await readJsonOrNull(statusPath);
  if (!status) return null;
  const decisions = await readJsonOrNull(decisionsPath);

  // Canonical stage field is `stage`. Fall back to pipelineStage during the
  // Task-4-cleanup window; default to "needs-input" if neither is present.
  let stage = status.stage || status.pipelineStage || 'needs-input';
  if (!KNOWN_STAGES.has(stage)) stage = 'needs-input';

  return {
    slug,
    stage,
    currentPhase: status.currentPhase || null,
    lastUpdatedAt: status.lastUpdatedAt || null,
    description: status.description || '',
    tasks: Array.isArray(status.tasks) ? status.tasks : null,
    decisions,
  };
}

/** Compute task progress { done, total, percent } from a status.tasks array. */
function taskProgress(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;
  const total = tasks.length;
  const done = tasks.filter((t) => t && t.status === 'done').length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent };
}

/**
 * Sort features by lastUpdatedAt descending (most recent first), with
 * undefined timestamps sorted last. Falls back to slug as a stable
 * secondary key.
 */
function sortByRecent(a, b) {
  const ta = a.lastUpdatedAt ? Date.parse(a.lastUpdatedAt) : NaN;
  const tb = b.lastUpdatedAt ? Date.parse(b.lastUpdatedAt) : NaN;
  if (Number.isFinite(ta) && Number.isFinite(tb)) {
    if (tb !== ta) return tb - ta;
  } else if (Number.isFinite(ta)) {
    return -1;
  } else if (Number.isFinite(tb)) {
    return 1;
  }
  return a.slug.localeCompare(b.slug);
}

/**
 * Load the full dashboard data shape.
 *
 * @param {{ controlRoot: string }} opts
 * @returns {Promise<{
 *   liveAgents: Array,
 *   upNext: object|null,
 *   allItems: Array,
 *   filterCounts: { needsInput: number, ready: number, inProgress: number, complete: number },
 *   state: object|null,
 * }>}
 */
export async function loadDashboardData({ controlRoot } = {}) {
  if (!controlRoot) throw new Error('loadDashboardData: controlRoot is required');
  const controlRootAbs = path.resolve(controlRoot);
  const featuresRoot = path.join(controlRootAbs, 'control', 'v5', 'features');
  const statePath = path.join(controlRootAbs, 'control', 'v5', 'state.json');

  const state = await readJsonOrNull(statePath);

  let entries = [];
  try {
    entries = await fs.readdir(featuresRoot, { withFileTypes: true });
  } catch (err) {
    if (!err || err.code !== 'ENOENT') throw err;
  }

  const slugs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const features = [];
  for (const slug of slugs) {
    const rec = await readFeature(featuresRoot, slug);
    if (rec) features.push(rec);
  }

  // Compute progress info for in-progress items
  for (const f of features) {
    f.progress = taskProgress(f.tasks);
  }

  const liveAgents = features
    .filter((f) => f.stage === 'in-progress')
    .sort(sortByRecent);

  const readyFeatures = features.filter((f) => f.stage === 'ready').sort(sortByRecent);
  const upNext = readyFeatures.length > 0 ? readyFeatures[0] : null;

  const allItems = [...features].sort(sortByRecent);

  const filterCounts = {
    needsInput: features.filter((f) => f.stage === 'needs-input').length,
    ready: features.filter((f) => f.stage === 'ready').length,
    inProgress: features.filter((f) => f.stage === 'in-progress').length,
    complete: features.filter((f) => f.stage === 'complete').length,
  };

  return { liveAgents, upNext, allItems, filterCounts, state };
}
