/**
 * v5 pickup prompt builder.
 *
 * Implements §1 (Pickup Prompt Compression) of `docs/REFACTOR-REQUIREMENTS.md`.
 *
 * Returns a ≤5-line string that tells the orchestrator the bare minimum:
 *   - which feature
 *   - which stage
 *   - where to read status + decisions
 *   - where to resolve the route for the current stage
 *
 * The orchestrator reads the rest of its context on demand via the v5 router.
 * No inline workflow rules, no embedded state summaries, no pipeline doc text.
 *
 * Pure function — no I/O, no side effects.
 */

/**
 * Build a short pickup prompt for the v5 orchestrator.
 *
 * @param {Object} args
 * @param {string} args.slug  - Feature slug (e.g. "user-onboarding"). Required.
 * @param {string} args.stage - Current pipeline stage (e.g. "ux", "ui",
 *                              "architecture", "build", "mock"). Required.
 * @returns {string} A ≤5-line prompt body.
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

  const lines = [
    `Resume feature "${slug}" at stage: ${stage}.`,
    `Read: control/v5/features/${slug}/status.json`,
    `Read: control/v5/features/${slug}/decisions.json`,
    `Route: lib/v5/mc-router.mjs → resolveRoute for current stage.`,
  ];
  return lines.join('\n');
}

export default buildPickupPrompt;
