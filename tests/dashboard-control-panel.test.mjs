import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CONTROL_PANEL_CLIENT_JS } from '../control/scripts/dashboard-control-panel.mjs';

describe('dashboard control panel client JS', () => {
  it('defines esc before renderStatus uses it', () => {
    const escIdx = CONTROL_PANEL_CLIENT_JS.indexOf('function esc(s)');
    const renderIdx = CONTROL_PANEL_CLIENT_JS.indexOf('function renderStatus(payload)');
    assert.ok(escIdx >= 0, 'missing esc helper');
    assert.ok(renderIdx >= 0, 'missing renderStatus');
    assert.ok(escIdx < renderIdx, 'esc must be defined before renderStatus');
  });

  it('enables saves over http even when HTML was generated offline', () => {
    assert.ok(CONTROL_PANEL_CLIENT_JS.includes('enableControlsWhenServed'));
    assert.ok(CONTROL_PANEL_CLIENT_JS.includes('servedByDashboardServer'));
    assert.ok(CONTROL_PANEL_CLIENT_JS.includes('servedByDashboardServer || !saveBtn.disabled'));
  });
});
