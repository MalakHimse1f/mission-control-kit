/**
 * Tests for lib/v5/build-pickup-prompt.mjs
 *
 * Validates that the orchestrator pickup prompt:
 *   - is ≤2 sentences (per §1 of docs/REFACTOR-REQUIREMENTS.md)
 *   - contains the slug and stage
 *   - points at the v5 status.json and decisions.json paths
 *   - references the v5 mc-router
 *   - fails loudly when slug or stage are missing
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPickupPrompt } from '../lib/v5/build-pickup-prompt.mjs';

/** Count sentences ending with `.`, `?`, or `!` (excluding empty fragments). */
function countSentences(text) {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length;
}

test('buildPickupPrompt returns at most 2 sentences', () => {
  const prompt = buildPickupPrompt({ slug: 'user-onboarding', stage: 'ux' });
  const count = countSentences(prompt);
  assert.ok(
    count <= 2,
    `expected ≤2 sentences, got ${count}:\n${prompt}`,
  );
});

test('buildPickupPrompt contains the slug', () => {
  const prompt = buildPickupPrompt({ slug: 'user-onboarding', stage: 'ux' });
  assert.match(prompt, /user-onboarding/);
});

test('buildPickupPrompt contains the stage', () => {
  const prompt = buildPickupPrompt({ slug: 'demo', stage: 'mock' });
  assert.match(prompt, /mock/);
});

test('buildPickupPrompt references the v5 status.json path', () => {
  const prompt = buildPickupPrompt({ slug: 'user-onboarding', stage: 'ux' });
  assert.ok(
    prompt.includes('control/v5/features/user-onboarding/status.json'),
    `expected control/v5/features/user-onboarding/status.json in prompt:\n${prompt}`,
  );
});

test('buildPickupPrompt references decisions.json near the slug', () => {
  // After tightening to 2 sentences, the prompt collapses the two read paths
  // into "status.json and decisions.json" sharing the slug directory. We just
  // need to know both filenames appear and the slug directory is referenced.
  const prompt = buildPickupPrompt({ slug: 'user-onboarding', stage: 'ux' });
  assert.ok(
    prompt.includes('control/v5/features/user-onboarding/') &&
      prompt.includes('decisions.json'),
    `expected decisions.json under control/v5/features/user-onboarding/ in prompt:\n${prompt}`,
  );
});

test('buildPickupPrompt mentions mc-router.mjs or Route', () => {
  const prompt = buildPickupPrompt({ slug: 'demo', stage: 'ux' });
  assert.ok(
    prompt.includes('mc-router.mjs') || /Route/.test(prompt),
    `expected mc-router.mjs or "Route" in prompt:\n${prompt}`,
  );
});

test('buildPickupPrompt throws without args', () => {
  assert.throws(() => buildPickupPrompt(), /slug|stage|required/i);
});

test('buildPickupPrompt throws without slug', () => {
  assert.throws(() => buildPickupPrompt({ stage: 'ux' }), /slug/i);
});

test('buildPickupPrompt throws without stage', () => {
  assert.throws(() => buildPickupPrompt({ slug: 'demo' }), /stage/i);
});

test('buildPickupPrompt throws on empty slug', () => {
  assert.throws(() => buildPickupPrompt({ slug: '', stage: 'ux' }), /slug/i);
});

test('buildPickupPrompt throws on empty stage', () => {
  assert.throws(() => buildPickupPrompt({ slug: 'demo', stage: '' }), /stage/i);
});

test('buildPickupPrompt slug substitution is exact (no token leakage)', () => {
  const prompt = buildPickupPrompt({ slug: 'my-feature', stage: 'ui' });
  assert.ok(!prompt.includes('{slug}'), 'literal {slug} token must be substituted');
  assert.ok(!prompt.includes('{stage}'), 'literal {stage} token must be substituted');
});
