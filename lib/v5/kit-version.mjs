/**
 * v5 kit-version detection + upgrade.
 *
 * Source for the dashboard's "update available" banner and the
 * `POST /api/kit-upgrade` endpoint. Pure stdlib (no deps).
 *
 * Three responsibilities:
 *   1. `checkKitVersion({projectRoot, repo?, ref?})` — read the local
 *      install stamp, fetch the published `kit-manifest.json` from
 *      GitHub raw, semver-compare, return a flat object the dashboard
 *      can render directly.
 *   2. `runKitUpgrade({projectRoot, repo?, ref?})` — fetch the kit
 *      tarball, extract it, run any migrations whose semver is
 *      strictly greater than the local kit version, then update the
 *      install stamp. Tolerates installs that don't have a stamp yet
 *      (the resolver falls back to state.json or a synthetic
 *      "0.0.0" stamp; the migration then claims everything in the
 *      manifest as new).
 *   3. Helpers (`compareVersions`, `fetchKitManifest`) exported so the
 *      tests and the dashboard server can call them directly.
 *
 * Layout awareness:
 *   The kit currently has two layouts in the wild —
 *     - v4 standard: control plane at `{projectRoot}/docs/superpowers/control/`
 *     - v5 project-root: control plane at `{projectRoot}/control/`
 *   Migrations take `controlRoot` as input, so we just pick the right
 *   directory (the one whose child is `v5/`) and pass it through.
 *
 * No external dependencies — stdlib only.
 */

import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { resolveInstallStamp, writeInstallStamp } from './install-stamp.mjs';

const DEFAULT_REPO = 'MalakHimse1f/mission-control-kit';
const DEFAULT_REF = 'main';

// ---------------------------------------------------------------------------
// Semver
// ---------------------------------------------------------------------------

/** Parse the leading "MAJOR.MINOR.PATCH" out of a string. Missing → [0,0,0]. */
export function parseSemver(value) {
  const m = String(value || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return [0, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Returns negative / 0 / positive like Array.prototype.sort. */
export function compareVersions(a, b) {
  const va = parseSemver(a);
  const vb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (va[i] !== vb[i]) return va[i] - vb[i];
  }
  return 0;
}

// ---------------------------------------------------------------------------
// HTTP (stdlib only)
// ---------------------------------------------------------------------------

function fetchJson(url, { timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'mission-control-kit-v5',
          Accept: 'application/json, */*;q=0.8',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          fetchJson(res.headers.location, { timeoutMs }).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (err) {
            reject(new Error(`JSON parse: ${err.message}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
  });
}

function fetchToFile(url, destPath, { timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'mission-control-kit-v5', Accept: '*/*' } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          file.close();
          fs.unlink(destPath, () => {});
          fetchToFile(res.headers.location, destPath, { timeoutMs }).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(destPath)));
      },
    );
    req.on('error', (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout downloading ' + url)));
  });
}

/** Fetch and parse the kit's published `kit-manifest.json`. */
export function fetchKitManifest({ repo = DEFAULT_REPO, ref = DEFAULT_REF } = {}) {
  const url = `https://raw.githubusercontent.com/${repo}/${ref}/kit-manifest.json`;
  return fetchJson(url);
}

// ---------------------------------------------------------------------------
// Layout detection
// ---------------------------------------------------------------------------

/**
 * Find the control plane root (the directory whose child is `v5/`) for a
 * given project root. Checks both layouts. Returns null if neither exists.
 */
export async function resolveControlRoot(projectRoot) {
  const candidates = [
    path.join(projectRoot, 'control'),
    path.join(projectRoot, 'docs', 'superpowers', 'control'),
  ];
  for (const c of candidates) {
    try {
      const stat = await fsp.stat(path.join(c, 'v5'));
      if (stat.isDirectory()) return c;
    } catch {
      // try next
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// checkKitVersion
// ---------------------------------------------------------------------------

/**
 * Read local stamp, fetch remote manifest, compare.
 *
 * Resolves with a flat object the dashboard can render directly:
 *   {
 *     ok: true,
 *     local: "5.0.0",
 *     remote: "5.1.1",
 *     repo: "owner/repo",
 *     ref: "main",
 *     stampSource: "stamp" | "state.json" | "synthetic",
 *     updateAvailable: true,
 *     newMigrations: ["5.1.0-...", "5.1.1-..."],
 *   }
 *
 * If remote fetch fails, resolves with `{ ok: false, error, local, ... }`
 * — never throws.
 */
export async function checkKitVersion({
  projectRoot,
  repo = DEFAULT_REPO,
  ref = DEFAULT_REF,
} = {}) {
  if (!projectRoot) throw new Error('checkKitVersion: projectRoot is required');
  const resolved = await resolveInstallStamp(projectRoot);
  const local = resolved.stamp.kitVersion;
  let manifest;
  try {
    manifest = await fetchKitManifest({ repo, ref });
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      local,
      stampSource: resolved.source,
      repo,
      ref,
      updateAvailable: false,
    };
  }
  const remote = manifest.kitVersion;
  if (!remote) {
    return {
      ok: false,
      error: 'remote manifest missing kitVersion',
      local,
      stampSource: resolved.source,
      repo,
      ref,
      updateAvailable: false,
    };
  }
  const localMigrations = new Set(resolved.stamp.migrationsApplied || []);
  const newMigrations = (manifest.migrations || []).filter(
    (m) => !localMigrations.has(m) && compareVersions(m, local) > 0,
  );
  const updateAvailable = compareVersions(local, remote) < 0;
  return {
    ok: true,
    local,
    remote,
    repo,
    ref,
    stampSource: resolved.source,
    updateAvailable,
    newMigrations,
  };
}

// ---------------------------------------------------------------------------
// runKitUpgrade
// ---------------------------------------------------------------------------

/**
 * Fetch the kit at `ref` from GitHub codeload (no auth, no release-asset
 * dependency), extract under tmpRoot, and return the absolute path to the
 * extracted kit root (the directory containing kit-manifest.json). Tries
 * the branch URL first, then the tag URL.
 */
async function fetchKitToTmp(repo, ref, tmpRoot) {
  const tarPath = path.join(tmpRoot, 'kit.tar.gz');
  const branchUrl = `https://codeload.github.com/${repo}/tar.gz/refs/heads/${ref}`;
  const tagUrl = `https://codeload.github.com/${repo}/tar.gz/refs/tags/${ref}`;
  try {
    await fetchToFile(branchUrl, tarPath);
  } catch {
    await fetchToFile(tagUrl, tarPath);
  }
  execFileSync('tar', ['-xzf', tarPath, '-C', tmpRoot]);
  await fsp.unlink(tarPath).catch(() => {});
  const entries = await fsp.readdir(tmpRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(tmpRoot, entry.name);
    if (fs.existsSync(path.join(candidate, 'kit-manifest.json'))) return candidate;
  }
  throw new Error(`extracted tarball has no kit-manifest.json under ${tmpRoot}`);
}

/**
 * Run all migrations newer than the local kit version against the
 * project's control plane, then update the install stamp.
 *
 * Resolves with `{ ok: true, fromVersion, toVersion, migrations: [...] }`.
 * Throws on any failure (caller wraps in HTTP 500).
 */
export async function runKitUpgrade({
  projectRoot,
  repo = DEFAULT_REPO,
  ref = DEFAULT_REF,
} = {}) {
  if (!projectRoot) throw new Error('runKitUpgrade: projectRoot is required');
  const resolved = await resolveInstallStamp(projectRoot);
  const local = resolved.stamp.kitVersion;
  const localMigrations = new Set(resolved.stamp.migrationsApplied || []);

  const controlRoot = await resolveControlRoot(projectRoot);
  if (!controlRoot) {
    throw new Error(
      `runKitUpgrade: could not find a v5 control plane under ${projectRoot}`,
    );
  }

  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'mc-kit-upgrade-'));
  let kitRoot;
  try {
    kitRoot = await fetchKitToTmp(repo, ref, tmpRoot);
  } catch (err) {
    await fsp.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
    throw new Error(`failed to fetch kit: ${err.message}`);
  }

  let toVersion;
  let ranMigrations = [];
  try {
    const manifest = JSON.parse(
      await fsp.readFile(path.join(kitRoot, 'kit-manifest.json'), 'utf8'),
    );
    toVersion = manifest.kitVersion;
    if (!toVersion) throw new Error('fetched kit-manifest has no kitVersion');

    const migrationFiles = (await fsp.readdir(path.join(kitRoot, 'migrations')))
      .filter((f) => f.endsWith('.mjs'))
      .sort();
    for (const file of migrationFiles) {
      const moduleUrl = pathToFileURL(path.join(kitRoot, 'migrations', file)).href;
      const mod = await import(moduleUrl);
      const migrationVersion = mod.version || file.replace('.mjs', '');
      if (localMigrations.has(migrationVersion)) continue;
      if (compareVersions(migrationVersion, local) <= 0) continue;
      if (typeof mod.up !== 'function') continue;
      await mod.up({
        controlRoot,
        kitRoot,
        log: () => {}, // silence by default; caller can wrap if it wants
      });
      ranMigrations.push(migrationVersion);
    }
  } finally {
    await fsp.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  }

  const newStamp = {
    ...resolved.stamp,
    kitVersion: toVersion,
    schemaVersion: resolved.stamp.schemaVersion || 1,
    upgradedAt: new Date().toISOString(),
    migrationsApplied: Array.from(
      new Set([...(resolved.stamp.migrationsApplied || []), ...ranMigrations]),
    ),
  };
  await writeInstallStamp(projectRoot, newStamp);

  return {
    ok: true,
    fromVersion: local,
    toVersion,
    migrations: ranMigrations,
  };
}
