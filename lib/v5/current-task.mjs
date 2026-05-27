/**
 * v5 current-task helper.
 *
 * Focused replacement for the common "read all 7 tasks from status.json just
 * to figure out what to do next" pattern. The orchestrator and build-phase
 * subagents almost always only care about a single task — either the one
 * already in flight or the next one queued up.
 *
 * File layout: `{controlRoot}/control/v5/features/{slug}/status.json`
 * where `controlRoot` is the project root (the directory containing
 * `control/v5/`). This matches the convention in `lib/v5/decisions.mjs`.
 *
 * Design notes:
 * - Both helpers tolerate missing status.json, missing/empty tasks[], and
 *   "everything done" states by returning null rather than throwing.
 * - `controlRoot` defaults to the nearest project root, walking up from
 *   process.cwd() — same convention as decisions.mjs.
 * - No external dependencies — stdlib only.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Walk up from a starting directory looking for the project root — the
 * directory whose child is `control/v5/`. Mirrors the helper in decisions.mjs.
 */
async function findNearestProjectRoot(startDir) {
  let dir = path.resolve(startDir);
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
      `Pass {controlRoot} explicitly to currentTask/nextPendingTask.`,
  );
}

async function resolveControlRoot(opts) {
  if (opts && opts.controlRoot) return opts.controlRoot;
  return findNearestProjectRoot(process.cwd());
}

function statusPath(controlRoot, slug) {
  return path.join(controlRoot, 'control', 'v5', 'features', slug, 'status.json');
}

/**
 * Read the tasks[] array from a feature's status.json. Returns [] on any
 * read/parse failure or missing field so callers can treat all "nothing here"
 * states uniformly.
 */
async function readTasks(slug, opts) {
  if (!slug || typeof slug !== 'string') {
    throw new Error('current-task: slug must be a non-empty string');
  }
  const controlRoot = await resolveControlRoot(opts);
  const filePath = statusPath(controlRoot, slug);
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupt status.json — treat as "nothing to do" rather than throwing.
    return [];
  }
  if (!parsed || !Array.isArray(parsed.tasks)) return [];
  return parsed.tasks;
}

/**
 * Return the task the caller should work on right now:
 * 1. First task with `status === 'in-progress'`, if any.
 * 2. Else the first task with `status === 'pending'`.
 * 3. Else null (everything is done or there is nothing to do).
 *
 * @param {string} slug
 * @param {{ controlRoot?: string }} [opts]
 * @returns {Promise<object|null>}
 */
export async function currentTask(slug, opts = {}) {
  const tasks = await readTasks(slug, opts);
  if (tasks.length === 0) return null;
  const inFlight = tasks.find((t) => t && t.status === 'in-progress');
  if (inFlight) return inFlight;
  const pending = tasks.find((t) => t && t.status === 'pending');
  return pending || null;
}

/**
 * Return the first pending task only, ignoring in-progress entries. Useful
 * when callers want to see what is *queued* (e.g., when deciding whether to
 * fan out additional subagents while another is running).
 *
 * @param {string} slug
 * @param {{ controlRoot?: string }} [opts]
 * @returns {Promise<object|null>}
 */
export async function nextPendingTask(slug, opts = {}) {
  const tasks = await readTasks(slug, opts);
  if (tasks.length === 0) return null;
  const pending = tasks.find((t) => t && t.status === 'pending');
  return pending || null;
}
