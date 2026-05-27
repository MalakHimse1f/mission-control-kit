/**
 * v5 deferred-question surfacing — Task 9.
 *
 * Deferred questions accrue during UX/UI as the user wanders into
 * tech topics (`isTechStackQuestion` from defer-question.mjs).
 * When the architecture phase begins, the orchestrator calls
 * `surfaceDeferred` to fetch them and feed them back into the
 * decision flow.
 *
 * `surfaceDeferred` is read-only — it does not mutate decisions.json.
 * Use `markDeferredResolved` to remove entries once they have been
 * answered or re-classified.
 */

import { readDecisions, writeDecisions } from './decisions.mjs';

/**
 * Return the deferred questions relevant to `atPhase`.
 *
 *   - `architecture` -> every deferred question
 *   - `ui` or `ux`   -> `[]` (deferred questions are tech/arch by design)
 *   - `build`        -> `[]` (build phase doesn't surface decisions)
 *   - unknown phase  -> `[]` (defensive default)
 *
 * @param {{ slug: string, atPhase: string, controlRoot?: string }} args
 * @returns {Promise<Array<{ question: string, raisedDuring: string, raisedAt: string }>>}
 */
export async function surfaceDeferred(args) {
  const { slug, atPhase, controlRoot } = args || {};
  if (!slug) throw new Error('surfaceDeferred: slug is required');
  if (atPhase !== 'architecture') return [];

  const data = await readDecisions(slug, { controlRoot });
  const deferred = Array.isArray(data.deferred) ? data.deferred : [];
  // Return a shallow copy so callers can't accidentally mutate stored state.
  return deferred.map((entry) => ({ ...entry }));
}

/**
 * Remove deferred entries that match any of the supplied `questionIds`.
 *
 * The decisions.json schema does not include a stable id on deferred
 * entries (per lib/v5/decisions-schema.mjs), so "id" here is the
 * `question` string itself. Entries with a matching `question` are
 * removed. Unknown ids are silently ignored.
 *
 * @param {{ slug: string, questionIds: string[], controlRoot?: string }} args
 * @returns {Promise<object>} updated decisions payload
 */
export async function markDeferredResolved(args) {
  const { slug, questionIds, controlRoot } = args || {};
  if (!slug) throw new Error('markDeferredResolved: slug is required');
  if (!Array.isArray(questionIds)) {
    throw new Error('markDeferredResolved: questionIds must be an array');
  }
  if (questionIds.length === 0) {
    // Nothing to remove — still read so callers get a consistent return type.
    return readDecisions(slug, { controlRoot });
  }

  const ids = new Set(questionIds.filter((x) => typeof x === 'string' && x.length > 0));
  if (ids.size === 0) {
    return readDecisions(slug, { controlRoot });
  }

  const data = await readDecisions(slug, { controlRoot });
  const before = Array.isArray(data.deferred) ? data.deferred : [];
  const after = before.filter((entry) => !ids.has(entry.question));
  if (after.length === before.length) {
    // No matches — skip the write entirely.
    return data;
  }
  data.deferred = after;
  return writeDecisions(slug, data, { controlRoot });
}
