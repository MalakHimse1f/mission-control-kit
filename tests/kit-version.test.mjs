import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
test("kit-manifest is at 4.8.0", () => {
  const m = JSON.parse(readFileSync(join(root, "kit-manifest.json"), "utf8"));
  assert.equal(m.kitVersion, "4.8.0");
});
test("package.json is at 4.8.0", () => {
  const p = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(p.version, "4.8.0");
});
