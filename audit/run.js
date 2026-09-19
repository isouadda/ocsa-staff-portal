#!/usr/bin/env node
// npm run audit
//
// One process: build the app, serve the build, drive it on a 375 pixel
// screen, print one table, exit non-zero when anything failed.
//
// The suite reads the app. It never changes it.

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { serve } = require("./serve");
const { launch, openApp } = require("./browser");
const { runScreens } = require("./screens");
const { coverage, SCREEN_CASES, SHEET_CASES, FORM_CASES } = require("./inventory");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, "build");
const PORT = Number(process.env.AUDIT_PORT || 4788);
const BASE = "http://127.0.0.1:" + PORT;

// Results land here, one row per check, and the table is drawn from them.
const results = [];
function record(area, name, ok, detail) {
  results.push({ area: area, name: name, ok: !!ok, detail: detail || "" });
  return !!ok;
}

// npm run build writes src/buildStamp.js, which is a tracked file. The
// suite puts it back exactly as it found it, so a run leaves the working
// tree the way it started.
function buildApp() {
  const stampFile = path.join(ROOT, "src", "buildStamp.js");
  const before = fs.existsSync(stampFile) ? fs.readFileSync(stampFile) : null;
  process.stdout.write("building the app ...\n");
  execFileSync("npm", ["run", "build"], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"], env: Object.assign({}, process.env, { CI: "true" }) });
  if (before !== null) fs.writeFileSync(stampFile, before);
}

function needsBuild() {
  const index = path.join(BUILD, "index.html");
  if (!fs.existsSync(index)) return true;
  const built = fs.statSync(index).mtimeMs;
  const sources = ["src", "public", "package.json"];
  let newest = 0;
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) fs.readdirSync(p).forEach(n => walk(path.join(p, n)));
    else newest = Math.max(newest, st.mtimeMs);
  };
  sources.forEach(s => { const p = path.join(ROOT, s); if (fs.existsSync(p)) walk(p); });
  return newest > built;
}

function table(counts) {
  const line = (k, v) => "  " + k.padEnd(20) + v;
  const out = [];
  out.push("");
  out.push(line("screens covered", counts.screens));
  out.push(line("sheets covered", counts.sheets));
  out.push(line("forms covered", counts.forms));
  out.push(line("journeys", counts.journeys));
  out.push(line("refusals shown", counts.refusals));
  out.push(line("languages x sizes", counts.combinations + " combinations"));
  out.push(line("known failures", String(counts.known)));
  out.push(line("FAILURES", String(counts.failures)));
  out.push("");
  return out.join("\n");
}

(async () => {
  const started = Date.now();
  if (process.argv.indexOf("--no-build") === -1 && needsBuild()) buildApp();
  if (!fs.existsSync(path.join(BUILD, "index.html"))) {
    process.stderr.write("no build to drive. Run npm run build first.\n");
    process.exit(2);
  }

  const server = await serve(BUILD, PORT);
  const browser = await launch();
  let failures = 0;
  const counts = { screens: "0 of 0", sheets: "0 of 0", forms: "0 of 0", journeys: "0 of 0", refusals: "0 of 0", combinations: 0, known: 0, failures: 0 };

  try {
    // The app comes up at all. Everything else depends on this.
    const app = await openApp(browser, BASE, { language: "en" });
    const up = await app.page.evaluate(() => !!document.querySelector(".sp-content"));
    if (!record("harness", "the app comes up", up, up ? "" : "no .sp-content after 20 seconds")) failures += 1;
    if (!record("harness", "no console error on boot", app.problems.length === 0, app.problems.join(" | "))) failures += 1;
    // The clock and the time zone are the ones that catch a date read as
    // UTC midnight: 9:30 PM in New York is already the next day in UTC.
    const clock = await app.page.evaluate(() => ({
      local: new Date().toString().slice(0, 24),
      utcDay: new Date().toISOString().slice(0, 10),
      localDay: new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0") + "-" + String(new Date().getDate()).padStart(2, "0"),
    }));
    const clockOk = clock.localDay === "2026-10-01" && clock.utcDay === "2026-10-02";
    if (!record("harness", "the clock is 9:30 PM New York, a Thursday in October", clockOk, JSON.stringify(clock))) failures += 1;
    await app.context.close();

    // The suite proves its own coverage before it measures anything.
    const cov = coverage();
    cov.missingScreens.forEach((id) => { record("coverage", "NO CASE  screen " + id, false, "add a case to audit/inventory.js"); failures += 1; });
    cov.missingSheets.forEach((s) => { record("coverage", "NO CASE  sheet " + s.id + " (" + (s.label || s.owner) + ")", false, "src/" + s.owner + " line " + s.line); failures += 1; });
    cov.strayScreens.forEach((id) => { record("coverage", "a case drives a screen the app no longer has: " + id, false, ""); failures += 1; });
    cov.straySheets.forEach((id) => { record("coverage", "a case drives a sheet the app no longer has: " + id, false, ""); failures += 1; });

    const sweep = await runScreens(browser, BASE, {});
    counts.screens = sweep.covered.screens.length + " of " + SCREEN_CASES.length;
    counts.sheets = sweep.covered.sheets.length + " of " + SHEET_CASES.length;
    counts.combinations = sweep.combinations;

    sweep.rows.forEach((r) => { record("check", r.where + "  " + r.check, false, r.detail); });
    failures += sweep.rows.length;
  } finally {
    await browser.close();
    server.close();
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  results.filter(r => !r.ok).forEach(r => process.stdout.write("FAIL  " + r.area + "  " + r.name + (r.detail ? "  " + r.detail : "") + "\n"));
  counts.failures = failures;
  process.stdout.write(table(counts));
  process.stdout.write("  ran in " + seconds + "s\n\n");
  process.exit(failures > 0 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
