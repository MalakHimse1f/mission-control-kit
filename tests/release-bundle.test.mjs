import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  shouldExcludeReleasePath,
  listReleaseFiles,
  RELEASE_EXCLUDE_PREFIXES,
} from '../scripts/build-release-tarball.mjs';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('release bundle excludes', () => {
  it('excludes vendor clones and cache', () => {
    assert.equal(shouldExcludeReleasePath('vendor/.cache-prd-generator/foo'), true);
    assert.equal(shouldExcludeReleasePath('vendor/startup-skill/x'), true);
    assert.equal(shouldExcludeReleasePath('vendor/manifest.json'), false);
  });

  it('includes core kit files', () => {
    const files = listReleaseFiles(kitRoot);
    assert.ok(files.includes('kit-manifest.json'));
    assert.ok(files.includes('scripts/mc-upgrade.mjs'));
    assert.ok(files.includes('control/ROUTER.md'));
    assert.ok(!files.some((f) => f.startsWith('vendor/startup-skill/')));
  });

  it('builds tarball with kit-manifest at root', () => {
    execSync('node scripts/build-release-tarball.mjs', { cwd: kitRoot, stdio: 'pipe' });
    const manifest = JSON.parse(fs.readFileSync(path.join(kitRoot, 'kit-manifest.json'), 'utf8'));
    const archive = path.join(kitRoot, 'dist', `mission-control-kit-v4-${manifest.kitVersion}.tar.gz`);
    assert.ok(fs.existsSync(archive));

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-release-'));
    execSync(`tar -xzf "${archive}" -C "${tmp}"`, { stdio: 'pipe' });
    const extracted = path.join(tmp, 'mission-control-kit-v4', 'kit-manifest.json');
    assert.ok(fs.existsSync(extracted));
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('RELEASE_EXCLUDE_PREFIXES', () => {
  it('documents expected excludes', () => {
    assert.ok(RELEASE_EXCLUDE_PREFIXES.length >= 5);
  });
});
