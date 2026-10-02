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
//   - a customer's form that asks the name and role itself draws neither
//     of the page's own and sends its own answers as customerName and
//     customerRole; a form that does not ask still draws them
//   - a check-off with no signal is kept on the phone and says so, and
//     goes once, with its clientId, when the signal is back (English
//     alone)
//   - an equipment label's page opens, signed in, and Checked, all good
//     sends { kind: "check" }
//   - a periodic task says how often it comes beside its name
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
const { createStub, servedFor, ADMIN_PERSON, FORM, TWIN_ES, HELP_ANSWERS, SDS_SHEETS, WS_TODO, SECOND_STEP_CODE, SECOND_STEP_HINT, FORM_A_WORDS, EQ_CODE, EQ_ITEM } = require("./stub");
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

// A cleaner, through the whole portal, in one language. The stub would
// answer the workspace here too, so a cleaner who asked would be seen.
async function cleaner(browser, language) {
  const tag = " (" + language + ")";
  const app = await open({ accountPreferences: { language: language, textSize: "standard" }, clockedIn: false, workspace: true }, { browser, language });
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

// A supervisor, with the workspace answering.
async function supervisor(browser, language) {
  const person = Object.assign({}, ADMIN_PERSON, { id: "u-smoke-sup", firstName: "Riley", lastName: "Example", role: "supervisor", badgeNumber: "4801", phone: "0000000008", email: "riley@example.invalid" });
  const app = await open({ person: person, workspace: true, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, signedIn: true });
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
  await app.context.close();
}

// A customer's form that asks the name and role itself (Step 240), and
// one that does not.
async function customerAsks(browser, language) {
  const w = FORM_A_WORDS[language];
  const app = await open({ customerAsks: true, accountPreferences: { language: language, textSize: "standard" } }, { browser, language, path: "/c/link-asks" });
  const page = app.page;
  const up = await waitFor(page, (title) => document.body.innerText.indexOf(title) !== -1 && document.querySelectorAll('input[type="text"]').length > 0, w.title);
  const looks = await page.evaluate((nameLabel) => ({
    own: !!document.querySelector('input[autocomplete="name"]') || !!document.querySelector('input[autocomplete="organization-title"]'),
    honeypot: !!document.querySelector('input[name="website"]'),
    named: Array.from(document.querySelectorAll("div")).filter(d => d.firstChild && d.firstChild.nodeType === 3 && d.firstChild.textContent.trim() === nameLabel).length,
  }), w.name);
  const boxes = page.locator('input[type="text"]:not([name="website"])');
  await boxes.nth(0).fill("Invented Org");
  await boxes.nth(1).fill("An invented customer");
  await boxes.nth(2).fill("Facilities");
  for (let i = 0; i < 4 && !(await page.evaluate((s) => Array.from(document.querySelectorAll("button")).some(b => b.innerText.trim() === s), say(language, "Send"))); i += 1) {
    await page.evaluate((n) => { const b = Array.from(document.querySelectorAll("button")).find(x => x.innerText.trim() === n); if (b) b.click(); }, say(language, "Next"));
    await pause(page, 500);
  }
  await page.evaluate((s) => { const b = Array.from(document.querySelectorAll("button")).find(x => x.innerText.trim() === s); if (b) b.click(); }, say(language, "Send"));
  for (let i = 0; i < 15 && app.stub.state.customerFiled.length === 0; i += 1) await pause(page, 200);
  const got = app.stub.state.customerFiled[0];
  await app.context.close();
  // Another form keeps the page's own.
  const other = await open({ accountPreferences: { language: language, textSize: "standard" } }, { browser, language, path: "/c/link-survey" });
  await waitFor(other.page, () => document.querySelectorAll('input[type="text"]').length > 0);
  const kept = await other.page.evaluate(() => !!document.querySelector('input[autocomplete="name"]') && !!document.querySelector('input[autocomplete="organization-title"]') && !!document.querySelector('input[name="website"]'));
  await other.context.close();
  const sent = !!got && got.customerName === "An invented customer" && got.customerRole === "Facilities" && got.answers.your_name === "An invented customer" && got.answers.your_role === "Facilities";
  check("a customer's form that asks the name and role itself draws neither of the page's own and sends its answers as customerName and customerRole; another form still draws them (" + language + ")",
    up && !looks.own && looks.honeypot && looks.named === 1 && sent && kept && app.errors.length === 0 && other.errors.length === 0,
    !up ? "the form did not open" : looks.own ? "the page's own Your name or Your role showed" : !looks.honeypot ? "no hidden website field" : looks.named !== 1 ? looks.named + " questions read " + JSON.stringify(w.name) : !sent ? "sent " + JSON.stringify(got || null) : !kept ? "the other form lost the page's own Your name and Your role" : (app.errors[0] || other.errors[0]));
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
    for (const language of ["en", "es"]) await guard("a customer's own name and role (" + language + ")", () => customerAsks(browser, language));
    await guard("a check-off with no signal", () => noSignal(browser));
    for (const language of ["en", "es"]) await guard("an equipment label (" + language + ")", () => equipment(browser, language));
    for (const language of ["en", "es"]) await guard("periodic work (" + language + ")", () => periodic(browser, language));
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
