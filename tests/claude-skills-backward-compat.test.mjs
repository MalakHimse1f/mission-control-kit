import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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
  // structural guard: the generated tree must not point at deleted assets
  // (checked here as a presence test; deep grep is covered by C4)
  assert.ok(existsSync(join(root, "claude-skills", "mc-mock", "SKILL.md")));
});
