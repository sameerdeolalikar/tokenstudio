import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
async function text(id, expected) {
  await page.waitForFunction(
    ([id, value]) => document.getElementById(id).textContent.trim() === value,
    [id, expected],
  );
}
async function download(selector) {
  const pending = page.waitForEvent("download");
  await page.click(selector);
  const d = await pending;
  return readFile(await d.path(), "utf8");
}
try {
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:7423");
  await text("token-count", "11");
  await page
    .getByLabel("Value for color.brand", { exact: true })
    .fill("#ffffff");
  await page.waitForFunction(
    () => Number(document.getElementById("change-count").textContent) >= 2,
  );
  assert.match(await page.textContent("#changes"), /color.focus/);
  await page
    .getByLabel("Value for color.brand", { exact: true })
    .fill("{color.focus}");
  await page.locator("#error:not([hidden])").waitFor();
  assert(await page.isDisabled("#export-css"));
  await page.click("#undo");
  await page.waitForFunction(
    () => !document.getElementById("export-css").disabled,
  );
  assert.match(await download("#export-css"), /--color-brand: #ffffff/);
  await page.click("#save");
  await text("revision", "Saved revision 1");
  await page.waitForFunction(() => !document.getElementById("save").disabled);
  const key = await page.inputValue("#library");
  assert(key);
  await page
    .getByLabel("Value for color.brand", { exact: true })
    .fill("#123456");
  await page.waitForFunction(() => !document.getElementById("save").disabled);
  await page.click("#save");
  await text("revision", "Saved revision 2");
  assert.equal(
    JSON.parse(await download("#export-json")).tokens.find(
      (t) => t.name === "color.brand",
    ).value,
    "#123456",
  );
  await page.reload();
  await text("token-count", "11");
  await page.selectOption("#library", key);
  await page.click("#open");
  await text("revision", "Saved revision 2");
  assert.equal(
    await page
      .getByLabel("Value for color.brand", { exact: true })
      .inputValue(),
    "#123456",
  );
  assert((await page.locator("#baseline option").count()) >= 2);

  const stale = await page.evaluate(
    async ({ key, app }) => {
      const r = await (await fetch("/api/projects/" + key)).json();
      const payload = { id: r.id, revision: 0, document: r.document };
      if (r.layout) payload.layout = r.layout;
      return (
        await fetch("/api/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": app,
          },
          body: JSON.stringify(payload),
        })
      ).status;
    },
    { key, app: "TokenStudio" },
  );
  assert.equal(stale, 409, "Stale writes must be rejected");
  const blocked = await page.evaluate(
    async () =>
      (
        await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
  );
  assert.equal(blocked, 403, "Mutations require the workspace header");
  await page.setInputFiles("#import", "examples/sample.json");
  await page.waitForFunction(() =>
    document.getElementById("revision").textContent.includes("Imported"),
  );
  await page.waitForFunction(() => !document.getElementById("save").disabled);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Page must fit a narrow viewport",
  );
  if (process.env.UI_SCREENSHOTS) {
    await mkdir(process.env.UI_SCREENSHOTS, { recursive: true });
    await page.screenshot({
      path: process.env.UI_SCREENSHOTS + "/mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.screenshot({
      path: process.env.UI_SCREENSHOTS + "/desktop.png",
      fullPage: true,
    });
  }
  assert.deepEqual(errors, []);
  console.log(
    "Browser workflows, persistence, exports and responsive layout passed",
  );
} finally {
  await browser.close();
}
