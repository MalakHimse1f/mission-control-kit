export const version = '4.4.0-orchestrator-controls';

/** Ensure orchestrator control panel files exist. */
export async function up({ controlRoot }) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { ensureOrchestratorControls } = await import('../control/lib/orchestrator-controls.mjs');
  ensureOrchestratorControls(controlRoot);
  fs.mkdirSync(path.join(controlRoot, '.mc', 'ralph'), { recursive: true });
}
