/**
 * v5 MVVM boundary linter.
 *
 * Detects boundary violations in code that claims to follow the MVVM pattern
 * prescribed by control/v5/routing/ARCHITECTURE.md and §10 of
 * docs/REFACTOR-REQUIREMENTS.md.
 *
 * Two entry points:
 *   - lintMVVM(diff)  — scans unified diff text for *added* lines only.
 *                       Suitable for code-review hooks that only see a PR diff.
 *   - lintFiles({ root, files }) — reads files from disk, scans full contents,
 *                       and also runs feature-level checks (e.g. a view without
 *                       a sibling viewmodel).
 *
 * Violation types (each is a unique stable string):
 *   - view-imports-model     A *.view.* file imports from a *.model file.
 *   - view-has-data-fetch    A *.view.* file performs data fetching directly
 *                            (fetch, axios., await db., new XMLHttpRequest).
 *   - model-imports-view     A *.model.* file imports from a *.view file.
 *   - view-missing-viewmodel A *.view.{ts,tsx,jsx} exists with no sibling
 *                            *.viewmodel.{ts,tsx,jsx} in the same directory.
 *
 * Each violation has shape { file, line, type, message }.
 *
 * Detection is regex-based; this is intentionally not a real parser. The lint
 * is advisory — the spec reviewer should still make the final call.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

// File-name pattern helpers. Cover .ts, .tsx, .jsx (and .js for completeness on
// the View side because some React projects use plain .js files).
const VIEW_RE = /\.view\.(?:tsx?|jsx?)$/i;
const MODEL_RE = /\.model\.(?:tsx?|jsx?)$/i;
const VIEWMODEL_RE = /\.viewmodel\.(?:tsx?|jsx?)$/i;

// Import-source matchers. We pull the import specifier (single or double quote)
// out of any kind of import statement: `import x from 'y'`, `import 'y'`,
// `import('y')`, or `require('y')`.
const IMPORT_SOURCE_RE =
  /(?:import\s[^'"]*?from\s*|import\s*|require\s*\(\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;

// Data-fetching patterns inside Views. We deliberately accept false-positive
// risk over false-negative risk: even *mentioning* fetch/axios/db in a View is
// a smell.
const DATA_FETCH_RE = /\bfetch\s*\(|\baxios\s*\.|\bawait\s+db\s*\.|\bnew\s+XMLHttpRequest\s*\(/;

function isViewFile(file) {
  return VIEW_RE.test(file);
}
function isModelFile(file) {
  return MODEL_RE.test(file);
}

/**
 * Given an import specifier (the string inside the quotes), return its kind:
 *  - 'model'     if it ends in .model or /something.model
 *  - 'view'      if it ends in .view  or /something.view
 *  - 'viewmodel' if it ends in .viewmodel
 *  - 'other'     otherwise
 *
 * We strip extensions and any query/hash, since `.model.ts` may be referenced
 * as `./foo.model` (TS resolution) or `./foo.model.ts`.
 */
function classifyImportSpecifier(spec) {
  const clean = spec.replace(/[?#].*$/, '').replace(/\.(?:tsx?|jsx?|mjs|cjs)$/i, '');
  if (/\.viewmodel$/.test(clean)) return 'viewmodel';
  if (/\.model$/.test(clean)) return 'model';
  if (/\.view$/.test(clean)) return 'view';
  return 'other';
}

/**
 * Walk a multiline string and yield { line, text } for every line. Line is
 * 1-indexed. (Tiny helper to keep call sites readable.)
 */
function* eachLine(text) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    yield { line: i + 1, text: lines[i] };
  }
}

/**
 * Scan a single file's full content for violations. Returns an array of
 * violations (without the feature-level checks — those live in lintFiles).
 *
 * @param {string} file   relative path used for the `file` field in violations
 * @param {string} content
 * @returns {Array<{file:string, line:number, type:string, message:string}>}
 */
export function lintFileContent(file, content) {
  const violations = [];
  const isView = isViewFile(file);
  const isModel = isModelFile(file);
  if (!isView && !isModel) return violations;

  for (const { line, text } of eachLine(content)) {
    // Import-source checks.
    IMPORT_SOURCE_RE.lastIndex = 0;
    let match;
    while ((match = IMPORT_SOURCE_RE.exec(text)) !== null) {
      const spec = match[1];
      const kind = classifyImportSpecifier(spec);
      if (isView && kind === 'model') {
        violations.push({
          file,
          line,
          type: 'view-imports-model',
          message:
            `View "${file}" imports Model directly ("${spec}"). ` +
            `Views must go through a ViewModel — import from a *.viewmodel.* file instead.`,
        });
      }
      if (isModel && kind === 'view') {
        violations.push({
          file,
          line,
          type: 'model-imports-view',
          message:
            `Model "${file}" imports View "${spec}". ` +
            `Models must not depend on Views — only ViewModels may bridge layers.`,
        });
      }
    }

    // Data-fetch check (View only).
    if (isView && DATA_FETCH_RE.test(text)) {
      violations.push({
        file,
        line,
        type: 'view-has-data-fetch',
        message:
          `View "${file}" performs data fetching directly. ` +
          `Move fetch/axios/db calls into the ViewModel; the View should only render state and dispatch actions.`,
      });
    }
  }

  return violations;
}

/**
 * Parse a unified diff and return per-file added lines.
 *
 * Returns Map<filePath, Array<{ line: number, text: string }>> where `line` is
 * the line number in the post-image file.
 */
function parseUnifiedDiff(diff) {
  const byFile = new Map();
  if (!diff || typeof diff !== 'string') return byFile;
  const lines = diff.split(/\r?\n/);

  let currentFile = null;
  let postLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // `diff --git a/foo b/foo` — establish the file being changed.
    const gitHeader = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (gitHeader) {
      currentFile = gitHeader[2];
      continue;
    }
    // `+++ b/foo` — also establishes file (some diff producers omit the
    // `diff --git` line, e.g. plain `git diff --no-prefix` won't, but plain
    // `diff -u` will only emit +++/---).
    const plusHeader = line.match(/^\+\+\+\s+(?:b\/)?(.+?)(?:\s|$)/);
    if (plusHeader && plusHeader[1] !== '/dev/null') {
      currentFile = plusHeader[1];
      continue;
    }
    if (line.startsWith('--- ')) continue;

    // Hunk header: @@ -a,b +c,d @@
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      postLine = parseInt(hunk[1], 10);
      continue;
    }

    if (!currentFile) continue;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      const list = byFile.get(currentFile) || [];
      list.push({ line: postLine, text: line.slice(1) });
      byFile.set(currentFile, list);
      postLine += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      // Removed lines don't advance the post-image line counter.
    } else if (line.startsWith(' ')) {
      postLine += 1;
    }
  }

  return byFile;
}

/**
 * Lint a unified diff. Only scans the added lines; this is for code-review
 * paths where the reviewer only sees the patch, not the whole file.
 *
 * @param {string} diff unified diff text
 * @returns {{ violations: Array }}
 */
export function lintMVVM(diff) {
  const violations = [];
  const byFile = parseUnifiedDiff(diff);

  for (const [file, addedLines] of byFile) {
    const isView = isViewFile(file);
    const isModel = isModelFile(file);
    if (!isView && !isModel) continue;

    for (const { line, text } of addedLines) {
      IMPORT_SOURCE_RE.lastIndex = 0;
      let m;
      while ((m = IMPORT_SOURCE_RE.exec(text)) !== null) {
        const spec = m[1];
        const kind = classifyImportSpecifier(spec);
        if (isView && kind === 'model') {
          violations.push({
            file,
            line,
            type: 'view-imports-model',
            message:
              `View "${file}" imports Model directly ("${spec}"). ` +
              `Views must go through a ViewModel.`,
          });
        }
        if (isModel && kind === 'view') {
          violations.push({
            file,
            line,
            type: 'model-imports-view',
            message:
              `Model "${file}" imports View "${spec}". ` +
              `Models must not depend on Views.`,
          });
        }
      }
      if (isView && DATA_FETCH_RE.test(text)) {
        violations.push({
          file,
          line,
          type: 'view-has-data-fetch',
          message:
            `View "${file}" performs data fetching directly. ` +
            `Move fetch/axios/db calls into the ViewModel.`,
        });
      }
    }
  }

  return { violations };
}

/**
 * Lint a set of files on disk. Reads each file and runs lintFileContent, then
 * adds the feature-level "view-missing-viewmodel" check: for every directory
 * that contains a *.view.{ts,tsx,jsx} file, require a sibling
 * *.viewmodel.{ts,tsx,jsx} file.
 *
 * @param {{ root: string, files: string[] }} opts
 *   `root` is the directory the file paths are relative to.
 *   `files` is the list of relative paths to scan.
 * @returns {Promise<{ violations: Array }>}
 */
export async function lintFiles({ root, files }) {
  if (!root || typeof root !== 'string') {
    throw new TypeError('lintFiles: { root } must be a string path');
  }
  if (!Array.isArray(files)) {
    throw new TypeError('lintFiles: { files } must be an array of relative paths');
  }

  const allViolations = [];

  // Per-file content checks.
  for (const rel of files) {
    const abs = path.join(root, rel);
    let content;
    try {
      content = await fs.readFile(abs, 'utf8');
    } catch {
      // Missing file — skip silently. Callers may pass a list that includes
      // deleted files; we don't want to crash on those.
      continue;
    }
    allViolations.push(...lintFileContent(rel, content));
  }

  // Feature-level check: every directory with a *.view.* must also have a
  // *.viewmodel.* sibling. We resolve the actual on-disk siblings rather than
  // relying solely on `files` so we don't false-positive when the caller only
  // passes changed files.
  const dirsChecked = new Set();
  for (const rel of files) {
    if (!isViewFile(rel)) continue;
    const dir = path.dirname(rel);
    if (dirsChecked.has(dir)) continue;
    dirsChecked.add(dir);

    let siblings;
    try {
      siblings = await fs.readdir(path.join(root, dir));
    } catch {
      continue;
    }
    const hasViewmodel = siblings.some((name) => VIEWMODEL_RE.test(name));
    if (!hasViewmodel) {
      allViolations.push({
        file: rel,
        line: 1,
        type: 'view-missing-viewmodel',
        message:
          `View "${rel}" has no sibling *.viewmodel.{ts,tsx,jsx} in "${dir}". ` +
          `Add a ViewModel to bridge between View and Model.`,
      });
    }
  }

  return { violations: allViolations };
}

// Re-export for tests / advanced callers.
export const __internals = {
  classifyImportSpecifier,
  parseUnifiedDiff,
  isViewFile,
  isModelFile,
};
