/**
 * v5 decisions.json read/write utilities.
 *
 * File layout: `{controlRoot}/control/v5/features/{slug}/decisions.json`
 * where `controlRoot` is the project root (the directory containing
 * `control/v5/`).
 *
 * Schema: see lib/v5/decisions-schema.mjs (per §3.4 and §9.3 of REFACTOR-REQUIREMENTS.md).
 *
 * Design notes:
 * - All file IO is async (node:fs/promises), UTF-8, JSON.stringify with 2-space indent.
 * - Writes are atomic: write to `decisions.json.tmp` then `fs.rename`.
 * - `controlRoot` defaults to the nearest project root (the directory whose
 *   child is `control/v5/`), walking up from process.cwd().
 * - No external dependencies — stdlib only.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { PHASE_KEYS, validateDecisions } from './decisions-schema.mjs';

/**
 * Walk up from a starting directory looking for the project root — the
 * directory whose child is `control/v5/`. Returns that directory (the project
 * root), NOT `control/v5/` itself.
 */
async function findNearestProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  // Guard against infinite loop at filesystem root.
  for (let i = 0; i < 64; i++) {
    const candidate = path.join(dir, 'control', 'v5');
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return dir;
    } catch {
      // not here, keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate project root (parent of control/v5/) by walking up from ${startDir}. ` +
      `Pass {controlRoot} explicitly to readDecisions/writeDecisions.`,
  );
}

async function resolveControlRoot(opts) {
  if (opts && opts.controlRoot) return opts.controlRoot;
  return findNearestProjectRoot(process.cwd());
}

function featurePath(controlRoot, slug) {
  return path.join(controlRoot, 'control', 'v5', 'features', slug, 'decisions.json');
}

/** Build a default empty decisions structure for a slug. */
function defaultDecisions(slug) {
  const now = new Date().toISOString();
  return {
    feature: slug,
    phases: Object.fromEntries(
      PHASE_KEYS.map((key) => [key, { status: 'not-started', decisions: [], pending: [] }]),
    ),
    deferred: [],
    updatedAt: now,
  };
}

/**
 * Read decisions.json for a slug. Returns the default empty structure if the
 * file does not exist (does not write it).
 *
 * @param {string} slug
 * @param {{ controlRoot?: string }} [opts] - controlRoot is the project root
 *   (directory containing `control/v5/`).
 * @returns {Promise<object>}
 */
export async function readDecisions(slug, opts = {}) {
  if (!slug || typeof slug !== 'string') {
    throw new Error('readDecisions: slug must be a non-empty string');
  }
  const controlRoot = await resolveControlRoot(opts);
  const filePath = featurePath(controlRoot, slug);
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return defaultDecisions(slug);
    }
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`readDecisions: ${filePath} is not valid JSON: ${err.message}`);
  }
  return parsed;
}

/**
 * Merge a partial payload onto the default structure so callers can write
 * just the parts they care about. Phase keys missing from `payload.phases`
 * fall back to the default phase shape.
 */
function normalizePayload(slug, payload) {
  const base = defaultDecisions(slug);
  if (!payload || typeof payload !== 'object') return base;

  const next = {
    feature: typeof payload.feature === 'string' ? payload.feature : slug,
    phases: { ...base.phases },
    deferred: Array.isArray(payload.deferred) ? payload.deferred : base.deferred,
    updatedAt: base.updatedAt, // overwritten below
  };

  if (payload.phases && typeof payload.phases === 'object') {
    for (const key of PHASE_KEYS) {
      const incoming = payload.phases[key];
      if (incoming && typeof incoming === 'object') {
        next.phases[key] = {
          status: typeof incoming.status === 'string' ? incoming.status : 'not-started',
          decisions: Array.isArray(incoming.decisions) ? incoming.decisions : [],
          pending: Array.isArray(incoming.pending) ? incoming.pending : [],
        };
      }
    }
  }

  return next;
}

/**
 * Write decisions.json for a slug. Validates against the schema, creates
 * parent directories if needed, and writes atomically (tmp + rename).
 *
 * Behavior:
 * - Sets `payload.feature` to `slug` if not provided.
 * - Throws if `payload.feature` is provided and does not match `slug`.
 * - Always overwrites `updatedAt` with the current ISO timestamp.
 *
 * @param {string} slug
 * @param {object} payload
 * @param {{ controlRoot?: string }} [opts] - controlRoot is the project root
 *   (directory containing `control/v5/`).
 */
export async function writeDecisions(slug, payload, opts = {}) {
  if (!slug || typeof slug !== 'string') {
    throw new Error('writeDecisions: slug must be a non-empty string');
  }
  if (payload && typeof payload.feature === 'string' && payload.feature !== slug) {
    throw new Error(
      `writeDecisions: payload.feature ("${payload.feature}") must match slug ("${slug}")`,
    );
  }

  const normalized = normalizePayload(slug, payload || {});
  normalized.updatedAt = new Date().toISOString();

  const { valid, errors } = validateDecisions(normalized);
  if (!valid) {
    throw new Error(
      `writeDecisions: invalid decisions payload for slug "${slug}":\n  - ${errors.join('\n  - ')}`,
    );
  }

  const controlRoot = await resolveControlRoot(opts);
  const filePath = featurePath(controlRoot, slug);
  const dirPath = path.dirname(filePath);
  await fs.mkdir(dirPath, { recursive: true });

  const tmpPath = `${filePath}.tmp`;
  const body = JSON.stringify(normalized, null, 2) + '\n';
  await fs.writeFile(tmpPath, body, 'utf8');
  await fs.rename(tmpPath, filePath);

  return normalized;
}

/**
 * Mark a phase as `complete`, clear its `pending[]`, and refresh `updatedAt`.
 * Reads the current file (or default structure), mutates, and writes back.
 *
 * @param {string} slug
 * @param {'ux'|'ui'|'architecture'} phase
 * @param {{ controlRoot?: string }} [opts]
 */
export async function markPhaseComplete(slug, phase, opts = {}) {
  if (!PHASE_KEYS.includes(phase)) {
    throw new Error(
      `markPhaseComplete: unknown phase "${phase}"; expected one of ${PHASE_KEYS.join('|')}`,
    );
  }
  const current = await readDecisions(slug, opts);
  current.phases[phase] = {
    ...current.phases[phase],
    status: 'complete',
    pending: [],
  };
  return writeDecisions(slug, current, opts);
}

/**
 * Return a `{ ux, ui, architecture }` summary of phase statuses. Defaults all
 * three to `not-started` if the file does not exist.
 *
 * @param {string} slug
 * @param {{ controlRoot?: string }} [opts]
 * @returns {Promise<{ ux: string, ui: string, architecture: string }>}
 */
export async function getPhaseStatus(slug, opts = {}) {
  const data = await readDecisions(slug, opts);
  const out = {};
  for (const key of PHASE_KEYS) {
    out[key] = (data.phases && data.phases[key] && data.phases[key].status) || 'not-started';
  }
  return out;
}

/**
 * Append a deferred question to `deferred[]`. Sets `raisedAt` to now.
 *
 * @param {string} slug
 * @param {string} question
 * @param {'ux'|'ui'|'architecture'} raisedDuring
 * @param {{ controlRoot?: string }} [opts]
 */
export async function deferQuestion(slug, question, raisedDuring, opts = {}) {
  if (typeof question !== 'string' || question.length === 0) {
    throw new Error('deferQuestion: question must be a non-empty string');
  }
  if (!PHASE_KEYS.includes(raisedDuring)) {
    throw new Error(
      `deferQuestion: raisedDuring must be one of ${PHASE_KEYS.join('|')}; got "${raisedDuring}"`,
    );
  }
  const current = await readDecisions(slug, opts);
  const entry = {
    question,
    raisedDuring,
    raisedAt: new Date().toISOString(),
  };
  current.deferred = Array.isArray(current.deferred) ? current.deferred : [];
  current.deferred.push(entry);
  return writeDecisions(slug, current, opts);
}
