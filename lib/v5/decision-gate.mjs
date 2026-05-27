/**
 * v5 decision sequencing gates — enforces UX → UI → Architecture → Build.
 *
 * Per §9 of docs/REFACTOR-REQUIREMENTS.md and docs/v5-diagrams/08-decision-sequencing.html.
 *
 * The orchestrator must NOT advance to the next phase until every decision
 * in the current phase is saved to decisions.json and `pending` is empty.
 *
 * Tech-stack features (status.json `featureType === 'tech-stack'`) skip
 * UX/UI and jump straight to Architecture.
 *
 * Only stdlib + lib/v5/decisions.mjs — no external deps.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { readDecisions } from './decisions.mjs';

/** Canonical phase ordering for a regular feature. */
const REGULAR_ORDER = ['ux', 'ui', 'architecture', 'build'];

/** Canonical phase ordering for a tech-stack feature (skips UX/UI). */
const TECH_STACK_ORDER = ['architecture', 'build'];

/** Phases the decisions.json schema tracks (build is execution, not tracked there). */
const TRACKED_PHASES = ['ux', 'ui', 'architecture'];

/** Sentinel returned after `build`. */
const DONE = 'done';

/** Valid phase strings accepted by the gate functions. */
const VALID_PHASES = new Set([...REGULAR_ORDER]); // ux, ui, architecture, build

/**
 * Read status.json for a feature and decide whether it is a tech-stack item.
 *
 * @param {string} slug
 * @param {string} controlRoot - absolute path to the project root (directory
 *   containing `control/v5/`).
 * @returns {Promise<boolean>}
 */
export async function isTechStackFeature(slug, controlRoot) {
  if (!slug || typeof slug !== 'string') return false;
  if (!controlRoot || typeof controlRoot !== 'string') return false;
  const statusPath = path.join(controlRoot, 'control', 'v5', 'features', slug, 'status.json');
  let raw;
  try {
    raw = await fs.readFile(statusPath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return false;
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  return parsed && parsed.featureType === 'tech-stack';
}

/**
 * Return the next phase given the current phase and whether the feature is
 * a tech-stack item. `null` indicates the feature has not started any phase.
 *
 * Regular:    null -> ux -> ui -> architecture -> build -> done
 * Tech-stack: null -> architecture -> build -> done
 *
 * @param {string|null} current
 * @param {boolean} isTechStack
 * @returns {string}
 */
export function nextPhase(current, isTechStack = false) {
  const order = isTechStack ? TECH_STACK_ORDER : REGULAR_ORDER;
  if (current === null || current === undefined) return order[0];
  if (typeof current !== 'string') {
    throw new Error(`nextPhase: current phase must be a string or null; got ${typeof current}`);
  }
  if (current === DONE) return DONE;
  const idx = order.indexOf(current);
  if (idx < 0) {
    throw new Error(
      `nextPhase: unknown phase "${current}" for ${isTechStack ? 'tech-stack' : 'regular'} feature; ` +
        `expected one of ${order.join('|')}`,
    );
  }
  if (idx === order.length - 1) return DONE;
  return order[idx + 1];
}

/**
 * Inspect decisions.json + status.json and return the active phase string.
 *
 * Rules:
 *   - If decisions.json has any phase with `status === 'in-progress'`, return
 *     that phase (the first one in canonical order if multiple).
 *   - Else if every tracked phase is `complete`, return `'build'`.
 *   - Else return the first tracked phase that is `not-started`.
 *   - For tech-stack features, the tracked-phase walk skips UX/UI — so a
 *     freshly-created tech-stack feature returns `'architecture'`.
 *
 * @param {{ slug: string, controlRoot?: string }} args
 * @returns {Promise<string>}
 */
export async function currentPhase(args) {
  const { slug, controlRoot } = args || {};
  if (!slug) throw new Error('currentPhase: slug is required');
  const isTechStack = controlRoot ? await isTechStackFeature(slug, controlRoot) : false;

  const data = await readDecisions(slug, { controlRoot });
  const phases = data && data.phases ? data.phases : {};

  const order = isTechStack ? ['architecture'] : TRACKED_PHASES;

  // 1) any in-progress phase wins, in canonical order
  for (const key of order) {
    const phase = phases[key];
    if (phase && phase.status === 'in-progress') return key;
  }

  // 2) all complete -> build
  const allComplete = order.every((key) => phases[key] && phases[key].status === 'complete');
  if (allComplete) return 'build';

  // 3) first not-started (or first phase if nothing tracked yet)
  for (const key of order) {
    const phase = phases[key];
    if (!phase || phase.status === 'not-started') return key;
  }

  // Fallback: first phase in order.
  return order[0];
}

function describePending(phase, phaseName, pending) {
  if (pending.length === 0) {
    return `Phase "${phaseName}" is not marked complete (status="${(phase && phase.status) || 'not-started'}"). Mark it complete before advancing.`;
  }
  return (
    `Phase "${phaseName}" still has ${pending.length} pending decision(s): ` +
    `${pending.join(', ')}. Resolve them before advancing.`
  );
}

/**
 * Check whether the feature is allowed to advance from `fromPhase` to `toPhase`.
 *
 * Returns `{ allowed, reason, pending }`:
 *   - `allowed`  — boolean
 *   - `reason`   — string explaining why advancement is blocked, or `null`
 *   - `pending`  — array of pending decision ids for `fromPhase` (empty if none)
 *
 * Gate rules:
 *   - `fromPhase` and `toPhase` must be one of ux | ui | architecture | build.
 *   - `toPhase` must come strictly after `fromPhase` in the canonical order
 *     for this feature's type (regular vs tech-stack).
 *   - For regular features, transitions must be adjacent in the order
 *     (no skipping). Tech-stack features may jump UX|UI → architecture.
 *   - `fromPhase` (when tracked: ux|ui|architecture) must have
 *     `status === 'complete'` AND `pending.length === 0` in decisions.json.
 *
 * @param {{ slug: string, fromPhase: string, toPhase: string, controlRoot?: string }} args
 * @returns {Promise<{ allowed: boolean, reason: string|null, pending: string[] }>}
 */
export async function canAdvance(args) {
  const { slug, fromPhase, toPhase, controlRoot } = args || {};
  if (!slug) {
    return { allowed: false, reason: 'canAdvance: slug is required', pending: [] };
  }
  if (!VALID_PHASES.has(fromPhase)) {
    return {
      allowed: false,
      reason: `Invalid fromPhase "${fromPhase}"; expected one of ${[...VALID_PHASES].join('|')}`,
      pending: [],
    };
  }
  if (!VALID_PHASES.has(toPhase)) {
    return {
      allowed: false,
      reason: `Invalid toPhase "${toPhase}"; expected one of ${[...VALID_PHASES].join('|')}`,
      pending: [],
    };
  }
  if (fromPhase === toPhase) {
    return {
      allowed: false,
      reason: `Cannot advance from "${fromPhase}" to itself`,
      pending: [],
    };
  }

  const isTechStack = controlRoot ? await isTechStackFeature(slug, controlRoot) : false;
  const order = isTechStack ? TECH_STACK_ORDER : REGULAR_ORDER;
  const fromIdx = order.indexOf(fromPhase);
  const toIdx = order.indexOf(toPhase);

  // Tech-stack quirk: UX/UI aren't in the order, but the orchestrator may
  // hold a stale "currently in ux" pointer when re-classifying a feature
  // as tech-stack. Allow UX|UI -> architecture for tech-stack features.
  if (isTechStack && (fromPhase === 'ux' || fromPhase === 'ui') && toPhase === 'architecture') {
    return { allowed: true, reason: null, pending: [] };
  }

  if (fromIdx < 0) {
    return {
      allowed: false,
      reason: `Phase "${fromPhase}" is not part of the ${isTechStack ? 'tech-stack' : 'regular'} sequence`,
      pending: [],
    };
  }
  if (toIdx < 0) {
    return {
      allowed: false,
      reason: `Phase "${toPhase}" is not part of the ${isTechStack ? 'tech-stack' : 'regular'} sequence`,
      pending: [],
    };
  }
  if (toIdx <= fromIdx) {
    return {
      allowed: false,
      reason:
        toIdx < fromIdx
          ? `Backward transition: cannot move from "${fromPhase}" to "${toPhase}"`
          : `Cannot advance from "${fromPhase}" to itself`,
      pending: [],
    };
  }
  if (toIdx !== fromIdx + 1) {
    return {
      allowed: false,
      reason:
        `Cannot skip phases: "${fromPhase}" -> "${toPhase}" skips ` +
        `${order.slice(fromIdx + 1, toIdx).join(', ')}. ` +
        `Advance one phase at a time (UX → UI → Architecture → Build).`,
      pending: [],
    };
  }

  // `build` is not a tracked phase in decisions.json, so any `*_phase -> build`
  // transition still gates on the tracked source phase's status.
  if (TRACKED_PHASES.includes(fromPhase)) {
    const data = await readDecisions(slug, { controlRoot });
    const phase = (data.phases && data.phases[fromPhase]) || null;
    const pending = phase && Array.isArray(phase.pending) ? phase.pending : [];
    const status = (phase && phase.status) || 'not-started';
    if (status !== 'complete' || pending.length > 0) {
      return {
        allowed: false,
        reason: describePending(phase, fromPhase, pending),
        pending,
      };
    }
  }

  return { allowed: true, reason: null, pending: [] };
}
