/**
 * Launch helper for the v5 dashboard server.
 *
 * `ensureRunning(opts)` is the public entry point:
 *   - Reads `{controlRoot}/control/.mc/v5-dashboard-server.json` where
 *     `controlRoot` is the project root (directory containing `control/v5/`).
 *   - If present and PID is alive, returns `{ port, url, alreadyRunning: true }`.
 *   - Otherwise spawns `control/scripts/v5/dashboard-server.mjs` as a detached
 *     background process and polls the status file (≤2 s old startedAt)
 *     until it appears or 5 s elapse.
 *
 * Stdlib only.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  readServerStatusAsync,
  clearServerStatus,
} from './server-port.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// lib/v5/launch-server.mjs → repo root is two levels up.
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_SERVER_SCRIPT = path.join(
  REPO_ROOT,
  'control',
  'scripts',
  'v5',
  'dashboard-server.mjs',
);

function isPidAlive(pid) {
  if (!pid || typeof pid !== 'number') return false;
  try {
    // signal 0 = existence check, throws ESRCH if dead, EPERM if no permission
    // (still alive, just not ours).
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err && err.code === 'EPERM') return true;
    return false;
  }
}

function isFreshStartedAt(startedAt, maxAgeMs = 2000) {
  if (typeof startedAt !== 'string') return false;
  const t = Date.parse(startedAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= maxAgeMs;
}

/**
 * Ensure the v5 dashboard server is running.
 *
 * @param {{
 *   controlRoot: string,
 *   serverScript?: string,
 *   spawnFn?: typeof spawn,
 *   timeoutMs?: number,
 *   pollIntervalMs?: number,
 *   freshnessMs?: number,
 * }} opts
 * @returns {Promise<{ port: number, url: string, pid: number, alreadyRunning: boolean }>}
 */
export async function ensureRunning(opts = {}) {
  if (!opts.controlRoot) {
    throw new Error('ensureRunning: opts.controlRoot is required');
  }
  const controlRoot = path.resolve(opts.controlRoot);
  const serverScript = opts.serverScript || DEFAULT_SERVER_SCRIPT;
  const spawnFn = opts.spawnFn || spawn;
  const timeoutMs = opts.timeoutMs ?? 5000;
  const pollIntervalMs = opts.pollIntervalMs ?? 100;
  const freshnessMs = opts.freshnessMs ?? 2000;

  // Check existing.
  const existing = await readServerStatusAsync({ controlRoot });
  if (existing && isPidAlive(existing.pid)) {
    return {
      port: existing.port,
      url: `http://127.0.0.1:${existing.port}`,
      pid: existing.pid,
      alreadyRunning: true,
    };
  }
  if (existing) {
    // Stale status; clear it so we don't confuse the polling.
    try {
      clearServerStatus({ controlRoot });
    } catch {
      // best-effort
    }
  }

  // Spawn detached.
  const beforeSpawn = Date.now();
  const child = spawnFn(process.execPath, [serverScript], {
    cwd: controlRoot,
    detached: true,
    stdio: 'ignore',
  });
  if (typeof child.unref === 'function') child.unref();

  // Poll for a fresh status file.
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    // eslint-disable-next-line no-await-in-loop
    const current = await readServerStatusAsync({ controlRoot });
    if (
      current &&
      isPidAlive(current.pid) &&
      (isFreshStartedAt(current.startedAt, freshnessMs) ||
        Date.parse(current.startedAt) >= beforeSpawn)
    ) {
      return {
        port: current.port,
        url: `http://127.0.0.1:${current.port}`,
        pid: current.pid,
        alreadyRunning: false,
      };
    }
  }
  throw new Error(
    `ensureRunning: v5 dashboard server did not start within ${timeoutMs}ms`,
  );
}
