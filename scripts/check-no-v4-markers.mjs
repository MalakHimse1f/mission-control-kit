#!/usr/bin/env node
/**
 * Scan skill bodies for forbidden v4 markers. Prints offenders grouped by file.
 * Usage: node scripts/check-no-v4-markers.mjs [path ...]   (default: skills)
 * Exit 0 = clean, exit 1 = violations.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const FORBIDDEN = [
  'docs/superpowers/control',
  'techStackStatus',
  'pipelineStage',
  'buildOrder',
  'HANDOFF.md',
  'regenerate dashboard',
  'regenerate the dashboard',
  'dashboard.html',
  'ROUTER.md',
  'ORCHESTRATOR.md',
  'WORKSTREAMS.md',
  'AGENT-DATA-RULES.md',
  'ADD-FEATURE-PIPELINE.md',
  'CONTEXT-PACKETS.md',
  'mission-control` skill',
];

async function* walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.name.endsWith('.md')) yield full;
  }
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['skills'];
let violations = 0;
for (const target of targets) {
  const stat = await fs.stat(target).catch(() => null);
  if (!stat) continue;
  const files = stat.isDirectory() ? walk(target) : (async function* () { yield target; })();
  for await (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    const hits = FORBIDDEN.filter((m) => text.includes(m));
    if (hits.length) {
      violations += hits.length;
      console.log(`${file}:`);
      for (const h of hits) console.log(`  - ${h}`);
    }
  }
}
if (violations) {
  console.log(`\n${violations} v4 marker(s) found.`);
  process.exit(1);
}
console.log('No v4 markers found.');
