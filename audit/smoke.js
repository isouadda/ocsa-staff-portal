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
//   - /sds draws its list with no sign-in (English alone: the check reads
//     the API's sheet names, which are the same in every language)
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
//   - My training (Step 258): the stub answers GET /api/training/me with
//     one item of each status and two records, so More offers My
//     training, and the screen draws To do with the safety ones first
//     and its line, Coming due, Done and History newest first; a person
//     with nothing required reads so; an item with linkUrl offers Take
//     the course online in a new tab with the certificate line (English
//     alone)
//   - Online lessons (Step 261): Home counts the lessons to do; Start
//     reads the lesson with its blocks, a warning, a cited passage and
//     the Spanish switch; two wrong answers fail with the score, the pass
//     mark, how many were missed, the tries left and Read it again; all
//     right passes, the signature drawn is sent and the topic waits for
//     the trainer; a supervisor's Home card counts it, Sign off training
//     lists it, the tick is asked for, the API's refusal reads in the
//     sheet, and the sign-off takes it off the list (English alone)
//   - The training portal (Step 267): with categories in GET
//     /api/training/me, My training draws the overall progress, Continue
//     where you left off and the three category cards, two a row at 390
//     and one at 320; the safety card opens its page at /training/c/safety
//     with the modules in order and their chips; Start on the ladders
//     lesson reads it with a drawing (an SVG src) and a photo (a PNG src
//     from a signed address) both decoded, a tap opens the picture full
//     screen and Close closes it, and in Spanish the held line shows over
//     the English reading; Back returns to the category page and the
//     phone's back to the portal; the old layout stays where categories
//     is absent (the My training check above). English at 390, Spanish
//     at 320.
//   - Step 264: Your first trainings on Home, with the document to sign
//     and the first-day training that has a lesson; a session
//     joined from /join/<code> with the understood tick and a signature,
//     the same code saying already signed in, a wrong code saying not
//     open; a document read section by section with its contents list
//     and signed with the version read; a supervisor's session started,
//     its code and QR shown, a sign-in arriving and the close with a
//     signature; and a checklist watched, an unticked step named, the
//     person's signature, then the trainer's sign-off (English alone)
//   - Inspection findings (Step 255): a completion that opens two
//     findings, one with an owner, through the API alone, with the
//     API's refusal under the card it names, the answer screen with the
//     band and each finding, and the owner's finding on Report, Fixed
//     and Waiting for a check (English alone)
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
  API_REFUSALS, requestWord, requestCategoryTitle, REQUEST_REF, SUP_CODE, SUP_ITEM, SUP_SITES, INSPECTION_F, FINDING_REFUSALS, TRAINING_ME, TRAINING_LESSONS, TRAINING_AWAITING, TRAINING_REFUSALS, TRAINING_SESSION_SEED, TRAINING_OBSERVATION, TRAINING_DOCUMENT, TRAINING_CATEGORIES, LESSON_IMAGE_HOST, STAFF } = require("./stub");
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
// The settle after a tap on the bar, under More or on a tile, and after
// a load, once the screen is there (Step 258: these were 700, 900 and
// 1,200 ms, fixed, and padded every run).
const TAP_SETTLE = 300;
const LOAD_SETTLE = 400;
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
// A tap draws its screen in the same frame; the settle after it covers
// the first paint. What a screen then loads is waited for by each check.
async function tapBar(page, i) { await page.evaluate("(" + barButtons.toString() + ")()[" + i + "].click()"); await pause(page, TAP_SETTLE); }
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
  await pause(page, TAP_SETTLE);
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
  // The first screen after the reload, then a short settle for whatever a
  // check reads at once; what a screen loads is waited for by the check.
  await waitFor(app.page, () => !!document.querySelector(".sp-content, input[type=\"password\"], form, button"), null, 10000);
  await pause(app.page, LOAD_SETTLE);
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
  // The portal or the code screen is waited for by each caller.
  await pause(page, TAP_SETTLE);
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
  await pause(page, TAP_SETTLE);
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
  await waitFor(page, BAR_JS + ".length >= 5", null, 10000);
  await pause(page, LOAD_SETTLE);
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

// Inspection findings (Step 255): the stub answers owners on the
// scheduled read, so the completion sends deficient and an owner per
// card and files nothing of its own. Three cards: the first marked Needs
// a fix with the person signed in as its owner, the second scored under
// 80 percent, which says it will open a finding, the third fine. The
// first send meets the API's refusal, laid over the stub, under the card
// it names; the second answers the failed band, the corrective action
// line and two findings, one with an owner. Then Report lists the
// owner's finding under Inspection findings, Fixed takes a note and
// sends the PATCH the API takes, and the row reads Waiting for a check.
async function findings(browser, language) {
  const app = await open({ findings: true, inspections: [INSPECTION_F], accountPreferences: { language: language, textSize: "standard" } }, { browser, language, signedIn: true });
  const page = app.page;
  const tapIn = (root, w) => page.evaluate((a) => { const el = a.root ? document.querySelector(a.root) : document; const b = el && Array.from(el.querySelectorAll("button")).find(x => x.innerText.trim().toUpperCase() === a.w.toUpperCase()); if (b) b.click(); return !!b; }, { root, w });
  // A slider moved the way a finger moves it: the value set through the
  // element's own setter, so React hears the input event.
  const slide = (id, v) => page.evaluate((a) => { const r = document.querySelector('[data-inspect-item="' + a.id + '"] input[type="range"]'); if (!r) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(r, String(a.v)); r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true })); return true; }, { id, v });
  const note = (id, text) => page.fill('[data-inspect-item="' + id + '"] input[placeholder]', text);
  await tapMore(page, say(language, "Inspect"));
  const listed = await waitFor(page, (w) => Array.from(document.querySelectorAll(".sp-content button")).some(b => b.innerText.indexOf(w) !== -1), INSPECTION_F.template_name);
  if (listed) await page.evaluate((w) => { const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.innerText.indexOf(w) !== -1); if (b) b.click(); }, INSPECTION_F.template_name);
  const opened = listed && await waitFor(page, () => !!document.querySelector('[data-inspect-item="if-3"]'));
  let marked = false, said = false, refused = false, answered = false;
  if (opened) {
    // Card 1: scored 3 of 5, Needs a fix, the person signed in as owner.
    await slide("if-1", 3);
    await page.click('[data-inspect-item="if-1"] [role="switch"]');
    marked = await waitFor(page, (w) => { const s = document.querySelector('#ocsa-inspect-owner-if-1'); return !!s && s.options[0].text === w.none && Array.from(s.options).some(o => o.value === w.me); }, { none: say(language, "No owner yet"), me: "u-one" });
    if (marked) await page.selectOption("#ocsa-inspect-owner-if-1", "u-one");
    await note("if-1", "Smudges on both doors, invented.");
    // Card 2: scored 3 of 5, which says it will open a finding.
    await slide("if-2", 3);
    said = await waitFor(page, (w) => { const l = document.querySelector('[data-inspect-finding="if-2"]'); return !!l && l.innerText.trim() === w; }, say(language, "This will open a finding."));
    await note("if-2", "Mat curled at the door, invented.");
    // Card 3: fine.
    await slide("if-3", 5);
    // The first send meets the API's refusal under card 1, in the fold.
    await tapIn(".sp-content", say(language, "Submit Inspection"));
    refused = await waitFor(page, (w) => { const a = document.querySelector('[data-inspect-item="if-1"] [role="alert"]'); return !!a && a.innerText.trim() === w; }, FINDING_REFUSALS["inspections.findingNoteRequired"][language]);
    await tapIn(".sp-content", say(language, "Submit Inspection"));
    answered = await waitFor(page, (w) => { const s = document.querySelector('[data-inspect-sent="failed"]'); return !!s && !!s.querySelector('[data-inspect-corrective="1"]') && s.querySelectorAll("[data-inspect-found]").length === 2 && s.innerText.indexOf(w.band) !== -1 && s.innerText.indexOf(w.owner) !== -1 && s.innerText.indexOf(w.none) !== -1 && s.innerText.indexOf("73.3%") !== -1; }, { band: say(language, "Failed. A corrective action and a re-inspection within ten working days."), owner: say(language, "Owner: {name}", { name: "Alex Tester" }), none: say(language, "No owner yet") });
  }
  const completes = app.stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/inspections/scheduled/in-f/complete").map(c => (c.body && c.body.scores ? c.body.scores.map(r => [r.template_item_id, r.deficient, r.ownerId || null, r.notes]) : null));
  const sent = completes.length === 2 && JSON.stringify(completes[1]) === JSON.stringify([["if-1", true, "u-one", "Smudges on both doors, invented."], ["if-2", true, null, "Mat curled at the door, invented."], ["if-3", false, null, ""]].map(r => [r[0], r[1], r[2], r[3] || null]));
  const noOwnPost = !app.stub.state.calls.some(c => c.method === "POST" && c.path === "/api/issues");
  // Report: the owner's finding, Fixed with a note, Waiting for a check.
  await tapIn(".sp-content", say(language, "Done"));
  await tapMore(page, say(language, "Report"));
  const row = await waitFor(page, (w) => { const r = document.querySelector('[data-finding-row="fnd-1"]'); return !!r && !document.querySelector('[data-finding-row="fnd-2"]') && r.innerText.indexOf(w.title) !== -1 && r.innerText.indexOf(w.note) !== -1 && Array.from(r.querySelectorAll("button")).map(b => b.innerText.trim()).join("|") === w.fixed; }, { title: INSPECTION_F.items[0].label, note: "Smudges on both doors, invented.", fixed: say(language, "Fixed") });
  let waiting = false;
  if (row) {
    await tapIn('[data-finding-row="fnd-1"]', say(language, "Fixed"));
    await waitFor(page, () => !!document.querySelector("#ocsa-finding-fixed-note"));
    await page.fill("#ocsa-finding-fixed-note", "Wiped and dried, invented.");
    await tapIn('[role="dialog"]', say(language, "Fixed"));
    waiting = await waitFor(page, (w) => { const r = document.querySelector('[data-finding-row="fnd-1"]'); const l = document.querySelector('[data-finding-waiting="fnd-1"]'); return !document.querySelector('[role="dialog"]') && !!r && !!l && l.innerText.trim() === w && r.querySelectorAll("button").length === 0; }, say(language, "Waiting for a check"));
  }
  const patches = app.stub.state.calls.filter(c => c.method === "PATCH" && c.path === "/api/issues/fnd-1").map(c => c.body);
  const resolved = JSON.stringify(patches) === '[{"status":"resolved","resolutionNotes":"Wiped and dried, invented."}]';
  check("Inspection findings: a card marked Needs a fix offers an owner, a card under 80 percent says it will open a finding, the completion sends deficient and ownerId and files no issue of its own, the API's refusal lands under the card it names, the answer shows the failed band, the corrective action line and two findings with their owner, and Report lists the owner's finding, Fixed sends the PATCH with its note and the row reads Waiting for a check (" + language + ")",
    opened && marked && said && refused && answered && sent && noOwnPost && row && waiting && resolved && app.errors.length === 0,
    !opened ? "the inspection did not open" : !marked ? "the owner picker did not show" : !said ? "card 2 did not say it will open a finding" : !refused ? "the refusal was not said under card 1" : !answered ? "the answer screen did not read as expected" : !sent ? JSON.stringify(completes) : !noOwnPost ? "the portal posted /api/issues itself" : !row ? "Report did not list the owner's finding as expected" : !waiting ? "the row did not read Waiting for a check" : !resolved ? JSON.stringify(patches) : app.errors[0]);
  await app.context.close();
}

// My training (Step 258): the stub answers GET /api/training/me with one
// item of each status and two records. More offers My training; the
// screen draws To do (the safety-critical ones first, each with its
// line, and the supervisor line under the group), Coming due, Done and
// History newest first with the language each session was given in. A
// person with nothing required reads so, with no group.
async function training(browser, language) {
  const app = await open({ training: true, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, signedIn: true });
  const page = app.page;
  const offered = await tapMore(page, say(language, "My training"));
  const want = {
    groups: "todo|soon|done|history", items: "missing|expired|missing|refresherDue|dueSoon|current", records: "tr-6|tr-8",
    words: [say(language, "To do"), say(language, "Coming due"), say(language, "Done"), say(language, "History"), say(language, "Your trainer goes over this one with you."),
      say(language, "Not done yet"), say(language, "Refresher due at {site}", { site: "North Building" }), say(language, "Given in English"), say(language, "Given in Spanish"), "OCSA-HR-009 3", TRAINING_ME.items[0].name,
      say(language, "Take the course online"), say(language, "When you finish, give your certificate to the office.")],
    link: TRAINING_ME.items[1].linkUrl,
  };
  const drawn = offered && await waitFor(page, (w) => {
    const c = document.querySelector('[data-training="1"]');
    if (!c) return false;
    const of = (sel, attr) => Array.from(c.querySelectorAll(sel)).map(e => e.getAttribute(attr)).join("|");
    const text = c.innerText.toUpperCase();
    const links = Array.from(c.querySelectorAll("a[data-training-link]"));
    return of("[data-training-group]", "data-training-group") === w.groups && of("[data-training-item]", "data-training-item") === w.items && of("[data-training-record]", "data-training-record") === w.records && w.words.every(x => text.indexOf(x.toUpperCase()) !== -1) && links.length === 1 && links[0].getAttribute("href") === w.link && links[0].getAttribute("target") === "_blank";
  }, want);
  const wide = await sideways(page);
  const asked = app.stub.state.calls.filter(c => c.method === "GET" && c.path === "/api/training/me").length;
  await app.context.close();
  // Nothing required: the one line, and no group.
  const none = await open({ trainingNone: true, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, signedIn: true });
  const offered2 = await tapMore(none.page, say(language, "My training"));
  const quiet = offered2 && await waitFor(none.page, (w) => { const c = document.querySelector('[data-training="1"]'); return !!c && c.innerText.indexOf(w) !== -1 && c.querySelectorAll("[data-training-group]").length === 0; }, say(language, "Nothing is required for your role yet."));
  await none.context.close();
  check("My training under More draws To do with the safety-critical ones first and the trainer line on a training with no lesson, Coming due, Done and History newest first with the language each was given in, from GET /api/training/me, one Take the course online link opening the item's linkUrl in a new tab with the certificate line under it, with no sideways scroll; a person with nothing required reads so (" + language + ")",
    offered && drawn && wide <= 1 && asked >= 1 && quiet && app.errors.length === 0 && none.errors.length === 0,
    !offered ? "no My training under More" : !drawn ? "the screen did not read as expected" : wide > 1 ? wide + " pixels sideways" : !asked ? "the route was not asked" : !quiet ? "the nothing-required line did not show alone" : (app.errors[0] || none.errors[0]));
}

// Online lessons (Step 261): Home's card counts the two items with a
// lesson and tries left; Start on the safety topic opens the reading
// with its three blocks, the warning drawn as one, a cited passage under
// a block and a language switch, which reads the lesson again in
// Spanish; the questions one per screen; two wrong answers fail with
// the score, the pass mark, how many were missed, two tries left and
// Read it again; all right passes, the signature drawn and sent, and
// the topic waits for the trainer; My training then lists it under
// Waiting for your trainer with no Start. A supervisor's Home card
// counts the attempt waiting; Sign off training lists it with the
// person, the topic, the score and when they signed; Sign off without
// the tick stays on the phone, the API's refusal reads in its words in
// the sheet, and the sign-off with the tick, a note and a signature
// takes the row off the list.
async function lessons(browser) {
  const language = "en";
  const app = await open({ training: true, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, signedIn: true });
  const page = app.page;
  const card = await waitFor(page, (w) => { const b = document.querySelector('[data-training-card="todo"]'); return !!b && b.innerText.trim() === w; }, say(language, "{n} trainings to do", { n: 2 }));
  if (card) await page.click('[data-training-card="todo"]');
  const listed = card && await waitFor(page, (w) => { const b = document.querySelector('[data-training-start="tp-1:"]'); const s = b && b.parentElement.querySelector('[data-training-tries="3"]'); return !!b && b.innerText.trim() === w.start && !!s && s.innerText.trim() === w.tries && document.querySelectorAll("[data-training-start]").length === 2; }, { start: say(language, "Start the lesson"), tries: say(language, "{n} tries left", { n: 3 }) });
  if (listed) await page.click('[data-training-start="tp-1:"]');
  const lesson = TRAINING_LESSONS[0];
  const reading = listed && await waitFor(page, (w) => { const c = document.querySelector('[data-lesson="read"]'); return !!c && c.querySelectorAll("[data-lesson-block]").length === 3 && !!c.querySelector('[data-lesson-block="warning"]') && !!c.querySelector('[data-lesson-lang="es"]') && c.innerText.indexOf(w.title) !== -1 && c.innerText.indexOf(w.source) !== -1 && c.innerText.indexOf(w.warning) !== -1 && !!c.querySelector('[data-lesson-next="read"]'); }, { title: lesson.title.en, source: lesson.blocks[0].source.docCode + " " + lesson.blocks[0].source.sectionRef, warning: lesson.blocks[2].text.en });
  // The switch: Spanish read from the route, then English again.
  if (reading) await page.click('[data-lesson-lang="es"]');
  const spanish = reading && await waitFor(page, (w) => { const c = document.querySelector('[data-lesson="read"]'); return !!c && c.innerText.indexOf(w) !== -1 && c.querySelector('[data-lesson-lang="es"]').getAttribute("aria-pressed") === "true"; }, lesson.title.es);
  if (spanish) await page.click('[data-lesson-lang="en"]');
  await waitFor(page, (w) => { const c = document.querySelector('[data-lesson="read"]'); return !!c && c.innerText.indexOf(w) !== -1; }, lesson.title.en);
  const answer = async (picks) => {
    await page.click('[data-lesson-next="read"]');
    for (let i = 0; i < picks.length; i += 1) {
      if (!(await waitFor(page, (n) => { const c = document.querySelector('[data-lesson="ask"]'); return !!c && c.getAttribute("data-lesson-question") === String(n); }, i + 1))) return false;
      await page.click('[data-lesson-option="' + picks[i] + '"]');
      await page.click(i < picks.length - 1 ? '[data-lesson-next="' + (i + 1) + '"]' : '[data-lesson-submit="1"]');
    }
    return true;
  };
  const asked = spanish && await answer(["a", "b", "b", "a", "a"]);
  const fail = { score: say(language, "Your score: {score}%", { score: 60 }), pass: say(language, "Pass mark: {pass}%", { pass: 80 }), missed: say(language, "You missed {n} questions.", { n: 2 }), tries: say(language, "{n} tries left", { n: 2 }), not: say(language, "Not passed.") };
  const failed = asked && await waitFor(page, (w) => { const c = document.querySelector('[data-lesson="result"]'); return !!c && c.getAttribute("data-lesson-tries") === "2" && [w.score, w.pass, w.missed, w.tries, w.not].every(x => c.innerText.indexOf(x) !== -1) && !!c.querySelector('[data-lesson-again="1"]'); }, fail);
  if (failed) await page.click('[data-lesson-again="1"]');
  const again = failed && await waitFor(page, () => !!document.querySelector('[data-lesson="read"]'));
  const passed = again && await answer(["a", "a", "a", "a", "a"]) && await waitFor(page, (w) => { const c = document.querySelector('[data-lesson="sign"]'); return !!c && c.innerText.indexOf(w.ok) !== -1 && c.innerText.indexOf(w.score) !== -1 && c.innerText.indexOf(w.ack) !== -1 && !!c.querySelector('[data-lesson-signature="1"] canvas'); }, { ok: say(language, "You passed."), score: say(language, "Your score: {score}%", { score: 100 }), ack: lesson.acknowledgement.en });
  if (passed) { await sign(page, '[data-lesson-signature="1"] canvas'); await page.click('[data-lesson-sign="1"]'); }
  const waiting = passed && await waitFor(page, (w) => { const c = document.querySelector('[data-lesson="done"]'); return !!c && c.getAttribute("data-lesson-waiting") === "1" && c.innerText.indexOf(w) !== -1; }, say(language, "Waiting for your trainer. Show them you can do it, and they sign it off."));
  const wide = await sideways(page);
  if (waiting) await clickWord(page, say(language, "Back to My training"));
  const back = waiting && await waitFor(page, (w) => { const c = document.querySelector('[data-training="1"]'); return !!c && !!c.querySelector('[data-training-group="waiting"]') && !!c.querySelector('[data-training-item="awaitingTrainer"]') && !c.querySelector('[data-training-start="tp-1:"]') && !!c.querySelector('[data-training-start="tp-2:"]') && c.innerText.indexOf(w) !== -1; }, say(language, "Waiting for your trainer. Show them you can do it, and they sign it off."));
  const calls = app.stub.state.calls;
  const reads = calls.filter(c => c.method === "GET" && c.path === "/api/training/lesson-versions/lv-1").map(c => (c.search.match(/locale=(\w+)/) || [])[1]);
  const starts = calls.filter(c => c.method === "POST" && c.path === "/api/training/attempts").map(c => c.body);
  const answers = calls.filter(c => c.method === "POST" && /^\/api\/training\/attempts\/[^/]+\/answers$/.test(c.path)).map(c => c.body);
  const acks = calls.filter(c => c.method === "POST" && /^\/api\/training\/attempts\/[^/]+\/acknowledge$/.test(c.path));
  const sent = reads.length >= 4 && reads.indexOf("es") !== -1 && starts.length === 2 && starts.every(b => b.versionId === "lv-1" && b.locale === "en" && Object.prototype.hasOwnProperty.call(b, "siteId")) && answers.length === 2 && JSON.stringify(answers[0]) === '{"answers":{"q1":"a","q2":"b","q3":"b","q4":"a","q5":"a"}}' && acks.length === 1 && acks[0].signature && acks[0].signature.bytes > 0;
  check("Online lessons: Home counts 2 trainings to do, Start on the safety topic reads the lesson with its blocks, the warning, a cited passage and the Spanish switch, two wrong answers fail with the score, the pass mark, 2 missed, 2 tries left and Read it again, all right passes, the signature drawn is sent once, the topic waits for the trainer and My training lists it so with no Start, with no sideways scroll (en)",
    card && listed && reading && spanish && asked && failed && again && passed && waiting && back && wide <= 1 && sent && app.errors.length === 0,
    !card ? "no Home card reading 2 trainings to do" : !listed ? "Start with 3 tries left did not show on tp-1" : !reading ? "the reading did not draw as expected" : !spanish ? "the Spanish switch did not read the lesson again" : !asked ? "a question screen did not come" : !failed ? "the fail did not read as expected" : !again ? "Read it again did not open the reading" : !passed ? "the pass did not read as expected" : !waiting ? "the trainer line did not show" : !back ? "My training did not list the topic under Waiting for your trainer" : wide > 1 ? wide + " pixels sideways" : !sent ? JSON.stringify({ reads, starts, answers, acks: acks.length }) : app.errors[0]);
  await app.context.close();

  // The supervisor's sign-off.
  const person = Object.assign({}, ADMIN_PERSON, { id: "u-smoke-sup", firstName: "Riley", lastName: "Example", role: "supervisor", badgeNumber: "4801", phone: "0000000008", email: "riley@example.invalid" });
  const sup = await open({ training: true, fieldKit: true, person: person, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, signedIn: true });
  const p2 = sup.page;
  const card2 = await waitFor(p2, (w) => { const b = document.querySelector('[data-training-card="signoff"]'); return !!b && b.innerText.trim() === w; }, say(language, "1 training to sign off"));
  if (card2) await p2.click('[data-training-card="signoff"]');
  const row = card2 && await waitFor(p2, (w) => { const r = document.querySelector('[data-fk-signoff="ta-7"]'); return !!r && r.innerText.indexOf(w.who) !== -1 && r.innerText.indexOf(w.topic) !== -1 && r.innerText.indexOf(w.score) !== -1 && document.body.innerText.indexOf(w.site) !== -1; }, { who: TRAINING_AWAITING.personName, topic: TRAINING_ME.items[0].name, score: "100%", site: "North Building" });
  let held = false, refused = false, done = false;
  if (row) {
    await p2.evaluate((w) => { const r = document.querySelector('[data-fk-signoff="ta-7"]'); const b = Array.from(r.querySelectorAll("button")).find(x => x.innerText.trim() === w); if (b) b.click(); }, say(language, "Sign off"));
    await waitFor(p2, () => !!document.querySelector('[data-fk-signoff-send="1"]') && !!document.querySelector('[data-fk-signoff-signature="1"] canvas'));
    // Without the tick: the phone says so and nothing is sent.
    await p2.click('[data-fk-signoff-send="1"]');
    held = await waitFor(p2, (w) => { const d = document.querySelector('[role="dialog"]'); return !!d && d.innerText.indexOf(w) !== -1; }, say(language, "Tick I watched them do it first."));
    await p2.click('[data-fk-signoff-watched="0"]');
    await p2.fill("#ocsa-fk-signoff-note", "Showed me the label and the gloves, invented.");
    await sign(p2, '[data-fk-signoff-signature="1"] canvas');
    // The API's refusal, once, read in its words in the sheet.
    sup.stub.state.refuse["POST /api/training/attempts/ta-7/signoff"] = { status: 403, body: { error: TRAINING_REFUSALS["training.cannotSignOwn"].en, code: "training.cannotSignOwn" }, once: true };
    await p2.click('[data-fk-signoff-send="1"]');
    refused = await waitFor(p2, (w) => { const d = document.querySelector('[role="dialog"]'); return !!d && d.innerText.indexOf(w) !== -1; }, TRAINING_REFUSALS["training.cannotSignOwn"].en);
    await p2.click('[data-fk-signoff-send="1"]');
    done = await waitFor(p2, (w) => !document.querySelector('[role="dialog"]') && !document.querySelector('[data-fk-signoff="ta-7"]') && document.body.innerText.indexOf(w.toast) !== -1 && document.body.innerText.indexOf(w.none) !== -1, { toast: say(language, "Signed off. It is on their record."), none: say(language, "Nobody is waiting for a sign-off at this site.") });
  }
  const offs = sup.stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/training/attempts/ta-7/signoff");
  const sentOff = offs.length === 2 && offs.every(c => c.body && c.body.demonstrated === true && c.body.note === "Showed me the label and the gloves, invented.") && offs[1].signature && offs[1].signature.bytes > 0;
  const wide2 = await sideways(p2);
  check("Sign off training: a supervisor's Home card counts 1 training to sign off and opens the tile on the site, with the person, the topic, the score and when they signed; Sign off without the tick stays on the phone; the API's refusal reads in its words in the sheet; the sign-off sends the tick, the note and the signature drawn and takes the row off the list, with no sideways scroll (en)",
    card2 && row && held && refused && done && sentOff && wide2 <= 1 && sup.errors.length === 0,
    !card2 ? "no Home card reading 1 training to sign off" : !row ? "the tile did not list the attempt on North Building" : !held ? "the tick line did not show" : !refused ? "the refusal was not said in the sheet" : !done ? "the sign-off did not take the row off" : !sentOff ? JSON.stringify(offs.map(c => c.body)) : wide2 > 1 ? wide2 + " pixels sideways" : sup.errors[0]);
  await sup.context.close();
}

// Step 264 (English alone): a person opens /join/<code> signed in, reads
// the session's title, topics and trainer, ticks that they understood it,
// signs, and reads that they are signed in; the same code opened again
// says they already signed in; a wrong code reads that the session is not
// open. A supervisor's Training session tile starts a session with a
// title and a topic, shows its code and QR, reads one sign-in arriving,
// and closes it with a signature; Watch and sign off picks a person and
// their observation checklist, names an unticked step, ticks every step,
// takes the person's signature, then the trainer's sign-off. Your first
// trainings (the owner's change of October 6, Step 267) is a card at the
// top of Home with the document to sign and the first-day training that
// has a lesson, and not the one without; the tab bar and Home's training
// card answer taps while it shows. Read and sign on the card opens the
// reader, Next walks its three sections, the signature is sent with the
// version read, and My training and the card no longer list the document.
async function step264(browser) {
  const language = "en";
  const prefs = { language: language, textSize: "standard" };
  // Joining a session.
  const app = await open({ training: true, documents: true, accountPreferences: prefs }, { browser, language, signedIn: true, path: "/join/" + TRAINING_SESSION_SEED.joinCode });
  const page = app.page;
  // Your first trainings on Home: the document and tp-1, never tp-3,
  // which has no lesson; Tasks and Home answer taps under it, and so
  // does Home's trainings-to-do card.
  const card = await waitFor(page, () => { const c = document.querySelector('[data-first-trainings="2"]'); return !!c && !!c.querySelector('[data-first-doc="OCSA-HR-002"]') && !!c.querySelector('[data-first-item="tp-1:"]') && !c.querySelector('[data-first-item="tp-3:"]') && !document.querySelector('[role="dialog"]'); });
  let under = false;
  if (card) {
    await tapBar(page, 2);
    const tasks = await waitFor(page, (w) => !document.querySelector("[data-first-trainings]") && document.querySelector(".sp-content").innerText.indexOf(w) === -1, say(language, "Your first trainings"));
    await tapBar(page, 0);
    const home = await waitFor(page, () => !!document.querySelector('[data-first-trainings="2"]') && !!document.querySelector('[data-training-card="todo"]'));
    if (home) await page.click('[data-training-card="todo"]');
    const listed = home && await waitFor(page, () => !!document.querySelector('[data-training="1"]'));
    under = tasks && home && listed;
  }
  const before = card && under;
  await page.goto(BASE + "/join/" + TRAINING_SESSION_SEED.joinCode, { waitUntil: "domcontentloaded" });
  const opened = await waitFor(page, (w) => { const c = document.querySelector('[data-join="open"]'); return !!c && window.location.pathname === "/" && c.innerText.indexOf(w.title) !== -1 && c.innerText.indexOf(w.trainer) !== -1 && !!c.querySelector('[data-join-topic="tp-2"]') && !!c.querySelector('[data-join-signature="1"] canvas'); }, { title: TRAINING_SESSION_SEED.title, trainer: say(language, "Trainer: {name}", { name: TRAINING_SESSION_SEED.trainerName }) });
  let held = false, signedIn = false, again = false, notOpen = false;
  if (opened) {
    await page.click('[data-join-send="1"]');
    held = await waitFor(page, (w) => document.body.innerText.indexOf(w) !== -1, say(language, "Tick I understood this training first."));
    await page.click('[data-join-understood="0"]');
    await sign(page, '[data-join-signature="1"] canvas');
    await page.click('[data-join-send="1"]');
    signedIn = await waitFor(page, (w) => { const c = document.querySelector('[data-join="signed"]'); return !!c && c.innerText.indexOf(w) !== -1; }, say(language, "You are signed in. Your trainer closes the session."));
    await page.goto(BASE + "/join/" + TRAINING_SESSION_SEED.joinCode, { waitUntil: "domcontentloaded" });
    again = await waitFor(page, (w) => { const c = document.querySelector('[data-join="signed"]'); return !!c && c.innerText.indexOf(w) !== -1; }, say(language, "You already signed in to this session."));
    await page.goto(BASE + "/join/WRONGCODE1", { waitUntil: "domcontentloaded" });
    notOpen = await waitFor(page, (w) => { const c = document.querySelector('[data-join="notOpen"]'); return !!c && c.innerText.indexOf(w) !== -1; }, say(language, "This session is not open."));
  }
  const joins = app.stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/training/join/" + TRAINING_SESSION_SEED.joinCode);
  const joinSent = joins.length === 1 && joins[0].body && joins[0].body.understood === true && joins[0].signature && joins[0].signature.bytes > 0;
  const wide = await sideways(page);
  check("Join a session: Your first trainings on Home lists the document and the first-day training with a lesson, not the one without, and Tasks, Home and Home's trainings card answer taps under it; /join/<code> opens the session with its title, trainer and topic, the understood tick is asked for, the signature drawn is sent once with understood true, the person reads that they are signed in, the same code says they already signed in, and a wrong code says the session is not open, with no sideways scroll (en)",
    before && opened && held && signedIn && again && notOpen && joinSent && wide <= 1 && app.errors.length === 0,
    !card ? "Your first trainings did not show on Home as expected" : !under ? "the tabs or the trainings card did not answer under the card" : !opened ? "the join screen did not open as expected" : !held ? "the tick line did not show" : !signedIn ? "the signed-in line did not show" : !again ? "the already-signed line did not show" : !notOpen ? "the not-open line did not show" : !joinSent ? JSON.stringify(joins.map(c => c.body)) : wide > 1 ? wide + " pixels sideways" : app.errors[0]);
  await app.context.close();

  // A document read and signed, from My training.
  const doc = await open({ training: true, documents: true, accountPreferences: prefs }, { browser, language, signedIn: true });
  const p2 = doc.page;
  const sheet = await waitFor(p2, () => !!document.querySelector('[data-first-doc="OCSA-HR-002"] button'));
  if (sheet) await p2.click('[data-first-doc="OCSA-HR-002"] button');
  const reading = sheet && await waitFor(p2, (w) => { const c = document.querySelector('[data-doc="read"]'); return !!c && c.getAttribute("data-doc-section") === "1" && c.innerText.indexOf(w.title) !== -1 && c.innerText.indexOf(w.first) !== -1 && !!c.querySelector('[data-doc-next="2"]'); }, { title: TRAINING_DOCUMENT.title, first: TRAINING_DOCUMENT.sections[0].title });
  let contents = false, signedDoc = false, gone = false, cardGone = false;
  if (reading) {
    await p2.click('[data-doc-contents="1"]');
    contents = await waitFor(p2, () => document.querySelectorAll("[data-doc-jump]").length === 3);
    await p2.click('[data-doc-jump="2"]');
    await waitFor(p2, () => { const c = document.querySelector('[data-doc="read"]'); return !!c && c.getAttribute("data-doc-section") === "2"; });
    await p2.click('[data-doc-next="3"]');
    await waitFor(p2, () => !!document.querySelector('[data-doc-next="sign"]'));
    await p2.click('[data-doc-next="sign"]');
    await waitFor(p2, () => !!document.querySelector('[data-doc-signature="1"] canvas'));
    await sign(p2, '[data-doc-signature="1"] canvas');
    await p2.click('[data-doc-sign="1"]');
    signedDoc = await waitFor(p2, (w) => { const c = document.querySelector('[data-doc="done"]'); return !!c && c.innerText.indexOf(w) !== -1; }, say(language, "Signed. It is on your record."));
    await clickWord(p2, say(language, "Back to My training"));
    gone = await waitFor(p2, () => { const c = document.querySelector('[data-training="1"]'); return !!c && !c.querySelector("[data-training-doc]") && !!c.querySelector('[data-training-certificate="tr-6"]'); });
    await tapBar(p2, 0);
    cardGone = await waitFor(p2, () => !!document.querySelector('[data-first-trainings="1"]') && !document.querySelector("[data-first-doc]") && !!document.querySelector('[data-first-item="tp-1:"]'));
  }
  const acks = doc.stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/documents/OCSA-HR-002/acknowledge");
  const ackSent = acks.length === 1 && acks[0].body && acks[0].body.version === TRAINING_DOCUMENT.version && acks[0].body.locale === "en" && acks[0].signature && acks[0].signature.bytes > 0;
  const wide2 = await sideways(p2);
  check("Documents to sign: Read and sign on Home's Your first trainings card opens the reader on section 1, Contents lists the three sections and jumps to one, Next reaches the signature, Sign sends the version read and the signature drawn once, Signed. It is on your record. shows, My training then lists no document and says Certificate on file on the record with one, and the card keeps only the lesson, with no sideways scroll (en)",
    sheet && reading && contents && signedDoc && gone && cardGone && ackSent && wide2 <= 1 && doc.errors.length === 0,
    !sheet ? "Your first trainings did not list the document" : !reading ? "the reader did not open on section 1" : !contents ? "Contents did not list three sections" : !signedDoc ? "the signed line did not show" : !gone ? "My training still lists the document, or no Certificate on file" : !cardGone ? "the Home card still lists the document, or lost the lesson" : !ackSent ? JSON.stringify(acks.map(c => c.body)) : wide2 > 1 ? wide2 + " pixels sideways" : doc.errors[0]);
  await doc.context.close();

  // The supervisor: a session started and closed, and a checklist signed off.
  const person = Object.assign({}, ADMIN_PERSON, { id: "u-smoke-sup", firstName: "Riley", lastName: "Example", role: "supervisor", badgeNumber: "4801", phone: "0000000008", email: "riley@example.invalid" });
  const sup = await open({ training: true, fieldKit: true, person: person, accountPreferences: prefs }, { browser, language, signedIn: true });
  const p3 = sup.page;
  const kit = await tapMore(p3, say(language, "Field kit"));
  const tiles = kit && await waitFor(p3, (w) => { const c = document.querySelector(".sp-content"); return !!c && w.every(x => Array.from(c.querySelectorAll("button")).some(b => b.innerText.indexOf(x) !== -1)); }, [say(language, "Training session"), say(language, "Watch and sign off")]);
  let form = false, started = false, arrived = false, closed = false;
  if (tiles) {
    await openTile(p3, say(language, "Training session"));
    form = await waitFor(p3, () => !!document.querySelector('[data-fk-session="form"]') && !!document.querySelector('[data-fk-session-topic="tp-2"]'));
    if (form) {
      await p3.fill("#ocsa-session-title", "Invented ladders refresher, afternoon");
      await p3.click('[data-fk-session-topic="tp-2"]');
      await p3.click('[data-fk-session-start="1"]');
    }
    started = form && await waitFor(p3, () => { const c = document.querySelector('[data-fk-session="open"]'); return !!c && !!c.querySelector("[data-fk-session-code]") && !!c.querySelector("img"); });
    arrived = started && await waitFor(p3, () => !!document.querySelector('[data-fk-signin="si-arrived"]'), null, 12000);
    if (arrived) {
      await p3.click('[data-fk-session-close="1"]');
      await waitFor(p3, () => !!document.querySelector('[data-fk-session-signature="1"] canvas'));
      await sign(p3, '[data-fk-session-signature="1"] canvas');
      await p3.click('[data-fk-session-send="close"]');
    }
    closed = arrived && await waitFor(p3, (w) => { const c = document.querySelector('[data-fk-session="closed"]'); return !!c && c.innerText.indexOf(w) !== -1; }, say(language, "Closed. 1 record saved."));
  }
  const starts = sup.stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/training/sessions").map(c => c.body);
  const closes = sup.stub.state.calls.filter(c => c.method === "POST" && /^\/api\/training\/sessions\/[^/]+\/close$/.test(c.path));
  const sessionSent = starts.length === 1 && starts[0].title === "Invented ladders refresher, afternoon" && starts[0].siteId === "site-north" && JSON.stringify(starts[0].topicIds) === '["tp-2"]' && /^\d{4}-\d{2}-\d{2}$/.test(starts[0].day) && closes.length === 1 && closes[0].signature && closes[0].signature.bytes > 0;
  check("Training session: the tile starts a session with a title and a topic on the site, shows its code and QR, reads a sign-in arriving, and Close the session with the signature drawn says 1 record saved (en)",
    tiles && form && started && arrived && closed && sessionSent && sup.errors.length === 0,
    !tiles ? "the two tiles are not in the field kit" : !form ? "the form did not show the topic" : !started ? "the session did not open with its code and QR" : !arrived ? "no sign-in arrived" : !closed ? "the closed line did not show" : !sessionSent ? JSON.stringify({ starts, closes: closes.length }) : sup.errors[0]);
  // Watch and sign off.
  let picked = false, named = false, handed = false, personSigned = false, signedOff = false;
  if (tiles) {
    await backToKit(p3, language);
    await openTile(p3, say(language, "Watch and sign off"));
    await waitFor(p3, () => !!document.querySelector("#ocsa-observe-person option[value]:not([value=''])"));
    await p3.selectOption("#ocsa-observe-person", { index: 1 });
    picked = await waitFor(p3, () => !!document.querySelector('[data-fk-checklist="tp-4"]') && !document.querySelector('[data-fk-checklist="tp-1"]'));
    if (picked) await p3.evaluate(() => { const b = document.querySelector('[data-fk-checklist="tp-4"] button'); if (b) b.click(); });
    await waitFor(p3, () => !!document.querySelector('[data-fk-observe="steps"]') && document.querySelectorAll("[data-fk-step]").length === 3);
    await p3.click('[data-fk-step="s1"]');
    await p3.click('[data-fk-observe-hand="1"]');
    named = await waitFor(p3, (w) => document.body.innerText.indexOf(w) !== -1, say(language, "Not ticked yet: {steps}", { steps: TRAINING_OBSERVATION.steps[1].text + "; " + TRAINING_OBSERVATION.steps[2].text }));
    await p3.click('[data-fk-step="s2"]');
    await p3.click('[data-fk-step="s3"]');
    await p3.click('[data-fk-observe-hand="1"]');
    handed = await waitFor(p3, (w) => { const c = document.querySelector('[data-fk-observe="person"]'); return !!c && c.innerText.indexOf(w) !== -1 && !!c.querySelector('[data-fk-observe-signature="1"] canvas'); }, TRAINING_OBSERVATION.acknowledgement);
    await sign(p3, '[data-fk-observe-signature="1"] canvas');
    await p3.click('[data-fk-observe-sign="1"]');
    personSigned = await waitFor(p3, () => !!document.querySelector('[data-fk-observe="trainer"]') && !!document.querySelector('[data-fk-signoff-signature="1"] canvas'));
    await p3.click('[data-fk-signoff-watched="0"]');
    await sign(p3, '[data-fk-signoff-signature="1"] canvas');
    await p3.click('[data-fk-signoff-send="1"]');
    signedOff = await waitFor(p3, (w) => { const c = document.querySelector('[data-fk-observe="done"]'); return !!c && c.innerText.indexOf(w) !== -1 && !document.querySelector('[role="dialog"]'); }, say(language, "Signed off. It is on their record."));
  }
  const obs = sup.stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/training/observations").map(c => c.body);
  const steps = sup.stub.state.calls.filter(c => c.method === "POST" && /\/observations\/[^/]+\/steps$/.test(c.path)).map(c => c.body);
  const pSign = sup.stub.state.calls.filter(c => c.method === "POST" && /\/observations\/[^/]+\/person-sign$/.test(c.path));
  const offs = sup.stub.state.calls.filter(c => c.method === "POST" && /\/attempts\/[^/]+\/signoff$/.test(c.path));
  const obsSent = obs.length === 1 && obs[0].versionId === "lv-3" && obs[0].userId === STAFF[0].id && obs[0].siteId === "site-north" && steps.length === 1 && JSON.stringify(steps[0]) === '{"steps":{"s1":true,"s2":true,"s3":true}}' && pSign.length === 1 && pSign[0].signature && pSign[0].signature.bytes > 0 && offs.length === 1 && offs[0].body.demonstrated === true && offs[0].signature && offs[0].signature.bytes > 0;
  const wide3 = await sideways(p3);
  check("Watch and sign off: the person at the site, their observation checklist alone, an unticked step named on the phone before anything is sent, every step ticked and sent once, the person's signature on the trainer's phone, then the trainer's tick and signature through the sign-off, and Signed off. It is on their record., with no sideways scroll (en)",
    tiles && picked && named && handed && personSigned && signedOff && obsSent && wide3 <= 1 && sup.errors.length === 0,
    !tiles ? "the tiles did not show" : !picked ? "the checklist list did not read as expected" : !named ? "the unticked steps were not named" : !handed ? "the person's signature screen did not show" : !personSigned ? "the trainer's sheet did not open" : !signedOff ? "the signed-off line did not show" : !obsSent ? JSON.stringify({ obs, steps, pSign: pSign.length, offs: offs.length }) : wide3 > 1 ? wide3 + " pixels sideways" : sup.errors[0]);
  await sup.context.close();
}

// The training portal (Step 267): categories answered by the stub draw
// the overall progress, Continue where you left off and three cards, two
// a row at 390 wide and one at 320; the safety card opens its page with
// its modules and chips at /training/c/safety; the ladders lesson draws
// its drawing and its photo, both decoded, the photo from the signed
// address; a tap opens the picture full screen; in Spanish the held line
// shows over the English reading; Back returns to the category page and
// the phone's back to the portal.
async function trainingPortal(browser, language, width) {
  const tag = " (" + language + ", " + width + " wide)";
  const app = await open({ training: true, trainingPortal: true, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, signedIn: true, width: width });
  const page = app.page;
  const offered = await tapMore(page, say(language, "My training"));
  const catName = (key) => TRAINING_CATEGORIES.find(c => c.key === key)[language];
  const want = {
    overall: say(language, "{done} of {required} trainings done", { done: 2, required: 6 }), go: say(language, "Continue where you left off"), goName: TRAINING_ME.items[0].name, goCat: catName("safety"), start: say(language, "Start the lesson"),
    cards: "start_here|safety|other", dones: "1|0|0", safety: say(language, "{done} of {required} done", { done: 1, required: 3 }), next: say(language, "Up next: {name}", { name: TRAINING_ME.items[0].name }), names: [catName("start_here"), catName("safety"), catName("other")], twoARow: width >= 390,
  };
  const drawn = offered && await waitFor(page, (w) => {
    const c = document.querySelector('[data-training="portal"]');
    if (!c) return false;
    const text = c.innerText;
    const cards = Array.from(c.querySelectorAll("[data-training-category]"));
    if (cards.length !== 3) return false;
    const tops = cards.map(b => Math.round(b.getBoundingClientRect().top));
    const rows = w.twoARow ? tops[0] === tops[1] && tops[2] > tops[0] : tops[0] < tops[1] && tops[1] < tops[2];
    const go = c.querySelector('[data-training-continue="start"]');
    // The label over Continue is drawn in capitals, so it is read that way.
    return !!c.querySelector('[data-training-overall="2/6"]') && text.indexOf(w.overall) !== -1 && !!go && go.innerText.toUpperCase().indexOf(w.go.toUpperCase()) !== -1 && go.innerText.indexOf(w.goName) !== -1 && go.innerText.indexOf(w.goCat) !== -1 && !!go.querySelector("[data-training-continue-go]") && go.querySelector("[data-training-continue-go]").innerText.trim() === w.start
      && cards.map(b => b.getAttribute("data-training-category")).join("|") === w.cards && cards.map(b => b.getAttribute("data-training-category-done")).join("|") === w.dones && rows && cards[1].innerText.indexOf(w.safety) !== -1 && cards[1].innerText.indexOf(w.next) !== -1 && w.names.every(n => text.indexOf(n) !== -1)
      && !!c.querySelector('[data-training-join="1"]') && !!c.querySelector('[data-training-group="history"]') && !c.querySelector("[data-training-group='todo']");
  }, want);
  const wide = await sideways(page);
  if (drawn) await page.click('[data-training-category="safety"]');
  const pageDrawn = drawn && await waitFor(page, (w) => { const c = document.querySelector('[data-training-page="safety"]'); return !!c && window.location.pathname === "/training/c/safety" && Array.from(c.querySelectorAll("[data-training-chip]")).map(x => x.getAttribute("data-training-chip")).join("|") === "todo|todo|soon" && Array.from(c.querySelectorAll("[data-training-chip] span")).some(x => x.innerText.trim() === w.soon) && !!c.querySelector('[data-training-bar="1/3"]') && !!c.querySelector('[data-training-start="tp-2:"]'); }, { soon: say(language, "Expires soon") });
  const wide2 = pageDrawn ? await sideways(page) : 0;
  if (pageDrawn) await page.click('[data-training-start="tp-2:"]');
  const reading = pageDrawn && await waitFor(page, (w) => {
    const c = document.querySelector('[data-lesson="read"]');
    if (!c) return false;
    const blocks = Array.from(c.querySelectorAll("[data-lesson-block]")).map(x => x.getAttribute("data-lesson-block")).join("|");
    const imgs = Array.from(c.querySelectorAll('[data-lesson-block="image"] img'));
    const held = c.querySelector('[data-lesson-held="1"]');
    return blocks === "text|warning|image|image" && imgs.length === 2 && imgs.every(i => i.complete && i.naturalWidth > 0 && i.getBoundingClientRect().width > 200 && i.alt.length > 0) && imgs[0].getAttribute("src").indexOf("data:image/svg+xml;base64,") === 0 && imgs[1].getAttribute("src").indexOf(w.host + "/api/lesson-images/signed/") === 0 && c.innerText.indexOf(w.caption) !== -1 && (w.held ? !!held && held.innerText.indexOf("se muestra en ingl") !== -1 : !held);
  }, { host: LESSON_IMAGE_HOST, caption: TRAINING_LESSONS[1].blocks[2].caption.en, held: language === "es" });
  const wide3 = reading ? await sideways(page) : 0;
  let full = false, closed = false, backToPage = false, backToPortal = false;
  if (reading) {
    await page.click('[data-lesson-block="image"] button');
    full = await waitFor(page, () => { const d = document.querySelector('[data-lesson-picture="1"]'); const i = d && d.querySelector("img"); return !!i && i.complete && i.naturalWidth > 0 && !!d.querySelector('[data-lesson-picture-close="1"]'); });
    await page.click('[data-lesson-picture-close="1"]');
    closed = await waitFor(page, () => !document.querySelector('[data-lesson-picture="1"]'));
    await clickWord(page, catName("safety"));
    backToPage = await waitFor(page, () => !!document.querySelector('[data-training-page="safety"]'));
    await page.goBack();
    backToPortal = await waitFor(page, () => !!document.querySelector('[data-training="portal"]') && window.location.pathname === "/");
  }
  const calls = app.stub.state.calls;
  const reads = calls.filter(c => c.method === "GET" && c.path === "/api/training/lesson-versions/lv-2").map(c => c.search);
  const photos = calls.filter(c => c.method === "GET" && c.path.indexOf("/api/lesson-images/signed/") === 0);
  const sent = reads.length === 1 && reads[0] === "?locale=" + language && photos.length === 1;
  check("The training portal: My training draws 2 of 6 trainings done, Continue where you left off on the first module with Start the lesson, and three category cards in order with their counts, bars, Up next and the check mark on the done one, " + (width >= 390 ? "two" : "one") + " a row; the safety card opens its page at /training/c/safety with its three modules and chips in order; Start on the ladders lesson draws its drawing and its photo, both decoded, the photo from the signed address, " + (language === "es" ? "with the held Spanish line over the English reading" : "with no held line") + "; a tap opens the picture full screen and Close closes it; Back returns to the category page and the phone's back to the portal, with no sideways scroll" + tag,
    drawn && pageDrawn && reading && full && closed && backToPage && backToPortal && sent && wide <= 1 && wide2 <= 1 && wide3 <= 1 && app.errors.length === 0,
    !offered ? "no My training under More" : !drawn ? "the portal did not draw as expected" : !pageDrawn ? "the category page did not draw as expected" : !reading ? "the lesson did not draw its pictures as expected" : !full ? "the picture did not open full screen" : !closed ? "Close did not close the picture" : !backToPage ? "Back did not return to the category page" : !backToPortal ? "the phone's back did not return to the portal" : !sent ? JSON.stringify({ reads, photos: photos.length }) : Math.max(wide, wide2, wide3) > 1 ? Math.max(wide, wide2, wide3) + " pixels sideways" : app.errors[0]);
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
    // /sds reads the API's sheet names alone, the same in every language.
    await guard("/sds (en)", () => sds(browser, "en"));
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
    await guard("Inspection findings", () => findings(browser, "en"));
    await guard("My training", () => training(browser, "en"));
    await guard("Online lessons", () => lessons(browser));
    await guard("Step 264", () => step264(browser));
    await guard("the training portal (en)", () => trainingPortal(browser, "en", 390));
    await guard("the training portal (es)", () => trainingPortal(browser, "es", 320));
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
