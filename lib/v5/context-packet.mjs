/**
 * v5 context packet builder.
 *
 * Takes a resolved route from `lib/v5/mc-router.mjs` and produces a plain
 * object suitable for handing to a subagent dispatch (see
 * `docs/v5-diagrams/01-document-routing.html` "Example Context Packet").
 *
 * Design notes:
 * - We never read full file contents here; that's the subagent's job.
 * - Missing files emit a console.warn and are flagged with `exists: false`,
 *   never thrown.
 * - If the route is deferred, we short-circuit with an empty docs[] but still
 *   surface `instructions[]` so the orchestrator sees the visual-fragment
 *   contract even when the dispatch is refused.
 *
 * No external dependencies — stdlib only.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { UNIVERSAL_INSTRUCTIONS } from './mc-router.mjs';

/**
 * Resolve a possibly-repo-relative doc path against the project root used by
 * the dispatcher. If the caller passed an absolute path, return it as-is.
 */
function absolutize(docPath, projectRoot) {
  if (!projectRoot) return docPath;
  if (path.isAbsolute(docPath)) return docPath;
  return path.join(projectRoot, docPath);
}

/**
 * Check whether a file or directory exists at the given absolute path. Used
 * to flag missing docs so the orchestrator can warn the user without aborting
 * the dispatch.
 */
async function checkExists(absPath) {
  try {
    await fs.stat(absPath);
    return true;
  } catch (err) {
    if (err && err.code === 'ENOENT') return false;
    throw err;
  }
}

/**
 * Build a dispatch packet for a subagent.
 *
 * @param {Object} args
 * @param {string} args.task - Short description of the task ("Build the settings panel layout").
 * @param {Object} args.route - Result from `resolveRoute(...)`.
 * @param {('ux'|'ui'|'architecture'|'build')} args.stage - Current pipeline stage.
 * @param {string} args.slug - Feature slug.
 * @param {string} [args.controlRoot] - Project root used to resolve relative doc paths. Should be the directory that CONTAINS `control/v5/`.
 * @returns {Promise<{task:string, stage:string, slug:string, route:{taskType:string, docs:Array}, instructions:string[], deferred:boolean, deferredReason:string|null}>}
 */
export async function buildPacket({ task, route, stage, slug, controlRoot = null } = {}) {
  if (!route || typeof route !== 'object') {
    throw new Error('buildPacket: route is required (pass result of resolveRoute)');
  }

  // Deferred routes return early — no docs to load. The route's usageNote
  // still propagates into instructions[] so the orchestrator sees the
  // visual-fragment contract even when the dispatch is refused.
  if (route.deferred) {
    return {
      task: typeof task === 'string' ? task : '',
      stage: stage || null,
      slug: slug || null,
      route: { taskType: route.taskType, docs: [] },
      instructions: buildInstructions(route),
      deferred: true,
      deferredReason: route.deferredReason || null,
    };
  }

  const enrichedDocs = [];
  for (const doc of route.docs || []) {
    const abs = absolutize(doc.path, controlRoot);
    let exists = false;
    try {
      exists = await checkExists(abs);
    } catch (err) {
      // Unexpected fs error — log and skip, don't throw.
      console.warn(`[context-packet] failed to stat ${abs}: ${err.message}`);
    }

    if (!exists) {
      console.warn(
        `[context-packet] doc not found, skipping: ${doc.path} (scope=${doc.scope}${doc.optional ? ', optional' : ''})`,
      );
    }

    enrichedDocs.push({
      path: doc.path,
      scope: doc.scope,
      optional: !!doc.optional,
      exists,
    });
  }

  return {
    task: typeof task === 'string' ? task : '',
    stage: stage || null,
    slug: slug || null,
    route: { taskType: route.taskType, docs: enrichedDocs },
    instructions: buildInstructions(route),
    deferred: false,
    deferredReason: null,
  };
}

/**
 * Build the `instructions[]` array surfaced on every dispatch packet.
 *
 * Order matters — the orchestrator reads instructions top-down and the
 * universal protocols (ask-user-question, etc.) need to land first so a
 * subagent that only skims the head of the packet still sees them:
 *
 *   1. UNIVERSAL_INSTRUCTIONS — apply to every route, every phase
 *      (e.g. "use AskUserQuestion when you need user input")
 *   2. The route's own `usageNote` — task-type-specific rule
 *      (e.g. visual fragment contract for decision-producing routes)
 */
function buildInstructions(route) {
  const out = [...UNIVERSAL_INSTRUCTIONS];
  if (route && typeof route.usageNote === 'string' && route.usageNote.length > 0) {
    out.push(route.usageNote);
  }
  return out;
}
