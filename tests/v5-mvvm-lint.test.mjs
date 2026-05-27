/** Tests for lib/v5/mvvm-lint.mjs */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { lintMVVM, lintFiles } from '../lib/v5/mvvm-lint.mjs';

async function makeTmpFeatureDir(files) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-mvvm-'));
  for (const [relPath, content] of Object.entries(files)) {
    const full = path.join(dir, relPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf8');
  }
  return dir;
}

// -----------------------------------------------------------------------------
// lintMVVM(diff) — works on unified diff text
// -----------------------------------------------------------------------------

test('lintMVVM: returns object with violations array', () => {
  const result = lintMVVM('');
  assert.ok(result && typeof result === 'object');
  assert.ok(Array.isArray(result.violations));
});

test('lintMVVM: detects view importing model directly in a diff', () => {
  const diff = `diff --git a/src/onboarding.view.tsx b/src/onboarding.view.tsx
--- a/src/onboarding.view.tsx
+++ b/src/onboarding.view.tsx
@@ -1,3 +1,4 @@
 import React from 'react';
+import { User } from './onboarding.model';
 export function View() { return null; }
`;
  const { violations } = lintMVVM(diff);
  const v = violations.find((x) => x.type === 'view-imports-model');
  assert.ok(v, `expected view-imports-model violation, got ${JSON.stringify(violations)}`);
  assert.equal(v.file, 'src/onboarding.view.tsx');
  assert.match(v.message, /Model/i);
});

test('lintMVVM: detects business logic (fetch) added in a view', () => {
  const diff = `diff --git a/src/dash.view.tsx b/src/dash.view.tsx
--- a/src/dash.view.tsx
+++ b/src/dash.view.tsx
@@ -1,2 +1,3 @@
 export function View() {
+  const data = fetch('/api/x');
 }
`;
  const { violations } = lintMVVM(diff);
  const v = violations.find((x) => x.type === 'view-has-data-fetch');
  assert.ok(v, `expected view-has-data-fetch, got ${JSON.stringify(violations)}`);
  assert.equal(v.file, 'src/dash.view.tsx');
});

test('lintMVVM: detects axios call added in a view', () => {
  const diff = `diff --git a/src/dash.view.tsx b/src/dash.view.tsx
--- a/src/dash.view.tsx
+++ b/src/dash.view.tsx
@@ -1,2 +1,3 @@
 export function View() {
+  axios.get('/api/x');
 }
`;
  const { violations } = lintMVVM(diff);
  assert.ok(violations.some((x) => x.type === 'view-has-data-fetch'));
});

test('lintMVVM: detects await db. in a view', () => {
  const diff = `diff --git a/src/dash.view.tsx b/src/dash.view.tsx
--- a/src/dash.view.tsx
+++ b/src/dash.view.tsx
@@ -1,2 +1,3 @@
 export function View() {
+  const rows = await db.query('select *');
 }
`;
  const { violations } = lintMVVM(diff);
  assert.ok(violations.some((x) => x.type === 'view-has-data-fetch'));
});

test('lintMVVM: detects model importing from view', () => {
  const diff = `diff --git a/src/onboarding.model.ts b/src/onboarding.model.ts
--- a/src/onboarding.model.ts
+++ b/src/onboarding.model.ts
@@ -1,2 +1,3 @@
 export type User = { id: string };
+import { View } from './onboarding.view';
`;
  const { violations } = lintMVVM(diff);
  const v = violations.find((x) => x.type === 'model-imports-view');
  assert.ok(v, `expected model-imports-view, got ${JSON.stringify(violations)}`);
  assert.equal(v.file, 'src/onboarding.model.ts');
});

test('lintMVVM: no violations for a well-formed diff (view imports viewmodel)', () => {
  const diff = `diff --git a/src/onboarding.view.tsx b/src/onboarding.view.tsx
--- a/src/onboarding.view.tsx
+++ b/src/onboarding.view.tsx
@@ -1,2 +1,3 @@
 import React from 'react';
+import { useOnboardingVM } from './onboarding.viewmodel';
 export function View() { return null; }
`;
  const { violations } = lintMVVM(diff);
  assert.deepEqual(violations, []);
});

test('lintMVVM: each violation has file, line, type, message', () => {
  const diff = `diff --git a/src/x.view.tsx b/src/x.view.tsx
--- a/src/x.view.tsx
+++ b/src/x.view.tsx
@@ -1,2 +1,3 @@
 export const X = 1;
+import { Foo } from './x.model';
`;
  const { violations } = lintMVVM(diff);
  assert.ok(violations.length >= 1);
  for (const v of violations) {
    assert.ok(typeof v.file === 'string', 'file should be string');
    assert.ok(typeof v.line === 'number', 'line should be number');
    assert.ok(typeof v.type === 'string', 'type should be string');
    assert.ok(typeof v.message === 'string', 'message should be string');
  }
});

// -----------------------------------------------------------------------------
// lintFiles({ root, files }) — works on filesystem
// -----------------------------------------------------------------------------

test('lintFiles: positive case — properly separated feature has no violations', async () => {
  const dir = await makeTmpFeatureDir({
    'src/onboarding.model.ts': `export type User = { id: string };\n`,
    'src/onboarding.viewmodel.ts': `import { User } from './onboarding.model';\nexport function useVM() { return null; }\n`,
    'src/onboarding.view.tsx': `import React from 'react';\nimport { useVM } from './onboarding.viewmodel';\nexport function View() { return null; }\n`,
  });
  const { violations } = await lintFiles({
    root: dir,
    files: [
      'src/onboarding.model.ts',
      'src/onboarding.viewmodel.ts',
      'src/onboarding.view.tsx',
    ],
  });
  assert.deepEqual(violations, [], `expected zero violations, got ${JSON.stringify(violations)}`);
});

test('lintFiles: catches view-imports-model on file scan', async () => {
  const dir = await makeTmpFeatureDir({
    'src/x.model.ts': `export type X = number;\n`,
    'src/x.viewmodel.ts': `export function useX() {}\n`,
    'src/x.view.tsx': `import { X } from './x.model';\nexport function View() { return null; }\n`,
  });
  const { violations } = await lintFiles({
    root: dir,
    files: ['src/x.model.ts', 'src/x.viewmodel.ts', 'src/x.view.tsx'],
  });
  const v = violations.find((x) => x.type === 'view-imports-model');
  assert.ok(v, `expected view-imports-model, got ${JSON.stringify(violations)}`);
});

test('lintFiles: catches view-has-data-fetch on file scan', async () => {
  const dir = await makeTmpFeatureDir({
    'src/x.viewmodel.ts': `export function useX() {}\n`,
    'src/x.view.tsx': `import { useX } from './x.viewmodel';\nexport function View() {\n  fetch('/api/x');\n  return null;\n}\n`,
  });
  const { violations } = await lintFiles({
    root: dir,
    files: ['src/x.viewmodel.ts', 'src/x.view.tsx'],
  });
  assert.ok(violations.some((v) => v.type === 'view-has-data-fetch'));
});

test('lintFiles: catches model-imports-view on file scan', async () => {
  const dir = await makeTmpFeatureDir({
    'src/x.view.tsx': `export function View() { return null; }\n`,
    'src/x.model.ts': `import { View } from './x.view';\nexport type X = number;\n`,
  });
  const { violations } = await lintFiles({
    root: dir,
    files: ['src/x.view.tsx', 'src/x.model.ts'],
  });
  assert.ok(violations.some((v) => v.type === 'model-imports-view'));
});

test('lintFiles: catches view-missing-viewmodel when a view exists with no sibling viewmodel', async () => {
  const dir = await makeTmpFeatureDir({
    'src/orphan.view.tsx': `export function View() { return null; }\n`,
    'src/orphan.model.ts': `export type X = number;\n`,
  });
  const { violations } = await lintFiles({
    root: dir,
    files: ['src/orphan.view.tsx', 'src/orphan.model.ts'],
  });
  const v = violations.find((x) => x.type === 'view-missing-viewmodel');
  assert.ok(v, `expected view-missing-viewmodel, got ${JSON.stringify(violations)}`);
  assert.match(v.message, /viewmodel/i);
});

test('lintFiles: view-missing-viewmodel does not fire when sibling viewmodel.ts exists', async () => {
  const dir = await makeTmpFeatureDir({
    'src/x.view.tsx': `import { useX } from './x.viewmodel';\nexport function View() { return null; }\n`,
    'src/x.viewmodel.ts': `export function useX() {}\n`,
  });
  const { violations } = await lintFiles({
    root: dir,
    files: ['src/x.view.tsx', 'src/x.viewmodel.ts'],
  });
  assert.ok(!violations.some((v) => v.type === 'view-missing-viewmodel'));
});

test('lintFiles: view-missing-viewmodel does not fire when sibling viewmodel.tsx exists', async () => {
  const dir = await makeTmpFeatureDir({
    'src/x.view.tsx': `import { useX } from './x.viewmodel';\nexport function View() { return null; }\n`,
    'src/x.viewmodel.tsx': `export function useX() { return null; }\n`,
  });
  const { violations } = await lintFiles({
    root: dir,
    files: ['src/x.view.tsx', 'src/x.viewmodel.tsx'],
  });
  assert.ok(!violations.some((v) => v.type === 'view-missing-viewmodel'));
});

test('lintFiles: ignores non-MVVM-named files', async () => {
  const dir = await makeTmpFeatureDir({
    'src/utils.ts': `import { fetch as f } from 'node-fetch';\nexport const x = 1;\n`,
    'src/component.tsx': `export function C() { fetch('/api'); return null; }\n`,
  });
  const { violations } = await lintFiles({
    root: dir,
    files: ['src/utils.ts', 'src/component.tsx'],
  });
  assert.deepEqual(violations, []);
});
