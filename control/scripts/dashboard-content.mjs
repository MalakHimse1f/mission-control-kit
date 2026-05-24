import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { escapeHtml } from "./dashboard-helpers.mjs";
import {
  RESEARCH_HTML_ARTIFACTS,
  resolveResearchArtifactHtml,
  resolveExploreDocHtml,
  prepareHtmlForDashboardEmbed,
} from "../lib/research-layout.mjs";

const PIPELINE_LABELS = {
  braindump: "Braindump",
  explore: "Explore",
  clarify: "Clarify",
  prd: "PRD",
  mock: "Mock",
  plan: "Plan",
  build: "Build",
  validate: "Validate",
  done: "Complete",
};

export function readTextFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

export function nextJournalSeq(journalDir) {
  if (!existsSync(journalDir)) return 1;
  const nums = readdirSync(journalDir)
    .filter((f) => /^\d{3}-/.test(f))
    .map((f) => parseInt(f.slice(0, 3), 10))
    .filter((n) => !Number.isNaN(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

export function collectJournalEntries(control, base, slug) {
  const journalDir = join(control, base, slug, "journal");
  if (!existsSync(journalDir)) return [];
  return readdirSync(journalDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .sort()
    .map((file) => {
      const content = readTextFile(join(journalDir, file)) ?? "";
      return { file, label: file.replace(/^\d+-/, "").replace(/\.md$/, ""), content };
    });
}

export function collectExploreDocs(control, base, slug) {
  const exploreDir = join(control, base, slug, "explore");
  if (!existsSync(exploreDir)) return [];
  const names = new Set();
  for (const f of readdirSync(exploreDir)) {
    if (f.startsWith("_")) continue;
    if (/\.(html|md)$/i.test(f)) names.add(f.replace(/\.(html|md)$/i, ""));
  }
  const out = [];
  for (const name of [...names].sort()) {
    const doc = resolveExploreDocHtml(control, exploreDir, name);
    if (doc) out.push(doc);
  }
  return out;
}

export function collectSkillFindings(control, base, slug) {
  const itemRoot = join(control, base, slug);
  const out = [];
  for (const meta of RESEARCH_HTML_ARTIFACTS) {
    const resolved = resolveResearchArtifactHtml(control, itemRoot, meta);
    if (resolved) out.push(resolved);
  }
  return out;
}

export function collectPhaseDocs(control, base, slug) {
  const phasesDir = join(control, base, slug, "phases");
  if (!existsSync(phasesDir)) return [];
  return readdirSync(phasesDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("README"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((file) => ({
      file,
      label: file.replace(/\.md$/, ""),
      content: readTextFile(join(phasesDir, file)) ?? "",
    }));
}

export function collectEmbeddedWireframes(control, base, slug) {
  const wireDir = join(control, base, slug, "layout", "wireframes");
  if (!existsSync(wireDir)) return [];
  const out = [];
  for (const file of readdirSync(wireDir)) {
    if (!/\.html?$/i.test(file)) continue;
    const id = file.replace(/\.html?$/i, "");
    const raw = readTextFile(join(wireDir, file)) ?? "";
    out.push({ id, label: id, html: prepareHtmlForDashboardEmbed(raw, control) });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function mimeForExt(file) {
  const lower = file.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

export function collectEmbeddedScreenshots(control, base, slug, tasks) {
  const artBase = join(control, base, slug, "artifacts");
  if (!existsSync(artBase)) return [];
  const taskTitles = new Map((tasks ?? []).map((t) => [t.id, t.title ?? ""]));
  const out = [];
  function walk(dir, relParts) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = [...relParts, name];
      if (/\.(png|jpe?g|webp|gif)$/i.test(name)) {
        const buf = readFileSync(full);
        const taskId = rel.length >= 2 ? rel[rel.length - 2] : rel[0];
        out.push({
          taskId,
          taskTitle: taskTitles.get(taskId) ?? "",
          label: name,
          dataUrl: `data:${mimeForExt(name)};base64,${buf.toString("base64")}`,
        });
      } else if (!name.includes(".")) {
        try {
          walk(full, rel);
        } catch {
          /* not a dir */
        }
      }
    }
  }
  walk(artBase, []);
  return out.sort((a, b) => a.taskId.localeCompare(b.taskId));
}

export function buildStepTimeline(steps, pipelineStage) {
  if (!steps?.length) {
    return [{ id: pipelineStage ?? "braindump", label: PIPELINE_LABELS[pipelineStage] ?? pipelineStage, status: "in-progress" }];
  }
  return steps.map((s) => ({
    id: s.id,
    label: s.label ?? PIPELINE_LABELS[s.id] ?? s.id,
    status: s.status ?? "pending",
    journalFile: s.journalFile ?? null,
    completedAt: s.completedAt ?? null,
  }));
}

export function docBlock(content, title) {
  if (!content?.trim()) return "";
  const t = title ? `<h5 class="doc-title">${escapeHtml(title)}</h5>` : "";
  return `<div class="doc-wrap">${t}<pre class="doc-block">${escapeHtml(content)}</pre></div>`;
}

export function iframeSrcdoc(html, title) {
  const safe = escapeHtml(html);
  return `<figure class="wireframe-card"><iframe srcdoc="${safe}" title="${escapeHtml(title)}" loading="lazy"></iframe><figcaption>${escapeHtml(title)}</figcaption></figure>`;
}

export { PIPELINE_LABELS };
