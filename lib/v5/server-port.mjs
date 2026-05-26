/**
 * v5 dashboard server port resolver and status file helpers.
 *
 * State file path: `{controlRoot}/.mc/v5-dashboard-server.json`
 *   - `.mc/` is ephemeral state per the v5 storage diagram (see
 *     `docs/v5-diagrams/02-data-storage.html`). It does NOT live under
 *     `control/v5/` — it sits alongside `v4`'s `.mc/dashboard-server.json` so
 *     both servers can coexist without clobbering each other.
 *
 * Port range: 9470–9499 (v4 dashboard uses 9470 too; the v5 launcher will
 *   typically end up on a higher port since v4 grabs 9470 first when running.)
 *
 * Stdlib only. No external dependencies.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

export const V5_DEFAULT_PORT = 9470;
export const V5_MAX_PORT = 9499;
export const V5_STATE_FILENAME = 'v5-dashboard-server.json';

/** Walk up from a starting directory looking for `control/`. */
function findNearestControlRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 64; i++) {
    const candidate = path.join(dir, 'control');
    try {
      const stat = fs.statSync(candidate);
      if (stat.isDirectory()) return candidate;
    } catch {
      // not here, keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate control/ by walking up from ${startDir}. ` +
      `Pass {controlRoot} explicitly.`,
  );
}

function resolveControlRoot(opts) {
  if (opts && opts.controlRoot) return path.resolve(opts.controlRoot);
  return findNearestControlRoot(process.cwd());
}

/** Absolute path to the v5 server status file. */
export function statusFilePath(controlRoot) {
  return path.join(controlRoot, '.mc', V5_STATE_FILENAME);
}

/** Check whether a TCP port can be bound on 127.0.0.1. */
function tryListen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => {
      srv.close(() => resolve(true));
    });
    srv.listen(port, host);
  });
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
 * Find a free port in [V5_DEFAULT_PORT, V5_MAX_PORT], write `{port, pid,
 * startedAt}` to the status file, and return that record.
 *
 * @param {{ controlRoot?: string, pid?: number, host?: string }} [opts]
 * @returns {Promise<{ port: number, pid: number, startedAt: string }>}
 */
export async function resolvePort(opts = {}) {
  const controlRoot = resolveControlRoot(opts);
  const host = opts.host || '127.0.0.1';
  const pid = opts.pid || process.pid;

  let chosen = null;
  for (let p = V5_DEFAULT_PORT; p <= V5_MAX_PORT; p++) {
    // eslint-disable-next-line no-await-in-loop
    const free = await tryListen(p, host);
    if (free) {
      chosen = p;
      break;
    }
  }
  if (chosen == null) {
    throw new Error(
      `No free v5 dashboard port in range ${V5_DEFAULT_PORT}–${V5_MAX_PORT}.`,
    );
  }

  const record = {
    port: chosen,
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
