import fs from 'node:fs';
import path from 'node:path';

export const CONTROLS_SCHEMA_VERSION = 1;

export const DEFAULT_ORCHESTRATOR_CONTROLS = {
  version: CONTROLS_SCHEMA_VERSION,
  updatedAt: null,
  updatedBy: null,
  advanceToNextFeature: false,
  autoAdvanceScope: 'build-only',
  ralphLoop: {
    enabled: false,
    spawnFreshSession: true,
    maxSessionsPerDay: 12,
  },
  continuousWithinFeature: true,
  pauseOnClarify: true,
  pauseOnBlocked: true,
  pauseOnPortfolioDraft: true,
};

export function controlsFilePath(controlRoot) {
  return path.join(controlRoot, '.mc', 'orchestrator-controls.json');
}

export function ralphPromptPath(controlRoot) {
  return path.join(controlRoot, '.mc', 'ralph', 'resume-prompt.txt');
}

export function readOrchestratorControls(controlRoot) {
  const file = controlsFilePath(controlRoot);
  if (!fs.existsSync(file)) return { ...DEFAULT_ORCHESTRATOR_CONTROLS };
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return mergeOrchestratorControls(DEFAULT_ORCHESTRATOR_CONTROLS, raw);
}

export function mergeOrchestratorControls(base, patch) {
  const merged = {
    ...base,
    ...patch,
    ralphLoop: {
      ...base.ralphLoop,
      ...(patch?.ralphLoop ?? {}),
    },
  };
  merged.version = CONTROLS_SCHEMA_VERSION;
  return merged;
}

export function writeOrchestratorControls(controlRoot, patch, { updatedBy = 'dashboard' } = {}) {
  const current = readOrchestratorControls(controlRoot);
  const next = mergeOrchestratorControls(current, patch);
  next.updatedAt = new Date().toISOString();
  next.updatedBy = updatedBy;
  const file = controlsFilePath(controlRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

export function ensureOrchestratorControls(controlRoot) {
  const file = controlsFilePath(controlRoot);
  if (fs.existsSync(file)) return readOrchestratorControls(controlRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(path.join(controlRoot, '.mc', 'ralph'), { recursive: true });
  const initial = { ...DEFAULT_ORCHESTRATOR_CONTROLS, updatedAt: new Date().toISOString(), updatedBy: 'kit' };
  fs.writeFileSync(file, `${JSON.stringify(initial, null, 2)}\n`);
  return initial;
}

export function canAutoAdvance(global, controls) {
  if (!controls.advanceToNextFeature) {
    return { allowed: false, reason: 'Auto-advance is off in orchestrator controls.' };
  }
  if (controls.pauseOnPortfolioDraft && global?.portfolioReviewStatus !== 'approved') {
    return {
      allowed: false,
      reason: 'Portfolio is not approved — run /mc-portfolio to lock build order.',
    };
  }
  return { allowed: true, reason: null };
}
