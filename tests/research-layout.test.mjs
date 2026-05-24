import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  RESEARCH_HTML_ARTIFACTS,
  loadPrimitive,
  readWireframeCss,
  cardSection,
  listSection,
  tableSection,
  heroSection,
  buildResearchPage,
  markdownToResearchHtml,
  prepareHtmlForDashboardEmbed,
  resolveResearchArtifactHtml,
} from '../control/lib/research-layout.mjs';
import { collectSkillFindings, collectExploreDocs } from '../control/scripts/dashboard-content.mjs';
import { collectItemRow } from '../control/scripts/dashboard-data.mjs';
import { buildDashboardHtml } from '../control/scripts/dashboard-template.mjs';

const controlRoot = path.join(process.cwd(), 'control');

function setupTmpControl(tmp) {
  fs.mkdirSync(path.join(tmp, 'layout'), { recursive: true });
  fs.copyFileSync(
    path.join(controlRoot, 'layout/wireframe.css'),
    path.join(tmp, 'layout/wireframe.css'),
  );
}

describe('research-layout primitives', () => {
  it('loads desktop-card primitive from layout library', () => {
    const html = loadPrimitive(controlRoot, 'desktop-card');
    assert.match(html, /wf-card/);
    assert.match(html, /Card title/);
  });

  it('reads wireframe.css from control layout', () => {
    const css = readWireframeCss(controlRoot);
    assert.match(css, /\.wf-card/);
    assert.match(css, /\.wf-page/);
  });

  it('builds card, list, table, and hero sections', () => {
    assert.match(cardSection({ title: 'Persona', body: 'Admin user' }), /Persona/);
    assert.match(listSection({ title: 'Steps', items: ['A', 'B'] }), /wf-list/);
    assert.match(tableSection({ title: 'Compare', headers: ['A', 'B'], rows: [['1', '2']] }), /wf-table/);
    assert.match(heroSection({ title: 'Research', subtitle: 'Findings' }), /wf-hero/);
  });
});

describe('buildResearchPage', () => {
  it('produces a full HTML document using layout primitives', () => {
    const html = buildResearchPage({
      title: 'UX Research',
      subtitle: 'Feature alpha',
      css: readWireframeCss(controlRoot),
      sections: [
        heroSection({ title: 'UX Research', subtitle: 'Feature alpha' }),
        cardSection({ title: 'Summary', body: 'Key insight here.' }),
        listSection({ title: 'Personas', items: ['Admin', 'End user'] }),
      ],
    });
    assert.match(html, /<!DOCTYPE html>/i);
    assert.match(html, /<style>[\s\S]*\.wf-card/);
    assert.match(html, /Key insight here/);
    assert.match(html, /Admin/);
    assert.match(html, /wf-page/);
  });

  it('inlines wireframe CSS for dashboard iframe srcdoc', () => {
    const html = buildResearchPage({ title: 'T', sections: [cardSection({ title: 'X', body: 'Y' })] });
    const embedded = prepareHtmlForDashboardEmbed(html, controlRoot);
    assert.match(embedded, /<style>[\s\S]*\.wf-card/);
    assert.doesNotMatch(embedded, /href=["'].*wireframe\.css/);
  });
});

describe('markdownToResearchHtml fallback', () => {
  it('converts markdown headings into card sections', () => {
    const html = markdownToResearchHtml('# Research\n\n## Personas\nAdmin and user.\n\n## Flows\nCheckout path.', {
      title: 'Research',
    });
    assert.match(html, /Personas/);
    assert.match(html, /wf-card/);
    assert.match(html, /Checkout path/);
  });
});

describe('resolveResearchArtifactHtml', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-research-artifact-'));
    setupTmpControl(tmp);
    fs.mkdirSync(path.join(tmp, 'features', 'demo'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('prefers .html artifact over .md fallback', () => {
    const itemRoot = path.join(tmp, 'features', 'demo');
    fs.writeFileSync(path.join(itemRoot, 'research.html'), buildResearchPage({
      title: 'HTML research',
      sections: [cardSection({ title: 'Done', body: 'From HTML file.' })],
    }));
    fs.writeFileSync(path.join(itemRoot, 'research.md'), '# Old\nShould not use.');
    const meta = RESEARCH_HTML_ARTIFACTS.find((a) => a.file === 'research.html');
    const resolved = resolveResearchArtifactHtml(tmp, itemRoot, meta);
    assert.match(resolved.html, /From HTML file/);
    assert.equal(resolved.format, 'html');
    assert.equal(resolved.file, 'research.html');
  });

  it('converts legacy .md to HTML when .html missing', () => {
    const itemRoot = path.join(tmp, 'features', 'demo');
    fs.writeFileSync(path.join(itemRoot, 'research.md'), '## Personas\nLegacy markdown.');
    const meta = RESEARCH_HTML_ARTIFACTS.find((a) => a.file === 'research.html');
    const resolved = resolveResearchArtifactHtml(tmp, itemRoot, meta);
    assert.match(resolved.html, /Legacy markdown/);
    assert.equal(resolved.format, 'html');
    assert.equal(resolved.file, 'research.md');
  });
});

describe('collectSkillFindings HTML', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-skill-html-'));
    setupTmpControl(tmp);
    const slugDir = path.join(tmp, 'features', 'demo');
    fs.mkdirSync(slugDir, { recursive: true });
    fs.writeFileSync(
      path.join(slugDir, 'research.html'),
      buildResearchPage({
        title: 'Research',
        sections: [cardSection({ title: 'Insight', body: 'HTML skill output.' })],
      }),
    );
    fs.writeFileSync(path.join(slugDir, 'ux-strategy.html'), buildResearchPage({
      title: 'Strategy',
      sections: [cardSection({ title: 'IA', body: 'Site map.' })],
    }));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('collects HTML skill findings with embedded CSS', () => {
    const findings = collectSkillFindings(tmp, 'features', 'demo');
    assert.equal(findings.length, 2);
    assert.equal(findings[0].format, 'html');
    assert.match(findings[0].html, /HTML skill output/);
    assert.match(findings[0].html, /<style>/);
    assert.equal(findings[0].label, 'UX research');
  });
});

describe('collectExploreDocs HTML', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-explore-html-'));
    setupTmpControl(tmp);
    const exploreDir = path.join(tmp, 'features', 'demo', 'explore');
    fs.mkdirSync(exploreDir, { recursive: true });
    fs.writeFileSync(
      path.join(exploreDir, 'web-app.html'),
      buildResearchPage({
        title: 'Explore web-app',
        sections: [listSection({ title: 'Structure', items: ['src/', 'api/'] })],
      }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('collects explore HTML pages for dashboard embed', () => {
    const docs = collectExploreDocs(tmp, 'features', 'demo');
    assert.equal(docs.length, 1);
    assert.equal(docs[0].format, 'html');
    assert.match(docs[0].html, /src\//);
    assert.match(docs[0].label, /web-app/);
  });
});

describe('dashboard research iframe rendering', () => {
  it('embeds skill findings HTML in MC_ITEMS for iframe display', () => {
    const pageHtml = prepareHtmlForDashboardEmbed(
      buildResearchPage({
        title: 'Research',
        sections: [cardSection({ title: 'Finding', body: 'Visible in iframe.' })],
      }),
      controlRoot,
    );
    const html = buildDashboardHtml({
      generatedAt: new Date().toISOString(),
      handoff: '',
      stack: { techStackStatus: 'established', summary: '—', projectMode: '—', layoutTargets: [] },
      global: {},
      rows: [{
        id: 'demo',
        workstream: 'feature',
        type: 'Feature',
        stage: 'Research',
        stageKey: 'research',
        pipelineStage: 'research',
        specStatus: 'draft',
        layoutStatus: '—',
        targetCodebases: [],
        stepTimeline: [],
        progress: { done: 0, total: 0, pct: 0 },
        lastUpdated: null,
        lastUpdatedDisplay: '—',
        currentTaskId: '—',
        currentTaskTitle: '',
        workingTaskId: null,
        workingTaskTitle: '',
        hasWorkingTask: false,
        branch: '—',
        order: null,
        inProgress: true,
        isBuilding: false,
        nextCommand: '/mc',
        pickupPrompt: 'pickup',
        tasks: [],
        braindump: null,
        spec: null,
        layoutDoc: null,
        exploreDocs: [],
        skillFindings: [{
          file: 'research.html',
          label: 'UX research',
          source: 'design-research',
          format: 'html',
          html: pageHtml,
        }],
        phaseDocs: [],
        journalEntries: [],
        wireframes: [],
        screenshots: [],
      }],
      defaultSort: 'lastUpdated',
      kitVersion: null,
      controls: null,
    });

    assert.match(html, /renderResearchPages/);
    assert.match(html, /research-card/);
    const start = html.indexOf('window.MC_ITEMS = ');
    const end = html.indexOf('</script>', start);
    const items = JSON.parse(html.slice(start, end).replace(/^window\.MC_ITEMS = /, '').replace(/;window\.MC_DEFAULT_SORT.*$/, ''));
    assert.equal(items[0].skillFindings[0].format, 'html');
    assert.match(items[0].skillFindings[0].html, /Visible in iframe/);
  });
});

describe('collectItemRow research HTML integration', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-row-research-html-'));
    setupTmpControl(tmp);
    const slugDir = path.join(tmp, 'features', 'demo');
    fs.mkdirSync(slugDir, { recursive: true });
    fs.writeFileSync(
      path.join(slugDir, 'status.json'),
      JSON.stringify({ pipelineStage: 'research', specStatus: 'draft', tasks: [] }),
    );
    fs.writeFileSync(
      path.join(slugDir, 'interaction.html'),
      buildResearchPage({
        title: 'Interaction',
        sections: [cardSection({ title: 'Flow', body: 'Checkout states.' })],
      }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('attaches HTML skill findings to feature row', () => {
    const row = collectItemRow(tmp, 'feature', 'demo', {}, -1);
    assert.equal(row.skillFindings.length, 1);
    assert.equal(row.skillFindings[0].format, 'html');
    assert.match(row.skillFindings[0].html, /Checkout states/);
  });
});
