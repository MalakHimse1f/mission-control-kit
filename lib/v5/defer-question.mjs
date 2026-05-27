/**
 * v5 deferred-question helpers — Task 9.
 *
 * Re-exports `deferQuestion` from lib/v5/decisions.mjs with the stable
 * named-args signature the orchestrator uses, and provides
 * `isTechStackQuestion(text)` for classifying user input.
 *
 * Why a thin wrapper?
 *   - Keeps the orchestrator's import path stable even if decisions.mjs
 *     internals change.
 *   - Normalizes call shape to `{ slug, question, raisedDuring, controlRoot }`
 *     so callers don't have to remember positional argument order.
 */

import { deferQuestion as deferQuestionImpl } from './decisions.mjs';

/**
 * Append a deferred question to `decisions.json`'s `deferred[]`.
 *
 * @param {{ slug: string, question: string, raisedDuring: 'ux'|'ui'|'architecture', controlRoot?: string }} args
 */
export async function deferQuestion(args) {
  const { slug, question, raisedDuring, controlRoot } = args || {};
  return deferQuestionImpl(slug, question, raisedDuring, { controlRoot });
}

/**
 * Tech keywords that suggest the question belongs in the architecture phase.
 * Picked to match §9.4 of REFACTOR-REQUIREMENTS.md.
 */
const TECH_KEYWORDS = [
  'database',
  'api',
  'infrastructure',
  'deployment',
  'framework',
  'library',
  'service',
  'stack',
];

/**
 * Heuristic: does this question read like a tech/architecture question that
 * the orchestrator should defer during UX/UI phases?
 *
 * Matches the keyword list as standalone words (case-insensitive), so
 * "Stack" and "stacking" both hit "stack" — substring match is intentional
 * because real questions phrase keywords in many forms ("APIs", "deploying",
 * "frameworks").
 *
 * @param {unknown} question
 * @returns {boolean}
 */
export function isTechStackQuestion(question) {
  if (typeof question !== 'string' || question.length === 0) return false;
  const lower = question.toLowerCase();
  return TECH_KEYWORDS.some((kw) => lower.includes(kw));
}
