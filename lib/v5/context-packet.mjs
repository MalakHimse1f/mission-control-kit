/**
 * v5 context packet builder.
 *
 * Takes a resolved route from `lib/v5/mc-router.mjs` and produces a plain
 * object suitable for handing to a subagent dispatch (see
 * `docs/v5-diagrams/01-document-routing.html` "Example Context Packet").
 *
 * Token estimation is intentionally cheap: we stat each file on disk and
 * estimate `Math.ceil(totalBytes / 4)` tokens. Directories are stat'ed
 * recursively (shallow, one level deep) so the wireframes/ folder still
 * contributes a rough size. Missing files emit a console.warn and are skipped.
 *
 * Design notes:
 * - Tokens are an order-of-magnitude estimate, not a guarantee.
 * - We never read full file contents here; that's the subagent's job.
 * - If the route is deferred, we short-circuit and return tokensEstimate: 0.
 *
 * No external dependencies — stdlib only.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/** Approximate token count from a byte count (1 token ≈ 4 chars). */
function bytesToTokens(bytes) {
  return Math.ceil(bytes / 4);
}

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
 * Stat a file or directory; return total bytes covered. For directories, sum
 * the sizes of immediate children (one level only — we don't recurse into
 * subdirectories to keep this cheap). Returns 0 if the entry doesn't exist.
 */
async function sizeOnDisk(absPath) {
  let stat;
  try {
    stat = await fs.stat(absPath);
  } catch (err) {
    if (err && err.code === 'ENOENT') return { exists: false, bytes: 0 };
    throw err;
  }
  if (stat.isFile()) return { exists: true, bytes: stat.size };
  if (stat.isDirectory()) {
    let total = 0;
    let entries;
    try {
      entries = await fs.readdir(absPath);
    } catch {
      return { exists: true, bytes: 0 };
    }
    for (const name of entries) {
      try {
        const childStat = await fs.stat(path.join(absPath, name));
        if (childStat.isFile()) total += childStat.size;
      } catch {
        // skip unreadable children
      }
    }
    return { exists: true, bytes: total };
  }
  return { exists: true, bytes: 0 };
}

/**
 * Build a dispatch packet for a subagent.
 *
 * @param {Object} args
 * @param {string} args.task - Short description of the task ("Build the settings panel layout").
 * @param {Object} args.route - Result from `resolveRoute(...)`.
 * @param {('ux'|'ui'|'architecture'|'build')} args.stage - Current pipeline stage.
 * @param {string} args.slug - Feature slug.
 * @param {string} [args.controlRoot] - Project root used to resolve relative doc paths for sizing. Should be the directory that CONTAINS `control/v5/`.
 * @returns {Promise<{task:string, stage:string, slug:string, route:{taskType:string, docs:Array}, tokensEstimate:number, deferred:boolean, deferredReason:string|null}>}
 */
export async function buildPacket({ task, route, stage, slug, controlRoot = null } = {}) {
  if (!route || typeof route !== 'object') {
    throw new Error('buildPacket: route is required (pass result of resolveRoute)');
  }

  // Deferred routes return early — no docs to load, 0 tokens.
  if (route.deferred) {
    return {
      task: typeof task === 'string' ? task : '',
      stage: stage || null,
      slug: slug || null,
      route: { taskType: route.taskType, docs: [] },
      tokensEstimate: 0,
      deferred: true,
      deferredReason: route.deferredReason || null,
    };
  }

  let totalBytes = 0;
  const enrichedDocs = [];
  for (const doc of route.docs || []) {
    const abs = absolutize(doc.path, controlRoot);
    let bytes = 0;
    let exists = false;
    try {
      const result = await sizeOnDisk(abs);
      bytes = result.bytes;
      exists = result.exists;
    } catch (err) {
      // Unexpected fs error — log and skip, don't throw.
      console.warn(`[context-packet] failed to stat ${abs}: ${err.message}`);
    }

    if (!exists) {
      console.warn(
        `[context-packet] doc not found, skipping: ${doc.path} (scope=${doc.scope}${doc.optional ? ', optional' : ''})`,
      );
    } else {
      totalBytes += bytes;
    }

    enrichedDocs.push({
      path: doc.path,
      scope: doc.scope,
      optional: !!doc.optional,
      exists,
      bytes,
    });
  }

  return {
    task: typeof task === 'string' ? task : '',
    stage: stage || null,
    slug: slug || null,
    route: { taskType: route.taskType, docs: enrichedDocs },
    tokensEstimate: bytesToTokens(totalBytes),
    deferred: false,
    deferredReason: null,
  };
}
