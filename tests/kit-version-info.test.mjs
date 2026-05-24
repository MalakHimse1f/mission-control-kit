import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseReleaseTag,
  compareVersions,
  resolveKitVersionInfo,
  releaseApiLatestUrl,
} from '../control/lib/kit-version-info.mjs';

describe('kit-version-info', () => {
  it('parses mc-kit release tags', () => {
    assert.equal(parseReleaseTag('mc-kit-v4.4.0'), '4.4.0');
    assert.equal(parseReleaseTag('v4.3.1'), '4.3.1');
  });

  it('builds GitHub latest release URL', () => {
    assert.equal(
      releaseApiLatestUrl('acme/mission-control-kit'),
      'https://api.github.com/repos/acme/mission-control-kit/releases/latest',
    );
  });

  it('detects GitHub update when remote is newer than installed', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const os = await import('node:os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-kit-ver-'));
    const control = path.join(tmp, 'docs/superpowers/control');
    const kit = path.join(tmp, 'mission-control-kit');
    fs.mkdirSync(path.join(control, '.mc'), { recursive: true });
    fs.mkdirSync(kit, { recursive: true });
    fs.writeFileSync(
      path.join(control, '.mc/install.json'),
      JSON.stringify({ kitVersion: '4.3.1', kitPath: 'mission-control-kit' }),
    );
    fs.writeFileSync(
      path.join(kit, 'kit-manifest.json'),
      JSON.stringify({
        kitVersion: '4.3.1',
        release: { github: 'acme/mission-control-kit' },
      }),
    );

    const mockFetch = async () => ({
      ok: true,
      json: async () => ({ tag_name: 'mc-kit-v4.4.1', html_url: 'https://example.com/r' }),
    });

    const info = await resolveKitVersionInfo(control, { fetchRemote: true, fetchFn: mockFetch });
    assert.equal(info.installed, '4.3.1');
    assert.equal(info.remoteVersion, '4.4.1');
    assert.equal(info.updateAvailable, true);
    assert.equal(info.updateSource, 'github');
    assert.equal(compareVersions(info.installed, info.remoteVersion), -1);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('uses local manifest only when fetchRemote is false', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const os = await import('node:os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-kit-local-'));
    const control = path.join(tmp, 'docs/superpowers/control');
    const kit = path.join(tmp, 'mission-control-kit');
    fs.mkdirSync(path.join(control, '.mc'), { recursive: true });
    fs.mkdirSync(kit, { recursive: true });
    fs.writeFileSync(
      path.join(control, '.mc/install.json'),
      JSON.stringify({ kitVersion: '4.3.1', kitPath: 'mission-control-kit' }),
    );
    fs.writeFileSync(
      path.join(kit, 'kit-manifest.json'),
      JSON.stringify({ kitVersion: '4.4.0', release: { github: 'acme/mc' } }),
    );

    const info = await resolveKitVersionInfo(control, { fetchRemote: false });
    assert.equal(info.updateAvailable, true);
    assert.equal(info.updateSource, 'local');
    assert.equal(info.remoteChecked, false);

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
