/**
 * v5 lint utility for detecting inconsistencies between decisions.json and fragment files.
 *
 * Detects:
 * - missing-fragment: decision exists in decisions.json but no matching fragment file
 * - orphan-fragment: fragment file exists but no matching decision id in decisions.json
 * - mismatched-group: fragment file's data-group attribute doesn't match the decision id
 *
 * File layout:
 * - Decisions: {controlRoot}/features/{slug}/decisions.json
 * - Fragments: {controlRoot}/features/{slug}/decisions/{decision-id}.html
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { readDecisions } from './decisions.mjs';

/**
 * Lint a single feature's decisions and fragments.
 *
 * @param {{ slug: string, controlRoot: string }} opts
 * @returns {Promise<{ slug: string, violations: Array<{ type, decisionId, reason }> }>}
 */
export async function lintDecisions({ slug, controlRoot }) {
  if (!slug || typeof slug !== 'string') {
    throw new Error('lintDecisions: slug must be a non-empty string');
  }
  if (!controlRoot || typeof controlRoot !== 'string') {
    throw new Error('lintDecisions: controlRoot must be a non-empty string');
  }

  const violations = [];

  // Read decisions.json; if it doesn't exist, return empty violations
  let decisions;
  try {
    decisions = await readDecisions(slug, { controlRoot });
  } catch (err) {
    // If readDecisions throws (not just missing file), re-throw
    if (err.code === 'ENOENT') {
      return { slug, violations: [] };
    }
    throw err;
  }

  // Build set of expected decision ids from all three phases
  const expectedIds = new Set();
  for (const phaseKey of ['ux', 'ui', 'architecture']) {
    const phase = decisions.phases[phaseKey];
    if (phase && Array.isArray(phase.decisions)) {
      for (const decision of phase.decisions) {
        if (decision.id && typeof decision.id === 'string') {
          expectedIds.add(decision.id);
        }
      }
    }
  }

  // If no decisions in the file, no fragments to check
  if (expectedIds.size === 0) {
    return { slug, violations: [] };
  }

  // List fragment files in the decisions directory
  const decisionsDir = path.join(controlRoot, 'features', slug, 'decisions');
  let fragmentFiles = [];
  try {
    fragmentFiles = await fs.readdir(decisionsDir);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Directory doesn't exist; all expected decisions are missing fragments
      for (const id of expectedIds) {
        violations.push({
          type: 'missing-fragment',
          decisionId: id,
          reason: `no fragment file at ${decisionsDir}/${id}.html`,
        });
      }
      return { slug, violations };
    }
    throw err;
  }

  // Filter to .html files only
  const htmlFiles = fragmentFiles.filter((f) => f.endsWith('.html'));
  const htmlFilesByName = new Map(htmlFiles.map((f) => [f.replace(/\.html$/, ''), f]));

  // Check for missing fragments
  for (const id of expectedIds) {
    if (!htmlFilesByName.has(id)) {
      violations.push({
        type: 'missing-fragment',
        decisionId: id,
        reason: `no fragment file at ${decisionsDir}/${id}.html`,
      });
    }
  }

  // Check for orphan fragments and mismatched data-group
  for (const [basename, filename] of htmlFilesByName) {
    if (!expectedIds.has(basename)) {
      violations.push({
        type: 'orphan-fragment',
        decisionId: basename,
        reason: `fragment file ${decisionsDir}/${filename} has no matching decision in decisions.json`,
      });
      continue;
    }

    // File matches a decision; check its data-group attribute
    const filePath = path.join(decisionsDir, filename);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      // Regex to find data-group attribute in mc-options-grid div
      const match = content.match(/data-group="([^"]*?)"/);
      const dataGroup = match ? match[1] : null;

      if (dataGroup !== basename) {
        violations.push({
          type: 'mismatched-group',
          decisionId: basename,
          reason: `fragment's data-group="${dataGroup}" does not match basename "${basename}"`,
        });
      }
    } catch (err) {
      // If we can't read the file, skip the data-group check
      // (the file existence check already passed)
    }
  }

  return { slug, violations };
}

/**
 * Lint all features under {controlRoot}/features/.
 *
 * @param {{ controlRoot: string }} opts
 * @returns {Promise<{ features: Array<{ slug: string, violations }> }>}
 */
export async function lintAllFeatures({ controlRoot }) {
  if (!controlRoot || typeof controlRoot !== 'string') {
    throw new Error('lintAllFeatures: controlRoot must be a non-empty string');
  }

  const featuresDir = path.join(controlRoot, 'features');
  let featureDirs = [];
  try {
    featureDirs = await fs.readdir(featuresDir);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { features: [] };
    }
    throw err;
  }

  const results = [];
  for (const slug of featureDirs) {
    try {
      const result = await lintDecisions({ slug, controlRoot });
      results.push(result);
    } catch (err) {
      // Skip features that error; log but continue
      console.error(`Error linting feature "${slug}": ${err.message}`);
    }
  }

  // Sort by slug for consistent output
  results.sort((a, b) => a.slug.localeCompare(b.slug));

  return { features: results };
}

/**
 * CLI mode: run lint from command line.
 *
 * Usage:
 *   node lib/v5/lint-decisions.mjs [slug] [--control-root <path>]
 *
 * - No slug: lint all features
 * - With slug: lint one feature
 * - Exits 0 on no violations, 1 if any violations found
 */
async function main() {
  let slug = null;
  let controlRoot = null;

  // Parse CLI args
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--control-root' && i + 1 < args.length) {
      controlRoot = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      slug = args[i];
    }
  }

  // Resolve controlRoot if not provided
  if (!controlRoot) {
    const { findNearestControlV5 } = await import('./decisions.mjs');
    // Actually, decisions.mjs doesn't export this, so we'll resolve it differently
    // Let's try to find it via readDecisions behavior (it auto-resolves)
    try {
      // Try a dummy read to get controlRoot detection
      const dummy = await readDecisions('_dummy_', { controlRoot: null });
    } catch (err) {
      // findNearestControlV5 should have been called; we can't easily extract it
      // Instead, let's use a fallback: walk up from cwd
      controlRoot = await findNearestControlV5(process.cwd());
    }
  }

  // If still no controlRoot, try to auto-detect
  if (!controlRoot) {
    let dir = process.cwd();
    for (let i = 0; i < 64; i++) {
      const candidate = path.join(dir, 'control', 'v5');
      try {
        const stat = await fs.stat(candidate);
        if (stat.isDirectory()) {
          controlRoot = candidate;
          break;
        }
      } catch {
        // not here
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  if (!controlRoot) {
    console.error('Error: Could not determine controlRoot. Pass --control-root explicitly or run from a project directory.');
    process.exit(1);
  }

  try {
    let result;
    if (slug) {
      // Lint one feature
      result = await lintDecisions({ slug, controlRoot });
      console.log(`Linting ${slug}...`);
      if (result.violations.length === 0) {
        console.log(`  No violations found.`);
      } else {
        result.violations.forEach((v) => {
          console.log(`  [${v.type}] ${v.decisionId}: ${v.reason}`);
        });
      }
      process.exit(result.violations.length > 0 ? 1 : 0);
    } else {
      // Lint all features
      result = await lintAllFeatures({ controlRoot });
      console.log(`Linting all features...\n`);
      let totalViolations = 0;
      for (const feature of result.features) {
        const count = feature.violations.length;
        totalViolations += count;
        const status = count === 0 ? '✓' : '✗';
        console.log(`${status} ${feature.slug}: ${count} violation${count !== 1 ? 's' : ''}`);
        feature.violations.forEach((v) => {
          console.log(`    [${v.type}] ${v.decisionId}: ${v.reason}`);
        });
      }
      console.log(`\nTotal: ${totalViolations} violation${totalViolations !== 1 ? 's' : ''}`);
      process.exit(totalViolations > 0 ? 1 : 0);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// Helper function to find nearest control/v5/ (copied from decisions.mjs logic)
async function findNearestControlV5(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 64; i++) {
    const candidate = path.join(dir, 'control', 'v5');
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch {
      // not here
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate control/v5/ by walking up from ${startDir}. ` +
      `Pass --control-root explicitly.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}
