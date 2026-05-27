/**
 * v5 install stamp — read/write the .mc/install.json that records which kit
 * version is installed and which migrations have run.
 *
 * Layout candidates (probed in priority order via `lib/layout.mjs`):
 *
 *   1. {projectRoot}/{kitFolder}/.mc/install.json          (v5.3+ kit-nested)
 *   2. {projectRoot}/.mc/install.json                       (v5.2.0 root)
 *   3. {projectRoot}/docs/superpowers/control/.mc/install.json  (v4 legacy)
 *
 * For installs that exist on disk, the matching layout's stamp wins. For
 * fresh installs (nothing on disk), the kit-nested layout is the default —
 * matching what the v5.3+ installer produces.
 *
 * If no stamp exists anywhere, `control/v5/state.json` is consulted for a
 * best-effort `version` field; if THAT is missing, we report a synthetic
 * stamp with kitVersion="0.0.0" so the caller can treat the install as
 * out-of-date.
 *
 * Pure async fs; no network.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { layoutCandidates, resolveControlRoot } from '../layout.mjs';

/**
 * Candidate stamp paths for a project root, in priority order.
 *
 * @param {string} projectRoot
 * @param {{ kitFolder?: string }} [opts]
 * @returns {string[]}
 */
export function stampCandidates(projectRoot, opts = {}) {
  return layoutCandidates(projectRoot, opts).map((c) => c.installStampPath);
}

async function readJsonOrNull(p) {
  try {
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readStateJsonVersion(projectRoot, opts) {
  const controlRoot = resolveControlRoot(projectRoot, opts);
  const p = path.join(controlRoot, 'v5', 'state.json');
  const j = await readJsonOrNull(p);
  if (j && typeof j.version === 'string') return j.version;
  return null;
}

/**
 * Resolve the stamp for a project root. Returns:
 *   { path, stamp, source }
 * where:
 *   - path is the location used (or the new-install canonical path if
 *     none exists yet)
 *   - stamp is the parsed JSON object, possibly synthetic
 *   - source is one of "stamp" | "state.json" | "synthetic"
 *
 * @param {string} projectRoot
 * @param {{ kitFolder?: string }} [opts]
 */
export async function resolveInstallStamp(projectRoot, opts = {}) {
  const candidates = stampCandidates(projectRoot, opts);
  for (const candidate of candidates) {
    const stamp = await readJsonOrNull(candidate);
    if (stamp && typeof stamp === 'object' && typeof stamp.kitVersion === 'string') {
      return { path: candidate, stamp, source: 'stamp' };
    }
  }
  const stateVersion = await readStateJsonVersion(projectRoot, opts);
  if (stateVersion) {
    return {
      path: candidates[0],
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
    path: candidates[0],
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
 * needed. Writes at whichever layout is currently active for the project
 * (kit-nested by default for fresh installs). Returns the absolute path
 * written.
 *
 * @param {string} projectRoot
 * @param {object} stamp
 * @param {{ kitFolder?: string }} [opts]
 */
export async function writeInstallStamp(projectRoot, stamp, opts = {}) {
  if (!stamp || typeof stamp !== 'object' || typeof stamp.kitVersion !== 'string') {
    throw new Error('writeInstallStamp: stamp.kitVersion must be a string');
  }
  // Use the first candidate (= active or fresh-install layout's stamp path).
  const stampPath = stampCandidates(projectRoot, opts)[0];
  // ...unless an existing stamp lives at a different (legacy) layout — in
  // that case, keep using that location so we don't fragment the install.
  let target = stampPath;
  for (const candidate of stampCandidates(projectRoot, opts)) {
    try {
      await fs.access(candidate);
      target = candidate;
      break;
    } catch {
      // not present, try next
    }
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(stamp, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, target);
  return target;
}
