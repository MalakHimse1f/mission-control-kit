#!/usr/bin/env node
/**
 * v5 CLI: build a per-decision visual HTML fragment.
 *
 * Wraps `buildVisualFragment` from `lib/v5/decision-visual-builder.mjs` so
 * subagents can shell out (`node lib/v5/cli/build-decision.mjs <slug> <id>`)
 * instead of authoring HTML by hand.
 *
 * Usage:
 *   node lib/v5/cli/build-decision.mjs <slug> <decision-id> [--control-root <path>]
 *
 * Behavior:
 *   - Resolves controlRoot via --control-root flag, or by walking up from
 *     process.cwd() looking for `control/v5/`. `controlRoot` is the project
 *     root — the directory CONTAINING `control/v5/`.
 *   - Reads {controlRoot}/control/v5/features/{slug}/decisions.json via readDecisions.
 *   - Searches phases.ux/ui/architecture for a decision whose `id` matches.
 *   - Optionally reads a sidecar file at
 *     {controlRoot}/control/v5/features/{slug}/decisions/{decision-id}.visual.json
 *     which carries per-option `preset` / `diagram` / `raw` entries (see
 *     `lib/v5/diagram-primitives.mjs` and `lib/v5/decision-visual-builder.mjs`).
 *     If absent, the builder falls back to legacy rotation-by-index.
 *   - Calls buildVisualFragment(decision, { optionVisuals }).
 *   - Writes the fragment to
 *     {controlRoot}/control/v5/features/{slug}/decisions/{decision-id}.html
 *     atomically (tmp + rename).
 *   - On success: prints the written path to stdout, exits 0.
 *   - On error: prints a message to stderr, exits 1.
 *
 * stdlib only. No external dependencies.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readDecisions } from '../decisions.mjs';
import { buildVisualFragment } from '../decision-visual-builder.mjs';

const PHASE_KEYS = ['ux', 'ui', 'architecture'];

/**
 * Walk up from a starting directory looking for the project root — the
 * directory whose child is `control/v5/`. Returns the project root (NOT
 * `control/v5/` itself), or null if not found.
 */
async function findNearestProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 64; i++) {
    const candidate = path.join(dir, 'control', 'v5');
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return dir;
    } catch {
      // not here, keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Locate a decision by id across all three phase arrays.
 * Returns { decision, availableIds } — availableIds is always populated so
 * callers can show "available ids" in error messages.
 */
function findDecision(data, decisionId) {
  const availableIds = [];
  let found = null;
  const phases = (data && data.phases) || {};
  for (const phase of PHASE_KEYS) {
    const decisions = (phases[phase] && Array.isArray(phases[phase].decisions))
      ? phases[phase].decisions
      : [];
    for (const decision of decisions) {
      if (decision && typeof decision.id === 'string') {
        availableIds.push(decision.id);
        if (decision.id === decisionId) found = decision;
      }
    }
  }
  return { decision: found, availableIds };
}

/**
 * Resolve a controlRoot path. If `controlRoot` is provided, it is resolved
 * against `cwd`. Otherwise, walks up from `cwd` looking for the project
 * root (parent of `control/v5/`). Throws if not found.
 */
async function resolveControlRoot({ controlRoot, cwd }) {
  const startDir = cwd || process.cwd();
  if (controlRoot) {
    return path.isAbsolute(controlRoot)
      ? controlRoot
      : path.resolve(startDir, controlRoot);
  }
  const found = await findNearestProjectRoot(startDir);
  if (!found) {
    throw new Error(
      `Could not locate project root (parent of control/v5/) by walking up from ${startDir}. ` +
        `Pass --control-root explicitly.`,
    );
  }
  return found;
}

/**
 * Programmatic API mirror of the CLI. Returns { path, fragment }.
 *
 * @param {object} args
 * @param {string} args.slug
 * @param {string} args.decisionId
 * @param {string} [args.controlRoot]
 * @param {string} [args.cwd] - override cwd for control-root resolution (tests)
 */
export async function buildDecisionFragment({ slug, decisionId, controlRoot, cwd } = {}) {
  if (!slug || typeof slug !== 'string') {
    throw new Error('buildDecisionFragment: slug must be a non-empty string');
  }
  if (!decisionId || typeof decisionId !== 'string') {
    throw new Error('buildDecisionFragment: decisionId must be a non-empty string');
  }

  const resolvedControlRoot = await resolveControlRoot({ controlRoot, cwd });

  // Verify decisions.json actually exists — readDecisions returns a default
  // empty structure on ENOENT, but a missing slug should be a hard error here.
  const decisionsPath = path.join(
    resolvedControlRoot,
    'control',
    'v5',
    'features',
    slug,
    'decisions.json',
  );
  try {
    await fs.access(decisionsPath);
  } catch {
    throw new Error(
      `buildDecisionFragment: decisions.json not found for slug "${slug}" ` +
        `(expected at ${decisionsPath}).`,
    );
  }

  const data = await readDecisions(slug, { controlRoot: resolvedControlRoot });
  if (!data || !data.phases || typeof data.phases !== 'object') {
    throw new Error(
      `buildDecisionFragment: decisions.json for slug "${slug}" has no phases.`,
    );
  }

  const { decision, availableIds } = findDecision(data, decisionId);
  if (!decision) {
    const idList = availableIds.length ? availableIds.join(', ') : '(none)';
    throw new Error(
      `buildDecisionFragment: decision id "${decisionId}" not found in ` +
        `slug "${slug}". Available ids: ${idList}.`,
    );
  }

  const outDir = path.join(
    resolvedControlRoot,
    'control',
    'v5',
    'features',
    slug,
    'decisions',
  );

  // Optional sidecar: decisions/{decision-id}.visual.json. Loaded best-effort
  // — missing file is fine (legacy rotation kicks in), malformed file is a
  // hard error so the agent notices.
  const sidecarPath = path.join(outDir, `${decisionId}.visual.json`);
  let optionVisuals = {};
  try {
    const raw = await fs.readFile(sidecarPath, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `buildDecisionFragment: sidecar ${sidecarPath} is not valid JSON: ${err.message}`,
      );
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(
        `buildDecisionFragment: sidecar ${sidecarPath} must be an object, got ${typeof parsed}`,
      );
    }
    if (parsed.id && parsed.id !== decisionId) {
      throw new Error(
        `buildDecisionFragment: sidecar ${sidecarPath} has id "${parsed.id}" but expected "${decisionId}".`,
      );
    }
    if (parsed.options && typeof parsed.options === 'object') {
      optionVisuals = parsed.options;
    }
  } catch (err) {
    if (!err || err.code !== 'ENOENT') throw err;
    // No sidecar — fine, fall back to legacy rotation in buildVisualFragment.
  }

  const fragment = buildVisualFragment(decision, { optionVisuals });

  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${decisionId}.html`);
  const tmpPath = `${outPath}.tmp`;
  // Ensure the file ends with a newline for consistency with other on-disk artifacts.
  const body = fragment.endsWith('\n') ? fragment : `${fragment}\n`;
  await fs.writeFile(tmpPath, body, 'utf8');
  await fs.rename(tmpPath, outPath);

  return { path: outPath, fragment: body };
}

/**
 * Parse argv (the slice after `node script.mjs`). Returns
 * { slug, decisionId, controlRoot } or throws on bad input.
 */
export function parseArgs(argv) {
  const positional = [];
  let controlRoot;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--control-root') {
      controlRoot = argv[i + 1];
      if (!controlRoot) {
        throw new Error('--control-root requires a value');
      }
      i++;
    } else if (arg.startsWith('--control-root=')) {
      controlRoot = arg.slice('--control-root='.length);
      if (!controlRoot) {
        throw new Error('--control-root requires a value');
      }
    } else if (arg === '--help' || arg === '-h') {
      throw new Error('__HELP__');
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length < 2) {
    throw new Error(
      'Usage: node lib/v5/cli/build-decision.mjs <slug> <decision-id> [--control-root <path>]',
    );
  }
  const [slug, decisionId] = positional;
  return { slug, decisionId, controlRoot };
}

const USAGE =
  'Usage: node lib/v5/cli/build-decision.mjs <slug> <decision-id> [--control-root <path>]';

/** CLI entrypoint. Thin wrapper around buildDecisionFragment. */
export async function main(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (err && err.message === '__HELP__') {
      process.stdout.write(USAGE + '\n');
      return 0;
    }
    process.stderr.write(`${err.message}\n${USAGE}\n`);
    return 1;
  }
  try {
    const result = await buildDecisionFragment(parsed);
    process.stdout.write(result.path + '\n');
    return 0;
  } catch (err) {
    process.stderr.write(`${(err && err.message) || err}\n`);
    return 1;
  }
}

// Only invoke main() when run as a script (not when imported by tests).
const isMain = (() => {
  try {
    return process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
  } catch {
    return false;
  }
})();

if (isMain) {
  main().then((code) => {
    process.exit(code);
  });
}
