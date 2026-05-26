/**
 * Tests for `lib/v5/context-packet.mjs` — specifically the `instructions[]`
 * field that surfaces per-route `usageNote` values into every dispatch packet.
 *
 * `tests/v5-router.test.mjs` already covers the basics (tokens estimate,
 * deferred forwarding, missing-doc warnings). This file focuses on the
 * instructions/usage-note contract introduced by the visual-fragment work.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { resolveRoute, listTaskTypes } from '../lib/v5/mc-router.mjs';
import { buildPacket } from '../lib/v5/context-packet.mjs';

async function makeTmpControlRoot() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-packet-'));
  const controlRoot = path.join(dir, 'control', 'v5');
  await fs.mkdir(controlRoot, { recursive: true });
  await fs.mkdir(path.join(controlRoot, 'routing'), { recursive: true });
  return { tmpDir: dir, controlRoot, projectRoot: dir };
}

test('buildPacket attaches an instructions[] array to every packet', async () => {
  const { projectRoot } = await makeTmpControlRoot();
  for (const taskType of listTaskTypes()) {
    const route = await resolveRoute({ taskType, slug: 'demo' });
    const packet = await buildPacket({
      task: `do ${taskType}`,
      route,
      stage: 'ux',
      slug: 'demo',
      controlRoot: projectRoot,
    });
    assert.ok(
      Array.isArray(packet.instructions),
      `${taskType} packet.instructions should be an array`,
    );
    assert.ok(
      packet.instructions.length > 0,
      `${taskType} packet.instructions should be non-empty`,
    );
    for (const line of packet.instructions) {
      assert.equal(typeof line, 'string', 'every instructions entry should be a string');
      assert.ok(line.length > 0, 'every instructions entry should be non-empty');
    }
  }
});

test('UX/UI/Architecture packets include the verbatim visual-fragment hard rule', async () => {
  const { projectRoot } = await makeTmpControlRoot();
  const visualTypes = ['ux-decisions', 'ui-implementation', 'architecture'];
  for (const taskType of visualTypes) {
    const route = await resolveRoute({ taskType, slug: 'demo' });
    const packet = await buildPacket({
      task: `do ${taskType}`,
      route,
      stage: taskType === 'architecture' ? 'architecture' : 'ux',
      slug: 'demo',
      controlRoot: projectRoot,
    });
    const joined = packet.instructions.join('\n');
    assert.ok(
      joined.includes('MUST NOT write HTML for a decision card by hand'),
      `${taskType} packet.instructions should contain the hard rule`,
    );
    assert.ok(
      joined.includes('lib/v5/cli/build-decision.mjs'),
      `${taskType} packet.instructions should reference build-decision.mjs CLI`,
    );
  }
});

test('research / build / brainstorm packets include the routing-docs note', async () => {
  const { projectRoot } = await makeTmpControlRoot();
  for (const taskType of ['research', 'build', 'brainstorm']) {
    const route = await resolveRoute({ taskType, slug: 'demo' });
    const packet = await buildPacket({
      task: `do ${taskType}`,
      route,
      stage: 'ux',
      slug: 'demo',
      controlRoot: projectRoot,
    });
    const joined = packet.instructions.join('\n');
    assert.ok(
      /routing docs in `control\/v5\/routing\/`/i.test(joined),
      `${taskType} packet.instructions should reference control/v5/routing/ docs; got: ${joined}`,
    );
  }
});

test('deferred packets still surface instructions[] so the orchestrator sees the contract', async () => {
  const route = await resolveRoute({ taskType: 'architecture', stage: 'ux', slug: 'demo' });
  const packet = await buildPacket({
    task: 'Pick a database',
    route,
    stage: 'ux',
    slug: 'demo',
  });
  assert.equal(packet.deferred, true);
  assert.ok(Array.isArray(packet.instructions), 'deferred packet should still have instructions[]');
  assert.ok(packet.instructions.length > 0, 'deferred packet instructions should not be empty');
  const joined = packet.instructions.join('\n');
  assert.ok(
    joined.includes('MUST NOT write HTML for a decision card by hand'),
    'deferred architecture packet should still surface the visual-fragment hard rule',
  );
});

test('instructions[] is a flat array of strings (no nested objects or nulls)', async () => {
  const { projectRoot } = await makeTmpControlRoot();
  const route = await resolveRoute({ taskType: 'ux-decisions', slug: 'demo' });
  const packet = await buildPacket({
    task: 'pick a UX pattern',
    route,
    stage: 'ux',
    slug: 'demo',
    controlRoot: projectRoot,
  });
  assert.ok(Array.isArray(packet.instructions));
  for (const entry of packet.instructions) {
    assert.equal(typeof entry, 'string');
    assert.ok(entry.length > 0);
  }
});
