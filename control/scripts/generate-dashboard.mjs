#!/usr/bin/env node
/**
 * Regenerates docs/superpowers/control/dashboard.html from disk state.
 * AGENTS: Never edit dashboard.html by hand. See ../AGENT-DATA-RULES.md
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { collectAllRows, readStackSummary } from "./dashboard-data.mjs";
import { collectOrderSummary, defaultDashboardSort } from "./dashboard-order.mjs";
import { buildDashboardHtml } from "./dashboard-template.mjs";
import {
  ensureOrchestratorControls,
  readOrchestratorControls,
  canAutoAdvance,
} from "../lib/orchestrator-controls.mjs";
import { pickNextFeature } from "../lib/pick-next-feature.mjs";
import { resolveKitVersionInfo } from "../lib/kit-version-info.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTROL = join(__dirname, "..");

function readText(path) {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function wantsRemoteCheck(argv) {
  return (
    argv.includes("--check-remote") ||
    process.env.MC_CHECK_REMOTE_RELEASE === "1" ||
    process.env.MC_DASHBOARD_SERVE === "1"
  );
}

async function main() {
  const global = readJson(join(CONTROL, "state.json")) ?? {};
  const handoff = readText(join(CONTROL, "HANDOFF.md"));
  const stack = readStackSummary(CONTROL);
  const rows = collectAllRows(CONTROL, global);
  const orderSummary = collectOrderSummary(global, rows);
  const kitVersion = await resolveKitVersionInfo(CONTROL, {
    fetchRemote: wantsRemoteCheck(process.argv),
  });
  ensureOrchestratorControls(CONTROL);
  const controls = readOrchestratorControls(CONTROL);
  const gate = canAutoAdvance(global, controls);
  const nextPick = pickNextFeature(CONTROL, global, controls);
  const serveMode = process.env.MC_DASHBOARD_SERVE === "1";
  const html = buildDashboardHtml({
    generatedAt: new Date().toISOString(),
    handoff,
    stack,
    global,
    rows,
    orderSummary,
    defaultSort: defaultDashboardSort(global),
    kitVersion,
    controls,
    gate,
    nextPick,
    serveMode,
  });
  const out = join(CONTROL, "dashboard.html");
  writeFileSync(out, html, "utf8");
  console.log(`Wrote ${out} (${rows.length} items)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
