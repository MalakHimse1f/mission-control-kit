import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import {
  sortFeaturesByBuildOrder,
  computeFeatureStage,
  computeTechStage,
  taskProgress,
  sortTasks,
} from "./dashboard-helpers.mjs";
import { listTechItems } from "./dashboard-tech.mjs";
import {
  readTextFile,
  collectJournalEntries,
  collectExploreDocs,
  collectPhaseDocs,
  collectEmbeddedWireframes,
  collectEmbeddedScreenshots,
  buildStepTimeline,
} from "./dashboard-content.mjs";
import { readOrchestratorControls } from "../lib/orchestrator-controls.mjs";
import { buildWorkflowPromptLines, buildBuildStagePickupLines } from "../lib/workflow-controls.mjs";

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function latestActivity(status) {
  const dates = [status?.lastUpdatedAt].filter(Boolean);
  for (const s of status?.steps ?? []) {
    if (s.completedAt) dates.push(s.completedAt);
  }
  for (const t of status?.tasks ?? []) {
    if (t.updatedAt) dates.push(t.updatedAt);
  }
  if (!dates.length) return null;
  return dates.sort().reverse()[0];
}

function workingTask(status) {
  const tasks = sortTasks(status?.tasks ?? []);
  return tasks.find((t) => t.status === "in-progress") ?? null;
}

function currentTask(status) {
  const tasks = sortTasks(status?.tasks ?? []);
  const active = tasks.find((t) => t.status === "in-progress");
  if (active) return active;
  if (status?.currentTaskId) {
    return tasks.find((t) => t.id === status.currentTaskId) ?? { id: status.currentTaskId, title: "" };
  }
  return tasks.find((t) => t.status !== "done") ?? null;
}

function nextCommand(stage) {
  if (stage.key === "done") return null;
  return "/mc";
}

export function buildPickupPrompt({ workstream, slug, stage, status, global, controls = null }) {
  const ws = workstream === "tech-stack" ? "tech setup" : "UX feature";
  const base = workstream === "tech-stack" ? "tech-stack" : "features";
  const pipelineStage = status?.pipelineStage ?? stage.key;
  const task = currentTask(status);
  const tasks = status?.tasks ?? [];
  const lines = [
    "You are the ORCHESTRATOR. Do not implement code, PRDs, plans, or mock HTML yourself.",
    "Your job: read disk → dispatch subagents → read journal files → update status → regenerate dashboard.",
    "CONTINUOUS RUN: advance through pipeline stages in THIS session — do not stop between stages or tell the user to start a new chat.",
    "",
    `Continue Mission Control v3 — ${ws}: ${slug}`,
    "",
    "Read first:",
    `- docs/superpowers/control/ORCHESTRATOR.md`,
    `- docs/superpowers/control/PIPELINE.md`,
    `- docs/superpowers/control/JOURNAL-RULES.md`,
    `- docs/superpowers/control/HANDOFF.md`,
    `- docs/superpowers/control/WORKFLOW-CONTROLS.md`,
    `- docs/superpowers/control/.mc/orchestrator-controls.json`,
    `- docs/superpowers/control/${base}/${slug}/status.json`,
    `- docs/superpowers/control/${base}/${slug}/journal/ (latest entries)`,
    "",
    `Pipeline stage: ${pipelineStage} (${stage.label})`,
  ];

  if (pipelineStage === "explore" && status?.targetCodebases?.length) {
    lines.push("", "Target codebases:");
    for (const cb of status.targetCodebases) {
      lines.push(`- ${cb.label}: ${cb.path}`);
    }
    lines.push("", "Dispatch one mc-explore subagent per codebase. Each must write explore/{label}.md and a journal file.");
  }

  if (pipelineStage === "clarify") {
    lines.push("", "Ask the user clarifying questions via AskQuestion (one at a time). Write journal/NNN-clarify.md with Q&A.");
  }

  if (pipelineStage === "prd") {
    lines.push("", "Dispatch ONE mc-prd subagent. Output: single spec.md + journal.");
  }

  if (pipelineStage === "mock") {
    lines.push("", "Dispatch ONE mc-mock subagent. Output: layout/wireframes/*.html + journal.");
  }

  if (controls) {
    lines.push(...buildWorkflowPromptLines(controls));
  }

  if (pipelineStage === "plan") {
    const planMode = controls?.planWorkflow?.mode ?? "subagent-driven";
    lines.push("", "Dispatch ONE mc-platform-plan subagent for ALL platforms (consistent naming). Output: phases/*.md + tasks[] + journal.");
    if (planMode === "executing-plans") {
      lines.push("planWorkflow.mode is executing-plans — user may run a parallel session with executing-plans after plan approval.");
    }
  }

  if (pipelineStage === "build") {
    const phasePrefix = task?.id ? String(task.id).split(".")[0] + "." : null;
    const phaseTasks = phasePrefix
      ? tasks.filter((t) => String(t.id ?? "").startsWith(phasePrefix))
      : tasks;
    const remaining = phaseTasks.filter((t) => t.status !== "done").length;
    const done = phaseTasks.filter((t) => t.status === "done").length;
    if (phaseTasks.length > 0) {
      lines.push("", `Build progress: ${done}/${phaseTasks.length} done, ${remaining} remaining.`);
    }
    if (task?.id) {
      lines.push(`Next task: ${task.id}${task.title ? ` — ${task.title}` : ""}`);
    }
    lines.push(...buildBuildStagePickupLines(controls ?? {}));
  }

  if (pipelineStage === "validate") {
    lines.push("", "Run validate gate inline (orchestrator-internal). On pass → next phase or done. Same session.");
  }

  lines.push("", "Continue the pipeline in this session — run /mc only if resuming after interruption.");

  if (global?.phase && global.phase !== "idle") {
    lines.push("", `Global phase: ${global.phase}`);
  }
  return lines.join("\n");
}

function isInProgress(stage, status, global, slug, workstream) {
  if (stage.key === "done") return false;
  const steps = status?.steps ?? [];
  if (steps.some((s) => s.status === "in-progress")) return true;
  const tasks = status?.tasks ?? [];
  if (tasks.some((t) => t.status === "in-progress" || t.status === "blocked")) return true;
  if (workstream === "feature" && global?.activeFeature === slug) return true;
  if (workstream === "tech-stack" && global?.activeTechSlug === slug) return true;
  return stage.key === "build" || tasks.some((t) => t.status !== "done" && stage.key === "build");
}

export function collectItemRow(control, workstream, slug, global, orderIndex) {
  const base = workstream === "tech-stack" ? "tech-stack" : "features";
  const itemRoot = join(control, base, slug);
  const status = readJson(join(itemRoot, "status.json")) ?? {};
  const stage =
    workstream === "tech-stack"
      ? computeTechStage(control, slug, status)
      : computeFeatureStage(control, slug, status);
  const progress = taskProgress(status.tasks);
  const activity = latestActivity(status);
  const task = currentTask(status);
  const active = workingTask(status);
  const inProgress = isInProgress(stage, status, global, slug, workstream);
  const sortedTasks = sortTasks(status.tasks ?? []);
  const embeddedWireframes =
    workstream === "feature" ? collectEmbeddedWireframes(control, base, slug) : [];
  const embeddedScreenshots = collectEmbeddedScreenshots(control, base, slug, sortedTasks);
  const controls = readOrchestratorControls(control);

  return {
    id: slug,
    workstream,
    type: workstream === "tech-stack" ? "Setup" : "Feature",
    stage: stage.label,
    stageKey: stage.key,
    pipelineStage: status.pipelineStage ?? stage.key,
    specStatus: status.specStatus ?? "—",
    layoutStatus: status.layoutStatus ?? "—",
    targetCodebases: status.targetCodebases ?? [],
    stepTimeline: buildStepTimeline(status.steps, status.pipelineStage),
    progress,
    lastUpdated: activity,
    lastUpdatedDisplay: formatDate(activity) ?? "—",
    currentTaskId: task?.id ?? "—",
    currentTaskTitle: task?.title ?? "",
    workingTaskId: active?.id ?? null,
    workingTaskTitle: active?.title ?? "",
    hasWorkingTask: !!active,
    branch: status.branch ?? global?.branch ?? "—",
    order: orderIndex >= 0 ? orderIndex + 1 : null,
    inProgress,
    isBuilding: stage.key === "build",
    nextCommand: nextCommand(stage),
    pickupPrompt: buildPickupPrompt({ workstream, slug, stage, status, global, controls }),
    tasks: sortedTasks.map((t) => ({
      id: t.id,
      title: t.title ?? "",
      status: t.status ?? "backlog",
      updatedAt: t.updatedAt ?? null,
      commit: t.commit ? String(t.commit) : null,
      commitShort: t.commit ? String(t.commit).slice(0, 7) : null,
      commitMessage: t.commitMessage ?? null,
      journalFile: t.journalFile ?? null,
    })),
    braindump: readTextFile(join(itemRoot, "braindump.md")),
    spec: readTextFile(join(itemRoot, "spec.md")),
    layoutDoc: readTextFile(join(itemRoot, "layout", "layout.md")),
    exploreDocs: collectExploreDocs(control, base, slug),
    phaseDocs: collectPhaseDocs(control, base, slug),
    journalEntries: collectJournalEntries(control, base, slug),
    wireframes: embeddedWireframes,
    screenshots: embeddedScreenshots,
  };
}

export function collectAllRows(control, global) {
  const rows = [];
  const fdir = join(control, "features");
  if (existsSync(fdir)) {
    const features = sortFeaturesByBuildOrder(
      readdirSync(fdir).filter((name) => {
        if (name.startsWith("_") || name.startsWith(".")) return false;
        return existsSync(join(fdir, name, "status.json")) || existsSync(join(fdir, name, "spec.md"));
      }),
      global?.buildOrder ?? [],
    );
    const buildOrder = global?.buildOrder ?? [];
    for (const slug of features) {
      rows.push(collectItemRow(control, "feature", slug, global, buildOrder.indexOf(slug)));
    }
  }

  const techOrder = global?.techStackOrder ?? [];
  for (const slug of sortFeaturesByBuildOrder(listTechItems(control), techOrder)) {
    rows.push(collectItemRow(control, "tech-stack", slug, global, techOrder.indexOf(slug)));
  }

  return rows;
}

export function readStackSummary(control) {
  const stack = readJson(join(control, "tech-stack", "stack.json")) ?? {};
  return {
    summary: stack.summary ?? (stack.frameworks?.length ? stack.frameworks.join(", ") : "—"),
    projectMode: stack.projectMode ?? "—",
    techStackStatus: stack.techStackStatus,
    layoutTargets: stack.layoutTargets ?? [],
  };
}
