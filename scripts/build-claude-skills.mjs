#!/usr/bin/env node
/**
 * Generate claude-skills/ as a straight copy of skills/.
 * After the v5 rewrite, every skills/<name>/SKILL.md already has valid
 * frontmatter, so no transform is needed — copy verbatim (including sibling
 * files like parallel-execution.md).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kitRoot = path.resolve(here, '..');
const src = path.join(kitRoot, 'skills');
const dest = path.join(kitRoot, 'claude-skills');

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  for (const e of await fs.readdir(from, { withFileTypes: true })) {
    const s = path.join(from, e.name);
    const d = path.join(to, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

await fs.rm(dest, { recursive: true, force: true });
await copyDir(src, dest);
const count = (await fs.readdir(dest, { withFileTypes: true })).filter((e) => e.isDirectory()).length;
console.log(`Built ${count} skills in claude-skills/`);
