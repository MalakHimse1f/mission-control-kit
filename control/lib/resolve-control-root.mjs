import fs from 'node:fs';
import path from 'node:path';

const CANDIDATES = ['docs/superpowers/control', 'control'];

/** Resolve Mission Control control directory from a project or kit root. */
export function resolveControlRoot(projectRoot = process.cwd()) {
  const root = path.resolve(projectRoot);
  for (const rel of CANDIDATES) {
    const dir = path.join(root, rel);
    if (fs.existsSync(path.join(dir, 'state.json'))) return dir;
  }
  throw new Error(
    `Mission Control control root not found under ${root} (expected state.json in ${CANDIDATES.join(' or ')})`,
  );
}
