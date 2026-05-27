/**
 * v5 feature detail data loader.
 *
 * Reads `{controlRoot}/control/v5/features/{slug}/status.json` and
 * `decisions.json`, where `controlRoot` is the project root (the directory
 * containing `control/v5/`), and returns the bundle needed by
 * `control/scripts/v5/render-feature.mjs` to render the per-feature page
 * (`GET /feature/:slug`).
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
import { loadAllDocs } from './feature-docs.mjs';

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

  const featureDir = path.join(controlRoot, 'control', 'v5', 'features', slug);
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

  // Per-decision visual fragments live at:
  //   {controlRoot}/features/{slug}/decisions/{decision.id}.html
  // Read each one (if present) and attach as decision.fragmentHtml so the
  // renderer can stay pure. Missing fragments → null (text-card fallback).
  const decisionsDir = path.join(featureDir, 'decisions');
  async function loadFragment(decisionId) {
    if (!decisionId || typeof decisionId !== 'string') return null;
    // Defense in depth: only allow simple decision IDs, no path tricks.
    if (decisionId.includes('/') || decisionId.includes('\\') || decisionId.includes('..')) {
      return null;
    }
    const fragmentPath = path.join(decisionsDir, `${decisionId}.html`);
    // Confirm resolved path is still inside decisionsDir.
    const resolved = path.resolve(fragmentPath);
    const rootResolved = path.resolve(decisionsDir);
    if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
      return null;
    }
    try {
      return await fs.readFile(fragmentPath, 'utf8');
    } catch (err) {
      if (err && err.code === 'ENOENT') return null;
      // Other read errors are non-fatal — log a warning and fall back.
      // eslint-disable-next-line no-console
      console.warn(
        `loadFeatureData: could not read fragment for "${decisionId}": ${err.message}`,
      );
      return null;
    }
  }

  // Shape per-tab views. Use the phase keys from the schema so the order
  // (ux, ui, architecture) is canonical.
  const tabs = {};
  for (const key of PHASE_KEYS) {
    const phase = (decisions.phases && decisions.phases[key]) || defaultPhase();
    const phaseDecisions = Array.isArray(phase.decisions) ? phase.decisions : [];
    // Attach fragmentHtml (runtime-only, not persisted) so the renderer can
    // inline visual fragments without doing IO itself.
    const decisionsWithFragments = await Promise.all(
      phaseDecisions.map(async (d) => {
        const fragmentHtml = d && d.id ? await loadFragment(d.id) : null;
        return { ...d, fragmentHtml };
      }),
    );
    tabs[key] = {
      key,
      label: PHASE_LABEL[key],
      status: typeof phase.status === 'string' ? phase.status : 'not-started',
      statusLabel: PHASE_STATUS_LABEL[phase.status] || 'Not started',
      decisions: decisionsWithFragments,
      pending: Array.isArray(phase.pending) ? phase.pending : [],
    };
  }

  // Documentation bundle: spec, tasks, phases, journal, explore, wireframes.
  // Pure read — gracefully handles missing files/dirs (empty arrays / {exists:false}).
  const docs = await loadAllDocs(slug, { controlRoot });

  return {
    slug,
    status,
    decisions,
    tabs,
    docs,
  };
}

// Exported for tests.
export const __test__ = { PHASE_LABEL, PHASE_STATUS_LABEL };
