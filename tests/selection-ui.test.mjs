import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "control", "layout", "selection");
const examples = ["example-ui.html", "example-ux.html", "example-engineer.html"];
const all = [...examples, "template.html"];

test("selection files exist", () => {
  for (const f of [...all, "SELECTION-UI.md"]) {
    assert.ok(existsSync(join(dir, f)), `missing ${f}`);
  }
});

test("pages are self-contained (no external stylesheet, has inline style + DOCTYPE)", () => {
  for (const f of all) {
    const html = readFileSync(join(dir, f), "utf8");
    assert.ok(/<!DOCTYPE/i.test(html), `${f} missing DOCTYPE`);
    assert.ok(/<style>/i.test(html), `${f} missing inline <style>`);
    assert.ok(!/rel=["']stylesheet["']/i.test(html), `${f} has external stylesheet`);
  }
});

test("pages carry the deck mechanics", () => {
  for (const f of all) {
    const html = readFileSync(join(dir, f), "utf8");
    for (const fn of ["function pick", "function go", "function render", "function copyAll"]) {
      assert.ok(html.includes(fn), `${f} missing ${fn}`);
    }
  }
});

test("each example question has between 2 and 4 options", () => {
  for (const f of examples) {
    const html = readFileSync(join(dir, f), "utf8");
    // Split on a question section opening, tolerating `class="question"` and `class="question active"`.
    const sections = html.split(/class="question[ "]/).slice(1);
    assert.ok(sections.length >= 1, `${f} has no questions`);
    for (const sec of sections) {
      const body = sec.split("</section>")[0];
      const count = (body.match(/class="card[ "]/g) || []).length;
      assert.ok(count >= 2 && count <= 4, `${f} question has ${count} options (need 2-4)`);
    }
  }
});

test("no example references the retired wireframe system", () => {
  for (const f of all) {
    const html = readFileSync(join(dir, f), "utf8");
    assert.ok(!/wireframe\.css|layout\/primitives|layout\/skeletons/.test(html), `${f} references retired system`);
  }
});
