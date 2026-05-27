import { test } from "node:test";
import assert from "node:assert/strict";
import { RESEARCH_HTML_ARTIFACTS, prepareHtmlForDashboardEmbed } from "../control/lib/research-layout.mjs";

test("RESEARCH_HTML_ARTIFACTS lists the known artifacts", () => {
  assert.ok(Array.isArray(RESEARCH_HTML_ARTIFACTS) && RESEARCH_HTML_ARTIFACTS.length > 0);
});

test("prepareHtmlForDashboardEmbed returns self-contained html unchanged", () => {
  const html = "<!DOCTYPE html><html><head><style>body{}</style></head><body>x</body></html>";
  assert.equal(prepareHtmlForDashboardEmbed(html, "/any/control"), html);
});
