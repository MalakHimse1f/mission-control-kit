import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = join(root, "control", "ROUTING.md");

test("ROUTING.md exists", () => assert.ok(existsSync(manifest)));

test("ROUTING.md covers every pipeline stage", () => {
  const txt = readFileSync(manifest, "utf8");
  for (const stage of ["explore", "research", "clarify", "prd", "mock", "plan", "build", "validate"]) {
    assert.ok(new RegExp(`\\b${stage}\\b`).test(txt), `ROUTING.md missing stage: ${stage}`);
  }
});

test("ROUTING.md points UI generation at the selection system", () => {
  const txt = readFileSync(manifest, "utf8");
  assert.ok(/layout\/selection\/SELECTION-UI\.md/.test(txt));
});
