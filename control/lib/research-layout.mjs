import fs from 'node:fs';
import path from 'node:path';

/** Primary HTML research artifacts — vendor skill outputs. */
export const RESEARCH_HTML_ARTIFACTS = [
  { file: 'research.html', label: 'UX research', source: 'design-research', mdFallback: 'research.md' },
  { file: 'ux-strategy.html', label: 'UX strategy', source: 'ux-strategy', mdFallback: 'ux-strategy.md' },
  { file: 'interaction.html', label: 'Interaction design', source: 'interaction-design', mdFallback: 'interaction.md' },
];

const PRIMITIVE_DIR = 'layout/primitives';
const CSS_REL = 'layout/wireframe.css';

export function readWireframeCss(controlRoot) {
  return fs.readFileSync(path.join(controlRoot, CSS_REL), 'utf8');
}

export function loadPrimitive(controlRoot, primitiveId) {
  const file = path.join(controlRoot, PRIMITIVE_DIR, `${primitiveId}.html`);
  if (!fs.existsSync(file)) {
    throw new Error(`Unknown layout primitive: ${primitiveId}`);
  }
  return fs.readFileSync(file, 'utf8').replace(/<!--.*?-->\s*/g, '').trim();
}

function sectionWrap(title, inner, label) {
  const labelHtml = label ? `<span class="wf-label">${escapeHtml(label)}</span>` : '';
  const titleHtml = title ? `<h3 style="margin:0 0 12px;font-size:1rem">${escapeHtml(title)}</h3>` : '';
  return `<section class="wf-region" style="margin-bottom:16px">${labelHtml}${titleHtml}<div class="wf-region-body">${inner}</div></section>`;
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function cardSection({ title, body, label = 'Finding' }) {
  const inner = `<div class="wf-card"><strong>${escapeHtml(title)}</strong><p style="margin-top:8px;color:#555">${escapeHtml(body)}</p></div>`;
  return sectionWrap(null, inner, label);
}

export function listSection({ title, items = [], label = 'List' }) {
  const rows = items
    .map((item, i) => {
      const border = i < items.length - 1 ? 'border-bottom:1px solid #ccc' : '';
      return `<div style="padding:10px 12px;${border}">${escapeHtml(item)}</div>`;
    })
    .join('');
  const inner = `<div class="wf-list wf-card" style="padding:0">${rows}</div>`;
  return sectionWrap(title, inner, label);
}

export function tableSection({ title, headers = [], rows = [], label = 'Table' }) {
  const head = headers
    .map((h) => `<th style="border:1px solid #666;padding:8px;text-align:left">${escapeHtml(h)}</th>`)
    .join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td style="border:1px solid #666;padding:8px">${escapeHtml(cell)}</td>`).join('')}</tr>`,
    )
    .join('');
  const inner = `<table class="wf-table" style="width:100%;border-collapse:collapse;border:1px solid #666"><tr style="background:#eee">${head}</tr>${body}</table>`;
  return sectionWrap(title, inner, label);
}

export function gridSection({ title, cards = [], label = 'Grid' }) {
  const cells = cards
    .map((c) => `<div class="wf-card wf-slot"><strong>${escapeHtml(c.title)}</strong><p style="margin-top:6px;color:#555">${escapeHtml(c.body)}</p></div>`)
    .join('');
  const inner = `<div class="wf-grid-3">${cells}</div>`;
  return sectionWrap(title, inner, label);
}

export function heroSection({ title, subtitle }) {
  return `<section class="wf-hero"><span class="wf-label">Research</span><h1 style="margin-top:16px">${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</section>`;
}

export function buildResearchPage({ title, subtitle, sections = [], css }) {
  const stylesheet = css ?? '';
  const body = sections.join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${stylesheet}</style>
</head>
<body>
<div class="wf-page wf-desktop">
  ${body.includes('wf-hero') ? '' : heroSection({ title, subtitle })}
  <div style="padding:24px">
    ${body}
  </div>
</div>
</body>
</html>`;
}

/** Convert legacy markdown research files into primitive-based HTML. */
export function markdownToResearchHtml(markdown, { title = 'Research' } = {}) {
  const sections = [];
  const chunks = String(markdown).split(/^##\s+/m);
  const preamble = chunks.shift()?.trim();
  if (preamble) {
    const lines = preamble.replace(/^#\s+/, '').trim();
    if (lines) sections.push(cardSection({ title: 'Overview', body: lines, label: 'Summary' }));
  }
  for (const chunk of chunks) {
    const nl = chunk.indexOf('\n');
    const heading = nl >= 0 ? chunk.slice(0, nl).trim() : chunk.trim();
    const body = nl >= 0 ? chunk.slice(nl + 1).trim() : '';
    if (heading) sections.push(cardSection({ title: heading, body: body || '—', label: 'Section' }));
  }
  if (!sections.length) {
    sections.push(cardSection({ title, body: String(markdown).trim() || '—', label: 'Finding' }));
  }
  const css = ''; // filled by prepareHtmlForDashboardEmbed / buildResearchPage callers
  return buildResearchPage({ title, sections, css });
}

export function inlineWireframeCss(html, css) {
  if (/<style[\s>]/i.test(html)) {
    return html.replace(/<style[^>]*>[\s\S]*?<\/style>/i, `<style>${css}</style>`);
  }
  return html.replace(/<head[^>]*>/i, (m) => `${m}\n  <style>${css}</style>`);
}

export function prepareHtmlForDashboardEmbed(html, controlRoot) {
  const css = readWireframeCss(controlRoot);
  let doc = String(html).replace(/<link[^>]+wireframe\.css[^>]*>/gi, '');
  if (/<style[\s>][\s\S]*?<\/style>/i.test(doc)) {
    doc = doc.replace(/<style[^>]*>[\s\S]*?<\/style>/i, `<style>${css}</style>`);
  } else {
    doc = inlineWireframeCss(doc, css);
  }
  return doc;
}

export function resolveResearchArtifactHtml(controlRoot, itemRoot, meta) {
  const htmlPath = path.join(itemRoot, meta.file);
  const mdPath = path.join(itemRoot, meta.mdFallback);

  if (fs.existsSync(htmlPath)) {
    const raw = fs.readFileSync(htmlPath, 'utf8');
    return {
      file: meta.file,
      label: meta.label,
      source: meta.source,
      format: 'html',
      html: prepareHtmlForDashboardEmbed(raw, controlRoot),
    };
  }

  if (fs.existsSync(mdPath)) {
    const md = fs.readFileSync(mdPath, 'utf8');
    const built = markdownToResearchHtml(md, { title: meta.label });
    return {
      file: meta.mdFallback,
      label: meta.label,
      source: meta.source,
      format: 'html',
      html: prepareHtmlForDashboardEmbed(built, controlRoot),
    };
  }

  return null;
}

export function resolveExploreDocHtml(controlRoot, exploreDir, file) {
  const base = file.replace(/\.(html|md)$/i, '');
  const htmlPath = path.join(exploreDir, `${base}.html`);
  const mdPath = path.join(exploreDir, `${base}.md`);

  if (fs.existsSync(htmlPath)) {
    const raw = fs.readFileSync(htmlPath, 'utf8');
    return {
      file: `${base}.html`,
      label: base,
      format: 'html',
      html: prepareHtmlForDashboardEmbed(raw, controlRoot),
    };
  }

  if (fs.existsSync(mdPath)) {
    const md = fs.readFileSync(mdPath, 'utf8');
    const built = markdownToResearchHtml(md, { title: `Explore — ${base}` });
    return {
      file: `${base}.md`,
      label: base,
      format: 'html',
      html: prepareHtmlForDashboardEmbed(built, controlRoot),
    };
  }

  return null;
}

/** List HTML research artifacts on disk for a feature slug. */
export function listResearchHtmlArtifacts(controlRoot, slug) {
  const itemRoot = path.join(controlRoot, 'features', slug);
  const out = [];
  for (const meta of RESEARCH_HTML_ARTIFACTS) {
    const htmlPath = path.join(itemRoot, meta.file);
    if (fs.existsSync(htmlPath)) {
      out.push({
        label: meta.label,
        file: meta.file,
        path: `features/${slug}/${meta.file}`,
        dashboardSection: 'Skill findings',
      });
    }
  }
  const exploreDir = path.join(itemRoot, 'explore');
  if (fs.existsSync(exploreDir)) {
    for (const f of fs.readdirSync(exploreDir).filter((x) => x.endsWith('.html') && !x.startsWith('_')).sort()) {
      out.push({
        label: f.replace(/\.html$/i, ''),
        file: f,
        path: `features/${slug}/explore/${f}`,
        dashboardSection: 'Exploration findings',
      });
    }
  }
  return out;
}

/**
 * Chat message the orchestrator posts after research HTML is written.
 * Agents must present files to the user and explain how to view them.
 */
export function formatResearchPresentationMessage({
  slug,
  artifacts = [],
  controlRootPrefix = 'docs/superpowers/control/',
  summaryBullets = [],
}) {
  if (!artifacts.length) return '';

  const prefix = controlRootPrefix.endsWith('/') ? controlRootPrefix : `${controlRootPrefix}/`;
  const fileLines = artifacts.map(
    (a) => `- **${a.label}** — \`${prefix}${a.path}\` (dashboard → **${a.dashboardSection}**)`,
  );

  const summaryBlock =
    summaryBullets.length > 0
      ? ['', '**Highlights**', ...summaryBullets.map((b) => `- ${b}`), '']
      : [''];

  return [
    `Research layouts for **${slug}** are ready:`,
    '',
    ...fileLines,
    ...summaryBlock,
    '**How to view**',
    '',
    '1. **Dashboard (recommended)** — Regenerate if needed: `node docs/superpowers/control/scripts/generate-dashboard.mjs`. Open the dashboard (`node docs/superpowers/control/scripts/dashboard-server.mjs`, then the URL it prints). Click the feature card → open detail → scroll to **Exploration findings** and **Skill findings** — each page renders as a live layout preview.',
    '',
    '2. **Browser (local file)** — Open any `.html` path above directly in your browser from the project repo. Paths are relative to `docs/superpowers/control/`. CSS loads via the linked `layout/wireframe.css`.',
    '',
    'Review these layouts before approving the next pipeline stage. When `decisionReview` is `review-first`, use AskQuestion after the user has had a chance to view them.',
  ].join('\n');
}
