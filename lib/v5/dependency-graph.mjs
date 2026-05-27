/**
 * v5 dependency graph analyzer.
 *
 * Implements the orchestrator-side helper for §11 (Parallel Execution by
 * Default) of `docs/REFACTOR-REQUIREMENTS.md`.
 *
 * Given a list of tasks, decide which can run together. Tasks are objects of
 * the form:
 *
 *   { id: string,
 *     name?: string,
 *     files?: string[],      // exact paths (no globs in v1)
 *     dependsOn?: string[] }  // ids of tasks that must finish first
 *
 * Two tasks are forced into different batches when:
 *   - one explicitly `dependsOn` the other (transitive ok), OR
 *   - they share at least one file path.
 *
 * Read-only tasks (`files: []` and no dependsOn) can always batch together.
 *
 * Pure module — no I/O, no side effects.
 */

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} [name]
 * @property {string[]} [files]
 * @property {string[]} [dependsOn]
 */

/**
 * @typedef {Object} AnalyzeResult
 * @property {string[][]} parallel  - Ordered batches of task ids that can run together.
 * @property {string[]}   sequential - Flat order respecting dependencies (fallback).
 */

/**
 * Group tasks into parallel batches.
 *
 * @param {Task[]} tasks
 * @returns {AnalyzeResult}
 */
export function analyzeTasks(tasks) {
  if (!Array.isArray(tasks)) {
    throw new Error('analyzeTasks: tasks must be an array');
  }
  if (tasks.length === 0) {
    return { parallel: [], sequential: [] };
  }

  // 1. Index tasks by id, validating shape and uniqueness.
  const byId = new Map();
  for (const t of tasks) {
    if (!t || typeof t !== 'object') {
      throw new Error('analyzeTasks: each task must be an object');
    }
    if (typeof t.id !== 'string' || t.id.length === 0) {
      throw new Error('analyzeTasks: each task requires a non-empty string id');
    }
    if (byId.has(t.id)) {
      throw new Error(
        `analyzeTasks: duplicate task id "${t.id}" — task ids must be unique`,
      );
    }
    byId.set(t.id, t);
  }

  // 2. Validate dependsOn references point at known ids.
  for (const t of tasks) {
    const deps = Array.isArray(t.dependsOn) ? t.dependsOn : [];
    for (const dep of deps) {
      if (!byId.has(dep)) {
        throw new Error(
          `analyzeTasks: task "${t.id}" dependsOn unknown task "${dep}"`,
        );
      }
    }
  }

  // 3. Topological sort by explicit dependsOn only.
  //    File-overlap is NOT a true dependency direction (it's a mutex), so we
  //    handle it during batch-packing, not during topo sort.
  const sequential = topoSort(tasks);

  // 4. Pack tasks into batches:
  //    - A task lands in the earliest batch where:
  //        (a) all its dependsOn predecessors live in strictly earlier batches, AND
  //        (b) no task already in that batch shares a file with it.
  //    - Iterate `sequential` so predecessors are placed first.
  const batchOf = new Map(); // id -> batch index
  const batches = []; // batches[i] = { ids: string[], files: Set<string> }

  for (const id of sequential) {
    const t = byId.get(id);
    const files = Array.isArray(t.files) ? t.files : [];
    const deps = Array.isArray(t.dependsOn) ? t.dependsOn : [];

    // Earliest batch allowed by dependsOn (one past max predecessor batch).
    let minBatch = 0;
    for (const dep of deps) {
      const depBatch = batchOf.get(dep);
      if (depBatch !== undefined && depBatch + 1 > minBatch) {
        minBatch = depBatch + 1;
      }
    }

    // Walk from minBatch upward, looking for one without a file conflict.
    let placed = -1;
    for (let i = minBatch; i < batches.length; i += 1) {
      if (!batchHasFileConflict(batches[i], files)) {
        placed = i;
        break;
      }
    }
    if (placed === -1) {
      // Open a new batch.
      batches.push({ ids: [], files: new Set() });
      placed = batches.length - 1;
    }

    batches[placed].ids.push(id);
    for (const f of files) batches[placed].files.add(f);
    batchOf.set(id, placed);
  }

  return {
    parallel: batches.map((b) => b.ids),
    sequential,
  };
}

/**
 * Find every pair of tasks that share at least one file.
 *
 * @param {Task[]} tasks
 * @returns {{taskA: string, taskB: string, files: string[]}[]}
 */
export function detectFileConflicts(tasks) {
  if (!Array.isArray(tasks)) {
    throw new Error('detectFileConflicts: tasks must be an array');
  }
  const conflicts = [];
  for (let i = 0; i < tasks.length; i += 1) {
    const a = tasks[i];
    const aFiles = new Set(Array.isArray(a?.files) ? a.files : []);
    if (aFiles.size === 0) continue;
    for (let j = i + 1; j < tasks.length; j += 1) {
      const b = tasks[j];
      const bFiles = Array.isArray(b?.files) ? b.files : [];
      const shared = [];
      for (const f of bFiles) {
        if (aFiles.has(f)) shared.push(f);
      }
      if (shared.length > 0) {
        conflicts.push({ taskA: a.id, taskB: b.id, files: shared });
      }
    }
  }
  return conflicts;
}

// ---------- internals ----------

function batchHasFileConflict(batch, files) {
  if (!files || files.length === 0) return false;
  for (const f of files) {
    if (batch.files.has(f)) return true;
  }
  return false;
}

/**
 * Kahn's algorithm topological sort by `dependsOn`.
 * Throws if a cycle is detected.
 *
 * Returns ids in an order where every dependency appears before its dependents.
 * Ties are broken by original input order for stability.
 */
function topoSort(tasks) {
  const inDegree = new Map();
  const dependents = new Map(); // dep -> [tasks that depend on it]
  const inputOrder = new Map();

  tasks.forEach((t, idx) => {
    inputOrder.set(t.id, idx);
    if (!inDegree.has(t.id)) inDegree.set(t.id, 0);
    if (!dependents.has(t.id)) dependents.set(t.id, []);
  });

  for (const t of tasks) {
    const deps = Array.isArray(t.dependsOn) ? t.dependsOn : [];
    for (const dep of deps) {
      inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
      const list = dependents.get(dep) ?? [];
      list.push(t.id);
      dependents.set(dep, list);
    }
  }

  // Seed queue with all zero-in-degree tasks, in original input order.
  const queue = [];
  for (const t of tasks) {
    if ((inDegree.get(t.id) ?? 0) === 0) queue.push(t.id);
  }
  queue.sort((a, b) => inputOrder.get(a) - inputOrder.get(b));

  const sorted = [];
  while (queue.length > 0) {
    const id = queue.shift();
    sorted.push(id);
    const next = dependents.get(id) ?? [];
    // Track which ids become ready in this step so we can keep stable order.
    const newlyReady = [];
    for (const dep of next) {
      const remaining = (inDegree.get(dep) ?? 0) - 1;
      inDegree.set(dep, remaining);
      if (remaining === 0) newlyReady.push(dep);
    }
    newlyReady.sort((a, b) => inputOrder.get(a) - inputOrder.get(b));
    queue.push(...newlyReady);
  }

  if (sorted.length !== tasks.length) {
    const unresolved = tasks
      .map((t) => t.id)
      .filter((id) => !sorted.includes(id));
    throw new Error(
      `analyzeTasks: dependency cycle detected involving: ${unresolved.join(', ')}`,
    );
  }

  return sorted;
}

export default analyzeTasks;
