/**
 * v5 pickup prompt builder.
 *
 * Implements §1 (Pickup Prompt Compression) of `docs/REFACTOR-REQUIREMENTS.md`.
 *
 * Returns a ≤2-sentence string that points the orchestrator at the right
 * on-disk artifacts. The orchestrator reads everything else on demand via
 * the v5 router. No inline workflow rules, no embedded state, no chat
 * history — the prompt + the routing docs are sufficient.
 *
 * Pure function — no I/O, no side effects.
 */

import { stageToDefaultTaskType } from './mc-router.mjs';

/**
 * Build a 2-sentence pickup prompt for the v5 orchestrator.
 *
 * The prompt embeds an explicit `taskType` so a fresh agent (with no chat
 * history) can call `resolveRoute({ taskType, stage, slug })` without
 * having to guess the task type from the stage.
 *
 * @param {Object} args
 * @param {string} args.slug  - Feature slug (e.g. "user-onboarding"). Required.
 * @param {string} args.stage - Current pipeline stage (e.g. "ux", "ui",
 *                              "architecture", "build", "mock"). Required.
 * @param {string} [args.taskType] - Optional explicit override; defaults to
 *                                   `stageToDefaultTaskType(stage)`.
 * @returns {string} A 2-sentence prompt body.
 *
 * @throws {Error} when `slug` or `stage` is missing or empty.
 */
export function buildPickupPrompt(args) {
  if (!args || typeof args !== 'object') {
    throw new Error('buildPickupPrompt: { slug, stage } are required');
  }
  const { slug, stage } = args;
  if (typeof slug !== 'string' || slug.length === 0) {
    throw new Error('buildPickupPrompt: slug is required (non-empty string)');
  }
  if (typeof stage !== 'string' || stage.length === 0) {
    throw new Error('buildPickupPrompt: stage is required (non-empty string)');
  }
  const taskType = args.taskType || stageToDefaultTaskType(stage);

  return (
    `Resume feature "${slug}" at stage ${stage} (taskType: ${taskType}). ` +
    `Read control/v5/features/${slug}/status.json and decisions.json, ` +
    `then call resolveRoute({ taskType: "${taskType}", stage: "${stage}", slug: "${slug}" }) ` +
    `from lib/v5/mc-router.mjs to load the minimum context for this phase.`
  );
}

export default buildPickupPrompt;
