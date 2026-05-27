/**
 * v5 state.json read/write utilities.
 *
 * File layout: `{controlRoot}/control/v5/state.json` where `controlRoot` is the
 * project root (the directory containing `control/v5/`).
 *
 * Shape: { version, activeFeature, features: [{ slug, stage, currentPhase }], updatedAt }
 *
 * Mirrors lib/v5/decisions.mjs: stdlib-only, async, atomic (tmp + rename),
 * controlRoot defaults to the nearest project root walking up from cwd.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

async function findNearestProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 64; i++) {
    const candidate = path.join(dir, 'control', 'v5');
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return dir;
    } catch {
      // keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate project root (parent of control/v5/) from ${startDir}. ` +
      `Pass {controlRoot} explicitly.`,
  );
}

async function resolveControlRoot(opts) {
  if (opts && opts.controlRoot) return opts.controlRoot;
  return findNearestProjectRoot(process.cwd());
}

function statePath(controlRoot) {
  return path.join(controlRoot, 'control', 'v5', 'state.json');
}

function defaultState() {
  return { version: '5.0.0', activeFeature: null, features: [], updatedAt: new Date().toISOString() };
}

export async function readState(opts = {}) {
  const controlRoot = await resolveControlRoot(opts);
  const filePath = statePath(controlRoot);
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (err) {
    if (err && err.code === 'ENOENT') return defaultState();
    throw err;
  }
}

export async function writeState(state, opts = {}) {
  const controlRoot = await resolveControlRoot(opts);
  const filePath = statePath(controlRoot);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const normalized = {
    ...defaultState(),
    ...(state && typeof state === 'object' ? state : {}),
    updatedAt: new Date().toISOString(),
  };
  if (!Array.isArray(normalized.features)) normalized.features = [];
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, filePath);
  return normalized;
}

export async function upsertFeature(entry, opts = {}) {
  if (!entry || typeof entry.slug !== 'string' || !entry.slug) {
    throw new Error('upsertFeature: entry.slug must be a non-empty string');
  }
  const state = await readState(opts);
  const features = Array.isArray(state.features) ? state.features : [];
  const idx = features.findIndex((f) => f && f.slug === entry.slug);
  if (idx >= 0) features[idx] = { ...features[idx], ...entry };
  else features.push({ ...entry });
  state.features = features;
  return writeState(state, opts);
}

export async function setActiveFeature(slug, opts = {}) {
  const state = await readState(opts);
  state.activeFeature = slug;
  return writeState(state, opts);
}
