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
