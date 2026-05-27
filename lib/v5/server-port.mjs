/**
 * v5 dashboard server status file helpers.
 *
 * State file path: `{controlRoot}/control/.mc/v5-dashboard-server.json`
 *   where `controlRoot` is the project root (the directory containing
 *   `control/v5/`).
 *   - `.mc/` is ephemeral state per the v5 storage diagram (see
 *     `docs/v5-diagrams/02-data-storage.html`). It lives under `control/`
 *     (NOT under `control/v5/`), alongside `v4`'s `.mc/dashboard-server.json`
 *     so both servers can coexist without clobbering each other.
 *
 * Port range: 9470–9499 (v4 dashboard uses 9470 too; v5 typically ends up on
 *   9471+ because v4 grabs 9470 first when running). The CLI in
 *   `control/scripts/v5/dashboard-server.mjs` binds-then-claims: it iterates
 *   the range calling `server.listen()` directly and only writes the status
 *   file *after* `listen` succeeds, eliminating any probe→bind race window.
 *
 * Stdlib only. No external dependencies.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

export const V5_DEFAULT_PORT = 9470;
export const V5_MAX_PORT = 9499;
export const V5_STATE_FILENAME = 'v5-dashboard-server.json';

/**
 * Walk up from a starting directory looking for the project root — the
 * directory whose child is `control/v5/`. Returns the project root (NOT
 * `control/v5/` itself).
 */
function findNearestProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 64; i++) {
    const candidate = path.join(dir, 'control', 'v5');
    try {
      const stat = fs.statSync(candidate);
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
      `Pass {controlRoot} explicitly.`,
  );
}

function resolveControlRoot(opts) {
  if (opts && opts.controlRoot) return path.resolve(opts.controlRoot);
  return findNearestProjectRoot(process.cwd());
}

/** Absolute path to the v5 server status file. */
export function statusFilePath(controlRoot) {
  return path.join(controlRoot, 'control', '.mc', V5_STATE_FILENAME);
}

/**
 * Synchronously read the status file. Returns the parsed object, or null if the
 * file is missing or unreadable.
 */
export function readServerStatus(opts = {}) {
  const controlRoot = resolveControlRoot(opts);
  const file = statusFilePath(controlRoot);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Remove the status file, ignoring ENOENT. */
export function clearServerStatus(opts = {}) {
  const controlRoot = resolveControlRoot(opts);
  const file = statusFilePath(controlRoot);
  try {
    fs.unlinkSync(file);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

/**
 * Atomically write the status file `{ port, pid, startedAt }`.
 *
 * Internal helper — exported for tests + the server CLI entry.
 */
export function writeServerStatus(controlRoot, payload) {
  const file = statusFilePath(controlRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * Record an already-bound port in the status file. Call this *after* the
 * server's `listen()` has succeeded so the file reflects the real bound port
 * (no TOCTOU window between probe and bind).
 *
 * @param {number} port — the port the server actually bound to.
 * @param {{ controlRoot?: string, pid?: number }} [opts]
 * @returns {{ port: number, pid: number, startedAt: string }}
 */
export function claimPort(port, opts = {}) {
  if (typeof port !== 'number' || !Number.isFinite(port) || port < 0 || port > 65535) {
    throw new Error(`claimPort: invalid port ${port}`);
  }
  const controlRoot = resolveControlRoot(opts);
  const pid = opts.pid || process.pid;
  const record = {
    port,
    pid,
    startedAt: new Date().toISOString(),
  };
  writeServerStatus(controlRoot, record);
  return record;
}

/** Async variant of readServerStatus — used by launch-server.mjs polling. */
export async function readServerStatusAsync(opts = {}) {
  const controlRoot = resolveControlRoot(opts);
  const file = statusFilePath(controlRoot);
  try {
    const raw = await fsp.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err instanceof SyntaxError)) return null;
    throw err;
  }
}
