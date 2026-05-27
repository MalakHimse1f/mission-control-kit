import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_IDS = [
  "mc","mc-braindump","mc-build","mc-explore","mc-feature","mc-handoff","mc-init",
  "mc-layout","mc-mock","mc-plan","mc-platform-plan","mc-portfolio","mc-prd",
  "mc-refine","mc-setup-skills","mc-start","mc-upgrade","mc-validate",
  "mission-control","session-handoff","spec-portfolio-review",
];

test("every shipped skill is present in generated claude-skills/", () => {
  for (const id of SKILL_IDS) {
    assert.ok(existsSync(join(root, "claude-skills", id, "SKILL.md")), `claude-skills missing: ${id}`);
  }
});

test("claude-skills carries no references to the retired wireframe system", () => {
  const dir = join(root, "claude-skills");
  const bad = /wireframe\.css|layout\/primitives|layout\/skeletons|RESEARCH-LAYOUT|layout\/CATALOG\.md/;
  const offenders = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const skillDir = join(dir, ent.name);
    for (const f of readdirSync(skillDir)) {
      if (!f.endsWith(".md")) continue;
      if (bad.test(readFileSync(join(skillDir, f), "utf8"))) offenders.push(`${ent.name}/${f}`);
    }
  }
  assert.deepEqual(offenders, [], `stale wireframe refs in: ${offenders.join(", ")}`);
});
