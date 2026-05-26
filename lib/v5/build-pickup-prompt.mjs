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

/**
 * Build a 2-sentence pickup prompt for the v5 orchestrator.
 *
 * @param {Object} args
 * @param {string} args.slug  - Feature slug (e.g. "user-onboarding"). Required.
 * @param {string} args.stage - Current pipeline stage (e.g. "ux", "ui",
 *                              "architecture", "build", "mock"). Required.
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

  return (
    `Resume feature "${slug}" at stage ${stage}. ` +
    `Read control/v5/features/${slug}/status.json and decisions.json, ` +
    `then resolve current-stage context via lib/v5/mc-router.mjs (resolveRoute).`
  );
}

export default buildPickupPrompt;
