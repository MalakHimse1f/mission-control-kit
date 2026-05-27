import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_IDS = [
  "mc","mc-braindump","mc-build","mc-explore","mc-feature","mc-handoff","mc-init",
  "mc-layout","mc-mock","mc-plan","mc-platform-plan","mc-portfolio","mc-prd",
  "mc-refine","mc-setup-skills","mc-start","mc-upgrade","mc-validate",
  "mission-control","session-handoff","spec-portfolio-review",
];

test("every v4.7.1 skill still exists with a matching frontmatter name", () => {
  for (const id of SKILL_IDS) {
    const p = join(root, "skills", id, "SKILL.md");
    assert.ok(existsSync(p), `missing skill: ${id}`);
    const fm = readFileSync(p, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(fm, `${id} missing frontmatter`);
    assert.ok(new RegExp(`name:\\s*${id}\\b`).test(fm[1]), `${id} frontmatter name mismatch`);
  }
});
