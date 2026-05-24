#!/usr/bin/env node
/**
 * Session-end hook: write ralph resume prompt when loop is enabled and work remains.
 * Wire into Claude Code Stop hook or Cursor session end.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveControlRoot } from '../lib/resolve-control-root.mjs';
import {
  readOrchestratorControls,
} from '../lib/orchestrator-controls.mjs';
import { hasQueuedWork } from '../lib/pick-next-feature.mjs';
import {
  buildResumePromptForDisk,
  writeRalphResumePrompt,
} from './mc-write-resume-prompt.mjs';

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function withinDailyLimit(controlRoot, controls) {
  const max = controls.ralphLoop?.maxSessionsPerDay ?? 12;
  const counterFile = path.join(controlRoot, '.mc', 'ralph', 'sessions-today.json');
  const today = new Date().toISOString().slice(0, 10);
  let counter = { date: today, count: 0 };
  if (fs.existsSync(counterFile)) {
    counter = JSON.parse(fs.readFileSync(counterFile, 'utf8'));
    if (counter.date !== today) counter = { date: today, count: 0 };
  }
  if (counter.count >= max) return false;
  counter.count += 1;
  fs.mkdirSync(path.dirname(counterFile), { recursive: true });
  fs.writeFileSync(counterFile, `${JSON.stringify(counter, null, 2)}\n`);
  return true;
}

export function shouldWriteRalphPrompt(controlRoot) {
  const controls = readOrchestratorControls(controlRoot);
  if (!controls.ralphLoop?.enabled) {
    return { write: false, reason: 'ralph loop disabled' };
  }
  const global = readJson(path.join(controlRoot, 'state.json')) ?? {};
  if (!hasQueuedWork(controlRoot, global, controls)) {
    return { write: false, reason: 'no queued work' };
  }
  if (!withinDailyLimit(controlRoot, controls)) {
    return { write: false, reason: 'daily session limit reached' };
  }
  return { write: true, reason: null };
}

export function runRalphOnStop(projectRoot) {
  const controlRoot = resolveControlRoot(projectRoot);
  const decision = shouldWriteRalphPrompt(controlRoot);
  if (!decision.write) {
    return { ok: true, wrote: false, reason: decision.reason };
  }

  const prompt = buildResumePromptForDisk(controlRoot);
  const out = writeRalphResumePrompt(controlRoot, prompt);

  const statePath = path.join(controlRoot, 'state.json');
  const global = readJson(statePath) ?? {};
  writeJson(statePath, {
    ...global,
    orchestratorRotations: (global.orchestratorRotations ?? 0) + 1,
    lastRalphPromptAt: new Date().toISOString(),
  });

  return { ok: true, wrote: true, path: out };
}

function main() {
  const projectRoot = process.argv[2] ?? process.cwd();
  try {
    const result = runRalphOnStop(projectRoot);
    if (result.wrote) {
      console.log(`Ralph resume prompt: ${result.path}`);
    } else {
      console.log(`Ralph on-stop skipped: ${result.reason}`);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
