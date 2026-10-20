"use strict";
const $ = (id) => document.getElementById(id),
  clone = (v) => structuredClone(v);
const sample = {
  version: 1,
  title: "Terracotta workspace",
  tokens: [
    { name: "color.canvas", type: "color", value: "#f4f6fb" },
    { name: "color.surface", type: "color", value: "#ffffff" },
    { name: "color.ink", type: "color", value: "#24324b" },
    { name: "color.muted", type: "color", value: "#526079" },
    { name: "color.brand", type: "color", value: "#4f46e5" },
    { name: "color.onbrand", type: "color", value: "#ffffff" },
    { name: "color.border", type: "color", value: "#ccd2df" },
    { name: "color.focus", type: "color", value: "{color.brand}" },
    { name: "space.card", type: "dimension", value: "24px" },
    { name: "radius.card", type: "dimension", value: "16px" },
    { name: "type.body", type: "dimension", value: "16px" },
  ],
  pairs: [
    {
      name: "Body text",
      foreground: "color.ink",
      background: "color.canvas",
      usage: "normal",
    },
    {
      name: "Secondary text",
      foreground: "color.muted",
      background: "color.surface",
      usage: "normal",
    },
    {
      name: "Primary action",
      foreground: "color.onbrand",
      background: "color.brand",
      usage: "normal",
    },
  ],
};
let doc = clone(sample),
  baseline = clone(sample),
  initial = clone(sample),
  analysis = null,
  baselineAnalysis = null,
  id = null,
  revision = 0,
  history = [],
  undo = [],
  redo = [],
  timer,
  sequence = 0,
  busy = false,
  dirty = true;
function message(text) {
  $("status").textContent = text;
  $("status").hidden = !text;
}
function fail(e) {
  $("error").textContent = e.message;
  $("error").hidden = false;
}
function controls() {
  document
    .querySelectorAll("button,input,select")
    .forEach((e) => (e.disabled = busy));
  $("undo").disabled = busy || !undo.length;
  $("redo").disabled = busy || !redo.length;
  for (const name of ["save", "export-css", "export-json"])
    $(name).disabled = busy || !analysis;
}
async function api(path, data) {
  const response = await fetch(
    "/api/" + path,
    data === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "TokenStudio",
          },
          body: JSON.stringify(data),
        },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Operation failed.");
  return result;
}
async function task(text, fn) {
  if (busy) return;
  busy = true;
  controls();
  $("error").hidden = true;
  message(text);
  try {
    await fn();
  } catch (e) {
    fail(e);
    message("");
  } finally {
    busy = false;
    controls();
  }
}
function change(fn) {
  undo.push(clone(doc));
  undo = undo.slice(-50);
  redo = [];
  fn();
  dirty = true;
  analysis = null;
  sequence++;
  $("validity").textContent = "Draft pending validation";
  $("revision").textContent = "Unsaved changes";
  controls();
  clearTimeout(timer);
  timer = setTimeout(refresh, 250);
}
function field(label, value, changeValue, choices) {
  const el = document.createElement(choices ? "select" : "input");
  el.setAttribute("aria-label", label);
  if (choices) choices.forEach(([v, name]) => el.add(new Option(name, v)));
  el.value = value;
  el.addEventListener("input", () => change(() => changeValue(el.value)));
  return el;
}
function renderTokens() {
  const term = $("search").value.toLowerCase();
  $("tokens").replaceChildren();
  doc.tokens.forEach((token, index) => {
    if (![token.name, token.value].some((v) => v.toLowerCase().includes(term)))
      return;
    const row = document.createElement("div");
    row.className = "token-row";
    const name = field(
        `Token ${index + 1} name`,
        token.name,
        (v) => (token.name = v),
      ),
      type = field(
        `Type for ${token.name}`,
        token.type,
        (v) => (token.type = v),
        [
          ["color", "Color"],
          ["dimension", "Dimension"],
        ],
      ),
      value = field(
        `Value for ${token.name}`,
        token.value,
        (v) => (token.value = v),
      ),
      remove = document.createElement("button");
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${token.name}`);
    remove.addEventListener("click", () => {
      change(() => doc.tokens.splice(index, 1));
      renderTokens();
    });
    row.append(name, type, value, remove);
    $("tokens").append(row);
  });
}
function renderPairs() {
  $("pairs").replaceChildren();
  doc.pairs.forEach((pair, index) => {
    const tr = document.createElement("tr");
    for (const key of ["name", "foreground", "background", "usage"]) {
      const td = document.createElement("td");
      td.append(
        field(
          `${key} for pair ${index + 1}`,
          pair[key],
          (v) => (pair[key] = v),
          key === "usage"
            ? [
                ["normal", "Normal"],
                ["large", "Large"],
              ]
            : null,
        ),
      );
      tr.append(td);
    }
    const td = document.createElement("td"),
      button = document.createElement("button");
    button.textContent = "×";
    button.setAttribute("aria-label", `Remove pair ${index + 1}`);
    button.addEventListener("click", () => {
      change(() => doc.pairs.splice(index, 1));
      renderPairs();
    });
    td.append(button);
    tr.append(td);
    $("pairs").append(tr);
  });
}
function preview(target, values) {
  const element = $(target);
  element.replaceChildren();
  const roles = {
    canvas: "color.canvas",
    surface: "color.surface",
    ink: "color.ink",
    muted: "color.muted",
    brand: "color.brand",
    onbrand: "color.onbrand",
    border: "color.border",
    space: "space.card",
    radius: "radius.card",
    body: "type.body",
  };
  for (const [role, name] of Object.entries(roles)) {
    element.style.removeProperty("--demo-" + role);
    if (values?.[name])
      element.style.setProperty("--demo-" + role, values[name]);
  }
  const card = document.createElement("div");
  card.className = "preview-card";
  const title = document.createElement("h3");
  title.textContent = "A place for your next idea.";
  const text = document.createElement("p");
  text.textContent =
    "Keep your notes, sketches, and small discoveries together in one collection.";
  const label = document.createElement("label");
  label.textContent = "Collection name";
  const input = document.createElement("input");
  input.value = "Field notes";
  input.setAttribute("aria-label", target + " sample collection name");
  label.append(input);
  const button = document.createElement("button");
  button.className = "preview-button";
  button.textContent = "Create a collection";
  button.addEventListener("click", () =>
    message("Preview interaction only — no collection was created."),
  );
  card.append(title, text, label, button);
  element.append(card);
}
async function refresh() {
  clearTimeout(timer);
  const current = ++sequence;
  analysis = null;
  controls();
  $("error").hidden = true;
  try {
    const [checked, base, diff] = await Promise.all([
      api("analyze", doc),
      api("analyze", baseline),
      api("compare", { before: baseline, after: doc }),
    ]);
    if (current !== sequence) return;
    analysis = checked;
    baselineAnalysis = base;
    $("validity").textContent = "Valid theme";
    $("validity").className = "tag pass";
    $("token-count").textContent = doc.tokens.length;
    $("alias-count").textContent = doc.tokens.filter((t) =>
      t.value.startsWith("{"),
    ).length;
    $("pass-count").textContent =
      checked.checks.filter((c) => c.pass).length + "/" + checked.checks.length;
    $("change-count").textContent = diff.changes.length;
    preview("current-preview", checked.resolved);
    preview("baseline-preview", base.resolved);
    $("checks").replaceChildren();
    checked.checks.forEach((pair) => {
      const tr = document.createElement("tr");
      for (const value of [
        pair.name,
        pair.ratio.toFixed(2) + ":1",
        pair.threshold + ":1",
      ]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      const td = document.createElement("td"),
        tag = document.createElement("span");
      tag.className = "tag " + (pair.pass ? "pass" : "fail");
      tag.textContent = pair.pass ? "AA pass" : "AA fail";
      td.append(tag);
      tr.append(td);
      $("checks").append(tr);
    });
    $("changes").replaceChildren();
    diff.changes.forEach((item) => {
      const tr = document.createElement("tr");
      for (const value of [
        item.name,
        item.status,
        item.before ? `${item.before.value} → ${item.resolvedBefore}` : "—",
        item.after ? `${item.after.value} → ${item.resolvedAfter}` : "—",
      ]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      $("changes").append(tr);
    });
    $("diff-empty").textContent = "No changes from the baseline.";
    $("diff-empty").hidden = !!diff.changes.length;
  } catch (e) {
    if (current !== sequence) return;
    $("validity").textContent =
      "Invalid draft · preview shows last valid values";
    $("validity").className = "tag fail";
    $("checks").replaceChildren();
    $("changes").replaceChildren();
    $("diff-empty").hidden = false;
    $("diff-empty").textContent = "Correct the draft to compare revisions.";
    fail(e);
  } finally {
    if (current === sequence) controls();
  }
}
function render() {
  clearTimeout(timer);
  sequence++;
  $("title").value = doc.title;
  renderTokens();
  renderPairs();
  controls();
}
async function library() {
  const list = await api("projects");
  $("library").replaceChildren();
  $("library").add(new Option("Select a saved theme", ""));
  list.forEach((r) =>
    $("library").add(new Option(`${r.title} · v${r.revision}`, r.id)),
  );
  if (id) $("library").value = id;
}
function versions() {
  $("baseline").replaceChildren();
  if (!history.length) {
    $("baseline").add(new Option("Loaded baseline", "sample"));
    baseline = clone(initial);
    return;
  }
  history.forEach((r) =>
    $("baseline").add(new Option(`Revision ${r.revision}`, r.revision)),
  );
  const index = Math.max(0, history.length - 2);
  $("baseline").value = history[index].revision;
  baseline = clone(history[index].document);
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("title").addEventListener("input", () =>
  change(() => (doc.title = $("title").value)),
);
$("search").addEventListener("input", renderTokens);
$("add-token").addEventListener("click", () => {
  change(() =>
    doc.tokens.push({
      name: "color.new" + Date.now(),
      type: "color",
      value: "#334455",
    }),
  );
  renderTokens();
});
$("add-pair").addEventListener("click", () => {
  change(() =>
    doc.pairs.push({
      name: "New pair",
      foreground: "color.ink",
      background: "color.surface",
      usage: "normal",
    }),
  );
  renderPairs();
});
$("undo").addEventListener("click", () => {
  if (!undo.length) return;
  redo.push(clone(doc));
  doc = undo.pop();
  dirty = true;
  render();
  refresh();
});
$("redo").addEventListener("click", () => {
  if (!redo.length) return;
  undo.push(clone(doc));
  doc = redo.pop();
  dirty = true;
  render();
  refresh();
});
$("baseline").addEventListener("change", () => {
  baseline = clone(
    history.find((r) => r.revision === Number($("baseline").value))?.document ??
      initial,
  );
  refresh();
});
$("restore-baseline").addEventListener("click", () => {
  if (
    !confirm(
      "Replace the draft with the selected baseline? It will be saved as a new revision only when you choose Save.",
    )
  )
    return;
  change(() => (doc = clone(baseline)));
  render();
  refresh();
});
$("save").addEventListener("click", () =>
  task("Saving a new revision…", async () => {
    clearTimeout(timer);
    const record = await api("save", { id, revision, document: doc });
    id = record.id;
    revision = record.revision;
    history = record.history;
    dirty = false;
    $("revision").textContent = `Saved revision ${revision}`;
    versions();
    await library();
    await refresh();
    message(
      "Revision saved locally. Earlier retained revisions remain available.",
    );
  }),
);
$("open").addEventListener("click", () => {
  const key = $("library").value;
  if (!key) return;
  if (dirty && !confirm("Discard unsaved edits and open this theme?")) return;
  task("Opening theme…", async () => {
    const record = await api("projects/" + key);
    doc = record.document;
    id = record.id;
    revision = record.revision;
    history = record.history;
    dirty = false;
    undo = [];
    redo = [];
    versions();
    render();
    await refresh();
    $("revision").textContent = `Saved revision ${revision}`;
    message("Theme and revision history loaded.");
  });
});
$("sample").addEventListener("click", () => {
  if (dirty && !confirm("Replace your unsaved draft with a new sample?"))
    return;
  doc = clone(sample);
  baseline = clone(sample);
  initial = clone(sample);
  id = null;
  revision = 0;
  history = [];
  undo = [];
  redo = [];
  dirty = true;
  versions();
  render();
  $("revision").textContent = "Unsaved sample";
  refresh();
});
$("export-css").addEventListener("click", () =>
  task("Resolving CSS export…", async () => {
    const result = await api("export", doc);
    download("tokenstudio-theme.css", result.css, "text/css");
    message("Resolved CSS custom properties exported.");
  }),
);
$("export-json").addEventListener("click", () =>
  task("Validating theme export…", async () => {
    const result = await api("export", doc);
    download(
      "tokenstudio-theme.json",
      JSON.stringify(result.document, null, 2) + "\n",
      "application/json",
    );
    message("Theme exported with its token references preserved.");
  }),
);
$("import").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (dirty && !confirm("Replace unsaved edits with this imported theme?"))
    return;
  task("Validating imported theme…", async () => {
    if (file.size > 256000)
      throw new Error("Theme files must be smaller than 256 KB.");
    const result = await api("analyze", JSON.parse(await file.text()));
    doc = result.theme;
    baseline = clone(doc);
    initial = clone(doc);
    id = null;
    revision = 0;
    history = [];
    undo = [];
    redo = [];
    dirty = true;
    versions();
    render();
    await refresh();
    $("revision").textContent = "Imported · not saved";
    message("Theme imported. Save to start its revision history.");
  });
});
render();
task("Preparing the design workshop…", async () => {
  await refresh();
  await library();
  message(
    "Sample theme ready. Edit a value to preview its effects and contrast changes.",
  );
});
