# v5-Native `/mc` Skill Suite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite every `/mc` skill to run on the v5 architecture, fold the `mc-v5*` prototypes into the canonical skill names with zero duplication, fix the distribution bug that kept v5 skills out of Claude projects, and refresh the two user-facing doc surfaces — all guarded by regression tests.

**Architecture:** Add a small `lib/v5` scaffold/state layer (mirroring the existing `decisions.mjs` atomic-write + project-root-walk pattern) to fill the "no way to create a feature" gap; rewrite each skill body against the v5 disk/router/gate/dashboard contracts; replace the brittle PowerShell skill-build with a Node straight-copy; delete the v4 docs after porting the still-needed rules into `control/v5/routing/`.

**Tech Stack:** Node ≥18 ESM (stdlib only — `node:fs/promises`, `node:path`, `node:test`, `node:assert/strict`), Markdown skill bodies, the existing `lib/v5/*` engine.

**Spec:** `docs/superpowers/specs/2026-05-27-v5-native-skill-suite-design.md`

---

## Conventions used throughout

- **`controlRoot` = project root** (the directory that *contains* `control/v5/`), never `control/v5/` itself.
- All new helpers are stdlib-only ESM, async IO, UTF-8, `JSON.stringify(x, null, 2) + '\n'`, atomic writes via `tmp + rename`.
- Tests live in `tests/`, use `node:test` + `node:assert/strict`, and create a fresh temp project under `os.tmpdir()` per test (see Task 1 for the helper).
- Run the full suite with: `node --test tests/v5-*.test.mjs tests/skills-*.test.mjs`
- Commit after every task (the `git add` lines are explicit).
- Work on a branch: `git switch -c v5-native-skills` before Task 1.

---

## Phase A — Foundation plumbing (`lib/v5` scaffold + state + CLI)

### Task 1: Shared test helper for a temp v5 project

**Files:**
- Create: `tests/helpers/tmp-project.mjs`

- [ ] **Step 1: Write the helper**

```js
// tests/helpers/tmp-project.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/**
 * Create a fresh temp project root containing an empty control/v5/ skeleton.
 * Returns { root, cleanup }. `root` is the project root (contains control/v5/).
 */
export async function makeTmpProject({ withState = true } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-'));
  await fs.mkdir(path.join(root, 'control', 'v5', 'features'), { recursive: true });
  if (withState) {
    const state = { version: '5.0.0', activeFeature: null, features: [], updatedAt: new Date().toISOString() };
    await fs.writeFile(
      path.join(root, 'control', 'v5', 'state.json'),
      JSON.stringify(state, null, 2) + '\n',
      'utf8',
    );
  }
  const cleanup = () => fs.rm(root, { recursive: true, force: true });
  return { root, cleanup };
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/helpers/tmp-project.mjs
git commit -m "test: add temp v5 project helper"
```

---

### Task 2: `lib/v5/state.mjs` — atomic state.json read/modify/write

**Files:**
- Create: `lib/v5/state.mjs`
- Test: `tests/v5-state.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// tests/v5-state.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { makeTmpProject } from './helpers/tmp-project.mjs';
import { readState, writeState, upsertFeature, setActiveFeature } from '../lib/v5/state.mjs';

test('readState returns default when state.json is missing', async () => {
  const { root, cleanup } = await makeTmpProject({ withState: false });
  try {
    const state = await readState({ controlRoot: root });
    assert.equal(state.version, '5.0.0');
    assert.deepEqual(state.features, []);
    assert.equal(state.activeFeature, null);
  } finally {
    await cleanup();
  }
});

test('upsertFeature adds then updates a feature by slug', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    await upsertFeature({ slug: 'a', stage: 'needs-input', currentPhase: 'ux' }, { controlRoot: root });
    let state = await readState({ controlRoot: root });
    assert.equal(state.features.length, 1);
    assert.equal(state.features[0].stage, 'needs-input');

    await upsertFeature({ slug: 'a', stage: 'in-progress', currentPhase: 'build' }, { controlRoot: root });
    state = await readState({ controlRoot: root });
    assert.equal(state.features.length, 1, 'upsert must not duplicate by slug');
    assert.equal(state.features[0].stage, 'in-progress');
    assert.equal(state.features[0].currentPhase, 'build');
  } finally {
    await cleanup();
  }
});

test('setActiveFeature sets the pointer and writes atomically', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    await setActiveFeature('a', { controlRoot: root });
    const state = await readState({ controlRoot: root });
    assert.equal(state.activeFeature, 'a');
    // No leftover tmp file.
    const dir = await fs.readdir(path.join(root, 'control', 'v5'));
    assert.ok(!dir.some((f) => f.endsWith('.tmp')), 'no .tmp left behind');
  } finally {
    await cleanup();
  }
});

test('writeState always refreshes updatedAt', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    const before = (await readState({ controlRoot: root })).updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const after = (await writeState({ features: [] }, { controlRoot: root })).updatedAt;
    assert.notEqual(before, after);
  } finally {
    await cleanup();
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/v5-state.test.mjs`
Expected: FAIL — `Cannot find module '../lib/v5/state.mjs'`.

- [ ] **Step 3: Implement `lib/v5/state.mjs`**

```js
/**
 * v5 state.json read/write utilities.
 *
 * File layout: `{controlRoot}/control/v5/state.json` where `controlRoot` is the
 * project root (the directory containing `control/v5/`).
 *
 * Shape: { version, activeFeature, features: [{ slug, stage, currentPhase }], updatedAt }
 *
 * Mirrors lib/v5/decisions.mjs: stdlib-only, async, atomic (tmp + rename),
 * controlRoot defaults to the nearest project root walking up from cwd.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

async function findNearestProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 64; i++) {
    const candidate = path.join(dir, 'control', 'v5');
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return dir;
    } catch {
      // keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate project root (parent of control/v5/) from ${startDir}. ` +
      `Pass {controlRoot} explicitly.`,
  );
}

async function resolveControlRoot(opts) {
  if (opts && opts.controlRoot) return opts.controlRoot;
  return findNearestProjectRoot(process.cwd());
}

function statePath(controlRoot) {
  return path.join(controlRoot, 'control', 'v5', 'state.json');
}

function defaultState() {
  return { version: '5.0.0', activeFeature: null, features: [], updatedAt: new Date().toISOString() };
}

export async function readState(opts = {}) {
  const controlRoot = await resolveControlRoot(opts);
  const filePath = statePath(controlRoot);
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (err) {
    if (err && err.code === 'ENOENT') return defaultState();
    throw err;
  }
}

export async function writeState(state, opts = {}) {
  const controlRoot = await resolveControlRoot(opts);
  const filePath = statePath(controlRoot);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const normalized = {
    ...defaultState(),
    ...(state && typeof state === 'object' ? state : {}),
    updatedAt: new Date().toISOString(),
  };
  if (!Array.isArray(normalized.features)) normalized.features = [];
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, filePath);
  return normalized;
}

export async function upsertFeature(entry, opts = {}) {
  if (!entry || typeof entry.slug !== 'string' || !entry.slug) {
    throw new Error('upsertFeature: entry.slug must be a non-empty string');
  }
  const state = await readState(opts);
  const features = Array.isArray(state.features) ? state.features : [];
  const idx = features.findIndex((f) => f && f.slug === entry.slug);
  if (idx >= 0) features[idx] = { ...features[idx], ...entry };
  else features.push({ ...entry });
  state.features = features;
  return writeState(state, opts);
}

export async function setActiveFeature(slug, opts = {}) {
  const state = await readState(opts);
  state.activeFeature = slug;
  return writeState(state, opts);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/v5-state.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/v5/state.mjs tests/v5-state.test.mjs
git commit -m "feat(v5): add state.json read/modify/write helper"
```

---

### Task 3: `lib/v5/feature-scaffold.mjs` — create a feature on disk

**Files:**
- Create: `lib/v5/feature-scaffold.mjs`
- Test: `tests/v5-feature-scaffold.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// tests/v5-feature-scaffold.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { makeTmpProject } from './helpers/tmp-project.mjs';
import { scaffoldFeature } from '../lib/v5/feature-scaffold.mjs';
import { readDecisions } from '../lib/v5/decisions.mjs';
import { readState } from '../lib/v5/state.mjs';

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, 'utf8'));
}

test('scaffoldFeature creates status.json, decisions.json, and registers in state', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    const res = await scaffoldFeature(
      { slug: 'user-onboarding', description: 'Sign-up flow', controlRoot: root },
    );
    assert.equal(res.created, true);
    assert.equal(res.currentPhase, 'ux');

    const status = await readJson(res.statusPath);
    assert.equal(status.slug, 'user-onboarding');
    assert.equal(status.featureType, 'feature');
    assert.equal(status.stage, 'needs-input');
    assert.equal(status.currentPhase, 'ux');
    assert.equal(status.description, 'Sign-up flow');

    const decisions = await readDecisions('user-onboarding', { controlRoot: root });
    assert.equal(decisions.feature, 'user-onboarding');
    assert.deepEqual(Object.keys(decisions.phases).sort(), ['architecture', 'ui', 'ux']);

    const state = await readState({ controlRoot: root });
    assert.ok(state.features.some((f) => f.slug === 'user-onboarding'));
  } finally {
    await cleanup();
  }
});

test('tech-stack featureType starts at architecture phase', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    const res = await scaffoldFeature(
      { slug: 'platform', featureType: 'tech-stack', controlRoot: root },
    );
    assert.equal(res.currentPhase, 'architecture');
    const status = await readJson(res.statusPath);
    assert.equal(status.featureType, 'tech-stack');
    assert.equal(status.currentPhase, 'architecture');
  } finally {
    await cleanup();
  }
});

test('scaffoldFeature is idempotent — does not clobber an existing feature', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    await scaffoldFeature({ slug: 'a', description: 'first', controlRoot: root });
    // Mutate status to simulate progress.
    const statusPath = path.join(root, 'control', 'v5', 'features', 'a', 'status.json');
    const status = await readJson(statusPath);
    status.stage = 'in-progress';
    await fs.writeFile(statusPath, JSON.stringify(status, null, 2) + '\n', 'utf8');

    const res = await scaffoldFeature({ slug: 'a', description: 'second', controlRoot: root });
    assert.equal(res.created, false);
    const after = await readJson(statusPath);
    assert.equal(after.stage, 'in-progress', 'must not overwrite existing status');
    assert.equal(after.description, 'first', 'must not overwrite existing description');
  } finally {
    await cleanup();
  }
});

test('scaffoldFeature rejects bad slug and featureType', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    await assert.rejects(() => scaffoldFeature({ slug: '', controlRoot: root }));
    await assert.rejects(() => scaffoldFeature({ slug: 'x', featureType: 'nope', controlRoot: root }));
  } finally {
    await cleanup();
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/v5-feature-scaffold.test.mjs`
Expected: FAIL — `Cannot find module '../lib/v5/feature-scaffold.mjs'`.

- [ ] **Step 3: Implement `lib/v5/feature-scaffold.mjs`**

```js
/**
 * v5 feature scaffolding: create control/v5/features/{slug}/ with a default
 * status.json + schema-valid decisions.json, and register the feature in
 * state.json. Idempotent — never clobbers an existing feature.
 *
 * controlRoot is the project root (directory containing control/v5/).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { writeDecisions } from './decisions.mjs';
import { upsertFeature } from './state.mjs';

const VALID_FEATURE_TYPES = ['feature', 'tech-stack'];

async function findNearestProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 64; i++) {
    try {
      const stat = await fs.stat(path.join(dir, 'control', 'v5'));
      if (stat.isDirectory()) return dir;
    } catch {
      // keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate project root (parent of control/v5/) from ${startDir}. ` +
      `Pass {controlRoot} explicitly.`,
  );
}

/**
 * @param {object} args
 * @param {string} args.slug
 * @param {string} [args.description]
 * @param {'feature'|'tech-stack'} [args.featureType]
 * @param {string} [args.controlRoot] project root containing control/v5/
 * @returns {Promise<{ slug, featureDir, statusPath, created, featureType, currentPhase }>}
 */
export async function scaffoldFeature({ slug, description = '', featureType = 'feature', controlRoot } = {}) {
  if (!slug || typeof slug !== 'string') {
    throw new Error('scaffoldFeature: slug must be a non-empty string');
  }
  if (!VALID_FEATURE_TYPES.includes(featureType)) {
    throw new Error(`scaffoldFeature: featureType must be one of ${VALID_FEATURE_TYPES.join('|')}`);
  }

  const root = controlRoot || (await findNearestProjectRoot(process.cwd()));
  const featureDir = path.join(root, 'control', 'v5', 'features', slug);
  const statusPath = path.join(featureDir, 'status.json');
  const currentPhase = featureType === 'tech-stack' ? 'architecture' : 'ux';

  let created = false;
  try {
    await fs.access(statusPath);
  } catch {
    created = true;
  }

  await fs.mkdir(featureDir, { recursive: true });

  if (created) {
    const status = {
      slug,
      feature: slug,
      stage: 'needs-input',
      currentPhase,
      featureType,
      description,
      lastUpdatedAt: new Date().toISOString(),
    };
    const tmp = `${statusPath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(status, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, statusPath);

    // writeDecisions with {} creates the schema-valid default empty structure.
    await writeDecisions(slug, {}, { controlRoot: root });
  }

  // Idempotent upsert keeps state.json in sync without clobbering other fields.
  await upsertFeature({ slug, stage: 'needs-input', currentPhase }, { controlRoot: root });

  return { slug, featureDir, statusPath, created, featureType, currentPhase };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/v5-feature-scaffold.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/v5/feature-scaffold.mjs tests/v5-feature-scaffold.test.mjs
git commit -m "feat(v5): add feature scaffolding helper"
```

---

### Task 4: `lib/v5/cli/new-feature.mjs` — CLI wrapper

**Files:**
- Create: `lib/v5/cli/new-feature.mjs`
- Test: `tests/v5-cli-new-feature.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/v5-cli-new-feature.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/v5/cli/new-feature.mjs`** (mirror `cli/build-decision.mjs`)

```js
#!/usr/bin/env node
/**
 * v5 CLI: scaffold a new feature.
 *
 * Usage:
 *   node lib/v5/cli/new-feature.mjs <slug> [--type feature|tech-stack]
 *        [--description "..."] [--control-root <path>]
 *
 * Prints the created status.json path on success (exit 0); stderr + exit 1 on error.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scaffoldFeature } from '../feature-scaffold.mjs';

const USAGE =
  'Usage: node lib/v5/cli/new-feature.mjs <slug> [--type feature|tech-stack] ' +
  '[--description "..."] [--control-root <path>]';

export function parseArgs(argv) {
  const positional = [];
  let featureType = 'feature';
  let description = '';
  let controlRoot;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const takeValue = (name) => {
      const v = argv[i + 1];
      if (!v) throw new Error(`${name} requires a value`);
      i++;
      return v;
    };
    if (arg === '--type') featureType = takeValue('--type');
    else if (arg.startsWith('--type=')) featureType = arg.slice('--type='.length);
    else if (arg === '--description') description = takeValue('--description');
    else if (arg.startsWith('--description=')) description = arg.slice('--description='.length);
    else if (arg === '--control-root') controlRoot = takeValue('--control-root');
    else if (arg.startsWith('--control-root=')) controlRoot = arg.slice('--control-root='.length);
    else if (arg === '--help' || arg === '-h') throw new Error('__HELP__');
    else if (arg.startsWith('--')) throw new Error(`Unknown flag: ${arg}`);
    else positional.push(arg);
  }
  if (positional.length < 1) throw new Error(USAGE);
  return { slug: positional[0], featureType, description, controlRoot };
}

export async function main(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (err && err.message === '__HELP__') {
      process.stdout.write(USAGE + '\n');
      return 0;
    }
    process.stderr.write(`${err.message}\n${USAGE}\n`);
    return 1;
  }
  try {
    const res = await scaffoldFeature(parsed);
    process.stdout.write(res.statusPath + '\n');
    return 0;
  } catch (err) {
    process.stderr.write(`${(err && err.message) || err}\n`);
    return 1;
  }
}

const isMain = (() => {
  try {
    return process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
  } catch {
    return false;
  }
})();

if (isMain) {
  main().then((code) => process.exit(code));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/v5-cli-new-feature.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/v5/cli/new-feature.mjs tests/v5-cli-new-feature.test.mjs
git commit -m "feat(v5): add new-feature CLI"
```

---

### Task 5: v5-aware stack detection helper

**Files:**
- Create: `lib/v5/detect-stack.mjs`
- Test: `tests/v5-detect-stack.test.mjs`

> Port only the read-only detection logic from the v4 `control/scripts/detect-stack.mjs` (no v4 paths). It inspects the project root for framework/platform signals and returns a plain object — it writes nothing.

- [ ] **Step 1: Locate the v4 source**

Run: `node -e "console.log(require('fs').existsSync('control/scripts/detect-stack.mjs'))"` (and check `docs/superpowers/control/scripts/detect-stack.mjs`). Read whichever exists to copy the signal list verbatim.

- [ ] **Step 2: Write the failing test**

```js
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
```

- [ ] **Step 3: Run to verify it fails**

Run: `node --test tests/v5-detect-stack.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `lib/v5/detect-stack.mjs`**

```js
/**
 * v5 read-only stack detection. Inspects a project root for framework /
 * platform signals so mc-init can pre-fill a tech-stack feature. Writes nothing.
 *
 * Returns: { likelyExisting, frameworks: string[], platforms: string[], signals: string[] }
 */
import fs from 'node:fs/promises';
import path from 'node:path';

async function readJsonIfPresent(p) {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'));
  } catch {
    return null;
  }
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function detectStack({ projectRoot } = {}) {
  if (!projectRoot) throw new Error('detectStack: projectRoot is required');
  const frameworks = [];
  const platforms = [];
  const signals = [];

  const pkg = await readJsonIfPresent(path.join(projectRoot, 'package.json'));
  if (pkg) {
    signals.push('package.json');
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const [name, marker] of [
      ['next', 'next'],
      ['react', 'react'],
      ['vue', 'vue'],
      ['svelte', 'svelte'],
      ['express', 'express'],
      ['@angular/core', 'angular'],
    ]) {
      if (deps[name]) frameworks.push(marker);
    }
    if (frameworks.some((f) => ['next', 'react', 'vue', 'svelte', 'angular'].includes(f))) {
      platforms.push('web');
    }
  }

  if (await exists(path.join(projectRoot, 'Package.swift'))) {
    frameworks.push('swift');
    platforms.push('ios');
    signals.push('Package.swift');
  }
  if (await exists(path.join(projectRoot, 'build.gradle'))) {
    platforms.push('android');
    signals.push('build.gradle');
  }
  if (await exists(path.join(projectRoot, 'Cargo.toml'))) {
    frameworks.push('rust');
    signals.push('Cargo.toml');
  }
  if (await exists(path.join(projectRoot, 'pyproject.toml')) || (await exists(path.join(projectRoot, 'requirements.txt')))) {
    frameworks.push('python');
    signals.push('python');
  }

  return {
    likelyExisting: signals.length > 0,
    frameworks: [...new Set(frameworks)],
    platforms: [...new Set(platforms)],
    signals,
  };
}
```

> If the v4 source had richer signals, fold them into the lists above verbatim. Keep it read-only.

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/v5-detect-stack.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/v5/detect-stack.mjs tests/v5-detect-stack.test.mjs
git commit -m "feat(v5): add read-only stack detection helper"
```

---

## Phase B — Port the still-needed v4 rules into `control/v5/routing/`

> These three docs carry concepts the rewritten skills reference. They replace the v4 `PIPELINE.md` / `AGENT-DATA-RULES.md` / `JOURNAL-RULES.md`. Keep each tight and v5-accurate.

### Task 6: Write the three v5 routing docs

**Files:**
- Create: `control/v5/routing/PIPELINE.md`
- Create: `control/v5/routing/DATA-RULES.md`
- Create: `control/v5/routing/JOURNAL-RULES.md`

- [ ] **Step 1: Write `control/v5/routing/PIPELINE.md`**

Content (verbatim):

```markdown
# v5 Pipeline

Stages, in order, for a regular feature:

| Stage | Produces | Phase gate |
|-------|----------|------------|
| brainstorm | `braindump.md`, optional research → `ux-flow.html` | — |
| ux | UX decisions in `decisions.json` (phase `ux`) | must complete before `ui` |
| ui | UI decisions + `layout/wireframes/*.html` (phase `ui`) | must complete before `architecture` |
| architecture | architecture decisions (phase `architecture`) | must complete before `build` |
| build | code against `phases/phase-N.md`, MVVM-enforced | gated by `canAdvance` |
| validate | tests + e2e gate per `BUILD-GATES.md` | advances phase or marks complete |

Tech-stack features (`status.json.featureType === "tech-stack"`) skip `ux`/`ui`
and start at `architecture`.

The orchestrator never stops between stages; it reads disk, resolves a route
(`lib/v5/mc-router.mjs`), dispatches a narrow subagent, then advances via
`lib/v5/decision-gate.mjs`. There is no static dashboard to regenerate — surface
state with `openDashboard(...)` from `lib/v5/auto-launch.mjs`.
```

- [ ] **Step 2: Write `control/v5/routing/DATA-RULES.md`**

```markdown
# v5 Data Rules

**Golden rule: add, never erase.** Subagents append to journals and update only
their own feature's `status.json`. Never delete sibling features or decisions.

- `control/v5/state.json` — `{ version, activeFeature, features: [{ slug, stage,
  currentPhase }], updatedAt }`. Mutate only via `lib/v5/state.mjs`
  (`upsertFeature`, `setActiveFeature`) — atomic tmp+rename.
- `control/v5/features/{slug}/status.json` — `{ slug, stage, currentPhase,
  featureType?, description, lastUpdatedAt, tasks? }`. Patch in place; keep
  `state.json`'s matching entry in sync via `upsertFeature`.
- `control/v5/features/{slug}/decisions.json` — mutate only via
  `lib/v5/decisions.mjs`. Never hand-write decision card HTML; use
  `node lib/v5/cli/build-decision.mjs <slug> <id>`.
- `controlRoot` passed to any `lib/v5/*` API is the PROJECT ROOT (the directory
  containing `control/v5/`), never `control/v5/` itself.
```

- [ ] **Step 3: Write `control/v5/routing/JOURNAL-RULES.md`**

```markdown
# v5 Journal Rules

Journals live at `control/v5/features/{slug}/journal/NNN-<step>.md` (zero-padded
sequence). One file per subagent task. Required frontmatter:

```
---
step: <stage or task id>
subagent: <skill name>
status: DONE | BLOCKED
feature: <slug>
completedAt: <ISO-8601>
---
```

Body: what was done, files touched, decisions/commits, and (if BLOCKED) the
blocker. Append only — never rewrite a prior entry.
```

- [ ] **Step 4: Sanity check the docs render**

Run: `node -e "import('./lib/v5/feature-docs.mjs')"` (smoke import; no error).
Manually confirm the three files exist: `node -e "for (const f of ['PIPELINE','DATA-RULES','JOURNAL-RULES']) console.log(require('fs').existsSync('control/v5/routing/'+f+'.md'))"`
Expected: three `true` lines.

- [ ] **Step 5: Commit**

```bash
git add control/v5/routing/PIPELINE.md control/v5/routing/DATA-RULES.md control/v5/routing/JOURNAL-RULES.md
git commit -m "docs(v5): port pipeline/data/journal rules into control/v5/routing"
```

---

## Phase C — Rewrite the skills (v5-native, fold in `mc-v5*`, zero duplication)

> **Editing rule for every skill task below:** apply the spec §4 substitution
> table. Replace, in the skill body: root `state.json`→`control/v5/state.json`;
> `techStackStatus`/`pipelineStage`/`buildOrder`/`phase`→`stage`/`currentPhase`/
> `featureType`; `features/{slug}`→`control/v5/features/{slug}`; reading
> `ROUTER.md`/`ORCHESTRATOR.md`/`PIPELINE.md`/`WORKSTREAMS.md`/
> `AGENT-DATA-RULES.md`/`CONTEXT-PACKETS.md`→`resolveRoute` + `control/v5/routing/*`;
> "regenerate dashboard"/`dashboard.html`→`openDashboard(...)`;
> `HANDOFF.md`→`buildPickupPrompt(...)`; "MUST invoke `mission-control`"→removed.
> Each skill keeps its YAML frontmatter `name:` and a one-line `description:`.
>
> **Source of truth is `skills/<name>/SKILL.md`.** Do NOT edit `claude-skills/`
> by hand — it is regenerated in Phase D.
>
> **Verification after each task:** `node scripts/check-no-v4-markers.mjs skills/<name>`
> (the script is built in Task 7) must report 0 violations for the edited skill,
> and the skill body must still describe its job end-to-end.

### Task 7: Build the v4-marker scanner script (progress gate)

**Files:**
- Create: `scripts/check-no-v4-markers.mjs`

> Standalone scanner used as a progress tracker during rewrites. It is converted
> into a hard `node --test` assertion in Phase D (Task 21) once all skills are clean.

- [ ] **Step 1: Implement the scanner**

```js
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
```

- [ ] **Step 2: Run it to see the starting offender list**

Run: `node scripts/check-no-v4-markers.mjs skills`
Expected: a long list (the current v4 skills) and exit 1. This is the worklist for Phase C.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-no-v4-markers.mjs
git commit -m "chore: add v4-marker scanner for skill rewrites"
```

---

### Task 8: Rewrite the hub — `skills/mc` (absorb `mc-v5`, delete `mc-v5` + `mission-control`)

**Files:**
- Modify/replace: `skills/mc/SKILL.md`
- Delete: `skills/mc-v5/SKILL.md`, `skills/mc-v5/parallel-execution.md` (move content), `skills/mission-control/SKILL.md`
- Move: `skills/mc-v5/parallel-execution.md` → `skills/mc/parallel-execution.md`

- [ ] **Step 1: Replace `skills/mc/SKILL.md` with the v5 hub**

Base it on the current `skills/mc-v5/SKILL.md` body (the well-formed v5 hub), with these changes:
- Frontmatter `name: mc`, description: `"Mission Control — orchestrator hub. Reads status/decisions from control/v5/, resolves routes via lib/v5/mc-router.mjs, enforces UX → UI → Architecture → Build via lib/v5/decision-gate.mjs. Usage: /mc"`.
- Remove the line "do NOT import or extend the v4 `mc` skill" (there is no v4 mc anymore).
- Add a **Subcommands** section mapping the user-facing entry skills it can hand off to: `init` (→ mc-init), `start` (→ mc-start), `feature <desc>` (→ mc-feature), `braindump` (→ mc-braindump), `resume <slug>` (read pickup), `portfolio` (→ mc-portfolio).
- Reference `control/v5/routing/PIPELINE.md`, `DATA-RULES.md`, `JOURNAL-RULES.md` instead of any v4 doc.
- Keep the decision-vs-clarifying-question routing rules and the visual-fragment rule verbatim (they are already v5-correct).

- [ ] **Step 2: Move parallel-execution doc**

```bash
git mv skills/mc-v5/parallel-execution.md skills/mc/parallel-execution.md
```
Update the reference in `skills/mc/SKILL.md` to `./parallel-execution.md`.

- [ ] **Step 3: Delete the folded-in skills**

```bash
git rm skills/mc-v5/SKILL.md skills/mission-control/SKILL.md
rmdir skills/mc-v5 2>/dev/null || true
```

- [ ] **Step 4: Verify no v4 markers in the hub**

Run: `node scripts/check-no-v4-markers.mjs skills/mc`
Expected: `No v4 markers found.`

- [ ] **Step 5: Commit**

```bash
git add -A skills/mc skills/mc-v5 skills/mission-control
git commit -m "feat(skills): make mc the v5 hub (absorb mc-v5, drop mission-control)"
```

---

### Task 9: Rewrite `skills/mc-init` (v5 tech-stack setup — the primary pain point)

**Files:**
- Modify: `skills/mc-init/SKILL.md`

- [ ] **Step 1: Rewrite the body**

New behavior:
1. Resolve `controlRoot` (project root). If `control/v5/state.json` already has a `tech-stack` feature, tell the user init is done and point to `/mc-feature`.
2. Run `detectStack({ projectRoot })` from `lib/v5/detect-stack.mjs`; summarize signals.
3. Ask (clarifying question, `AskUserQuestion`): existing codebase vs greenfield, pre-filled from `likelyExisting`.
4. Create the tech-stack feature: `node lib/v5/cli/new-feature.mjs <slug> --type tech-stack --description "<summary>"` (slug e.g. `tech-stack` or `platform`).
5. For greenfield, additionally ask for the main user-facing feature names and scaffold each via `new-feature.mjs` (regular type).
6. `openDashboard({ controlRoot })` and tell the user the URL.

Remove ALL v4: `detect-stack.mjs` under `docs/superpowers/control`, `techStackStatus`, `stack.json` writes via v4 paths, `LAYOUT-TARGETS.md`, `HANDOFF.md`, "regenerate dashboard", `_template/`.

- [ ] **Step 2: Verify**

Run: `node scripts/check-no-v4-markers.mjs skills/mc-init`
Expected: `No v4 markers found.`

- [ ] **Step 3: Commit**

```bash
git add skills/mc-init/SKILL.md
git commit -m "feat(skills): rewrite mc-init as v5 tech-stack setup"
```

---

### Task 10: Rewrite `skills/mc-braindump` (absorb `mc-v5-brainstorm`)

**Files:**
- Replace: `skills/mc-braindump/SKILL.md` (currently a v4 alias)
- Delete: `skills/mc-v5-brainstorm/SKILL.md`

- [ ] **Step 1: Replace `skills/mc-braindump/SKILL.md`**

Use the current `skills/mc-v5-brainstorm/SKILL.md` body (already v5-correct: scope → offer research → `patternsToUxFlow` → write `control/v5/features/{slug}/ux-flow.html` → fragments via `build-decision.mjs` → `openDashboard`). Changes:
- Frontmatter `name: mc-braindump`, description updated to mention `/mc-braindump`.
- If the feature folder doesn't exist yet, scaffold it first via `lib/v5/cli/new-feature.mjs <slug>`.
- Confirm no v4 markers (the brainstorm body is clean already; double-check).

- [ ] **Step 2: Delete the prototype**

```bash
git rm skills/mc-v5-brainstorm/SKILL.md
rmdir skills/mc-v5-brainstorm 2>/dev/null || true
```

- [ ] **Step 3: Verify**

Run: `node scripts/check-no-v4-markers.mjs skills/mc-braindump`
Expected: `No v4 markers found.`

- [ ] **Step 4: Commit**

```bash
git add -A skills/mc-braindump skills/mc-v5-brainstorm
git commit -m "feat(skills): make mc-braindump the v5 brainstorm flow"
```

---

### Task 11: Rewrite `skills/mc-feature`

**Files:**
- Modify: `skills/mc-feature/SKILL.md`

- [ ] **Step 1: Rewrite the body**

New behavior: derive slug from the description → scaffold via `lib/v5/cli/new-feature.mjs <slug> --description "..."` → set `activeFeature` → hand control to the `mc` hub to run the v5 pipeline (brainstorm → ux → ui → architecture → build → validate), dispatching `mc-braindump`, `mc-explore`, `mc-prd`, `mc-layout`/`mc-mock`, `mc-plan`/`mc-platform-plan`, `mc-build`, `mc-validate` via routed packets. Keep the vendor-skill check (`mc-setup-skills`) but reference `control/vendor/manifest.json`. Remove all v4 disk/doc refs.

- [ ] **Step 2: Verify + commit**

Run: `node scripts/check-no-v4-markers.mjs skills/mc-feature`
```bash
git add skills/mc-feature/SKILL.md
git commit -m "feat(skills): rewrite mc-feature for v5 scaffolding + pipeline"
```

---

### Task 12: Rewrite the subagent skills `mc-explore`, `mc-prd`, `mc-mock`

**Files:**
- Modify: `skills/mc-explore/SKILL.md`, `skills/mc-prd/SKILL.md`, `skills/mc-mock/SKILL.md`

- [ ] **Step 1: mc-explore** — write artifacts to `control/v5/features/{slug}/explore/` and journals to `control/v5/features/{slug}/journal/`; inputs come from the routed packet (no `CONTROL_ROOT` v4 token). 
- [ ] **Step 2: mc-prd** — keep "MUST invoke `prd-generator`"; write `spec.md` to `control/v5/features/{slug}/spec.md`; journal under v5 path; drop `layoutTargets`/v4 stack path (read tech-stack feature decisions instead).
- [ ] **Step 3: mc-mock** — write wireframes to `control/v5/features/{slug}/layout/wireframes/`; reference `control/v5/routing/UI-REQUIREMENTS.md`; capture UI choices via `mc-decide`, not ad-hoc HTML.
- [ ] **Step 4: Verify + commit**

Run: `node scripts/check-no-v4-markers.mjs skills/mc-explore skills/mc-prd skills/mc-mock`
```bash
git add skills/mc-explore/SKILL.md skills/mc-prd/SKILL.md skills/mc-mock/SKILL.md
git commit -m "feat(skills): rewrite mc-explore/mc-prd/mc-mock for v5 paths"
```

---

### Task 13: Rewrite `mc-layout`

**Files:**
- Modify: `skills/mc-layout/SKILL.md`

- [ ] **Step 1:** UI phase entry: read the feature's `decisions.json` + `control/v5/routing/UI-REQUIREMENTS.md`; produce wireframes under `control/v5/features/{slug}/layout/wireframes/`; record UI decisions through `mc-decide`; `openDashboard({ slug, anchor: 'ui' })`. Drop `stack.json` `layoutTargets` / `LAYOUT-TARGETS.md` / `CATALOG.md` v4 references (read tech-stack decisions for target platforms).
- [ ] **Step 2: Verify + commit**

Run: `node scripts/check-no-v4-markers.mjs skills/mc-layout`
```bash
git add skills/mc-layout/SKILL.md
git commit -m "feat(skills): rewrite mc-layout for v5 UI phase"
```

---

### Task 14: Rewrite `mc-plan` and `mc-platform-plan`

**Files:**
- Modify: `skills/mc-plan/SKILL.md`, `skills/mc-platform-plan/SKILL.md`

- [ ] **Step 1: mc-plan** — read `spec.md` + decisions + `control/v5/routing/BUILD-GATES.md` + `ARCHITECTURE-MVVM.md`; write `control/v5/features/{slug}/phases/phase-N.md`; populate `status.json.tasks[]`; each task block names `Layer: Model|View|ViewModel|N/A`; invoke `superpowers:writing-plans`. Drop `state.json` v4 merges, `HANDOFF.md`, dashboard regen.
- [ ] **Step 2: mc-platform-plan** — same, but writes all platform phase plans in one pass for naming consistency; reads target platforms from the tech-stack feature's decisions.
- [ ] **Step 3: Verify + commit**

Run: `node scripts/check-no-v4-markers.mjs skills/mc-plan skills/mc-platform-plan`
```bash
git add skills/mc-plan/SKILL.md skills/mc-platform-plan/SKILL.md
git commit -m "feat(skills): rewrite mc-plan/mc-platform-plan for v5 phases"
```

---

### Task 15: Rewrite `mc-build` (absorb `mc-v5-build`)

**Files:**
- Replace: `skills/mc-build/SKILL.md`
- Delete: `skills/mc-v5-build/SKILL.md`

- [ ] **Step 1:** Use `skills/mc-v5-build/SKILL.md` as the base (MVVM enforcement, fragment preflight, build route). Scrub its v4 residue: remove `docs/superpowers/control/AGENT-DATA-RULES.md`, `IMPLEMENTATION_RULES.md`, `HANDOFF.md`, `state.json.activeWorkstream`, "regenerate dashboard", "MUST invoke `mission-control`", and "This skill REPLACES `mc-build`". Reference `control/v5/routing/DATA-RULES.md`, `BUILD-GATES.md`, `ARCHITECTURE-MVVM.md`. Read/patch only `control/v5/features/{slug}/status.json`; surface via `openDashboard`. Keep the per-task loop, MVVM lint, and preflight.
- [ ] **Step 2: Delete the prototype**

```bash
git rm skills/mc-v5-build/SKILL.md
rmdir skills/mc-v5-build 2>/dev/null || true
```

- [ ] **Step 3: Verify + commit**

Run: `node scripts/check-no-v4-markers.mjs skills/mc-build`
```bash
git add -A skills/mc-build skills/mc-v5-build
git commit -m "feat(skills): make mc-build the v5 MVVM build loop"
```

---

### Task 16: Rewrite `mc-validate`

**Files:**
- Modify: `skills/mc-validate/SKILL.md`

- [ ] **Step 1:** Gate via `canAdvance`/`nextPhase` (`lib/v5/decision-gate.mjs`) + `control/v5/routing/BUILD-GATES.md`; run unit/integration/e2e; save e2e screenshots under `control/v5/features/{slug}/artifacts/phase-N/{platform}/`; patch `status.json`; `openDashboard`; continue the pipeline (next phase plan/build or mark complete). Drop `IMPLEMENTATION_RULES.md`, `E2E-TOOLS.md` v4 paths, `state.json.captureE2eScreenshots` v4 field (move the flag onto `status.json` if needed), dashboard regen.
- [ ] **Step 2: Verify + commit**

Run: `node scripts/check-no-v4-markers.mjs skills/mc-validate`
```bash
git add skills/mc-validate/SKILL.md
git commit -m "feat(skills): rewrite mc-validate for v5 gates"
```

---

### Task 17: Rewrite `mc-portfolio` + `spec-portfolio-review` + `mc-refine`

**Files:**
- Modify: `skills/mc-portfolio/SKILL.md`, `skills/spec-portfolio-review/SKILL.md`, `skills/mc-refine/SKILL.md`

- [ ] **Step 1: mc-portfolio / spec-portfolio-review** — iterate `control/v5/features/*/`, read each `spec.md` + `status.json`, write the review to `control/v5/SPEC-PORTFOLIO-REVIEW.md`, persist build order by reordering `state.json.features[]` (via `lib/v5/state.mjs`) instead of a `buildOrder[]` field; `openDashboard`.
- [ ] **Step 2: mc-refine** — resume/refine a feature's decisions or `spec.md` in `control/v5`; route decisions through `mc-decide`; set `status.json.stage` appropriately; `openDashboard`. Drop `specStatus` v4 field.
- [ ] **Step 3: Verify + commit**

Run: `node scripts/check-no-v4-markers.mjs skills/mc-portfolio skills/spec-portfolio-review skills/mc-refine`
```bash
git add skills/mc-portfolio/SKILL.md skills/spec-portfolio-review/SKILL.md skills/mc-refine/SKILL.md
git commit -m "feat(skills): rewrite portfolio/refine for v5 disk"
```

---

### Task 18: Rewrite `mc-start`, `mc-handoff`, `session-handoff`; light-touch `mc-setup-skills`, `mc-upgrade`

**Files:**
- Modify: `skills/mc-start/SKILL.md`, `skills/mc-handoff/SKILL.md`, `skills/session-handoff/SKILL.md`, `skills/mc-setup-skills/SKILL.md`, `skills/mc-upgrade/SKILL.md`

- [ ] **Step 1: mc-start** — scaffold a new project: ensure `control/v5/` exists, run `mc-init` (tech-stack), then scaffold the first feature(s) via `new-feature.mjs`; vendor-skill check via `mc-setup-skills`; `openDashboard`. Drop `control/project/*` v4 layout, `projectStartStage`, `workflowType`.
- [ ] **Step 2: mc-handoff** — emit `buildPickupPrompt({ slug, stage })` from `lib/v5/build-pickup-prompt.mjs` plus a short chat summary; no `HANDOFF.md` file write.
- [ ] **Step 3: session-handoff** — replace the `{CONTROL_ROOT}/HANDOFF.md` reference with the v5 pickup-prompt mechanism; otherwise it stays a chat-only synthesis.
- [ ] **Step 4: mc-setup-skills** — change journal target from `control/journal/NNN-...` to `control/v5/features/{slug}/journal/` (or omit journaling when run standalone); reference `control/vendor/manifest.json`; drop `SKILL-DEPENDENCIES.md`.
- [ ] **Step 5: mc-upgrade** — ensure the "preserve user data" list names `control/v5/**` and the v5 install stamp; drop `HANDOFF.md`/`project/**` v4 entries.
- [ ] **Step 6: Verify + commit**

Run: `node scripts/check-no-v4-markers.mjs skills/mc-start skills/mc-handoff skills/session-handoff skills/mc-setup-skills skills/mc-upgrade`
```bash
git add skills/mc-start/SKILL.md skills/mc-handoff/SKILL.md skills/session-handoff/SKILL.md skills/mc-setup-skills/SKILL.md skills/mc-upgrade/SKILL.md
git commit -m "feat(skills): v5 rewrites for start/handoff/setup/upgrade"
```

---

### Task 19: Rename `mc-v5-decide` → `mc-decide`, `mc-v5-review` → `mc-review`

**Files:**
- Move: `skills/mc-v5-decide/SKILL.md` → `skills/mc-decide/SKILL.md`
- Move: `skills/mc-v5-review/SKILL.md` → `skills/mc-review/SKILL.md`

- [ ] **Step 1: Move both**

```bash
git mv skills/mc-v5-decide skills/mc-decide
git mv skills/mc-v5-review skills/mc-review
```

- [ ] **Step 2:** Update frontmatter `name:` (`mc-decide`, `mc-review`) and any in-body self-references / cross-references (e.g. `mc-v5-decide` → `mc-decide`). Both bodies are already v5-correct; just fix names and the `skills/mc-v5/parallel-execution.md` reference → `skills/mc/parallel-execution.md`.

- [ ] **Step 3:** Grep the whole `skills/` tree for stale `mc-v5` references and fix them:

Run: `node scripts/check-no-v4-markers.mjs skills` then also `grep -rn "mc-v5" skills` — expected: no `mc-v5` references remain.

- [ ] **Step 4: Commit**

```bash
git add -A skills/mc-decide skills/mc-review skills/mc-v5-decide skills/mc-v5-review
git commit -m "refactor(skills): rename mc-v5-decide/review to mc-decide/review"
```

---

## Phase D — Distribution: generate `claude-skills/` correctly + frontmatter + guards

### Task 20: Replace the skill build with a Node straight-copy

**Files:**
- Create: `scripts/build-claude-skills.mjs`
- Modify: `scripts/build-claude-skills.ps1` (make it a thin wrapper calling node), `scripts/sync-claude-skills.ps1`
- Modify: `lib/mc-upgrade.mjs` (call the new build during the claude sync, if appropriate)

- [ ] **Step 1: Implement `scripts/build-claude-skills.mjs`**

```js
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
```

- [ ] **Step 2: Replace `scripts/build-claude-skills.ps1` body with a wrapper**

```powershell
# Build claude-skills/ from skills/ via the cross-platform Node builder.
$KitRoot = Split-Path -Parent $PSScriptRoot
& node (Join-Path $KitRoot 'scripts/build-claude-skills.mjs')
```

- [ ] **Step 3: Regenerate**

Run: `node scripts/build-claude-skills.mjs`
Expected: `Built N skills in claude-skills/` (N = number of `skills/` dirs).

- [ ] **Step 4: Commit**

```bash
git add scripts/build-claude-skills.mjs scripts/build-claude-skills.ps1 scripts/sync-claude-skills.ps1 claude-skills
git commit -m "build: generate claude-skills/ as a straight copy of skills/"
```

---

### Task 21: Add the sync + no-v4-markers regression tests

**Files:**
- Create: `tests/skills-sync.test.mjs`
- Create: `tests/skills-no-v4-markers.test.mjs`

- [ ] **Step 1: Write `tests/skills-sync.test.mjs`**

```js
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
```

- [ ] **Step 2: Write `tests/skills-no-v4-markers.test.mjs`**

```js
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
```

- [ ] **Step 3: Run both**

Run: `node --test tests/skills-sync.test.mjs tests/skills-no-v4-markers.test.mjs`
Expected: PASS. If the marker test fails, fix the offending skill bodies (do not relax the list).

- [ ] **Step 4: Commit**

```bash
git add tests/skills-sync.test.mjs tests/skills-no-v4-markers.test.mjs
git commit -m "test: guard skills sync + v5-native skill bodies"
```

---

### Task 22: Give every command file frontmatter; align command → skill names

**Files:**
- Modify: all `commands/mc*.md`
- Rename: `commands/mc-v5.md` → fold into `commands/mc.md`; `commands/mc-v5-resume.md` → `commands/mc-resume.md`
- Create as needed: `commands/mc-decide.md` is internal (no command), `commands/mc-review.md` internal (no command)

- [ ] **Step 1:** Ensure each user-facing command file starts with valid YAML frontmatter:

```markdown
---
name: mc-init
description: "..."
---
```

Confirm: `mc.md`, `mc-init.md`, `mc-braindump.md`, `mc-feature.md`, `mc-layout.md`, `mc-plan.md`, `mc-portfolio.md`, `mc-refine.md`, `mc-start.md`, `mc-handoff.md`, `mc-upgrade.md`, `mc-validate.md`, `mc-resume.md` each have frontmatter and an `Invoke skill: <name>` line pointing at the matching skill.

- [ ] **Step 2:** Fold `commands/mc-v5.md` content into `commands/mc.md` (hub) and rename resume:

```bash
git mv commands/mc-v5-resume.md commands/mc-resume.md
git rm commands/mc-v5.md
```
Update `commands/mc.md` to invoke skill `mc` and `commands/mc-resume.md` to invoke skill `mc`.

- [ ] **Step 3: Regenerate claude-skills and re-run sync test**

Run: `node scripts/build-claude-skills.mjs && node --test tests/skills-sync.test.mjs`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A commands claude-skills
git commit -m "build: frontmatter on all commands; rename mc-v5 commands to mc/mc-resume"
```

---

## Phase E — Delete the v4 docs

### Task 23: Remove v4 orchestration docs + v4 static dashboard

**Files:**
- Delete (confirm each has no remaining reader first): `control/ROUTER.md`, `control/ORCHESTRATOR.md`, `control/PIPELINE.md`, `control/WORKSTREAMS.md`, `control/AGENT-DATA-RULES.md`, `control/JOURNAL-RULES.md`, `control/ADD-FEATURE-PIPELINE.md`, `control/SKILL-DEPENDENCIES.md`, `control/CONTEXT-PACKETS.md`, `control/SESSION-INTENT.md`, `control/RESEARCH-LAYOUT.md`, `control/ORCHESTRATOR-CONTROLS.md`, `control/WORKFLOW-CONTROLS.md`, `control/PROJECT-START-PIPELINE.md`, `control/SPEC-PORTFOLIO-REVIEW.md`, `control/tech-stack/LAYOUT-TARGETS.md`, `control/dashboard.html`, `control/scripts/dashboard-guide.mjs`

- [ ] **Step 1: Confirm no readers remain**

Run: `grep -rIl -E "ROUTER\.md|ORCHESTRATOR\.md|ADD-FEATURE-PIPELINE\.md|WORKSTREAMS\.md|AGENT-DATA-RULES\.md|CONTEXT-PACKETS\.md|SKILL-DEPENDENCIES\.md|dashboard-guide\.mjs|control/dashboard\.html" skills lib scripts control commands tests`
Expected: no hits outside the files being deleted themselves. Investigate any hit before deleting.

- [ ] **Step 2: Delete**

```bash
git rm control/ROUTER.md control/ORCHESTRATOR.md control/PIPELINE.md control/WORKSTREAMS.md \
  control/AGENT-DATA-RULES.md control/JOURNAL-RULES.md control/ADD-FEATURE-PIPELINE.md \
  control/SKILL-DEPENDENCIES.md control/CONTEXT-PACKETS.md control/SESSION-INTENT.md \
  control/RESEARCH-LAYOUT.md control/ORCHESTRATOR-CONTROLS.md control/WORKFLOW-CONTROLS.md \
  control/PROJECT-START-PIPELINE.md control/SPEC-PORTFOLIO-REVIEW.md \
  control/tech-stack/LAYOUT-TARGETS.md control/dashboard.html control/scripts/dashboard-guide.mjs
```
(Adjust the list to only files that actually exist — `ls` first.)

- [ ] **Step 3: Run the full suite to catch any broken reference**

Run: `node --test tests/v5-*.test.mjs tests/skills-*.test.mjs`
Expected: PASS. Fix any test that referenced a deleted v4 path.

- [ ] **Step 4: Commit**

```bash
git add -A control
git commit -m "chore: delete v4 orchestration docs and static dashboard"
```

---

## Phase F — Documentation surfaces

### Task 24: Refresh the dashboard "How to use" panel

**Files:**
- Modify: `control/scripts/v5/render-dashboard.mjs` (the `SLASH_COMMANDS`, `BUNDLED_SKILLS`, `WORKFLOWS` arrays ~lines 262–343, and the empty-state string ~line 112)

- [ ] **Step 1: Update `SLASH_COMMANDS`** to the unified v5 set (no `/mc-v5*`):

```js
const SLASH_COMMANDS = [
  { cmd: '/mc', desc: 'Orchestrator hub. Reads disk, resolves routes, runs the pipeline.' },
  { cmd: '/mc-start', desc: 'Start a new project: establish tech stack and seed the first features.' },
  { cmd: '/mc-init', desc: 'Establish tech-stack context as a tech-stack feature. Run once per project.' },
  { cmd: '/mc-feature', desc: 'Add a new feature: scaffolds control/v5/features/{slug}/ and runs the pipeline.' },
  { cmd: '/mc-braindump', desc: 'Brainstorm a feature: offer research, build a UX flow, open the dashboard.' },
  { cmd: '/mc-refine', desc: 'Resume or refine a feature’s decisions or spec.' },
  { cmd: '/mc-layout', desc: 'UI phase: wireframes for the active feature.' },
  { cmd: '/mc-plan', desc: 'Generate phased, MVVM-labelled task plans from the spec + decisions.' },
  { cmd: '/mc-portfolio', desc: 'Cross-feature review: overlap, dependencies, build order.' },
  { cmd: '/mc-build', desc: 'Subagent-driven build with MVVM enforcement.' },
  { cmd: '/mc-validate', desc: 'Phase gate: tests + e2e before advancing.' },
  { cmd: '/mc-handoff', desc: 'Emit a pickup prompt + summary before /clear.' },
  { cmd: '/mc-resume <slug>', desc: 'Resume a feature from disk (status.json + decisions.json).' },
  { cmd: '/mc-upgrade', desc: 'Safe kit upgrade. Runs migrations, preserves control/v5 data.' },
];
```

- [ ] **Step 2: Update `WORKFLOWS`** to v5 sequences (replace `/mc-v5*`):

```js
// e.g.
{ title: 'New project', sequence: ['/mc-start', '/mc-init', '/mc-feature (per feature)'] },
{ title: 'One feature', sequence: ['/mc-feature', '/mc-braindump', '/mc-layout', '/mc-plan', '/mc-build', '/mc-validate'] },
{ title: 'Resume later', sequence: ['/mc-handoff', '/clear', '(new session) /mc-resume <slug>'] },
```

- [ ] **Step 3:** Fix the empty-state string (line ~112): `start a feature with <code>/mc-v5</code>` → `<code>/mc</code>`. Update `BUNDLED_SKILLS` descriptions that say "Auto-invoked by /mc-start" only if the trigger changed (keep accurate).

- [ ] **Step 4: Verify the dashboard renders**

Run: `node --test tests/v5-dashboard-render.test.mjs`
Expected: PASS. If a test asserts on old command text, update the assertion to the v5 set.

- [ ] **Step 5: Commit**

```bash
git add control/scripts/v5/render-dashboard.mjs tests/v5-dashboard-render.test.mjs
git commit -m "docs(dashboard): refresh How-to-use panel to the v5 command set"
```

---

### Task 25: Update `User-Guide.html` + `install.ps1` path rewrites

**Files:**
- Modify: `User-Guide.html`
- Modify: `install.ps1` (`Publish-UserGuide`); confirm `install.sh` counterpart

- [ ] **Step 1: User-Guide.html** — update the command table (rows ~95–100) to the v5 set (`/mc`, `/mc-start`, `/mc-init`, `/mc-feature`, `/mc-portfolio`, `/mc-upgrade`); replace links to `control/dashboard.html` (deleted) with a one-line "launch the live dashboard" instruction: `node mission-control-kit/control/scripts/v5/dashboard-server.mjs .`

- [ ] **Step 2: install.ps1 `Publish-UserGuide`** — it currently rewrites `href="control/"` → `href="docs/superpowers/control/"`. Update to the v5-native layout (drop the `docs/superpowers/` wrapping); since the guide now points at the live dashboard command rather than a static file, remove the `control/dashboard.html` rewrite entirely. Mirror the change in `install.sh` if it does the same rewrite.

- [ ] **Step 3: Smoke check the guide opens** and shows the v5 commands (open `User-Guide.html` in a browser, or grep):

Run: `grep -n "/mc-v5\|dashboard.html" User-Guide.html`
Expected: no hits.

- [ ] **Step 4: Commit**

```bash
git add User-Guide.html install.ps1 install.sh
git commit -m "docs: update User-Guide to the v5 command set + live dashboard"
```

---

## Phase G — Final verification

### Task 26: Full suite + dashboard smoke + marker sweep

- [ ] **Step 1: Run the whole test suite**

Run: `node --test tests/*.test.mjs`
Expected: all PASS (existing v5 suite + the new `v5-state`, `v5-feature-scaffold`, `v5-cli-new-feature`, `v5-detect-stack`, `skills-sync`, `skills-no-v4-markers`).

- [ ] **Step 2: Marker + mc-v5 sweep across the repo**

Run: `node scripts/check-no-v4-markers.mjs skills && grep -rn "mc-v5" skills commands claude-skills control/scripts/v5 || echo "clean"`
Expected: `No v4 markers found.` and `clean`.

- [ ] **Step 3: Dashboard smoke**

Run: `node control/scripts/v5/dashboard-server.mjs sample-project &` then open the printed URL; confirm the "How to use" panel lists the v5 commands and a feature page renders. Stop the server afterward.

- [ ] **Step 4: Confirm a fresh feature scaffolds end-to-end**

Run:
```bash
node lib/v5/cli/new-feature.mjs demo-feature --control-root sample-project
node -e "import('./lib/v5/state.mjs').then(m=>m.readState({controlRoot:'sample-project'})).then(s=>console.log(s.features.map(f=>f.slug)))"
```
Expected: `demo-feature` appears; its `status.json` + `decisions.json` exist. Then revert the sample-project change: `git checkout sample-project`.

- [ ] **Step 5: Final commit / branch ready for review**

```bash
git status   # clean working tree
git log --oneline -25
```

---

## Self-review notes (spec coverage)

- Spec §1 (both failure layers) → Phase D (distribution) + Phase C (content).
- Spec §3 gap (no feature creation) → Phase A Tasks 2–5 + CLI.
- Spec §4 canonical set / fold-in / deletions → Phase C Tasks 8–19.
- Spec §5 plumbing → Phase A.
- Spec §6 distribution → Phase D.
- Spec §7 v4 doc deletion (+ ported rules) → Phase B (port) + Phase E (delete).
- Spec §8 doc surfaces → Phase F.
- Spec §9 tests → Tasks 1–5 (unit), 21 (sync + marker), 26 (full).
- Spec §10 build order → Phases A→G mirror it.
