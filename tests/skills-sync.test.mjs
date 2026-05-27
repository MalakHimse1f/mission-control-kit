import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function dirs(p) {
  return (await fs.readdir(p, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
}

test('every skills/ dir exists in claude-skills/ with identical SKILL.md', async () => {
  const skillDirs = await dirs(path.join(root, 'skills'));
  const claudeDirs = new Set(await dirs(path.join(root, 'claude-skills')));
  for (const name of skillDirs) {
    assert.ok(claudeDirs.has(name), `claude-skills/ missing ${name} — run build-claude-skills.mjs`);
    const a = await fs.readFile(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const b = await fs.readFile(path.join(root, 'claude-skills', name, 'SKILL.md'), 'utf8');
    assert.equal(b, a, `claude-skills/${name}/SKILL.md is stale`);
  }
});
