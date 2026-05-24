export const version = '4.5.0-workflow-controls';

/** Merge workflow defaults into orchestrator controls. */
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
    buildWorkflow: {
      ...DEFAULT_ORCHESTRATOR_CONTROLS.buildWorkflow,
      ...(current.buildWorkflow ?? {}),
    },
    planWorkflow: {
      ...DEFAULT_ORCHESTRATOR_CONTROLS.planWorkflow,
      ...(current.planWorkflow ?? {}),
    },
  }, { updatedBy: 'migration-4.5.0' });
}
