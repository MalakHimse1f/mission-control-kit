/**
 * v5 feature documentation collectors.
 *
 * Reads per-feature documentation artifacts from disk and returns plain
 * JS data structures. Pure data layer — no HTML, no rendering. The
 * renderer lives in `control/scripts/v5/render-docs.mjs`.
 *
 * Directory layout (all under `{controlRoot}/features/{slug}/`):
 *   - spec.md
 *   - status.json (read for tasks[])
 *   - journal/NNN-*.md      (excludes files starting with `_`)
 *   - phases/phase-N.md
 *   - explore/*.{html,md}
 *   - layout/wireframes/*.html
 *
 * Design notes:
 *   - All collectors are async, handle missing dirs/files gracefully
 *     (return empty arrays or {exists: false}).
 *   - `controlRoot` defaults to the nearest `control/v5/` walking up
 *     from `process.cwd()`, matching the convention used in decisions.mjs.
 *   - No external dependencies — node:fs/promises and node:path only.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/** Walk up from a starting directory looking for `control/v5/`. */
async function findNearestControlV5(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 64; i++) {
    const candidate = path.join(dir, 'control', 'v5');
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch {
      // not here, keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate control/v5/ by walking up from ${startDir}. ` +
      `Pass {controlRoot} explicitly.`,
  );
}

async function resolveControlRoot(opts) {
  if (opts && opts.controlRoot) return opts.controlRoot;
  return findNearestControlV5(process.cwd());
}

function featureDir(controlRoot, slug) {
  return path.join(controlRoot, 'features', slug);
}

/** Try to read a directory; return [] for ENOENT, rethrow other errors. */
async function listDir(dir) {
  try {
    return await fs.readdir(dir);
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }
}

/** Extract a leading numeric prefix (e.g., "003-foo.md" → 3). NaN if absent. */
function leadingNumber(name) {
  const match = /^(\d+)/.exec(name);
  return match ? parseInt(match[1], 10) : NaN;
}

/**
 * Compare two filenames by their leading numeric prefix ascending.
 * Files with no numeric prefix sort to the end (alphabetically among themselves).
 */
function compareByLeadingNumber(a, b) {
  const na = leadingNumber(a);
  const nb = leadingNumber(b);
  const aHas = Number.isFinite(na);
  const bHas = Number.isFinite(nb);
  if (aHas && bHas) {
    if (na !== nb) return na - nb;
    return a.localeCompare(b);
  }
  if (aHas) return -1;
  if (bHas) return 1;
  return a.localeCompare(b);
}

/**
 * Read spec.md for a feature.
 *
 * @param {string} slug
 * @param {{ controlRoot?: string }} [opts]
 * @returns {Promise<{ exists: boolean, content: string, path: string }>}
 */
export async function loadSpec(slug, opts = {}) {
  const controlRoot = await resolveControlRoot(opts);
  const specPath = path.join(featureDir(controlRoot, slug), 'spec.md');
  try {
    const content = await fs.readFile(specPath, 'utf8');
    return { exists: true, content, path: specPath };
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return { exists: false, content: '', path: specPath };
    }
    throw err;
  }
}

/**
 * Convert a journal filename like "003-build-phase-1.md" → "Build phase 1".
 * Strips the leading "NNN-" and the ".md" suffix, replaces dashes with spaces,
 * and capitalizes the first character.
 */
function journalLabel(file) {
  let base = file.replace(/\.md$/i, '');
  base = base.replace(/^\d+-/, '');
  const spaced = base.replace(/-/g, ' ');
  if (spaced.length === 0) return spaced;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Load journal entries.
 *
 * @param {string} slug
 * @param {{ controlRoot?: string }} [opts]
 * @returns {Promise<Array<{ file: string, label: string, content: string }>>}
 */
export async function loadJournal(slug, opts = {}) {
  const controlRoot = await resolveControlRoot(opts);
  const dir = path.join(featureDir(controlRoot, slug), 'journal');
  const entries = await listDir(dir);
  const files = entries
    .filter((name) => name.toLowerCase().endsWith('.md') && !name.startsWith('_'))
    .sort(compareByLeadingNumber);
  const out = [];
  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(dir, file), 'utf8');
      out.push({ file, label: journalLabel(file), content });
    } catch (err) {
      if (err && err.code === 'ENOENT') continue;
      throw err;
    }
  }
  return out;
}

/**
 * Load phase plans.
 *
 * @param {string} slug
 * @param {{ controlRoot?: string }} [opts]
 * @returns {Promise<Array<{ file: string, label: string, content: string }>>}
 */
export async function loadPhases(slug, opts = {}) {
  const controlRoot = await resolveControlRoot(opts);
  const dir = path.join(featureDir(controlRoot, slug), 'phases');
  const entries = await listDir(dir);
  const files = entries
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .sort(compareByLeadingNumber);
  const out = [];
  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(dir, file), 'utf8');
      const label = file.replace(/\.md$/i, '');
      out.push({ file, label, content });
    } catch (err) {
      if (err && err.code === 'ENOENT') continue;
      throw err;
    }
  }
  return out;
}

/**
 * Load tasks from status.json.
 *
 * Returns the `tasks` array (or [] if missing/unreadable/no tasks).
 * Each task is normalized to a shallow shape. Status strings pass through
 * unvalidated.
 *
 * @param {string} slug
 * @param {{ controlRoot?: string }} [opts]
 * @returns {Promise<Array<{ id: string, title: string, status: string, updatedAt?: string, commit?: string, commitMessage?: string }>>}
 */
export async function loadTasks(slug, opts = {}) {
  const controlRoot = await resolveControlRoot(opts);
  const statusPath = path.join(featureDir(controlRoot, slug), 'status.json');
  let raw;
  try {
    raw = await fs.readFile(statusPath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const tasks = parsed && Array.isArray(parsed.tasks) ? parsed.tasks : [];
  return tasks.map((t) => {
    const out = {
      id: typeof t.id === 'string' ? t.id : '',
      title: typeof t.title === 'string' ? t.title : '',
      status: typeof t.status === 'string' ? t.status : '',
    };
    if (typeof t.updatedAt === 'string') out.updatedAt = t.updatedAt;
    if (typeof t.commit === 'string') out.commit = t.commit;
    if (typeof t.commitMessage === 'string') out.commitMessage = t.commitMessage;
    return out;
  });
}

/**
 * Load exploration docs.
 *
 * @param {string} slug
 * @param {{ controlRoot?: string }} [opts]
 * @returns {Promise<Array<{ name: string, format: 'html'|'md', content: string }>>}
 */
export async function loadExplore(slug, opts = {}) {
  const controlRoot = await resolveControlRoot(opts);
  const dir = path.join(featureDir(controlRoot, slug), 'explore');
  const entries = await listDir(dir);
  const files = entries
    .filter((name) => /\.(html|md)$/i.test(name))
    .sort((a, b) => a.localeCompare(b));
  const out = [];
  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(dir, file), 'utf8');
      const ext = path.extname(file).toLowerCase();
      const format = ext === '.html' ? 'html' : 'md';
      const name = file.slice(0, file.length - ext.length);
      out.push({ name, format, content });
    } catch (err) {
      if (err && err.code === 'ENOENT') continue;
      throw err;
    }
  }
  return out;
}

/**
 * Load wireframe HTML files.
 *
 * @param {string} slug
 * @param {{ controlRoot?: string }} [opts]
 * @returns {Promise<Array<{ id: string, label: string, html: string }>>}
 */
export async function loadWireframes(slug, opts = {}) {
  const controlRoot = await resolveControlRoot(opts);
  const dir = path.join(featureDir(controlRoot, slug), 'layout', 'wireframes');
  const entries = await listDir(dir);
  const files = entries
    .filter((name) => name.toLowerCase().endsWith('.html'))
    .sort((a, b) => a.localeCompare(b));
  const out = [];
  for (const file of files) {
    try {
      const html = await fs.readFile(path.join(dir, file), 'utf8');
      const id = file.replace(/\.html$/i, '');
      const label = id.replace(/-/g, ' ');
      out.push({ id, label, html });
    } catch (err) {
      if (err && err.code === 'ENOENT') continue;
      throw err;
    }
  }
  return out;
}

/**
 * Load all six documentation bundles in parallel.
 *
 * @param {string} slug
 * @param {{ controlRoot?: string }} [opts]
 * @returns {Promise<{ spec: object, tasks: Array, phases: Array, journal: Array, explore: Array, wireframes: Array }>}
 */
export async function loadAllDocs(slug, opts = {}) {
  const [spec, tasks, phases, journal, explore, wireframes] = await Promise.all([
    loadSpec(slug, opts),
    loadTasks(slug, opts),
    loadPhases(slug, opts),
    loadJournal(slug, opts),
    loadExplore(slug, opts),
    loadWireframes(slug, opts),
  ]);
  return { spec, tasks, phases, journal, explore, wireframes };
}

// Exported for tests
export const __test__ = { journalLabel, compareByLeadingNumber, leadingNumber };
