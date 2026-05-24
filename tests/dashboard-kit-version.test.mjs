import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderKitVersionStrip, KIT_VERSION_CLIENT_JS } from '../control/scripts/dashboard-kit-version.mjs';

describe('dashboard kit version strip', () => {
  it('renders upgrade button when update is available', () => {
    const html = renderKitVersionStrip(
      {
        installed: '4.5.0',
        remoteVersion: '4.5.1',
        updateAvailable: true,
        updateSource: 'github',
      },
      (s) => s,
    );
    assert.match(html, /id="kit-upgrade-btn"/);
    assert.match(html, /Upgrade kit/);
    assert.match(html, /update-available/);
  });

  it('hides upgrade button when kit is up to date', () => {
    const html = renderKitVersionStrip(
      {
        installed: '4.5.1',
        remoteVersion: '4.5.1',
        remoteChecked: true,
        updateAvailable: false,
      },
      (s) => s,
    );
    assert.match(html, /kit-upgrade-btn" hidden/);
    assert.doesNotMatch(html, /update-available/);
  });

  it('client JS wires upgrade fetch endpoint', () => {
    assert.ok(KIT_VERSION_CLIENT_JS.includes('/api/kit-upgrade'));
    assert.ok(KIT_VERSION_CLIENT_JS.includes('kit-upgrade-btn'));
  });
});
