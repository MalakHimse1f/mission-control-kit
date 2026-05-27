// tests/v5-cli-new-feature.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { makeTmpProject } from './helpers/tmp-project.mjs';
import { parseArgs } from '../lib/v5/cli/new-feature.mjs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(__dirname, '..', 'lib', 'v5', 'cli', 'new-feature.mjs');

test('parseArgs reads slug, --type, --description, --control-root', () => {
  const a = parseArgs(['my-feature', '--type', 'tech-stack', '--description', 'hi', '--control-root', '/p']);
  assert.equal(a.slug, 'my-feature');
  assert.equal(a.featureType, 'tech-stack');
  assert.equal(a.description, 'hi');
  assert.equal(a.controlRoot, '/p');
});

test('parseArgs throws without a slug', () => {
  assert.throws(() => parseArgs([]));
});

test('CLI scaffolds a feature and prints the status.json path', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    const { stdout } = await execFileAsync('node', [CLI, 'checkout', '--control-root', root]);
    assert.match(stdout, /features[\\/]checkout[\\/]status\.json/);
  } finally {
    await cleanup();
  }
});
