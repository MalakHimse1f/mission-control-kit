/**
 * v5 dashboard auto-launch helper.
 *
 * `openDashboard({ slug, anchor, controlRoot })` does three things:
 *   1. Ensures the v5 dashboard server is running via
 *      `lib/v5/launch-server.mjs#ensureRunning`. `controlRoot` is the
 *      project root (directory containing `control/v5/`).
 *   2. Builds the target URL (homepage, feature page, or feature#anchor).
 *   3. Spawns the OS browser-open command (`open` / `xdg-open` / `start`).
 *
 * The browser process is NOT awaited — we resolve as soon as the spawn
 * has been issued. Errors from the spawn (e.g., command not found)
 * surface via the exec callback if a caller cares to inspect them.
 *
 * Test seam: pass `__deps: { ensureRunning, exec, platform }` to inject
 * mocked dependencies. Tests use this so they never spawn a real browser.
 *
 * Stdlib only.
 */

import { exec as nodeExec } from 'node:child_process';

import { ensureRunning as realEnsureRunning } from './launch-server.mjs';
import {
  buildTargetUrl,
  getOpenCommand,
} from './auto-launch-helpers.mjs';

/**
 * @typedef {object} OpenDashboardResult
 * @property {string} url               The URL that was opened.
 * @property {number} port              The port the server is listening on.
 * @property {boolean} alreadyRunning   True if the server was already up.
 */

/**
 * @param {{
 *   slug?: string,
 *   anchor?: string,
 *   controlRoot: string,
 *   __deps?: {
 *     ensureRunning?: typeof realEnsureRunning,
 *     exec?: typeof nodeExec,
 *     platform?: string,
 *   },
 * }} opts
 * @returns {Promise<OpenDashboardResult>}
 */
export async function openDashboard(opts = {}) {
  if (!opts.controlRoot) {
    throw new Error('openDashboard: opts.controlRoot is required');
  }

  const deps = opts.__deps || {};
  const ensureRunning = deps.ensureRunning || realEnsureRunning;
  const exec = deps.exec || nodeExec;
  const platform = deps.platform || process.platform;

  // 1. Ensure server is running. Errors propagate to caller.
  const {
    port,
    url: baseUrl,
    alreadyRunning,
  } = await ensureRunning({ controlRoot: opts.controlRoot });

  // 2. Build target URL.
  const targetUrl = buildTargetUrl(baseUrl, {
    slug: opts.slug,
    anchor: opts.anchor,
  });

  // 3. Resolve OS open command. Throws on unsupported platforms before
  // we attempt anything else — the orchestrator can catch and report.
  const openCmd = getOpenCommand(platform);

  // Fire-and-forget: spawn the open command but don't await it. The
  // browser process is long-lived; we only care that the spawn succeeded.
  // Errors are surfaced via the callback (logged best-effort) but do not
  // block the returned promise.
  exec(`${openCmd} ${quoteUrlForShell(targetUrl)}`, (err) => {
    if (err) {
      // Best-effort: surface to stderr but do not throw, since the caller
      // has already received the resolved URL. The orchestrator can also
      // print the URL to chat so the user can click it manually.
      // eslint-disable-next-line no-console
      console.error(`openDashboard: failed to spawn '${openCmd}': ${err.message}`);
    }
  });

  return { url: targetUrl, port, alreadyRunning };
}

/**
 * Wrap a URL so the shell treats it as a single argument. URLs already
 * survive most shells, but `#` can be a comment in some configurations
 * and `&` would background the process — so we double-quote and escape
 * any embedded double quotes.
 *
 * @param {string} url
 * @returns {string}
 */
function quoteUrlForShell(url) {
  return `"${String(url).replace(/"/g, '\\"')}"`;
}
