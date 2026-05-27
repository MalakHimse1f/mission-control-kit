import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDashboardHtml } from "../control/scripts/dashboard-template.mjs";

function sampleHtml() {
  return buildDashboardHtml({
    generatedAt: "2026-05-27 12:00",
    handoff: "none",
    stack: { techStackStatus: "established", summary: "Node", projectMode: "app" },
    global: {},
    rows: [{ id: "demo", type: "feature", workstream: "feature", stage: "Build", stageKey: "build",
      pipelineStage: "build", lastUpdatedDisplay: "now", pickupPrompt: "resume demo",
      stepTimeline: [], braindump: "", spec: "", exploreDocs: [], skillFindings: [],
      phaseDocs: [], journalEntries: [], layoutDoc: "", tasks: [], wireframes: [], screenshots: [],
      hasWorkingTask: false, nextCommand: "" }],
    kitVersion: null, controls: null,
  });
}

test("renders two views and no modal", () => {
  const html = sampleHtml();
  assert.ok(html.includes('id="view-dashboard"'), "missing dashboard view");
  assert.ok(html.includes('id="view-feature"'), "missing feature view");
  assert.ok(!html.includes("modal-overlay"), "modal overlay still present");
});

test("feature view has back button and reuses detail ids", () => {
  const html = sampleHtml();
  assert.ok(html.includes('id="detail-back"'), "missing back button");
  for (const id of ["detail-title","detail-pickup","detail-tasks","detail-wireframes"]) {
    assert.ok(html.includes('id="' + id + '"'), "missing " + id);
  }
});

test("navigation + copy client code is present", () => {
  const html = sampleHtml();
  for (const s of ["function setView","function goDashboard","popstate","copyCmd"]) {
    assert.ok(html.includes(s), "missing client code: " + s);
  }
});

test("guide is at the bottom of the dashboard view, collapsed, with copy buttons", () => {
  const html = sampleHtml();
  const guideIdx = html.indexOf("How to use Mission Control");
  const workIdx = html.indexOf("All work");
  assert.ok(guideIdx > workIdx, "guide should come after the All work panel");
  assert.ok(!/class="guide[^"]*"[^>]*\sopen/.test(html), "guide must be collapsed (no open attr)");
  assert.ok(html.includes("copy-cmd"), "guide missing copy buttons");
});

test("feature embeds still use iframe srcdoc", () => {
  const html = sampleHtml();
  assert.ok(html.includes('srcdoc='), "expected iframe srcdoc embedding code in client JS");
});
