import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FORBIDDEN = [
  'docs/superpowers/control', 'techStackStatus', 'pipelineStage', 'buildOrder',
  'HANDOFF.md', 'regenerate dashboard', 'regenerate the dashboard', 'dashboard.html',
  'ROUTER.md', 'ORCHESTRATOR.md', 'WORKSTREAMS.md', 'AGENT-DATA-RULES.md',
  'ADD-FEATURE-PIPELINE.md', 'CONTEXT-PACKETS.md', 'mission-control` skill',
];

async function* walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.name.endsWith('.md')) yield full;
  }
}

test('no shipped skill body contains v4 markers', async () => {
  const offenders = [];
  for await (const file of walk(path.join(root, 'skills'))) {
    const text = await fs.readFile(file, 'utf8');
    for (const m of FORBIDDEN) if (text.includes(m)) offenders.push(`${file} :: ${m}`);
  }
  assert.deepEqual(offenders, [], `v4 markers found:\n${offenders.join('\n')}`);
});

test('no skill references the mc-v5 prototype names', async () => {
  const offenders = [];
  for await (const file of walk(path.join(root, 'skills'))) {
    const text = await fs.readFile(file, 'utf8');
    if (/\bmc-v5\b/.test(text)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `stale mc-v5 references:\n${offenders.join('\n')}`);
});
