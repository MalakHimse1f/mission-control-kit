/**
 * v5 install stamp — read/write the .mc/install.json that records which kit
 * version is installed and which migrations have run.
 *
 * Why this file exists (separate from the v4 install stamp in
 * `lib/mc-upgrade.mjs`):
 *
 *   v4 hardcodes the stamp location at
 *     {projectRoot}/docs/superpowers/control/.mc/install.json
 *   because the v4 control plane lives at docs/superpowers/control/.
 *
 *   v5 installs created by the standard installer keep that layout, but
 *   v5 installs created via direct migration call (the path used by
 *   `migrations/5.0.0-v5-refactor.mjs` when invoked against
 *   `{projectRoot}/control/`) end up with the control plane at
 *     {projectRoot}/control/v5/
 *   and never get a stamp written at all. They are invisible to the v4
 *   updater.
 *
 *   This module resolves the stamp at the v5-canonical location
 *     {projectRoot}/.mc/install.json
 *   while also accepting the v4 location as a fallback so the
 *   dashboard "upgrade kit" UI works regardless of how the install was
 *   bootstrapped. If neither exists, `state.json` is consulted for a
 *   best-effort `version` field; if THAT is missing, we report a
 *   synthetic stamp with kitVersion="0.0.0" so the caller can treat the
 *   install as out-of-date.
 *
 * Pure async fs; no network.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Candidate locations for the install stamp, in order of preference:
 *   1. {projectRoot}/.mc/install.json          (v5 project-root layout)
 *   2. {projectRoot}/docs/superpowers/control/.mc/install.json  (v4 layout)
 *   3. {projectRoot}/control/.mc/install.json  (legacy v5 alt — never shipped but accepted defensively)
 */
export function stampCandidates(projectRoot) {
  return [
    path.join(projectRoot, '.mc', 'install.json'),
    path.join(projectRoot, 'docs', 'superpowers', 'control', '.mc', 'install.json'),
    path.join(projectRoot, 'control', '.mc', 'install.json'),
  ];
}

async function readJsonOrNull(p) {
  try {
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readStateJsonVersion(projectRoot) {
  const p = path.join(projectRoot, 'control', 'v5', 'state.json');
  const j = await readJsonOrNull(p);
  if (j && typeof j.version === 'string') return j.version;
  return null;
}

/**
 * Resolve the stamp for a project root. Returns:
 *   { path, stamp, source }
 * where:
 *   - path is the location used (or the v5-canonical path if none exists yet)
 *   - stamp is the parsed JSON object, possibly synthetic
 *   - source is one of "stamp" | "state.json" | "synthetic"
 */
export async function resolveInstallStamp(projectRoot) {
  for (const candidate of stampCandidates(projectRoot)) {
    const stamp = await readJsonOrNull(candidate);
    if (stamp && typeof stamp === 'object' && typeof stamp.kitVersion === 'string') {
      return { path: candidate, stamp, source: 'stamp' };
    }
  }
  const stateVersion = await readStateJsonVersion(projectRoot);
  if (stateVersion) {
    return {
      path: path.join(projectRoot, '.mc', 'install.json'),
      stamp: {
        kitVersion: stateVersion,
        schemaVersion: 1,
        migrationsApplied: [],
        stampedBy: 'state.json-fallback',
      },
      source: 'state.json',
    };
  }
  return {
    path: path.join(projectRoot, '.mc', 'install.json'),
    stamp: {
      kitVersion: '0.0.0',
      schemaVersion: 1,
      migrationsApplied: [],
      stampedBy: 'synthetic',
    },
    source: 'synthetic',
  };
}

/**
 * Write the stamp atomically (tmp + rename). Creates the .mc directory if
 * needed. Returns the absolute path written.
 */
export async function writeInstallStamp(projectRoot, stamp) {
  if (!stamp || typeof stamp !== 'object' || typeof stamp.kitVersion !== 'string') {
    throw new Error('writeInstallStamp: stamp.kitVersion must be a string');
  }
  const stampPath = path.join(projectRoot, '.mc', 'install.json');
  await fs.mkdir(path.dirname(stampPath), { recursive: true });
  const tmp = `${stampPath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(stamp, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, stampPath);
  return stampPath;
}
