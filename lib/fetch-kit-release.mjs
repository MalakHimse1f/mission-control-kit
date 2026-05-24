/**
 * Fetch Mission Control kit from GitHub Releases into project cache.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

export function parseGitHubRepo(repo) {
  const parts = String(repo || '').split('/').filter(Boolean);
  if (parts.length !== 2) {
    throw new Error(`Invalid GitHub repo: ${repo}`);
  }
  return { owner: parts[0], name: parts[1] };
}

export function releaseApiUrl(repo, version = 'latest') {
  const { owner, name } = parseGitHubRepo(repo);
  if (version === 'latest') {
    return `https://api.github.com/repos/${owner}/${name}/releases/latest`;
  }
  const tag = version.startsWith('v') ? version : `v${version}`;
  return `https://api.github.com/repos/${owner}/${name}/releases/tags/${tag}`;
}

export function pickReleaseAsset(release, assetPattern = 'mission-control-kit') {
  const assets = release?.assets ?? [];
  const re = new RegExp(assetPattern, 'i');
  return (
    assets.find((a) => re.test(a.name) && /\.(tar\.gz|tgz|zip)$/i.test(a.name)) ??
    assets.find((a) => /\.(tar\.gz|tgz|zip)$/i.test(a.name))
  );
}

export async function downloadFile(url, dest, fetchFn = fetch) {
  const res = await fetchFn(url, {
    headers: { Accept: 'application/octet-stream', 'User-Agent': 'mission-control-kit' },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`Download failed ${res.status}: ${url}`);
  }
  await pipeline(res.body, createWriteStream(dest));
}

export function extractArchive(archivePath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (/\.zip$/i.test(archivePath)) {
    if (process.platform === 'win32') {
      execSync(
        `powershell -NoProfile -Command "Expand-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force"`,
        { stdio: 'inherit' },
      );
    } else {
      execSync(`unzip -o "${archivePath}" -d "${destDir}"`, { stdio: 'inherit' });
    }
    return;
  }
  execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });
}

export function findKitRootInExtracted(extractDir) {
  const queue = [extractDir];
  while (queue.length) {
    const dir = queue.shift();
    if (fs.existsSync(path.join(dir, 'kit-manifest.json'))) return dir;
    for (const name of fs.readdirSync(dir)) {
      const candidate = path.join(dir, name);
      try {
        if (fs.statSync(candidate).isDirectory()) queue.push(candidate);
      } catch {
        /* skip */
      }
    }
  }
  throw new Error(`No kit-manifest.json found under ${extractDir}`);
}

export async function fetchGitHubReleaseKit({
  projectRoot,
  repo,
  version = 'latest',
  assetPattern,
  cacheRoot,
  fetchFn = fetch,
}) {
  const apiUrl = releaseApiUrl(repo, version);
  const res = await fetchFn(apiUrl, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'mission-control-kit' },
  });
  if (!res.ok) {
    throw new Error(`GitHub release lookup failed ${res.status}: ${apiUrl}`);
  }
  const release = await res.json();
  const asset = pickReleaseAsset(release, assetPattern);
  if (!asset) {
    throw new Error(`No release asset matching ${assetPattern ?? 'archive'} on ${release.tag_name}`);
  }

  const tag = String(release.tag_name).replace(/^v/, '');
  const cacheDir = path.join(cacheRoot ?? path.join(projectRoot, 'docs/superpowers/control/.mc/cache/releases'), tag);
  fs.mkdirSync(cacheDir, { recursive: true });

  const archivePath = path.join(cacheDir, asset.name);
  if (!fs.existsSync(archivePath)) {
    await downloadFile(asset.browser_download_url, archivePath, fetchFn);
  }

  const extractDir = path.join(cacheDir, 'extracted');
  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(extractDir, { recursive: true });
  extractArchive(archivePath, extractDir);

  const kitRoot = findKitRootInExtracted(extractDir);
  return {
    kitRoot,
    version: tag,
    tag: release.tag_name,
    cacheDir,
    assetName: asset.name,
  };
}
