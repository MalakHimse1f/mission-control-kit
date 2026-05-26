/**
 * v5 router: maps task types to the documents a subagent needs.
 *
 * Implements §2 (Document Routing) and §9.4 (backtracking prevention) of
 * `docs/REFACTOR-REQUIREMENTS.md`. The shape is illustrated in
 * `docs/v5-diagrams/01-document-routing.html`.
 *
 * Design:
 * - The `TASK_TYPE_ROUTES` map is the single source of truth. Adding a new
 *   task type only requires extending this map.
 * - Each route is an ordered list of `{ path, scope, optional }`. `path` may
 *   contain `{slug}` which is substituted at resolve time.
 * - `resolveRoute` returns paths only — it does not read files. Use
 *   `lib/v5/context-packet.mjs` to load and size content.
 * - When `stage` is `ux` or `ui` and the requested taskType is `architecture`,
 *   the route is deferred (no docs returned) to prevent backtracking into
 *   architecture decisions while UX/UI are still being explored. §9 of
 *   `docs/REFACTOR-REQUIREMENTS.md` mandates strict UX → UI → Architecture →
 *   Build ordering.
 *
 * No external dependencies — stdlib only.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Canonical task type → route map.
 *
 * Each entry is an array of `{ path, scope, optional }`:
 *  - `path` is a repo-relative path. `{slug}` tokens are substituted by
 *    `resolveRoute` if a `slug` is provided.
 *  - `scope` is a short tag used in logging and UI display.
 *  - `optional` indicates the doc may not exist on disk (e.g., per-feature
 *    files that only appear after the feature has produced output).
 */
export const TASK_TYPE_ROUTES = Object.freeze({
  'ui-implementation': [
    { path: 'control/v5/routing/UI-REQUIREMENTS.md', scope: 'ui-requirements', optional: false },
    {
      path: 'control/layout/diagrams/ui-options/template.html',
      scope: 'ui-primitives',
      optional: false,
    },
    {
      path: 'control/v5/features/{slug}/layout/wireframes/',
      scope: 'wireframes',
      optional: true,
    },
  ],
  'ux-decisions': [
    { path: 'control/v5/routing/UX-PATTERNS.md', scope: 'ux-patterns', optional: false },
    {
      path: 'control/layout/diagrams/ux-flow/template.html',
      scope: 'ux-primitives',
      optional: false,
    },
    {
      path: 'control/v5/features/{slug}/ux-flow.html',
      scope: 'current-flow',
      optional: true,
    },
  ],
  architecture: [
    { path: 'control/v5/routing/ARCHITECTURE.md', scope: 'architecture', optional: false },
    { path: 'control/v5/tech-stack/stack.json', scope: 'stack', optional: true },
    {
      path: 'control/layout/diagrams/architecture/template.html',
      scope: 'architecture-primitives',
      optional: false,
    },
  ],
  research: [
    { path: 'control/v5/routing/UX-PATTERNS.md', scope: 'patterns', optional: false },
    {
      path: 'control/v5/features/{slug}/braindump.md',
      scope: 'user-spec',
      optional: true,
    },
  ],
  build: [
    {
      path: 'control/v5/features/{slug}/phases/',
      scope: 'phase-plans',
      optional: false,
    },
    { path: 'control/v5/routing/BUILD-GATES.md', scope: 'build-gates', optional: false },
    {
      path: 'control/v5/features/{slug}/spec.md',
      scope: 'spec',
      optional: true,
    },
  ],
  brainstorm: [
    { path: 'control/v5/routing/UX-PATTERNS.md', scope: 'patterns', optional: false },
    {
      path: 'control/v5/features/{slug}/braindump.md',
      scope: 'product-context',
      optional: true,
    },
  ],
});

/**
 * Return the list of supported task types.
 *
 * @returns {string[]}
 */
export function listTaskTypes() {
  return Object.keys(TASK_TYPE_ROUTES);
}

/**
 * §9.4: refuse to load architecture documents while UX or UI are still being
 * decided. The question/task is recorded as deferred so it can be re-raised in
 * the architecture phase. §9 enforces the strict order UX → UI → Architecture
 * → Build; architecture must not be loaded until UI is complete.
 */
function shouldDefer(taskType, stage) {
  if (taskType === 'architecture' && (stage === 'ux' || stage === 'ui')) {
    return {
      deferred: true,
      reason:
        `Architecture documents are not loaded during the ${stage} phase. ` +
        'The question will be deferred until the architecture phase ' +
        '(UX → UI → Architecture → Build).',
    };
  }
  return { deferred: false, reason: null };
}

/**
 * Substitute `{slug}` in a path. If `slug` is missing, return the path with
 * the literal `{slug}` token left in place and emit a console.warn.
 */
function substituteSlug(rawPath, slug, scope) {
  if (!rawPath.includes('{slug}')) return rawPath;
  if (!slug) {
    console.warn(
      `[mc-router] route doc "${scope}" requires {slug} but none was provided; leaving literal token in path: ${rawPath}`,
    );
    return rawPath;
  }
  return rawPath.replaceAll('{slug}', slug);
}

/**
 * Resolve `{slug}`-substituted path relative to controlRoot when controlRoot
 * is provided as an absolute project root, otherwise return as-is.
 */
function absolutizeForCheck(p, projectRoot) {
  if (!projectRoot) return p;
  if (path.isAbsolute(p)) return p;
  return path.join(projectRoot, p);
}

/**
 * Resolve a route: given a taskType (and optional stage/slug), return the
 * list of documents a subagent should load.
 *
 * @param {Object} args
 * @param {string} args.taskType - One of `listTaskTypes()`.
 * @param {('ux'|'ui'|'architecture'|'build')} [args.stage] - Current pipeline stage. Used for backtracking prevention.
 * @param {string} [args.slug] - Feature slug; substituted into `{slug}` placeholders.
 * @param {string} [args.controlRoot] - Absolute project root used by `verifyExists`. Should be the directory CONTAINING `control/v5/`, not `control/v5/` itself.
 * @param {boolean} [args.verifyExists=false] - If true, each doc gets an `exists` boolean determined by `fs.access`.
 * @returns {Promise<{taskType: string, stage: string|null, docs: Array<{path: string, scope: string, optional: boolean, exists?: boolean}>, deferred: boolean, deferredReason: string|null}>}
 *
 * @throws if `taskType` is not in `TASK_TYPE_ROUTES`.
 */
export async function resolveRoute({
  taskType,
  stage = null,
  slug = null,
  controlRoot = null,
  verifyExists = false,
} = {}) {
  if (!taskType || typeof taskType !== 'string') {
    throw new Error('resolveRoute: taskType must be a non-empty string');
  }
  const routes = TASK_TYPE_ROUTES[taskType];
  if (!routes) {
    throw new Error(
      `resolveRoute: unknown task type "${taskType}"; expected one of ${listTaskTypes().join('|')}`,
    );
  }

  const { deferred, reason } = shouldDefer(taskType, stage);
  if (deferred) {
    return {
      taskType,
      stage,
      docs: [],
      deferred: true,
      deferredReason: reason,
    };
  }

  const docs = [];
  for (const entry of routes) {
    const resolvedPath = substituteSlug(entry.path, slug, entry.scope);
    const doc = {
      path: resolvedPath,
      scope: entry.scope,
      optional: !!entry.optional,
    };
    if (verifyExists) {
      const abs = absolutizeForCheck(resolvedPath, controlRoot);
      try {
        await fs.access(abs);
        doc.exists = true;
      } catch {
        doc.exists = false;
      }
    }
    docs.push(doc);
  }

  return {
    taskType,
    stage,
    docs,
    deferred: false,
    deferredReason: null,
  };
}
