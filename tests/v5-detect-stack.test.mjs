// tests/v5-detect-stack.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { makeTmpProject } from './helpers/tmp-project.mjs';
import { detectStack } from '../lib/v5/detect-stack.mjs';

test('detectStack flags an existing Node project from package.json', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ dependencies: { next: '14.0.0' } }),
      'utf8',
    );
    const res = await detectStack({ projectRoot: root });
    assert.equal(res.likelyExisting, true);
    assert.ok(res.frameworks.includes('next') || res.frameworks.includes('Next.js'));
  } finally {
    await cleanup();
  }
});

test('detectStack on an empty project reports greenfield', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    const res = await detectStack({ projectRoot: root });
    assert.equal(res.likelyExisting, false);
  } finally {
    await cleanup();
  }
});
