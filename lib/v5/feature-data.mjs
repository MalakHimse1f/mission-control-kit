/**
 * v5 feature detail data loader.
 *
 * Reads `{controlRoot}/features/{slug}/status.json` and `decisions.json`,
 * and returns the bundle needed by `control/scripts/v5/render-feature.mjs`
 * to render the per-feature page (`GET /feature/:slug`).
 *
 * Design notes:
 *  - Pure data loader, no HTML. No CWD or process state assumptions.
 *  - status.json is optional — if missing, status falls back to a minimal
 *    record built from the slug.
 *  - decisions.json is also optional — if missing, falls back to the
 *    default empty structure from `readDecisions` (Task 2).
 *  - Throws a clean error (with code 'ENOFEATURE') when the feature
 *    directory itself does not exist.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { readDecisions } from './decisions.mjs';
import { PHASE_KEYS } from './decisions-schema.mjs';

const PHASE_LABEL = {
  ux: 'UX',
  ui: 'UI',
  architecture: 'Architecture',
};

const PHASE_STATUS_LABEL = {
  complete: 'Complete',
  'in-progress': 'In progress',
  'not-started': 'Not started',
};

function defaultPhase() {
  return { status: 'not-started', decisions: [], pending: [] };
}

/**
 * Load a feature's status + decisions and shape them for rendering.
 *
 * @param {{ slug: string, controlRoot: string }} opts
 * @returns {Promise<{
 *   slug: string,
 *   status: object,
 *   decisions: object,
 *   tabs: {
 *     ux: { key: 'ux', label: 'UX', status: string, statusLabel: string, decisions: object[], pending: string[] },
 *     ui: { key: 'ui', label: 'UI', status: string, statusLabel: string, decisions: object[], pending: string[] },
 *     architecture: { key: 'architecture', label: 'Architecture', status: string, statusLabel: string, decisions: object[], pending: string[] },
 *   }
 * }>}
 */
export async function loadFeatureData({ slug, controlRoot } = {}) {
  if (!slug || typeof slug !== 'string') {
    throw new Error('loadFeatureData: slug must be a non-empty string');
  }
  if (!controlRoot || typeof controlRoot !== 'string') {
    throw new Error('loadFeatureData: controlRoot must be a non-empty string');
  }

  const featureDir = path.join(controlRoot, 'features', slug);
  try {
    const stat = await fs.stat(featureDir);
    if (!stat.isDirectory()) {
      const err = new Error(`feature "${slug}" is not a directory at ${featureDir}`);
      err.code = 'ENOFEATURE';
      throw err;
    }
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      const e = new Error(`feature "${slug}" not found at ${featureDir}`);
      e.code = 'ENOFEATURE';
      throw e;
    }
    throw err;
  }

  // status.json — optional. If missing, fall back to a minimal record.
  const statusPath = path.join(featureDir, 'status.json');
  let status = null;
  try {
    const raw = await fs.readFile(statusPath, 'utf8');
    status = JSON.parse(raw);
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      // Malformed JSON — surface as a structured error in the status field
      // so the page can still render rather than 500.
      status = { slug, error: `status.json unreadable: ${err.message}` };
    } else {
      status = { slug };
    }
  }
  if (!status.slug) status.slug = slug;

  // decisions.json — readDecisions handles missing files (returns defaults).
  const decisions = await readDecisions(slug, { controlRoot });

  // Shape per-tab views. Use the phase keys from the schema so the order
  // (ux, ui, architecture) is canonical.
  const tabs = {};
  for (const key of PHASE_KEYS) {
    const phase = (decisions.phases && decisions.phases[key]) || defaultPhase();
    tabs[key] = {
      key,
      label: PHASE_LABEL[key],
      status: typeof phase.status === 'string' ? phase.status : 'not-started',
      statusLabel: PHASE_STATUS_LABEL[phase.status] || 'Not started',
      decisions: Array.isArray(phase.decisions) ? phase.decisions : [],
      pending: Array.isArray(phase.pending) ? phase.pending : [],
    };
  }

  return {
    slug,
    status,
    decisions,
    tabs,
  };
}

// Exported for tests.
export const __test__ = { PHASE_LABEL, PHASE_STATUS_LABEL };
