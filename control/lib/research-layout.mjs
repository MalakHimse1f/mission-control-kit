import fs from 'node:fs';
import path from 'node:path';

/** Primary HTML research artifacts — vendor skill outputs. */
export const RESEARCH_HTML_ARTIFACTS = [
  { file: 'research.html', label: 'UX research', source: 'design-research', mdFallback: 'research.md' },
  { file: 'ux-strategy.html', label: 'UX strategy', source: 'ux-strategy', mdFallback: 'ux-strategy.md' },
  { file: 'interaction.html', label: 'Interaction design', source: 'interaction-design', mdFallback: 'interaction.md' },
];

// Pages are now self-contained (inline <style>). Embed as-is.
export function prepareHtmlForDashboardEmbed(html /*, control */) {
  return html ?? '';
}

/** Private: convert legacy markdown research files into a self-contained HTML page. */
function markdownToResearchHtml(markdown, { title = 'Research' } = {}) {
  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const sections = [];
  const chunks = String(markdown).split(/^##\s+/m);
  const preamble = chunks.shift()?.trim();
  if (preamble) {
    const lines = preamble.replace(/^#\s+/, '').trim();
    if (lines) {
      sections.push(
        `<section style="margin-bottom:16px"><span style="font-size:.75rem;font-weight:600;text-transform:uppercase;color:#666">Summary</span><div style="background:#fff;border:1px solid #ddd;border-radius:4px;padding:16px;margin-top:8px"><p>${esc(lines)}</p></div></section>`,
      );
    }
  }
  for (const chunk of chunks) {
    const nl = chunk.indexOf('\n');
    const heading = nl >= 0 ? chunk.slice(0, nl).trim() : chunk.trim();
    const body = nl >= 0 ? chunk.slice(nl + 1).trim() : '';
    if (heading) {
      sections.push(
        `<section style="margin-bottom:16px"><span style="font-size:.75rem;font-weight:600;text-transform:uppercase;color:#666">Section</span><div style="background:#fff;border:1px solid #ddd;border-radius:4px;padding:16px;margin-top:8px"><strong>${esc(heading)}</strong><p style="margin-top:8px;color:#555">${esc(body || '—')}</p></div></section>`,
      );
    }
  }
  if (!sections.length) {
    sections.push(
      `<section style="margin-bottom:16px"><span style="font-size:.75rem;font-weight:600;text-transform:uppercase;color:#666">Finding</span><div style="background:#fff;border:1px solid #ddd;border-radius:4px;padding:16px;margin-top:8px"><p>${esc(String(markdown).trim() || '—')}</p></div></section>`,
    );
  }

  const body = sections.join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #f5f5f5; }
    .page { max-width: 900px; margin: 0 auto; padding: 24px; }
    .hero { background: #1a1a2e; color: #fff; padding: 24px; margin-bottom: 24px; border-radius: 4px; }
    .hero h1 { margin: 0; font-size: 1.5rem; }
  </style>
</head>
<body>
<div class="page">
  <div class="hero"><h1>${esc(title)}</h1></div>
  ${body}
</div>
</body>
</html>`;
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
