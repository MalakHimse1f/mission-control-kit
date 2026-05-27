import fs from 'node:fs';
import path from 'node:path';

export const version = '5.1.1-install-stamp-backfill';

/**
 * v5.1.1 — backfill `.mc/install.json` for v5 installs that don't have one.
 *
 * Why this exists:
 *   Some v5 installs (e.g. those bootstrapped by directly invoking the
 *   5.0.0-v5-refactor migration against `{projectRoot}/control/` instead
 *   of going through the standard installer) never had an install stamp
 *   written. The dashboard's new "Upgrade kit" button reads this stamp
 *   to know what version is installed; without it, the kit-version
 *   check falls back to `state.json` or a synthetic "0.0.0" stamp and
 *   reports every release as a new upgrade.
 *
 * Behavior:
 *   - `controlRoot` here is the canonical v4 path (the migration runner
 *     passes `{projectRoot}/docs/superpowers/control`). The project root
 *     is two directories up from that.
 *   - For project-root layouts (where `{projectRoot}/control/v5/` exists),
 *     the stamp lives at `{projectRoot}/.mc/install.json`. We backfill
 *     it from `state.json`.
 *   - For v4 standard layouts (control plane at the path passed in),
 *     `.mc/install.json` is already managed by the v4 upgrade engine —
 *     this migration leaves it alone.
 *   - Idempotent: if the stamp already exists, no change.
 *
 * The kit-version this migration writes is whatever the install was
 * stamped at on disk — we infer from `state.json.version` (set by
 * 5.0.0-v5-refactor) and from `migrationsApplied` (best-effort).
 */

const KIT_VERSION_AT_THIS_MIGRATION = '5.1.1';

function noop() {}

async function pathExists(p) {
  try {
    await fs.promises.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readJsonOrNull(p) {
  try {
    return JSON.parse(await fs.promises.readFile(p, 'utf8'));
  } catch {
    return null;
  }
}

export async function up({ controlRoot, log } = {}) {
  const logFn = typeof log === 'function' ? log : noop;
  if (!controlRoot) {
    throw new Error('5.1.1-install-stamp-backfill: controlRoot is required');
  }

  // The migration runner ALWAYS passes the v4 controlRoot
  // (`{projectRoot}/docs/superpowers/control`). The actual project root —
  // where the v5 stamp lives — is two directories up.
  const projectRoot = path.resolve(controlRoot, '..', '..');

  // Skip if there isn't actually a v5 install here. Some legacy v4-only
  // projects exist; we don't want to write a v5 stamp into them.
  const v5Root = path.join(projectRoot, 'control', 'v5');
  const altV5Root = path.join(controlRoot, 'v5');
  let v5ControlPlaneRoot = null;
  if (await pathExists(v5Root)) v5ControlPlaneRoot = path.join(projectRoot, 'control');
  else if (await pathExists(altV5Root)) v5ControlPlaneRoot = controlRoot;
  if (!v5ControlPlaneRoot) {
    logFn('5.1.1: no v5 control plane found; skipping stamp backfill');
    return;
  }

  const stampPath = path.join(projectRoot, '.mc', 'install.json');
  if (await pathExists(stampPath)) {
    logFn(`5.1.1: ${stampPath} already exists; not touching`);
    return;
  }

  const statePath = path.join(v5ControlPlaneRoot, 'v5', 'state.json');
  const state = await readJsonOrNull(statePath);
  const inferredVersion =
    (state && typeof state.version === 'string' && state.version) || '5.0.0';

  const stamp = {
    kitVersion: inferredVersion,
    schemaVersion: 1,
    backfilledAt: new Date().toISOString(),
    backfilledBy: KIT_VERSION_AT_THIS_MIGRATION,
    kitRepo: 'MalakHimse1f/mission-control-kit',
    migrationsApplied: ['5.0.0-v5-refactor'],
    note:
      'Backfilled by 5.1.1-install-stamp-backfill so the dashboard "Upgrade kit" ' +
      'button can detect updates against this install.',
  };
  await fs.promises.mkdir(path.dirname(stampPath), { recursive: true });
  await fs.promises.writeFile(stampPath, JSON.stringify(stamp, null, 2) + '\n', 'utf8');
  logFn(`5.1.1: wrote ${stampPath} with kitVersion ${inferredVersion}`);
}
