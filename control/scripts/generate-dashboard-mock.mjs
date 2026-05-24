#!/usr/bin/env node
/**
 * Writes dashboard-mock.html with v3 sample data for UI preview.
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildDashboardHtml } from "./dashboard-template.mjs";
import { collectOrderSummary, defaultDashboardSort } from "./dashboard-order.mjs";
import { buildPickupPrompt } from "./dashboard-data.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTROL = join(__dirname, "..");

const mockWfHtml = readFileSync(join(CONTROL, "layout/skeletons/web-saas.html"), "utf8");
const mockSvg = readFileSync(join(CONTROL, "mock-assets/e2e-placeholder.svg"), "utf8");
const mockShotDataUrl = `data:image/svg+xml;base64,${Buffer.from(mockSvg).toString("base64")}`;

const mockGlobal = {
  phase: "build",
  buildOrder: ["sign-up", "sign-in", "learning-calculator"],
  techStackOrder: ["scaffold-nextjs"],
  portfolioReviewStatus: "approved",
};

const PIPELINE_STEPS_BUILD = [
  { id: "braindump", label: "Braindump", status: "done", completedAt: "2026-05-18", journalFile: "journal/001-braindump.md" },
  { id: "explore", label: "Explore codebases", status: "done", completedAt: "2026-05-18", journalFile: "journal/002-explore-web-app.md" },
  { id: "clarify", label: "Clarify requirements", status: "done", completedAt: "2026-05-19", journalFile: "journal/003-clarify.md" },
  { id: "prd", label: "Write PRD", status: "done", completedAt: "2026-05-19", journalFile: "journal/004-prd.md" },
  { id: "mock", label: "UI mock diagrams", status: "done", completedAt: "2026-05-20", journalFile: "journal/005-mock.md" },
  { id: "plan", label: "Platform plans", status: "done", completedAt: "2026-05-20", journalFile: "journal/006-plan.md" },
  { id: "build", label: "Build", status: "in-progress" },
  { id: "validate", label: "Validate", status: "pending" },
];

const MOCK_SPEC = `# Sign up

**Status:** approved

## Problem
New users need to create an account.

## Desired outcome
User completes registration with email verification.

## User flow
1. Enter email + password
2. Receive verification email
3. Confirm and land on home
`;

const MOCK_JOURNAL = `---
step: explore
subagent: mc-explore
status: DONE
feature: sign-up
---

# Explore — web-app

## Summary
Mapped Next.js app structure, auth patterns, and Supabase schema.
`;

const mockRows = [
  {
    id: "sign-up",
    workstream: "feature",
    type: "Feature",
    stage: "Building",
    stageKey: "build",
    pipelineStage: "build",
    specStatus: "approved",
    layoutStatus: "approved",
    targetCodebases: [{ label: "web-app", path: "/Users/demo/penrose-web" }],
    stepTimeline: PIPELINE_STEPS_BUILD,
    progress: { done: 2, total: 5, pct: 40 },
    lastUpdated: "2026-05-22T09:15:00Z",
    lastUpdatedDisplay: "2026-05-22",
    currentTaskId: "1.3",
    currentTaskTitle: "Email verification flow",
    workingTaskId: "1.3",
    workingTaskTitle: "Email verification flow",
    hasWorkingTask: true,
    branch: "feature/sign-up",
    order: 1,
    inProgress: true,
    nextCommand: "/mc",
    pickupPrompt: buildPickupPrompt({
      workstream: "feature",
      slug: "sign-up",
      stage: { key: "build", label: "Building" },
      status: { pipelineStage: "build", tasks: [{ id: "1.3", title: "Email verification flow", status: "in-progress" }] },
      global: mockGlobal,
    }),
    tasks: [
      { id: "1.1", title: "Registration form UI", status: "done", updatedAt: "2026-05-21", commit: "111aaaa1111111111111111111111111111111111", commitShort: "111aaaa", commitMessage: "feat(sign-up): registration form UI", journalFile: "journal/007-build-1.1.md" },
      { id: "1.2", title: "Password validation", status: "done", updatedAt: "2026-05-21", commit: "222bbbb2222222222222222222222222222222222", commitShort: "222bbbb", commitMessage: "feat(sign-up): password validation", journalFile: "journal/008-build-1.2.md" },
      { id: "1.3", title: "Email verification flow", status: "in-progress", updatedAt: "2026-05-22" },
      { id: "1.4", title: "Success screen", status: "backlog" },
    ],
    braindump: "# Braindump\n\nUser described sign-up flow for web + iOS.\n\n| Label | Path |\n| web-app | /Users/demo/penrose-web |",
    spec: MOCK_SPEC,
    layoutDoc: "# Layout\n\nRegistration → verify email → success",
    exploreDocs: [{ file: "web-app.html", label: "web-app", format: "html", html: "<!DOCTYPE html><html><body><div class=\"wf-card\">Next.js 14 app</div></body></html>" }],
    skillFindings: [{ file: "research.html", label: "UX research", source: "design-research", format: "html", html: "<!DOCTYPE html><html><body><div class=\"wf-card\">Admin and end user.</div></body></html>" }],
    phaseDocs: [{ file: "phase-1.md", label: "phase-1", content: "## Phase 1: Registration core\n\n### Task 1.1: Registration form UI\n\n**Platform(s):** web\n\nBuild form at /signup..." }],
    journalEntries: [{ file: "002-explore-web-app.md", label: "explore-web-app", content: MOCK_JOURNAL }],
    wireframes: [{ id: "web-saas", label: "web-saas", html: mockWfHtml }],
    screenshots: [
      { taskId: "1.1", taskTitle: "Registration form UI", label: "signup-form.svg", dataUrl: mockShotDataUrl },
    ],
  },
  {
    id: "learning-calculator",
    workstream: "feature",
    type: "Feature",
    stage: "UI mock diagrams",
    stageKey: "mock",
    pipelineStage: "mock",
    specStatus: "approved",
    layoutStatus: null,
    stepTimeline: PIPELINE_STEPS_BUILD.slice(0, 5).concat([
      { id: "mock", label: "UI mock diagrams", status: "in-progress" },
      { id: "plan", label: "Platform plans", status: "pending" },
      { id: "build", label: "Build", status: "pending" },
      { id: "validate", label: "Validate", status: "pending" },
    ]),
    progress: { done: 0, total: 0, pct: 0 },
    lastUpdated: "2026-05-21T16:00:00Z",
    lastUpdatedDisplay: "2026-05-21",
    currentTaskId: "—",
    currentTaskTitle: "",
    branch: "main",
    order: 3,
    inProgress: true,
    nextCommand: "/mc",
    pickupPrompt: buildPickupPrompt({
      workstream: "feature",
      slug: "learning-calculator",
      stage: { key: "mock", label: "UI mock diagrams" },
      status: { pipelineStage: "mock", specStatus: "approved" },
      global: mockGlobal,
    }),
    tasks: [],
    braindump: "# Braindump\n\nLearning calculator for nutrition education.",
    spec: "# Learning calculator\n\n**Status:** approved\n\n## Problem\nUsers don't understand macro targets.",
    layoutDoc: null,
    exploreDocs: [],
    skillFindings: [],
    phaseDocs: [],
    journalEntries: [],
    wireframes: [],
    screenshots: [],
  },
];

const html = buildDashboardHtml({
  generatedAt: new Date().toISOString(),
  handoff: "Orchestrator v3 mock\nActive: sign-up (build), learning-calculator (mock)\nNext: /mc",
  stack: { summary: "Next.js + Swift iOS", projectMode: "greenfield", techStackStatus: "established", layoutTargets: ["web-saas", "ios-tab-nav"] },
  global: mockGlobal,
  rows: mockRows,
  orderSummary: collectOrderSummary(mockGlobal, mockRows),
  defaultSort: defaultDashboardSort(mockGlobal),
  isMock: true,
});

writeFileSync(join(CONTROL, "dashboard-mock.html"), html, "utf8");
console.log("Wrote dashboard-mock.html");
