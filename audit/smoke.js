#!/usr/bin/env node
// npm run smoke
//
// The smoke check (Step 237): a few dozen fast checks that every build
// runs, beside npm run build and npm run guide-check, and keeps green. It
// builds nothing. It serves the build/ that npm run build left, drives it
// in a headless browser against the stub, prints one line for each check,
// PASS or FAIL, and exits non-zero when any check failed or the run took
// three minutes or more.
//
// At 390 wide, in English and in Spanish unless a line says otherwise:
//   - a cleaner signs in; every bar tab opens with no page error and no
//     sideways scroll; every More item opens
//   - Start Shift's screen draws; a form opens from Forms; Help sends a
//     question and shows the stub's answer
//   - /sds draws its list with no sign-in
//   - the sign-in code screen appears when the stub answers secondStep,
//     and the right code signs in; without it, sign-in goes straight in
//   - a cleaner never asks for /api/workspace, even where the API would
//     answer; a supervisor sees Workspace and My assignments
//   - a cleaner sees no Field kit under More and never asks for one of
//     its routes, even where the stub would answer; a supervisor sees
//     Field kit, its site and its four tiles; issues PPE with a signature
//     drawn, which lists the issue first; reads periodic work by state;
//     opens an item's own page from Equipment, checks it, and comes back
//     to the list; and signs a review line, with a refusal said in the
//     API's words
//   - the customer page reads customerFields and photoRoute from the
//     public form answer alone, in the API's as-built shapes: 007 and
//     006 ask the name once in their own question and send photos
//     through the link's route, filed by id; a form answered
//     customerFields null and photoRoute false draws the page's own Your
//     name and Your role and sends its photos inside the filing
//   - a check-off with no signal is kept on the phone and says so, and
//     goes once, with its clientId, when the signal is back (English
//     alone)
//   - an equipment label's page opens, signed in, and Checked, all good
//     sends { kind: "check" }
//   - a periodic task says how often it comes beside its name
//   - a checklist with one touchpoint and one critical touchpoint draws
//     Touchpoint once and Critical touchpoint once, and the critical
//     item's detail draws its chip
//   - a concern link heads itself with the API's customerTitle, takes a
//     photo through its own route, files, and shows the reference, the
//     reply line and the copy line
//   - the request page (Step 252) at 320 wide on the site-wide link asks
//     where, says a refusal under its field, files a request with a photo
//     through its own route and shows the API's thanks, and a second
//     filing of the same category joins it
//   - Client requests (Step 252): an approver's Home card and section,
//     Approve and assign with its picker and the 409 when someone else
//     decided first (English alone); an assignee's request opened from
//     the notice's link, /requests/<id>, the card, I'm on it and Done
//     (English alone)
//   - the supply page (Step 252) signed out, with the sheet in the page
//     and Sign in to record use, and signed in, with Used one and
//     Running low (English alone)
//   - French offered by the stub turns the screen French, and a French
//     screen shows no English the portal drew (French alone)
//   - one page at the Largest text size, 360 wide, with no control cut
//     off or covered (English alone)
//
// The full suite, npm run audit, is a separate command and this file
// changes nothing in it. The stub's switches this check uses are off for
// every other case.

const fs = require("fs");
const path = require("path");
const { serve } = require("./serve");
const { launch, openApp } = require("./browser");
const { createStub, servedFor, ADMIN_PERSON, FORM, TWIN_ES, HELP_ANSWERS, SDS_SHEETS, WS_TODO, SECOND_STEP_CODE, SECOND_STEP_HINT, FORM_A_WORDS, FORM_W_WORDS, EQ_CODE, EQ_ITEM, FORM_N_WORDS, CONCERN_REF,
  API_REFUSALS, requestWord, requestCategoryTitle, REQUEST_REF, SUP_CODE, SUP_ITEM, SUP_SITES } = require("./stub");
const { inspect } = require("./screens");
const { sort: sortKnown } = require("./known");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, "build");
const PORT = Number(process.env.SMOKE_PORT || 4799);
const BASE = "http://127.0.0.1:" + PORT;
const LIMIT_MS = 3 * 60 * 1000;
const STARTED = Date.now();

// The portal's own word tables, read from src/words.js the way the
// screens read them, so a check says each word in the screen's language.
const WORDS = (() => {
  const src = fs.readFileSync(path.join(ROOT, "src", "words.js"), "utf8").replace(/^export (const|function|let) /gm, "$1 ") + "\nmodule.exports = { WORDS };";
  const m = { exports: {} };
  new Function("module", "exports", src)(m, m.exports);
  return m.exports.WORDS;
})();
const say = (lang, en, vars) => String(lang !== "en" && WORDS[lang] && Object.prototype.hasOwnProperty.call(WORDS[lang], en) ? WORDS[lang][en] : en)
  .replace(/\{(\w+)\}/g, (whole, k) => (vars && k in vars ? String(vars[k]) : whole));
// What the stub serves in a language: its Spanish twin, or as written.
const served = (lang, en) => (lang === "es" && TWIN_ES.has(en) ? TWIN_ES.get(en) : en);

// One line per check.
const lines = [];
let failed = 0;
function check(name, ok, detail) {
  const line = (ok ? "PASS " : "FAIL ") + name + (!ok && detail ? ": " + detail : "");
  lines.push(line);
  if (!ok) failed += 1;
  console.log(line);
  return !!ok;
}

// The build this check serves is the one npm run build last wrote. A
// source file newer than it means the check would test old code, so the
// run stops and says so. src/buildStamp.js is rewritten by every build and
// put back after it, and is left out.
function buildIsCurrent() {
  const index = path.join(BUILD, "index.html");
  if (!fs.existsSync(index)) return "there is no build/: run npm run build first";
  const built = fs.statSync(index).mtimeMs;
  let newest = null;
  const walk = (p) => {
    if (p === path.join(ROOT, "src", "buildStamp.js")) return;
    const st = fs.statSync(p);
    if (st.isDirectory()) fs.readdirSync(p).forEach(n => walk(path.join(p, n)));
    else if (st.mtimeMs > built && (!newest || st.mtimeMs > newest.at)) newest = { at: st.mtimeMs, file: path.relative(ROOT, p) };
  };
  ["src", "public", "package.json"].forEach(s => { const p = path.join(ROOT, s); if (fs.existsSync(p)) walk(p); });
  return newest ? newest.file + " is newer than build/: run npm run build first" : null;
}
const stampOf = () => { try { return JSON.parse(fs.readFileSync(path.join(BUILD, "version.json"), "utf8")).stamp; } catch (e) { return undefined; } };

// --- driving the page

const pause = (page, ms) => page.waitForTimeout(ms);
async function waitFor(page, fn, arg, ms) {
  try { await page.waitForFunction(fn, arg, { timeout: ms || 6000 }); return true; } catch (e) { return false; }
}
const barButtons = () => {
  const bar = Array.from(document.querySelectorAll("div")).find((el) => {
    const s = getComputedStyle(el);
    return s.position === "fixed" && s.bottom === "0px" && el.querySelectorAll(":scope > button").length >= 5;
  });
  return bar ? Array.from(bar.querySelectorAll(":scope > button")) : [];
};
const BAR_JS = "(" + barButtons.toString() + ")()";
const hasBar = (page) => page.evaluate(BAR_JS + ".length >= 5");
// A name on the bar or under More, without the count before it.
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim().replace(/^(9\+|\d+)\s*/, "");
async function barNames(page) { return (await page.evaluate(BAR_JS + ".map(b => b.innerText)")).map(clean); }
async function tapBar(page, i) { await page.evaluate("(" + barButtons.toString() + ")()[" + i + "].click()"); await pause(page, 700); }
async function openMore(page) {
  const n = (await barNames(page)).length;
  await tapBar(page, n - 1);
  return (await page.evaluate(() => Array.from(document.querySelectorAll(".sp-more button")).map(b => b.innerText))).map(clean);
}
async function tapMore(page, name) {
  await openMore(page);
  const hit = await page.evaluate((name) => {
    const b = Array.from(document.querySelectorAll(".sp-more button")).find(x => x.innerText.replace(/\s+/g, " ").trim().replace(/^(9\+|\d+)\s*/, "") === name);
    if (b) b.click();
    return !!b;
  }, name);
  await pause(page, 900);
  return hit;
}
const contentText = (page) => page.evaluate(() => { const c = document.querySelector(".sp-content"); return c ? c.innerText : document.body.innerText; });
const sideways = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);

async function open(stubOptions, o) {
  const stub = createStub(stubOptions);
  const app = await openApp(o.browser, BASE, { stub, language: o.language, textSize: o.textSize || "standard", signedIn: !!o.signedIn, path: o.path, buildStamp: stampOf() });
  const errors = [];
  app.page.on("pageerror", (e) => errors.push(String(e && e.message || e).split("\n")[0]));
  await app.page.setViewportSize({ width: o.width || 390, height: 780 });
  await app.page.reload({ waitUntil: "domcontentloaded" });
  await pause(app.page, 1200);
  return Object.assign(app, { stub, errors });
}
async function signIn(page, language) {
  await waitFor(page, () => !!document.querySelector('input[type="password"]'));
  await page.fill('input[autocomplete="username"]', "9001");
  await page.fill('input[type="password"]', "4907");
  await page.evaluate((label) => {
    const b = Array.from(document.querySelectorAll("button")).find(x => x.innerText.trim().toUpperCase() === label.toUpperCase());
    if (b) b.click();
  }, say(language, "Sign In"));
  await pause(page, 1200);
}

// --- the checks

// Every call the field kit makes (Step 246), and none that anything else
// makes: GET /api/forms/my-sites is left out, since Forms reads it too.
const FIELD_KIT_CALL = (c) => /^\/api\/(ppe-issues|periodic-work|equipment)$/.test(c.path) || /^\/api\/sites\/[^/]+$/.test(c.path)
  || (c.path === "/api/supplies" && /[?&]category=ppe(&|$)/.test(c.search)) || (c.path === "/api/inspections/scheduled" && /[?&]awaiting=/.test(c.search))
  || /^\/api\/inspections\/results\/[^/]+\/signatures\//.test(c.path);

// A cleaner, through the whole portal, in one language. The stub would
// answer the workspace and the field kit here too, so a cleaner who asked
// would be seen.
async function cleaner(browser, language) {
  const tag = " (" + language + ")";
  const app = await open({ accountPreferences: { language: language, textSize: "standard" }, clockedIn: false, workspace: true, fieldKit: true }, { browser, language });
  const page = app.page;
  await signIn(page, language);
  const inNow = await waitFor(page, BAR_JS + ".length >= 5");
  check("a cleaner signs in and lands in the portal, with no code screen" + tag, inNow && !(await page.$("#ocsa-code")), inNow ? "the sign-in code screen showed" : "no bottom bar after Sign In");
  if (!inNow) { await app.context.close(); return; }

  // Home, clocked out: Start Shift's screen.
  const home = await contentText(page);
  check("Start Shift's screen draws" + tag, home.indexOf(say(language, "Start Shift")) !== -1, "no " + JSON.stringify(say(language, "Start Shift")) + " on Home");

  // Every bar tab.
  const names = await barNames(page);
  const bad = [];
  for (let i = 0; i < names.length - 1; i += 1) {
    const before = app.errors.length;
    await tapBar(page, i);
    const wide = await sideways(page);
    const words = (await contentText(page)).trim();
    if (app.errors.length > before) bad.push(names[i] + ": " + app.errors[app.errors.length - 1]);
    else if (wide > 1) bad.push(names[i] + ": " + wide + " pixels sideways");
    else if (!words) bad.push(names[i] + ": nothing drawn");
  }
  check("every bar tab opens with no page error and no sideways scroll" + tag + ": " + names.slice(0, -1).join(", "), bad.length === 0, bad.join("; "));

  // Every More item.
  const items = await openMore(page);
  await page.mouse.click(5, 5); await pause(page, 300);
  const badMore = [];
  for (const name of items) {
    const before = app.errors.length;
    if (!(await tapMore(page, name))) { badMore.push(name + ": not under More"); continue; }
    const sheet = await page.$('[role="dialog"]');
    const wide = await sideways(page);
    if (app.errors.length > before) badMore.push(name + ": " + app.errors[app.errors.length - 1]);
    else if (wide > 1) badMore.push(name + ": " + wide + " pixels sideways");
    else if (!sheet && !(await contentText(page)).trim()) badMore.push(name + ": nothing drawn");
    // A sheet, such as Edit shortcuts, is closed the way a person closes it.
    if (sheet) { await page.keyboard.press("Escape"); await page.evaluate((w) => { const b = Array.from(document.querySelectorAll('[role="dialog"] button')).find(x => x.innerText.trim() === w); if (b) b.click(); }, say(language, "Cancel")); await pause(page, 400); }
  }
  check("every More item opens" + tag + ": " + items.join(", "), items.length > 0 && badMore.length === 0, badMore.join("; ") || "More holds nothing");

  // A form from Forms.
  await tapMore(page, say(language, "Forms"));
  const title = served(language, FORM.title);
  const started = await page.evaluate((want) => {
    const card = Array.from(document.querySelectorAll(".sp-content div")).find(d => d.querySelector(":scope > button") && d.textContent.indexOf(want) === 0);
    const b = card && card.querySelector(":scope > button");
    if (b) b.click();
    return !!b;
  }, title);
  const firstLabel = served(language, FORM.fields[0].label);
  const formOpen = started && await waitFor(page, (w) => document.querySelector(".sp-content").innerText.indexOf(w) !== -1, firstLabel);
  check("a form opens from Forms" + tag, formOpen, started ? "no " + JSON.stringify(firstLabel) + " after opening " + JSON.stringify(title) : "no " + JSON.stringify(title) + " on Forms");

  // Help: a question, and the stub's answer.
  const helpAt = (await barNames(page)).indexOf(say(language, "Help"));
  if (helpAt !== -1) await tapBar(page, helpAt);
  const question = "Where are the floor pads kept?";
  app.stub.state.served.add(question);
  const typed = await page.evaluate((v) => {
    const box = document.querySelector(".sp-content textarea");
    if (!box) return false;
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(box, v);
    box.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, question);
  await pause(page, 300);
  await page.evaluate((label) => { const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.getAttribute("aria-label") === label && !x.disabled); if (b) b.click(); }, say(language, "Send"));
  const answer = HELP_ANSWERS.pads.pieces.join("");
  const answered = typed && await waitFor(page, (w) => document.querySelector(".sp-content").innerText.indexOf(w) !== -1, answer, 8000);
  check("Help sends a question and shows the stub's answer" + tag, answered, typed ? "the answer did not show" : "no box on Help");

  // The workspace, never asked for by a cleaner.
  const asked = app.stub.state.calls.filter(c => c.path.indexOf("/api/workspace") === 0).map(c => c.method + " " + c.path);
  check("a cleaner never asks for /api/workspace" + tag, asked.length === 0, asked.join(", "));
  // The field kit, never offered to a cleaner and never asked for.
  const kitAsked = app.stub.state.calls.filter(FIELD_KIT_CALL).map(c => c.method + " " + c.path + c.search);
  check("a cleaner sees no Field kit under More and never asks for one of its routes" + tag, items.indexOf(say(language, "Field kit")) === -1 && kitAsked.length === 0, kitAsked.length ? kitAsked.join(", ") : "Field kit is under More");
  check("no page error anywhere on the way" + tag, app.errors.length === 0, app.errors.slice(0, 3).join("; "));
  await app.context.close();
}

// /sds, with no sign-in.
async function sds(browser, language) {
  const app = await open({ sds: true }, { browser, language, path: "/sds" });
  const listed = await waitFor(app.page, (names) => names.every(n => document.body.innerText.indexOf(n) !== -1), SDS_SHEETS.map(s => s.product));
  const signedOut = !(await hasBar(app.page));
  check("/sds draws its list with no sign-in (" + language + ")", listed && signedOut && app.errors.length === 0, !listed ? "the sheets did not show" : !signedOut ? "the portal's bar showed" : app.errors[0]);
  await app.context.close();
}

// The second sign-in step, when the stub answers secondStep.
async function secondStep(browser, language) {
  const app = await open({ person: ADMIN_PERSON, secondStep: true, accountPreferences: { language: language, textSize: "standard" } }, { browser, language });
  const page = app.page;
  await signIn(page, language);
  const sentence = say(language, "Enter the code we emailed to {0}", { 0: SECOND_STEP_HINT });
  const shown = await waitFor(page, (w) => !!document.querySelector("#ocsa-code") && document.body.innerText.indexOf(w) !== -1, sentence);
  check("the sign-in code screen appears when the stub answers secondStep (" + language + ")", shown, "no code box saying " + JSON.stringify(sentence));
  if (shown) {
    await page.fill("#ocsa-code", SECOND_STEP_CODE);
    const inNow = await waitFor(page, BAR_JS + ".length >= 5");
    check("the right code signs in (" + language + ")", inNow && app.errors.length === 0, inNow ? app.errors[0] : "no bottom bar after the code");
  }
  await app.context.close();
}

// A supervisor, with the workspace and the field kit answering.
async function supervisor(browser, language) {
  const person = Object.assign({}, ADMIN_PERSON, { id: "u-smoke-sup", firstName: "Riley", lastName: "Example", role: "supervisor", badgeNumber: "4801", phone: "0000000008", email: "riley@example.invalid" });
  const app = await open({ person: person, workspace: true, fieldKit: true, equipment: true, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, signedIn: true });
  const page = app.page;
  const items = await openMore(page);
  await page.mouse.click(5, 5); await pause(page, 300);
  const offered = items.indexOf(say(language, "Workspace")) !== -1;
  let mine = false;
  if (offered) {
    await tapMore(page, say(language, "Workspace"));
    mine = await waitFor(page, (w) => { const t = document.querySelector(".sp-content").innerText; return w.every(x => t.toUpperCase().indexOf(x.toUpperCase()) !== -1); }, [say(language, "My assignments"), WS_TODO.title]);
  }
  check("a supervisor sees Workspace under More and My assignments in it (" + language + ")", offered && mine && app.errors.length === 0, !offered ? "no Workspace under More" : !mine ? "no My assignments with its to-do" : app.errors[0]);
  await fieldKit(app, language);
  await app.context.close();
}

// The field kit (Step 246), on the supervisor's own run: under More, on
// a site, with its four tiles.
async function fieldKit(app, language) {
  const page = app.page;
  const tiles = ["Issue PPE", "Periodic work", "Equipment", "Awaiting review"].map(w => say(language, w));
  const kit = await tapMore(page, say(language, "Field kit"));
  const shown = kit && await waitFor(page, (w) => { const c = document.querySelector(".sp-content"); const sel = document.querySelector("#ocsa-fk-site"); return !!c && !!sel && sel.value !== "" && w.every(x => Array.from(c.querySelectorAll("button")).some(b => b.innerText.indexOf(x) !== -1)); }, tiles);
  check("a supervisor sees Field kit under More, on a site, with Issue PPE, Periodic work, Equipment and Awaiting review (" + language + ")", shown && app.errors.length === 0, !kit ? "no Field kit under More" : !shown ? "no site or not every tile" : app.errors[0]);
  if (!shown) return;

  // Issue PPE: a person, an item from the stock, a signature drawn, sent,
  // and the issue at the top of the site's list.
  await openTile(page, tiles[0]);
  const form = await waitFor(page, () => !!document.querySelector("#ocsa-ppe-person option[value]:not([value=''])") && !!document.querySelector('[data-fk-ppe="signature"] canvas'));
  let issued = false;
  if (form) {
    await page.selectOption("#ocsa-ppe-person", { index: 1 });
    await page.selectOption("#ocsa-ppe-item", { index: 1 });
    await sign(page, '[data-fk-ppe="signature"] canvas');
    await page.evaluate((w) => { const b = Array.from(document.querySelectorAll('[data-fk-ppe="form"] button')).find(x => x.innerText.trim() === w); if (b) b.click(); }, say(language, "Issue PPE"));
    issued = await waitFor(page, () => !!document.querySelector('[data-fk-ppe-issue^="ppe-made-"]'));
  }
  const sent = app.stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/ppe-issues");
  const signed = sent.length === 1 && sent[0].signature && sent[0].signature.bytes > 0 && sent[0].body.supplyId && sent[0].body.userId && sent[0].body.siteId;
  check("Issue PPE sends a person, an item from the stock and the signature drawn, once, and lists the issue first (" + language + ")", form && issued && !!signed && app.errors.length === 0, !form ? "the form did not load" : !issued ? "the issue did not show" : !signed ? JSON.stringify(sent.map(c => c.body && Object.keys(c.body))) : app.errors[0]);
  await backToKit(page, language);

  // Periodic work, under Overdue, Due and Done in that order, each row
  // saying where it sits on the checklist.
  await openTile(page, tiles[1]);
  const where = say(language, "On the checklist under {section}", { section: say(language, "This month") });
  const states = await waitFor(page, () => document.querySelectorAll("[data-fk-periodic]").length > 0)
    ? await page.evaluate(() => Array.from(document.querySelectorAll("[data-fk-periodic]")).map(el => el.getAttribute("data-fk-periodic") + ":" + el.querySelectorAll(":scope > div:not([role])").length + ":" + el.innerText))
    : [];
  const byState = states.map(x => x.split(":").slice(0, 2).join(":")).join(" ");
  check("Periodic work lists Overdue, Due and Done in that order, each row saying where it sits on the checklist (" + language + ")", byState === "overdue:1 due:2 done:1" && states[0].indexOf(where) !== -1 && app.errors.length === 0, byState !== "overdue:1 due:2 done:1" ? "found " + JSON.stringify(byState) : states[0].indexOf(where) === -1 ? "no " + JSON.stringify(where) : app.errors[0]);
  await backToKit(page, language);

  // Equipment: the label's own page opened from the list, checked there,
  // and Back comes to the list.
  await openTile(page, tiles[2]);
  const listed = await waitFor(page, (code) => !!document.querySelector('[data-fk-equipment="' + code + '"]'), EQ_CODE);
  if (listed) await page.click('[data-fk-equipment="' + EQ_CODE + '"]');
  const opened = listed && await waitFor(page, (w) => Array.from(document.querySelectorAll(".sp-content button")).some(x => x.innerText.trim() === w), say(language, "Checked, all good"));
  if (opened) await page.evaluate((w) => { const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.innerText.trim() === w); if (b) b.click(); }, say(language, "Checked, all good"));
  const recorded = opened && await waitFor(page, (w) => document.body.innerText.indexOf(w) !== -1, say(language, "Check recorded."));
  const checks = app.stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/equipment/" + EQ_ITEM.id + "/events");
  if (opened) await page.evaluate((w) => { const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.innerText.trim() === w); if (b) b.click(); }, say(language, "Back"));
  const back = opened && await waitFor(page, (code) => !!document.querySelector('[data-fk-equipment="' + code + '"]'), EQ_CODE);
  check("Equipment opens an item's own page from the list, Checked, all good sends { kind: \"check\" } there, and Back comes to the list (" + language + ")", listed && opened && recorded && back && checks.length === 1 && JSON.stringify(checks[0].body) === '{"kind":"check"}' && app.errors.length === 0, !listed ? "the item is not listed" : !opened ? "its page did not open" : !recorded ? "no " + JSON.stringify(say(language, "Check recorded.")) : !back ? "Back did not come to the list" : checks.length !== 1 ? checks.length + " events sent" : app.errors[0]);
  await backToKit(page, language);

  // Awaiting review: a review line signed, and the inspection off the
  // list; then a line someone else signed first, refused in the API's
  // words in the sheet.
  await openTile(page, tiles[3]);
  const reviews = await waitFor(page, () => !!document.querySelector('[data-fk-review="fk-insp-1"]'));
  let lineSigned = false, offList = false, refusedSaid = false;
  const lineButton = '[data-fk-line="reviewer"] button, [data-fk-line="received"] button';
  const signIn = async () => {
    await page.click(lineButton);
    await waitFor(page, () => !!document.querySelector('[role="dialog"] canvas'));
    await sign(page, '[role="dialog"] canvas');
    await page.evaluate((w) => { const b = Array.from(document.querySelectorAll('[role="dialog"] button')).find(x => x.innerText.trim() === w); if (b) b.click(); }, say(language, "Sign"));
  };
  if (reviews) {
    await page.click('[data-fk-review="fk-insp-1"]');
    if (await waitFor(page, (sel) => !!document.querySelector(sel), lineButton)) {
      await signIn();
      lineSigned = await waitFor(page, (who) => { const l = document.querySelector('[data-fk-line="reviewer"]'); return !!l && !l.querySelector("button") && l.innerText.indexOf(who) !== -1 && !document.querySelector('[role="dialog"]'); }, "Riley Example");
    }
    await page.evaluate((w) => { const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.innerText.trim() === w); if (b) b.click(); }, say(language, "Awaiting review"));
    offList = await waitFor(page, () => !!document.querySelector('[data-fk-review="fk-insp-2"]') && !document.querySelector('[data-fk-review="fk-insp-1"]'));
    if (offList) {
      await page.click('[data-fk-review="fk-insp-2"]');
      if (await waitFor(page, (sel) => !!document.querySelector(sel), lineButton)) {
        // Someone else signs it while this phone has it open.
        app.stub.state.reviewSigs["fk-res-2"].push({ line: "received", signer_id: "u-admin", signer_name: "Jordan Office", signed_at: "2026-10-02T01:00:00.000Z" });
        await signIn();
        const said = language === "es" ? "Esa l\u00ednea ya est\u00e1 firmada." : "That line is already signed.";
        refusedSaid = await waitFor(page, (w) => { const a = document.querySelector('[role="dialog"] [role="alert"]'); return !!a && a.innerText.trim() === w; }, said);
        await page.evaluate((w) => { const b = Array.from(document.querySelectorAll('[role="dialog"] button')).find(x => x.innerText.trim() === w); if (b) b.click(); }, say(language, "Cancel"));
        await pause(page, 300);
      }
    }
  }
  const lineCalls = app.stub.state.calls.filter(c => c.method === "POST" && /^\/api\/inspections\/results\//.test(c.path));
  check("Awaiting review signs a review line with a signature drawn, takes the inspection off the list, and says a refusal in the API's words (" + language + ")",
    reviews && lineSigned && offList && refusedSaid && lineCalls.length === 2 && !!lineCalls[0].signature && app.errors.length === 0,
    !reviews ? "the list did not show" : !lineSigned ? "the line did not read signed" : !offList ? "the signed inspection stayed on the list" : !refusedSaid ? "the refusal was not said in the sheet" : lineCalls.length !== 2 ? lineCalls.length + " signatures sent" : app.errors[0]);
  await page.evaluate((w) => { const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.innerText.trim() === w); if (b) b.click(); }, say(language, "Awaiting review"));
  await pause(page, 300);
  await backToKit(page, language);
}
// A tile on the field kit, and Back from one.
async function openTile(page, name) {
  await page.evaluate((w) => { const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.innerText.split("\n")[0].trim() === w); if (b) b.click(); }, name);
  await pause(page, 700);
}
async function backToKit(page, language) {
  await page.evaluate((w) => { const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.innerText.trim() === w); if (b) b.click(); }, say(language, "Field kit"));
  await waitFor(page, () => !!document.querySelector("#ocsa-fk-site"));
}
// A short stroke across a signature box, drawn the way a finger draws it.
async function sign(page, selector) {
  await page.$eval(selector, (el) => el.scrollIntoView({ block: "center" }));
  await pause(page, 200);
  const box = await (await page.$(selector)).boundingBox();
  await page.mouse.move(box.x + 30, box.y + box.height * 0.6);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) await page.mouse.move(box.x + 30 + i * 20, box.y + box.height * (0.6 - (i % 2) * 0.2));
  await page.mouse.up();
  await pause(page, 200);
}

// The customer page (Step 249) reads customerFields and photoRoute from
// the public form answer alone, in the shapes the API answers (Step 242
// as built), and these four checks prove each shape against the stub.
// A photo made on the page, added to the form's photo question.
async function addCustomerPhoto(page, name) {
  const jpg = await page.evaluate(async () => { const c = document.createElement("canvas"); c.width = 800; c.height = 600; const x = c.getContext("2d"); x.fillStyle = "#3a7"; x.fillRect(0, 0, 800, 600); const b = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9)); const a = new Uint8Array(await b.arrayBuffer()); let s = ""; a.forEach(v => { s += String.fromCharCode(v); }); return btoa(s); });
  await page.setInputFiles('input[type="file"][accept="image/*"]', { name: name, mimeType: "image/jpeg", buffer: Buffer.from(jpg, "base64") });
  return waitFor(page, () => Array.from(document.querySelectorAll("img")).some(i => /^data:image/.test(i.src)));
}
const clickWord = (page, label) => page.evaluate((l) => { const b = Array.from(document.querySelectorAll("button")).find(x => x.innerText.trim() === l); if (b) b.click(); return !!b; }, label);
// Next until Send shows, then Send, and the filing the stub took.
async function sendCustomerForm(app, language) {
  const page = app.page;
  for (let i = 0; i < 4 && !(await page.evaluate((s) => Array.from(document.querySelectorAll("button")).some(b => b.innerText.trim() === s), say(language, "Send"))); i += 1) { await clickWord(page, say(language, "Next")); await pause(page, 400); }
  await clickWord(page, say(language, "Send"));
  for (let i = 0; i < 15 && app.stub.state.customerFiled.length === 0; i += 1) await pause(page, 200);
  return app.stub.state.customerFiled[0] || null;
}
// What the page drew for the person: its own Your name or Your role, the
// hidden website field, and how many questions read the form's own label.
const customerLooks = (page, nameLabel) => page.evaluate((nameLabel) => ({
  own: !!document.querySelector('input[autocomplete="name"]') || !!document.querySelector('input[autocomplete="organization-title"]'),
  honeypot: !!document.querySelector('input[name="website"]'),
  named: Array.from(document.querySelectorAll("div")).filter(d => d.firstChild && d.firstChild.nodeType === 3 && d.firstChild.textContent.trim() === nameLabel).length,
}), nameLabel);
const photoPosts = (app, token) => app.stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/public/forms/" + token + "/photos").length;

// OCSA-FRM-007: customerFields { your_name, your_role } and photoRoute
// true. The page asks the name once, in the form's own question, and the
// photo goes through the link's route and is filed by id.
async function customerAsks(browser, language) {
  const w = FORM_A_WORDS[language];
  const app = await open({ customerAsks: true, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, path: "/c/link-asks" });
  const page = app.page;
  const up = await waitFor(page, (title) => document.body.innerText.indexOf(title) !== -1 && document.querySelectorAll('input[type="text"]').length > 0, w.title);
  const looks = await customerLooks(page, w.name);
  const boxes = page.locator('input[type="text"]:not([name="website"])');
  await boxes.nth(0).fill("Invented Org");
  await boxes.nth(1).fill("An invented customer");
  await boxes.nth(2).fill("Facilities");
  await clickWord(page, say(language, "Next")); await pause(page, 400);
  const shown = await addCustomerPhoto(page, "lobby.jpg");
  const got = await sendCustomerForm(app, language);
  await app.context.close();
  const sent = !!got && got.customerName === "An invented customer" && got.customerRole === "Facilities" && got.answers.your_name === "An invented customer" && got.answers.your_role === "Facilities";
  const byId = !!got && JSON.stringify(got.answers.pics) === '["cp-1"]' && photoPosts(app, "link-asks") === 1;
  check("007, customerFields { your_name, your_role } and photoRoute true: the page asks the name once in the form's own question, draws neither of its own, sends them as customerName and customerRole, and the photo goes through the link's route and is filed by id (" + language + ")",
    up && !looks.own && looks.honeypot && looks.named === 1 && shown && sent && byId && app.errors.length === 0,
    !up ? "the form did not open" : looks.own ? "the page's own Your name or Your role showed" : !looks.honeypot ? "no hidden website field" : looks.named !== 1 ? looks.named + " questions read " + JSON.stringify(w.name) : !shown ? "no thumbnail for the photo" : !sent ? "sent " + JSON.stringify(got || null) : !byId ? "photos filed as " + JSON.stringify(got.answers.pics) + " after " + photoPosts(app, "link-asks") + " uploads" : app.errors[0]);
}

// OCSA-FRM-006: customerFields { completed_by, role null } and photoRoute
// true. One question takes the name and role, asked once and required;
// the role sent is empty; the photo goes through the route.
async function customerWalk(browser, language) {
  const w = FORM_W_WORDS[language];
  const app = await open({ customerAsks: true, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, path: "/c/link-walk" });
  const page = app.page;
  const up = await waitFor(page, (title) => document.body.innerText.indexOf(title) !== -1 && document.querySelectorAll('input[type="text"]').length > 0, w.title);
  const looks = await customerLooks(page, w.who);
  await page.locator('input[type="text"]:not([name="website"])').nth(0).fill("An invented customer, Facilities");
  await clickWord(page, say(language, "Next")); await pause(page, 400);
  const shown = await addCustomerPhoto(page, "hall.jpg");
  const got = await sendCustomerForm(app, language);
  await app.context.close();
  const sent = !!got && got.customerName === "An invented customer, Facilities" && got.customerRole === "" && got.answers.completed_by === "An invented customer, Facilities";
  const byId = !!got && JSON.stringify(got.answers.pics) === '["cp-1"]' && photoPosts(app, "link-walk") === 1;
  check("006, customerFields { completed_by, role null } and photoRoute true: the page asks the one question once, draws neither of its own, sends it as customerName with no customerRole, and the photo goes through the link's route and is filed by id (" + language + ")",
    up && !looks.own && looks.honeypot && looks.named === 1 && shown && sent && byId && app.errors.length === 0,
    !up ? "the form did not open" : looks.own ? "the page's own Your name or Your role showed" : !looks.honeypot ? "no hidden website field" : looks.named !== 1 ? looks.named + " questions read " + JSON.stringify(w.who) : !shown ? "no thumbnail for the photo" : !sent ? "sent " + JSON.stringify(got || null) : !byId ? "photos filed as " + JSON.stringify(got.answers.pics) + " after " + photoPosts(app, "link-walk") + " uploads" : app.errors[0]);
}

// A form the API's map does not name: customerFields null and photoRoute
// false. The page draws its own Your name and Your role, and the photo
// goes inside the filing as a data URL, with no call to the photo route.
async function customerOwn(browser, language) {
  const app = await open({ accountPreferences: { language: language, textSize: "standard" } }, { browser, language, path: "/c/link-survey" });
  const page = app.page;
  const up = await waitFor(page, () => document.querySelectorAll('input[type="text"]').length > 0);
  const kept = await page.evaluate(() => !!document.querySelector('input[autocomplete="name"]') && !!document.querySelector('input[autocomplete="organization-title"]') && !!document.querySelector('input[name="website"]'));
  if (kept) { await page.fill('input[autocomplete="name"]', "An invented customer"); await page.fill('input[autocomplete="organization-title"]', "Facilities"); }
  await page.locator('input[type="text"]:not([name="website"]):not([autocomplete="name"]):not([autocomplete="organization-title"])').nth(0).fill("Invented Org");
  await clickWord(page, say(language, "Next")); await pause(page, 400);
  const shown = await addCustomerPhoto(page, "desk.jpg");
  const got = await sendCustomerForm(app, language);
  await app.context.close();
  const inside = !!got && Array.isArray(got.answers.pics) && got.answers.pics.length === 1 && got.answers.pics[0].bytes > 0 && !!got.answers.pics[0].kind && photoPosts(app, "link-survey") === 0;
  const sent = !!got && got.customerName === "An invented customer" && got.customerRole === "Facilities" && got.body.customerName === "An invented customer";
  check("a form with customerFields null and photoRoute false: the page draws its own Your name and Your role and sends them, and the photo goes inside the filing with no call to the photo route (" + language + ")",
    up && kept && shown && sent && inside && app.errors.length === 0,
    !up ? "the form did not open" : !kept ? "the page's own Your name and Your role did not show" : !shown ? "no thumbnail for the photo" : !sent ? "sent " + JSON.stringify(got || null) : !inside ? "photos filed as " + JSON.stringify(got.answers.pics) + " after " + photoPosts(app, "link-survey") + " uploads" : app.errors[0]);
}

// A check-off with no signal (Step 240): kept, said, and sent once later.
async function noSignal(browser) {
  const app = await open({ accountPreferences: { language: "en", textSize: "standard" } }, { browser, language: "en", signedIn: true });
  const page = app.page;
  await tapBar(page, 2);
  const open1 = await waitFor(page, () => !!document.querySelector('.sp-content button[aria-label^="Mark "][aria-label$=" done"]:not([aria-label$=" not done"])'));
  app.stub.state.offline = true;
  const tapped = await page.evaluate(() => { const b = document.querySelector('.sp-content button[aria-label^="Mark "][aria-label$=" done"]:not([aria-label$=" not done"])'); if (b) b.click(); return b ? b.getAttribute("aria-label") : null; });
  const line = say("en", "Saved on this phone. It sends when you have signal.");
  const said = await waitFor(page, (w) => document.body.innerText.indexOf(w) !== -1, line);
  const kept = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("ocsa-pending-checkoffs") || "[]"); } catch (e) { return []; } });
  const from = app.stub.state.calls.length;
  app.stub.state.offline = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const gone = await waitFor(page, (w) => document.body.innerText.indexOf(w) === -1 && !localStorage.getItem("ocsa-pending-checkoffs"), line);
  await pause(page, 600);
  const sent = app.stub.state.calls.slice(from).filter(c => c.method === "POST" && /^\/api\/clock\/tasks\/[^/]+\/complete$/.test(c.path));
  const once = kept.length === 1 && sent.length === 1 && sent[0].body && sent[0].body.clientId === kept[0].clientId && typeof sent[0].body.completedAt === "string";
  check("a check-off with no signal is kept on the phone and says so, and goes once with its clientId when the signal is back", open1 && !!tapped && said && gone && once && app.errors.length === 0,
    !open1 ? "no unchecked task" : !said ? "no line saying it was saved" : kept.length !== 1 ? kept.length + " kept" : !gone ? "the line or the queue stayed" : !once ? sent.length + " sent: " + JSON.stringify(sent.map(c => c.body)) : app.errors[0]);
  await app.context.close();
}

// An equipment label's page (Step 240).
async function equipment(browser, language) {
  const app = await open({ equipment: true, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, signedIn: true, path: "/eq/" + EQ_CODE });
  const page = app.page;
  // open() reloads after the first load has put the address back to /,
  // so the label is opened again, the way a second scan would.
  await page.goto(BASE + "/eq/" + EQ_CODE, { waitUntil: "domcontentloaded" });
  const up = await waitFor(page, (w) => { const c = document.querySelector(".sp-content"); return !!c && c.innerText.indexOf(w.name) !== -1 && w.buttons.every(b => Array.from(c.querySelectorAll("button")).some(x => x.innerText.trim() === b)); }, { name: EQ_ITEM.name, buttons: [say(language, "Checked, all good"), say(language, "Tag out")] });
  const home = await page.evaluate(() => window.location.pathname === "/");
  const from = app.stub.state.calls.length;
  await page.evaluate((w) => { const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.innerText.trim() === w); if (b) b.click(); }, say(language, "Checked, all good"));
  const recorded = await waitFor(page, (w) => document.body.innerText.indexOf(w) !== -1, say(language, "Check recorded."));
  const posts = app.stub.state.calls.slice(from).filter(c => c.method === "POST" && c.path === "/api/equipment/" + EQ_ITEM.id + "/events");
  const asked = app.stub.state.calls.some(c => c.method === "GET" && c.path === "/api/equipment/by-qr/" + EQ_CODE && new RegExp("locale=" + language).test(c.search));
  check("an equipment label's page opens with its name, Checked, all good and Tag out, and Checked, all good sends { kind: \"check\" } (" + language + ")",
    up && home && asked && recorded && posts.length === 1 && JSON.stringify(posts[0].body) === '{"kind":"check"}' && app.errors.length === 0,
    !up ? "the item or its buttons did not show" : !home ? "the address stayed on /eq" : !asked ? "no GET /api/equipment/by-qr with ?locale=" + language : !recorded ? "no " + JSON.stringify(say(language, "Check recorded.")) : posts.length !== 1 ? posts.length + " events sent" : JSON.stringify(posts[0].body) !== '{"kind":"check"}' ? "sent " + JSON.stringify(posts[0].body) : app.errors[0]);
  await app.context.close();
}

// Periodic work says how often it comes (Step 240).
async function periodic(browser, language) {
  const app = await open({ site: "site-west", shiftLabel: "Night shift", accountPreferences: { language: language, textSize: "standard" } }, { browser, language, signedIn: true });
  const page = app.page;
  await tapBar(page, 2);
  const words = ["Weekly", "Every two weeks", "Monthly", "Quarterly", "Seasonal"].map(w => say(language, w));
  const shown = await waitFor(page, (want) => { const chips = Array.from(document.querySelectorAll(".sp-content span")).map(x => x.innerText.trim()); return want.every(w => chips.indexOf(w) !== -1); }, words);
  check("a periodic task says how often it comes beside its name: " + words.join(", ") + " (" + language + ")", shown && app.errors.length === 0, shown ? app.errors[0] : "not every word showed");
  await app.context.close();
}

// The concern link (Step 244), OCSA-FRM-009 on customerFields
// { client_name, client_role } and photoRoute true: a photo through the
// link's own route, the filing, and the receipt.
async function concern(browser, language) {
  const w = FORM_N_WORDS[language];
  const app = await open({ concern: true, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, path: "/c/link-concern" });
  const page = app.page;
  const up = await waitFor(page, (title) => document.body.innerText.indexOf(title) !== -1 && document.querySelectorAll('input[type="text"]').length > 0, w.title);
  const office = await page.evaluate((t) => document.body.innerText.indexOf(t) !== -1, w.officeTitle);
  const own = await page.evaluate(() => !!document.querySelector('input[autocomplete="name"]') || !!document.querySelector('input[autocomplete="organization-title"]'));
  const boxes = page.locator('input[type="text"]:not([name="website"])');
  await boxes.nth(0).fill("An invented customer");
  await boxes.nth(1).fill("Facilities");
  await boxes.nth(2).fill("invented@example.invalid");
  const click = (label) => page.evaluate((l) => { const b = Array.from(document.querySelectorAll("button")).find(x => x.innerText.trim() === l); if (b) b.click(); return !!b; }, label);
  await click(say(language, "Next"));
  await pause(page, 500);
  await page.locator("textarea").first().fill("The lobby floor was wet with no sign, invented.");
  await click(w.no);
  const jpg = await page.evaluate(async () => { const c = document.createElement("canvas"); c.width = 800; c.height = 600; const x = c.getContext("2d"); x.fillStyle = "#3a7"; x.fillRect(0, 0, 800, 600); const b = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9)); const a = new Uint8Array(await b.arrayBuffer()); let s = ""; a.forEach(v => { s += String.fromCharCode(v); }); return btoa(s); });
  await page.setInputFiles('input[type="file"][accept="image/*"]', { name: "lobby.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpg, "base64") });
  const shown = await waitFor(page, () => !!document.querySelector(".sp-content img, img[alt=\"\"]") && Array.from(document.querySelectorAll("img")).some(i => /^data:image/.test(i.src)));
  for (let i = 0; i < 3 && !(await page.evaluate((s) => Array.from(document.querySelectorAll("button")).some(b => b.innerText.trim() === s), say(language, "Send"))); i += 1) { await click(say(language, "Next")); await pause(page, 400); }
  await click(say(language, "Send"));
  const lines = [w.title, say(language, "Thank you. Your reference is {ref}.", { ref: CONCERN_REF }), say(language, "We will reply within five working days."), say(language, "A copy is on its way to your email.")];
  const thanked = await waitFor(page, (want) => want.every(x => document.body.innerText.indexOf(x) !== -1), lines);
  const filed = app.stub.state.customerFiled[0];
  const sent = !!filed && app.stub.state.linkPhotos.length === 1 && JSON.stringify(filed.answers.photos) === '["cp-1"]' && filed.customerName === "An invented customer" && filed.body.website === "";
  check("a concern link heads itself and its thank-you with customerTitle, takes a photo through its own route, files it by id, and shows the reference, the reply line and the copy line (" + language + ")",
    up && !office && !own && shown && thanked && sent && app.errors.length === 0,
    !up ? "the form did not open" : office ? "the form's own title " + JSON.stringify(w.officeTitle) + " showed" : own ? "the page's own Your name or Your role showed" : !shown ? "no thumbnail for the photo" : !thanked ? "the thank-you did not read " + JSON.stringify(lines) : !sent ? "filed " + JSON.stringify(filed || null) + " photos " + app.stub.state.linkPhotos.length : app.errors[0]);
  await app.context.close();
}

// Touchpoint chips (Step 249): the north list has one touchpoint and one
// critical touchpoint, and the list draws Touchpoint once and Critical
// touchpoint once; the critical item's detail draws its chip too.
async function touchpoints(browser, language) {
  const app = await open({ accountPreferences: { language: language, textSize: "standard" } }, { browser, language, signedIn: true });
  const page = app.page;
  await tapBar(page, 2);
  const words = ["Touchpoint", "Critical touchpoint"].map(w => say(language, w));
  const chipsOf = (want) => Array.from(document.querySelectorAll(".sp-content span")).map(x => x.innerText.trim()).filter(v => want.indexOf(v) !== -1);
  const listed = await waitFor(page, "(" + chipsOf.toString() + ")(" + JSON.stringify(words) + ").length >= 2");
  const chips = listed ? await page.evaluate("(" + chipsOf.toString() + ")(" + JSON.stringify(words) + ")") : [];
  const once = chips.filter(c => c === words[0]).length === 1 && chips.filter(c => c === words[1]).length === 1;
  // The critical row's name opens its detail, which draws the chip beside
  // the name, with PRIORITY, since that item is high priority too.
  if (once) await page.evaluate((w) => { const chip = Array.from(document.querySelectorAll(".sp-content span")).find(x => x.innerText.trim() === w); const row = chip.parentElement.parentElement; row.querySelectorAll("button")[1].click(); }, words[1]);
  const detail = once && await waitFor(page, (w) => { const c = document.querySelector(".sp-content"); return !!c && c.innerText.indexOf(w.back) !== -1 && w.chips.every(x => Array.from(c.querySelectorAll("span")).some(s => s.innerText.trim() === x)); }, { back: say(language, "Back to checklist"), chips: [words[1], say(language, "PRIORITY")] });
  check("a checklist with one touchpoint and one critical touchpoint draws Touchpoint once and Critical touchpoint once, and the critical item's detail draws its chip beside PRIORITY (" + language + ")", once && detail && app.errors.length === 0, !once ? "found " + JSON.stringify(chips) : !detail ? "the detail did not draw the chip" : app.errors[0]);
  await app.context.close();
}

// French, offered by the stub.
async function french(browser) {
  const app = await open({ languages: ["en", "es", "fr"], accountPreferences: { language: "fr", textSize: "standard" } }, { browser, language: "fr", signedIn: true });
  const page = app.page;
  // The first load learns that French is offered; the next one draws it.
  await page.reload({ waitUntil: "domcontentloaded" });
  await pause(page, 1500);
  const names = await barNames(page);
  const isFrench = names[0] === say("fr", "Home") && (await page.evaluate(() => document.documentElement.lang)) === "fr";
  check("French offered by the stub turns the screen French", isFrench, "the bar reads " + names.join(", "));
  // Every word the portal drew itself on the bar's screens: none may be
  // the English of a word whose French differs. What the stub served is
  // the API's, and is left out.
  const english = new Set(Object.keys(WORDS.fr).filter(k => WORDS.fr[k] !== k && /[a-z]{3}/i.test(k)));
  const fromApi = new Set();
  const found = [];
  for (let i = 0; i < names.length - 1; i += 1) {
    await tapBar(page, i);
    const st = servedFor(app.stub);
    st.names.concat(st.words.map(w => w.value)).forEach(v => fromApi.add(String(v).trim()));
    const texts = await page.evaluate(() => {
      const out = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = walk.nextNode())) { const v = n.textContent.trim(); const el = n.parentElement; if (v && el && el.offsetParent !== null) out.push(v); }
      document.querySelectorAll("[aria-label], [placeholder]").forEach(el => { ["aria-label", "placeholder"].forEach(a => { const v = (el.getAttribute(a) || "").trim(); if (v) out.push(v); }); });
      return out;
    });
    texts.forEach(v => { if (english.has(v) && !fromApi.has(v)) found.push(names[i] + ": " + JSON.stringify(v)); });
  }
  check("a French screen shows no English the portal drew: " + names.slice(0, -1).join(", "), found.length === 0 && app.errors.length === 0, found.slice(0, 5).join("; ") || app.errors[0]);
  await app.context.close();
}

// The request page (Step 252), at 320 wide on the site-wide link: a
// refusal under its field, a filing with a photo, and a second filing
// that joins the first.
async function requestPage(browser, language) {
  const app = await open({ requests: true, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, width: 320, path: "/r/req-site" });
  const page = app.page;
  const up = await waitFor(page, (w) => document.body.innerText.indexOf(w.title) !== -1 && !!document.querySelector("#ocsa-request-area") && document.querySelectorAll("[data-request-category]").length === 5, { title: requestWord(language, "title") });
  const file = async () => {
    await page.fill("#ocsa-request-area", "Third floor kitchen");
    await page.click('[data-request-category="spill"]');
    await page.fill("#ocsa-request-note", "Water by the sinks, invented.");
  };
  await file();
  await addCustomerPhoto(page, "sink.jpg");
  await waitFor(page, () => document.body.innerText.indexOf("sink.jpg") !== -1);
  await page.fill("#ocsa-request-email", "bad@");
  await clickWord(page, say(language, "Send"));
  const refusal = API_REFUSALS["customer.request.badEmail"][language === "es" ? "es" : "en"];
  const under = await waitFor(page, (w) => { const box = document.querySelector("#ocsa-request-email"); const alert = box && box.parentElement.querySelector('[role="alert"]'); return !!alert && alert.innerText.trim() === w && box.value === "bad@"; }, refusal);
  await page.fill("#ocsa-request-email", "invented@example.invalid");
  await clickWord(page, say(language, "Send"));
  const lines = ["thanks", "ref", "mail"].map(k => requestWord(language, k, { reference: REQUEST_REF }));
  const thanked = await waitFor(page, (want) => want.every(x => document.body.innerText.indexOf(x) !== -1) && !document.querySelector("#ocsa-request-area"), lines);
  const concern = await page.evaluate((w) => Array.from(document.querySelectorAll("a")).some(a => a.innerText.trim() === w && /\/c\/link-concern$/.test(a.getAttribute("href"))), say(language, "Report a concern instead"));
  const wide = await sideways(page);
  // A second filing of the same category joins the first.
  await page.goto(BASE + "/r/req-site", { waitUntil: "domcontentloaded" });
  await waitFor(page, () => !!document.querySelector("#ocsa-request-area"));
  await file();
  await clickWord(page, say(language, "Send"));
  const joined = await waitFor(page, (w) => document.body.innerText.indexOf(w) !== -1, requestWord(language, "joined"));
  const filed = app.stub.state.requestsFiled;
  const sent = filed.length === 2 && filed[0].category === "spill" && filed[0].area === "Third floor kitchen" && JSON.stringify(filed[0].photos) === '[{"id":"rp-1","name":"sink.jpg"}]' && filed[0].email === "invented@example.invalid" && filed[0].body.website === "" && filed[0].joined === false && filed[1].joined === true;
  const posts = app.stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/public/requests/req-site").length;
  check("the request page at 320 asks where on the site-wide link, says a refusal under its field, files a request with a photo through its own route, named as { id, name }, and shows the API's thanks with Report a concern instead, and a second filing of the same category joins it (" + language + ")",
    up && under && thanked && concern && wide <= 1 && joined && sent && posts === 3 && app.errors.length === 0,
    !up ? "the page did not open" : !under ? "no " + JSON.stringify(refusal) + " under the email" : !thanked ? "the thanks did not read " + JSON.stringify(lines) : !concern ? "no Report a concern instead" : wide > 1 ? wide + " pixels sideways" : !joined ? "the join did not read " + JSON.stringify(requestWord(language, "joined")) : !sent ? "filed " + JSON.stringify(filed.map(f => Object.assign({}, f, { body: undefined }))) : posts !== 3 ? posts + " filings sent" : app.errors[0]);
  await app.context.close();
}

// Client requests (Step 252) for an approver: Home's card, the section,
// Approve and assign with its picker, and the 409 when someone else
// decided first.
async function requestsApprover(browser, language) {
  const person = Object.assign({}, ADMIN_PERSON, { id: "u-smoke-sup", firstName: "Riley", lastName: "Example", role: "supervisor", badgeNumber: "4801", phone: "0000000008", email: "riley@example.invalid" });
  const app = await open({ requests: true, person: person, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, signedIn: true });
  const page = app.page;
  const card = await waitFor(page, (w) => { const b = document.querySelector('[data-request-card="home"]'); return !!b && b.innerText.trim() === w; }, say(language, "{n} client requests need you", { n: 3 }));
  if (card) await page.click('[data-request-card="home"]');
  const section = card && await waitFor(page, (w) => { const s = document.querySelector('[data-request-section="client"]'); return !!s && s.innerText.toUpperCase().indexOf(w.waiting.toUpperCase()) !== -1 && s.innerText.indexOf(w.spill) !== -1 && !!document.querySelector('[data-request-row="cr-1"]') && !!document.querySelector('[data-request-row="cr-2"]'); }, { waiting: say(language, "Waiting for approval"), spill: requestCategoryTitle("spill", language) });
  let picker = false, assigned = false, taken = false;
  const approve = async (id) => {
    await page.evaluate((w) => { const row = document.querySelector('[data-request-row="' + w.id + '"]'); const b = row && Array.from(row.querySelectorAll("button")).find(x => x.innerText.trim() === w.label); if (b) b.click(); }, { id: id, label: say(language, "Approve and assign") });
    await waitFor(page, () => !!document.querySelector('[data-request-assignee="u-two"]'));
  };
  if (section) {
    await approve("cr-1");
    picker = await page.evaluate((w) => { const rows = Array.from(document.querySelectorAll("[data-request-assignee]")); return rows.length === 3 && rows[0].getAttribute("data-request-assignee") === "u-two" && rows[0].innerText.indexOf(w.onShift) !== -1 && rows[1].innerText.indexOf("(" + w.me + ")") !== -1; }, { onShift: say(language, "On shift"), me: say(language, "Me") });
    await page.click('[data-request-assignee="u-two"]');
    await waitFor(page, () => !!document.querySelector('[data-request-assignee="u-two"][aria-pressed="true"]'));
    await page.evaluate((w) => { const b = Array.from(document.querySelectorAll('[role="dialog"] button')).find(x => x.innerText.trim() === w && !x.disabled); if (b) b.click(); }, say(language, "Assign"));
    assigned = await waitFor(page, () => !document.querySelector('[role="dialog"]') && !document.querySelector('[data-request-row="cr-1"]') && !!document.querySelector('[data-request-row="cr-2"]'));
    // Someone else decides cr-2 first.
    app.stub.state.requestsTaken.push("cr-2");
    await approve("cr-2");
    await page.click('[data-request-assignee="u-two"]');
    await waitFor(page, () => !!document.querySelector('[data-request-assignee="u-two"][aria-pressed="true"]'));
    await page.evaluate((w) => { const b = Array.from(document.querySelectorAll('[role="dialog"] button')).find(x => x.innerText.trim() === w && !x.disabled); if (b) b.click(); }, say(language, "Assign"));
    taken = await waitFor(page, (w) => document.body.innerText.indexOf(w) !== -1 && !document.querySelector('[data-request-row="cr-2"]'), say(language, "{name} already took care of this.", { name: "Jordan Office" }));
  }
  const approvals = app.stub.state.calls.filter(c => c.method === "POST" && /^\/api\/issues\/cr-[12]\/approve$/.test(c.path));
  const sent = approvals.length === 2 && approvals.every(c => c.body && c.body.assignedTo === "u-two");
  check("Client requests for an approver: Home's card counts three, Report lists Waiting for approval, Approve and assign offers the on-shift person first and the approver as Me, Assign posts /approve and drops the row, and a 409 alreadyDecided says who took it and drops the row (" + language + ")",
    card && section && picker && assigned && taken && sent && app.errors.length === 0,
    !card ? "no Home card" : !section ? "the section did not list both waiting requests" : !picker ? "the picker did not read on shift first with Me" : !assigned ? "the approved row did not drop" : !taken ? "the 409 was not said or the row stayed" : !sent ? JSON.stringify(approvals.map(c => c.body)) : app.errors[0]);
  await app.context.close();
}

// Client requests for an assignee, opened from the notice's own link,
// /requests/<id>: I'm on it, then Done with a note.
async function requestsAssignee(browser, language) {
  const app = await open({ requests: true, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, signedIn: true, path: "/requests/cr-3" });
  const page = app.page;
  // open() reloads after the first load has put the address back to /,
  // so the link is opened again, the way a tap on the alert would.
  await page.goto(BASE + "/requests/cr-3", { waitUntil: "domcontentloaded" });
  const linked = await waitFor(page, () => !!document.querySelector('[data-request-row="cr-3"]') && window.location.pathname === "/" && !document.querySelector('[data-request-card="home"]'));
  await tapBar(page, 0);
  const card = linked && await waitFor(page, (w) => { const b = document.querySelector('[data-request-card="home"]'); return !!b && b.innerText.trim() === w; }, say(language, "1 client request needs you"));
  if (card) await page.click('[data-request-card="home"]');
  // The heading is drawn in capitals, so it is read without case.
  const row = card && await waitFor(page, (w) => { const s = document.querySelector('[data-request-section="client"]'); const r = document.querySelector('[data-request-row="cr-3"]'); return !!s && s.innerText.toUpperCase().indexOf(w.yours.toUpperCase()) !== -1 && !!r && r.innerText.indexOf(w.title) !== -1 && Array.from(r.querySelectorAll("button")).map(b => b.innerText.trim()).join("|") === w.buttons; }, { yours: say(language, "Yours"), title: requestCategoryTitle("cleaning", language), buttons: [say(language, "I'm on it"), say(language, "Done"), say(language, "Can't finish")].join("|") });
  let started = false, done = false;
  if (row) {
    await page.evaluate((w) => { const r = document.querySelector('[data-request-row="cr-3"]'); const b = Array.from(r.querySelectorAll("button")).find(x => x.innerText.trim() === w); if (b) b.click(); }, say(language, "I'm on it"));
    started = await waitFor(page, (w) => { const r = document.querySelector('[data-request-row="cr-3"]'); return !!r && Array.from(r.querySelectorAll("button")).map(b => b.innerText.trim()).join("|") === w; }, [say(language, "Done"), say(language, "Can't finish")].join("|"));
    await page.evaluate((w) => { const r = document.querySelector('[data-request-row="cr-3"]'); const b = Array.from(r.querySelectorAll("button")).find(x => x.innerText.trim() === w); if (b) b.click(); }, say(language, "Done"));
    await waitFor(page, () => !!document.querySelector("#ocsa-request-done-note"));
    await page.fill("#ocsa-request-done-note", "Emptied and wiped, invented.");
    await page.evaluate((w) => { const b = Array.from(document.querySelectorAll('[role="dialog"] button')).find(x => x.innerText.trim() === w); if (b) b.click(); }, say(language, "Done"));
    done = await waitFor(page, () => !document.querySelector('[role="dialog"]') && !document.querySelector('[data-request-section="client"]'));
  }
  const progress = app.stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/issues/cr-3/progress").map(c => c.body);
  const sent = JSON.stringify(progress) === '[{"action":"start"},{"action":"done","note":"Emptied and wiped, invented."}]';
  await tapBar(page, 0);
  const cardGone = await waitFor(page, () => !document.querySelector('[data-request-card="home"]'));
  check("Client requests for an assignee: /requests/<id> opens Report on that request and puts the address back to /, Home's card counts one, Report lists it under Yours with I'm on it, Done and Can't finish, I'm on it posts start, Done takes a note and posts done, and the section and the card go (" + language + ")",
    linked && card && row && started && done && sent && cardGone && app.errors.length === 0,
    !linked ? "/requests/cr-3 did not open the request" : !card ? "no Home card" : !row ? "the row did not read as expected" : !started ? "I'm on it did not take the button away" : !done ? "the section stayed after Done" : !sent ? JSON.stringify(progress) : !cardGone ? "the Home card stayed" : app.errors[0]);
  await app.context.close();
}

// The supply page (Step 252): signed out, the sheet in the page and Sign
// in to record use; signed in, Used one and Running low.
async function supplyPage(browser, language) {
  const out = await open({ supplyQr: true, sds: true, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, signedIn: false, path: "/sup/" + SUP_CODE });
  const page = out.page;
  const up = await waitFor(page, (w) => document.body.innerText.indexOf(w.name) !== -1 && document.body.innerText.indexOf(w.maker) !== -1 && !!document.querySelector('[data-supply="sheet"]') && Array.from(document.querySelectorAll("button")).some(b => b.innerText.trim() === w.signIn), { name: SUP_ITEM.name, maker: SUP_ITEM.maker, signIn: say(language, "Sign in to record use") });
  if (up) await page.click('[data-supply="sheet"]');
  const sheet = up && await waitFor(page, (w) => document.body.innerText.indexOf(w) !== -1 && !document.querySelector('[data-supply="staff"]'), SDS_SHEETS[1].product);
  const noStaffCall = !out.stub.state.calls.some(c => c.path.indexOf("/api/supplies/by-qr/") === 0);
  const signedOut = !(await hasBar(page));
  await out.context.close();
  const app = await open({ supplyQr: true, sds: true, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, signedIn: true, path: "/sup/" + SUP_CODE });
  const p2 = app.page;
  const staff = await waitFor(p2, (w) => !!document.querySelector('[data-supply="used"]') && !!document.querySelector('[data-supply="low"]') && document.body.innerText.indexOf(w) !== -1, SUP_SITES[0].siteName);
  let used = false, low = false;
  if (staff) {
    await p2.click('[aria-label="' + say(language, "One more") + '"]');
    await p2.click('[data-supply="used"]');
    used = await waitFor(p2, (w) => document.body.innerText.indexOf(w) !== -1, "Usage logged");
    await p2.click('[data-supply="low"]');
    await waitFor(p2, () => !!document.querySelector("#ocsa-supply-note"));
    await p2.fill("#ocsa-supply-note", "Two bottles left, invented.");
    await p2.click('[data-supply="low-send"]');
    low = await waitFor(p2, (w) => document.body.innerText.indexOf(w) !== -1 && !document.querySelector("#ocsa-supply-note"), say(language, "Request submitted"));
  }
  const usage = app.stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/supplies/log-usage").map(c => c.body);
  const asks = app.stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/supplies/requests").map(c => c.body);
  const sent = JSON.stringify(usage) === '[{"supplyId":"sup-qr","quantity":2,"siteId":"site-north","scanMethod":"qr_scan"}]' && asks.length === 1 && asks[0].requestType === "refill" && asks[0].urgency === "normal" && asks[0].supplyId === "sup-qr" && asks[0].siteId === "site-north" && asks[0].description === "Two bottles left, invented.";
  check("the supply page signed out shows the product, its maker, Safety sheet, which opens the library's sheet in the page, and Sign in to record use, asking for nothing behind a token; signed in, Used one posts log-usage with the count and scanMethod qr_scan, and Running low posts a refill request at normal urgency with its note (" + language + ")",
    up && sheet && noStaffCall && signedOut && staff && used && low && sent && app.errors.length === 0 && out.errors.length === 0,
    !up ? "the page did not open" : !sheet ? "the sheet did not open in the page" : !noStaffCall ? "a signed-out page asked for /api/supplies/by-qr" : !signedOut ? "the portal's bar showed" : !staff ? "the staff part did not show" : !used ? "Used one did not show the API's answer" : !low ? "Running low did not show the API's answer" : !sent ? JSON.stringify({ usage, asks }) : (app.errors[0] || out.errors[0]));
  await app.context.close();
}

// The Largest text size on a narrow phone: no control cut off or covered.
async function largest(browser) {
  const app = await open({ accountPreferences: { language: "en", textSize: "largest" } }, { browser, language: "en", textSize: "largest", signedIn: true, width: 360 });
  const rows = (await inspect(app.page, null, "Home", "en", "largest", app.stub, "dark")).filter(r => r.check === "clipped" || r.check === "unreachable" || r.check === "sideways");
  const fresh = sortKnown(rows).fresh;
  check("Home at the Largest text size, 360 wide, has no control cut off or covered", fresh.length === 0, fresh.slice(0, 3).map(r => r.check + ": " + r.detail).join("; "));
  await app.context.close();
}

(async () => {
  const stale = buildIsCurrent();
  if (stale) { check("the build is current", false, stale); process.exit(1); }
  const server = await serve(BUILD, PORT);
  const browser = await launch();
  const guard = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, "threw " + String(e && e.message || e).split("\n")[0]); } };
  try {
    for (const language of ["en", "es"]) await guard("a cleaner's run (" + language + ")", () => cleaner(browser, language));
    for (const language of ["en", "es"]) await guard("/sds (" + language + ")", () => sds(browser, language));
    for (const language of ["en", "es"]) await guard("the second sign-in step (" + language + ")", () => secondStep(browser, language));
    for (const language of ["en", "es"]) await guard("the workspace (" + language + ")", () => supervisor(browser, language));
    for (const language of ["en", "es"]) await guard("007 on the customer page (" + language + ")", () => customerAsks(browser, language));
    for (const language of ["en", "es"]) await guard("006 on the customer page (" + language + ")", () => customerWalk(browser, language));
    for (const language of ["en", "es"]) await guard("the page's own name and role (" + language + ")", () => customerOwn(browser, language));
    await guard("a check-off with no signal", () => noSignal(browser));
    for (const language of ["en", "es"]) await guard("an equipment label (" + language + ")", () => equipment(browser, language));
    for (const language of ["en", "es"]) await guard("periodic work (" + language + ")", () => periodic(browser, language));
    for (const language of ["en", "es"]) await guard("a concern link (" + language + ")", () => concern(browser, language));
    for (const language of ["en", "es"]) await guard("touchpoint chips (" + language + ")", () => touchpoints(browser, language));
    for (const language of ["en", "es"]) await guard("the request page (" + language + ")", () => requestPage(browser, language));
    await guard("Client requests for an approver", () => requestsApprover(browser, "en"));
    await guard("Client requests for an assignee", () => requestsAssignee(browser, "en"));
    await guard("the supply page", () => supplyPage(browser, "en"));
    await guard("French", () => french(browser));
    await guard("the Largest text size", () => largest(browser));
  } finally {
    await browser.close();
    server.close();
  }
  const took = Date.now() - STARTED;
  check("the smoke check ran in under three minutes (" + Math.round(took / 1000) + " seconds)", took < LIMIT_MS);
  console.log("\n" + lines.length + " checks, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
