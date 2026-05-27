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
 *   - Walks all known layouts (v5.3 kit-nested → v5.2 root → v4 legacy)
 *     and infers which one has a v5 control plane. Writes the stamp at
 *     the matching layout's canonical .mc/install.json path.
 *   - Idempotent: if a stamp already exists at any layout, no change.
 *   - `projectRoot` is passed by the v5.2+ migration runner; older
 *     runners only pass `controlRoot`, in which case we derive
 *     `projectRoot` defensively (two dirs up from the v4-canonical
 *     control root).
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

/**
 * Probe all known install layouts and return the one whose v5 control
 * plane is present on disk. Returns null if no v5 install is found.
 */
function detectLayout(projectRoot, controlRoot) {
  const kitFolder = 'mission-control-kit';
  const candidates = [
    {
      kind: 'kit-nested',
      controlRoot: path.join(projectRoot, kitFolder, 'control'),
      stampPath: path.join(projectRoot, kitFolder, '.mc', 'install.json'),
    },
    {
      kind: 'root',
      controlRoot: path.join(projectRoot, 'control'),
      stampPath: path.join(projectRoot, '.mc', 'install.json'),
    },
    {
      kind: 'legacy-v4',
      controlRoot,
      stampPath: path.join(controlRoot, '.mc', 'install.json'),
    },
  ];
  return candidates;
}

export async function up({ controlRoot, projectRoot, log } = {}) {
  const logFn = typeof log === 'function' ? log : noop;
  if (!controlRoot) {
    throw new Error('5.1.1-install-stamp-backfill: controlRoot is required');
  }

  // v5.2+: migrations receive projectRoot directly. For older runners
  // that only pass controlRoot, derive projectRoot the old way (two
  // dirs up from the v4-canonical control root).
  const resolvedProjectRoot = projectRoot || path.resolve(controlRoot, '..', '..');

  const candidates = detectLayout(resolvedProjectRoot, controlRoot);

  // 1. Skip entirely if ANY layout already has a stamp.
  for (const c of candidates) {
    if (await pathExists(c.stampPath)) {
      logFn(`5.1.1: ${c.stampPath} already exists; not touching`);
      return;
    }
  }

  // 2. Pick the first layout whose v5 control plane is present.
  let chosen = null;
  for (const c of candidates) {
    if (await pathExists(path.join(c.controlRoot, 'v5'))) {
      chosen = c;
      break;
    }
  }
  if (!chosen) {
    logFn('5.1.1: no v5 control plane found; skipping stamp backfill');
    return;
  }

  // 3. Infer kit version from state.json (set by 5.0.0-v5-refactor).
  const statePath = path.join(chosen.controlRoot, 'v5', 'state.json');
  const state = await readJsonOrNull(statePath);
  const inferredVersion =
    (state && typeof state.version === 'string' && state.version) || '5.0.0';

  const stamp = {
    kitVersion: inferredVersion,
    schemaVersion: 1,
    layout: chosen.kind,
    backfilledAt: new Date().toISOString(),
    backfilledBy: KIT_VERSION_AT_THIS_MIGRATION,
    kitRepo: 'MalakHimse1f/mission-control-kit',
    migrationsApplied: ['5.0.0-v5-refactor'],
    note:
      'Backfilled by 5.1.1-install-stamp-backfill so the dashboard "Upgrade kit" ' +
      'button can detect updates against this install.',
  };
  await fs.promises.mkdir(path.dirname(chosen.stampPath), { recursive: true });
  await fs.promises.writeFile(
    chosen.stampPath,
    JSON.stringify(stamp, null, 2) + '\n',
    'utf8',
  );
  logFn(`5.1.1: wrote ${chosen.stampPath} with kitVersion ${inferredVersion}`);
}
