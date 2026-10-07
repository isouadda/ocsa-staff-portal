#!/usr/bin/env node
// npm run shots
//
// Pictures of the screen for Help (Step 277). It serves the build/ that
// npm run build left, opens each screen a guide entry describes against
// the stub, at 390 wide, light theme, in English and in Spanish, and
// writes public/guide-shots/<name>.en.jpg and <name>.es.jpg. Every name,
// site and number in a picture is the stub's, so all of it is invented.
//
// SHOTS below is the one list: each picture's name, the guide entry it
// belongs to, and how to reach its screen. An entry names its pictures
// with a line "Picture: <name>" just before "Last checked:", and
// npm run guide-check holds the files to them (guide/README.md).
//
//   npm run shots                     every picture
//   npm run shots -- sign-in home     the pictures named
//
// A JPEG is at most 250 KB. One over it is written again at a lower
// quality, and only below the lowest quality is it cut shorter from the
// bottom. The smoke check does not run this, and this changes nothing
// under src/.

const fs = require("fs");
const path = require("path");
const { serve } = require("./serve");
const { launch, openApp, letSheetOffer, ANDROID } = require("./browser");
const { ADMIN_PERSON, TWIN_ES, SECOND_STEP_CODE, EQ_CODE, SUP_CODE, TRAINING_SESSION_SEED, SIGN_SEED, INSPECTION, INSPECTION_F, timeOffRow, formP, ANNOUNCEMENT } = require("./stub");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, "build");
const OUT = path.join(ROOT, "public", "guide-shots");
const PORT = Number(process.env.SHOTS_PORT || 4797);
const BASE = "http://127.0.0.1:" + PORT;
const WIDTH = 390;
const HEIGHT = 844;
const MAX_BYTES = 250 * 1024;
const QUALITIES = [80, 70, 60, 50, 40];
const NAME_RE = /^[a-z0-9-]{1,60}$/;
const LANGUAGES = ["en", "es"];

// The portal's own word tables, read from src/words.js the way the
// screens read them, so a step says each word in the screen's language.
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

// A supervisor the stub knows, for the screens only management sees.
const SUPERVISOR = Object.assign({}, ADMIN_PERSON, { id: "u-shots-sup", firstName: "Riley", lastName: "Example", role: "supervisor", badgeNumber: "4801", phone: "0000000008", email: "riley@example.invalid" });

// --- driving the page, the way the smoke check does

const pause = (page, ms) => page.waitForTimeout(ms);
async function waitFor(page, fn, arg, ms) {
  try { await page.waitForFunction(fn, arg, { timeout: ms || 8000 }); return true; } catch (e) { return false; }
}
const barButtons = () => {
  const bar = Array.from(document.querySelectorAll("div")).find((el) => {
    const s = getComputedStyle(el);
    return s.position === "fixed" && s.bottom === "0px" && el.querySelectorAll(":scope > button").length >= 5;
  });
  return bar ? Array.from(bar.querySelectorAll(":scope > button")) : [];
};
const BAR_JS = "(" + barButtons.toString() + ")()";
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim().replace(/^(9\+|\d+)\s*/, "");

// One phone, signed in or not, at 390 wide, light theme, opened at path.
async function open(browser, language, o) {
  const opts = o || {};
  const app = await openApp(browser, BASE, Object.assign({
    language: language, textSize: "standard", theme: "light", signedIn: !!opts.signedIn,
    stubOptions: Object.assign({ accountPreferences: { language: language, textSize: "standard" } }, opts.stub || {}),
  }, opts.phone || {}));
  const page = app.page;
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await page.goto(BASE + (opts.path || "/"), { waitUntil: "domcontentloaded" });
  await waitFor(page, () => !!document.querySelector(".sp-content, input[type=\"password\"], form, button"), null, 15000);
  await pause(page, 600);
  return app;
}

// What each shot's steps are handed: the page and the words of its
// language, with the taps a person makes.
function helpers(app, language) {
  const page = app.page;
  const h = {
    page, stub: app.stub, language,
    say: (en, vars) => say(language, en, vars),
    served: (en) => served(language, en),
    pause: (ms) => pause(page, ms),
    waitFor: (fn, arg, ms) => waitFor(page, fn, arg, ms),
    // Some words on the screen, waited for.
    // Some words on the screen, waited for. A heading drawn in capitals
    // reads in capitals, so the words are matched either way.
    waitText: (words, ms) => waitFor(page, (w) => { const t = document.body.innerText.toUpperCase(); return [].concat(w).every(x => t.indexOf(String(x).toUpperCase()) !== -1); }, words, ms),
    hasBar: () => waitFor(page, BAR_JS + ".length >= 5", null, 12000),
    barNames: async () => (await page.evaluate(BAR_JS + ".map(b => b.innerText)")).map(clean),
    tapBar: async (name) => {
      await h.hasBar();
      const hit = await page.evaluate(([js, want]) => { const b = eval(js).find(x => x.innerText.replace(/\s+/g, " ").trim().replace(/^(9\+|\d+)\s*/, "") === want); if (b) b.click(); return !!b; }, [BAR_JS, h.say(name)]);
      await pause(page, 500);
      return hit;
    },
    openMore: async () => {
      await h.hasBar();
      await page.evaluate("(" + barButtons.toString() + ")().pop().click()");
      await pause(page, 500);
    },
    // A screen from the bar, or from under More when it is not on it.
    go: async (name) => {
      if (await h.tapBar(name)) return true;
      await h.openMore();
      const hit = await page.evaluate((want) => {
        const b = Array.from(document.querySelectorAll(".sp-more button")).find(x => x.innerText.replace(/\s+/g, " ").trim().replace(/^(9\+|\d+)\s*/, "") === want);
        if (b) b.click();
        return !!b;
      }, h.say(name));
      await pause(page, 700);
      return hit;
    },
    // A button by its words, its first match, or its spoken label.
    tap: async (words, within) => {
      const hit = await page.evaluate(([t, scope]) => {
        const root = scope ? document.querySelector(scope) : document;
        if (!root) return false;
        const on = Array.from(root.querySelectorAll("button, a, [role=\"button\"]")).filter(x => x.offsetParent !== null && !x.disabled);
        const text = (x) => x.innerText.replace(/\s+/g, " ").trim().toUpperCase();
        const want = t.toUpperCase();
        const b = on.find(x => text(x) === want) || on.find(x => (x.getAttribute("aria-label") || "").trim().toUpperCase() === want) || on.find(x => text(x).indexOf(want) !== -1);
        if (b) { b.click(); return true; }
        return false;
      }, [words, within || null]);
      await pause(page, 600);
      return hit;
    },
    tapLabel: async (label) => {
      const hit = await page.evaluate((l) => { const b = Array.from(document.querySelectorAll("button")).find(x => (x.getAttribute("aria-label") || "") === l); if (b) b.click(); return !!b; }, label);
      await pause(page, 600);
      return hit;
    },
    // The element holding these words, scrolled to the top of the screen
    // under the header, or nearer the middle with where "center".
    show: async (words, where) => {
      await page.evaluate(([w, at]) => {
        // Matched either way, since a heading drawn in capitals reads in
        // capitals.
        const all = Array.from(document.querySelectorAll(".sp-content *, body *")).filter(e => e.children.length === 0 || e.tagName === "BUTTON");
        const up = (e) => (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim().toUpperCase();
        const want = w.toUpperCase();
        const el = all.find(e => up(e) === want) || all.find(e => up(e).indexOf(want) !== -1);
        if (!el) return;
        el.scrollIntoView({ block: at === "center" ? "center" : "start" });
        // Clear of the header that stays on top of the screen.
        if (at !== "center") window.scrollBy(0, -96);
      }, [words, where || "start"]);
      await pause(page, 400);
    },
    // A ring drawn around a small control the entry names, such as the
    // sign out button, so the picture shows where to tap. It is drawn over
    // the screen and moves nothing on it.
    mark: async (selector, words) => {
      const hit = await page.evaluate(([sel, w]) => {
        const el = Array.from(document.querySelectorAll(sel)).find(x => x.offsetParent !== null && (!w || x.innerText.replace(/\s+/g, " ").trim().toUpperCase() === w.toUpperCase()));
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const ring = document.createElement("div");
        ring.setAttribute("data-shots-ring", "1");
        Object.assign(ring.style, { position: "fixed", left: (r.left - 5) + "px", top: (r.top - 5) + "px", width: (r.width + 10) + "px", height: (r.height + 10) + "px",
          border: "3px solid #D92D20", borderRadius: "12px", boxShadow: "0 0 0 2px #FFFFFF", pointerEvents: "none", zIndex: 99999, boxSizing: "border-box" });
        document.body.appendChild(ring);
        return true;
      }, [selector, words || null]);
      await pause(page, 200);
      return hit;
    },
    top: async () => { await page.evaluate(() => window.scrollTo(0, 0)); await pause(page, 300); },
    fill: async (selector, value) => { await page.fill(selector, value); await pause(page, 200); },
    // A value typed into a box the way React hears it.
    type: async (selector, value) => {
      await page.evaluate(([sel, v]) => {
        const e = document.querySelector(sel);
        if (!e) return;
        const proto = e.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(e, v);
        e.dispatchEvent(new Event("input", { bubbles: true }));
      }, [selector, value]);
      await pause(page, 300);
    },
    // A signature drawn with a finger in a canvas.
    sign: async (selector) => {
      const box = await page.$(selector);
      if (!box) return false;
      await box.scrollIntoViewIfNeeded();
      const r = await box.boundingBox();
      if (!r) return false;
      await page.mouse.move(r.x + r.width * 0.2, r.y + r.height * 0.6);
      await page.mouse.down();
      await page.mouse.move(r.x + r.width * 0.4, r.y + r.height * 0.3, { steps: 6 });
      await page.mouse.move(r.x + r.width * 0.6, r.y + r.height * 0.7, { steps: 6 });
      await page.mouse.move(r.x + r.width * 0.8, r.y + r.height * 0.35, { steps: 6 });
      await page.mouse.up();
      await pause(page, 300);
      return true;
    },
  };
  return h;
}

// A checklist box's spoken label, read either way: "Mark {name} done"
// or "Mark {name} not done", in the screen's language, whose two halves
// either side of the name differ from one language to the next.
const marks = (s) => ({ done: s.say("Mark {name} done").split("{name}"), notDone: s.say("Mark {name} not done").split("{name}") });
const MARK_JS = "(function (w, done) { return Array.from(document.querySelectorAll('.sp-content button[aria-label]')).find(function (b) { var a = b.getAttribute('aria-label'); var is = function (h) { return a.indexOf(h[0]) === 0 && a.length >= h[0].length + h[1].length && a.slice(a.length - h[1].length) === h[1]; }; return done ? is(w.notDone) : is(w.done) && !is(w.notDone); }); })";

// --- the list
//
// Each picture: its name, the entry's title as the guide writes it, how
// the phone opens (o: signedIn, path, stub, phone), and the steps to its
// screen (go), which answer false when the screen did not come. In the
// order staff use the screens in October: signing in, Home, training,
// signing for something, Help, reporting, the schedule; then the rest.

// A picture's own few seconds of a phone: a shot that types or draws
// does it the way a person would, with invented words.
const E = (title) => title + " (staff portal)";

// A photo, made in the page, as a phone's camera hands one over.
async function photo(s, selector) {
  const jpg = await s.page.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 800; c.height = 600;
    const x = c.getContext("2d");
    x.fillStyle = "#cfd8dc"; x.fillRect(0, 0, 800, 600);
    x.fillStyle = "#1e88e5"; x.fillRect(250, 120, 300, 380);
    x.fillStyle = "#ffffff"; x.fillRect(290, 220, 220, 120);
    const b = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
    const a = new Uint8Array(await b.arrayBuffer()); let str = ""; a.forEach(v => { str += String.fromCharCode(v); }); return btoa(str);
  });
  await s.page.setInputFiles(selector, { name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpg, "base64") });
  await s.pause(1200);
}

// A Forms card by its title, at the top of the screen.
async function formCard(s, en, es) {
  if (!(await s.go("Forms"))) return false;
  const title = s.language === "es" ? es : en;
  if (!(await s.waitText(title))) return false;
  // The card holding the title and its Start report, in the middle of
  // the screen and ringed, since the cards near the end of the list share
  // the last screen.
  const found = await s.page.evaluate((want) => {
    const card = Array.from(document.querySelectorAll(".sp-content div")).find(d => d.querySelector(":scope > button") && d.textContent.indexOf(want) === 0);
    if (!card) return false;
    card.setAttribute("data-shots-target", "1");
    card.scrollIntoView({ block: "center" });
    return true;
  }, title);
  if (!found) return false;
  await s.pause(400);
  return s.mark("[data-shots-target]");
}
// One of the guide's forms, by its title in each language.
const guideForm = (name, entry, en, es) => ({ name, entry, o: { signedIn: true, stub: { guideForms: true } }, go: (s) => formCard(s, en, es) });

// A field kit tile, on a supervisor's phone.
async function kitTile(s, tile) {
  if (!(await s.go("Field kit"))) return false;
  if (!(await s.waitFor(() => { const sel = document.querySelector("#ocsa-fk-site"); return !!sel && sel.value !== ""; }))) return false;
  if (!tile) return true;
  await s.page.evaluate((w) => { const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.innerText.split("\n")[0].trim() === w); if (b) b.click(); }, s.say(tile));
  await s.pause(900);
  return true;
}

// The site walk form, open on its nth page (1 to 4).
async function sitePage(s, n) {
  if (!(await s.go("Forms"))) return false;
  const title = formP(s.language).title;
  if (!(await s.waitText(title))) return false;
  await s.page.evaluate((want) => {
    const card = Array.from(document.querySelectorAll(".sp-content div")).find(d => d.querySelector(":scope > button") && d.textContent.indexOf(want) === 0);
    const b = card && card.querySelector(":scope > button");
    if (b) b.click();
  }, title);
  await s.pause(1500);
  for (let i = 1; i < n; i += 1) { await s.tap(s.say("Next")); await s.pause(600); }
  await s.top();
  return true;
}

// Settings, with one of its sections at the top.
async function settingsAt(s, heading) {
  if (!(await s.go("Settings"))) return false;
  if (!(await s.waitText(s.say(heading)))) return false;
  // The first section is already at the top, under the header.
  if (heading !== "Appearance") await s.show(s.say(heading));
  return true;
}

// Help, with a question asked and its answer done.
async function asked(s, question, answer) {
  if (!(await s.go("Help"))) return false;
  s.stub.state.served.add(question);
  s.stub.state.help.next = Object.assign({ answer: answer || "spill" }, s.language === "es" ? { language: "es" } : {});
  await s.type(".sp-content textarea", question);
  await s.tapLabel(s.say("Send"));
  return s.waitFor(() => { const box = document.querySelector(".sp-content textarea"); return !!box && !box.disabled && box.value === ""; }, null, 12000);
}

// Assigned, with its one task open. The task's name comes as the API
// serves it, which may be English on a Spanish screen.
async function openAssigned(s) {
  if (!(await s.go("Assigned"))) return false;
  const names = [s.served("Replace the cracked light cover"), "Replace the cracked light cover"];
  if (!(await s.waitFor((n) => n.some(x => document.body.innerText.indexOf(x) !== -1), names))) return false;
  const name = await s.page.evaluate((n) => n.find(x => document.body.innerText.indexOf(x) !== -1), names);
  return s.tap(name);
}

const SHOTS = [
  // Sign in, and a forgotten PIN.
  { name: "sign-in", entry: E("Sign in to the staff portal"), o: { stub: { support: true } },
    go: (s) => s.waitFor(() => !!document.querySelector('[data-support-contact="1"] a')) },
  { name: "reset-pin-ask", entry: E("Reset a forgotten PIN"), o: {},
    go: async (s) => { await s.waitText(s.say("Forgot your PIN?")); await s.tap(s.say("Forgot your PIN?")); return s.waitText(s.say("Send Reset Link")); } },
  { name: "reset-pin-new", entry: E("Reset a forgotten PIN"), o: { path: "/reset-pin?token=fixture" },
    go: (s) => s.waitText(s.say("Save PIN")) },
  { name: "set-pin", entry: E("Choose your own PIN the first time you sign in"), o: { signedIn: true, stub: { mustSetPin: true } },
    go: (s) => s.waitText(s.say("Choose your PIN")) },
  { name: "sign-in-code", entry: E("Sign in with a code on a new device"), o: { stub: { person: ADMIN_PERSON, secondStep: true } },
    go: async (s) => {
      await s.waitFor(() => !!document.querySelector('input[type="password"]'));
      await s.page.fill('input[autocomplete="username"]', "9001");
      await s.page.fill('input[type="password"]', "4907");
      await s.tap(s.say("Sign In"));
      return s.waitFor(() => !!document.querySelector("#ocsa-code"));
    } },
  { name: "register", entry: E("Register as a new employee"), o: {},
    go: async (s) => { await s.waitText(s.say("Sign In")); await s.tap(s.say("New Employee? Register Here")); return s.waitText(s.say("Register")); } },
  // The link from the welcome email, which asks no badge (Step 294).
  { name: "activate", entry: E("Activate your account from the email"), o: { path: "/activate?token=fixture" },
    go: (s) => s.waitText([s.say("Activate Account"), s.say("Choose your 4-digit PIN and pick your language.")]) },

  // Home, and the shift.
  { name: "home", entry: E("What Home shows"), o: { signedIn: true, stub: { requests: true, signatures: true, unfinishedForms: true } },
    go: async (s) => { await s.hasBar(); return s.waitFor(() => !!document.querySelector("[data-request-card], [data-sign-card]") && !!document.querySelector("[data-unfinished-card]")); } },
  { name: "start-shift", entry: E("Start your shift at a site"), o: { signedIn: true, stub: { clockedIn: false } },
    go: async (s) => { await s.hasBar(); return s.waitText(s.say("Choose a Site to Start")); } },
  { name: "end-shift", entry: E("End your shift"), o: { signedIn: true },
    go: async (s) => { await s.hasBar(); if (!(await s.waitText(s.say("End Shift")))) return false; await s.mark("button", s.say("End Shift")); return true; } },
  { name: "sign-out", entry: E("Sign out"), o: { signedIn: true },
    go: async (s) => { await s.hasBar(); return s.mark('button[aria-label="' + s.say("Sign out") + '"]'); } },
  { name: "bottom-bar-more", entry: E("Use the bottom bar and More"), o: { signedIn: true, stub: { support: true } },
    go: async (s) => { await s.openMore(); return s.waitFor(() => !!document.querySelector(".sp-more")); } },

  // Training, and joining a session.
  { name: "first-trainings", entry: E("Your first trainings"), o: { signedIn: true, stub: { training: true, documents: true } },
    go: (s) => s.waitFor(() => !!document.querySelector("[data-first-trainings]")) },
  { name: "my-training", entry: E("See your training"), o: { signedIn: true, stub: { training: true } },
    go: async (s) => { if (!(await s.go("My training"))) return false; return s.waitFor(() => !!document.querySelector("[data-training-start]")); } },
  { name: "training-portal", entry: E("Find and take your trainings"), o: { signedIn: true, stub: { training: true, trainingPortal: true } },
    go: async (s) => { if (!(await s.go("My training"))) return false; if (!(await s.waitFor(() => document.querySelectorAll("[data-training-category]").length === 3))) return false; await s.page.evaluate(() => document.querySelector("[data-training-category]").scrollIntoView({ block: "start" })); await s.page.evaluate(() => window.scrollBy(0, -96)); return true; } },
  { name: "training-category", entry: E("Find and take your trainings"), o: { signedIn: true, stub: { training: true, trainingPortal: true }, path: "/training/c/safety" },
    go: (s) => s.waitFor(() => !!document.querySelector("[data-training-module], [data-training-start]")) },
  { name: "training-continue", entry: "Continue a training you started", o: { signedIn: true, stub: { training: true, trainingPortal: true } },
    go: async (s) => { if (!(await s.go("My training"))) return false; return s.waitFor(() => !!document.querySelector("[data-training-continue]")); } },
  { name: "lesson", entry: E("Take a training lesson"), o: { signedIn: true, stub: { training: true } },
    go: async (s) => {
      if (!(await s.waitFor(() => !!document.querySelector('[data-training-card="todo"]')))) return false;
      await s.page.click('[data-training-card="todo"]');
      if (!(await s.waitFor(() => !!document.querySelector('[data-training-start="tp-1:"]')))) return false;
      await s.page.click('[data-training-start="tp-1:"]');
      return s.waitFor(() => !!document.querySelector('[data-lesson="read"]'));
    } },
  { name: "lesson-question", entry: E("Take a training lesson"), o: { signedIn: true, stub: { training: true } },
    go: async (s) => {
      if (!(await s.waitFor(() => !!document.querySelector('[data-training-card="todo"]')))) return false;
      await s.page.click('[data-training-card="todo"]');
      if (!(await s.waitFor(() => !!document.querySelector('[data-training-start="tp-1:"]')))) return false;
      await s.page.click('[data-training-start="tp-1:"]');
      if (!(await s.waitFor(() => !!document.querySelector('[data-lesson-next="read"]')))) return false;
      await s.page.click('[data-lesson-next="read"]');
      if (!(await s.waitFor(() => !!document.querySelector('[data-lesson="ask"]')))) return false;
      await s.page.click('[data-lesson-option="a"]');
      await s.top();
      return true;
    } },
  { name: "lesson-picture", entry: "Pictures in a lesson", o: { signedIn: true, stub: { training: true, trainingPortal: true }, path: "/training/c/safety" },
    go: async (s) => { if (!(await openLadders(s))) return false; await s.page.evaluate(() => document.querySelector('[data-lesson-block="image"]').scrollIntoView({ block: "center" })); await s.pause(500); return true; } },
  { name: "lesson-picture-full", entry: "Pictures in a lesson", o: { signedIn: true, stub: { training: true, trainingPortal: true }, path: "/training/c/safety" },
    go: async (s) => { if (!(await openLadders(s))) return false; await s.page.click('[data-lesson-block="image"] button'); return s.waitFor(() => !!document.querySelector('[data-lesson-picture="1"] img') && document.querySelector('[data-lesson-picture="1"] img').complete); } },
  { name: "join-session", entry: "Join a training session", o: { signedIn: true, stub: { training: true, documents: true }, path: "/join/" + TRAINING_SESSION_SEED.joinCode },
    go: (s) => s.waitText(TRAINING_SESSION_SEED.title) },
  // The handbook in its own look (Step 290): its cover, and the page
  // signed with the fields filled in.
  { name: "document-read", entry: E("Read and sign a document"), o: { signedIn: true, stub: { training: true, documents: true, handbook: true } },
    go: async (s) => {
      if (!(await s.waitFor(() => !!document.querySelector('[data-first-doc="OCSA-HR-002"] button')))) return false;
      await s.page.click('[data-first-doc="OCSA-HR-002"] button');
      return s.waitFor(() => !!document.querySelector('[data-doc="cover"]'));
    } },
  { name: "document-sign", entry: E("Read and sign a document"), o: { signedIn: true, stub: { training: true, documents: true, handbook: true } },
    go: async (s) => {
      if (!(await s.waitFor(() => !!document.querySelector('[data-first-doc="OCSA-HR-002"] button')))) return false;
      await s.page.click('[data-first-doc="OCSA-HR-002"] button');
      if (!(await s.waitFor(() => !!document.querySelector('[data-doc="cover"] [data-doc-contents="1"]')))) return false;
      await s.page.click('[data-doc="cover"] [data-doc-contents="1"]');
      if (!(await s.waitFor(() => !!document.querySelector('[data-doc-jump="6"]')))) return false;
      await s.page.click('[data-doc-jump="6"]');
      if (!(await s.waitFor(() => !!document.querySelector('[data-doc="sign"] [data-doc-ack-fields]')))) return false;
      await s.page.evaluate(() => document.querySelector('[data-doc-box="statements"]').scrollIntoView({ block: "start" }));
      await s.page.evaluate(() => window.scrollBy(0, -96));
      await s.pause(300);
      return true;
    } },
  // Signed documents (Step 290): the list, and the handbook read again.
  { name: "document-signed-list", entry: E("Read a document you signed"), o: { signedIn: true, stub: { training: true, documents: true, handbook: true, handbookSigned: true } },
    go: async (s) => {
      if (!(await s.go("My training"))) return false;
      if (!(await s.waitFor(() => !!document.querySelector('[data-training-signed="OCSA-HR-002"]')))) return false;
      await s.show(s.say("Signed documents"));
      return true;
    } },
  { name: "document-signed", entry: E("Read a document you signed"), o: { signedIn: true, stub: { training: true, documents: true, handbook: true, handbookSigned: true } },
    go: async (s) => {
      if (!(await s.go("My training"))) return false;
      if (!(await s.waitFor(() => !!document.querySelector('[data-training-signed="OCSA-HR-002"]')))) return false;
      await s.page.click('[data-training-signed="OCSA-HR-002"]');
      if (!(await s.waitFor(() => !!document.querySelector('[data-doc="cover"] [data-doc-contents="1"]')))) return false;
      await s.page.click('[data-doc="cover"] [data-doc-contents="1"]');
      if (!(await s.waitFor(() => !!document.querySelector('[data-doc-jump="6"]')))) return false;
      await s.page.click('[data-doc-jump="6"]');
      if (!(await s.waitFor(() => !!document.querySelector('[data-doc="signed"] [data-doc-signed-page="1"]')))) return false;
      await s.page.evaluate(() => document.querySelector('[data-doc-box="statements"]').scrollIntoView({ block: "start" }));
      await s.page.evaluate(() => window.scrollBy(0, -96));
      await s.pause(300);
      return true;
    } },
  { name: "training-sign-off", entry: E("Sign off a training"), o: { signedIn: true, stub: { training: true, fieldKit: true, person: SUPERVISOR } },
    go: async (s) => {
      if (!(await s.waitFor(() => !!document.querySelector('[data-training-card="signoff"]')))) return false;
      await s.page.click('[data-training-card="signoff"]');
      return s.waitFor(() => !!document.querySelector('[data-fk-signoff="ta-7"]'));
    } },
  { name: "training-session-run", entry: E("Run a training session"), o: { signedIn: true, stub: { training: true, fieldKit: true, person: SUPERVISOR } },
    go: async (s) => {
      // The stub's QR is one white pixel. For the picture, the phone is
      // handed an invented pattern drawn the way a QR looks; it encodes
      // nothing.
      const qr = await s.page.evaluate(() => {
        const n = 29, px = 8, c = document.createElement("canvas"); c.width = c.height = (n + 8) * px;
        const x = c.getContext("2d"); x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, c.width, c.height); x.fillStyle = "#000000";
        let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
        const finder = (r, q) => r < 8 && q < 8 || r < 8 && q >= n - 8 || r >= n - 8 && q < 8;
        for (let r = 0; r < n; r += 1) for (let q = 0; q < n; q += 1) if (!finder(r, q) && rnd() < 0.5) x.fillRect((q + 4) * px, (r + 4) * px, px, px);
        [[0, 0], [0, n - 7], [n - 7, 0]].forEach(([r, q]) => { x.fillRect((q + 4) * px, (r + 4) * px, 7 * px, 7 * px); x.fillStyle = "#FFFFFF"; x.fillRect((q + 5) * px, (r + 5) * px, 5 * px, 5 * px); x.fillStyle = "#000000"; x.fillRect((q + 6) * px, (r + 6) * px, 3 * px, 3 * px); });
        return c.toDataURL("image/png").split(",")[1];
      });
      await s.page.route("**/qr.png*", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(qr, "base64") }));
      if (!(await kitTile(s, "Training session"))) return false;
      if (!(await s.waitFor(() => !!document.querySelector('[data-fk-session="form"]') && !!document.querySelector('[data-fk-session-topic="tp-2"]')))) return false;
      await s.page.fill("#ocsa-session-title", s.language === "es" ? "Repaso de escaleras" : "Ladders refresher");
      await s.page.click('[data-fk-session-topic="tp-2"]');
      await s.page.click('[data-fk-session-start="1"]');
      if (!(await s.waitFor(() => { const c = document.querySelector('[data-fk-session="open"]'); return !!c && !!c.querySelector("[data-fk-session-code]") && !!c.querySelector("img"); }))) return false;
      await s.top();
      return true;
    } },
  { name: "watch-sign-off", entry: E("Watch and sign off a task"), o: { signedIn: true, stub: { training: true, fieldKit: true, person: SUPERVISOR } },
    go: async (s) => {
      if (!(await kitTile(s, "Watch and sign off"))) return false;
      if (!(await s.waitFor(() => !!document.querySelector('[data-pick="observe-person"] [data-pick-row]')))) return false;
      await s.page.click('[data-pick="observe-person"] [data-pick-row]');
      if (!(await s.waitFor(() => !!document.querySelector('[data-fk-checklist="tp-4"] button')))) return false;
      await s.page.click('[data-fk-checklist="tp-4"] button');
      if (!(await s.waitFor(() => document.querySelectorAll("[data-fk-step]").length === 3))) return false;
      await s.page.click('[data-fk-step="s1"]');
      await s.page.click('[data-fk-step="s2"]');
      await s.page.evaluate(() => document.querySelector('[data-fk-observe="steps"]').scrollIntoView({ block: "start" }));
      await s.page.evaluate(() => window.scrollBy(0, -96));
      return true;
    } },

  // Signing for something you received.
  { name: "sign-list", entry: "Sign for something you received", o: { signedIn: true, stub: { signatures: true } },
    go: async (s) => {
      if (!(await s.waitFor(() => !!document.querySelector("[data-sign-card]")))) return false;
      await s.page.click("[data-sign-card]");
      return s.waitFor(() => !!document.querySelector('[data-sign="list"]'));
    } },
  { name: "sign-key", entry: "Sign for something you received", o: { signedIn: true, stub: { signatures: true }, path: "/sign/sr-1" },
    go: async (s) => { if (!(await s.waitFor(() => !!document.querySelector('[data-sign="ready"]')))) return false; await s.sign('[data-sign-signature="1"] canvas'); await s.top(); return true; } },
  { name: "company-property", entry: "My company property", o: { signedIn: true, stub: { signatures: true } },
    go: async (s) => { if (!(await s.go("My company property"))) return false; return s.waitText(s.say("You hold")); } },
  { name: "sign-not-right", entry: "If something is not right", o: { signedIn: true, stub: { signatures: true }, path: "/sign/sr-2" },
    go: async (s) => {
      if (!(await s.waitFor(() => !!document.querySelector('[data-sign-ask="dispute"]')))) return false;
      await s.page.click('[data-sign-ask="dispute"]');
      if (!(await s.waitFor(() => !!document.querySelector("#ocsa-sign-note")))) return false;
      await s.page.fill("#ocsa-sign-note", s.language === "es" ? "Los guantes son una talla m\u00e1s chica." : "The gloves are a size too small.");
      await s.page.evaluate(() => document.querySelector("#ocsa-sign-note").scrollIntoView({ block: "center" }));
      return true;
    } },

  // Help.
  // A how-to answer, with the picture of the screen Help draws under it.
  { name: "help-answer", entry: E("Ask Help a question"), o: { signedIn: true },
    go: async (s) => {
      if (!(await asked(s, s.language === "es" ? "\u00bfC\u00f3mo inicio sesi\u00f3n?" : "How do I sign in?", "howTo"))) return false;
      return s.waitFor(() => { const i = document.querySelector("[data-help-picture] img"); return !!i && i.complete && i.naturalWidth > 0; });
    } },
  { name: "help-photo", entry: E("Send Help a photo"), o: { signedIn: true },
    go: async (s) => {
      if (!(await s.go("Help"))) return false;
      await photo(s, '.sp-content input[type="file"]');
      await s.type(".sp-content textarea", s.language === "es" ? "\u00bfQu\u00e9 debo saber de este producto?" : "What should I know about this product?");
      return s.waitFor(() => Array.from(document.querySelectorAll(".sp-content img")).some(i => /^blob:/.test(i.src)));
    } },
  { name: "help-unfinished", entry: E("Continue a report started in Help"), o: { signedIn: true, stub: { drafts: [{ id: "draft-one", formName: "Incident report", answered: 3, remaining: 2, conversationId: "cv-one" }] } },
    go: async (s) => { if (!(await s.go("Help"))) return false; return s.waitText(s.say("Unfinished reports")); } },
  { name: "help-form-question", entry: E("Get help with a question on a form"), o: { signedIn: true },
    go: (s) => asked(s, s.language === "es" ? "\u00bfQu\u00e9 quiere decir tiempo de contacto en el registro diario?" : "What does contact time mean on the daily log?", "unknown") },
  // App support (Step 290): a ticket Help drafted, on its card; the
  // screen under More, a bug written; and My tickets.
  { name: "help-ticket", entry: E("Send a ticket from Help"), o: { signedIn: true, stub: { support: true } },
    go: async (s) => {
      if (!(await asked(s, s.language === "es" ? "El horario sale en blanco." : "The schedule is blank.", "ticket"))) return false;
      return s.waitFor(() => !!document.querySelector('[data-help-ticket="draft"]'));
    } },
  { name: "app-support", entry: E("Send a ticket to App support"), o: { signedIn: true, stub: { support: true } },
    go: async (s) => {
      if (!(await s.go("App support"))) return false;
      if (!(await s.waitFor(() => !!document.querySelector('[data-support-kind="bug"]')))) return false;
      await s.page.click('[data-support-kind="bug"]');
      await s.fill('[data-support-text="1"]', s.language === "es" ? "Inventado: el mapa de Inicio no carga." : "Invented: the map on Home does not load.");
      await s.page.evaluate(() => document.querySelector('[data-support-text="1"]').scrollIntoView({ block: "center" }));
      await s.pause(300);
      return true;
    } },
  { name: "app-support-tickets", entry: E("See your App support tickets"), o: { signedIn: true, stub: { support: true } },
    go: async (s) => {
      if (!(await s.go("App support"))) return false;
      if (!(await s.waitFor(() => !!document.querySelector('[data-support-ticket="st-1"]')))) return false;
      await s.show(s.say("My tickets"));
      return true;
    } },

  // Reporting a problem or an injury.
  { name: "report-issue", entry: E("Report a problem at a site"), o: { signedIn: true },
    go: async (s) => { if (!(await s.go("Report"))) return false; return s.waitText(s.say("Report an Issue")); } },
  { name: "forms-list", entry: E("Fill in a safety incident or biohazard report as a form"), o: { signedIn: true },
    go: async (s) => { if (!(await s.go("Forms"))) return false; return s.waitText(s.say("Start report")); } },
  // The stub answers GET /api/forms/my-sites with the field kit's sites,
  // for a supervisor, so the question shows with no shift open.
  { name: "form-which-site", entry: E("Fill in a safety incident or biohazard report as a form"), o: { signedIn: true, stub: { clockedIn: false, person: SUPERVISOR, fieldKit: true } },
    go: async (s) => { if (!(await s.go("Forms"))) return false; if (!(await s.waitText(s.served("Incident report")))) return false; await s.tap(s.say("Start report")); return s.waitText(s.say("Which site is this for?")); } },
  { name: "speak-up", entry: E("Report a problem with someone at work"), o: { signedIn: true },
    go: async (s) => { if (!(await s.go("Speak Up"))) return false; return s.waitText(s.say("What happened")); } },

  // The schedule and time off.
  // The week with an inspection assigned to the person on the day of
  // their shift (Step 296), and that day's sheet with its row ringed.
  { name: "schedule", entry: E("See your schedule"), o: { signedIn: true, stub: { scheduleInspections: true } },
    go: async (s) => { if (!(await s.go("Schedule"))) return false; if (!(await s.waitText(s.say("My Schedule")))) return false; return s.waitFor(() => !!document.querySelector('[data-schedule-inspection="in-s1"]')); } },
  { name: "schedule-inspection", entry: E("See your schedule"), o: { signedIn: true, stub: { scheduleInspections: true } },
    go: async (s) => {
      if (!(await s.go("Schedule"))) return false;
      if (!(await s.waitFor(() => !!document.querySelector('[data-schedule-inspection="in-s1"]')))) return false;
      await s.page.evaluate(() => { const c = document.querySelector('[data-schedule-inspection="in-s1"]'); const b = c && c.closest("button"); if (b) b.click(); });
      if (!(await s.waitFor(() => !!document.querySelector('[role="dialog"] [data-schedule-inspection-row="in-s1"]')))) return false;
      return s.mark('[data-schedule-inspection-row="in-s1"]');
    } },
  { name: "drop-shift", entry: E("Request to drop a shift"), o: { signedIn: true },
    go: async (s) => {
      if (!(await s.go("Schedule"))) return false;
      await s.pause(800);
      // The day on the week whose card holds the scheduled shift, from 5
      // to 11 at night, then the shift on the sheet that opens.
      const hit = await s.page.evaluate(() => { const grid = Array.from(document.querySelectorAll(".sp-content div")).find(d => getComputedStyle(d).display === "grid" && d.children.length === 7); const card = grid && Array.from(grid.querySelectorAll("button")).find(b => /11:00/.test(b.innerText)); if (card) card.click(); return !!card; });
      if (!hit) return false;
      await s.pause(800);
      if (!(await s.tap(s.say("Request to Drop This Shift")))) {
        await s.page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).reverse().find(x => x.offsetParent !== null && /11:00/.test(x.innerText)); if (b) b.click(); });
        await s.pause(800);
        if (!(await s.tap(s.say("Request to Drop This Shift")))) return false;
      }
      return s.waitText(s.say("Submit Request"));
    } },
  { name: "time-off-request", entry: E("Request time off"), o: { signedIn: true, stub: { pto: true } },
    go: async (s) => {
      if (!(await s.go("Schedule"))) return false;
      await s.pause(600);
      await s.tap(s.say("Request time off"));
      if (!(await s.waitFor(() => !!document.querySelector('select option[value="pto"]')))) return false;
      await s.page.selectOption('select:has(option[value="pto"])', "pto");
      return s.waitFor(() => Array.from(document.querySelectorAll("div")).some(d => { const c = getComputedStyle(d); return c.position === "fixed" && c.zIndex === "200"; }));
    } },
  { name: "time-off-mine", entry: E("See or cancel your time off"), o: { signedIn: true, stub: { myTimeOff: [timeOffRow({ id: "to-one", status: "requested" })] } },
    go: async (s) => { if (!(await s.go("Schedule"))) return false; if (!(await s.waitText(s.say("My time off")))) return false; await s.show(s.say("My time off")); return true; } },
  { name: "time-off-cancel", entry: E("See or cancel your time off"), o: { signedIn: true, stub: { myTimeOff: [timeOffRow({ id: "to-one", status: "requested" })] } },
    go: async (s) => {
      if (!(await s.go("Schedule"))) return false;
      if (!(await s.waitText(s.say("My time off")))) return false;
      await s.page.evaluate(([heading]) => { const h = Array.from(document.querySelectorAll(".sp-content div")).find(d => d.textContent.trim() === heading); const b = h && h.parentElement.querySelector("button"); if (b) b.click(); }, [s.say("My time off")]);
      await s.pause(900);
      return s.waitText(s.say("Cancel request"));
    } },
  { name: "pickup-available", entry: E("Pick up an open shift"), o: { signedIn: true },
    go: async (s) => { if (!(await s.go("Pickup"))) return false; return s.waitText(s.say("Available")); } },
  { name: "pickup-mine", entry: E("Release a shift you picked up"), o: { signedIn: true, stub: { myPickups: [{ id: "pk-9", site_name: "South Building", scheduled_date: "2026-10-08", start_time: "17:00", end_time: "23:00", status: "claimed" }] } },
    go: async (s) => { if (!(await s.go("Pickup"))) return false; await s.tap(s.say("My Pickups")); return s.waitText(s.say("Release Shift")); } },

  // The checklist.
  { name: "tasks", entry: E("Check off a task on your checklist"), o: { signedIn: true },
    go: async (s) => { if (!(await s.go("Tasks"))) return false; const w = marks(s); return s.waitFor((x) => !!eval(x.js)(x.w, false), { js: MARK_JS, w: w }); } },
  { name: "task-uncheck", entry: E("Uncheck a task checked by mistake"), o: { signedIn: true },
    go: async (s) => {
      if (!(await s.go("Tasks"))) return false;
      const w = marks(s);
      if (!(await s.waitFor((x) => !!eval(x.js)(x.w, true), { js: MARK_JS, w: w }))) return false;
      // The green box of a task checked today, ringed: a tap on it
      // unchecks the task.
      await s.page.evaluate((x) => { const b = eval(x.js)(x.w, true); b.setAttribute("data-shots-target", "1"); b.scrollIntoView({ block: "center" }); }, { js: MARK_JS, w: w });
      await s.pause(400);
      return s.mark("[data-shots-target]");
    } },
  { name: "task-detail", entry: E("See a checklist task's details"), o: { signedIn: true },
    go: async (s) => {
      if (!(await s.go("Tasks"))) return false;
      const chip = s.say("Critical touchpoint");
      if (!(await s.waitFor((w) => Array.from(document.querySelectorAll(".sp-content span")).some(x => x.innerText.trim() === w), chip))) return false;
      await s.page.evaluate((w) => { const c = Array.from(document.querySelectorAll(".sp-content span")).find(x => x.innerText.trim() === w); const row = c.parentElement.parentElement; row.querySelectorAll("button")[1].click(); }, chip);
      return s.waitText(s.say("Back to checklist"));
    } },
  { name: "tasks-no-shift", entry: E("Use Tasks before your shift starts"), o: { signedIn: true, stub: { clockedIn: false } },
    go: async (s) => { if (!(await s.go("Tasks"))) return false; return s.waitText(s.say("Start your shift to see and check off your tasks.")); } },
  { name: "tasks-no-signal", entry: E("Check off tasks with no signal"), o: { signedIn: true },
    go: async (s) => {
      if (!(await s.go("Tasks"))) return false;
      const w = marks(s);
      if (!(await s.waitFor((x) => !!eval(x.js)(x.w, false), { js: MARK_JS, w: w }))) return false;
      s.stub.state.offline = true;
      await s.page.evaluate((x) => eval(x.js)(x.w, false).click(), { js: MARK_JS, w: w });
      if (!(await s.waitText(s.say("Saved on this phone. It sends when you have signal.")))) return false;
      await s.top();
      return true;
    } },
  { name: "change-shift", entry: E("Change your shift"), o: { signedIn: true, stub: { site: "site-west", shiftLabel: "Night shift", links: {} } },
    go: async (s) => { if (!(await s.go("Tasks"))) return false; if (!(await s.waitText(s.say("Change shift")))) return false; await s.tap(s.say("Change shift")); return s.waitText(s.say("Use this shift")); } },

  // Assigned tasks, supplies and inspections.
  { name: "assigned-task", entry: E("Finish a task assigned to you"), o: { signedIn: true },
    go: async (s) => { if (!(await openAssigned(s))) return false; await s.tap(s.say("Resolved")); return s.waitText(s.say("Mark as Resolved")); } },
  { name: "assigned-cannot", entry: E("Say you cannot finish an assigned task"), o: { signedIn: true },
    go: async (s) => { if (!(await openAssigned(s))) return false; await s.tap(s.say("Cannot Resolve")); return s.waitText(s.say("Submit")); } },
  // Step 281: a refill with two items, against an API that takes items,
  // and the person's own requests with the office's decisions.
  // Step 297: Assigned with a task, an issue and a finding, each once;
  // an issue's sheet opened from it; and Issues for a supervisor.
  { name: "assigned-list", entry: E("See everything assigned to you"), o: { signedIn: true, stub: { issueSheet: true } },
    go: async (s) => { if (!(await s.go("Assigned"))) return false; return s.waitFor(() => document.querySelectorAll("[data-work-row]").length === 3); } },
  { name: "issue-sheet", entry: E("Work an issue from its sheet"), o: { signedIn: true, stub: { issueSheet: true } },
    go: async (s) => {
      if (!(await s.go("Assigned"))) return false;
      if (!(await s.waitFor(() => !!document.querySelector('[data-work-row="issue:iss-a1"]')))) return false;
      await s.page.click('[data-work-row="issue:iss-a1"]');
      return s.waitFor(() => !!document.querySelector('[data-issue-sheet="iss-a1"] [data-issue-action="resolve"]'));
    } },
  { name: "issues-list", entry: E("See the issues reported at your sites"), o: { signedIn: true, stub: { issueSheet: true, person: SUPERVISOR } },
    go: async (s) => { if (!(await s.go("Issues"))) return false; if (!(await s.waitFor(() => !!document.querySelector('[data-issue-row="iss-a1"] [data-issue-mine]')))) return false; await s.show(s.say("Issues")); return true; } },
  { name: "supply-request", entry: E("Request supplies or report damaged gear"), o: { signedIn: true, stub: { clockedIn: false, supplyItems: true } },
    go: async (s) => {
      if (!(await s.go("Supplies"))) return false;
      await s.tap(s.say("+ Request"));
      if (!(await s.waitText(s.say("Supply/Gear Request")))) return false;
      await s.tap(s.say("Refill"));
      if (!(await s.waitFor(() => !!document.querySelector('[data-supply-line-supply="0"]')))) return false;
      await s.page.click('[data-supply-line-supply="0"] [data-pick-row="sup-1"]');
      await s.fill('[data-supply-line-qty="0"]', "3");
      await s.tap(s.say("Add item"));
      if (!(await s.waitFor(() => !!document.querySelector('[data-supply-line-supply="1"] [data-pick-search]')))) return false;
      // The second item's supply narrowed by typing, before it is tapped.
      await s.fill('[data-supply-line-supply="1"] [data-pick-search]', "soap");
      if (!(await s.waitFor(() => document.querySelectorAll('[data-supply-line-supply="1"] [data-pick-row]').length === 1))) return false;
      await s.top();
      return true;
    } },
  { name: "supply-requests-mine", entry: E("Request supplies or report damaged gear"), o: { signedIn: true, stub: { clockedIn: false, supplyItems: true } },
    go: async (s) => { if (!(await s.go("Supplies"))) return false; return s.waitFor(() => !!document.querySelector('[data-supply-req="sreq-1"] [data-supply-decision="denied"]')); } },
  { name: "supply-usage", entry: E("Log supplies you used"), o: { signedIn: true },
    go: async (s) => { if (!(await s.go("Supplies"))) return false; return s.waitText(s.say("Supply Tracking")); } },
  { name: "inspection-open", entry: E("Do an inspection assigned to you"), o: { signedIn: true, stub: { inspections: [INSPECTION] } },
    go: async (s) => { if (!(await s.go("Inspect"))) return false; if (!(await s.waitText(INSPECTION.template_name))) return false; await s.tap(INSPECTION.template_name); return s.waitFor(() => !!document.querySelector("[data-inspect-item]")); } },
  // The stub gives a supervisor the permission to schedule one.
  { name: "inspection-schedule", entry: E("Schedule an inspection from the portal"), o: { signedIn: true, stub: { person: SUPERVISOR } },
    go: async (s) => { if (!(await s.go("Inspect"))) return false; await s.pause(600); await s.tap(s.say("+ Schedule")); return s.waitText(s.say("Schedule Inspection")); } },

  // Chat.
  { name: "chat-site", entry: E("Send a message in Chat"), o: { signedIn: true },
    go: async (s) => { if (!(await s.go("Chat"))) return false; await s.pause(900); await s.tap("North Building"); await s.pause(800); await s.type(".sp-content input", s.language === "es" ? "Ya termin\u00e9 el pasillo." : "The corridor is done."); return true; } },
  { name: "chat-not-sent", entry: E("When a message in Chat does not go"), o: { signedIn: true },
    go: async (s) => {
      if (!(await s.go("Chat"))) return false;
      await s.pause(900); await s.tap("North Building"); await s.pause(800);
      await s.type(".sp-content input", s.language === "es" ? "Ya termin\u00e9 el pasillo." : "The corridor is done.");
      s.stub.state.refuse["POST /api/chat/channels/ch-north/messages"] = { status: 500, once: true, body: { error: "Server error" } };
      await s.tapLabel(s.say("Send"));
      return s.waitText(s.say("Try again"));
    } },
  { name: "chat-list", entry: E("Find a chat"), o: { signedIn: true },
    go: async (s) => { if (!(await s.go("Chat"))) return false; return s.waitText("North Building"); } },
  { name: "chat-private", entry: E("Answer a staff member privately in Chat"), o: { signedIn: true, stub: { person: SUPERVISOR, chat: { privates: 8 } } },
    go: async (s) => { if (!(await s.go("Chat"))) return false; return s.waitText(s.say("Private chats")); } },
  { name: "chat-none", entry: E("When Chat shows no chats"), o: { signedIn: true, stub: { chat: { empty: true } } },
    go: async (s) => { if (!(await s.go("Chat"))) return false; return s.waitText(s.say("No chats are set up for you yet. Ask your supervisor.")); } },
  { name: "chat-tag", entry: E("Tag someone in a chat"), o: { signedIn: true },
    go: async (s) => { if (!(await s.go("Chat"))) return false; await s.pause(900); await s.tap("North Building"); await s.pause(900); await s.tapLabel(s.say("Tag someone")); return s.waitText(s.say("Tag someone")); } },
  { name: "chat-new-message", entry: E("Start a message to someone in the office or on staff"), o: { signedIn: true, stub: { person: SUPERVISOR, chatPeopleRoute: true } },
    go: async (s) => { if (!(await s.go("Chat"))) return false; if (!(await s.waitText(s.say("New message")))) return false; await s.tap(s.say("New message")); return s.waitText(s.say("Office")); } },

  // Notices, Settings and the app itself.
  { name: "notifications", entry: E("See your notifications"), o: { signedIn: true, stub: { notifications: [{ id: "n-1", subjectType: "supply_request", subjectId: "sr-1", title: "Supply request approved", body: "Two cases of paper towels.", link: null, createdAt: "2026-10-01T18:00:00.000Z", readAt: null }] } },
    go: async (s) => {
      await s.hasBar();
      await s.page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find(x => /notification|notificaciones/i.test(x.getAttribute("aria-label") || "")); if (b) b.click(); });
      return s.waitText(s.say("Mark all read"));
    } },
  { name: "text-size", entry: E("Make the text bigger"), o: { signedIn: true }, go: (s) => settingsAt(s, "Text size") },
  { name: "appearance", entry: E("Switch between light and dark"), o: { signedIn: true }, go: (s) => settingsAt(s, "Appearance") },
  { name: "language", entry: E("Switch the app to Spanish or English"), o: { signedIn: true }, go: (s) => settingsAt(s, "Language") },
  { name: "change-pin", entry: E("Change your PIN"), o: { signedIn: true }, go: (s) => settingsAt(s, "Change PIN") },
  { name: "shortcuts", entry: E("Change the shortcuts on your bottom bar"), o: { signedIn: true },
    go: async (s) => { if (!(await s.go("Settings"))) return false; await s.pause(600); await s.tap(s.say("Edit shortcuts")); return s.waitText(s.say("On your bar")); } },
  { name: "profile", entry: E("Update your personal information or photo"), o: { signedIn: true },
    go: async (s) => { await s.hasBar(); await s.tapLabel(s.say("Profile")); return s.waitText(s.say("Emergency Contact")); } },
  { name: "phone-alerts-on", entry: E("Turn on alerts on this phone"), o: { signedIn: true, phone: { userAgent: ANDROID, push: { permission: "default" } } },
    go: async (s) => { if (!(await s.go("Settings"))) return false; await s.pause(600); await s.tap(s.say("Phone alerts")); return s.waitText(s.say("Turn on alerts on this phone")); } },
  { name: "phone-alerts-choose", entry: E("Choose what alerts your phone"), o: { signedIn: true, phone: { userAgent: ANDROID, push: { permission: "granted", subscribed: true } } },
    go: async (s) => { if (!(await s.go("Settings"))) return false; await s.pause(600); await s.tap(s.say("Phone alerts")); if (!(await s.waitText(s.say("Chat messages")))) return false; await s.show(s.say("Chat messages")); return true; } },
  { name: "home-screen", entry: E("Add the app to your home screen"), o: { signedIn: true, phone: { installSheet: "fresh" } },
    go: async (s) => { await s.hasBar(); await letSheetOffer(s.page); return s.waitFor(() => !!document.querySelector('[role="dialog"]')); } },
  { name: "update-bar", entry: E("Update the app"), o: { signedIn: true },
    go: async (s) => {
      if (!(await s.go("Help"))) return false;
      await s.type(".sp-content textarea", s.language === "es" ? "D\u00f3nde est\u00e1n" : "Where are the");
      await s.page.context().route("**/version.json*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stamp: "a-newer-build" }) }));
      await s.page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")); });
      await s.page.clock.runFor(16 * 60 * 1000);
      return s.waitText(s.say("A new version is ready"));
    } },
  { name: "sds", entry: E("Find a safety data sheet"), o: { path: "/sds", stub: { sds: true } },
    go: (s) => s.waitText("Invented Glass Cleaner") },
  { name: "workspace", entry: E("Use the team workspace on your phone"), o: { signedIn: true, stub: { person: SUPERVISOR, workspace: true } },
    go: async (s) => { if (!(await s.go("Workspace"))) return false; return s.waitText(s.say("My assignments")); } },

  // Labels and links.
  { name: "equipment-label", entry: E("Check or tag out equipment from its QR label"), o: { signedIn: true, stub: { equipment: true }, path: "/eq/" + EQ_CODE },
    go: (s) => s.waitText(s.say("Checked, all good")) },
  { name: "concern-link", entry: E("What a client sees on the concern link"), o: { stub: { concern: true }, path: "/c/link-concern" },
    go: (s) => s.waitFor(() => document.querySelectorAll('input[type="text"]').length > 0) },
  { name: "supply-label", entry: E("Record a supply from its label"), o: { signedIn: true, stub: { supplyQr: true, sds: true }, path: "/sup/" + SUP_CODE },
    go: (s) => s.waitText(s.say("Used one")) },

  // The field kit.
  { name: "field-kit", entry: E("Open the field kit"), o: { signedIn: true, stub: { person: SUPERVISOR, fieldKit: true, equipment: true } },
    go: (s) => kitTile(s, null) },
  { name: "field-kit-ppe", entry: E("Issue PPE and have the person sign for it"), o: { signedIn: true, stub: { person: SUPERVISOR, fieldKit: true, equipment: true } },
    go: async (s) => {
      if (!(await kitTile(s, "Issue PPE"))) return false;
      if (!(await s.waitFor(() => !!document.querySelector('[data-pick="ppe-person"] [data-pick-row]') && !!document.querySelector('[data-fk-ppe="signature"] canvas')))) return false;
      await s.page.click('[data-pick="ppe-person"] [data-pick-row]');
      await s.page.selectOption("#ocsa-ppe-item", { index: 1 });
      await s.top();
      return true;
    } },
  { name: "field-kit-periodic", entry: E("See the periodic work at a site"), o: { signedIn: true, stub: { person: SUPERVISOR, fieldKit: true, equipment: true } },
    go: async (s) => { if (!(await kitTile(s, "Periodic work"))) return false; return s.waitText(s.say("Overdue")); } },
  { name: "field-kit-equipment", entry: E("Check a site's equipment from the field kit"), o: { signedIn: true, stub: { person: SUPERVISOR, fieldKit: true, equipment: true } },
    go: async (s) => { if (!(await kitTile(s, "Equipment"))) return false; return s.waitFor(() => !!document.querySelector("[data-fk-equipment], .sp-content button")); } },
  { name: "field-kit-review", entry: E("Sign an inspection's review line"), o: { signedIn: true, stub: { person: SUPERVISOR, fieldKit: true, equipment: true } },
    go: async (s) => {
      if (!(await kitTile(s, "Awaiting review"))) return false;
      await s.pause(800);
      if (!(await s.waitFor(() => !!document.querySelector("[data-fk-review]")))) return false;
      await s.page.evaluate(() => { const b = document.querySelector("[data-fk-review] button, button[data-fk-review]"); if (b) b.click(); });
      return s.waitText(s.say("Read only. Only the review lines can be signed here."));
    } },
  { name: "client-request-approve", entry: E("Approve or decline a client request"), o: { signedIn: true, stub: { person: SUPERVISOR, requests: true } },
    go: async (s) => {
      if (!(await s.waitFor(() => !!document.querySelector('[data-request-card="home"]')))) return false;
      await s.page.click('[data-request-card="home"]');
      return s.waitFor(() => !!document.querySelector('[data-request-row="cr-1"]'));
    } },
  { name: "client-request-mine", entry: E("Work a client request assigned to you"), o: { signedIn: true, stub: { requests: true }, path: "/requests/cr-3" },
    go: (s) => s.waitFor(() => !!document.querySelector('[data-request-row="cr-3"]')) },
  { name: "finding-mine", entry: E("Fix an inspection finding assigned to you"), o: { signedIn: true, stub: { findings: true } },
    go: async (s) => {
      s.stub.state.findingRows.push({ id: "fnd-1", site_id: "site-north", site_name: "North Building", title: INSPECTION_F.items[0].label, description: "", zone: INSPECTION_F.items[0].zone || null, severity: "medium", status: "open", source: "inspection", reference: null,
        reported_at: "2026-10-01T20:00:00.000Z", reported_by: "u-shots-sup", assigned_to: "u-one", assigned_to_name: "Alex Tester", due_at: "2026-10-04T20:00:00.000Z", due_state: "onTime", first_response_at: "2026-10-01T20:00:00.000Z", resolved_at: null, resolved_by: null, verified_at: null, verified_by_name: null, item_score_id: "sc-if-1", corrective_action_id: null, photos: [] });
      if (!(await s.go("Report"))) return false;
      if (!(await s.waitFor(() => !!document.querySelector('[data-finding-row="fnd-1"]')))) return false;
      await s.page.evaluate(() => document.querySelector('[data-finding-row="fnd-1"]').scrollIntoView({ block: "center" }));
      return true;
    } },

  // Forms: the table, the checklist, photos, a number, signing, a person.
  { name: "form-checklist", entry: E("Fill in a table, a checklist or a sign-off on a report"), o: { signedIn: true },
    go: (s) => sitePage(s, 2) },
  { name: "form-table", entry: E("Fill in a table, a checklist or a sign-off on a report"), o: { signedIn: true },
    go: (s) => sitePage(s, 3) },
  { name: "form-photos", entry: E("Add photos to a form"), o: { signedIn: true },
    go: async (s) => { if (!(await sitePage(s, 1))) return false; await s.show(s.say("Take photo or choose from gallery"), "center"); return true; } },
  { name: "form-number", entry: E("Enter a number on a form"), o: { signedIn: true },
    go: async (s) => { if (!(await sitePage(s, 3))) return false; await s.show(formP(s.language).fields.find(f => f.key === "count").label, "center"); return true; } },
  { name: "form-sign", entry: E("Sign a form with your finger"), o: { signedIn: true },
    go: async (s) => { if (!(await sitePage(s, 4))) return false; await s.tap(s.say("Sign")); return s.waitText(s.say("Sign with your finger")); } },
  { name: "form-customer-sign", entry: E("Have a customer sign a form you are filling"), o: { signedIn: true },
    go: async (s) => { if (!(await sitePage(s, 4))) return false; await s.show(formP(s.language).fields.find(f => f.key === "guest").label); return true; } },
  { name: "form-person", entry: E("Pick a person on a form"), o: { signedIn: true, stub: { personForm: true } },
    go: async (s) => {
      if (!(await s.go("Forms"))) return false;
      await s.pause(800);
      const title = s.language === "es" ? "Revision con el empleado" : "Employee check-in";
      await s.page.evaluate((want) => { const card = Array.from(document.querySelectorAll(".sp-content div")).find(d => d.querySelector(":scope > button") && d.textContent.indexOf(want) === 0); const b = card && card.querySelector(":scope > button"); if (b) b.click(); }, title);
      return s.waitFor((w) => !!document.querySelector('.sp-content input[placeholder="' + w + '"]'), s.say("Search by name"));
    } },
  { name: "form-leave", entry: E("Leave a form before sending it"), o: { signedIn: true },
    go: async (s) => { if (!(await sitePage(s, 1))) return false; await s.tap(s.say("Close")); return s.waitText(s.say("Keep filling")); } },
  // Save and finish later at the foot of a form (Step 297), ringed.
  { name: "form-save-later", entry: E("Leave a form before sending it"), o: { signedIn: true },
    go: async (s) => { if (!(await sitePage(s, 1))) return false; if (!(await s.waitFor(() => !!document.querySelector("[data-form-later]")))) return false; return s.mark("[data-form-later]"); } },
  // The morning reminder about an unfinished form, in the bell (Step 297).
  { name: "form-reminder", entry: E("Get reminded to finish a form"), o: { signedIn: true, stub: { unfinishedForms: true } },
    go: async (s) => {
      await s.hasBar();
      await s.page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find(x => /notification|notificaci/i.test(x.getAttribute("aria-label") || "")); if (b) b.click(); });
      return s.waitText("You have an unfinished Incident report");
    } },

  // The forms the guide names, each by its card on Forms.
  guideForm("form-daily-log", E("Fill in the daily service log"), "Daily Service Log", "Registro diario de servicio"),
  guideForm("form-ppe-monthly", E("Fill in the monthly PPE check"), "PPE Compliance Log, monthly check", "Registro de cumplimiento de EPP, revisi\u00f3n mensual"),
  guideForm("form-customer-complaint", E("Log a customer complaint"), "Customer Complaint Log", "Registro de quejas de clientes"),
  guideForm("form-safety-inspection", E("Do a safety inspection"), "Safety Inspection Checklist", "Lista de inspecci\u00f3n de seguridad"),
  guideForm("form-corrective-action", E("Raise a corrective action"), "Corrective Action Report", "Reporte de acci\u00f3n correctiva"),
  guideForm("form-environmental-audit", E("Do an environmental audit"), "Environmental Compliance Audit", "Auditor\u00eda de cumplimiento ambiental"),
  guideForm("form-ppe-hazard", E("Do a PPE hazard assessment"), "PPE Hazard Assessment Written Verification", "Verificaci\u00f3n escrita de la evaluaci\u00f3n de riesgos para EPP"),
  guideForm("form-safety-committee", E("Record safety committee minutes"), "Safety Committee Minutes and Attendance", "Acta y asistencia del comit\u00e9 de seguridad"),
  guideForm("form-site-assessment", E("Do a site assessment"), "Pre-Service Site Assessment", "Evaluaci\u00f3n del sitio antes del servicio"),
  guideForm("form-change-of-service", E("Log a change of service request"), "Change of Service Request", "Solicitud de cambio de servicio"),
  guideForm("form-site-orientation", E("Give a site orientation"), "Site-Specific Orientation Checklist", "Lista de orientaci\u00f3n espec\u00edfica del sitio"),
  guideForm("form-call-intake", E("Log a customer contact"), "Call Intake and Communication Log", "Registro de llamadas y comunicaciones"),
];

// The ladders lesson from the safety category's page.
async function openLadders(s) {
  if (!(await s.waitFor(() => !!document.querySelector("[data-training-start]")))) return false;
  const hit = await s.page.evaluate(() => { const b = Array.from(document.querySelectorAll("[data-training-start]")).find(x => /ladder|escalera/i.test(x.closest("[data-training-module]") ? x.closest("[data-training-module]").innerText : x.parentElement.innerText)); if (b) b.click(); return !!b; });
  if (!hit) return false;
  return s.waitFor(() => { const i = document.querySelector('[data-lesson-block="image"] img'); return !!i && i.complete && i.naturalWidth > 0; });
}

// The guide's entries a picture cannot show, and why. The pull request
// lists them, and npm run guide-check reads none of this.
const LEFT_OUT = [
  [E("What the daily service log asks: the shift, the areas and the tasks"), "the questions come from the API's form, which the stub does not hold, so a picture would show invented questions"],
  [E("What the daily service log asks: equipment, work left, safety and site notes"), "the same"],
  [E("What the monthly PPE check asks"), "the same"],
  [E("What the safety inspection asks"), "the same"],
  [E("What the corrective action report asks"), "the same"],
  [E("What the environmental audit asks"), "the same"],
  [E("What the PPE hazard assessment asks"), "the same"],
  [E("What the safety committee minutes ask"), "the same"],
  [E("Fill in a performance review with the employee"), "the review is filled on the admin dashboard, and the portal has no screen for it"],
];

// --- taking them

async function takeOne(browser, shot, language) {
  const app = await open(browser, language, shot.o);
  const s = helpers(app, language);
  try {
    const ok = await shot.go(s);
    if (ok === false) {
      // SHOTS_DEBUG=<folder> keeps what the screen showed instead.
      if (process.env.SHOTS_DEBUG) await app.page.screenshot({ path: path.join(process.env.SHOTS_DEBUG, shot.name + "." + language + ".png") }).catch(() => {});
      throw new Error("the screen did not show");
    }
    await pause(app.page, 500);
    let quality = QUALITIES[0], height = HEIGHT, buf = null;
    for (const q of QUALITIES) {
      quality = q;
      buf = await app.page.screenshot({ type: "jpeg", quality: q, animations: "disabled", caret: "hide" });
      if (buf.length <= MAX_BYTES) break;
    }
    // Below the lowest quality, the bottom is cut away a little at a time.
    while (buf.length > MAX_BYTES && height > HEIGHT / 2) {
      height -= 60;
      buf = await app.page.screenshot({ type: "jpeg", quality: QUALITIES[QUALITIES.length - 1], clip: { x: 0, y: 0, width: WIDTH, height: height }, animations: "disabled", caret: "hide" });
    }
    if (buf.length > MAX_BYTES) throw new Error("still " + Math.round(buf.length / 1024) + " KB at quality " + quality);
    const file = path.join(OUT, shot.name + "." + language + ".jpg");
    fs.writeFileSync(file, buf);
    return { kb: Math.round(buf.length / 1024), quality: quality, cut: height < HEIGHT ? height : null, errors: app.problems.filter(p => /^pageerror/.test(p)) };
  } finally {
    await app.context.close();
  }
}

async function main() {
  // The list names each picture once, each in the pattern Help reads.
  const seen = new Set();
  SHOTS.forEach((x) => {
    if (!NAME_RE.test(x.name)) throw new Error("not a picture name: " + x.name);
    if (seen.has(x.name)) throw new Error("named twice: " + x.name);
    seen.add(x.name);
  });
  // Every picture belongs to an entry the guide has, and every entry has
  // a picture or a reason it has none.
  const { parseGuide, readGuide } = require("../scripts/guide-file");
  const titles = parseGuide(readGuide()).entries.map(e => e.title);
  const strays = SHOTS.filter(x => titles.indexOf(x.entry) === -1).map(x => x.name + " (" + x.entry + ")").concat(LEFT_OUT.filter(x => titles.indexOf(x[0]) === -1).map(x => x[0]));
  if (strays.length > 0) { console.error("not an entry in the guide: " + strays.join("; ")); process.exit(1); }
  const bare = titles.filter(t => !SHOTS.some(x => x.entry === t) && !LEFT_OUT.some(x => x[0] === t));
  if (bare.length > 0) console.log("warning: no picture and no reason for: " + bare.join("; "));
  const asked = process.argv.slice(2).filter(a => a && a[0] !== "-");
  const unknown = asked.filter(a => !seen.has(a));
  if (unknown.length > 0) { console.error("no picture named " + unknown.join(", ")); process.exit(1); }
  const todo = asked.length > 0 ? SHOTS.filter(x => asked.indexOf(x.name) !== -1) : SHOTS;
  if (!fs.existsSync(path.join(BUILD, "index.html"))) { console.error("there is no build/: run npm run build first"); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve(BUILD, PORT);
  const browser = await launch();
  let failed = 0;
  const started = Date.now();
  try {
    for (const shot of todo) {
      for (const language of LANGUAGES) {
        try {
          const r = await takeOne(browser, shot, language);
          console.log("ok   " + shot.name + "." + language + ".jpg  " + r.kb + " KB, quality " + r.quality + (r.cut ? ", cut to " + r.cut + " high" : "") + (r.errors.length ? "  page error: " + r.errors[0] : ""));
          if (r.errors.length) failed += 1;
        } catch (e) {
          failed += 1;
          console.log("FAIL " + shot.name + "." + language + ".jpg  " + String(e && e.message || e).split("\n")[0]);
        }
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log("\n" + todo.length + " pictures in " + LANGUAGES.length + " languages, " + failed + " failed, " + Math.round((Date.now() - started) / 1000) + " seconds");
  process.exit(failed ? 1 : 0);
}

// Read as a module, it hands over its lists and takes no picture.
if (require.main === module) main().catch((e) => { console.error(e); process.exit(2); });
module.exports = { SHOTS, LEFT_OUT };
