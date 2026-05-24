export const version = '4.6.0-session-intent';

/** Merge sessionIntent defaults into orchestrator controls. */
export async function up({ controlRoot }) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const {
    readOrchestratorControls,
    writeOrchestratorControls,
    DEFAULT_ORCHESTRATOR_CONTROLS,
  } = await import('../control/lib/orchestrator-controls.mjs');

  const file = path.join(controlRoot, '.mc', 'orchestrator-controls.json');
  if (!fs.existsSync(file)) return;

  const current = readOrchestratorControls(controlRoot);
  writeOrchestratorControls(controlRoot, {
    sessionIntent: {
      ...DEFAULT_ORCHESTRATOR_CONTROLS.sessionIntent,
      ...(current.sessionIntent ?? {}),
    },
  }, { updatedBy: 'migration-4.6.0' });
}
