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

function parseVersion(v) {
  return String(v || "0.0.0").replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
}

function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  for (let i = 0; i < 3; i += 1) {
    if (va[i] < vb[i]) return -1;
    if (va[i] > vb[i]) return 1;
  }
  return 0;
}

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

function readKitVersionInfo(controlDir) {
  const stampPath = join(controlDir, ".mc/install.json");
  const stamp = readJson(stampPath);
  const projectRoot = join(controlDir, "..", "..", "..");
  const kitFolder = stamp?.kitPath ?? "mission-control-kit";
  const manifestPath = join(projectRoot, kitFolder, "kit-manifest.json");
  const manifest = readJson(manifestPath);
  const installed = stamp?.kitVersion ?? null;
  const latest = manifest?.kitVersion ?? installed;
  const updateAvailable =
    installed && latest && compareVersions(installed, latest) < 0;
  return { installed, latest, updateAvailable, kitFolder };
}

function main() {
  const global = readJson(join(CONTROL, "state.json")) ?? {};
  const handoff = readText(join(CONTROL, "HANDOFF.md"));
  const stack = readStackSummary(CONTROL);
  const rows = collectAllRows(CONTROL, global);
  const orderSummary = collectOrderSummary(global, rows);
  const kitVersion = readKitVersionInfo(CONTROL);
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

main();
