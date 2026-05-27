import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderUserGuideDisclosure } from '../control/scripts/dashboard-guide.mjs';

describe('dashboard user guide', () => {
  it('renders disclosure with v4 commands and workflows', () => {
    const html = renderUserGuideDisclosure();
    assert.ok(html.includes('class="guide panel"'));
    assert.ok(html.includes('How to use Mission Control'));
    assert.ok(html.includes('/mc-start'));
    assert.ok(html.includes('/mc-init'));
    assert.ok(html.includes('/mc-feature'));
    assert.ok(html.includes('Start a new project'));
    assert.ok(html.includes('Initialize an existing project'));
    assert.ok(html.includes('Build a feature'));
    assert.ok(html.includes('prd-generator'));
    assert.ok(html.includes('/mc-upgrade'));
    assert.ok(html.includes('dashboard-server'));
    assert.ok(html.includes('Orchestrator controls'));
  });
});
