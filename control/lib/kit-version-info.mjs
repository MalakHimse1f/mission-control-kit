import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

export function parseVersion(v) {
  return String(v || '0.0.0')
    .replace(/^v/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

export function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  for (let i = 0; i < 3; i += 1) {
    if (va[i] < vb[i]) return -1;
    if (va[i] > vb[i]) return 1;
  }
  return 0;
}

/** mc-kit-v4.4.0 → 4.4.0, v4.4.0 → 4.4.0 */
export function parseReleaseTag(tag) {
  const s = String(tag ?? '').trim();
  const mc = s.match(/^mc-kit-v(.+)$/i);
  if (mc) return mc[1].replace(/^v/, '');
  return s.replace(/^v/, '');
}

export function readKitVersionInfoLocal(controlDir) {
  const stampPath = path.join(controlDir, '.mc/install.json');
  const stamp = fs.existsSync(stampPath) ? JSON.parse(fs.readFileSync(stampPath, 'utf8')) : null;
  const projectRoot = path.join(controlDir, '..', '..', '..');
  const kitFolder = stamp?.kitPath ?? 'mission-control-kit';
  const manifestPath = path.join(projectRoot, kitFolder, 'kit-manifest.json');
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : null;
  const installed = stamp?.kitVersion ?? null;
  const localLatest = manifest?.kitVersion ?? installed;
  const releaseRepo = manifest?.release?.github ?? null;
  return { installed, localLatest, kitFolder, releaseRepo, manifestPath };
}

function readReleaseCache(cachePath) {
  if (!fs.existsSync(cachePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeReleaseCache(cachePath, data) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify(data, null, 2)}\n`);
}

export function releaseApiLatestUrl(repo) {
  const parts = String(repo || '').split('/').filter(Boolean);
  if (parts.length !== 2) {
    throw new Error(`Invalid GitHub repo: ${repo}`);
  }
  return `https://api.github.com/repos/${parts[0]}/${parts[1]}/releases/latest`;
}

export async function fetchRemoteKitVersion({
  repo,
  fetchFn = fetch,
  cachePath,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  forceRefresh = false,
}) {
  if (!forceRefresh && cachePath) {
    const cached = readReleaseCache(cachePath);
    if (cached?.remoteVersion && cached.checkedAt) {
      const age = Date.now() - new Date(cached.checkedAt).getTime();
      if (age >= 0 && age < cacheTtlMs) {
        return { ...cached, fromCache: true };
      }
    }
  }

  const apiUrl = releaseApiLatestUrl(repo);
  const res = await fetchFn(apiUrl, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'mission-control-kit' },
  });
  if (!res.ok) {
    throw new Error(`GitHub release lookup failed ${res.status}`);
  }
  const release = await res.json();
  const remoteVersion = parseReleaseTag(release.tag_name);
  const payload = {
    remoteVersion,
    tag: release.tag_name,
    releaseUrl: release.html_url ?? null,
    checkedAt: new Date().toISOString(),
    fromCache: false,
  };
  if (cachePath) writeReleaseCache(cachePath, payload);
  return payload;
}

export async function resolveKitVersionInfo(controlDir, { fetchRemote = false, fetchFn = fetch, forceRefresh = false } = {}) {
  const local = readKitVersionInfoLocal(controlDir);
  const { installed, localLatest, kitFolder, releaseRepo } = local;

  let remoteVersion = null;
  let remoteTag = null;
  let remoteCheckedAt = null;
  let remoteFromCache = false;
  let remoteError = null;
  let releaseUrl = null;

  if (fetchRemote && releaseRepo) {
    const cachePath = path.join(controlDir, '.mc/cache/latest-release.json');
    try {
      const remote = await fetchRemoteKitVersion({
        repo: releaseRepo,
        fetchFn,
        cachePath,
        forceRefresh,
      });
      remoteVersion = remote.remoteVersion;
      remoteTag = remote.tag;
      remoteCheckedAt = remote.checkedAt;
      remoteFromCache = remote.fromCache ?? false;
      releaseUrl = remote.releaseUrl ?? null;
    } catch (err) {
      remoteError = err.message;
      const cached = readReleaseCache(cachePath);
      if (cached?.remoteVersion) {
        remoteVersion = cached.remoteVersion;
        remoteTag = cached.tag ?? null;
        remoteCheckedAt = cached.checkedAt ?? null;
        remoteFromCache = true;
        releaseUrl = cached.releaseUrl ?? null;
      }
    }
  }

  const candidates = [localLatest, remoteVersion].filter(Boolean);
  let latest = installed;
  for (const v of candidates) {
    if (!latest || compareVersions(latest, v) < 0) latest = v;
  }

  let updateSource = null;
  if (installed && remoteVersion && compareVersions(installed, remoteVersion) < 0) {
    updateSource = 'github';
  } else if (installed && localLatest && compareVersions(installed, localLatest) < 0) {
    updateSource = 'local';
  }

  const updateAvailable = Boolean(updateSource);

  return {
    installed,
    localLatest,
    latest,
    remoteVersion,
    remoteTag,
    remoteCheckedAt,
    remoteFromCache,
    remoteError,
    releaseUrl,
    releaseRepo,
    updateAvailable,
    updateSource,
    kitFolder,
    remoteChecked: Boolean(fetchRemote && releaseRepo),
  };
}
