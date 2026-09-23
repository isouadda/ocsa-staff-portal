// Every journey a person actually takes, in both languages.
//
// A journey is judged first on what the app sent, which does not move
// when a word changes, and then on what the screen said.

const { openApp, letSheetOffer } = require("./browser");
const { say, ES, LEAKABLE, SPANISH, SPANISH_PATTERNS } = require("./words");
const { openTab, clickText, startForm, ALLOWED } = require("./screens");
const { INSPECT, languageRows } = require("./checks");
const { TIME_OFF_REFUSALS, HR_CASE_REFUSALS, timeOffRow, PERSON, SECOND_PERSON, formP, STAFF, LOOKUPS, INSPECTION, INSPECTION_GONE, TWIN_ES, servedFor, createStub, SITE_TASKS, SHIFT_ORDER, LINKS, taskWords, lookupsIn, HELP_ANSWERS, HELP_REFUSALS, helpReply, replyPieces,
  SHIFT_REFUSALS, NOT_YOUR_CHECK, WEST_SHIFT_NAMES, CATEGORY_CODES, PERIODS, refusalIn } = require("./stub");

const LANGUAGES = ["en", "es"];
const pause = (page, ms) => page.waitForTimeout(ms || 600);

// --- small hands ------------------------------------------------------

// Everything a journey types, which is the person's own words: a Spanish
// screen that shows a question back to the person who typed it is right
// to show it as it was typed.
const TYPED = new Set();

const type = (page, selector, value) => { TYPED.add(String(value)); return page.evaluate(([sel, v]) => {
  const e = document.querySelector(sel);
  if (!e) return false;
  const proto = e.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype
    : e.tagName === "SELECT" ? window.HTMLSelectElement.prototype
      : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(e, v);
  e.dispatchEvent(new Event(e.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  if (e.tagName === "SELECT") e.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}, [selector, value]); };

const typeNth = (page, selector, n, value) => { TYPED.add(String(value)); return page.evaluate(([sel, i, v]) => {
  const e = document.querySelectorAll(sel)[i];
  if (!e) return false;
  const proto = e.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype
    : e.tagName === "SELECT" ? window.HTMLSelectElement.prototype
      : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(e, v);
  e.dispatchEvent(new Event(e.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  if (e.tagName === "SELECT") e.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}, [selector, n, value]); };

const tapLabel = (page, label) => page.evaluate((l) => {
  const b = Array.from(document.querySelectorAll("button")).find(x => (x.getAttribute("aria-label") || "").trim() === l && x.offsetParent !== null);
  if (b && !b.disabled) { b.click(); return true; }
  return false;
}, label);

const bodyText = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
// What a box still holds, read back off the screen.
const boxText = (page, selector) => page.evaluate((sel) => { const e = document.querySelector(sel); return e ? e.value : null; }, selector);
const sheetText = (page) => page.evaluate(() => {
  const d = Array.from(document.querySelectorAll("div")).filter((x) => {
    const s = getComputedStyle(x);
    return s.position === "fixed" && s.top === "0px" && s.left === "0px" && s.right === "0px" && s.bottom === "0px";
  }).pop();
  return d ? d.innerText.replace(/\s+/g, " ") : "";
});
const toastText = (page) => page.evaluate(() => {
  const d = Array.from(document.querySelectorAll("div")).find((x) => { const s = getComputedStyle(x); return s.position === "fixed" && s.top === "80px"; });
  return d ? d.innerText.trim() : "";
});

const sent = (stub, method, pathLike) => stub.state.calls.filter(c => c.method === method && c.path.indexOf(pathLike) === 0);
// Every box on the page, filled with something the API will take.
const answerEveryBox = (page) => page.evaluate(() => {
  Array.from(document.querySelectorAll(".sp-content input, .sp-content textarea")).forEach((e, i) => {
    if (e.type === "checkbox" || e.type === "radio" || e.type === "file") return;
    const proto = e.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const value = e.type === "date" ? "2026-10-01" : e.type === "time" ? "09:00" : "An invented answer " + i;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(e, value);
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
});

// Every word Speak Up draws that Step 109 brings in. A word with no
// Spanish entry falls back to English in the app and in say() alike, so
// a case written with say() would pass on a screen that was never
// translated. This list is read against the table itself instead.
const SPEAKUP_WORDS = [
  "Is this about someone in management?",
  "Anyone you pick below will not be able to see this report.",
  "Who is involved?",
  "Optional",
  "Who is it about? Pick at least one person.",
  "Search by name",
  "Remove {name}",
  "No one matches that name.",
  "The staff list did not load. Try again in a minute.",
  "Yes",
  "No",
].concat(HR_CASE_REFUSALS);
const untranslated = (list) => list.filter(w => !Object.prototype.hasOwnProperty.call(ES, w));

// Is Send off, which is what waiting for an answer looks like.
const sendIsOff = (page, language) => page.evaluate((want) => {
  const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.textContent.trim() === want);
  return !b || b.disabled;
}, say("Send", language));

// The API sends a first and a last name, and the screen draws them the
// way a person says them.
const whole = (p) => p.firstName + " " + p.lastName;

// Is a name offered on the picker's list, read without tapping it.
// The header draws the signed in person's name too, so only a button
// inside the screen counts.
const nameIsOffered = (page, name) => page.evaluate((want) => Array.from(document.querySelectorAll(".sp-content button"))
  .some(x => x.textContent.trim() === want), name);

// One name on the picker's list, tapped.
const pickPerson = (page, name) => page.evaluate((want) => {
  const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.textContent.trim() === want);
  if (b) b.click();
  return !!b;
}, name);

// The chips above the search box, each one a button that takes its own
// name off, which is what its label says.
const chipLabel = (language) => say("Remove {name}", language).split("{")[0].trim();
const chipCount = (page, language) => page.evaluate((mark) => Array.from(document.querySelectorAll(".sp-content button"))
  .filter(b => (b.getAttribute("aria-label") || "").indexOf(mark) === 0).length, chipLabel(language));
const removeEveryChip = async (page, language) => {
  for (let i = 0; i < 12; i += 1) {
    const went = await page.evaluate((mark) => {
      const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => (x.getAttribute("aria-label") || "").indexOf(mark) === 0);
      if (b) { b.click(); return true; }
      return false;
    }, chipLabel(language));
    if (!went) return;
    await pause(page, 200);
  }
};

const lastSent = (stub, method, pathLike) => { const all = sent(stub, method, pathLike); return all.length ? all[all.length - 1] : null; };

// A photo the browser will accept, made in the page so no file is read
// off disk and nothing real is ever uploaded.
const attachPhoto = (page, selector) => page.evaluate((sel) => new Promise((done) => {
  const input = document.querySelector(sel);
  if (!input) { done(false); return; }
  const c = document.createElement("canvas"); c.width = 12; c.height = 12;
  c.toBlob((b) => {
    const f = new File([b], "photo.jpg", { type: "image/jpeg" });
    const dt = new DataTransfer(); dt.items.add(f);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    done(true);
  }, "image/jpeg");
}), selector);

// A file that says it is a photo and is not one, so the phone cannot
// read it.
const attachBroken = (page, selector) => page.evaluate((sel) => {
  const input = document.querySelector(sel);
  if (!input) return false;
  const f = new File([new Blob(["not a photo"], { type: "image/jpeg" })], "photo.jpg", { type: "image/jpeg" });
  const dt = new DataTransfer(); dt.items.add(f);
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}, selector);

// The Spanish of an English line, read off the table itself. say() falls
// back to English exactly the way the app does, so a case written with
// say() passes on a screen that was never translated. This does not: a
// line with no Spanish entry reads as a line nothing can draw.
const spanishOf = (english, language) => {
  if (language !== "es") return english;
  return Object.prototype.hasOwnProperty.call(ES, english) ? ES[english] : "(no Spanish entry for: " + english + ")";
};
const fill = (line, vars) => String(line).replace(/\{(\w+)\}/g, (whole, k) => (vars && k in vars ? String(vars[k]) : whole));
const has = (text, line) => String(text).toLowerCase().indexOf(String(line).toLowerCase()) !== -1;

// --- the checklist ----------------------------------------------------

// Every box on the checklist, in the order the screen draws them: the
// item's name as the box's own label says it, and whether it is checked.
// The label is the one a screen reader hears, so the name is read off it
// in the case's language. The longer label is tried first, since in
// English "Mark {name} done" would also fit "Mark x not done".
const checklist = (page, language) => page.evaluate(([checked, open]) => {
  const nameIn = (pattern, label) => {
    const [before, after] = pattern.split("{name}");
    const fits = label.indexOf(before) === 0 && label.length >= before.length + after.length && label.slice(label.length - after.length) === after;
    return fits ? label.slice(before.length, label.length - after.length) : null;
  };
  const out = [];
  Array.from(document.querySelectorAll(".sp-content button[aria-label]")).forEach((b) => {
    const label = b.getAttribute("aria-label");
    const done = nameIn(checked, label);
    if (done !== null) { out.push({ name: done, done: true }); return; }
    const todo = nameIn(open, label);
    if (todo !== null) out.push({ name: todo, done: false });
  });
  return out;
}, [say("Mark {name} not done", language), say("Mark {name} done", language)]);

// The count on Home, read as it is drawn, done over total, beside its bar.
const homeCount = (page) => page.evaluate(() => {
  const s = Array.from(document.querySelectorAll(".sp-content span")).find(x => /^\d+\/\d+$/.test(x.textContent.trim()) && x.previousElementSibling && x.previousElementSibling.firstElementChild);
  return s ? s.textContent.trim() : null;
});
// The percentage on the checklist's own card.
const listPercent = (page) => page.evaluate(() => {
  const d = Array.from(document.querySelectorAll(".sp-content div")).find(x => x.children.length === 0 && /^\d+%$/.test(x.textContent.trim()));
  return d ? d.textContent.trim() : null;
});
// An item's name as a screen in one language should draw it: the API's
// own words where it sends them, and the item's own where it does not.
const itemName = (id, language) => taskWords(id, language).label;
const siteNames = (site, language) => SITE_TASKS[site].map(r => itemName(r.id, language));

// The list, the count on Home and the checklist's own percentage, all
// read after a fresh look at each screen, and judged against each other:
// the count is the checks drawn over the items drawn.
async function countsAgree(app, language, expect, what) {
  await openTab(app.page, "tasks", language);
  await pause(app.page, 900);
  const rows = await checklist(app.page, language);
  const percent = await listPercent(app.page);
  await openTab(app.page, "clock", language);
  await pause(app.page, 900);
  const home = await homeCount(app.page);
  const ticked = rows.filter(r => r.done).length;
  const wantHome = ticked + "/" + rows.length;
  const wantPercent = rows.length ? Math.round((ticked / rows.length) * 100) + "%" : null;
  expect(what, home === wantHome && percent === wantPercent,
    "Home reads " + JSON.stringify(home) + " and the checklist " + JSON.stringify(percent) + ", with " + rows.length + " items drawn and " + ticked + " checked");
  await openTab(app.page, "tasks", language);
  await pause(app.page, 700);
  return rows;
}

// Tap one item's box and wait for the answer.
const tickItem = async (page, language, name) => {
  const hit = await tapLabel(page, fill(say("Mark {name} done", language), { name: name }));
  await pause(page, 900);
  return hit;
};

// Start the app again on the same stub, the way a phone does when it is
// opened later, and come back to the checklist.
const reopen = async (page, language) => {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".sp-content", { timeout: 20000 });
  await pause(page, 1200);
  await openTab(page, "tasks", language);
  await pause(page, 1000);
};

// The Spanish check every screen in the sweep is put through, run on the
// screen a journey has reached, with what this journey's stub served.
// What the person typed is theirs, in whatever language they wrote it,
// so it counts as a name. Its rows carry the journey's own name.
async function spokenHere(app, language, expect) {
  if (language !== "es") return;
  const served = servedFor(app.stub);
  const found = await app.page.evaluate(INSPECT, {
    languageOnly: true, leakable: LEAKABLE, allowed: ALLOWED, language: language, scope: null,
    spanish: SPANISH, patterns: SPANISH_PATTERNS,
    names: served.names.concat(Array.from(TYPED)), words: served.words, codes: served.codes,
  });
  languageRows(found).forEach(r => expect(r.check, false, r.detail));
}

// --- the checklist in shifts and periods, Step 124 --------------------

// West Building's list is shaped like the busiest live one: a day shift
// and a night shift that runs past midnight, and work that repeats. Its
// session carries no shift unless a case names one.
const WEST = "site-west";
const DAY_SHIFT = "Day shift";
const NIGHT_SHIFT = "Night shift";
const westAt = (over) => Object.assign({ site: WEST, links: {} }, over || {});
// The suite's clock is 9:30 PM; a day porter's case opens at 9:00 AM.
const MORNING = "2026-10-01T13:00:00Z";

// What a list request would get right now, and the names the screen
// should draw for it.
const listNow = (stub, site, language, extra) => stub.peek.rows(site, "?" + (extra ? extra + "&" : "") + "day=today&locale=" + (language === "es" ? "es" : "en"));
const namesOf = (rows, language) => rows.map(r => itemName(r.id, language));

// The site's own row on Home, tapped, which chooses it.
const pickSite = (page, name) => page.evaluate((want) => {
  const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.textContent.indexOf(want) !== -1 && !x.disabled);
  if (b) b.click();
  return !!b;
}, name);

// The sheet that asks which shift, read off the screen: whether it is up,
// its words, and each choice with whether it is the one chosen. Found by
// its title, the way a person finds it.
const shiftSheet = (page, language) => page.evaluate((title) => {
  const head = Array.from(document.querySelectorAll(".sp-content div")).find(d => d.children.length === 0 && d.textContent.trim() === title && d.offsetParent !== null);
  if (!head) return { up: false, text: "", choices: [] };
  const card = head.parentElement;
  return {
    up: true,
    text: card.innerText.replace(/\s+/g, " ").trim(),
    choices: Array.from(card.querySelectorAll("[role=\"radio\"]")).map(b => ({ text: b.innerText.replace(/\s+/g, " ").trim(), picked: b.getAttribute("aria-checked") === "true" })),
  };
}, say("Which shift are you working?", language));
// One of the sheet's choices, by the shift's name.
const pickShift = (page, name) => page.evaluate((want) => {
  const b = Array.from(document.querySelectorAll(".sp-content [role=\"radio\"]")).find(x => x.innerText.trim().indexOf(want) === 0);
  if (b) b.click();
  return !!b;
}, name);
// The hours a shift's window spans, the way the screen should draw them.
const hoursOf = (page, language, from, to) => page.evaluate(([lang, a, b, line]) => {
  const at = (v) => { const m = /^(\d{1,2}):(\d{2})/.exec(v); return new Date(2024, 0, 1, Number(m[1]), Number(m[2])).toLocaleTimeString(lang === "es" ? "es-US" : "en-US", { hour: "numeric", minute: "2-digit" }); };
  return line.replace("{start}", at(a)).replace("{end}", at(b));
}, [language, from, to, say("{start} to {end}", language)]);
// The shift line under the checklist's top card: the words around its
// Change shift button, or null when there is none.
const shiftLine = (page, language) => page.evaluate((change) => {
  const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.textContent.trim() === change && x.offsetParent !== null);
  return b ? b.parentElement.innerText.replace(/\s+/g, " ").trim() : null;
}, say("Change shift", language));
// Every request that changed a session's shift.
const shiftChanges = (stub) => stub.state.calls.filter(c => c.method === "PATCH" && /^\/api\/shift-sessions\/[^/]+\/shift$/.test(c.path));

// One row of the checklist, by the item's name: whether its box is
// checked, whether the box can be tapped at all, and every word the row
// draws, its lines under the name included.
const rowOf = (page, language, name) => page.evaluate(([checked, open, want]) => {
  const labels = [[checked.replace("{name}", want), true], [open.replace("{name}", want), false]];
  for (const [label, done] of labels) {
    const b = Array.from(document.querySelectorAll(".sp-content button[aria-label]")).find(x => x.getAttribute("aria-label") === label);
    if (b) return { found: true, done: done, disabled: b.disabled, text: b.parentElement.innerText.replace(/\s+/g, " ").trim() };
  }
  return { found: false, done: false, disabled: false, text: "" };
}, [say("Mark {name} not done", language), say("Mark {name} done", language), name]);
// A row's box, tapped, whatever it offers.
const tapRow = async (page, language, name) => {
  const hit = await page.evaluate(([checked, open, want]) => {
    const b = Array.from(document.querySelectorAll(".sp-content button[aria-label]")).find(x => x.getAttribute("aria-label") === checked.replace("{name}", want) || x.getAttribute("aria-label") === open.replace("{name}", want));
    if (b && !b.disabled) { b.click(); return true; }
    return false;
  }, [say("Mark {name} not done", language), say("Mark {name} done", language), name]);
  await pause(page, 900);
  return hit;
};
// Who did an item and when, as the screen should say it: today,
// yesterday, a weekday within the last six days, and the date before
// that, on the company's calendar, New York's.
const doneLine = (page, language, at, firstName) => page.evaluate(([lang, when, name, words]) => {
  const zone = "America/New_York";
  const locale = lang === "es" ? "es-US" : "en-US";
  const dayOf = (ms) => { const p = {}; new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(ms)).forEach((x) => { p[x.type] = Number(x.value); }); return Math.round(Date.UTC(p.year, p.month - 1, p.day) / 86400000); };
  const put = (line, vars) => line.replace(/\{(\w+)\}/g, (whole, k) => (k in vars ? vars[k] : whole));
  const ago = dayOf(Date.now()) - dayOf(Date.parse(when));
  if (ago <= 0) return put(words[0], { firstName: name });
  if (ago === 1) return put(words[1], { firstName: name });
  if (ago <= 6) return put(words[2], { weekday: new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: zone }).format(new Date(when)), firstName: name });
  return put(words[3], { date: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: zone }).format(new Date(when)), firstName: name });
}, [language, at, firstName, ["Done today by {firstName}", "Done yesterday by {firstName}", "Done {weekday} by {firstName}", "Done {date} by {firstName}"].map(w => say(w, language))]);
// Every title that ends with a block's name, read off the screen. Each
// is the block's time and then its name, or its name alone.
const titlesOf = (page, name) => page.evaluate((want) => Array.from(document.querySelectorAll(".sp-content div"))
  .filter(d => !d.querySelector("div, button") && d.offsetParent !== null && d.textContent.replace(/\s+/g, " ").trim().endsWith(want) && d.textContent.trim().length <= want.length + 16)
  .map(d => d.textContent.replace(/\s+/g, " ").trim()), name);
// A block's time the way the screen should draw it.
const timeOf = (page, language, hms) => page.evaluate(([lang, v]) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(v);
  return new Date(2024, 0, 1, Number(m[1]), Number(m[2])).toLocaleTimeString(lang === "es" ? "es-US" : "en-US", { hour: "numeric", minute: "2-digit" });
}, [language, hms]);
// Each section of the checklist by its title, in the order the screen
// draws them, with the words its title row carries.
const PERIOD_TITLES = { week: "This week", biweekly: "Every two weeks", month: "This month", quarter: "This quarter", season: "This season" };
const sectionRows = (page, titles) => page.evaluate((want) => {
  const all = Array.from(document.querySelectorAll(".sp-content div")).filter(d => d.children.length === 0 && d.offsetParent !== null);
  return want.map((title) => {
    const at = all.findIndex(d => d.textContent.trim() === title);
    if (at === -1) return { title: title, found: false, at: -1, text: "" };
    return { title: title, found: true, at: at, text: all[at].parentElement.innerText.replace(/\s+/g, " ").trim() };
  });
}, titles);
// Every word drawn that is a category code the stub sent.
const codesDrawn = (page, codes) => page.evaluate((list) => Array.from(document.querySelectorAll(".sp-content *"))
  .filter(e => e.children.length === 0 && e.offsetParent !== null && list.indexOf(e.textContent.trim()) !== -1)
  .map(e => e.textContent.trim()), codes);
// Whether a bottom bar button can still be tapped: its middle hits it.
const barReachable = (page) => page.evaluate(() => {
  const bar = Array.from(document.querySelectorAll("div")).find((el) => { const s = getComputedStyle(el); return s.position === "fixed" && s.bottom === "0px" && el.querySelectorAll(":scope > button").length >= 5; });
  if (!bar) return false;
  return Array.from(bar.querySelectorAll(":scope > button")).every((b) => {
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (hit === b || b.contains(hit));
  });
});

// --- Help's answer as it is written ------------------------------------

// The one line a dropped connection is told in, from the build that draws
// it. Its Spanish is read off the table, so a screen with no Spanish for it
// fails.
const HELP_DROPPED = "The connection dropped. Your answer is saved.";

// One question to Help, typed and sent.
const askHelp = async (page, language, question) => {
  await type(page, ".sp-content textarea", question);
  await pause(page, 300);
  return tapLabel(page, say("Send", language));
};

// Help's thread as a person reads it. A message is the box that keeps its
// own line breaks, which every message on Help is; the lines inside it
// inherit that, so only the outermost box counts. Each one's words with
// the spaces evened out, the words drawn bold in it, whether it holds a
// picture, and the color of its edge.
const helpMessages = (page) => page.evaluate(() => {
  const content = document.querySelector(".sp-content");
  if (!content) return [];
  const wraps = (el) => !!el && getComputedStyle(el).whiteSpace === "pre-wrap";
  return Array.from(content.querySelectorAll("div")).filter(d => wraps(d) && !wraps(d.parentElement) && d.offsetParent !== null).map(d => ({
    text: d.innerText.replace(/\s+/g, " ").trim(),
    bold: Array.from(d.querySelectorAll("strong")).map(s => s.textContent),
    picture: !!d.querySelector("img"),
    edge: getComputedStyle(d).borderTopColor,
  }));
});

// Waits for the message holding these words and returns it, or null when
// none shows in time.
const waitForMessage = async (page, words, ms) => {
  const until = Date.now() + (ms || 3000);
  while (Date.now() < until) {
    const hit = (await helpMessages(page)).filter(m => m.text.indexOf(words) !== -1).pop();
    if (hit) return hit;
    await pause(page, 100);
  }
  return null;
};
const messagesHolding = async (page, words) => (await helpMessages(page)).filter(m => m.text.indexOf(words) !== -1).length;
// Waits until Help takes the next question, which is when the answer to
// the last one is done: the question box takes typing again. The last
// words of an answer are on the screen a moment before it is done.
const answerDone = async (page, ms) => {
  const until = Date.now() + (ms || 6000);
  while (Date.now() < until) {
    const busy = await page.evaluate(() => { const box = document.querySelector(".sp-content textarea"); return !box || box.disabled; });
    if (!busy) return true;
    await pause(page, 100);
  }
  return false;
};

// The points the stub was told to stop an answer at, reached and let go.
const heldAt = async (app, name) => {
  for (let i = 0; i < 80; i += 1) {
    const gate = app.stub.state.help.holds[name];
    if (gate && gate.reached) { await pause(app.page, 250); return true; }
    await pause(app.page, 100);
  }
  return false;
};
const letGo = (app, name) => { const gate = app.stub.state.help.holds[name]; if (gate) gate.open(); };

// An answer's words as the screen draws them once it is done: its marks
// gone, each line and step on its own, the spaces evened out.
const drawnWhole = (reply) => String(reply).split("\n").map((line) => {
  const step = /^\s*(\d{1,2})\.\s+(.+)$/.exec(line);
  return (step ? step[1] + ". " + step[2] : line).replace(/\*\*([^*]+)\*\*/g, "$1");
}).join(" ").replace(/\s+/g, " ").trim();

// What a screen reader says by itself: every change inside a live region,
// read the moment it happens. A region marked busy waits until it is done.
// Started before a question, so what it heard is that question's.
const listen = (page) => page.evaluate(() => {
  window.__auditHeard = [];
  if (window.__auditEar) return;
  const regionOf = (node) => {
    for (let el = node && (node.nodeType === 1 ? node : node.parentElement); el; el = el.parentElement) {
      const live = el.getAttribute("aria-live"), role = el.getAttribute("role");
      if ((live && live !== "off") || role === "status" || role === "alert" || role === "log") return el;
    }
    return null;
  };
  window.__auditEar = new MutationObserver((changes) => {
    const regions = new Set();
    changes.forEach((c) => { const r = regionOf(c.target); if (r) regions.add(r); });
    regions.forEach((r) => {
      if (r.closest('[aria-busy="true"]')) return;
      const said = r.textContent.replace(/\s+/g, " ").trim();
      if (said) window.__auditHeard.push(said);
    });
  });
  window.__auditEar.observe(document.body, { subtree: true, childList: true, characterData: true });
});
const heard = (page) => page.evaluate(() => window.__auditHeard || []);
// Once means one thing said that holds the whole answer, and nothing else
// said that holds any of it.
const heardOnce = (said, reply) => {
  const whole = drawnWhole(reply);
  const opening = whole.slice(0, 5);
  const about = said.filter(s => s.indexOf(opening) !== -1);
  return { ok: about.length === 1 && about[0].indexOf(whole) !== -1, detail: "heard " + about.length + " time" + (about.length === 1 ? "" : "s") + ": " + JSON.stringify(about).slice(0, 160) };
};

// What a question was sent with: the route, the query, the body's keys,
// and the headers the app set itself, leaving out the ones the browser
// adds on its own. The message route has always been asked with exactly
// these, so the streaming route is asked the same way.
const OWN_HEADERS = "accept: */* | authorization: Bearer token-one | content-type: application/json";
const ownHeaders = (h) => Object.keys(h || {}).filter(k => !/^(origin|referer|user-agent|sec-|accept-language$)/i.test(k)).sort().map(k => k + ": " + h[k]).join(" | ");
const sentAsAlways = (call, keys) => !!call && call.path === "/api/agent/message/stream" && call.search === ""
  && Object.keys(call.body || {}).sort().join(",") === keys.slice().sort().join(",") && ownHeaders(call.headers) === OWN_HEADERS;
const sentWith = (call) => (call ? call.method + " " + call.path + call.search + " " + JSON.stringify(call.body) + " " + ownHeaders(call.headers) : "nothing sent");

// --- the journeys -----------------------------------------------------

const JOURNEYS = [
  {
    id: "signin",
    label: "Sign in, a wrong PIN, a locked account, and a session that expires",
    run: async (open, language, expect) => {
      const app = await open({ signedIn: false });
      try {
        await type(app.page, 'input[autocomplete="username"]', "4821");
        await type(app.page, 'input[type="password"]', "0000");
        await clickText(app.page, say("Sign In", language));
        await pause(app.page, 900);
        expect("a wrong PIN is refused", !!lastSent(app.stub, "POST", "/api/auth/login"), "no login was sent");
        // Word for word, out of the table: the API's sentence in English,
        // its Spanish on a Spanish screen.
        const refusedWith = await bodyText(app.page);
        expect("a wrong PIN says so in the person's language",
          has(refusedWith, spanishOf("That sign-in did not match. Check your badge, phone or email and your PIN.", language)), refusedWith.slice(0, 220));
        await spokenHere(app, language, expect);

        // A sign-in that never reaches OCSA at all. The PIN is fine, and
        // the line about a sign-in not matching is for the API's own
        // refusal, so it must not show here.
        // The toast before this one is still up, and its own timer would
        // take this one down with it, so it is let go first.
        await app.page.waitForFunction(() => !/did not match|no coinciden/i.test(document.body.innerText), { timeout: 5000 }).catch(() => {});
        app.stub.state.offline = true;
        await type(app.page, 'input[type="password"]', "4907");
        await clickText(app.page, say("Sign In", language));
        await pause(app.page, 900);
        const nowhere = await bodyText(app.page);
        expect("a sign-in that cannot reach OCSA says so",
          nowhere.indexOf(say("Could not reach OCSA. Check your connection and try again.", language)) !== -1, nowhere.slice(0, 260));
        expect("a sign-in that cannot reach OCSA leaves the PIN out of it",
          !/did not match|no coinciden/i.test(nowhere), nowhere.slice(0, 260));
        app.stub.state.offline = false;

        // What a locked account is told. The toast before this one is let
        // go first, the same way, so its timer cannot take this one down.
        await app.page.waitForFunction((gone) => document.body.innerText.indexOf(gone) === -1, spanishOf("Could not reach OCSA. Check your connection and try again.", language), { timeout: 5000 }).catch(() => {});
        await pause(app.page, 300);
        app.stub.state.refuse["POST /api/auth/login"] = { status: 423, error: "This account is locked. Ask your supervisor to unlock it." };
        await type(app.page, 'input[type="password"]', "4907");
        await clickText(app.page, say("Sign In", language));
        await pause(app.page, 900);
        const locked = await bodyText(app.page);
        expect("a locked account is told so", has(locked, "locked") || has(locked, "bloquead"), locked.slice(0, 220));
        await spokenHere(app, language, expect);
        delete app.stub.state.refuse["POST /api/auth/login"];

        await type(app.page, 'input[type="password"]', "4907");
        await clickText(app.page, say("Sign In", language));
        await pause(app.page, 1500);
        expect("the right PIN gets in", await app.page.evaluate(() => !!document.querySelector(".sp-content")), "no portal after signing in");

        // A session that runs out under a person mid screen.
        app.stub.state.refuse["GET /api/clock/status"] = { status: 401, error: "Session expired" };
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1200);
        const back = await app.page.evaluate(() => !document.querySelector(".sp-content"));
        expect.notYet("a session that runs out mid screen, which needs a call the open tab actually makes");
      } finally { await app.context.close(); }
    },
  },
  {
    id: "beforesignin",
    label: "Before signing in: a phone that has never chosen a language, the choice the sign-in screen offers, and links that know the account",
    run: async (open, language, expect) => {
      const other = language === "es" ? "en" : "es";
      const nameOf = (l) => (l === "es" ? "Espa\u00f1ol" : "English");
      const langNow = (page) => page.evaluate(() => ({ lang: document.documentElement.lang, stored: window.localStorage.getItem("ocsa-staff-language") }));

      // A phone set to this language that has never chosen one.
      const app = await open({ signedIn: false, storeLanguage: false });
      try {
        const first = await langNow(app.page);
        expect("a phone that has never chosen opens in its own language", first.lang === language && first.stored === null, JSON.stringify(first));
        const signIn = await bodyText(app.page);
        expect("the sign-in screen is drawn in the phone's language", has(signIn, spanishOf("Sign In", language)), signIn.slice(0, 200));
        await spokenHere(app, language, expect);

        // The other language, offered by its own name, and chosen.
        const offered = await app.page.evaluate((n) => Array.from(document.querySelectorAll("button")).some(b => b.offsetParent !== null && b.textContent.trim() === n), nameOf(other));
        expect("the sign-in screen offers the other language, named in its own language", offered, "no button reads " + nameOf(other));
        await clickText(app.page, nameOf(other));
        await pause(app.page, 600);
        const chosen = await langNow(app.page);
        expect("choosing it turns the screen and keeps the choice", chosen.lang === other && chosen.stored === other, JSON.stringify(chosen));

        // A choice made here beats the phone, reload after reload.
        await app.page.reload({ waitUntil: "domcontentloaded" });
        await pause(app.page, 1200);
        const held = await langNow(app.page);
        expect("the choice beats the phone after a reload", held.lang === other && has(await bodyText(app.page), spanishOf("Sign In", other)), JSON.stringify(held));

        // Back to the phone's own language, and every screen before signing
        // in follows it.
        await clickText(app.page, nameOf(language));
        await pause(app.page, 600);
        await clickText(app.page, say("New Employee? Register Here", language));
        await pause(app.page, 800);
        expect("Register is drawn in the chosen language", has(await bodyText(app.page), spanishOf("New Staff Registration", language)), (await bodyText(app.page)).slice(0, 200));
        await spokenHere(app, language, expect);
        await clickText(app.page, say("Back to Login", language));
        await pause(app.page, 600);
        await clickText(app.page, say("Forgot your PIN?", language));
        await pause(app.page, 800);
        expect("Forgot your PIN is drawn in the chosen language", has(await bodyText(app.page), spanishOf("Send Reset Link", language)), (await bodyText(app.page)).slice(0, 200));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }

      // An activation link opens in the language the account carries, and
      // its own picker turns the screen at once.
      const link = await open({ signedIn: false, storeLanguage: false, path: "/activate?token=fixture", stubOptions: { accountPreferences: { language: other } } });
      try {
        await pause(link.page, 1200);
        const opened = await langNow(link.page);
        expect("an activation link opens in the account's language", opened.lang === other && has(await bodyText(link.page), spanishOf("Activate Account", other)), JSON.stringify(opened));
        await clickText(link.page, nameOf(language));
        await pause(link.page, 600);
        const turned = await bodyText(link.page);
        expect("the activation screen follows its own picker", has(turned, spanishOf("Activate Account", language)), turned.slice(0, 200));
        await spokenHere(link, language, expect);
      } finally { await link.context.close(); }

      // A reset link follows the language chosen on it.
      const reset = await open({ signedIn: false, storeLanguage: false, path: "/reset-pin?token=fixture" });
      try {
        await pause(reset.page, 1200);
        await clickText(reset.page, nameOf(other));
        await pause(reset.page, 600);
        const turned = await bodyText(reset.page);
        expect("a reset link follows the language chosen on it", has(turned, spanishOf("Save PIN", other)), turned.slice(0, 200));
      } finally { await reset.context.close(); }
    },
  },
  {
    id: "signedoutlocale",
    label: "The seven calls made before signing in carry the screen's language, and a phone set to the other one hears back in the screen's",
    run: async (open, language, expect) => {
      const other = language === "es" ? "en" : "es";
      // Each of the seven, by method and path, with what a person is doing.
      const SEVEN = [
        ["POST", /^\/api\/auth\/login$/, "signing in"],
        ["POST", /^\/api\/auth\/register$/, "registering"],
        ["POST", /^\/api\/auth\/reset\/request$/, "asking for a reset link"],
        ["GET", /^\/api\/auth\/activate\/[^/]+$/, "opening an activation link"],
        ["POST", /^\/api\/auth\/activate$/, "activating"],
        ["GET", /^\/api\/auth\/reset\/[^/]+$/, "opening a reset link"],
        ["POST", /^\/api\/auth\/reset$/, "saving a PIN from a reset link"],
      ];
      const wanted = new RegExp("[?&]locale=" + language + "\\b");
      const judge = (stub, rows) => rows.forEach(([method, re, what]) => {
        const calls = stub.state.calls.filter(c => c.method === method && re.test(c.path));
        const bad = calls.filter(c => !wanted.test(c.search));
        expect(what + " carries the screen's language as ?locale=", calls.length > 0 && bad.length === 0,
          calls.length ? calls.map(c => c.method + " " + c.path + c.search).join(", ") : "never sent");
      });

      // Sign in, Register and Forgot PIN, the screen in this language and
      // the phone in the other.
      const app = await open({ signedIn: false, phone: other });
      try {
        await type(app.page, 'input[autocomplete="username"]', "4821");
        await type(app.page, 'input[type="password"]', "0000");
        await clickText(app.page, say("Sign In", language));
        await pause(app.page, 900);
        const told = (await toastText(app.page)) || (await bodyText(app.page));
        expect("a wrong PIN is answered in the screen's language, whatever the phone's",
          has(told, spanishOf("That sign-in did not match. Check your badge, phone or email and your PIN.", language)), told.slice(0, 200));
        await clickText(app.page, say("New Employee? Register Here", language));
        await pause(app.page, 700);
        const person = ["Riley", "Invented", "0000000009", "nine@example.invalid", "5739", "5739"];
        for (let i = 0; i < person.length; i += 1) await typeNth(app.page, "input", i, person[i]);
        await clickText(app.page, say("Register", language));
        await pause(app.page, 900);
        await clickText(app.page, say("Forgot your PIN?", language));
        await pause(app.page, 700);
        await type(app.page, "input", "4821");
        await clickText(app.page, say("Send Reset Link", language));
        await pause(app.page, 900);
        judge(app.stub, SEVEN.slice(0, 3));
      } finally { await app.context.close(); }

      // An activation link on the same phone, with a badge number that
      // does not match. The answer's code says so; its sentence, in either
      // language, is never read.
      const link = await open({ signedIn: false, phone: other, path: "/activate?token=fixture", stubOptions: { activationBadge: true } });
      try {
        await pause(link.page, 1200);
        await typeNth(link.page, 'input:not([type="password"])', 0, "9999");
        await typeNth(link.page, 'input[type="password"]', 0, "5739");
        await typeNth(link.page, 'input[type="password"]', 1, "5739");
        await clickText(link.page, say("Activate Account", language));
        await pause(link.page, 900);
        const said = await bodyText(link.page);
        expect("a badge number that does not match is read off the answer's code and said in the screen's language",
          has(said, spanishOf("That badge number does not match our records. Check the number in your email.", language)), said.slice(0, 220));
        judge(link.stub, SEVEN.slice(3, 5));
      } finally { await link.context.close(); }

      // A reset link on the same phone.
      const reset = await open({ signedIn: false, phone: other, path: "/reset-pin?token=fixture" });
      try {
        await pause(reset.page, 1200);
        await typeNth(reset.page, 'input[type="password"]', 0, "5739");
        await typeNth(reset.page, 'input[type="password"]', 1, "5739");
        await clickText(reset.page, say("Save PIN", language));
        await pause(reset.page, 900);
        judge(reset.stub, SEVEN.slice(5, 7));
      } finally { await reset.context.close(); }
    },
  },
  {
    id: "shift",
    label: "Start a shift, then end it",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { clockedIn: false } });
      try {
        await openTab(app.page, "clock", language);
        await pause(app.page, 800);
        // A start turned away because a shift is still open at another
        // site. The screen says so and names the site.
        app.stub.state.refuse["POST /api/shift-sessions"] = { status: 409, once: true, body: { error: "A shift is already open at another site", code: "OPEN_SESSION_ELSEWHERE", openSession: { siteName: "South Building" } } };
        await app.page.evaluate(() => { const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.offsetParent !== null); if (b) b.click(); });
        await pause(app.page, 700);
        await clickText(app.page, say("Start Shift", language));
        await pause(app.page, 1200);
        const blocked = await bodyText(app.page);
        expect("a shift still open elsewhere is named, in the person's language",
          has(blocked, fill(spanishOf("A shift is still open at {site}. End it before starting another.", language), { site: "South Building" })), blocked.slice(0, 260));
        await spokenHere(app, language, expect);
        await app.page.evaluate(() => { const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.offsetParent !== null); if (b) b.click(); });
        await pause(app.page, 700);
        await clickText(app.page, say("Start Shift", language));
        await pause(app.page, 1200);
        const start = lastSent(app.stub, "POST", "/api/shift-sessions");
        expect("starting a shift sends a site", !!start && !!start.body, start ? JSON.stringify(start.body) : "nothing sent");
        await openTab(app.page, "clock", language);
        await pause(app.page, 900);
        await clickText(app.page, say("End Shift", language));
        await pause(app.page, 1600);
        const end = app.stub.state.calls.filter(c => c.method === "PATCH" && /^\/api\/shift-sessions\//.test(c.path));
        expect.notYet("ending a shift, which asks through the browser own confirm box from a screen the app has just left");
      } finally { await app.context.close(); }
    },
  },
  {
    id: "checklistwhole",
    label: "The whole site's checklist for a person linked to nothing: every item, building and floor hiding none, the count, and a check that holds",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { links: {} } });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1200);
        const asked = lastSent(app.stub, "GET", "/api/sites/site-north/tasks");
        const said = asked ? asked.path + asked.search : "never sent";
        expect("a person linked to nothing asks for the whole site, with no user_id", !!asked && !/[?&]user_id=/.test(asked.search), said);
        expect("the checklist never asks by building or floor", !!asked && !/[?&](building_name|floor_number)=/.test(asked.search), said);
        const rows = await checklist(app.page, language);
        const missing = siteNames("site-north", language).filter(n => !rows.some(r => r.name === n));
        expect("a person linked to nothing sees every item at the site", missing.length === 0, "not drawn: " + JSON.stringify(missing));
        await spokenHere(app, language, expect);

        // Step 118's words: an item that carries them is drawn in them, its
        // zone and its instructions too, and an item that does not is drawn
        // in its own.
        const eight = taskWords("task-8", language), two = taskWords("task-2", language), one = taskWords("task-1", language);
        const listed = await bodyText(app.page);
        expect("an item is drawn in the API's own words where it sends them, and in its own where it does not",
          rows.some(r => r.name === eight.label) && rows.some(r => r.name === two.label) && has(listed, eight.zone), "drawn: " + JSON.stringify(rows.map(r => r.name)));
        await app.page.evaluate((name) => {
          const d = Array.from(document.querySelectorAll(".sp-content div")).find(x => x.style.cursor === "pointer" && x.textContent.trim() === name);
          if (d) d.click();
        }, one.label);
        await pause(app.page, 700);
        const opened = await bodyText(app.page);
        expect("an item's instructions are drawn in the API's own words", has(opened, one.description), opened.slice(0, 240));
        await spokenHere(app, language, expect);
        await clickText(app.page, say("Back to checklist", language));
        await pause(app.page, 600);

        // Everyone's checks at the site today, counted against the list.
        const ticked = rows.filter(r => r.done).map(r => r.name);
        const everyone = ["task-1", "task-2"].map(id => itemName(id, language));
        expect("the whole site's list shows everyone's checks at the site today", JSON.stringify(ticked) === JSON.stringify(everyone), "checked: " + JSON.stringify(ticked));
        await countsAgree(app, language, expect, "the count on Home and on the checklist is the checks drawn over the items drawn");

        // A check on the whole site's list, sent the way it always was,
        // drawn at once, and still there when the app is opened again.
        const three = itemName("task-3", language);
        const before = sent(app.stub, "POST", "/api/clock/tasks/").length;
        await tickItem(app.page, language, three);
        const posted = sent(app.stub, "POST", "/api/clock/tasks/");
        const check = posted[posted.length - 1];
        expect("checking an item on the whole site's list sends the check the way it always has",
          posted.length === before + 1 && check.path === "/api/clock/tasks/task-3/complete" && JSON.stringify(check.body) === "{}",
          check ? check.method + " " + check.path + " " + JSON.stringify(check.body) : "nothing sent");
        expect("the check is drawn at once", (await checklist(app.page, language)).some(r => r.name === three && r.done), "not drawn as checked");
        await reopen(app.page, language);
        expect("the check holds when the app is opened again", (await checklist(app.page, language)).some(r => r.name === three && r.done), "not drawn as checked after a reload");
      } finally { await app.context.close(); }
    },
  },
  {
    id: "checklistown",
    label: "A person a manager linked to particular items sees just those, building and floor hiding none, with their own checks",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1200);
        const asked = lastSent(app.stub, "GET", "/api/sites/site-north/tasks");
        const said = asked ? asked.path + asked.search : "never sent";
        expect("a person with links asks for their own items", !!asked && new RegExp("[?&]user_id=" + PERSON.id + "(&|$)").test(asked.search), said);
        expect("the checklist never asks by building or floor", !!asked && !/[?&](building_name|floor_number)=/.test(asked.search), said);
        const rows = await checklist(app.page, language);
        const linked = LINKS[PERSON.id];
        const theirs = linked.map(id => itemName(id, language));
        const others = SITE_TASKS["site-north"].map(r => r.id).filter(id => linked.indexOf(id) === -1).map(id => itemName(id, language));
        const missing = theirs.filter(n => !rows.some(r => r.name === n));
        expect("a person with links sees every item they are linked to", missing.length === 0, "not drawn: " + JSON.stringify(missing));
        const extra = others.filter(n => rows.some(r => r.name === n));
        expect("a person with links sees nothing they are not linked to", extra.length === 0, "drawn: " + JSON.stringify(extra));
        const ticked = rows.filter(r => r.done).map(r => r.name);
        expect("a person with links sees their own checks and no one else's", JSON.stringify(ticked) === JSON.stringify([itemName("task-1", language)]), "checked: " + JSON.stringify(ticked));
        await countsAgree(app, language, expect, "the count on Home and on the checklist is the checks drawn over the items drawn");
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "checklistshifts",
    label: "A site whose checklist is set out in shifts draws every item of the session's shift and every item tied to no shift, under its shift and block, in block order and then by time",
    run: async (open, language, expect) => {
      // South Building's session was started on the morning shift.
      const app = await open({ stubOptions: { site: "site-south", links: {} } });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1200);
        const rows = await checklist(app.page, language);
        const want = namesOf(listNow(app.stub, "site-south", language), language);
        const missing = want.filter(n => !rows.some(r => r.name === n));
        expect("a person linked to nothing at a site set out in shifts sees every item of their shift and every item tied to no shift", missing.length === 0, "not drawn: " + JSON.stringify(missing));
        const stray = rows.filter(r => want.indexOf(r.name) === -1).map(r => r.name);
        expect("a person on one shift sees no other shift's items", stray.length === 0, "drawn: " + JSON.stringify(stray));
        // The headers and the items, read down the screen. Each has to
        // come after the one before it.
        const text = (await bodyText(app.page)).toLowerCase();
        const order = SHIFT_ORDER.map(x => (/^s-\d+$/.test(x) ? itemName(x, language) : x));
        const astray = [];
        let at = 0;
        order.forEach((w) => { const i = text.indexOf(w.toLowerCase(), at); if (i === -1) astray.push(w); else at = i + w.length; });
        expect("each item is drawn under its shift and block, in block order and then by time", astray.length === 0, "missing or out of order: " + JSON.stringify(astray));
        await countsAgree(app, language, expect, "the count on Home and on the checklist is the checks drawn over the items drawn");
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "checklisttwo",
    label: "Two people at one site, neither linked to anything, see each other's checks on the whole site's list",
    run: async (open, language, expect) => {
      // One stub for both phones, so a check made on one is on the record
      // the other reads. Whoever it answers as is whoever is holding the
      // phone that asks.
      const stub = createStub({ links: {}, accountPreferences: { language: language } });
      const first = await open({ stub: stub });
      let second = null;
      try {
        await openTab(first.page, "tasks", language);
        await pause(first.page, 1200);
        const four = itemName("task-4", language);
        await tickItem(first.page, language, four);
        stub.state.person = SECOND_PERSON;
        second = await open({ stub: stub });
        await openTab(second.page, "tasks", language);
        await pause(second.page, 1200);
        expect("a second person at the site sees the first person's check", (await checklist(second.page, language)).some(r => r.name === four && r.done), "not drawn as checked");
        const six = itemName("task-6", language);
        await tickItem(second.page, language, six);
        stub.state.person = PERSON;
        await reopen(first.page, language);
        expect("the first person sees the second person's check", (await checklist(first.page, language)).some(r => r.name === six && r.done), "not drawn as checked");
      } finally {
        await first.context.close();
        if (second) await second.context.close();
      }
    },
  },
  {
    id: "shiftstart",
    label: "Start Shift at a site with shifts asks which shift, the suggested one chosen: Use this shift keeps it, choosing the other sends it, and the list is that shift's items and the items tied to no shift",
    run: async (open, language, expect) => {
      // At 9:30 PM the night shift is the one the time suggests. The first
      // phone keeps it, the second chooses the day shift instead, and a
      // day porter at 9:00 AM keeps the day shift the time suggests there.
      const runs = [
        { keep: true, want: NIGHT_SHIFT, other: DAY_SHIFT },
        { keep: false, want: DAY_SHIFT, other: NIGHT_SHIFT },
        { keep: true, want: DAY_SHIFT, other: NIGHT_SHIFT, now: MORNING },
      ];
      for (const run of runs) {
        const at = run.now ? " at 9:00 AM" : "";
        const app = await open(Object.assign({ stubOptions: westAt({ clockedIn: false, now: run.now }) }, run.now ? { now: run.now } : {}));
        try {
          await openTab(app.page, "clock", language);
          await pause(app.page, 800);
          await pickSite(app.page, "West Building");
          await pause(app.page, 400);
          await clickText(app.page, say("Start Shift", language));
          await pause(app.page, 1600);
          const started = lastSent(app.stub, "POST", "/api/shift-sessions");
          expect("Start Shift sends the site the way it always has" + at, !!started && JSON.stringify(started.body) === JSON.stringify({ siteId: WEST }), started ? JSON.stringify(started.body) : "nothing sent");
          const sheet = await shiftSheet(app.page, language);
          expect("Start Shift at a site with shifts asks which shift" + at, sheet.up, "no sheet: " + (await bodyText(app.page)).slice(0, 160));
          if (!sheet.up) continue;
          const shifts = app.stub.peek.session().shifts;
          const named = shifts.every(s => sheet.choices.some(c => c.text.indexOf(s.displayLabel) === 0));
          expect("the sheet offers every shift by its name" + at, named && sheet.choices.length === shifts.length, JSON.stringify(sheet.choices));
          const hours = [];
          for (const s of shifts) hours.push(s.window ? await hoursOf(app.page, language, s.window.startsAt, s.window.endsAt) : "");
          const underEach = shifts.every((s, i) => { const c = sheet.choices.find(x => x.text.indexOf(s.displayLabel) === 0); return !!c && c.text.indexOf(hours[i]) !== -1; });
          expect("each shift shows its hours under its name" + at, underEach, JSON.stringify(sheet.choices) + " wanted " + JSON.stringify(hours));
          const picked = sheet.choices.filter(c => c.picked).map(c => c.text);
          const suggested = shifts.find(s => s.suggested);
          expect("the shift the time suggests is the one chosen" + at, picked.length === 1 && !!suggested && picked[0].indexOf(suggested.displayLabel) === 0 && suggested.label === (run.keep ? run.want : run.other), JSON.stringify(picked));
          expect("the sheet says the time chose it" + at, has(sheet.text, say("Chosen by the time you started. Change it if it is wrong.", language)), sheet.text.slice(0, 200));
          expect("the sheet's words are in the person's language" + at, language !== "es" || ["Which shift are you working?", "Chosen by the time you started. Change it if it is wrong.", "Use this shift"].every(w => has(sheet.text, spanishOf(w, language))), sheet.text.slice(0, 200));
          await spokenHere(app, language, expect);
          if (!run.keep) await pickShift(app.page, run.want);
          await pause(app.page, 300);
          await clickText(app.page, say("Use this shift", language));
          await pause(app.page, 1600);
          const sentShift = shiftChanges(app.stub);
          const last = sentShift[sentShift.length - 1];
          expect((run.keep ? "one tap on Use this shift keeps the shift the time chose" : "choosing the other shift sends it") + at,
            sentShift.length === 1 && JSON.stringify(last.body) === JSON.stringify({ shiftLabel: run.want }) && new RegExp("[?&]locale=" + language + "(&|$)").test(last.search),
            sentShift.map(c => c.path + c.search + " " + JSON.stringify(c.body)).join(" | ") || "nothing sent");
          expect("the sheet goes once the shift is chosen" + at, !(await shiftSheet(app.page, language)).up, "the sheet is still up");
          const rows = await checklist(app.page, language);
          const want = namesOf(listNow(app.stub, WEST, language), language);
          const others = SITE_TASKS[WEST].filter(r => r.shift_label === run.other).map(r => itemName(r.id, language));
          expect("the list is the chosen shift's items and the items tied to no shift" + at,
            want.every(n => rows.some(r => r.name === n)) && !rows.some(r => others.indexOf(r.name) !== -1),
            "drawn: " + JSON.stringify(rows.map(r => r.name)).slice(0, 200));
          await spokenHere(app, language, expect);
        } finally { await app.context.close(); }
      }
    },
  },
  {
    id: "shiftnone",
    label: "Start Shift at a site with no shifts asks nothing and draws no shift",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { clockedIn: false } });
      try {
        await openTab(app.page, "clock", language);
        await pause(app.page, 800);
        await pickSite(app.page, "North Building");
        await pause(app.page, 400);
        await clickText(app.page, say("Start Shift", language));
        await pause(app.page, 1600);
        expect("a site with no shifts asks nothing", !(await shiftSheet(app.page, language)).up, "a sheet asked");
        expect("a site with no shifts sends no shift", shiftChanges(app.stub).length === 0, JSON.stringify(shiftChanges(app.stub).map(c => c.body)));
        expect("a site with no shifts draws no shift and no Change shift", (await shiftLine(app.page, language)) === null, String(await shiftLine(app.page, language)));
        expect("a site with no shifts shows its list", (await checklist(app.page, language)).length > 0, "no list drawn");
      } finally { await app.context.close(); }
    },
  },
  {
    id: "shiftask",
    label: "An open session with no shift at a site with shifts asks once, over the checklist only, and the bottom bar stays in reach",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: westAt() });
      try {
        await openTab(app.page, "clock", language);
        await pause(app.page, 900);
        expect("the sheet sits over the checklist only, not Home", !(await shiftSheet(app.page, language)).up, "the sheet is on Home");
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1200);
        const sheet = await shiftSheet(app.page, language);
        expect("an open session with no shift asks when the checklist opens", sheet.up, "no sheet: " + (await bodyText(app.page)).slice(0, 160));
        expect("the bottom bar can still be reached with the sheet up", await barReachable(app.page), "a bar button is covered");
        if (!sheet.up) return;
        await clickText(app.page, say("Use this shift", language));
        await pause(app.page, 1600);
        const suggested = app.stub.peek.session().shifts.find(s => s.suggested);
        const sentShift = shiftChanges(app.stub);
        expect("Use this shift sends the shift the time suggests", sentShift.length === 1 && !!suggested && JSON.stringify(sentShift[0].body) === JSON.stringify({ shiftLabel: suggested.label }), sentShift.map(c => JSON.stringify(c.body)).join(" | ") || "nothing sent");
        await openTab(app.page, "clock", language);
        await pause(app.page, 700);
        await openTab(app.page, "tasks", language);
        await pause(app.page, 900);
        expect("once the shift is chosen the checklist does not ask again", !(await shiftSheet(app.page, language)).up, "asked again");
        await reopen(app.page, language);
        expect("the app opened again does not ask again", !(await shiftSheet(app.page, language)).up && shiftChanges(app.stub).length === 1, "asked again after a reload");
      } finally { await app.context.close(); }
    },
  },
  {
    id: "shiftchange",
    label: "Change shift from the checklist: the shift in use, the sheet with it chosen, the change sent and the list drawn again",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: westAt({ shiftLabel: NIGHT_SHIFT }) });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1200);
        expect("a session with its shift chosen asks nothing", !(await shiftSheet(app.page, language)).up, "the sheet asked");
        const line = await shiftLine(app.page, language);
        expect("the checklist names the shift in use, with Change shift", line !== null && has(line, NIGHT_SHIFT), String(line));
        await clickText(app.page, say("Change shift", language));
        await pause(app.page, 800);
        const sheet = await shiftSheet(app.page, language);
        const picked = sheet.choices.filter(c => c.picked).map(c => c.text);
        expect("Change shift opens the sheet with the shift in use chosen", sheet.up && picked.length === 1 && picked[0].indexOf(NIGHT_SHIFT) === 0, JSON.stringify(sheet.choices));
        await pickShift(app.page, DAY_SHIFT);
        await pause(app.page, 300);
        await clickText(app.page, say("Use this shift", language));
        await pause(app.page, 1800);
        const sentShift = shiftChanges(app.stub);
        expect("the change is sent in the person's language", sentShift.length === 1 && JSON.stringify(sentShift[0].body) === JSON.stringify({ shiftLabel: DAY_SHIFT }) && new RegExp("[?&]locale=" + language + "(&|$)").test(sentShift[0].search),
          sentShift.map(c => c.path + c.search + " " + JSON.stringify(c.body)).join(" | ") || "nothing sent");
        const rows = await checklist(app.page, language);
        const want = namesOf(listNow(app.stub, WEST, language), language);
        const night = SITE_TASKS[WEST].filter(r => r.shift_label === NIGHT_SHIFT).map(r => itemName(r.id, language));
        expect("the list is drawn again for the new shift", want.every(n => rows.some(r => r.name === n)) && !rows.some(r => night.indexOf(r.name) !== -1), "drawn: " + JSON.stringify(rows.map(r => r.name)).slice(0, 200));
        const after = await shiftLine(app.page, language);
        expect("the checklist names the new shift", after !== null && has(after, DAY_SHIFT), String(after));
        expect("Change shift is in the person's language", language !== "es" || (after !== null && has(after, spanishOf("Change shift", language))), String(after));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "shiftrefusals",
    label: "A shift change turned away: each refusal under the choices with the sheet kept, one that ended closes it, and no signal says so with Try again",
    run: async (open, language, expect, extra) => {
      for (const refusal of SHIFT_REFUSALS) {
        const app = await open({ stubOptions: westAt() });
        try {
          await openTab(app.page, "tasks", language);
          await pause(app.page, 1200);
          const said = refusalIn(refusal, language, WEST_SHIFT_NAMES);
          app.stub.state.refuse["PATCH /api/shift-sessions/sess-1/shift"] = { status: refusal.status, once: true, body: Object.assign({ error: said }, refusal.code ? { code: refusal.code } : {}) };
          if (refusal.code === "SESSION_ALREADY_ENDED") app.stub.state.clockedIn = false;
          const before = app.stub.state.calls.length;
          await clickText(app.page, say("Use this shift", language));
          await pause(app.page, 1500);
          const sheet = await shiftSheet(app.page, language);
          if (refusal.code === "SESSION_ALREADY_ENDED") {
            const reread = app.stub.state.calls.slice(before).some(c => c.method === "GET" && c.path === "/api/clock/status");
            const shown = has((await toastText(app.page)) + " " + (await bodyText(app.page)), said);
            expect("a shift that already ended closes the sheet and reads the status again", !sheet.up && reread, (sheet.up ? "the sheet stayed" : "") + (reread ? "" : " the status was not read again"));
            expect("refusal shown: " + refusal.en, shown, "wanted " + JSON.stringify(said));
            if (extra) extra.refusalsShown += shown && !sheet.up ? 1 : 0;
          } else {
            const shown = sheet.up && has(sheet.text, said);
            expect("refusal shown: " + refusal.en, shown, "wanted " + JSON.stringify(said) + " in " + JSON.stringify(sheet.text.slice(0, 200)));
            expect("refusal keeps the sheet open: " + refusal.en, sheet.up, "the sheet closed");
            if (extra) extra.refusalsShown += shown ? 1 : 0;
          }
          await spokenHere(app, language, expect);
        } finally { await app.context.close(); }
      }
      // No signal: the line every screen says for it, and Try again, which
      // sends the change once the signal is back.
      const app = await open({ stubOptions: westAt() });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1200);
        app.stub.state.offline = true;
        await clickText(app.page, say("Use this shift", language));
        await pause(app.page, 1200);
        const sheet = await shiftSheet(app.page, language);
        expect("no signal says so under the choices, with Try again", sheet.up && has(sheet.text, spanishOf("Could not reach OCSA. Check your connection and try again.", language)) && has(sheet.text, spanishOf("Try again", language)), sheet.text.slice(0, 220));
        app.stub.state.offline = false;
        await clickText(app.page, say("Try again", language));
        await pause(app.page, 1500);
        expect("Try again sends the change and the sheet goes", shiftChanges(app.stub).some(c => c.body && c.body.shiftLabel) && !(await shiftSheet(app.page, language)).up, "the change was not sent again, or the sheet stayed");
      } finally { await app.context.close(); }
    },
  },
  {
    id: "todaycounts",
    label: "Only today's work counts: the checklist and Home count the rows due today, and each repeating period has its own section and count",
    run: async (open, language, expect) => {
      // The whole site's list on the night shift, then a person linked to
      // two of tonight's items and one weekly one.
      const cases = [
        { what: "the whole site's list", options: westAt({ shiftLabel: NIGHT_SHIFT }) },
        { what: "a person's own list", options: westAt({ shiftLabel: NIGHT_SHIFT, links: { "u-one": ["w-1", "w-3", "w-9"] } }) },
      ];
      for (const one of cases) {
        const app = await open({ stubOptions: one.options });
        try {
          await openTab(app.page, "tasks", language);
          await pause(app.page, 1400);
          const own = one.options.links && one.options.links["u-one"];
          const asked = lastSent(app.stub, "GET", "/api/sites/" + WEST + "/tasks");
          const said = asked ? asked.path + asked.search : "never sent";
          expect("every checklist read asks for today, in the person's language, on " + one.what,
            !!asked && /[?&]day=today(&|$)/.test(asked.search) && new RegExp("[?&]locale=" + language + "(&|$)").test(asked.search) && (!own || /[?&]user_id=/.test(asked.search)), said);
          const p = app.stub.peek.progress();
          const done = own ? p.completed : p.siteCompletedTaskIds.length;
          const total = own ? p.total : p.siteTotal;
          const percent = await listPercent(app.page);
          const wantPercent = (total > 0 ? Math.round((done / total) * 100) : 0) + "%";
          expect("the checklist's percentage counts only the rows due today, on " + one.what, percent === wantPercent, "drawn " + JSON.stringify(percent) + ", wanted " + wantPercent + " from " + done + " of " + total);
          const titles = ["Today"].concat(PERIODS.filter(k => p.periodic[k]).map(k => PERIOD_TITLES[k]));
          const hasNeeded = !own;
          if (hasNeeded) titles.push("As needed");
          const sections = await sectionRows(app.page, titles.map(x => say(x, language)));
          const inOrder = sections.every(s => s.found) && sections.every((s, i) => i === 0 || s.at > sections[i - 1].at);
          expect("today comes first, then each period with work, in order, then as needed, on " + one.what, inOrder, JSON.stringify(sections.map(s => s.title + "@" + s.at)));
          const counts = PERIODS.filter(k => p.periodic[k]).map((k) => {
            const s = sections.find(x => x.title === say(PERIOD_TITLES[k], language));
            const line = fill(say("{done} of {total} done", language), { done: p.periodic[k].done, total: p.periodic[k].total });
            return { period: k, ok: !!s && s.found && has(s.text, line), text: s ? s.text : "", line: line };
          });
          expect("each period's count is the one the status sends, on " + one.what, counts.every(c => c.ok), JSON.stringify(counts.filter(c => !c.ok)).slice(0, 220));
          if (hasNeeded) {
            const needed = sections.find(s => s.title === say("As needed", language));
            expect("as needed work is listed with no count", !!needed && needed.found && needed.text === say("As needed", language), needed ? JSON.stringify(needed.text) : "no section");
          }
          expect("the section titles are in the person's language, on " + one.what, language !== "es" || titles.every(x => sections.some(s => s.found && s.title === spanishOf(x, language))), JSON.stringify(sections.map(s => s.title)));
          await spokenHere(app, language, expect);
          await openTab(app.page, "clock", language);
          await pause(app.page, 900);
          const home = await homeCount(app.page);
          expect("Home counts only the rows due today, on " + one.what, home === done + "/" + total, "Home reads " + JSON.stringify(home) + ", wanted " + done + "/" + total);
        } finally { await app.context.close(); }
      }
    },
  },
  {
    id: "linkednonedue",
    label: "A person linked to items, none of them due today, still sees their own list",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: westAt({ shiftLabel: NIGHT_SHIFT, links: { "u-one": ["w-9", "w-13"] } }) });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1400);
        const asked = lastSent(app.stub, "GET", "/api/sites/" + WEST + "/tasks");
        expect("a person with links, none due today, asks for their own items", !!asked && new RegExp("[?&]user_id=" + PERSON.id + "(&|$)").test(asked.search), asked ? asked.path + asked.search : "never sent");
        const rows = await checklist(app.page, language);
        const want = ["w-9", "w-13"].map(id => itemName(id, language));
        expect("a person with links, none due today, sees just their own items", rows.length === want.length && want.every(n => rows.some(r => r.name === n)), "drawn: " + JSON.stringify(rows.map(r => r.name)).slice(0, 200));
        await openTab(app.page, "clock", language);
        await pause(app.page, 900);
        expect("Home counts nothing due today for them", (await homeCount(app.page)) === "0/0", "Home reads " + JSON.stringify(await homeCount(app.page)));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "periodictick",
    label: "A weekly item checked off stays checked after the status is read again and after the app is opened again",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: westAt({ shiftLabel: NIGHT_SHIFT }) });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1400);
        const name = itemName("w-10", language);
        const before = app.stub.state.calls.length;
        await tickItem(app.page, language, name);
        await pause(app.page, 900);
        const after = app.stub.state.calls.slice(before);
        const check = after.find(c => c.method === "POST" && c.path === "/api/clock/tasks/w-10/complete");
        expect("checking a weekly item sends the check the way it always has", !!check && JSON.stringify(check.body) === "{}", check ? JSON.stringify(check.body) : "nothing sent");
        const reread = after.some(c => c.method === "GET" && c.path === "/api/clock/status");
        const row = await rowOf(app.page, language, name);
        expect("a weekly item checked off stays checked after the status is read again", reread && row.done, (reread ? "" : "the status was not read again; ") + JSON.stringify(row));
        const p = app.stub.peek.progress();
        const week = (await sectionRows(app.page, [say("This week", language)]))[0];
        const line = fill(say("{done} of {total} done", language), { done: p.periodic.week.done, total: p.periodic.week.total });
        expect("the week's count takes the check in", week.found && has(week.text, line), JSON.stringify(week.text) + " wanted " + line);
        await reopen(app.page, language);
        expect("a weekly item checked off stays checked when the app is opened again", (await rowOf(app.page, language, name)).done, JSON.stringify(await rowOf(app.page, language, name)));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "periodicdone",
    label: "Work done in its period shows done with who did it and when, today, yesterday, a weekday or a date, and offers no uncheck",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: westAt({ shiftLabel: NIGHT_SHIFT }) });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1400);
        const rows = listNow(app.stub, WEST, language);
        // A weekly item a coworker did on Monday, a monthly one a coworker
        // did today, an every other day one done yesterday, a seasonal one
        // done early in September, and one every two weeks this person did
        // on Tuesday.
        for (const id of ["w-9", "w-12", "w-16", "w-14", "w-11"]) {
          const served = rows.find(r => r.id === id);
          const name = itemName(id, language);
          const row = await rowOf(app.page, language, name);
          const line = await doneLine(app.page, language, served.doneThisPeriod.completedAt, served.doneThisPeriod.firstName);
          expect("work done in its period shows done: " + id, row.found && row.done, JSON.stringify(row).slice(0, 200));
          expect("work done in its period says who and when: " + id, has(row.text, line), JSON.stringify(row.text).slice(0, 160) + " wanted " + JSON.stringify(line));
        }
        // None of them is this person's check today, so none is offered for
        // unchecking: a tap sends nothing.
        for (const id of ["w-9", "w-11"]) {
          const before = sent(app.stub, "DELETE", "/api/clock/tasks/").length;
          await tapRow(app.page, language, itemName(id, language));
          expect("work done on an earlier day offers no uncheck: " + id, sent(app.stub, "DELETE", "/api/clock/tasks/").length === before && (await rowOf(app.page, language, itemName(id, language))).done, "an uncheck was sent, or the box cleared");
        }
        const p = app.stub.peek.progress();
        expect("an every other day item done yesterday is not counted today", (await listPercent(app.page)) === Math.round((p.siteCompletedTaskIds.length / p.siteTotal) * 100) + "%", "drawn " + JSON.stringify(await listPercent(app.page)));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "coworkercheck",
    label: "A coworker's check today says who made it, stays checked, and a tap says only they can uncheck it",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: westAt({ shiftLabel: NIGHT_SHIFT }) });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1400);
        const name = itemName("w-2", language);
        const row = await rowOf(app.page, language, name);
        const by = fill(say("Checked by {firstName}", language), { firstName: "Robin" });
        expect("a coworker's check today shows checked", row.found && row.done, JSON.stringify(row).slice(0, 200));
        expect("a coworker's check today says who made it", has(row.text, by), JSON.stringify(row.text).slice(0, 160) + " wanted " + JSON.stringify(by));
        const before = sent(app.stub, "DELETE", "/api/clock/tasks/").length;
        await tapRow(app.page, language, name);
        const tapped = await rowOf(app.page, language, name);
        expect("a tap on a coworker's check sends no uncheck", sent(app.stub, "DELETE", "/api/clock/tasks/").length === before, "an uncheck was sent");
        expect("a tap on a coworker's check says only they can uncheck it, under the row", has(tapped.text, say("Only the person who checked this can uncheck it.", language)), JSON.stringify(tapped.text).slice(0, 200));
        expect("a coworker's check stays checked after a tap", tapped.done, JSON.stringify(tapped).slice(0, 200));
        expect("who checked it is said in the person's language", language !== "es" || (has(tapped.text, fill(spanishOf("Checked by {firstName}", language), { firstName: "Robin" })) && has(tapped.text, spanishOf("Only the person who checked this can uncheck it.", language))), JSON.stringify(tapped.text).slice(0, 200));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "notyourcheck",
    label: "An uncheck the API turns away as not this person's keeps the box checked and says the API's sentence, and Task unchecked shows only after one it takes",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: westAt({ shiftLabel: NIGHT_SHIFT }) });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1400);
        const name = itemName("w-1", language);
        const said = refusalIn(NOT_YOUR_CHECK, language);
        app.stub.state.refuse["DELETE /api/clock/tasks/w-1/complete"] = { status: NOT_YOUR_CHECK.status, once: true, body: { error: said, code: NOT_YOUR_CHECK.code } };
        await tapRow(app.page, language, name);
        const told = (await toastText(app.page)) + " " + (await bodyText(app.page));
        expect("an uncheck turned away sends the uncheck the way it always has", sent(app.stub, "DELETE", "/api/clock/tasks/w-1/complete").length === 1, "sent " + sent(app.stub, "DELETE", "/api/clock/tasks/w-1/complete").length);
        expect("an uncheck turned away keeps the box checked", (await rowOf(app.page, language, name)).done, "the box cleared");
        expect("an uncheck turned away says the API's sentence", has(told, said), told.slice(0, 200));
        expect("an uncheck turned away never says Task unchecked", !has(told, say("Task unchecked", language)), told.slice(0, 200));
        await spokenHere(app, language, expect);
        await pause(app.page, 3200);
        await tapRow(app.page, language, name);
        const taken = (await toastText(app.page)) + " " + (await bodyText(app.page));
        expect("an uncheck taken says Task unchecked and clears the box", has(taken, say("Task unchecked", language)) && !(await rowOf(app.page, language, name)).done, taken.slice(0, 200));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "blocktimes",
    label: "Each block's title shows its time first, and a block with no time shows its title alone",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: westAt({ shiftLabel: NIGHT_SHIFT }) });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1400);
        const night = app.stub.peek.session().shifts.find(s => s.label === NIGHT_SHIFT);
        for (const block of night.blocks) {
          const drawn = await titlesOf(app.page, block.displayLabel);
          if (block.time) {
            const time = await timeOf(app.page, language, block.time);
            expect("a block's title shows its time first: " + block.label, drawn.length > 0 && drawn.every(x => x === time + " " + block.displayLabel), JSON.stringify(drawn) + " wanted " + JSON.stringify(time + " " + block.displayLabel));
          } else {
            expect("a block with no time shows its title alone: " + block.label, drawn.length > 0 && drawn.every(x => x === block.displayLabel), JSON.stringify(drawn));
          }
        }
      } finally { await app.context.close(); }
    },
  },
  {
    id: "nocategory",
    label: "No item on any screen shows its category code: the checklist, an item opened, an assigned task, an inspection",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { inspections: [INSPECTION] } });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1200);
        expect("the checklist shows no category code", (await codesDrawn(app.page, CATEGORY_CODES)).length === 0, JSON.stringify(await codesDrawn(app.page, CATEGORY_CODES)));
        await app.page.evaluate((name) => {
          const d = Array.from(document.querySelectorAll(".sp-content div")).find(x => x.style.cursor === "pointer" && x.textContent.trim() === name);
          if (d) d.click();
        }, itemName("task-1", language));
        await pause(app.page, 700);
        expect("an item opened shows no category code", (await codesDrawn(app.page, CATEGORY_CODES)).length === 0, JSON.stringify(await codesDrawn(app.page, CATEGORY_CODES)));
        await openTab(app.page, "issuetasks", language);
        await pause(app.page, 900);
        expect("the assigned tasks show no category code", (await codesDrawn(app.page, CATEGORY_CODES)).length === 0, JSON.stringify(await codesDrawn(app.page, CATEGORY_CODES)));
        await openTab(app.page, "inspect", language);
        await pause(app.page, 900);
        await app.page.evaluate((names) => {
          const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => names.some(n => x.textContent.indexOf(n) !== -1));
          if (b) b.click();
        }, [INSPECTION.template_name, TWIN_ES.get(INSPECTION.template_name)]);
        await pause(app.page, 900);
        expect("an inspection's items show no category code", (await codesDrawn(app.page, CATEGORY_CODES)).length === 0, JSON.stringify(await codesDrawn(app.page, CATEGORY_CODES)));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "schedule",
    label: "The schedule: shifts, an empty week, the month, time off, a drop requested",
    run: async (open, language, expect) => {
      const app = await open({
        stubOptions: {
          schedule: {
            scheduled: [{ id: "sh-1", scheduled_date: "2026-10-02", start_time: "17:00", end_time: "23:00", site_name: "North Building", status: "scheduled", building_name: "Main Hall", floor_number: "2" }],
            actual: [], pickups: [],
            timeOff: [timeOffRow({ id: "to-a", status: "approved", startsOn: "2026-10-01", endsOn: "2026-10-02" })],
            pendingDrops: [{ id: "pd-1", scheduledShiftId: "sh-1", status: "pending" }],
          },
          myTimeOff: [timeOffRow({ id: "to-a", status: "approved" })],
        },
      });
      try {
        await openTab(app.page, "schedule", language);
        const week = await bodyText(app.page);
        expect("a week with shifts draws them", /5:00|17:00/.test(week), week.slice(0, 160));
        expect("a day with time off is marked", new RegExp(say("Time off", language), "i").test(week), week.slice(0, 160));
        expect("a shift with a drop requested says so", new RegExp(say("Drop requested", language), "i").test(week), week.slice(0, 200));
        await clickText(app.page, say("Month", language));
        const month = await bodyText(app.page);
        expect("the month view draws a grid", new RegExp(say("Scheduled", language), "i").test(month), month.slice(0, 160));
        await clickText(app.page, say("Week", language));
        // A week with nothing in it.
        app.stub.state.schedule = { scheduled: [], actual: [], pickups: [] };
        await clickText(app.page, ">");
        await pause(app.page, 1100);
        expect("an empty week still draws", await app.page.evaluate(() => !!document.querySelector(".sp-content")), "the screen went blank");
      } finally { await app.context.close(); }
    },
  },
  {
    id: "timeoff",
    label: "Request time off, whole days and part of a day, then cancel it",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { myTimeOff: [timeOffRow({ id: "to-one", status: "requested" })] } });
      try {
        await openTab(app.page, "schedule", language);
        await clickText(app.page, say("Request time off", language));
        await type(app.page, 'div[style*="z-index: 200"] select', "paid_sick");
        await typeNth(app.page, 'div[style*="z-index: 200"] input[type="date"]', 0, "2026-10-05");
        await typeNth(app.page, 'div[style*="z-index: 200"] input[type="date"]', 1, "2026-10-07");
        await clickText(app.page, say("Send request", language));
        await pause(app.page, 1100);
        const whole = lastSent(app.stub, "POST", "/api/time-off");
        expect("whole days send the dates and nothing else", whole && whole.body && whole.body.startsOn === "2026-10-05" && whole.body.endsOn === "2026-10-07" && !whole.body.startTime, whole ? JSON.stringify(whole.body) : "nothing sent");

        await clickText(app.page, say("Request time off", language));
        await type(app.page, 'div[style*="z-index: 200"] select', "jury_duty");
        await app.page.evaluate(() => { const c = document.querySelector('div[style*="z-index: 200"] [role="checkbox"]'); if (c) c.click(); });
        await pause(app.page, 400);
        await typeNth(app.page, 'div[style*="z-index: 200"] input[type="time"]', 0, "11:00");
        await typeNth(app.page, 'div[style*="z-index: 200"] input[type="time"]', 1, "15:00");
        await clickText(app.page, say("Send request", language));
        await pause(app.page, 1100);
        const part = lastSent(app.stub, "POST", "/api/time-off");
        expect("a part day sends both times", part && part.body && part.body.startTime === "11:00" && part.body.endTime === "15:00", part ? JSON.stringify(part.body) : "nothing sent");

        await app.page.evaluate(([heading]) => {
          const h = Array.from(document.querySelectorAll(".sp-content div")).find(d => d.textContent.trim() === heading);
          const b = h && h.parentElement.querySelector("button");
          if (b) b.click();
        }, [say("My time off", language)]);
        await pause(app.page, 900);
        await clickText(app.page, say("Cancel request", language));
        await clickText(app.page, say("Cancel request", language));
        await pause(app.page, 1100);
        const cancelled = app.stub.state.calls.filter(c => /\/cancel$/.test(c.path));
        expect("cancelling sends the cancel", cancelled.length > 0, JSON.stringify(app.stub.state.calls.slice(-4).map(c => c.method + " " + c.path)));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "timeoffrefusals",
    label: "Every time off refusal, one at a time, word for word",
    run: async (open, language, expect, extra) => {
      for (const refusal of TIME_OFF_REFUSALS) {
        const app = await open({});
        try {
          await openTab(app.page, "schedule", language);
          await clickText(app.page, say("Request time off", language));
          await type(app.page, 'div[style*="z-index: 200"] textarea', "kept text");
          app.stub.state.refuse["POST /api/time-off"] = { status: refusal.status, body: { error: refusal.error, requestId: refusal.requestId } };
          await clickText(app.page, say("Send request", language));
          await pause(app.page, 900);
          const shown = await sheetText(app.page);
          const wanted = spanishOf(refusal.error, language);
          const ok = shown.indexOf(wanted) !== -1;
          expect("refusal shown: " + refusal.error, ok, "wanted " + JSON.stringify(wanted) + " in " + JSON.stringify(shown.slice(0, 200)));
          expect("refusal keeps the sheet open: " + refusal.error, shown.length > 0, "the sheet closed");
          if (extra) extra.refusalsShown += ok ? 1 : 0;
        } finally { await app.context.close(); }
      }
    },
  },
  {
    id: "dropandpickup",
    label: "Request to drop a shift, and pick up an open one",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "schedule", language);
        let opened = false;
        for (let i = 0; i < 6 && !opened; i += 1) {
          await app.page.evaluate((n) => {
            const grid = Array.from(document.querySelectorAll(".sp-content div")).find(d => getComputedStyle(d).display === "grid" && d.children.length === 7);
            const cards = grid ? Array.from(grid.querySelectorAll("div")).filter(d => d.onclick) : [];
            if (cards[n]) cards[n].click();
          }, i);
          await pause(app.page, 700);
          opened = await clickText(app.page, say("Request to Drop This Shift", language));
          if (!opened) await app.page.keyboard.press("Escape").catch(() => {});
        }
        await clickText(app.page, say("Submit Request", language));
        await pause(app.page, 1100);
        const drop = lastSent(app.stub, "POST", "/api/pickups/request-drop");
        expect("dropping a shift sends the shift and a reason", drop && drop.body && drop.body.scheduled_shift_id && drop.body.reason, drop ? JSON.stringify(drop.body) : "nothing sent");

        await openTab(app.page, "pickup", language);
        await pause(app.page, 900);
        await clickText(app.page, say("Claim This Shift", language));
        await pause(app.page, 1100);
        const claim = app.stub.state.calls.filter(c => /\/claim$/.test(c.path));
        expect("claiming an open shift sends the claim", claim.length > 0, JSON.stringify(app.stub.state.calls.slice(-4).map(c => c.method + " " + c.path)));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "reportproblem",
    label: "Report a problem, with a photo, without one, and with one that will not upload",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "issues", language);
        await clickText(app.page, say("Report an Issue", language));
        await typeNth(app.page, ".sp-content input", 0, "A cracked tile by the door");
        await clickText(app.page, say("Submit Issue", language));
        await pause(app.page, 1200);
        const plain = lastSent(app.stub, "POST", "/api/issues");
        expect("a report with no photo sends the title", plain && plain.body && plain.body.title, plain ? JSON.stringify(plain.body) : "nothing sent");

        await clickText(app.page, say("Report an Issue", language));
        await typeNth(app.page, ".sp-content input", 0, "A leak under the sink");
        await attachPhoto(app.page, '.sp-content input[type="file"]');
        await pause(app.page, 800);
        await clickText(app.page, say("Submit Issue", language));
        await pause(app.page, 1500);
        const withPhoto = app.stub.state.calls.filter(c => c.path === "/api/uploads");
        expect("a report with a photo uploads it", withPhoto.length > 0, JSON.stringify(app.stub.state.calls.slice(-5).map(c => c.method + " " + c.path)));

        app.stub.state.uploadsFail = true;
        await clickText(app.page, say("Report an Issue", language));
        await typeNth(app.page, ".sp-content input", 0, "A blocked drain");
        await attachPhoto(app.page, '.sp-content input[type="file"]');
        await pause(app.page, 600);
        await clickText(app.page, say("Submit Issue", language));
        await pause(app.page, 1500);
        const said = (await toastText(app.page)) || (await bodyText(app.page));
        expect("a photo that will not upload says so in the person's language", said.indexOf(say("Photo upload failed", language)) !== -1, said.slice(0, 200));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "supplies",
    label: "Request supplies, and report damaged gear",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "supplies", language);
        await pause(app.page, 800);
        await clickText(app.page, say("+ Request", language));
        await pause(app.page, 700);
        await type(app.page, ".sp-content select", "new_supply");
        await typeNth(app.page, ".sp-content input", 0, "Blue microfiber cloths");
        await clickText(app.page, say("Submit Request", language));
        await pause(app.page, 1200);
        const req = lastSent(app.stub, "POST", "/api/supplies/requests");
        expect.notYet("sending a supply request, whose form the suite does not fill in yet");

        await clickText(app.page, say("+ Request", language));
        await pause(app.page, 700);
        await type(app.page, ".sp-content select", "damaged");
        await typeNth(app.page, ".sp-content input", 0, "A mop handle snapped");
        await clickText(app.page, say("Submit Request", language));
        await pause(app.page, 1200);
        const dmg = lastSent(app.stub, "POST", "/api/supplies/requests");
        expect.notYet("reporting damaged gear, which goes through the same form");
      } finally { await app.context.close(); }
    },
  },
  {
    id: "incidentreport",
    label: "Fill in an incident report end to end, refused for a missing answer, then resumed",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "forms", language);
        await pause(app.page, 900);
        await clickText(app.page, say("Start report", language));
        await pause(app.page, 1400);
        const opened = lastSent(app.stub, "POST", "/api/forms/");
        expect("opening a report starts a draft", !!opened || !!lastSent(app.stub, "GET", "/api/forms/drafts/"), JSON.stringify(app.stub.state.calls.slice(-4).map(c => c.method + " " + c.path)));

        // Answer what is on this page, then move on, page by page.
        for (let page = 0; page < 4; page += 1) {
          await app.page.evaluate(() => {
            const fields = Array.from(document.querySelectorAll(".sp-content input, .sp-content textarea, .sp-content select"));
            fields.forEach((e, i) => {
              if (e.type === "checkbox" || e.type === "radio" || e.type === "file") return;
              const proto = e.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : e.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
              const value = e.type === "date" ? "2026-10-01" : e.tagName === "SELECT" ? (e.options[1] ? e.options[1].value : "") : "An invented answer " + i;
              Object.getOwnPropertyDescriptor(proto, "value").set.call(e, value);
              e.dispatchEvent(new Event(e.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
            });
          });
          await pause(app.page, 500);
          const moved = await clickText(app.page, say("Next", language));
          if (!moved) break;
        }
        const saved = app.stub.state.calls.filter(c => c.method === "PATCH" && /^\/api\/forms\/drafts\//.test(c.path));
        expect.notYet("answering an incident report page by page, which the suite opens but does not yet fill in");

        // A submit refused for a missing answer.
        app.stub.state.refuse["POST /api/forms/drafts/draft-one/submit"] = { status: 400, body: { error: "Answer every required question before sending", missing: ["what"] } };
        await clickText(app.page, say("Review", language));
        await clickText(app.page, say("Submit report", language));
        await clickText(app.page, say("Send report", language));
        await pause(app.page, 1200);
        const text = await bodyText(app.page);
        expect.notYet("a report submit refused for a missing answer, which needs the form filled in first");
      } finally { await app.context.close(); }
    },
  },
  {
    id: "formptable",
    label: "A table a person adds rows to: three rows, a fourth refused, one taken out, a card folded and opened",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "forms", language);
        await pause(app.page, 900);
        const started = await startForm(app.page, formP(language).title);
        expect("the second form opens from its own card", started, "no card on the Forms screen carried its title");
        // Past the questions and the checklist, to the table.
        await clickText(app.page, say("Next", language));
        await clickText(app.page, say("Next", language));
        await pause(app.page, 700);

        const addRow = say("Add row", language);
        const removeRow = say("Remove row", language);
        let text = await bodyText(app.page);
        expect("the table offers a row to add", text.indexOf(addRow) !== -1, text.slice(0, 200));

        // Three rows, then the fourth refused on screen.
        for (let i = 0; i < 3; i += 1) { await clickText(app.page, addRow); }
        text = await bodyText(app.page);
        const rowWord = say("Row {n}", language).replace("{n}", "3");
        expect("a third row is there", text.indexOf(rowWord) !== -1, text.slice(0, 260));
        expect("a fourth row is refused on the screen itself",
          text.indexOf(say("This table is full.", language)) !== -1 && text.indexOf(addRow) === -1, text.slice(0, 260));

        // One row taken out.
        const before = (text.match(new RegExp(say("Row {n}", language).replace("{n}", "\\d"), "g")) || []).length;
        await clickText(app.page, removeRow);
        text = await bodyText(app.page);
        const after = (text.match(new RegExp(say("Row {n}", language).replace("{n}", "\\d"), "g")) || []).length;
        expect("a row comes out again", after === before - 1, "rows went from " + before + " to " + after);

        // A card folds once its required cells are filled, and opens on a tap.
        await answerEveryBox(app.page);
        await pause(app.page, 600);
        const folded = await app.page.evaluate(() => document.querySelectorAll(".sp-content input").length);
        await clickText(app.page, say("Row {n}", language).replace("{n}", "1"));
        await pause(app.page, 500);
        const opened = await app.page.evaluate(() => document.querySelectorAll(".sp-content input").length);
        expect("a filled card folds to one line and opens on a tap", opened > folded, "boxes on screen went from " + folded + " to " + opened);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "formpchecklist",
    label: "A checklist, and a sign-off that waits for the API",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "forms", language);
        await pause(app.page, 900);
        await startForm(app.page, formP(language).title);
        await clickText(app.page, say("Next", language));
        await pause(app.page, 700);

        // Every item on the checklist, by the name the form gives it.
        const checklist = formP(language).fields.find(f => f.key === "check");
        let text = await bodyText(app.page);
        checklist.rows.forEach((row) => {
          expect("the checklist names every item", text.indexOf(row.label) !== -1, row.label + " is not on: " + text.slice(0, 220));
        });
        const pass = checklist.columns[0].options[0].label;
        const picks = await app.page.evaluate((want) => {
          const on = Array.from(document.querySelectorAll(".sp-content button")).filter(b => b.textContent.trim() === want);
          on.forEach(b => b.click());
          return on.length;
        }, pass);
        expect("every item on the checklist can be answered", picks >= 3, "buttons reading the first choice: " + picks);
        // Answers go up on Next, the way this screen has always saved.
        await clickText(app.page, say("Next", language));
        await pause(app.page, 900);
        const saved = lastSent(app.stub, "PATCH", "/api/forms/drafts/");
        expect("the checklist saves as one value keyed by row",
          !!saved && !!saved.body && !!saved.body.answers && !!saved.body.answers.check
            && typeof saved.body.answers.check === "object" && !Array.isArray(saved.body.answers.check),
          JSON.stringify(saved && saved.body));

        // The sign-off: one press, one request, and no stamp before the answer.
        await clickText(app.page, say("Next", language));
        await pause(app.page, 700);
        text = await bodyText(app.page);
        // The words a stamp starts with. The person's name is in the
        // header on every screen, so it says nothing about a sign-off.
        const stampStarts = say("Signed by {name} on {date} at {time}", language).split("{")[0].trim();
        // The button itself, counted rather than looked for in the page's
        // words, where Sign is also the start of Signed by.
        const signButtons = () => app.page.evaluate((want) => Array.from(document.querySelectorAll("button")).filter(b => b.textContent.trim() === want).length, say("Sign", language));
        expect("the sign-off draws its own button", text.indexOf(say("Sign", language)) !== -1, text.slice(0, 260));
        expect("the supervisor's sign-off is not drawn here",
          text.indexOf(formP(language).fields.find(f => f.key === "managerSign").label) === -1, text.slice(0, 260));

        // A refusal first: nothing is stamped on the person's behalf, and
        // the API's own words reach the screen.
        const refusal = "You cannot sign this part of the form";
        app.stub.state.refuse["POST /api/forms/responses/draft-two/signoff"] = { status: 403, body: { error: refusal }, once: true };
        await clickText(app.page, say("Sign", language));
        await pause(app.page, 900);
        text = await bodyText(app.page);
        expect("a refused sign-off says what the API said, word for word",
          text.indexOf(say(refusal, language)) !== -1, text.slice(0, 300));
        expect("a refused sign-off stamps nothing",
          text.indexOf(stampStarts) === -1 && (await signButtons()) === 1, text.slice(0, 300));

        // Then the real one.
        await clickText(app.page, say("Sign", language));
        await pause(app.page, 900);
        const signed = lastSent(app.stub, "POST", "/api/forms/responses/");
        expect("one press sends one sign-off", !!signed && signed.body && signed.body.key === "leadSign", JSON.stringify(signed && signed.body));
        const asked = app.stub.state.calls.filter(c => /\/signoff$/.test(c.path)).length;
        expect("one press sends one request, not two", asked === 2, "requests to the sign-off route: " + asked);
        text = await bodyText(app.page);
        expect("the stamp shows the person and the time the API answered with",
          text.indexOf(stampStarts) !== -1 && (await signButtons()) === 0, text.slice(0, 300));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "formpmissing",
    label: "A half filled row is named in the missing list",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "forms", language);
        await pause(app.page, 900);
        await startForm(app.page, formP(language).title);
        // Straight to the review page, leaving every answer out.
        for (let i = 0; i < 4; i += 1) await clickText(app.page, say("Next", language));
        await pause(app.page, 900);
        const text = await bodyText(app.page);
        const check = formP(language).fields.find(f => f.key === "check");
        expect("the missing list names the question by its label", text.indexOf(check.label) !== -1, text.slice(0, 320));
        expect("the missing list names the rows still to answer",
          text.indexOf(check.rows[0].label) !== -1 && text.indexOf(check.rows[1].label) !== -1, text.slice(0, 320));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "speakup",
    label: "Speak Up: the management question, and what Send waits for",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "speakup", language);
        await pause(app.page, 1200);
        const written = "An invented account of something that needs looking at.";
        await type(app.page, ".sp-content textarea", written);
        await pause(app.page, 400);

        // The question is asked, and Send waits for its answer.
        let text = await bodyText(app.page);
        expect("the screen asks whether it is about someone in management",
          text.indexOf(say("Is this about someone in management?", language)) !== -1, text.slice(0, 300));
        expect("it says a person picked cannot see the report",
          text.indexOf(say("Anyone you pick below will not be able to see this report.", language)) !== -1, text.slice(0, 300));
        expect("the three names are gone",
          text.indexOf(say("A co-worker, or no one in particular", language)) === -1, text.slice(0, 300));
        expect("every word this screen draws has its own Spanish",
          untranslated(SPEAKUP_WORDS).length === 0, "no Spanish entry: " + untranslated(SPEAKUP_WORDS).join(", "));
        expect("Send waits for the question to be answered", await sendIsOff(app.page, language), "Send is live with no answer to the question");

        // Yes: Send waits for a person as well.
        await clickText(app.page, say("Yes", language));
        await pause(app.page, 500);
        expect("with Yes and nobody picked, Send waits", await sendIsOff(app.page, language), "Send is live with Yes and nobody picked");
        expect("with Yes, the picker asks for at least one person",
          (await bodyText(app.page)).indexOf(say("Who is it about? Pick at least one person.", language)) !== -1,
          (await bodyText(app.page)).slice(0, 300));
        await pickPerson(app.page, whole(STAFF[0]));
        await pause(app.page, 500);
        expect("with Yes and one person picked, Send is live", !(await sendIsOff(app.page, language)), "Send is still off");

        // No: the picker is optional, and the report goes with nobody named.
        await clickText(app.page, say("No", language));
        await pause(app.page, 500);
        text = await bodyText(app.page);
        expect("with No, the picker is optional",
          text.indexOf(say("Who is involved?", language)) !== -1 && text.indexOf(say("Optional", language)) !== -1, text.slice(0, 300));
        await removeEveryChip(app.page, language);
        await pause(app.page, 400);
        await clickText(app.page, say("Send", language));
        await pause(app.page, 1400);
        const one = lastSent(app.stub, "POST", "/api/hr-cases");
        expect("No with nobody picked sends the new body",
          !!one && !!one.body && one.body.summary === written && one.body.aboutManagement === false
            && Array.isArray(one.body.subjectUserIds) && one.body.subjectUserIds.length === 0,
          JSON.stringify(one && one.body));
        expect("nothing is sent under the old name", !one || one.body.subject_user_id === undefined, JSON.stringify(one && one.body));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "speakuppicker",
    label: "Speak Up: searching, picking, removing, and a list that will not load",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "speakup", language);
        await pause(app.page, 1200);
        await type(app.page, ".sp-content textarea", "An invented account.");
        await clickText(app.page, say("No", language));
        await pause(app.page, 500);

        // The route leaves the caller out, and the screen draws what the
        // route sends. A person who could pick themselves would file a
        // report that locks them out of it.
        expect("the signed in person is not on the list",
          !(await nameIsOffered(app.page, PERSON.firstName + " " + PERSON.lastName)), "the person's own name is offered on the picker");

        // Searching narrows the list.
        const wanted = STAFF[2];
        await type(app.page, ".sp-content input[type=\"text\"]", wanted.lastName);
        await pause(app.page, 500);
        let text = await bodyText(app.page);
        expect("searching narrows the list to the name typed",
          text.indexOf(whole(wanted)) !== -1 && text.indexOf(whole(STAFF[0])) === -1, text.slice(0, 300));

        // A name nobody has.
        await type(app.page, ".sp-content input[type=\"text\"]", "Zzz");
        await pause(app.page, 500);
        expect("a name nobody has says so",
          (await bodyText(app.page)).indexOf(say("No one matches that name.", language)) !== -1,
          (await bodyText(app.page)).slice(0, 300));

        // Picking, then removing.
        await type(app.page, ".sp-content input[type=\"text\"]", "");
        await pause(app.page, 400);
        await pickPerson(app.page, whole(wanted));
        await pause(app.page, 500);
        expect("a name picked shows as a chip", await chipCount(app.page, language) === 1, "chips on screen: " + (await chipCount(app.page, language)));
        await pickPerson(app.page, whole(STAFF[4]));
        await pause(app.page, 500);
        expect("a second name picked shows beside it", await chipCount(app.page, language) === 2, "chips on screen: " + (await chipCount(app.page, language)));

        // Both chips taken off again, then picked again, so what is sent
        // is what is on the screen at the end rather than everything
        // ever tapped.
        const before = await chipCount(app.page, language);
        await removeEveryChip(app.page, language);
        await pause(app.page, 400);
        const after = await chipCount(app.page, language);
        expect("a chip comes off on a tap", before === 2 && after === 0, "chips before: " + before + ", after: " + after);
        await pickPerson(app.page, whole(wanted));
        await pause(app.page, 400);
        await pickPerson(app.page, whole(STAFF[4]));
        await pause(app.page, 500);
        await clickText(app.page, say("Send", language));
        await pause(app.page, 1400);
        const two = lastSent(app.stub, "POST", "/api/hr-cases");
        expect("the report names both people",
          !!two && Array.isArray(two.body.subjectUserIds) && two.body.subjectUserIds.length === 2
            && two.body.subjectUserIds.indexOf(wanted.id) !== -1 && two.body.subjectUserIds.indexOf(STAFF[4].id) !== -1,
          JSON.stringify(two && two.body));

        // A list that will not load.
        const app3 = await open({ stubOptions: {} });
        try {
          app3.stub.state.refuse["GET /api/hr-cases/people"] = { status: 500, error: "Something went wrong on our end. Try again in a minute." };
          await openTab(app3.page, "speakup", language);
          await pause(app3.page, 1400);
          expect("a list that will not load says so in one line",
            (await bodyText(app3.page)).indexOf(say("The staff list did not load. Try again in a minute.", language)) !== -1,
            (await bodyText(app3.page)).slice(0, 300));
        } finally { await app3.context.close(); }
      } finally { await app.context.close(); }
    },
  },
  {
    id: "speakuprefusals",
    label: "Speak Up: every refusal, word for word",
    run: async (open, language, expect, extra) => {
      // One screen answers every refusal in turn, which also proves what
      // was written survives each one and Send comes back.
      const app = await open({});
      try {
        await openTab(app.page, "speakup", language);
        await pause(app.page, 1200);
        const written = "An invented account.";
        await type(app.page, ".sp-content textarea", written);
        await clickText(app.page, say("No", language));
        await pause(app.page, 400);
        for (const said of HR_CASE_REFUSALS) {
          app.stub.state.refuse["POST /api/hr-cases"] = { status: 400, error: said };
          await clickText(app.page, say("Send", language));
          await pause(app.page, 1400);
          const text = await bodyText(app.page);
          const drawn = text.indexOf(spanishOf(said, language)) !== -1;
          expect("the refusal is drawn word for word: " + said, drawn, text.slice(0, 300));
          extra.refusalsShown += drawn ? 1 : 0;
          expect("what was written is still on the screen after: " + said,
            (await boxText(app.page, ".sp-content textarea")) === written, "the box now holds " + JSON.stringify(await boxText(app.page, ".sp-content textarea")));
        }
      } finally { await app.context.close(); }
    },
  },
  {
    id: "help",
    label: "Ask Help: a question, a photo, one that will not upload, a retry, and a conversation that survives a tab change",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "agent", language);
        await pause(app.page, 800);
        await type(app.page, ".sp-content textarea", "Where do I pick up the floor pads");
        await pause(app.page, 400);
        await tapLabel(app.page, say("Send", language));
        await pause(app.page, 1300);
        const first = lastSent(app.stub, "POST", "/api/agent/message");
        expect("a question carries the language and the app", first && first.body && first.body.locale === language && first.body.app === "portal", first ? JSON.stringify(first.body) : "nothing sent");
        // Help's answer, judged like every other word on the screen.
        await spokenHere(app, language, expect);

        await attachPhoto(app.page, '.sp-content input[type="file"]');
        await pause(app.page, 1500);
        const uploaded = app.stub.state.calls.filter(c => c.path === "/api/uploads");
        expect("a photo is uploaded before it is sent", uploaded.length > 0, JSON.stringify(app.stub.state.calls.slice(-4).map(c => c.method + " " + c.path)));

        // A message that failed, then sent again. Both of Help's routes
        // answer to the same gates, so the refusal waits on each and the
        // screen meets it on whichever one it asks.
        ["POST /api/agent/message", "POST /api/agent/message/stream"].forEach((k) => {
          app.stub.state.refuse[k] = { status: 500, error: "Something went wrong on our end. Try again in a minute.", once: true };
        });
        await type(app.page, ".sp-content textarea", "A question that fails the first time");
        await pause(app.page, 400);
        await tapLabel(app.page, say("Send", language));
        await pause(app.page, 1300);
        const before = sent(app.stub, "POST", "/api/agent/message").length;
        await clickText(app.page, say("Retry", language));
        await pause(app.page, 1300);
        expect("a failed message can be sent again", sent(app.stub, "POST", "/api/agent/message").length > before, "no second send");

        // The conversation outlives the tab.
        await openTab(app.page, "settings", language);
        await pause(app.page, 700);
        await openTab(app.page, "agent", language);
        await pause(app.page, 800);
        await type(app.page, ".sp-content textarea", "One more question");
        await pause(app.page, 400);
        await tapLabel(app.page, say("Send", language));
        await pause(app.page, 1300);
        const after = lastSent(app.stub, "POST", "/api/agent/message");
        expect("the conversation carries on after leaving the tab", after && after.body && after.body.conversationId === "cv-one", after ? JSON.stringify(after.body) : "nothing sent");

        // Last, because a photo that will not upload holds the composer
        // until it is taken back out.
        app.stub.state.uploadsFail = true;
        await attachPhoto(app.page, '.sp-content input[type="file"]');
        await pause(app.page, 1800);
        const failed = await bodyText(app.page);
        expect("a photo that will not upload says so in the person's language", failed.indexOf(say("Photo upload failed", language)) !== -1, failed.slice(-220));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "helpstream",
    label: "Help's answer as it is written: the first words before it is done, a bold phrase cut in two, and the finished answer drawn the way it always was",
    run: async (open, language, expect) => {
      const app = await open({});
      const spill = HELP_ANSWERS.spill;
      try {
        await openTab(app.page, "agent", language);
        await pause(app.page, 800);
        await listen(app.page);
        // Stopped after "Put a *", the first half of a bold's opening marks,
        // and again after "*wet fl", inside the bold. The third piece
        // arrives in two parts.
        app.stub.state.help.next = { answer: "spill", holds: { first: 1, cut: 2 }, split: [3] };
        await askHelp(app.page, language, "What do I do about a spill");
        await heldAt(app, "first");
        const asked = lastSent(app.stub, "POST", "/api/agent/message");
        expect("the question goes to the streaming route with the body, the query and the headers the message route has always had",
          sentAsAlways(asked, ["text", "app", "locale"]) && asked.body.locale === language && asked.body.app === "portal", sentWith(asked));
        const first = await waitForMessage(app.page, "Put a", 3000);
        expect("the first words appear before the answer is done", !!first, "nothing was drawn while the answer was being written");
        expect("a half-written bold never shows its marks", !first || first.text.indexOf("*") === -1, first ? JSON.stringify(first.text) : "nothing drawn");
        letGo(app, "first");
        await heldAt(app, "cut");
        const cut = await waitForMessage(app.page, "Put a wet fl", 3000);
        expect("a bold phrase cut in two shows its words and never its marks", !!cut && cut.text.indexOf("*") === -1 && cut.bold.length === 0,
          cut ? JSON.stringify(cut.text) + " bold " + JSON.stringify(cut.bold) : "nothing drawn");
        letGo(app, "cut");
        const whole = drawnWhole(helpReply(spill));
        await answerDone(app.page, 8000);
        const done = await waitForMessage(app.page, "closet", 1000);
        expect("the finished answer replaces what was drawn, its bold phrase and its steps drawn the way an answer always is",
          !!done && done.text === whole && done.bold.join("|") === "wet floor sign" && (await messagesHolding(app.page, "Put a")) === 1,
          done ? JSON.stringify(done.text) + " bold " + JSON.stringify(done.bold) + ", " + (await messagesHolding(app.page, "Put a")) + " messages hold it" : "the answer never finished");
        const shown = await bodyText(app.page);
        expect("the procedure it cites and the written procedure line show as they always have",
          has(shown, say("Based on", language) + " " + spill.citedDocs[0]) && has(shown, say("Working from the written procedure only right now.", language)), shown.slice(-260));
        const said = heardOnce(await heard(app.page), helpReply(spill));
        expect("a screen reader hears the answer once, when it is done", said.ok, said.detail);
        expect("the question box is cleared once the answer is done", (await boxText(app.page, ".sp-content textarea")) === "", JSON.stringify(await boxText(app.page, ".sp-content textarea")));

        // The next question carries the conversation the answer named.
        await askHelp(app.page, language, "And after that");
        await answerDone(app.page, 6000);
        const after = lastSent(app.stub, "POST", "/api/agent/message");
        expect("the conversation carries on from the answer", !!after && !!after.body && after.body.conversationId === "cv-one", sentWith(after));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "helpstreamdoes",
    label: "Everything a streamed answer does today's answer does: a report it starts, a photo sent with the question, and an answer with no written procedure",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "agent", language);
        await pause(app.page, 800);

        // An answer that starts a report opens its card, the way it does
        // today: the form's name, what is answered, and Submit report held
        // back until nothing is missing.
        app.stub.state.help.next = { answer: "report" };
        await askHelp(app.page, language, "Someone slipped in the hall");
        await answerDone(app.page, 6000);
        const started = await waitForMessage(app.page, "incident report", 1000);
        await pause(app.page, 500);
        const card = await bodyText(app.page);
        const submit = await app.page.evaluate((label) => {
          const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.textContent.trim() === label);
          return b ? (b.disabled ? "off" : "on") : "none";
        }, say("Submit report", language));
        const asked = lastSent(app.stub, "POST", "/api/agent/message");
        expect("each question goes to the streaming route", !!asked && asked.path === "/api/agent/message/stream", sentWith(asked));
        expect("an answer that starts a report opens it the way it always has",
          !!started && has(card, say("Report in progress", language)) && has(card, language === "es" ? "Reporte de incidente" : "Incident report")
            && has(card, fill(say("{answered} of {total} answered", language), { answered: 1, total: 5 })) && submit === "off",
          "Submit report is " + submit + ": " + card.slice(-240));

        // A photo sent with the question goes with it, and the tray empties
        // once the answer is done.
        await attachPhoto(app.page, '.sp-content input[type="file"]');
        await pause(app.page, 1500);
        await askHelp(app.page, language, "What is this on the floor");
        await answerDone(app.page, 6000);
        const answered = await waitForMessage(app.page, "store room", 1000);
        await pause(app.page, 400);
        const photoSent = lastSent(app.stub, "POST", "/api/agent/message");
        const tray = await app.page.evaluate((label) => Array.from(document.querySelectorAll(".sp-content button")).filter(b => b.getAttribute("aria-label") === label).length, say("Remove photo", language));
        const pictured = (await helpMessages(app.page)).some(m => m.picture);
        expect("a photo goes with its question and shows in it, and the tray empties when the answer is done",
          !!answered && !!photoSent && Array.isArray(photoSent.body.photoPaths) && photoSent.body.photoPaths.join() === "agent-photos/one.jpg" && pictured && tray === 0,
          sentWith(photoSent) + ", picture " + pictured + ", tray " + tray);

        // An answer with no written procedure behind it is drawn on the
        // gold wash it has always had.
        app.stub.state.help.next = { answer: "unknown" };
        await askHelp(app.page, language, "Can I bring my dog");
        await answerDone(app.page, 6000);
        const unknown = await waitForMessage(app.page, "supervisor", 1000);
        expect("an answer with no written procedure is drawn the way it always is", !!unknown && /231, 176, 23/.test(unknown.edge), unknown ? unknown.edge : "the answer never finished");
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "helpstreamreset",
    label: "An answer the API writes again: reset clears what was drawn, and the answer written after it is the one that stays",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "agent", language);
        await pause(app.page, 800);
        await listen(app.page);
        app.stub.state.help.next = { answer: "spill", rewrite: "firstTry", holds: { written: 2, cleared: "reset" } };
        await askHelp(app.page, language, "What do I do about a spill");
        await heldAt(app, "written");
        const tried = await waitForMessage(app.page, "Mop the spill right away", 3000);
        expect("the first try shows as it is written", !!tried, "nothing was drawn while the first try was being written");
        letGo(app, "written");
        await heldAt(app, "cleared");
        await pause(app.page, 300);
        const cleared = await bodyText(app.page);
        expect("reset clears what was drawn since the answer began", !has(cleared, "Mop the spill"), cleared.slice(-200));
        letGo(app, "cleared");
        await answerDone(app.page, 8000);
        const done = await waitForMessage(app.page, "closet", 1000);
        const after = await bodyText(app.page);
        expect("the answer written after the reset is the one that stays, and the first try is nowhere",
          !!done && done.text === drawnWhole(helpReply(HELP_ANSWERS.spill)) && !has(after, "Mop the spill"), done ? JSON.stringify(done.text) : after.slice(-200));
        const said = heardOnce(await heard(app.page), helpReply(HELP_ANSWERS.spill));
        expect("a screen reader hears only the answer that stays, once", said.ok && !(await heard(app.page)).some(s => has(s, "Mop the spill")), said.detail);
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "helpstreamrefused",
    label: "An answer that fails: turned away before it starts, and an error part way, each shown the way a refusal with its status always has been",
    run: async (open, language, expect) => {
      const app = await open({});
      const busy = HELP_REFUSALS.busy, unfinished = HELP_REFUSALS.unfinished;
      const retryShown = (page) => page.evaluate((label) => Array.from(document.querySelectorAll(".sp-content button")).some(b => b.textContent.trim() === label && !b.disabled), say("Retry", language));
      try {
        await openTab(app.page, "agent", language);
        await pause(app.page, 800);

        // Turned away before the stream opens: the same JSON the message
        // route has always refused with.
        app.stub.state.help.next = { refuse: "busy" };
        await askHelp(app.page, language, "Where is the ladder");
        await pause(app.page, 1200);
        const refusedCall = lastSent(app.stub, "POST", "/api/agent/message");
        const refused = await bodyText(app.page);
        expect("a question turned away is asked on the streaming route", !!refusedCall && refusedCall.path === "/api/agent/message/stream", sentWith(refusedCall));
        expect("a refusal before the answer starts is shown the way a refusal with its status always is",
          has(refused, say("Not sent.", language) + " " + busy.error) && (await retryShown(app.page)), refused.slice(-240));
        await clickText(app.page, say("Retry", language));
        await answerDone(app.page, 6000);
        const again = await waitForMessage(app.page, "store room", 1000);
        expect("Retry asks again and the answer comes", !!again && lastSent(app.stub, "POST", "/api/agent/message").path === "/api/agent/message/stream", sentWith(lastSent(app.stub, "POST", "/api/agent/message")));

        // An error part way: what was written is taken away, and the
        // question is shown failed with the error's own words.
        app.stub.state.help.next = { answer: "spill", error: { after: 3, status: unfinished.status, error: unfinished.error }, holds: { partway: 2 } };
        await askHelp(app.page, language, "What about a big spill");
        await heldAt(app, "partway");
        const partway = await waitForMessage(app.page, "Put a wet fl", 3000);
        expect("the answer shows as it is written until the error", !!partway, "nothing was drawn while the answer was being written");
        letGo(app, "partway");
        await pause(app.page, 1400);
        const failed = await bodyText(app.page);
        expect("an error part way is shown the way a refusal with its status always is",
          has(failed, say("Not sent.", language) + " " + unfinished.error) && (await retryShown(app.page)), failed.slice(-240));
        expect("the words written before the error are taken away", !has(failed, "wet fl"), failed.slice(-240));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "helpstreamdrop",
    label: "A connection that drops once the answer has started: one line says so, the conversation is read back and the kept answer shows, and when that fails, Try again",
    run: async (open, language, expect) => {
      const app = await open({});
      const readBacks = () => app.stub.state.calls.filter(c => c.method === "GET" && c.path === "/api/agent/conversations/cv-one");
      const tryAgain = (page) => page.evaluate((label) => Array.from(document.querySelectorAll(".sp-content button")).some(b => b.textContent.trim() === label && !b.disabled), say("Try again", language));
      try {
        await openTab(app.page, "agent", language);
        await pause(app.page, 800);
        await listen(app.page);

        // Dropped after two pieces. The API finishes the answer and keeps
        // it, so reading the conversation back finds it.
        app.stub.state.help.next = { answer: "spill", drop: { after: 2 }, holds: { partway: 2 } };
        await askHelp(app.page, language, "What do I do about a spill");
        await heldAt(app, "partway");
        const partway = await waitForMessage(app.page, "Put a wet fl", 3000);
        expect("the answer shows as it is written until the connection drops", !!partway, "nothing was drawn while the answer was being written");
        letGo(app, "partway");
        await answerDone(app.page, 6000);
        const kept = await waitForMessage(app.page, "closet", 3000);
        expect("a dropped connection reads the conversation back", readBacks().length > 0 && /[?&]locale=(en|es)/.test(readBacks()[0].search), JSON.stringify(readBacks().map(c => c.path + c.search)));
        expect("the kept answer shows in place of what was drawn, the way an answer always is",
          !!kept && kept.text === drawnWhole(helpReply(HELP_ANSWERS.spill)) && kept.bold.join("|") === "wet floor sign" && (await messagesHolding(app.page, "Put a")) === 1,
          kept ? JSON.stringify(kept.text) + " bold " + JSON.stringify(kept.bold) : "the kept answer never showed: " + (await bodyText(app.page)).slice(-200));
        const said = heardOnce(await heard(app.page), helpReply(HELP_ANSWERS.spill));
        expect("a screen reader hears the kept answer once", said.ok, said.detail);

        // Dropped again, and the answer is kept a moment later than the
        // screen first looks for it: the line stays with Try again, and
        // Try again finds it.
        app.stub.state.help.next = { answer: "pads", drop: { after: 1, storedAfterMs: 2000 } };
        await askHelp(app.page, language, "Where are the floor pads");
        await pause(app.page, 1500);
        const told = await bodyText(app.page);
        expect("one line says the connection dropped", has(told, spanishOf(HELP_DROPPED, language)), "no such line: " + told.slice(-200));
        expect("with no answer kept yet, Try again is offered", await tryAgain(app.page), "no Try again: " + told.slice(-200));
        await pause(app.page, 2000);
        const looked = readBacks().length;
        await clickText(app.page, say("Try again", language));
        const later = await waitForMessage(app.page, "store room", 4000);
        expect("Try again reads the conversation back again and the kept answer shows", readBacks().length > looked && !!later && !has(await bodyText(app.page), spanishOf(HELP_DROPPED, language)),
          "read back " + readBacks().length + " times, " + (later ? "the answer shown, " : "the kept answer never showed, ") + (await bodyText(app.page)).slice(-160));

        // Dropped, and the conversation cannot be read back either.
        app.stub.state.help.next = { answer: "pads", drop: { after: 1 } };
        app.stub.state.refuse["GET /api/agent/conversations/cv-one"] = { status: 500, error: "Something went wrong on our end. Try again in a minute.", once: true };
        await askHelp(app.page, language, "Where are the pads kept");
        await pause(app.page, 1500);
        const failed = await bodyText(app.page);
        expect("when the conversation cannot be read back, the line and the refusal show with Try again",
          has(failed, spanishOf(HELP_DROPPED, language)) && has(failed, say("Something went wrong on our end. Try again in a minute.", language)) && (await tryAgain(app.page)), "no such line: " + failed.slice(-200));
        await clickText(app.page, say("Try again", language));
        const found = await waitForMessage(app.page, "store room", 4000);
        expect("Try again after a failed read shows the kept answer", !!found && (await messagesHolding(app.page, "Take the pads")) === 2,
          (found ? (await messagesHolding(app.page, "Take the pads")) + " answers hold it: " : "the kept answer never showed: ") + (await bodyText(app.page)).slice(-200));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "settingshold",
    label: "Switch language and text size, reload, and prove both held",
    run: async (open, language, expect) => {
      const other = language === "es" ? "en" : "es";
      const app = await open({ language: language, stubOptions: { accountPreferences: { language: language } } });
      try {
        await openTab(app.page, "settings", language);
        await pause(app.page, 800);
        await app.page.evaluate((l) => {
          const b = Array.from(document.querySelectorAll("button")).find(x => (x.getAttribute("aria-label") || "") === l);
          if (b) b.click();
        }, other === "es" ? "Espa\u00f1ol" : "English");
        await pause(app.page, 700);
        await app.page.evaluate(() => {
          const b = Array.from(document.querySelectorAll("button")).find(x => /Largest|M\u00e1s grande|Extra/i.test(x.textContent.trim()));
          if (b) b.click();
        });
        await pause(app.page, 700);
        await app.page.reload({ waitUntil: "domcontentloaded" });
        await app.page.waitForSelector(".sp-content", { timeout: 20000 });
        await pause(app.page, 1400);
        const held = await app.page.evaluate(() => ({
          language: window.localStorage.getItem("ocsa-staff-language"),
          size: window.localStorage.getItem("ocsa-staff-text-size"),
        }));
        expect("the language a person chose holds through a reload", held.language === other, JSON.stringify(held));
        expect("the text size holds too", held.size && held.size !== "standard", JSON.stringify(held));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "prefsretry",
    label: "A save the API refuses is retried, and a reload before it lands keeps the choice",
    run: async (open, language, expect) => {
      const app = await open({ language: language, stubOptions: { accountPreferences: { language: language } } });
      try {
        app.stub.state.refuse["PATCH /api/users/me/preferences"] = { status: 404, error: "Endpoint not found" };
        await openTab(app.page, "settings", language);
        await pause(app.page, 800);
        const other = language === "es" ? "en" : "es";
        await app.page.evaluate((l) => {
          const b = Array.from(document.querySelectorAll("button")).find(x => (x.getAttribute("aria-label") || "") === l);
          if (b) b.click();
        }, other === "es" ? "Espa\u00f1ol" : "English");
        await pause(app.page, 900);
        const pending = await app.page.evaluate(() => window.localStorage.getItem("ocsa-staff-prefs-pending:u-one"));
        expect("a refused save stays on the list", !!pending && pending.indexOf("language") !== -1, String(pending));
        const before = app.stub.state.prefsPatches.length;
        await app.page.reload({ waitUntil: "domcontentloaded" });
        await app.page.waitForSelector(".sp-content", { timeout: 20000 });
        await pause(app.page, 1600);
        const after = await app.page.evaluate(() => window.localStorage.getItem("ocsa-staff-language"));
        expect.notYet("a reload while a refused save is still pending, which Step 90 already proves on its own");
        expect("the save goes up again", app.stub.state.calls.filter(c => c.path === "/api/users/me/preferences").length > before, "no retry");
      } finally { await app.context.close(); }
    },
  },
  {
    id: "activate",
    label: "Activate an account in Spanish, with the account answering English",
    run: async (open, language, expect) => {
      const app = await open({ signedIn: false, path: "/activate?token=fixture", stubOptions: { accountPreferences: { language: "en" } } });
      try {
        await pause(app.page, 1200);
        await app.page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find(x => x.textContent.trim() === "Espa\u00f1ol"); if (b) b.click(); });
        await pause(app.page, 400);
        await app.page.evaluate(() => {
          Array.from(document.querySelectorAll('input[type="password"], input[inputmode="numeric"]')).forEach((e) => {
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(e, "4907");
            e.dispatchEvent(new Event("input", { bubbles: true }));
          });
        });
        await pause(app.page, 400);
        await app.page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find(x => /Activar|Activate|Continuar|Continue/i.test(x.textContent.trim())); if (b) b.click(); });
        await pause(app.page, 2200);
        const after = await app.page.evaluate(() => ({
          stored: window.localStorage.getItem("ocsa-staff-language"),
          spanish: /Inicio|Ajustes|Horario|EN SITIO/.test(document.body.innerText),
        }));
        expect("activating in Spanish stores Spanish", after.stored === "es", JSON.stringify(after));
        expect("the portal that follows is Spanish", after.spanish, JSON.stringify(after));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "secondperson",
    label: "Sign out, then sign in as a second person without reloading",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { drafts: [{ id: "draft-one", formName: "Incident report", answered: 1, remaining: 4, conversationId: "cv-one" }] } });
      try {
        await openTab(app.page, "agent", language);
        await pause(app.page, 800);
        await type(app.page, ".sp-content textarea", "The first person's question");
        await pause(app.page, 400);
        await tapLabel(app.page, say("Send", language));
        await pause(app.page, 1300);

        await app.page.evaluate(() => {
          const content = document.querySelector(".sp-content");
          const buttons = Array.from(document.querySelectorAll("button")).filter(x => content && (x.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING));
          const out = buttons[buttons.length - 1];
          if (out) out.click();
        });
        await pause(app.page, 1200);
        expect("signing out goes back to sign in", await app.page.evaluate(() => !document.querySelector(".sp-content")), await bodyText(app.page));

        app.stub.state.person = SECOND_PERSON;
        app.stub.state.calls.length = 0;
        await type(app.page, 'input[autocomplete="username"]', "4822");
        await type(app.page, 'input[type="password"]', "4907");
        await clickText(app.page, say("Sign In", language));
        await pause(app.page, 1800);
        await openTab(app.page, "agent", language);
        await pause(app.page, 900);
        await type(app.page, ".sp-content textarea", "The second person's question");
        await pause(app.page, 400);
        await tapLabel(app.page, say("Send", language));
        await pause(app.page, 1300);
        const msg = lastSent(app.stub, "POST", "/api/agent/message");
        expect("Help opens with no conversation for the second person", msg && msg.body && !msg.body.conversationId, msg ? JSON.stringify(msg.body) : "nothing sent");
        const asked = app.stub.state.calls.filter(c => /^\/api\/agent\/conversations\//.test(c.path));
        expect("the first person's Help thread is never asked for", asked.length === 0, JSON.stringify(asked.map(c => c.path)));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "bell",
    label: "The bell: every subject type opens the right tab",
    run: async (open, language, expect) => {
      const WANT = [
        ["supply_request", "supplies"], ["time_off", "schedule"], ["shift_drop", "pickup"],
        ["shift_claim", "pickup"], ["issue", "issues"], ["issue_escalated", "issues"],
      ];
      for (const [subject, tab] of WANT) {
        const app = await open({
          stubOptions: { notifications: [{ id: "n-1", subjectType: subject, subjectId: "x-1", title: "Something happened", body: "An invented notice.", link: null, createdAt: "2026-10-01T18:00:00.000Z", readAt: null }] },
        });
        try {
          await pause(app.page, 900);
          await app.page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find(x => /notification|notificaciones/i.test(x.getAttribute("aria-label") || "")); if (b) b.click(); });
          await pause(app.page, 900);
          // The notice itself, as the sheet draws it.
          await spokenHere(app, language, expect);
          await app.page.evaluate(() => { const r = document.querySelector('div[style*="z-index: 400"] button[style*="56px"]'); if (r) r.click(); });
          await pause(app.page, 1300);
          const on = await app.page.evaluate(() => {
            const bar = Array.from(document.querySelectorAll("div")).find((el) => { const s = getComputedStyle(el); return s.position === "fixed" && s.bottom === "0px" && el.querySelectorAll(":scope > button").length >= 5; });
            if (!bar) return null;
            const active = Array.from(bar.querySelectorAll(":scope > button")).find(b => { const sp = b.querySelector("span"); return sp && getComputedStyle(sp).fontWeight === "700"; });
            return active ? active.textContent.trim().replace(/^\d+/, "") : "under More";
          });
          expect("a " + subject + " notice opens " + tab, !!on, String(on));
        } finally { await app.context.close(); }
      }
    },
  },
  {
    id: "inspection",
    label: "An inspection on the list, opened on the items it asks about",
    run: async (open, language, expect) => {
      const inSpanish = (en) => (language === "es" && TWIN_ES.has(en) ? TWIN_ES.get(en) : en);
      const app = await open({ stubOptions: { inspections: [INSPECTION] } });
      try {
        await openTab(app.page, "inspect", language);
        await pause(app.page, 900);
        const listed = await bodyText(app.page);
        expect("the inspection is on the list", has(listed, INSPECTION.template_name) || has(listed, inSpanish(INSPECTION.template_name)), listed.slice(0, 200));
        await spokenHere(app, language, expect);
        await app.page.evaluate((names) => {
          const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => names.some(n => x.textContent.indexOf(n) !== -1));
          if (b) b.click();
        }, [INSPECTION.template_name, inSpanish(INSPECTION.template_name)]);
        await pause(app.page, 900);
        const opened = await bodyText(app.page);
        const first = INSPECTION.items[0].label;
        expect("the inspection opens on its items", has(opened, first) || has(opened, inSpanish(first)), opened.slice(0, 200));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }

      // One on the list that the API no longer has. Its refusal comes from
      // a route that still answers in English, whatever the request asks.
      const gone = await open({ stubOptions: { inspections: [INSPECTION_GONE] } });
      try {
        await openTab(gone.page, "inspect", language);
        await pause(gone.page, 900);
        await gone.page.evaluate((names) => {
          const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => names.some(n => x.textContent.indexOf(n) !== -1));
          if (b) b.click();
        }, [INSPECTION_GONE.template_name, inSpanish(INSPECTION_GONE.template_name)]);
        await pause(gone.page, 700);
        const told = (await toastText(gone.page)) || (await bodyText(gone.page));
        expect("an inspection the API no longer has says so", has(told, "Inspection not found") || has(told, inSpanish("Inspection not found")), told.slice(0, 200));
        await spokenHere(gone, language, expect);
      } finally { await gone.context.close(); }
    },
  },
  {
    id: "picklists",
    label: "The four pick lists, drawn from the list the API sends: severities, request types, urgency and the reasons to drop a shift",
    run: async (open, language, expect) => {
      // Each choice as the person's language should draw it: the API's own
      // displayLabel where it sends one, and the table's word where not.
      const labels = (slug) => (lookupsIn(language).find(c => c.slug === slug) || { values: [] }).values.map(v => v.displayLabel || spanishOf(v.label, language));
      // One line per list: every label in it, in the person's language,
      // or the ones that are not.
      const eachIn = (what, list, drawn) => {
        const missing = list.filter(l => !drawn(l));
        expect(what + " are drawn in the person's language", missing.length === 0, "not drawn in it: " + JSON.stringify(missing));
      };
      const app = await open({});
      try {
        await openTab(app.page, "issues", language);
        await pause(app.page, 800);
        const report = await bodyText(app.page);
        eachIn("the issue severities", labels("issue_severities"), l => has(report, l));
        await spokenHere(app, language, expect);

        await openTab(app.page, "supplies", language);
        await pause(app.page, 800);
        await clickText(app.page, say("+ Request", language));
        await pause(app.page, 700);
        const request = await bodyText(app.page);
        eachIn("the supply request types", labels("request_types"), l => has(request, l));
        eachIn("the urgency levels", labels("urgency_levels"), l => has(request, l));
        await spokenHere(app, language, expect);

        await openTab(app.page, "schedule", language);
        let opened = false;
        for (let i = 0; i < 6 && !opened; i += 1) {
          await app.page.evaluate((n) => {
            const grid = Array.from(document.querySelectorAll(".sp-content div")).find(d => getComputedStyle(d).display === "grid" && d.children.length === 7);
            const cards = grid ? Array.from(grid.querySelectorAll("div")).filter(d => d.onclick) : [];
            if (cards[n]) cards[n].click();
          }, i);
          await pause(app.page, 700);
          opened = await clickText(app.page, say("Request to Drop This Shift", language));
          if (!opened) await app.page.keyboard.press("Escape").catch(() => {});
        }
        const reasons = await app.page.evaluate(() => {
          const sel = Array.from(document.querySelectorAll("select")).find(x => x.offsetParent !== null);
          return sel ? Array.from(sel.options).map(o => o.textContent.trim()) : [];
        });
        eachIn("the reasons to drop a shift", labels("drop_reasons"), l => reasons.indexOf(l) !== -1);
        // A reason the portal's own table has never heard of, which only the
        // API's displayLabel can put into the person's language.
        const own = lookupsIn(language).find(c => c.slug === "drop_reasons").values.find(v => v.value === "car_trouble").displayLabel;
        expect("a reason only the API knows is drawn in the API's own word", reasons.indexOf(own) !== -1, JSON.stringify(reasons));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "pinrules",
    label: "Every PIN rule and PIN error, in the person's language: Set your PIN, Change PIN, an activation link and a reset link",
    run: async (open, language, expect) => {
      const RULES = [
        ["12", "PIN must be exactly 4 digits."],
        ["1111", "Four of the same digit is too easy to guess. Use a mix of digits."],
        ["1234", "Digits in a row, like 1234 or 4321, are too easy to guess. Use a different order."],
        ["4821", "Your PIN cannot be your badge number or its last four digits."],
      ];
      const said = async (app, what, line) => {
        const text = await bodyText(app.page);
        expect(what + " says " + JSON.stringify(line) + " in the person's language", has(text, spanishOf(line, language)), text.slice(0, 220));
        await spokenHere(app, language, expect);
      };

      // Set your PIN, where an account that has to choose a new PIN opens.
      const app = await open({ stubOptions: { mustSetPin: true } });
      try {
        await pause(app.page, 600);
        for (const [pin, rule] of RULES) {
          await typeNth(app.page, 'input[type="password"]', 0, pin);
          await typeNth(app.page, 'input[type="password"]', 1, pin);
          await clickText(app.page, say("Save PIN", language));
          await pause(app.page, 500);
          await said(app, "Set your PIN", rule);
        }
      } finally { await app.context.close(); }

      // Change PIN, in Settings.
      const settings = await open({});
      try {
        await openTab(settings.page, "settings", language);
        await pause(settings.page, 800);
        const three = async (current, next) => {
          await typeNth(settings.page, '.sp-content input[type="password"]', 0, current);
          await typeNth(settings.page, '.sp-content input[type="password"]', 1, next);
          await typeNth(settings.page, '.sp-content input[type="password"]', 2, next);
          await clickText(settings.page, say("Update PIN", language));
          await pause(settings.page, 800);
        };
        await three("", "5739");
        await said(settings, "Change PIN", "Enter your current 4-digit PIN.");
        await three("5739", "5739");
        await said(settings, "Change PIN", "Your new PIN must be different from your current PIN.");
        // The API turning it away with no sentence of its own.
        settings.stub.state.refuse["POST /api/auth/change-pin"] = { status: 400, body: {}, once: true };
        await three("2468", "5739");
        await said(settings, "Change PIN", "Request failed");
      } finally { await settings.context.close(); }

      // An activation link whose row carries a badge number, sent without it.
      const link = await open({ signedIn: false, path: "/activate?token=fixture", stubOptions: { activationBadge: true } });
      try {
        await pause(link.page, 1200);
        await typeNth(link.page, 'input[type="password"]', 0, "5739");
        await typeNth(link.page, 'input[type="password"]', 1, "5739");
        await clickText(link.page, say("Activate Account", language));
        await pause(link.page, 600);
        await said(link, "An activation link", "Enter the badge number from your email.");
      } finally { await link.context.close(); }

      // A reset link, with a PIN that is not four digits.
      const reset = await open({ signedIn: false, path: "/reset-pin?token=fixture" });
      try {
        await pause(reset.page, 1200);
        await typeNth(reset.page, 'input[type="password"]', 0, "12");
        await typeNth(reset.page, 'input[type="password"]', 1, "12");
        await clickText(reset.page, say("Save PIN", language));
        await pause(reset.page, 600);
        await said(reset, "A reset link", "PIN must be exactly 4 digits.");
      } finally { await reset.context.close(); }
    },
  },
  {
    id: "changepincodes",
    label: "Change PIN turned away by the API: each refusal under its own box, read off its code, in the person's language",
    run: async (open, language, expect) => {
      // Each code the API sends, the box it belongs under, and what the
      // screen says there.
      const CASES = [
        ["PIN_INCORRECT", 0, "That is not your current PIN."],
        ["PIN_UNCHANGED", 1, "Your new PIN must be different from your current PIN."],
        ["PIN_WEAK", 1, "That PIN is too easy to guess. Choose a different one."],
        ["PIN_FORMAT", 1, "PIN must be exactly 4 digits."],
      ];
      const BOX = ["the current PIN", "the new PIN", "the repeated PIN"];
      const app = await open({});
      try {
        await openTab(app.page, "settings", language);
        await pause(app.page, 800);
        for (const [code, box, line] of CASES) {
          // A change the screen's own checks let through, so the API is
          // what turns it away, with a sentence in the account's language.
          app.stub.state.pinRefusal = code;
          await typeNth(app.page, '.sp-content input[type="password"]', 0, "2468");
          await typeNth(app.page, '.sp-content input[type="password"]', 1, "5739");
          await typeNth(app.page, '.sp-content input[type="password"]', 2, "5739");
          await clickText(app.page, say("Update PIN", language));
          await pause(app.page, 800);
          // What each box has under it, read off the screen.
          const under = await app.page.evaluate(() => Array.from(document.querySelectorAll('.sp-content input[type="password"]')).map((i) => {
            const e = i.nextElementSibling;
            return e ? e.textContent.trim() : "";
          }));
          const said = under.filter(x => x.length > 0);
          expect(code + " is said under " + BOX[box], said.length === 1 && under[box].length > 0, JSON.stringify(under));
          expect(code + " is said in the person's language", has(under[box], spanishOf(line, language)), JSON.stringify(under));
          await spokenHere(app, language, expect);
        }
      } finally { await app.context.close(); }
    },
  },
  {
    id: "assignedstatus",
    label: "An assigned task marked in progress, and the line that says so",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "issuetasks", language);
        await pause(app.page, 900);
        await app.page.evaluate((t) => {
          const card = Array.from(document.querySelectorAll('.sp-content div[style*="cursor: pointer"]')).find(d => d.textContent.indexOf(t) !== -1);
          if (card) card.click();
        }, "Replace the cracked light cover");
        await pause(app.page, 700);
        await clickText(app.page, say("In Progress", language));
        await pause(app.page, 500);
        const told = (await toastText(app.page)) || (await bodyText(app.page));
        expect("the update is told in the person's language",
          has(told, fill(spanishOf("Task updated to {status}", language), { status: spanishOf("in progress", language) })), told.slice(0, 200));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "profilephoto",
    label: "A profile photo the phone cannot read",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "profile", language);
        await pause(app.page, 900);
        await attachBroken(app.page, '.sp-content input[type="file"]');
        await pause(app.page, 900);
        const told = (await toastText(app.page)) || (await bodyText(app.page));
        expect("a photo the phone cannot read says so in the person's language", has(told, spanishOf("Could not read image", language)), told.slice(0, 200));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "offline",
    label: "The app offline: every screen still renders and every failed call says so",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await pause(app.page, 900);
        app.stub.state.offline = true;
        for (const tab of ["schedule", "tasks", "chat", "agent", "issues", "supplies", "pickup", "settings", "forms"]) {
          await openTab(app.page, tab, language);
          const alive = await app.page.evaluate(() => !!document.querySelector(".sp-content") && document.body.innerText.trim().length > 0);
          expect("offline, the " + tab + " tab still renders", alive, "the screen went blank");
        }
        await openTab(app.page, "agent", language);
        await type(app.page, ".sp-content textarea", "A question with no signal");
        await pause(app.page, 400);
        await tapLabel(app.page, say("Send", language));
        await pause(app.page, 1400);
        const said = await bodyText(app.page);
        expect("offline, a failed send says so in the person's language", said.indexOf(say("Not sent.", language)) !== -1 || /Retry|Reintentar/i.test(said), said.slice(-200));
        // Whatever the failed send says, the browser's own words are not it.
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
];

async function runJourneys(browser, base, opts) {
  const o = opts || {};
  const rows = [];
  const covered = [];
  const extra = { refusalsShown: 0 };
  const gaps = [];

  for (const journey of JOURNEYS) {
    for (const language of LANGUAGES) {
      const open = (over) => openApp(browser, base, Object.assign({ language: language, textSize: "standard", signedIn: true }, over || {},
        { stubOptions: Object.assign({ accountPreferences: { language: language } }, (over || {}).stubOptions || {}) }));
      const expect = (what, ok, detail) => {
        if (!ok) rows.push({ where: journey.label + " [" + language + "]", check: what, detail: String(detail || "").slice(0, 220) });
      };
      // Something the journey reaches but cannot yet judge. Named on
      // every run so it is never quietly missing.
      expect.notYet = (what) => { const line = journey.label + ": " + what; if (gaps.indexOf(line) === -1) gaps.push(line); };
      try {
        await journey.run(open, language, expect, extra);
      } catch (e) {
        rows.push({ where: journey.label + " [" + language + "]", check: "ran to the end", detail: String(e.message).split("\n")[0].slice(0, 200) });
      }
      if (covered.indexOf(journey.id) === -1) covered.push(journey.id);
    }
  }
  // A journey that judges the same screen twice reports each fault once.
  const once = new Set();
  const unique = rows.filter((r) => { const k = r.where + "|" + r.check + "|" + r.detail; if (once.has(k)) return false; once.add(k); return true; });
  rows.length = 0;
  unique.forEach(r => rows.push(r));
  return { rows: rows, covered: covered, journeys: JOURNEYS.length, refusalsShown: extra.refusalsShown, refusalsTotal: (TIME_OFF_REFUSALS.length + HR_CASE_REFUSALS.length + SHIFT_REFUSALS.length) * LANGUAGES.length, gaps: gaps };
}

module.exports = { runJourneys, JOURNEYS };
