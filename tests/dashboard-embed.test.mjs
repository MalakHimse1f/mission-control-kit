import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { safeJsonForScriptEmbed } from '../control/scripts/dashboard-helpers.mjs';
import { buildDashboardHtml } from '../control/scripts/dashboard-template.mjs';

describe('safeJsonForScriptEmbed', () => {
  it('escapes < so </script> in strings cannot break HTML', () => {
    const payload = [{ id: 'x', wireframes: [{ html: '<script></script>' }] }];
    const embedded = safeJsonForScriptEmbed(payload);
    assert.ok(!embedded.includes('</script'), 'raw </script> must not appear in embed');
    assert.deepEqual(JSON.parse(embedded), payload);
  });

  it('escapes <!-- in embedded markdown', () => {
    const payload = [{ spec: '<!-- comment -->' }];
    const embedded = safeJsonForScriptEmbed(payload);
    assert.ok(!embedded.includes('<!--'), 'raw HTML comment open must not appear');
    assert.deepEqual(JSON.parse(embedded), payload);
  });
});

describe('buildDashboardHtml MC_ITEMS embed', () => {
  it('does not emit raw </script> inside MC_ITEMS script block', () => {
    const html = buildDashboardHtml({
      generatedAt: new Date().toISOString(),
      handoff: '',
      stack: { techStackStatus: 'established', summary: '—', projectMode: '—', layoutTargets: [] },
      global: {},
      rows: [
        {
          id: 'demo',
          workstream: 'feature',
          type: 'Feature',
          stage: 'Building',
          stageKey: 'build',
          pipelineStage: 'build',
          specStatus: 'approved',
          layoutStatus: 'approved',
          targetCodebases: [],
          stepTimeline: [],
          progress: { done: 0, total: 1, pct: 0 },
          lastUpdated: null,
          lastUpdatedDisplay: '—',
          currentTaskId: '1.1',
          currentTaskTitle: 'Task',
          workingTaskId: null,
          workingTaskTitle: '',
          hasWorkingTask: false,
          branch: '—',
          order: 1,
          inProgress: true,
          isBuilding: true,
          nextCommand: '/mc',
          pickupPrompt: 'pickup',
          tasks: [{ id: '1.1', title: 'T', status: 'backlog' }],
          braindump: null,
          spec: null,
          layoutDoc: null,
          exploreDocs: [],
          phaseDocs: [],
          journalEntries: [],
          wireframes: [{ id: 'w', label: 'w', html: '<html><script>alert(1)</script></html>' }],
          screenshots: [],
        },
      ],
      defaultSort: 'lastUpdated',
      kitVersion: null,
      controls: null,
    });

    const start = html.indexOf('window.MC_ITEMS = ');
    const end = html.indexOf('</script>', start);
    const scriptBody = html.slice(start, end);
    assert.ok(!scriptBody.includes('</script'), 'MC_ITEMS block must not contain literal </script>');
    const json = scriptBody.replace(/^window\.MC_ITEMS = /, '').replace(/;window\.MC_DEFAULT_SORT.*$/, '');
    const items = JSON.parse(json);
    assert.equal(items[0].wireframes[0].html.includes('<script>'), true);
  });
});
