import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyze, contrast, css, compare } from "../dist/core.js";
import { Store, Conflict } from "../dist/store.js";
const theme = () => ({
  version: 1,
  title: "Synthetic theme",
  tokens: [
    { name: "color.ink", type: "color", value: "#000" },
    { name: "color.surface", type: "color", value: "#fff" },
    { name: "color.alias", type: "color", value: "{color.ink}" },
    { name: "space.card", type: "dimension", value: "24px" },
  ],
  pairs: [
    {
      name: "Body",
      foreground: "color.ink",
      background: "color.surface",
      usage: "normal",
    },
  ],
});
test("black and white have 21:1 contrast", () =>
  assert.equal(contrast("#000", "#fff"), 21));
test("contrast is symmetric and identical colors have ratio one", () => {
  assert.equal(contrast("#abc", "#abc"), 1);
  assert.equal(contrast("#123", "#def"), contrast("#def", "#123"));
});
test("AA decisions use unrounded ratios", () => {
  const t = theme();
  t.tokens[0].value = "#777777";
  const a = analyze(t);
  assert(a.checks[0].ratio < 4.5);
  assert.equal(a.checks[0].pass, false);
  t.tokens[0].value = "#767676";
  assert.equal(analyze(t).checks[0].pass, true);
});
test("large text uses a distinct threshold", () => {
  const t = theme();
  t.tokens[0].value = "#777";
  t.pairs[0].usage = "large";
  assert.equal(analyze(t).checks[0].pass, true);
});
test("aliases resolve through multiple links", () => {
  const t = theme();
  t.tokens.push({
    name: "color.second",
    type: "color",
    value: "{color.alias}",
  });
  assert.equal(analyze(t).resolved["color.second"], "#000000");
});
test("cycles and unknown aliases are rejected", () => {
  const t = theme();
  t.tokens[0].value = "{color.alias}";
  assert.throws(() => analyze(t), /Circular/);
  t.tokens[0].value = "{color.missing}";
  assert.throws(() => analyze(t), /Unknown/);
});
test("aliases cannot cross token types", () => {
  const t = theme();
  t.tokens[3].value = "{color.ink}";
  assert.throws(() => analyze(t), /type mismatch/);
});
test("unsafe values and duplicate names are rejected", () => {
  for (const value of [
    "red; color:black",
    "url(https://example.com)",
    "rgba(0,0,0,0.5)",
  ]) {
    const t = theme();
    t.tokens[0].value = value;
    assert.throws(() => analyze(t));
  }
  const t = theme();
  t.tokens.push(t.tokens[0]);
  assert.throws(() => analyze(t));
});
test("CSS resolves aliases and preserves safe property names", () => {
  const output = css(theme());
  assert.match(output, /--color-alias: #000000;/);
  assert.match(output, /--space-card: 24px;/);
  assert(!output.includes("{color.ink}"));
});
test("diff detects indirect reference changes", () => {
  const a = theme(),
    b = theme();
  b.tokens[0].value = "#123456";
  const changes = compare(a, b);
  assert(
    changes.some((c) => c.name === "color.alias" && c.status === "changed"),
  );
});
test("dimensions are bounded", () => {
  for (const value of ["-1px", "129px", "10rem", "NaNpx"]) {
    const t = theme();
    t.tokens[3].value = value;
    assert.throws(() => analyze(t));
  }
});
test("revision persistence, stale writes and retained history", () => {
  const dir = mkdtempSync(join(tmpdir(), "tokenstudio-test-"));
  try {
    const path = join(dir, "library.json"),
      store = new Store(path);
    let r = store.save({ revision: 0, document: theme() });
    const stale = structuredClone(r);
    for (let i = 0; i < 22; i++)
      r = store.save({ id: r.id, revision: r.revision, document: r.document });
    assert.equal(r.history.length, 20);
    assert.equal(new Store(path).get(r.id).revision, 23);
    assert.throws(() => store.save(stale), Conflict);
    assert.equal(store.get(r.id).revision, 23);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
