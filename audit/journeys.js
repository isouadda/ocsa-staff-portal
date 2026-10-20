// Every journey a person actually takes, in both languages.
//
// A journey is judged first on what the app sent, which does not move
// when a word changes, and then on what the screen said.

const { openApp, letSheetOffer, ANDROID, PUSH_KEYS, PUSH_ENDPOINT } = require("./browser");
const { inLanes } = require("./lanes");
const { say, ES, LEAKABLE, SPANISH, SPANISH_PATTERNS } = require("./words");
const { openTab, clickText, startForm, ALLOWED } = require("./screens");
const { INSPECT, languageRows } = require("./checks");
const { TIME_OFF_REFUSALS, HR_CASE_REFUSALS, timeOffRow, PERSON, SECOND_PERSON, formP, formS, STAFF, LOOKUPS, INSPECTION, INSPECTION_LONG, INSPECTION_GONE, INSPECTION_NOT_FOUND, LOGIN_REFUSAL, BADGE_MISMATCH, TWIN_ES, servedFor, createStub, SITE_TASKS, SHIFT_ORDER, LINKS, taskWords, lookupsIn, HELP_ANSWERS, HELP_REFUSALS, helpReply, replyPieces,
  SHIFT_REFUSALS, NOT_YOUR_CHECK, westShiftNames, CATEGORY_CODES, PERIODS, refusalIn, ADMIN_PERSON, CHAT_SEND_REFUSALS, CHAT_UNCODED_REFUSALS, CHAT_TEXT_MAX,
  API_REFUSALS, FILE_REFUSALS, FORM_P_MAX_PHOTOS, SIGNATURE_MAX_BYTES,
  formC, formV, PUBLIC_SITE, PUBLIC_COMPANY, ANNOUNCEMENT, FORM_E_WORDS, EVERY_NOTICE, MAINT_NAMES, FIRST_NAMES, API_R2, apiR2Body, API_R3, API_R4, apiR4Body, FILED_WORDS, SECOND_STEP_CODE, NOW } = require("./stub");

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
// Every toast from now on, read off the page every 50 milliseconds by the
// page's own clock: when each one first showed and when it was last seen,
// its words, and the order they stood in whenever more than one showed. A
// toast is one box inside the strip at the top of the screen, or the strip
// itself when it holds a toast of its own and nothing else.
const watchToasts = (page) => page.evaluate(() => {
  const w = window.__ocsaToasts = { seen: [], orders: [], most: 0, t0: performance.now() };
  const find = () => {
    const strip = Array.from(document.querySelectorAll("div")).find((x) => { const s = getComputedStyle(x); return s.position === "fixed" && s.top === "80px"; });
    if (!strip) return [];
    const kids = Array.from(strip.children).filter(k => k.tagName === "DIV");
    // The strip is a live region the page always holds, empty between
    // toasts (part 344), so an empty strip is no toast.
    return kids.length ? kids : (strip.innerText.trim() ? [strip] : []);
  };
  w.timer = setInterval(() => {
    const now = performance.now() - w.t0;
    const shown = find();
    w.most = Math.max(w.most, shown.length);
    shown.forEach((el) => {
      let rec = w.seen.find(r => r.el === el);
      if (!rec) { rec = { el: el, text: el.innerText.replace(/\s+/g, " ").trim(), first: now, last: now }; w.seen.push(rec); }
      rec.last = now;
    });
    if (shown.length > 1) w.orders.push(shown.map(el => w.seen.findIndex(r => r.el === el)));
  }, 50);
});
const toastsSeen = (page) => page.evaluate(() => {
  const w = window.__ocsaToasts;
  clearInterval(w.timer);
  return { seen: w.seen.map(r => ({ text: r.text, first: Math.round(r.first), last: Math.round(r.last) })), orders: w.orders, most: w.most };
});
const noToast = (page) => page.waitForFunction(() => !Array.from(document.querySelectorAll("div"))
  .some((x) => { const s = getComputedStyle(x); return s.position === "fixed" && s.top === "80px" && x.innerText.trim() !== ""; }), { timeout: 6000 }).catch(() => {});

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

// A check-off's body since Step 238: its own clientId and the time it
// was made, and nothing else (part 344: the journeys still read "{}").
const checkBody = (b) => !!b && typeof b === "object" && Object.keys(b).sort().join(",") === "clientId,completedAt" && typeof b.clientId === "string" && b.clientId.length > 0 && !isNaN(Date.parse(b.completedAt));
// An item's name on the checklist, which a tap opens: a button since the
// rows became tap frames (Step 345).
const openItem = (page, name) => page.evaluate((n) => {
  const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.textContent.trim() === n) || Array.from(document.querySelectorAll(".sp-content button")).find(x => x.textContent.trim().indexOf(n) === 0);
  if (b) b.click();
  return !!b;
}, name);
// A scheduled shift's detail on My Schedule (part 344): since Step 345 a
// day on the week opens that day's sheet, and the shift on it opens its
// detail. Tries each day until a detail offers Request to Drop This Shift,
// and taps that too when drop is set. Answers whether it got there.
async function openShiftDetail(page, language, drop) {
  const want = say("Request to Drop This Shift", language);
  for (let i = 0; i < 7; i += 1) {
    await page.evaluate((n) => {
      const grid = Array.from(document.querySelectorAll(".sp-content div")).find(d => getComputedStyle(d).display === "grid" && d.children.length === 7);
      const days = grid ? Array.from(grid.querySelectorAll("button")) : [];
      if (days[n]) days[n].click();
    }, i);
    await pause(page, 600);
    const rows = await page.evaluate(() => { const d = document.querySelector('[aria-labelledby="ocsa-day-sheet-title"]'); return d ? Array.from(d.querySelectorAll("button")).filter(b => /\d{1,2}:\d{2}/.test(b.textContent)).length : 0; });
    for (let r = 0; r < rows; r += 1) {
      await page.evaluate((k) => { const d = document.querySelector('[aria-labelledby="ocsa-day-sheet-title"]'); const b = d && Array.from(d.querySelectorAll("button")).filter(x => /\d{1,2}:\d{2}/.test(x.textContent))[k]; if (b) b.click(); }, r);
      await pause(page, 600);
      const there = await page.evaluate((w) => Array.from(document.querySelectorAll("button")).some(b => b.textContent.trim() === w && b.offsetParent !== null), want);
      if (there) { if (drop) await clickText(page, want); return true; }
      await page.keyboard.press("Escape").catch(() => {});
      await page.mouse.click(8, 8); await pause(page, 400);
      await page.evaluate((n) => {
        const grid = Array.from(document.querySelectorAll(".sp-content div")).find(d => getComputedStyle(d).display === "grid" && d.children.length === 7);
        const days = grid ? Array.from(grid.querySelectorAll("button")) : [];
        if (days[n]) days[n].click();
      }, i);
      await pause(page, 500);
    }
    await page.mouse.click(8, 8); await pause(page, 400);
  }
  return false;
}
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

// Several photos at once, each made in the page the same way and named
// as a case wants. A name of a kind draws a picture of that kind: .png a
// PNG, anything else a JPEG.
const attachPhotos = (page, selector, names) => page.evaluate(([sel, list]) => new Promise((done) => {
  const input = document.querySelector(sel);
  if (!input) { done(false); return; }
  const dt = new DataTransfer();
  let left = list.length;
  list.forEach((name, i) => {
    const c = document.createElement("canvas"); c.width = 12 + i; c.height = 12;
    const ctx = c.getContext("2d"); ctx.fillStyle = "#3355aa"; ctx.fillRect(0, 0, c.width, c.height);
    const png = /\.png$/i.test(name);
    c.toBlob((b) => {
      dt.items.add(new File([b], name, { type: png ? "image/png" : "image/jpeg" }));
      left -= 1;
      if (left === 0) {
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        done(true);
      }
    }, png ? "image/png" : "image/jpeg");
  });
}), [selector, names]);

// A picture drawn in the page at a size a case names, as a PNG or a JPEG,
// see-through in part when asked, so a case can tell what the phone made
// of it.
const attachDrawn = (page, selector, name, width, height, clear) => page.evaluate(([sel, n, w, h, see]) => new Promise((done) => {
  const input = document.querySelector(sel);
  if (!input) { done(false); return; }
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  if (!see) { ctx.fillStyle = "#3355aa"; ctx.fillRect(0, 0, w, h); }
  ctx.fillStyle = see ? "rgba(200, 40, 40, 0.5)" : "#dddddd"; ctx.fillRect(2, 2, Math.max(1, w / 2), Math.max(1, h / 2));
  const png = /\.png$/i.test(n);
  c.toBlob((b) => {
    const dt = new DataTransfer(); dt.items.add(new File([b], n, { type: png ? "image/png" : "image/jpeg" }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    done(true);
  }, png ? "image/png" : "image/jpeg", 0.92);
}), [selector, name, width, height, !!clear]);

// A file with the bytes a case gives it, named and typed as the case says.
const attachBytes = (page, selector, base64, name, type) => page.evaluate(([sel, b64, n, t]) => {
  const input = document.querySelector(sel);
  if (!input) return false;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const dt = new DataTransfer(); dt.items.add(new File([bytes], n, { type: t }));
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}, [selector, base64, name, type]);

// A HEIC file, 64 by 40, a checkerboard of two colors, encoded with
// pillow-heif at quality 60. The one real picture in the suite, since the
// browser cannot make one, and the phone has to convert it before it
// sends anything.
const HEIC_FIXTURE = "AAAAHGZ0eXBoZWljAAAAAG1pZjFoZWljbWlhZgAAAX1tZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAABoQABAAAAAAAAASMAAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABodmMxAAAAAA5waXRtAAAAAAABAAAA/WlwcnAAAADdaXBjbwAAAHZodmNDAQNwAAAAAAAAAAAAHvAA/P34+AAADwNgAAEAGEABDAH//wNwAAADAJAAAAMAAAMAHroCQGEAAQAqQgEBA3AAAAMAkAAAAwAAAwAeoCCBBZbq5Ka5uAhoMCAAAAMDIAAAAwAhYgABAAZEAcFzwIkAAAATY29scm5jbHgAAQANAAaAAAAAFGlzcGUAAAAAAAAAQAAAAEAAAAAoY2xhcAAAAEAAAAABAAAAKAAAAAEAAAAAAAAAAv///+gAAAACAAAAEHBpeGkAAAAAAwgICAAAABhpcG1hAAAAAAAAAAEAAQWBAgMFhAAAASttZGF0AAABHygBrwngivoBtpn/kP6+2j/wUd3QwfpyN9KmNZfbvaI92w++krzKNvg2XT9F79RQ+abYq9yeomi1mK3uEWuVegq9VQvp4f3NWEfgtXW/uvUMgdszxpUPmwqsOoLYv3tjNWyUYVbKcIFWz1z1o0dXYUsyco7WGsM6ZZHvlmj9dNQBdXZHjaa0DNKg4VIqtE5wY7/bf9uuBip1lGmQv747PCoS0QPOfmm/wRwmHy/21aHLz036kPSJUEdLKYA1Vpx92vv7DdKP+HmdxwKWYBrTt3MB7wF1LSL3WL7AnzpT70CNVkA4huvD3XgFG/1zckBul60ojD7LDJO6GjxBFc5ZDqANwQGJOTCmCD0aFfHR7NQ+j2FNk8lZxBaf68xhMoXA";

// The line a saved customer signature reads as, the way the stub writes
// it beside the API.
const customerLine = (stamp, language) => require("./stub").customerSignatureLine(stamp, language);

// The sign sheet: the drawing box on the screen, a stroke drawn across it
// with the pointer the way a finger or a mouse would, and the buttons in
// the sheet itself rather than the ones under it.
const signBox = (page) => page.evaluate(() => {
  const sheet = Array.from(document.querySelectorAll("div")).filter((x) => {
    const s = getComputedStyle(x);
    return s.position === "fixed" && s.top === "0px" && s.left === "0px" && s.right === "0px" && s.bottom === "0px";
  }).pop();
  const c = (sheet && sheet.querySelector("canvas")) || Array.from(document.querySelectorAll("canvas")).find(x => x.offsetParent !== null);
  if (!c) return null;
  // Brought onto the screen first, the way a person scrolls to it.
  try { c.scrollIntoView({ block: "center" }); } catch (e) {}
  const r = c.getBoundingClientRect();
  return { left: r.left, top: r.top, width: Math.round(r.width), height: Math.round(r.height), backing: [c.width, c.height] };
});
const drawSignature = async (page) => {
  const b = await signBox(page);
  if (!b) return false;
  const y = b.top + b.height * 0.55;
  await page.mouse.move(b.left + b.width * 0.15, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) await page.mouse.move(b.left + b.width * (0.15 + 0.08 * i), y + (i % 2 ? -18 : 18), { steps: 3 });
  await page.mouse.up();
  await pause(page, 300);
  return true;
};
const sheetButtons = (page) => page.evaluate(() => {
  const d = Array.from(document.querySelectorAll("div")).filter((x) => {
    const s = getComputedStyle(x);
    return s.position === "fixed" && s.top === "0px" && s.left === "0px" && s.right === "0px" && s.bottom === "0px";
  }).pop();
  return d ? Array.from(d.querySelectorAll("button")).map(b => ({ text: b.textContent.trim(), disabled: b.disabled })) : [];
});
const tapInSheet = async (page, text) => {
  const hit = await page.evaluate((want) => {
    const d = Array.from(document.querySelectorAll("div")).filter((x) => {
      const s = getComputedStyle(x);
      return s.position === "fixed" && s.top === "0px" && s.left === "0px" && s.right === "0px" && s.bottom === "0px";
    }).pop();
    const b = d && Array.from(d.querySelectorAll("button")).find(x => x.textContent.trim() === want && !x.disabled);
    if (b) { b.click(); return true; }
    return false;
  }, text);
  await pause(page, 800);
  return hit;
};

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
// A word the stub serves in the request's language, the way the screen
// in that language should draw it: its Spanish twin on a Spanish screen.
const servedIn = (english, language) => (language === "es" && TWIN_ES.has(english) ? TWIN_ES.get(english) : english);
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
// A row's box tapped, and no wait after it, for a case that times what
// follows. tapRow waits for the list to settle.
const tapRowNow = (page, language, name) => page.evaluate(([checked, open, want]) => {
  const b = Array.from(document.querySelectorAll(".sp-content button[aria-label]")).find(x => x.getAttribute("aria-label") === checked.replace("{name}", want) || x.getAttribute("aria-label") === open.replace("{name}", want));
  if (b && !b.disabled) { b.click(); return true; }
  return false;
}, [say("Mark {name} not done", language), say("Mark {name} done", language), name]);
const tapRow = async (page, language, name) => {
  const hit = await tapRowNow(page, language, name);
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

// --- Chat --------------------------------------------------------------

// The composer's box, the one box on the Chat screen.
const CHAT_BOX = ".sp-content input";
// A chat's name as the screen should draw it: a private chat of the
// person's own by the portal's own words for it, every other by the name
// the API sent.
const chatName = (ch, language) => (ch.type === "admin_dm" && !ch.staffUserId ? say("Admin (Private)", language) : ch.name);
// Every button that names one of these chats, in the order the screen
// draws them, with where it sits and whether it says it is chosen.
const chatButtons = (page, names) => page.evaluate((list) => {
  const out = [];
  Array.from(document.querySelectorAll(".sp-content button")).forEach((b) => {
    const text = b.innerText.replace(/\s+/g, " ").trim();
    const name = list.find(n => text === n || text.indexOf(n + " ") === 0);
    if (!name) return;
    const r = b.getBoundingClientRect();
    out.push({ name: name, pressed: b.getAttribute("aria-pressed"), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) });
  });
  return out;
}, names);
// One chat tapped the way a person reaches it: brought into view first,
// then tapped where it is drawn, only if nothing covers it there. A person
// can scroll a row that scrolls and the page itself, and nothing else: a
// box that hides what sticks out of it cannot be scrolled with a finger,
// so it is left where it is.
const tapChat = (page, name) => page.evaluate((want) => {
  const b = Array.from(document.querySelectorAll(".sp-content button")).find((x) => {
    const text = x.innerText.replace(/\s+/g, " ").trim();
    return text === want || text.indexOf(want + " ") === 0;
  });
  if (!b) return "not drawn";
  for (let a = b.parentElement; a && a !== document.body; a = a.parentElement) {
    const s = getComputedStyle(a);
    const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
    if ((s.overflowX === "auto" || s.overflowX === "scroll") && a.scrollWidth > a.clientWidth) a.scrollLeft += (br.left + br.width / 2) - (ar.left + ar.width / 2);
    if ((s.overflowY === "auto" || s.overflowY === "scroll") && a.scrollHeight > a.clientHeight) a.scrollTop += (br.top + br.height / 2) - (ar.top + ar.height / 2);
  }
  const r0 = b.getBoundingClientRect();
  if (r0.top < 0 || r0.bottom > window.innerHeight) window.scrollBy(0, r0.top + r0.height / 2 - window.innerHeight / 2);
  const r = b.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  if (x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight) return "off the screen at " + Math.round(x) + "," + Math.round(y);
  const hit = document.elementFromPoint(x, y);
  if (!hit || !(hit === b || b.contains(hit))) return "covered at " + Math.round(x) + "," + Math.round(y);
  b.click();
  return "tapped";
}, name);
// The chats whose messages the app read, in order.
const chatReads = (stub) => stub.state.calls.filter(c => c.method === "GET" && /^\/api\/chat\/channels\/[^/]+\/messages$/.test(c.path)).map(c => c.path.split("/")[4]);
const chatSends = (stub, text) => stub.state.calls.filter(c => c.method === "POST" && /^\/api\/chat\/channels\/[^/]+\/messages$/.test(c.path) && (text === undefined || (c.body && c.body.text === text)));
// Each bubble that holds exactly this text, with where it sits and the
// line drawn under it.
const bubbles = (page, text) => page.evaluate((want) => Array.from(document.querySelectorAll(".sp-content div"))
  .filter(d => d.children.length === 0 && d.offsetParent !== null && d.textContent.trim() === want)
  .map((d) => {
    const r = d.getBoundingClientRect();
    const under = d.nextElementSibling ? d.nextElementSibling.textContent.trim() : "";
    return { left: Math.round(r.left), right: Math.round(r.right), under: under, width: window.innerWidth };
  }), text);
// Is Send ready, the way it says so: a Send that is not ready says it is
// not available.
const sendReady = (page, language) => page.evaluate((want) => {
  const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => (x.getAttribute("aria-label") || "").trim() === want);
  if (!b) return null;
  return !b.disabled && b.getAttribute("aria-disabled") !== "true";
}, say("Send", language));
// Send tapped even when it is not ready, which a person can do.
const tapSend = (page, language) => page.evaluate((want) => {
  const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => (x.getAttribute("aria-label") || "").trim() === want);
  if (b) b.click();
  return !!b;
}, say("Send", language));
// A button whose words are exactly these, tapped.
const tapWords = (page, words) => page.evaluate((want) => {
  const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.innerText.replace(/\s+/g, " ").trim() === want && x.offsetParent !== null);
  if (b && !b.disabled) { b.click(); return true; }
  return false;
}, words);
const hasButton = (page, words) => page.evaluate((want) => Array.from(document.querySelectorAll(".sp-content button")).some(x => x.innerText.replace(/\s+/g, " ").trim() === want && x.offsetParent !== null), words);
const sidewaysBy = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
// The line for each refusal of a send that carries no code.
const chatSendLine = (status) => (status === 403 ? "You cannot send messages in this chat." : "Your message was not sent.");
// The line under the box that says what happened to a send, as it reads.
const chatFaultText = (page) => page.evaluate(() => {
  const a = Array.from(document.querySelectorAll('.sp-content [role="alert"]')).pop();
  return a ? a.innerText.replace(/\s+/g, " ").trim() : "";
});
// Every call Chat made that does not say this language.
const chatCallsNotIn = (stub, language) => stub.state.calls
  .filter(c => c.path.indexOf("/api/chat/") === 0 && !new RegExp("[?&]locale=" + language + "(&|$)").test(c.search || ""))
  .map(c => c.method + " " + c.path + (c.search || ""));
const OFFLINE_LINE = "Could not reach OCSA. Check your connection and try again.";
// How many times the API kept a message with exactly this text.
const chatSaved = (stub, id, text) => (stub.state.chat.messages[id] || []).filter(m => m.text === text).length;
// Open Chat and give it time to read the list and, when it opens on a
// chat, that chat.
const openChat = async (page, language) => {
  await openTab(page, "chat", language);
  await pause(page, 1300);
};

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
// The line under each of Help's answers that names its sources, in the
// order the answers came. Invented codes: a reference entry and an OCSA
// document, neither of them real.
const SOURCE_REF = "REF-FIX-FLOORS";
const SOURCE_DOC = "OCSA-FIX-001";
const sourceLines = (page, based) => page.evaluate((mark) => Array.from(document.querySelectorAll(".sp-content div"))
  .filter(d => d.children.length === 0 && d.textContent.indexOf(mark + " ") === 0)
  .map(d => d.textContent.replace(/\s+/g, " ").trim()), based);

// A form's section headings on the screen, in order, each with where its
// bottom edge sits, and where the first box that starts with a question's
// label sits.
const formHeadings = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.sp-content [role="heading"]'))
  .map(h => ({ text: h.innerText.replace(/\s+/g, " ").trim(), bottom: Math.round(h.getBoundingClientRect().bottom) })));
// How many times a line is drawn on the screen, and where the first
// starts, for a help line that has to appear once and under a heading.
const lineCount = (page, line) => page.evaluate((want) => {
  const hits = Array.from(document.querySelectorAll(".sp-content div")).filter(d => d.children.length === 0 && d.innerText.replace(/\s+/g, " ").trim() === want);
  return { count: hits.length, top: hits.length ? Math.round(hits[0].getBoundingClientRect().top) : null };
}, line);
const labelTop = (page, label) => page.evaluate((want) => {
  const d = Array.from(document.querySelectorAll(".sp-content div")).filter(x => x.getAttribute("role") !== "heading")
    .find(x => x.innerText && x.innerText.replace(/\s+/g, " ").trim().indexOf(want) === 0);
  return d ? Math.round(d.getBoundingClientRect().top) : null;
}, label);

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
// these, so the streaming route is asked the same way. The query is the
// screen's language, which every call says.
const OWN_HEADERS = "accept: */* | authorization: Bearer token-one | content-type: application/json";
const ownHeaders = (h) => Object.keys(h || {}).filter(k => !/^(origin|referer|user-agent|sec-|accept-language$)/i.test(k)).sort().map(k => k + ": " + h[k]).join(" | ");
const sentAsAlways = (call, keys, language) => !!call && call.path === "/api/agent/message/stream" && call.search === "?locale=" + language
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
        // Word for word: the API's own sentence, in the language the
        // request asks for, drawn as it came.
        const refusedWith = await bodyText(app.page);
        expect("a wrong PIN says so in the person's language",
          has(refusedWith, LOGIN_REFUSAL[language === "es" ? 1 : 0]), refusedWith.slice(0, 220));
        await spokenHere(app, language, expect);

        // A sign-in that never reaches OCSA at all. The PIN is fine, and
        // the line about a sign-in not matching is for the API's own
        // refusal, so it must not show here.
        // The toast before this one is still up, and its own timer would
        // take this one down with it, so it is let go first.
        await app.page.waitForFunction((gone) => gone.every(g => document.body.innerText.indexOf(g) === -1), LOGIN_REFUSAL, { timeout: 5000 }).catch(() => {});
        app.stub.state.offline = true;
        await type(app.page, 'input[type="password"]', "4907");
        await clickText(app.page, say("Sign In", language));
        await pause(app.page, 900);
        const nowhere = await bodyText(app.page);
        expect("a sign-in that cannot reach OCSA says so",
          nowhere.indexOf(say("Could not reach OCSA. Check your connection and try again.", language)) !== -1, nowhere.slice(0, 260));
        expect("a sign-in that cannot reach OCSA leaves the PIN out of it",
          !LOGIN_REFUSAL.some(g => has(nowhere, g)), nowhere.slice(0, 260));
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
    id: "signinfault",
    label: "A sign-in turned away stays under the PIN box: three wrong PINs with the lock line from the third, a locked account, the install sheet kept for the portal itself, and the lines said before any mistake",
    run: async (open, language, expect, extra) => {
      // What is drawn after a PIN box in its own field, in order: each
      // line's words, and whether a screen reader is told it at once.
      const underBox = (page, n) => page.evaluate((i) => {
        const box = document.querySelectorAll('input[type="password"]')[i];
        const out = [];
        for (let e = box ? box.nextElementSibling : null; e; e = e.nextElementSibling) out.push({ text: e.innerText.replace(/\s+/g, " ").trim(), alert: e.getAttribute("role") === "alert" });
        return out;
      }, n || 0);
      const sheetUp = (page) => page.evaluate(() => !!document.getElementById("ocsa-a2hs-title"));
      const refusal = LOGIN_REFUSAL[language === "es" ? 1 : 0];
      const lockLine = spanishOf("After too many wrong tries, sign-in stops for a while. Ask your supervisor for help.", language);
      const locked = refusalIn(API_REFUSALS["auth.locked"], language, API_REFUSALS["auth.locked"].vars);

      // Three wrong PINs in a row, each turned away the way the API turns
      // one away: its own sentence, with auth.invalidCredentials as its code.
      const app = await open({ signedIn: false });
      try {
        await type(app.page, 'input[autocomplete="username"]', "4821");
        for (let n = 1; n <= 3; n += 1) {
          await type(app.page, 'input[type="password"]', "0000");
          await clickText(app.page, say("Sign In", language));
          await pause(app.page, 900);
          const lines = await underBox(app.page);
          expect("wrong PIN " + n + " is drawn under the PIN box in the API's own words, and said at once",
            lines.length > 0 && lines[0].alert && lines[0].text === refusal, JSON.stringify(lines));
          const lock = lines.some(l => l.text === lockLine);
          expect(n < 3 ? "no lock line before the third wrong PIN in a row, at wrong PIN " + n : "the lock line joins the refusal at the third wrong PIN in a row",
            n < 3 ? !lock : lock, JSON.stringify(lines));
        }
        await spokenHere(app, language, expect);
        // A toast would be gone by now. The refusal waits for the person.
        await pause(app.page, 3600);
        expect("the refusal is still under the box once a toast would have gone", (await underBox(app.page)).some(l => l.text === refusal), JSON.stringify(await underBox(app.page)));
        await type(app.page, 'input[type="password"]', "4");
        await pause(app.page, 300);
        expect("typing again takes the refusal and the lock line away", (await underBox(app.page)).length === 0, JSON.stringify(await underBox(app.page)));

        // A locked account: 429 with auth.locked, drawn the same way, with
        // the portal's own line about a lock under it, as the sign-in card
        // has drawn it since Oct 7 (1e2e568; part 344 brought the journey
        // up to it).
        app.stub.state.refuse["POST /api/auth/login"] = { api: "auth.locked", once: true };
        await type(app.page, 'input[type="password"]', "4907");
        await clickText(app.page, say("Sign In", language));
        await pause(app.page, 900);
        const lockedLines = await underBox(app.page);
        const shown = lockedLines.length === 2 && lockedLines[0].alert && lockedLines[0].text === locked && lockedLines[1].text === say("After too many wrong tries, sign-in stops for a while. Ask your supervisor for help.", language);
        expect("a locked account is drawn under the PIN box in the API's own words", shown, JSON.stringify(lockedLines));
        if (extra) extra.refusalsShown += shown ? 1 : 0;
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }

      // The install sheet waits for the portal itself: never over the
      // sign-in card, never over Set your PIN, and offered once the new
      // PIN is saved and the portal is up. Set your PIN says its rules
      // under New PIN before anyone breaks one.
      const fresh = await open({ signedIn: false, installSheet: "fresh", stubOptions: { mustSetPin: true } });
      try {
        await letSheetOffer(fresh.page);
        expect("the install sheet is not offered over the sign-in card", !(await sheetUp(fresh.page)), (await sheetText(fresh.page)).slice(0, 120));
        await type(fresh.page, 'input[autocomplete="username"]', "4821");
        await type(fresh.page, 'input[type="password"]', "4907");
        await clickText(fresh.page, say("Sign In", language));
        await pause(fresh.page, 1500);
        const rules = spanishOf("4 digits. Not all the same, not in a row like 1234, and not your badge number. The PIN you were given works until you save a new one.", language);
        const under = await underBox(fresh.page, 0);
        expect("Set your PIN says the rules under New PIN before anything is typed", under.some(l => l.text === rules && !l.alert), JSON.stringify(under));
        await spokenHere(fresh, language, expect);
        await letSheetOffer(fresh.page);
        expect("the install sheet is not offered over Set your PIN", !(await sheetUp(fresh.page)), (await sheetText(fresh.page)).slice(0, 120));
        await typeNth(fresh.page, 'input[type="password"]', 0, "5739");
        await typeNth(fresh.page, 'input[type="password"]', 1, "5739");
        await clickText(fresh.page, say("Save PIN", language));
        await pause(fresh.page, 1500);
        expect("the new PIN is saved and the portal is up", await fresh.page.evaluate(() => !!document.querySelector(".sp-content")), (await bodyText(fresh.page)).slice(0, 160));
        await letSheetOffer(fresh.page);
        expect("once the portal is up, the install sheet is offered", await sheetUp(fresh.page), (await bodyText(fresh.page)).slice(0, 160));
      } finally { await fresh.context.close(); }

      // Forgot your PIN says the no-email line before Send, so a person
      // with no email on file never waits for a link that cannot come.
      const forgot = await open({ signedIn: false });
      try {
        await clickText(forgot.page, say("Forgot your PIN?", language));
        await pause(forgot.page, 700);
        const where = await forgot.page.evaluate(([line, send]) => {
          const d = Array.from(document.querySelectorAll("div")).find(x => x.children.length === 0 && x.textContent.trim() === line && x.offsetParent !== null);
          const b = Array.from(document.querySelectorAll("button")).find(x => x.textContent.trim() === send);
          return { line: !!d, send: !!b, above: !!d && !!b && d.getBoundingClientRect().bottom <= b.getBoundingClientRect().top };
        }, [spanishOf("No email on file? A link cannot reach you. Ask your supervisor to reset your PIN.", language), say("Send Reset Link", language)]);
        expect("Forgot your PIN says the no-email line above Send, with nothing sent yet",
          where.line && where.above && sent(forgot.stub, "POST", "/api/auth/reset/request").length === 0, JSON.stringify(where));
        await spokenHere(forgot, language, expect);
      } finally { await forgot.context.close(); }
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
          has(told, LOGIN_REFUSAL[language === "es" ? 1 : 0]), told.slice(0, 200));
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
      // does not match. The answer's code says which box, and its
      // sentence, the API's own in the request's language, is what the
      // box says.
      const link = await open({ signedIn: false, phone: other, path: "/activate?token=fixture", stubOptions: { activationBadge: true } });
      try {
        await pause(link.page, 1200);
        await typeNth(link.page, 'input:not([type="password"])', 0, "9999");
        await typeNth(link.page, 'input[type="password"]', 0, "5739");
        await typeNth(link.page, 'input[type="password"]', 1, "5739");
        await clickText(link.page, say("Activate Account", language));
        await pause(link.page, 900);
        const said = await bodyText(link.page);
        expect("a badge number that does not match is said in the API's own words, in the screen's language",
          has(said, BADGE_MISMATCH[language === "es" ? 1 : 0]), said.slice(0, 220));
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
    id: "screenlanguage",
    label: "Every call asks in the screen's language, so three refusals a cleaner meets read in it on an account set to the other",
    run: async (open, language, expect, extra) => {
      const other = language === "es" ? "en" : "es";
      // Each refusal, the route it turns away, how a person gets there, the
      // tap that asks, and where the screen says what came back.
      const CASES = [
        { key: "timeOff.lastBeforeFirst", method: "POST", path: "/api/time-off", where: "the sheet",
          reach: async (page) => {
            await openTab(page, "schedule", language);
            await clickText(page, say("Request time off", language));
            await type(page, 'div[style*="z-index: 200"] textarea', "kept text");
          },
          tap: (page) => clickText(page, say("Send request", language)),
          read: (page) => sheetText(page) },
        { key: "pickups.alreadyClaimed", method: "POST", path: "/api/pickups/pk-1/claim", where: "the toast",
          reach: async (page) => { await openTab(page, "pickup", language); await pause(page, 900); },
          tap: (page) => clickText(page, say("Claim This Shift", language)),
          read: (page) => toastText(page) },
        { key: "supplies.requestTypeRequired", method: "POST", path: "/api/supplies/requests", where: "the toast",
          reach: async (page) => {
            await openTab(page, "supplies", language);
            await pause(page, 800);
            await clickText(page, say("+ Request", language));
            await clickText(page, say("Refill", language));
          },
          tap: (page) => clickText(page, say("Submit Request", language)),
          read: (page) => toastText(page) },
      ];
      for (const c of CASES) {
        const app = await open({});
        try {
          // The account says the other language from here on, the way it
          // does once a person's language is set from the dashboard while
          // this phone stays signed in. The screen keeps its own.
          app.stub.state.accountPreferences.language = other;
          await c.reach(app.page);
          app.stub.state.refuse[c.method + " " + c.path] = { api: c.key };
          await c.tap(app.page);
          await pause(app.page, 300);
          const asked = lastSent(app.stub, c.method, c.path);
          const said = asked ? new URLSearchParams(asked.search).getAll("locale") : [];
          expect(c.key + " is asked for in the screen's language, once", said.length === 1 && said[0] === language,
            asked ? asked.method + " " + asked.path + asked.search : "never sent");
          const drawn = await c.read(app.page);
          const wanted = API_REFUSALS[c.key][language];
          const ok = has(drawn, wanted);
          expect(c.key + " is read in the screen's language in " + c.where + ", on an account set to the other", ok,
            "wanted " + JSON.stringify(wanted) + " in " + JSON.stringify(String(drawn).slice(0, 200)));
          if (extra) extra.refusalsShown += ok ? 1 : 0;
          // Every call this phone made says the screen's language once: the
          // ones that always named it and the ones that now do.
          const off = app.stub.state.calls.filter((k) => { const l = new URLSearchParams(k.search || "").getAll("locale"); return l.length !== 1 || l[0] !== language; });
          expect("every call on the way to " + c.key + " says the screen's language, once", off.length === 0,
            off.slice(0, 3).map(k => k.method + " " + k.path + k.search).join(", "));
          await spokenHere(app, language, expect);
        } finally { await app.context.close(); }
      }
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
        await openItem(app.page, one.label);
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
          posted.length === before + 1 && check.path === "/api/clock/tasks/task-3/complete" && checkBody(check.body),
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
        const order = SHIFT_ORDER.map(x => (/^s-\d+$/.test(x) ? itemName(x, language) : servedIn(x, language)));
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
          const tappedAt = await app.page.evaluate(() => Date.now());
          await clickText(app.page, say("Start Shift", language));
          await pause(app.page, 1600);
          const started = lastSent(app.stub, "POST", "/api/shift-sessions");
          // Since part 355 the start carries the tap's own time (PORT-06).
          const sentAt = started && started.body ? Date.parse(started.body.startedAt) : NaN;
          expect("Start Shift sends the site the way it always has, with the time it was tapped" + at, !!started && Object.keys(started.body || {}).sort().join(",") === "siteId,startedAt" && started.body.siteId === WEST && Number.isFinite(sentAt) && Math.abs(sentAt - tappedAt) <= 2000, started ? JSON.stringify(started.body) : "nothing sent");
          const sheet = await shiftSheet(app.page, language);
          expect("Start Shift at a site with shifts asks which shift" + at, sheet.up, "no sheet: " + (await bodyText(app.page)).slice(0, 160));
          if (!sheet.up) continue;
          const shifts = app.stub.peek.session().shifts;
          const named = shifts.every(s => sheet.choices.some(c => c.text.indexOf(servedIn(s.displayLabel, language)) === 0));
          expect("the sheet offers every shift by its name" + at, named && sheet.choices.length === shifts.length, JSON.stringify(sheet.choices));
          const hours = [];
          for (const s of shifts) hours.push(s.window ? await hoursOf(app.page, language, s.window.startsAt, s.window.endsAt) : "");
          const underEach = shifts.every((s, i) => { const c = sheet.choices.find(x => x.text.indexOf(servedIn(s.displayLabel, language)) === 0); return !!c && c.text.indexOf(hours[i]) !== -1; });
          expect("each shift shows its hours under its name" + at, underEach, JSON.stringify(sheet.choices) + " wanted " + JSON.stringify(hours));
          const picked = sheet.choices.filter(c => c.picked).map(c => c.text);
          const suggested = shifts.find(s => s.suggested);
          expect("the shift the time suggests is the one chosen" + at, picked.length === 1 && !!suggested && picked[0].indexOf(servedIn(suggested.displayLabel, language)) === 0 && suggested.label === (run.keep ? run.want : run.other), JSON.stringify(picked));
          expect("the sheet says the time chose it" + at, has(sheet.text, say("Chosen by the time you started. Change it if it is wrong.", language)), sheet.text.slice(0, 200));
          expect("the sheet's words are in the person's language" + at, language !== "es" || ["Which shift are you working?", "Chosen by the time you started. Change it if it is wrong.", "Use this shift"].every(w => has(sheet.text, spanishOf(w, language))), sheet.text.slice(0, 200));
          await spokenHere(app, language, expect);
          if (!run.keep) await pickShift(app.page, servedIn(run.want, language));
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
        expect("the checklist names the shift in use, with Change shift", line !== null && has(line, servedIn(NIGHT_SHIFT, language)), String(line));
        await clickText(app.page, say("Change shift", language));
        await pause(app.page, 800);
        const sheet = await shiftSheet(app.page, language);
        const picked = sheet.choices.filter(c => c.picked).map(c => c.text);
        expect("Change shift opens the sheet with the shift in use chosen", sheet.up && picked.length === 1 && picked[0].indexOf(servedIn(NIGHT_SHIFT, language)) === 0, JSON.stringify(sheet.choices));
        await pickShift(app.page, servedIn(DAY_SHIFT, language));
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
        expect("the checklist names the new shift", after !== null && has(after, servedIn(DAY_SHIFT, language)), String(after));
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
          const said = refusalIn(refusal, language, westShiftNames(language));
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
        expect("checking a weekly item sends the check the way it always has", !!check && checkBody(check.body), check ? JSON.stringify(check.body) : "nothing sent");
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
    id: "toastturns",
    label: "Toasts: two inside one second both show, the newer on top, each for its full time, and a fourth waits its turn",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: westAt({ shiftLabel: NIGHT_SHIFT, completions: [{ taskId: "w-1", userId: PERSON.id }] }) });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1400);
        await noToast(app.page);
        // A task checked, and 600 milliseconds later this person's own check
        // taken back: Task completed, then Task unchecked.
        await watchToasts(app.page);
        await tapRowNow(app.page, language, itemName("w-6", language));
        await pause(app.page, 600);
        await tapRowNow(app.page, language, itemName("w-1", language));
        await pause(app.page, 5000);
        const two = await toastsSeen(app.page);
        const a = two.seen.find(r => r.text === say("Task completed", language));
        const b = two.seen.find(r => r.text === say("Task unchecked", language));
        const full = (r) => !!r && r.last - r.first >= 2700 && r.last - r.first <= 3400;
        const timed = (list) => JSON.stringify(list.map(r => r.text + " from " + r.first + " to " + r.last + " ms"));
        expect("two toasts inside one second both show", two.seen.length === 2 && !!a && !!b && b.first - a.first < 1000, timed(two.seen));
        expect("the newer toast shows above the older one", !!a && !!b && two.orders.some(o => o.join() === [two.seen.indexOf(b), two.seen.indexOf(a)].join()), JSON.stringify(two.orders.slice(0, 3)));
        expect("each of the two shows for its full time", full(a) && full(b), timed(two.seen));

        // Four together: three show, and the fourth waits its turn and then
        // shows for its own full time.
        await noToast(app.page);
        await watchToasts(app.page);
        for (const id of ["w-2", "w-9", "w-12", "w-14"]) { await tapRowNow(app.page, language, itemName(id, language)); await pause(app.page, 150); }
        await pause(app.page, 7200);
        const four = await toastsSeen(app.page);
        const byFirst = four.seen.slice().sort((x, y) => x.first - y.first);
        expect("four toasts together show three at most at once", four.seen.length === 4 && four.most <= 3, four.seen.length + " in all, " + four.most + " at once");
        expect("the fourth waits its turn and shows once the first has gone", byFirst.length === 4 && byFirst[3].first >= byFirst[0].last, timed(byFirst));
        expect("each of the four shows for its full time", four.seen.length === 4 && four.seen.every(full), timed(byFirst));
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
          const title = servedIn(block.displayLabel, language);
          const drawn = await titlesOf(app.page, title);
          if (block.time) {
            const time = await timeOf(app.page, language, block.time);
            expect("a block's title shows its time first: " + block.label, drawn.length > 0 && drawn.every(x => x === time + " " + title), JSON.stringify(drawn) + " wanted " + JSON.stringify(time + " " + title));
          } else {
            expect("a block with no time shows its title alone: " + block.label, drawn.length > 0 && drawn.every(x => x === title), JSON.stringify(drawn));
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
        await openItem(app.page, itemName("task-1", language));
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
    id: "localday",
    label: "The phone's own day: at the suite's 9:30 PM, Home and Schedule mark Thursday, October 1 as today and leave October 2 unmarked, and a due date sent as midnight UTC reads its own day on an assigned card and on its detail",
    run: async (open, language, expect) => {
      // The dates a week strip marks as today, each read off the day it
      // draws: the one day with the gold edge.
      const todayMarked = (page) => page.evaluate(() => {
        const grid = Array.from(document.querySelectorAll(".sp-content div")).find(d => getComputedStyle(d).display === "grid" && d.children.length === 7);
        if (!grid) return null;
        // Since Step 345 each day is a button holding the day's box, and the
        // gold edge is on that box (part 344).
        const boxOf = (c) => (c.tagName === "BUTTON" && c.firstElementChild ? c.firstElementChild : c);
        return Array.from(grid.children).filter(c => /231, 176, 23/.test(getComputedStyle(boxOf(c)).borderTopColor)).map((c) => {
          const n = Array.from(c.querySelectorAll("div")).find(d => /^\d{1,2}$/.test(d.textContent.trim()));
          return n ? n.textContent.trim() : "?";
        });
      });
      const app = await open({});
      try {
        await openTab(app.page, "clock", language);
        await pause(app.page, 1200);
        const home = await todayMarked(app.page);
        expect("Home's week strip marks October 1 as today and leaves October 2 unmarked", JSON.stringify(home) === JSON.stringify(["1"]), JSON.stringify(home));
        await openTab(app.page, "schedule", language);
        await pause(app.page, 1200);
        const week = await todayMarked(app.page);
        expect("Schedule marks October 1 as today and leaves October 2 unmarked", JSON.stringify(week) === JSON.stringify(["1"]), JSON.stringify(week));
      } finally { await app.context.close(); }

      // A due date the API sends as a day at midnight UTC, which is still
      // the evening before in New York at the suite's clock.
      const due = await open({ stubOptions: { assignedDue: "2026-10-02T00:00:00.000Z" } });
      try {
        const dayIn = (opts) => due.page.evaluate(([l, o]) => [new Date(2026, 9, 2).toLocaleDateString(l, o), new Date(2026, 9, 1).toLocaleDateString(l, o)], [language === "es" ? "es-US" : "en-US", opts]);
        await openTab(due.page, "issuetasks", language);
        await pause(due.page, 900);
        const [cardDay, cardEve] = await dayIn({ month: "short", day: "numeric" });
        const card = await bodyText(due.page);
        expect("the assigned card reads the due day as October 2", has(card, say("Due:", language) + " " + cardDay) && !has(card, say("Due:", language) + " " + cardEve), card.slice(0, 260));
        await due.page.evaluate((label) => {
          const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.textContent.indexOf(label) !== -1);
          if (b) b.click();
        }, "Replace the cracked light cover");
        await pause(due.page, 700);
        const [detailDay, detailEve] = await dayIn({ month: "short", day: "numeric", year: "numeric" });
        const detail = await bodyText(due.page);
        expect("its detail reads October 2 too", has(detail, detailDay) && !has(detail, detailEve), detail.slice(0, 300));
        await spokenHere(due, language, expect);
      } finally { await due.context.close(); }
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
          app.stub.state.refuse["POST /api/time-off"] = { status: refusal.status, body: Object.assign({ error: refusal.error, code: refusal.code }, refusal.extra) };
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
        const opened = await openShiftDetail(app.page, language, true);
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
        const capture = await app.page.evaluate(() => Array.from(document.querySelectorAll('.sp-content input[type="file"]')).map(i => i.getAttribute("capture")));
        expect("the problem report's photo input still opens the camera", capture.length === 1 && capture[0] === "environment", JSON.stringify(capture));
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
    id: "formsections",
    label: "Forms: a section's title is drawn above its first question, on its page and in the review, in the person's language, a section with no title draws none, and a section's help line is drawn once under its heading and not in the review",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { sectionsForm: true } });
      try {
        const form = formS(language);
        const titleOf = (key) => { const s = form.sections.find(x => x.key === key); return s ? s.title : null; };
        const helpOf = (key) => { const s = form.sections.find(x => x.key === key); return s && s.help ? s.help : null; };
        // The one help line the form carries, on section 2.
        const helpLine = helpOf("2");
        const firstOf = (key) => form.fields.find(f => f.section === key).label;
        await openTab(app.page, "forms", language);
        await pause(app.page, 900);
        const started = await startForm(app.page, form.title);
        expect("the form with titled sections opens from its card", started, "no card on the Forms screen carried its title");
        await pause(app.page, 1200);
        for (const key of ["1", "2", "3"]) {
          const heads = await formHeadings(app.page);
          const below = await labelTop(app.page, firstOf(key));
          const want = titleOf(key);
          if (want) {
            expect("section " + key + "'s title is drawn above its first question, in the person's language",
              heads.length === 1 && heads[0].text === want && below !== null && heads[0].bottom <= below, JSON.stringify(heads) + " first question at " + below);
          } else {
            expect("section " + key + ", which has no title, draws none", heads.length === 0 && below !== null, JSON.stringify(heads));
          }
          const line = await lineCount(app.page, helpLine);
          if (helpOf(key)) {
            expect("section " + key + "'s help line is drawn once, under its heading and above its first question, in the person's language",
              line.count === 1 && heads.length === 1 && line.top >= heads[0].bottom && below !== null && line.top < below, JSON.stringify(line) + " heading to " + (heads[0] && heads[0].bottom) + ", first question at " + below);
          } else {
            expect("section " + key + ", which has no help line, draws none", line.count === 0, JSON.stringify(line));
          }
          await answerEveryBox(app.page);
          await pause(app.page, 400);
          // Next on the last section opens the review.
          await clickText(app.page, say("Next", language));
          await pause(app.page, 1000);
        }
        const heads = await formHeadings(app.page);
        const tops = [];
        for (const key of ["1", "2"]) tops.push(await labelTop(app.page, firstOf(key)));
        expect("the review draws each section's title above its first question, and none for the section with no title",
          heads.map(h => h.text).join("|") === [titleOf("1"), titleOf("2")].join("|") && heads.every((h, i) => tops[i] !== null && h.bottom <= tops[i]),
          JSON.stringify(heads) + " first questions at " + JSON.stringify(tops));
        expect("the review does not repeat a section's help line", (await lineCount(app.page, helpLine)).count === 0, helpLine);
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }

      // The same form with its first section alone: one section, with a
      // title, which the form's own name already stands for. No heading
      // on its page, none in the review.
      const one = await open({ stubOptions: { sectionsForm: "one" } });
      try {
        const form = formS(language, true);
        await openTab(one.page, "forms", language);
        await pause(one.page, 900);
        const started = await startForm(one.page, form.title);
        expect("the form of one section opens from its card", started, "no card on the Forms screen carried its title");
        await pause(one.page, 1200);
        const below = await labelTop(one.page, form.fields[0].label);
        const heads = await formHeadings(one.page);
        expect("a form of one section draws no heading above its questions", heads.length === 0 && below !== null, JSON.stringify(heads));
        await answerEveryBox(one.page);
        await pause(one.page, 400);
        await clickText(one.page, say("Next", language));
        await pause(one.page, 1000);
        const reviewed = await labelTop(one.page, form.fields[0].label);
        const reviewHeads = await formHeadings(one.page);
        expect("the review of a form of one section draws no heading", reviewHeads.length === 0 && reviewed !== null, JSON.stringify(reviewHeads));
      } finally { await one.context.close(); }
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
        const rowN = (n) => say("Row {n}", language).replace("{n}", String(n));
        const rowsDrawn = (t) => (t.match(new RegExp(say("Row {n}", language).replace("{n}", "\\d"), "g")) || []).length;
        let text = await bodyText(app.page);
        expect("the table offers a row to add", text.indexOf(addRow) !== -1, text.slice(0, 200));

        // The floor, two rows, is drawn before anyone taps Add row, each
        // with its cells open, and neither offers Remove row, since the
        // table cannot do without them. Nothing is saved for a row nobody
        // has written in.
        const table = formP(language).fields.find(f => f.key === "visits");
        const cells = await app.page.evaluate(() => document.querySelectorAll(".sp-content input").length);
        expect("a table with a floor of two starts with two rows drawn",
          rowsDrawn(text) === 2 && text.indexOf(rowN(1)) !== -1 && text.indexOf(rowN(2)) !== -1, text.slice(0, 260));
        expect("both rows start open, with every cell on screen", cells >= table.columns.length * 2, cells + " boxes on screen");
        expect("a row the floor asks for offers no Remove row", text.indexOf(removeRow) === -1, text.slice(0, 260));

        // The one column with a help line: drawn once for the table, under
        // that column's label in the first row, in the person's language,
        // with two rows on screen and still once with three.
        const helped = table.columns.find(c => c.help);
        const helpLine = await lineCount(app.page, helped.help);
        const labelAt = await labelTop(app.page, helped.label);
        expect("a column's help line is drawn once for the table, under its label in the first row, in the person's language",
          helpLine.count === 1 && labelAt !== null && helpLine.top > labelAt, JSON.stringify(helpLine) + " label at " + labelAt);

        // A third row, then the fourth refused on screen.
        await clickText(app.page, addRow);
        text = await bodyText(app.page);
        const rowWord = rowN(3);
        expect("a third row is there", text.indexOf(rowWord) !== -1, text.slice(0, 260));
        expect("a column's help line is still drawn once with three rows on screen", (await lineCount(app.page, helped.help)).count === 1, JSON.stringify(await lineCount(app.page, helped.help)));
        expect("a fourth row is refused on the screen itself",
          text.indexOf(say("This table is full.", language)) !== -1 && text.indexOf(addRow) === -1, text.slice(0, 260));

        // One row taken out, which brings the table back to its floor,
        // where Remove row is not offered.
        const before = rowsDrawn(text);
        expect("a row above the floor offers Remove row", text.indexOf(removeRow) !== -1, text.slice(0, 260));
        await clickText(app.page, removeRow);
        text = await bodyText(app.page);
        const after = rowsDrawn(text);
        expect("a row comes out again", after === before - 1, "rows went from " + before + " to " + after);
        expect("back at the floor, no row offers Remove row", text.indexOf(removeRow) === -1, text.slice(0, 260));

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
        // the API's own words reach the screen. The button opens the sheet,
        // where the person draws before Sign sends anything.
        const refusal = "You cannot sign this part of the form";
        app.stub.state.refuse["POST /api/forms/responses/draft-two/signoff"] = { status: 403, body: { error: refusal }, once: true };
        await clickText(app.page, say("Sign", language));
        await pause(app.page, 700);
        expect("Sign opens the sheet to draw in", (await sheetButtons(app.page)).some(b => b.text === spanishOf("Clear", language)), JSON.stringify(await sheetButtons(app.page)));
        await drawSignature(app.page);
        await tapInSheet(app.page, say("Sign", language));
        await pause(app.page, 900);
        let sheet = await sheetText(app.page);
        expect("a refused sign-off says what the API said, word for word, in the sheet",
          sheet.indexOf(say(refusal, language)) !== -1, sheet.slice(0, 300));
        text = await bodyText(app.page);
        expect("a refused sign-off stamps nothing and keeps the sheet open",
          text.indexOf(stampStarts) === -1 && sheet !== "", text.slice(0, 300));

        // Then the real one.
        await tapInSheet(app.page, say("Sign", language));
        await pause(app.page, 1200);
        const signed = lastSent(app.stub, "POST", "/api/forms/responses/");
        expect("one press sends one sign-off, with the drawing", !!signed && signed.body && signed.body.key === "leadSign" && /^data:image\/png;base64,/.test(String(signed.body.signature || "")), JSON.stringify(signed && signed.body && signed.body.key));
        const asked = app.stub.state.calls.filter(c => /\/signoff$/.test(c.path)).length;
        expect("one press sends one request, not two", asked === 2, "requests to the sign-off route: " + asked);
        text = await bodyText(app.page);
        expect("the stamp shows the person and the time the API answered with, and the sheet is gone",
          text.indexOf(stampStarts) !== -1 && (await signButtons()) === 0 && (await sheetText(app.page)) === "", text.slice(0, 300));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "formpphotos",
    label: "Photos on a form: each refusal in the API's words, two photos added at once, one taken off, the count on the review, and the limit",
    run: async (open, language, expect, extra) => {
      const app = await open({});
      try {
        const form = formP(language);
        const q = form.fields.find(f => f.type === "photos");
        const route = "/api/forms/responses/draft-two/photos/" + q.key;
        const input = '.sp-content input[type="file"]';
        const takeLine = say("Take photo or choose from gallery", language);
        const removeWord = say("Remove photo", language);
        const removeButtons = () => app.page.evaluate((want) => Array.from(document.querySelectorAll(".sp-content button")).filter(b => b.textContent.trim() === want).length, removeWord);
        const posts = () => app.stub.state.calls.filter(c => c.method === "POST" && c.path === route);
        const thumbsDrawn = () => app.page.evaluate(() => Array.from(document.querySelectorAll(".sp-content img")).filter(i => /^blob:/.test(i.src)).map(i => { const r = i.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), i.naturalWidth > 0]; }));

        await openTab(app.page, "forms", language);
        await pause(app.page, 900);
        await startForm(app.page, form.title);
        let text = await bodyText(app.page);
        expect("the photos question draws its label and its help line, in the person's language", has(text, q.label) && has(text, q.help), text.slice(0, 400));
        expect("the question offers the camera and the gallery, with the sizes it takes", has(text, takeLine) && has(text, say("JPG, PNG up to 10MB", language)), text.slice(0, 400));
        const inputs = await app.page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map(i => [i.getAttribute("accept"), i.getAttribute("capture"), i.multiple]), input);
        expect("the input takes any picture, several at once, and names no capture, so the gallery is offered", inputs.length === 1 && inputs[0][0] === "image/*" && inputs[0][1] === null && inputs[0][2] === true, JSON.stringify(inputs));

        // Each refusal first, in the API's own words, with nothing kept.
        for (const key of ["forms.photoTooLarge", "forms.photoType", "forms.photoLimit"]) {
          const r = API_REFUSALS[key];
          app.stub.state.refuse["POST " + route] = { api: key, once: true };
          await attachPhotos(app.page, input, ["spill.jpg"]);
          await pause(app.page, 1400);
          text = await bodyText(app.page);
          const said = refusalIn(r, language, r.vars);
          const shown = has(text, said);
          expect("refusal shown: " + r.en, shown, "wanted " + JSON.stringify(said) + " in " + JSON.stringify(text.slice(0, 400)));
          if (extra) extra.refusalsShown += shown ? 1 : 0;
          expect("a refused photo draws no thumbnail: " + key, (await removeButtons()) === 0 && (await thumbsDrawn()).length === 0, "Remove photo buttons: " + (await removeButtons()));
        }
        await spokenHere(app, language, expect);

        // Two at once, uploaded on the tap as multipart photos.
        const before = posts().length;
        app.stub.state.holdMs["POST " + route] = 1500;
        await attachPhotos(app.page, input, ["one.jpg", "two.jpg"]);
        await pause(app.page, 500);
        text = await bodyText(app.page);
        expect("each photo on its way says so", (text.match(new RegExp(say("Uploading...", language).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length === 2, text.slice(0, 500));
        await pause(app.page, 2500);
        const sentUp = posts().slice(before);
        expect("a tap uploads at once, one request with both files under photos",
          sentUp.length === 1 && /^multipart\/form-data/.test(sentUp[0].headers["content-type"] || "") && Array.isArray(sentUp[0].files) && sentUp[0].files.length === 2 && sentUp[0].files.every(f => f.kind && f.kind.ext === "jpg"),
          JSON.stringify(sentUp.map(c => ({ ct: (c.headers["content-type"] || "").slice(0, 30), files: c.files }))));
        text = await bodyText(app.page);
        expect("both photos draw with their names under them", has(text, "one.jpg") && has(text, "two.jpg") && !has(text, say("Uploading...", language)), text.slice(0, 500));
        const thumbAsks = app.stub.state.calls.filter(c => c.method === "GET" && /^\/api\/forms\/responses\/draft-two\/photos\/[^/]+\/thumb$/.test(c.path));
        expect("each thumbnail is fetched through the stream route with the token", thumbAsks.length === 2 && thumbAsks.every(c => /^Bearer /.test(c.headers.authorization || "")), JSON.stringify(thumbAsks.map(c => c.path)));
        const drawn = await thumbsDrawn();
        expect("each thumbnail is drawn from memory, 72 pixels square", drawn.length === 2 && drawn.every(d => d[0] === 72 && d[1] === 72 && d[2]), JSON.stringify(drawn));
        expect("each photo offers Remove photo while the report is a draft", (await removeButtons()) === 2, "Remove photo buttons: " + (await removeButtons()));
        expect("the answer the API returned is the question's value", JSON.stringify(app.stub.state.answersP[q.key].map(p => p.name)) === JSON.stringify(["one.jpg", "two.jpg"]), JSON.stringify(app.stub.state.answersP[q.key]));
        await spokenHere(app, language, expect);

        // One taken off.
        await clickText(app.page, removeWord);
        await pause(app.page, 900);
        const gone = lastSent(app.stub, "DELETE", route + "/");
        expect("Remove photo asks the API to take that one off", !!gone && gone.path === route + "/ph-1", JSON.stringify(gone && gone.path));
        text = await bodyText(app.page);
        expect("the photo taken off is gone and the other stays", !has(text, "one.jpg") && has(text, "two.jpg") && (await removeButtons()) === 1, text.slice(0, 500));

        // A photo is never written as an answer.
        await clickText(app.page, say("Next", language));
        await pause(app.page, 900);
        const saved = app.stub.state.calls.filter(c => c.method === "PATCH" && /^\/api\/forms\/drafts\/draft-two/.test(c.path));
        expect("a save never writes the photos question", saved.every(c => !c.body || !c.body.answers || !(q.key in c.body.answers)), JSON.stringify(saved.map(c => c.body)));

        // The count on the review, and the missing list, which never
        // names a photos question.
        for (let i = 0; i < 3; i += 1) await clickText(app.page, say("Next", language));
        await pause(app.page, 900);
        text = await bodyText(app.page);
        expect("the review counts the photos: one", has(text, say("1 photo", language)) && !has(text, "two.jpg"), text.slice(0, 600));
        const missingNamed = await app.page.evaluate(() => Array.from(document.querySelectorAll(".sp-content button")).map(b => b.textContent.trim()));
        expect("the missing list never names the photos question", missingNamed.indexOf(q.label) === -1 && missingNamed.indexOf(q.label + ":") === -1, JSON.stringify(missingNamed));
        await spokenHere(app, language, expect);

        // Back to the page, then up to the limit, where the button gives
        // way to the line.
        await clickText(app.page, say("Edit", language));
        await pause(app.page, 900);
        await attachPhotos(app.page, input, ["three.jpg", "four.jpg"]);
        await pause(app.page, 1800);
        text = await bodyText(app.page);
        expect("at the limit the button gives way to the full line", has(text, say("This question is full.", language)) && !has(text, takeLine), text.slice(0, 600));
        expect("the question holds as many as it takes", (await removeButtons()) === FORM_P_MAX_PHOTOS && app.stub.state.answersP[q.key].length === FORM_P_MAX_PHOTOS, "Remove photo buttons: " + (await removeButtons()));
        for (let i = 0; i < 4; i += 1) await clickText(app.page, say("Next", language));
        await pause(app.page, 900);
        text = await bodyText(app.page);
        expect("the review counts the photos: several", has(text, fill(say("{n} photos", language), { n: FORM_P_MAX_PHOTOS })), text.slice(0, 600));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "formpsmall",
    label: "Photos on a form are made small on the phone: a broken file is refused with nothing sent, a HEIC is converted, a wide JPEG comes down to 2,000 pixels, a PNG with transparency stays a PNG, and one without becomes a JPEG",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        const form = formP(language);
        const q = form.fields.find(f => f.type === "photos");
        const route = "/api/forms/responses/draft-two/photos/" + q.key;
        const input = '.sp-content input[type="file"]';
        const posts = () => app.stub.state.calls.filter(c => c.method === "POST" && c.path === route);
        // The upload a picture ends in, waited for: a HEIC takes a while.
        const nextPost = async (from, ms) => {
          for (let i = 0; i < ms / 200; i += 1) { if (posts().length > from) { await pause(app.page, 600); return posts()[from]; } await pause(app.page, 200); }
          return null;
        };
        const fileOf = (c) => (c && Array.isArray(c.files) && c.files.length === 1 ? c.files[0] : null);
        const unreadable = spanishOf("This photo could not be read. Try another one.", language);

        await openTab(app.page, "forms", language);
        await pause(app.page, 900);
        await startForm(app.page, form.title);

        // A file that is not a picture: refused on the phone, nothing sent.
        await attachBroken(app.page, input);
        await pause(app.page, 1800);
        let text = await bodyText(app.page);
        expect("a file the phone cannot read is refused there, in the person's language", has(text, unreadable), text.slice(0, 600));
        expect("nothing is sent for a file the phone cannot read", posts().length === 0, JSON.stringify(posts().map(c => c.files)));

        // A HEIC, converted on the phone and sent as a JPEG.
        await attachBytes(app.page, input, HEIC_FIXTURE, "kitchen.heic", "image/heic");
        const heic = fileOf(await nextPost(0, 30000));
        expect("a HEIC is converted on the phone and sent as a JPEG named for it",
          !!heic && heic.kind && heic.kind.ext === "jpg" && heic.name === "kitchen.jpg", JSON.stringify(heic));
        expect("the converted picture keeps its size", !!heic && heic.size && heic.size.width === 64 && heic.size.height === 40, JSON.stringify(heic && heic.size));
        text = await bodyText(app.page);
        expect("the API's HEIC refusal is never met", !has(text, FILE_REFUSALS["forms.photoHeic"][language]) && !has(text, unreadable) && has(text, "kitchen.jpg"), text.slice(0, 600));

        // A wide JPEG comes down to the ceiling, still a JPEG.
        await attachDrawn(app.page, input, "wide.jpg", 4000, 300, false);
        const wide = fileOf(await nextPost(1, 15000));
        expect("a 4,000 pixel JPEG comes out at 2,000 on its long side, still a JPEG",
          !!wide && wide.kind && wide.kind.ext === "jpg" && wide.name === "wide.jpg" && wide.size && wide.size.width === 2000 && wide.size.height === 150, JSON.stringify(wide));

        // A PNG with something see-through stays a PNG.
        await attachDrawn(app.page, input, "clear.png", 30, 30, true);
        const clear = fileOf(await nextPost(2, 15000));
        expect("a PNG with transparency stays a PNG", !!clear && clear.kind && clear.kind.ext === "png" && clear.name === "clear.png" && clear.size && clear.size.width === 30, JSON.stringify(clear));

        // Room for one more, then a PNG with nothing see-through, which is
        // sent as a JPEG like everything else.
        await clickText(app.page, say("Remove photo", language));
        await pause(app.page, 900);
        await attachDrawn(app.page, input, "solid.png", 30, 30, false);
        const solid = fileOf(await nextPost(3, 15000));
        expect("a PNG with nothing see-through is sent as a JPEG", !!solid && solid.kind && solid.kind.ext === "jpg" && solid.name === "solid.jpg", JSON.stringify(solid));
        expect("every photo sent is inside the ceiling", posts().every(c => (c.files || []).every(f => f.size && Math.max(f.size.width, f.size.height) <= 2000)), JSON.stringify(posts().map(c => c.files)));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "formpsign",
    label: "Signing with a finger: the sheet, Sign held until something is drawn, Clear, the refusal for no drawing, a PNG at the phone's pixel ratio under 300 KB, the stamp with its drawing, and a stamp made before drawings were kept",
    run: async (open, language, expect, extra) => {
      const stampStarts = say("Signed by {name} on {date} at {time}", language).split("{")[0].trim();
      const drawnStamp = (page) => page.evaluate(() => {
        const i = Array.from(document.querySelectorAll(".sp-content img")).find(x => /^blob:/.test(x.src));
        if (!i) return null;
        const r = i.getBoundingClientRect();
        return { width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom), loaded: i.naturalWidth > 0 };
      });
      const signatureReads = (stub) => stub.state.calls.filter(c => c.method === "GET" && /^\/api\/forms\/responses\/draft-two\/signatures\//.test(c.path));
      const app = await open({});
      try {
        const form = formP(language);
        const lead = form.fields.find(f => f.key === "leadSign");
        const signWord = say("Sign", language);
        await openTab(app.page, "forms", language);
        await pause(app.page, 900);
        await startForm(app.page, form.title);
        for (let i = 0; i < 3; i += 1) await clickText(app.page, say("Next", language));
        await pause(app.page, 700);
        await clickText(app.page, signWord);
        await pause(app.page, 700);

        let sheet = await sheetText(app.page);
        let buttons = await sheetButtons(app.page);
        const signBtn = () => buttons.find(b => b.text === signWord);
        expect("Sign opens a sheet with the sign-off's label, the hint, Clear and Sign",
          has(sheet, lead.label) && has(sheet, spanishOf("Sign with your finger", language)) && buttons.some(b => b.text === spanishOf("Clear", language)) && !!signBtn(),
          sheet.slice(0, 300) + " " + JSON.stringify(buttons));
        expect("Sign waits until something is drawn", !!signBtn() && signBtn().disabled, JSON.stringify(buttons));
        const box = await signBox(app.page);
        expect("the drawing box is the width of the sheet and 160 pixels tall", !!box && box.height === 160 && box.width >= 280 && box.width <= 375, JSON.stringify(box));
        expect("the drawing is scaled to the phone's pixel ratio", !!box && box.backing[0] === box.width * 2 && box.backing[1] === 320, JSON.stringify(box));

        await drawSignature(app.page);
        buttons = await sheetButtons(app.page);
        expect("a drawing turns Sign on", !!signBtn() && !signBtn().disabled, JSON.stringify(buttons));
        await tapInSheet(app.page, spanishOf("Clear", language));
        buttons = await sheetButtons(app.page);
        expect("Clear wipes the drawing and turns Sign off again", !!signBtn() && signBtn().disabled, JSON.stringify(buttons));
        await drawSignature(app.page);

        // The refusal for a sign-off with no drawing, in the API's words.
        const r = API_REFUSALS["forms.signatureRequired"];
        app.stub.state.refuse["POST /api/forms/responses/draft-two/signoff"] = { api: "forms.signatureRequired", once: true };
        await tapInSheet(app.page, signWord);
        await pause(app.page, 900);
        sheet = await sheetText(app.page);
        buttons = await sheetButtons(app.page);
        const shown = has(sheet, r[language]);
        expect("refusal shown: " + r.en, shown, "wanted " + JSON.stringify(r[language]) + " in " + JSON.stringify(sheet.slice(0, 300)));
        if (extra) extra.refusalsShown += shown ? 1 : 0;
        expect("a refusal keeps the sheet open with the drawing", sheet !== "" && !!signBtn() && !signBtn().disabled, JSON.stringify(buttons));
        await spokenHere(app, language, expect);

        // The real one.
        await tapInSheet(app.page, signWord);
        await pause(app.page, 1500);
        const signed = lastSent(app.stub, "POST", "/api/forms/responses/draft-two/signoff");
        expect("the drawing goes up as a PNG data URL with the sign-off key",
          !!signed && signed.body && signed.body.key === "leadSign" && /^data:image\/png;base64,/.test(String(signed.body.signature || "")), JSON.stringify(signed && signed.body && Object.keys(signed.body)));
        const sig = signed && signed.signature;
        expect("the PNG is under 300 KB and drawn at the phone's pixel ratio",
          !!sig && sig.bytes <= SIGNATURE_MAX_BYTES && sig.size && sig.size.width === box.width * 2 && sig.size.height === 320, JSON.stringify(sig));
        expect("the sheet closes on the API's answer", (await sheetText(app.page)) === "", await sheetText(app.page));
        const text = await bodyText(app.page);
        expect("the stamp is drawn", has(text, stampStarts), text.slice(0, 400));
        const img = await drawnStamp(app.page);
        // The line itself, the leaf that starts with Signed by, rather
        // than the box that holds the drawing and the line together.
        const lineTop = await app.page.evaluate((want) => {
          const d = Array.from(document.querySelectorAll(".sp-content div")).find(x => x.children.length === 0 && x.innerText.replace(/\s+/g, " ").trim().indexOf(want) === 0);
          return d ? Math.round(d.getBoundingClientRect().top) : null;
        }, stampStarts);
        const reads = signatureReads(app.stub);
        expect("the stamp's drawing is fetched through the stream route with the token, about 48 pixels high, above the Signed by line",
          !!img && img.loaded && img.height === 48 && lineTop !== null && img.bottom <= lineTop + 1 && reads.length === 1 && /^Bearer /.test(reads[0].headers.authorization || ""),
          JSON.stringify(img) + " line at " + lineTop + " reads " + reads.length);
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }

      // A stamp made before drawings were kept: the line, and no picture.
      const old = await open({ stubOptions: { answersP: { leadSign: { userId: PERSON.id, name: PERSON.firstName + " " + PERSON.lastName, role: PERSON.role, at: "2026-10-01T20:00:00Z" } } } });
      try {
        await openTab(old.page, "forms", language);
        await pause(old.page, 900);
        await startForm(old.page, formP(language).title);
        for (let i = 0; i < 3; i += 1) await clickText(old.page, say("Next", language));
        await pause(old.page, 900);
        const text = await bodyText(old.page);
        expect("a stamp with no drawing reads as it always did", has(text, stampStarts), text.slice(0, 400));
        expect("a stamp with no drawing draws no picture and asks for none", (await drawnStamp(old.page)) === null && signatureReads(old.stub).length === 0, JSON.stringify(signatureReads(old.stub).map(c => c.path)));
      } finally { await old.context.close(); }
    },
  },
  // --- the customer's page, from a QR code ------------------------------
  //
  // The page stands outside the app's own content box, so these read the
  // whole document: every text box but the one nobody sees, every button
  // that reads a word, and what the phone kept.
  {
    id: "customersurvey",
    label: "A customer's survey from a QR code: opened in the phone's language with nothing of the app around it, the other language chosen and the form read again, three ratings and no name sent in one request, the thank-you with nothing left to tap, nothing kept on the phone, and no call behind the token",
    run: async (open, language, expect) => {
      const other = language === "es" ? "en" : "es";
      const nameOf = (l) => (l === "es" ? "Espa\u00f1ol" : "English");
      const app = await open({ signedIn: false, storeLanguage: false, path: "/c/link-survey" });
      try {
        const form = formV(language);
        let text = await bodyText(app.page);
        expect("the page opens in the phone's language with the company, the site and the form's title",
          has(text, PUBLIC_COMPANY) && has(text, PUBLIC_SITE) && has(text, form.title) && has(text, spanishOf("Your name", language)) && has(text, spanishOf("Your role", language)), text.slice(0, 400));
        const around = await app.page.evaluate(() => ({
          bar: Array.from(document.querySelectorAll("div")).some((el) => { const s = getComputedStyle(el); return s.position === "fixed" && s.bottom === "0px" && el.querySelectorAll(":scope > button").length >= 5; }),
          content: !!document.querySelector(".sp-content"),
          buttons: Array.from(document.querySelectorAll("button")).filter(b => b.offsetParent !== null).map(b => b.textContent.trim()),
        }));
        expect("nothing of the app is around it: no bottom bar, no header, only the language choice and the form's own buttons",
          !around.bar && !around.content && !has(text, spanishOf("Sign In", language)) && around.buttons.indexOf(say("Close", language)) === -1 && around.buttons.indexOf(nameOf(other)) !== -1, JSON.stringify(around));
        const honey = await app.page.evaluate(() => {
          const i = document.querySelector('input[name="website"]');
          if (!i) return null;
          const s = getComputedStyle(i);
          return { value: i.value, seen: s.opacity !== "0" && s.display !== "none" && s.visibility !== "hidden" };
        });
        expect("the honeypot field is on the page, empty and unseen", !!honey && honey.value === "" && !honey.seen, JSON.stringify(honey));
        await spokenHere(app, language, expect);

        // The other language: the form is read again in it.
        await clickText(app.page, nameOf(other));
        await pause(app.page, 1200);
        const reads = app.stub.state.calls.filter(c => c.method === "GET" && c.path === "/api/public/forms/link-survey");
        text = await bodyText(app.page);
        expect("choosing the other language reads the form again in it", reads.length === 2 && /locale=/.test(reads[1].search) && reads[1].search.indexOf("locale=" + other) !== -1 && has(text, formV(other).title), JSON.stringify(reads.map(c => c.search)) + " " + text.slice(0, 200));
        await clickText(app.page, nameOf(language));
        await pause(app.page, 1200);

        // The organization, leaving the name and the role empty.
        const boxes = 'input[type="text"]:not([name="website"])';
        await typeNth(app.page, boxes, 2, "An invented organization");
        await pause(app.page, 300);
        await clickText(app.page, say("Next", language));
        await pause(app.page, 700);
        // Three ratings, one in each question.
        const rated = await app.page.evaluate(() => { const on = Array.from(document.querySelectorAll("button")).filter(b => b.textContent.trim() === "3"); on.forEach(b => b.click()); return on.length; });
        expect("the three ratings can each be given", rated === 3, "buttons reading 3: " + rated);
        await pause(app.page, 400);
        await clickText(app.page, say("Next", language));
        await pause(app.page, 900);
        text = await bodyText(app.page);
        expect("the review shows the name left empty and the ratings given",
          has(text, spanishOf("Your name", language)) && has(text, say("Not answered", language)) && has(text, form.fields.find(f => f.key === "clean").label), text.slice(0, 600));
        await spokenHere(app, language, expect);

        await clickText(app.page, say("Send", language));
        await pause(app.page, 1500);
        const sentUp = lastSent(app.stub, "POST", "/api/public/forms/link-survey/responses");
        const b = sentUp && sentUp.body;
        expect("Send posts everything in one request: the answers, no name, the language and the honeypot empty",
          !!b && b.answers && b.answers.org === "An invented organization" && b.answers.clean === "3" && b.answers.crew === "3" && b.answers.response === "3"
            && b.customerName === "" && b.customerRole === "" && b.locale === language && b.website === "" && !("years" in b.answers) && !("pics" in b.answers),
          JSON.stringify(b));
        text = await bodyText(app.page);
        const left = await app.page.evaluate(() => Array.from(document.querySelectorAll("button, a[href], input, select, textarea")).filter(e => e.offsetParent !== null && getComputedStyle(e).opacity !== "0").length);
        expect("a 200 shows the thank-you with nothing else to tap", has(text, fill(spanishOf("Thank you. {company} has your form.", language), { company: PUBLIC_COMPANY })) && left === 0, text.slice(0, 300) + " controls left: " + left);
        const kept = await app.page.evaluate(() => ({ local: Object.keys(window.localStorage).filter(k => k !== "ocsa-staff-language" && k !== "ocsa-staff-text-size" && k !== "ocsa-staff-theme" && k !== "ocsa-home-screen-prompt" && k !== "ocsa-staff-ios-alerts-told" && k !== "audit-language-fresh"), session: Object.keys(window.sessionStorage).filter(k => k.indexOf("audit-") !== 0) }));
        expect("nothing is kept on the phone after Send", kept.local.length === 0 && kept.session.length === 0, JSON.stringify(kept));
        // The language list is read with no token on every page load since
        // French (part 344), and is no call behind the token.
        const behind = app.stub.state.calls.filter(c => (!/^\/api\/public\//.test(c.path) && !(c.method === "GET" && c.path === "/api/languages")) || c.headers.authorization);
        expect("the page never calls a route behind the token: 0 authenticated calls", behind.length === 0, JSON.stringify(behind.map(c => c.method + " " + c.path)));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "customerchecklist",
    label: "A customer's checklist from a QR code: the name required, the missing list, a photo kept on the phone until Send, a signature drawn with the name filled in, each refusal in the API's words where it belongs, and the filing",
    run: async (open, language, expect, extra) => {
      const app = await open({ signedIn: false, path: "/c/link-checklist" });
      try {
        const form = formC(language);
        const labelOf = (key) => form.fields.find(f => f.key === key).label;
        const boxes = 'input[type="text"]:not([name="website"])';
        const route = "POST /api/public/forms/link-checklist/responses";
        const posts = () => app.stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/public/forms/link-checklist/responses");
        const sendButton = () => app.page.evaluate((want) => { const b = Array.from(document.querySelectorAll("button")).find(x => x.textContent.trim() === want && x.offsetParent !== null); return b ? { disabled: b.disabled } : null; }, say("Send", language));
        // What the missing list names: its buttons, one per question.
        const missingNames = () => app.page.evaluate((heading) => {
          const head = Array.from(document.querySelectorAll("div")).find(d => d.children.length === 0 && d.textContent.trim() === heading);
          const box = head && head.parentElement;
          return box ? Array.from(box.querySelectorAll("button")).map(b => b.textContent.trim()) : null;
        }, say("These still need an answer", language));

        let text = await bodyText(app.page);
        const nameRow = await app.page.evaluate((want) => { const d = Array.from(document.querySelectorAll("div")).find(x => x.textContent.trim().indexOf(want) === 0 && x.children.length <= 1); return d ? d.textContent.replace(/\s+/g, " ").trim() : null; }, spanishOf("Your name", language));
        expect("the name is marked required when the form says so", !!nameRow && has(nameRow, say("Required", language)), JSON.stringify(nameRow));

        // Straight to the review: the missing list names every required
        // question by its label, and Send waits.
        await clickText(app.page, say("Next", language));
        await clickText(app.page, say("Next", language));
        await pause(app.page, 800);
        text = await bodyText(app.page);
        const named = await missingNames();
        expect("the missing list names every required question, the signature among them, and nothing that is not required",
          !!named && JSON.stringify(named) === JSON.stringify(["visited", "lobby", "restroom", "signed"].map(labelOf)), JSON.stringify(named));
        expect("Send waits while something required is missing", (await sendButton()) && (await sendButton()).disabled, JSON.stringify(await sendButton()));

        // Back to the first section, filled in.
        await clickText(app.page, say("Edit", language));
        await pause(app.page, 800);
        await typeNth(app.page, boxes, 0, "An invented customer");
        await typeNth(app.page, boxes, 1, "Facilities");
        await typeNth(app.page, boxes, 2, "The lobby and the second floor");
        const okWord = form.fields.find(f => f.key === "lobby").options[0].label;
        const picked = await app.page.evaluate((want) => { const on = Array.from(document.querySelectorAll("button")).filter(b => b.textContent.trim() === want); on.forEach(b => b.click()); return on.length; }, okWord);
        expect("both areas can be rated", picked === 2, "buttons reading the first choice: " + picked);
        await pause(app.page, 400);
        await clickText(app.page, say("Next", language));
        await pause(app.page, 800);

        // A photo, kept on the phone until Send: its own bytes are its
        // thumbnail, and nothing is posted for it.
        const before = app.stub.state.calls.length;
        await attachPhotos(app.page, 'input[type="file"]', ["hall.jpg"]);
        await pause(app.page, 1500);
        text = await bodyText(app.page);
        const thumbs = await app.page.evaluate(() => Array.from(document.querySelectorAll("img")).filter(i => /^data:image\/jpeg/.test(i.src)).map(i => { const r = i.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
        expect("a photo is kept on the phone and drawn from its own bytes, 72 pixels square, with its name", thumbs.length === 1 && thumbs[0][0] === 72 && thumbs[0][1] === 72 && has(text, "hall.jpg") && app.stub.state.calls.length === before, JSON.stringify(thumbs) + " calls since: " + (app.stub.state.calls.length - before));
        await clickText(app.page, say("Remove photo", language));
        await pause(app.page, 500);
        expect("Remove photo takes it off the page", !has(await bodyText(app.page), "hall.jpg"), (await bodyText(app.page)).slice(0, 300));
        await attachPhotos(app.page, 'input[type="file"]', ["hall.jpg"]);
        await pause(app.page, 1500);

        // The signature card: the name and role filled in from the top of
        // the form, the pad, Clear, and a drawing.
        const cardBoxes = await app.page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map(i => i.value), boxes);
        expect("the signature's name and role are filled in from the ones typed at the top", cardBoxes.length === 2 && cardBoxes[0] === "An invented customer" && cardBoxes[1] === "Facilities", JSON.stringify(cardBoxes));
        text = await bodyText(app.page);
        expect("the card draws the pad with its hint and Clear", has(text, spanishOf("Sign with your finger", language)) && has(text, spanishOf("Clear", language)), text.slice(0, 600));
        await drawSignature(app.page);
        await clickText(app.page, spanishOf("Clear", language));
        await pause(app.page, 300);
        await drawSignature(app.page);
        await clickText(app.page, say("Next", language));
        await pause(app.page, 900);
        text = await bodyText(app.page);
        const drawn = await app.page.evaluate(() => Array.from(document.querySelectorAll("img")).filter(i => /^data:image\/png/.test(i.src)).length);
        expect("the review shows the photo count, the drawing and who signed", has(text, say("1 photo", language)) && drawn === 1 && has(text, "An invented customer, Facilities") && !has(text, say("These still need an answer", language)), text.slice(0, 700));
        await spokenHere(app, language, expect);

        // Each refusal in the API's words, where it belongs: at the top
        // when it names no question, under the question when it does.
        for (const key of ["customer.nameRequired", "customer.bodyTooLarge", "customer.tooManyFilings"]) {
          app.stub.state.refuse[route] = { api: key, once: true };
          await clickText(app.page, say("Send", language));
          await pause(app.page, 1200);
          text = await bodyText(app.page);
          const said = API_REFUSALS[key][language];
          const shown = has(text, said);
          expect("refusal shown: " + API_REFUSALS[key].en, shown, "wanted " + JSON.stringify(said) + " in " + JSON.stringify(text.slice(0, 300)));
          if (extra) extra.refusalsShown += shown ? 1 : 0;
          expect("a refusal with no question keeps the review open at the top: " + key, has(text, say("Review", language)) && text.indexOf(said) < text.indexOf(say("Send", language)), text.slice(0, 300));
        }
        await spokenHere(app, language, expect);
        // One that names a question: the words go under it, on its section.
        const tooBig = FILE_REFUSALS["customer.photoTooLarge"];
        app.stub.state.refuse[route] = { status: tooBig.status, body: { error: tooBig[language], code: "customer.photoTooLarge", keys: ["pics"] }, once: true };
        await clickText(app.page, say("Send", language));
        await pause(app.page, 1200);
        text = await bodyText(app.page);
        const under = await app.page.evaluate(([label, said]) => {
          const all = Array.from(document.querySelectorAll("div")).filter(d => d.children.length === 0);
          const q = all.find(d => d.textContent.trim().indexOf(label) === 0);
          const line = all.find(d => d.textContent.trim() === said);
          return q && line ? { q: Math.round(q.getBoundingClientRect().top), line: Math.round(line.getBoundingClientRect().top) } : null;
        }, [labelOf("pics"), tooBig[language]]);
        expect("a refusal naming a question is drawn under that question, on its own section", !!under && under.line > under.q && !has(text, say("Review", language)), JSON.stringify(under) + " " + text.slice(0, 300));
        await clickText(app.page, say("Next", language));
        await pause(app.page, 800);
        // The API's own missing list, when it disagrees with the page.
        const short = FILE_REFUSALS["forms.requiredUnanswered"];
        app.stub.state.refuse[route] = { status: 400, body: { error: short[language], code: "forms.requiredUnanswered", missing: ["visited"], missingFields: [{ key: "visited", label: labelOf("visited") }] }, once: true };
        await clickText(app.page, say("Send", language));
        await pause(app.page, 1200);
        text = await bodyText(app.page);
        expect("the API's missing list replaces the page's own, in the API's words", has(text, short[language]) && has(text, say("These still need an answer", language)) && has(text, labelOf("visited")), text.slice(0, 500));
        await clickText(app.page, say("Edit", language));
        await pause(app.page, 800);
        await clickText(app.page, say("Next", language));
        await clickText(app.page, say("Next", language));
        await pause(app.page, 900);

        // The filing.
        const n = posts().length;
        await clickText(app.page, say("Send", language));
        await pause(app.page, 1800);
        const went = posts()[n];
        const b = went && went.body;
        const read = went && went.read;
        expect("Send posts the name, the role, every answer, the photo as a data URL and the signature as a PNG",
          !!b && b.customerName === "An invented customer" && b.customerRole === "Facilities" && b.answers.visited === "The lobby and the second floor" && b.answers.lobby === "ok" && b.answers.restroom === "ok"
            && Array.isArray(b.answers.pics) && b.answers.pics.length === 1 && b.answers.pics[0].name === "hall.jpg" && /^data:image\/jpeg;base64,/.test(b.answers.pics[0].data)
            && b.answers.signed && b.answers.signed.name === "An invented customer" && b.answers.signed.role === "Facilities" && /^data:image\/png;base64,/.test(b.answers.signed.signature) && b.website === "",
          JSON.stringify(b && Object.assign({}, b, { answers: Object.assign({}, b.answers, { pics: "...", signed: "..." }) })));
        expect("what the API read off the body is a small JPEG and a PNG under 300 KB",
          !!read && read.pics && read.pics[0].kind.ext === "jpg" && Math.max(read.pics[0].size.width, read.pics[0].size.height) <= 2000 && read.signed && read.signed.bytes <= SIGNATURE_MAX_BYTES && read.signed.size && read.signed.size.height === 320,
          JSON.stringify(read));
        text = await bodyText(app.page);
        expect("a 200 shows the thank-you", has(text, fill(spanishOf("Thank you. {company} has your form.", language), { company: PUBLIC_COMPANY })), text.slice(0, 300));
        const behind = app.stub.state.calls.filter(c => (!/^\/api\/public\//.test(c.path) && !(c.method === "GET" && c.path === "/api/languages")) || c.headers.authorization);
        expect("the page never calls a route behind the token: 0 authenticated calls", behind.length === 0, JSON.stringify(behind.map(c => c.method + " " + c.path)));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "customerclosed",
    label: "A customer link that is closed, one that names nothing, and one asked too often: the API's one line each, nothing else on the page, and the line read again in the other language",
    run: async (open, language, expect, extra) => {
      const other = language === "es" ? "en" : "es";
      const nameOf = (l) => (l === "es" ? "Espa\u00f1ol" : "English");
      const cases = [
        { path: "/c/link-closed", key: "customer.linkClosed", stubOptions: {} },
        { path: "/c/no-such-link", key: "customer.linkUnknown", stubOptions: {} },
        { path: "/c/link-survey", key: "customer.tooManyRequests", stubOptions: { refuse: { "GET /api/public/forms/link-survey": { api: "customer.tooManyRequests" } } } },
      ];
      for (const c of cases) {
        const app = await open({ signedIn: false, path: c.path, stubOptions: c.stubOptions });
        try {
          const said = API_REFUSALS[c.key];
          let text = await bodyText(app.page);
          const shown = has(text, said[language]);
          expect("refusal shown: " + said.en, shown, "wanted " + JSON.stringify(said[language]) + " in " + JSON.stringify(text.slice(0, 300)));
          if (extra) extra.refusalsShown += shown ? 1 : 0;
          const left = await app.page.evaluate(() => Array.from(document.querySelectorAll("button, a[href], input, select, textarea")).filter(e => e.offsetParent !== null && getComputedStyle(e).opacity !== "0").map(e => e.textContent.trim()));
          // The text size pill sits beside the language choice from Step 184 on.
          const pill = "A" + say("Text size", language);
          expect("nothing else is on the page but the language choice and the text size pill: " + c.key, left.length === 3 && left.indexOf(nameOf(language)) !== -1 && left.indexOf(nameOf(other)) !== -1 && left.indexOf(pill) !== -1 && has(text, PUBLIC_COMPANY) === false, JSON.stringify(left));
          await spokenHere(app, language, expect);
          await clickText(app.page, nameOf(other));
          await pause(app.page, 1200);
          text = await bodyText(app.page);
          expect("the line is read again in the other language: " + c.key, has(text, said[other]) && !has(text, said[language]), text.slice(0, 300));
          const behind = app.stub.state.calls.filter(c2 => (!/^\/api\/public\//.test(c2.path) && !(c2.method === "GET" && c2.path === "/api/languages")) || c2.headers.authorization);
          expect("no call behind the token: " + c.key, behind.length === 0, JSON.stringify(behind.map(c2 => c2.method + " " + c2.path)));
        } finally { await app.context.close(); }
      }
    },
  },
  {
    id: "formpnumber",
    label: "A number on a staff form: one box that takes a minus sign and a decimal point, saved as a number, shown on the review as typed, an empty box saving nothing, and the API's refusal under the question",
    run: async (open, language, expect, extra) => {
      const app = await open({});
      try {
        const form = formP(language);
        const q = form.fields.find(f => f.type === "number");
        await openTab(app.page, "forms", language);
        await pause(app.page, 900);
        await startForm(app.page, form.title);
        await clickText(app.page, say("Next", language));
        await clickText(app.page, say("Next", language));
        await pause(app.page, 700);
        let text = await bodyText(app.page);
        expect("the number draws its label and help line, in the person's language", has(text, q.label) && has(text, q.help), text.slice(0, 400));
        const box = await app.page.evaluate(() => { const i = Array.from(document.querySelectorAll(".sp-content input")).find(x => x.getAttribute("inputmode") === "decimal"); return i ? { type: i.type, mode: i.getAttribute("inputmode") } : null; });
        expect("the box asks the phone for a number keyboard", !!box && box.mode === "decimal", JSON.stringify(box));
        const typeNumber = (v) => app.page.evaluate((val) => {
          const i = Array.from(document.querySelectorAll(".sp-content input")).find(x => x.getAttribute("inputmode") === "decimal");
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(i, val);
          i.dispatchEvent(new Event("input", { bubbles: true }));
          return i.value;
        }, v);
        const refused = await typeNumber("abc");
        expect("letters are not taken", refused === "", JSON.stringify(refused));
        await typeNumber("-2.5");
        await pause(app.page, 300);
        await clickText(app.page, say("Next", language));
        await pause(app.page, 900);
        const saved = lastSent(app.stub, "PATCH", "/api/forms/drafts/draft-two");
        expect("a minus and a decimal save as a number", !!saved && saved.body && saved.body.answers && saved.body.answers[q.key] === -2.5 && typeof saved.body.answers[q.key] === "number", JSON.stringify(saved && saved.body));
        await clickText(app.page, say("Next", language));
        await pause(app.page, 900);
        text = await bodyText(app.page);
        expect("the review shows the number as typed", has(text, q.label + " -2.5"), text.slice(0, 600));
        // Back, emptied: nothing saved for it.
        await clickText(app.page, say("Back", language));
        await pause(app.page, 700);
        await clickText(app.page, say("Back", language));
        await pause(app.page, 700);
        await typeNumber("");
        await pause(app.page, 300);
        await clickText(app.page, say("Next", language));
        await pause(app.page, 900);
        const emptied = lastSent(app.stub, "PATCH", "/api/forms/drafts/draft-two");
        expect("an empty box saves nothing", !!emptied && emptied.body && emptied.body.answers && emptied.body.answers[q.key] === null && app.stub.state.answersP[q.key] === undefined, JSON.stringify(emptied && emptied.body));
        // The API's refusal, under the question.
        await clickText(app.page, say("Back", language));
        await pause(app.page, 700);
        await typeNumber("7");
        const r = API_REFUSALS["forms.badNumber"];
        app.stub.state.refuse["PATCH /api/forms/drafts/draft-two"] = { status: r.status, body: { error: r[language], code: "forms.badNumber", keys: [q.key] }, once: true };
        await clickText(app.page, say("Next", language));
        await pause(app.page, 900);
        // The words are drawn at the top as well, as every save refusal
        // is; the one under the question is the one looked for.
        const under = await app.page.evaluate(([label, said]) => {
          const all = Array.from(document.querySelectorAll(".sp-content div")).filter(d => d.children.length === 0);
          const qd = all.find(d => d.textContent.trim().indexOf(label) === 0);
          const lines = all.filter(d => d.textContent.trim() === said).map(d => Math.round(d.getBoundingClientRect().top));
          return qd ? { q: Math.round(qd.getBoundingClientRect().top), lines: lines } : null;
        }, [q.label, r[language]]);
        const shown = !!under && under.lines.some(top => top > under.q);
        expect("refusal shown: " + r.en, shown, JSON.stringify(under) + " " + (await bodyText(app.page)).slice(0, 300));
        if (extra) extra.refusalsShown += shown ? 1 : 0;
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "formpcustomersig",
    label: "A customer's signature on a staff form: the card with Name, Role and the pad, each refusal in the API's words under the card, a signature saved, shown with its drawing and the API's line, cleared, and saved again",
    run: async (open, language, expect, extra) => {
      const app = await open({});
      try {
        const form = formP(language);
        const q = form.fields.find(f => f.type === "customer_signature");
        const route = "POST /api/forms/drafts/draft-two/customer-signature";
        const posts = () => app.stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/forms/drafts/draft-two/customer-signature");
        const saveWord = spanishOf("Save signature", language);
        const cardBoxes = () => app.page.evaluate(() => Array.from(document.querySelectorAll(".sp-content input[type=\"text\"]")).map(i => i.value));
        const typeCard = (n, v) => typeNth(app.page, ".sp-content input[type=\"text\"]", n, v);
        await openTab(app.page, "forms", language);
        await pause(app.page, 900);
        await startForm(app.page, form.title);
        for (let i = 0; i < 3; i += 1) await clickText(app.page, say("Next", language));
        await pause(app.page, 700);
        let text = await bodyText(app.page);
        expect("the card draws Name, Role, the pad, its hint, Clear and Save signature",
          has(text, q.label) && has(text, spanishOf("Name", language)) && has(text, spanishOf("Role", language)) && has(text, spanishOf("Sign with your finger", language)) && has(text, saveWord) && (await cardBoxes()).length === 2, text.slice(0, 500));
        const saved = () => app.stub.state.calls.filter(c => c.method === "PATCH" && /^\/api\/forms\/drafts\/draft-two/.test(c.path));

        // Each refusal, in the API's words under the card.
        const underCard = async (said) => app.page.evaluate(([label, want]) => {
          const all = Array.from(document.querySelectorAll(".sp-content div")).filter(d => d.children.length === 0);
          const qd = all.find(d => d.textContent.trim().indexOf(label) === 0);
          const line = all.find(d => d.textContent.trim() === want);
          return !!qd && !!line && line.getBoundingClientRect().top > qd.getBoundingClientRect().top;
        }, [q.label, said]);
        // The count of refusals shown credits each one once: the name and
        // the drawing refusals are counted by the customer's page and the
        // sign sheet, so only the one nobody else meets is counted here.
        const meet = async (key, extraBody) => {
          const r = API_REFUSALS[key] || FILE_REFUSALS[key];
          if (extraBody) app.stub.state.refuse[route] = { status: r.status, body: Object.assign({ error: r[language], code: key }, extraBody), once: true };
          await clickText(app.page, saveWord);
          await pause(app.page, 1000);
          const shown = await underCard(r[language]);
          expect("refusal shown: " + r.en, shown, JSON.stringify(r[language]) + " in " + (await bodyText(app.page)).slice(0, 400));
          if (extra && key === "forms.notACustomerSignature") extra.refusalsShown += shown ? 1 : 0;
        };
        // No name yet: the API's own refusal, with nothing invented here.
        await meet("customer.nameRequired");
        await typeCard(0, "An invented visitor");
        await typeCard(1, "Office manager");
        await meet("forms.signatureRequired");
        await drawSignature(app.page);
        await meet("forms.notACustomerSignature", {});
        await meet("forms.signatureInvalid", {});
        await spokenHere(app, language, expect);

        // Saved: one request with the name, the role and the PNG; the card
        // shows the drawing and the API's line.
        const n = posts().length;
        await clickText(app.page, saveWord);
        await pause(app.page, 1500);
        const went = posts()[n];
        expect("Save signature sends the name, the role and the PNG to the customer signature route",
          !!went && went.body && went.body.key === q.key && went.body.name === "An invented visitor" && went.body.role === "Office manager" && /^data:image\/png;base64,/.test(String(went.body.signature || "")) && went.signature && went.signature.bytes <= SIGNATURE_MAX_BYTES,
          JSON.stringify(went && Object.assign({}, went.body, { signature: "..." })));
        expect("a save of the draft never writes the customer signature", saved().every(c => !c.body || !c.body.answers || !(q.key in c.body.answers)), JSON.stringify(saved().map(c => c.body)));
        text = await bodyText(app.page);
        const line = customerLine(app.stub.state.answersP[q.key], language);
        const img = await app.page.evaluate(() => { const i = Array.from(document.querySelectorAll(".sp-content img")).find(x => /^blob:/.test(x.src)); if (!i) return null; const r = i.getBoundingClientRect(); return { height: Math.round(r.height), loaded: i.naturalWidth > 0 }; });
        const reads = app.stub.state.calls.filter(c => c.method === "GET" && c.path === "/api/forms/responses/draft-two/signatures/" + q.key);
        expect("the card shows the drawing, fetched through the stream route, and the API's line", has(text, line) && !!img && img.loaded && img.height === 48 && reads.length === 1, JSON.stringify(img) + " reads " + reads.length + " " + text.slice(0, 400));
        expect("the card offers Clear to sign again and Save signature no longer", has(text, spanishOf("Clear", language)) && !has(text, saveWord), text.slice(0, 400));

        // Cleared and saved again: a new drawing replaces the old.
        await clickText(app.page, spanishOf("Clear", language));
        await pause(app.page, 500);
        text = await bodyText(app.page);
        expect("Clear opens the card again, empty", has(text, saveWord) && (await cardBoxes()).every(v => v === "") && !has(text, line), text.slice(0, 400));
        await typeCard(0, "Another invented visitor");
        await drawSignature(app.page);
        await clickText(app.page, saveWord);
        await pause(app.page, 1500);
        const again = posts()[n + 1];
        text = await bodyText(app.page);
        expect("a new save replaces the old", !!again && again.body.name === "Another invented visitor" && app.stub.state.answersP[q.key].name === "Another invented visitor" && has(text, customerLine(app.stub.state.answersP[q.key], language)), JSON.stringify(again && again.body && again.body.name) + " " + text.slice(0, 400));
        await spokenHere(app, language, expect);
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
        // The table's rows were drawn for its floor and never written in,
        // so nothing was saved for them, and the API names the first row
        // it is short the way it always has.
        const visits = formP(language).fields.find(f => f.key === "visits");
        expect("nothing is saved for a row drawn for the floor that nobody wrote in", app.stub.state.answersP.visits === undefined, JSON.stringify(app.stub.state.answersP.visits));
        expect("the missing list names the first row a table with a floor is short",
          text.indexOf(visits.label + ": " + say("Row {n}", language).replace("{n}", "1")) !== -1, text.slice(0, 400));
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
        expect("the question goes to the streaming route with the body and the headers the message route has always had, and the screen's language as its query",
          // requestId, the send's own id since Sept 29 (39db671, retries
          // land once), is part of the body (part 344).
          sentAsAlways(asked, ["text", "app", "locale", "requestId"], language) && asked.body.locale === language && asked.body.app === "portal" && typeof asked.body.requestId === "string" && asked.body.requestId.length > 0, sentWith(asked));
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
      // Each refusal in the language the request asks for, the way the
      // API writes one: the stub serves the twin before the stream opens,
      // and the case hands the stream the same words for an error part way.
      const said = (r) => (language === "es" ? TWIN_ES.get(r.error) : r.error);
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
          has(refused, say("Not sent.", language) + " " + said(busy)) && (await retryShown(app.page)), refused.slice(-240));
        await clickText(app.page, say("Retry", language));
        await answerDone(app.page, 6000);
        const again = await waitForMessage(app.page, "store room", 1000);
        expect("Retry asks again and the answer comes", !!again && lastSent(app.stub, "POST", "/api/agent/message").path === "/api/agent/message/stream", sentWith(lastSent(app.stub, "POST", "/api/agent/message")));

        // An error part way: what was written is taken away, and the
        // question is shown failed with the error's own words.
        app.stub.state.help.next = { answer: "spill", error: { after: 3, status: unfinished.status, error: said(unfinished) }, holds: { partway: 2 } };
        await askHelp(app.page, language, "What about a big spill");
        await heldAt(app, "partway");
        const partway = await waitForMessage(app.page, "Put a wet fl", 3000);
        expect("the answer shows as it is written until the error", !!partway, "nothing was drawn while the answer was being written");
        letGo(app, "partway");
        await pause(app.page, 1400);
        const failed = await bodyText(app.page);
        expect("an error part way is shown the way a refusal with its status always is",
          has(failed, say("Not sent.", language) + " " + said(unfinished)) && (await retryShown(app.page)), failed.slice(-240));
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
    id: "helpsources",
    label: "Help: the line under an answer names a guide or a reference entry in words, each once, and keeps an OCSA document's code",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "agent", language);
        await pause(app.page, 800);
        const based = say("Based on", language);
        const cases = [
          { what: "the app guide", cited: ["APP-PORTAL"], names: [say("the app guide", language)] },
          { what: "a reference entry", cited: [SOURCE_REF], names: [say("general cleaning guidance", language)] },
          { what: "the ADP guide", cited: ["APP-ADP"], names: [say("the ADP guide", language)] },
          { what: "two guide codes", cited: ["APP-PORTAL", "APP-DASHBOARD"], names: [say("the app guide", language)] },
          { what: "an OCSA document beside a guide", cited: [SOURCE_DOC, "APP-DASHBOARD"], names: [SOURCE_DOC, say("the app guide", language)] },
        ];
        for (const c of cases) {
          app.stub.state.help.next = { citedDocs: c.cited, pauseMs: 20 };
          await askHelp(app.page, language, "Where is " + c.what);
          await answerDone(app.page, 6000);
          await pause(app.page, 300);
          const lines = await sourceLines(app.page, based);
          const last = lines.length ? lines[lines.length - 1] : "";
          const want = based + " " + c.names.join(", ");
          expect("an answer citing " + c.what + " reads " + JSON.stringify(want), last === want, JSON.stringify(last));
          expect("an answer citing " + c.what + " shows no guide or reference code", !/\b(APP|REF)-/.test(last), JSON.stringify(last));
        }
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "helprate",
    label: "Rating an answer, and names under it: Yes, then No with a note, each told to the API and thanked, the conversation read back with the second rating on it, a refusal in the API's words under the choices, and the sources named by the API's own names",
    run: async (open, language, expect, extra) => {
      // The rating row under the last answer: whether each choice reads as
      // chosen, and the lines under them.
      const rateRow = (page) => page.evaluate(([yes, no, ask]) => {
        const label = Array.from(document.querySelectorAll(".sp-content span")).filter(s => s.textContent.trim() === ask).pop();
        if (!label) return null;
        const holder = label.parentElement.parentElement;
        const b = (w) => Array.from(holder.querySelectorAll("button")).find(x => x.textContent.trim() === w);
        return {
          yes: b(yes) ? b(yes).getAttribute("aria-pressed") : null,
          no: b(no) ? b(no).getAttribute("aria-pressed") : null,
          box: !!holder.querySelector("textarea"),
          lines: Array.from(holder.children).slice(1).map(x => x.innerText.replace(/\s+/g, " ").trim()).filter(Boolean),
          alert: (Array.from(holder.querySelectorAll('[role="alert"]')).pop() || { textContent: "" }).textContent.trim(),
        };
      }, [spanishOf("Yes", language), spanishOf("No", language), spanishOf("Was this helpful?", language)]);
      const tapInRow = (page, words) => page.evaluate(([w, ask]) => {
        const label = Array.from(document.querySelectorAll(".sp-content span")).filter(s => s.textContent.trim() === ask).pop();
        const b = label && Array.from(label.parentElement.parentElement.querySelectorAll("button")).find(x => x.textContent.trim() === w);
        if (b) b.click();
        return !!b;
      }, [words, spanishOf("Was this helpful?", language)]);
      const ratings = (stub) => stub.state.calls.filter(c => c.method === "POST" && /^\/api\/agent\/messages\/[^/]+\/feedback$/.test(c.path));
      const thanks = spanishOf("Thanks. This helps Help get better.", language);
      // Invented titles for two sources, the first named by the library and
      // the second left empty, which falls back to the portal's own words.
      const guide = language === "es" ? "Gu\u00eda del portal del personal" : "Staff portal guide";
      const app = await open({ stubOptions: { drafts: [{ id: "draft-one", formName: "Incident report", answered: 1, remaining: 4, conversationId: "cv-one" }] } });
      try {
        await openTab(app.page, "agent", language);
        await pause(app.page, 800);
        app.stub.state.help.next = { citedDocs: ["APP-PORTAL", SOURCE_REF], citedNames: [{ code: "APP-PORTAL", name: guide }, { code: SOURCE_REF, name: "" }], pauseMs: 20 };
        await askHelp(app.page, language, "Where do the floor pads go");
        await answerDone(app.page, 6000);
        await pause(app.page, 500);
        const lines = await sourceLines(app.page, say("Based on", language));
        expect("the sources are named by the API's own names, one left empty falling back to the portal's words", lines.pop() === say("Based on", language) + " " + guide + ", " + say("general cleaning guidance", language), JSON.stringify(lines));
        let row = await rateRow(app.page);
        expect("an answer the API gave an id asks Was this helpful?, with neither choice made", !!row && row.yes === "false" && row.no === "false", JSON.stringify(row));
        await spokenHere(app, language, expect);

        await tapInRow(app.page, spanishOf("Yes", language));
        await pause(app.page, 800);
        const first = ratings(app.stub).pop();
        row = await rateRow(app.page);
        expect("Yes rates at once, and the thanks line shows with Yes drawn as chosen", !!first && first.body.helpful === true && first.body.note === undefined && !!row && row.yes === "true" && row.lines.indexOf(thanks) !== -1, (first ? JSON.stringify(first.body) : "nothing sent") + " " + JSON.stringify(row));

        await tapInRow(app.page, spanishOf("No", language));
        await pause(app.page, 500);
        row = await rateRow(app.page);
        expect("No opens a box for what was missing", !!row && row.box, JSON.stringify(row));
        await type(app.page, '.sp-content textarea[aria-label="' + spanishOf("What was missing?", language) + '"]', "It did not say which floor");
        await pause(app.page, 300);
        await tapInRow(app.page, spanishOf("Send", language));
        await pause(app.page, 900);
        const second = ratings(app.stub).pop();
        row = await rateRow(app.page);
        expect("Send rates again with the note, and No is drawn as chosen", !!second && second.body.helpful === false && second.body.note === "It did not say which floor" && !!row && row.no === "true" && row.yes === "false" && row.lines.indexOf(thanks) !== -1, (second ? JSON.stringify(second.body) : "nothing sent") + " " + JSON.stringify(row));
        expect("both ratings name the same answer", ratings(app.stub).length === 2 && ratings(app.stub)[0].path === ratings(app.stub)[1].path, JSON.stringify(ratings(app.stub).map(c => c.path)));

        // The conversation read back: the answer shows the rating it carries.
        await tapWords(app.page, say("Resume", language));
        await pause(app.page, 1500);
        const kept = app.stub.state.stored.filter(m => m.role === "assistant").pop();
        row = await rateRow(app.page);
        expect("the conversation read back carries the second rating and its note", !!kept && !!kept.feedback && kept.feedback.helpful === false && kept.feedback.note === "It did not say which floor", JSON.stringify(kept && kept.feedback));
        expect("and the answer read back is drawn with No chosen and the thanks line", !!row && row.no === "true" && row.lines.indexOf(thanks) !== -1, JSON.stringify(row));

        // A rating the API turns away shows its words under the choices.
        app.stub.state.refuse[ratings(app.stub)[0].method + " " + ratings(app.stub)[0].path] = { api: "help.messageNotFound", once: true };
        await tapInRow(app.page, spanishOf("Yes", language));
        await pause(app.page, 800);
        row = await rateRow(app.page);
        const refused = refusalIn(API_REFUSALS["help.messageNotFound"], language);
        const shown = !!row && row.alert === refused;
        expect("a rating turned away shows the API's words under the choices", shown, JSON.stringify(row));
        if (extra) extra.refusalsShown += shown ? 1 : 0;
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "helpdiscard",
    label: "Discarding a report Help started: from its card and from a row, each asked first and gone from the list, the list read again with neither on it, and a Discard the API turns away said in its words",
    run: async (open, language, expect, extra) => {
      const DRAFTS = [
        { id: "draft-one", formName: "Incident report", answered: 1, remaining: 4, conversationId: "cv-one" },
        { id: "draft-two", formName: "Site walk", answered: 2, remaining: 6, conversationId: "cv-one" },
      ];
      const asked = [];
      const discards = (stub) => stub.state.calls.filter(c => c.method === "POST" && /^\/api\/forms\/drafts\/[^/]+\/discard$/.test(c.path)).map(c => c.path.split("/")[4]);
      const rowNames = (page) => page.evaluate((head) => {
        const h = Array.from(document.querySelectorAll(".sp-content div")).find(d => d.children.length === 0 && d.textContent.trim() === head);
        return h ? Array.from(h.parentElement.children).slice(1).map(r => r.innerText.split("\n")[0].trim()) : [];
      }, spanishOf("Unfinished reports", language));
      const discardRow = (page, name) => page.evaluate(([want, word]) => {
        const r = Array.from(document.querySelectorAll(".sp-content div")).find(d => d.children.length > 1 && d.innerText.split("\n")[0].trim() === want && Array.from(d.children).some(c => c.tagName === "BUTTON" && c.textContent.trim() === word));
        const b = r && Array.from(r.children).find(c => c.tagName === "BUTTON" && c.textContent.trim() === word);
        if (b) b.click();
        return !!b;
      }, [name, spanishOf("Discard", language)]);
      const app = await open({ stubOptions: { drafts: DRAFTS } });
      app.page.on("dialog", (d) => asked.push(d.message()));
      try {
        await openTab(app.page, "agent", language);
        await pause(app.page, 900);
        app.stub.state.help.next = { answer: "report" };
        await askHelp(app.page, language, "Someone slipped in the hall");
        await answerDone(app.page, 6000);
        await pause(app.page, 600);
        // The card's own Discard, asked first, then the discard route.
        const onCard = await app.page.evaluate(([card, word]) => {
          const h = Array.from(document.querySelectorAll(".sp-content div")).find(d => d.children.length === 0 && d.textContent.trim() === card);
          let box = h;
          for (let i = 0; i < 4 && box && !Array.from(box.querySelectorAll("button")).some(b => b.textContent.trim() === word); i += 1) box = box.parentElement;
          const b = box && Array.from(box.querySelectorAll("button")).find(x => x.textContent.trim() === word);
          if (b) b.click();
          return !!b;
        }, [spanishOf("Report in progress", language), spanishOf("Discard", language)]);
        await pause(app.page, 1000);
        expect("the report in progress carries Discard", onCard, (await bodyText(app.page)).slice(-240));
        expect("Discard asks first, in the person's language", asked[0] === spanishOf("Discard this report? It will not be sent.", language), JSON.stringify(asked));
        expect("Discard on the card discards the card's report and clears the card", JSON.stringify(discards(app.stub)) === JSON.stringify(["draft-one"]) && !has(await bodyText(app.page), spanishOf("Report in progress", language)), JSON.stringify(discards(app.stub)));
        expect("Report discarded. is said", has((await toastText(app.page)) + " " + (await bodyText(app.page)), spanishOf("Report discarded.", language)), await toastText(app.page));
        await noToast(app.page);
        // A row's Discard.
        await discardRow(app.page, servedIn("Site walk", language));
        await pause(app.page, 1000);
        expect("Discard on a row discards that report and the row leaves the list", JSON.stringify(discards(app.stub)) === JSON.stringify(["draft-one", "draft-two"]) && (await rowNames(app.page)).length === 0, JSON.stringify(await rowNames(app.page)));
        // The list read again, as a new visit to Help reads it.
        await openTab(app.page, "settings", language);
        await pause(app.page, 600);
        const reads = sent(app.stub, "GET", "/api/agent/drafts").length;
        await openTab(app.page, "agent", language);
        await pause(app.page, 1200);
        expect("the list read again holds neither report", sent(app.stub, "GET", "/api/agent/drafts").length > reads && (await rowNames(app.page)).length === 0, JSON.stringify(await rowNames(app.page)));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }

      // A row this phone still shows, whose report was discarded on another
      // phone, and one whose report is gone: each Discard is turned away in
      // the API's words, and the list is read again.
      for (const [key, behind] of [["forms.notADraft", (st) => { st.discarded.push("draft-two"); st.drafts = st.drafts.filter(d => d.id !== "draft-two"); }], ["forms.reportNotFound", (st) => { st.drafts = st.drafts.filter(d => d.id !== "draft-two"); }]]) {
        const stale = await open({ stubOptions: { drafts: [DRAFTS[1]] } });
        try {
          await openTab(stale.page, "agent", language);
          await pause(stale.page, 1000);
          behind(stale.stub.state);
          const reads = sent(stale.stub, "GET", "/api/agent/drafts").length;
          await discardRow(stale.page, servedIn("Site walk", language));
          await pause(stale.page, 1000);
          const told = await toastText(stale.page);
          const words = refusalIn(API_REFUSALS[key], language);
          const shown = has(told, words);
          expect("a Discard turned away with " + key + " says the API's words", shown, JSON.stringify(told));
          if (extra) extra.refusalsShown += shown ? 1 : 0;
          expect("and the list is read again, without the row", sent(stale.stub, "GET", "/api/agent/drafts").length > reads && (await rowNames(stale.page)).length === 0, JSON.stringify(await rowNames(stale.page)));
          await spokenHere(stale, language, expect);
        } finally { await stale.context.close(); }
      }
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
            return active ? active.textContent.trim().replace(/^(9\+|\d+)/, "") : "under More";
          });
          expect("a " + subject + " notice opens " + tab, !!on, String(on));
        } finally { await app.context.close(); }
      }
    },
  },
  {
    // Part 344: every subject type the audit contract's section 3 names,
    // one notice each, tapped on a supervisor's bell, since a supervisor
    // reads every tab a notice can open. A tap either leaves the bell for
    // a place of the portal's own, offers Open in the dashboard on its row,
    // or does nothing but mark it read. EVERY_NOTICE in stub.js says which
    // the contract asks of each (section 2.6), and a notice of a type the
    // portal has never heard of is left on the bell with nothing broken.
    id: "everynotice",
    label: "Every notice type on the bell: each tap opens its own place in the portal, or offers the dashboard for what the office works there, and a type the portal does not know is marked read with nothing broken",
    run: async (open, language, expect) => {
      const SUP = Object.assign({}, ADMIN_PERSON, { id: "u-every-sup", role: "supervisor" });
      const rows = EVERY_NOTICE.concat([{ type: "a_type_from_tomorrow", want: "nothing", notice: { id: "n-every-x", subjectType: "a_type_from_tomorrow", subjectId: "x-1", title: "Invented notice of a type the portal does not know", body: "An invented notice.", link: null, createdAt: "2026-10-01T19:00:00.000Z", readAt: null } }]);
      for (const r of rows) {
        const app = await open({ stubOptions: { person: SUP, notifications: [Object.assign({}, r.notice)] } });
        try {
          await app.page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(x => /notification|notificaci/i.test(x.getAttribute("aria-label") || "")), null, { timeout: 8000 }).catch(() => {});
          await app.page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find(x => /notification|notificaci/i.test(x.getAttribute("aria-label") || "")); if (b) b.click(); });
          const listed = await app.page.waitForFunction((t) => Array.from(document.querySelectorAll("button")).some(b => b.innerText.indexOf(t) !== -1), r.notice.title, { timeout: 6000 }).then(() => true).catch(() => false);
          if (!listed) { expect("a " + r.type + " notice is listed on the bell", false, (await bodyText(app.page)).slice(0, 160)); continue; }
          const dash = say("Open in the dashboard", language);
          const onRow = await app.page.evaluate((x) => { const b = Array.from(document.querySelectorAll("button")).find(y => y.innerText.indexOf(x.title) !== -1); const row = b && b.parentElement; return !!row && Array.from(row.querySelectorAll("button")).some(y => y.innerText.trim() === x.dash); }, { title: r.notice.title, dash: dash });
          await app.page.evaluate((t) => { const b = Array.from(document.querySelectorAll("button")).find(x => x.innerText.indexOf(t) !== -1); if (b) b.click(); }, r.notice.title);
          await pause(app.page, 900);
          const bellUp = await app.page.evaluate((w) => Array.from(document.querySelectorAll("button")).some(b => b.innerText.trim() === w), say("Mark all read", language));
          const ours = !bellUp ? "place" : onRow ? "dashboard" : "nothing";
          const read = sent(app.stub, "POST", "/api/notifications/" + r.notice.id + "/read").length;
          const broken = app.problems.filter(p => /^pageerror/.test(p));
          const said = { place: "opens a place of its own in the portal", dashboard: "offers Open in the dashboard on its row", nothing: "is marked read and left on the bell" };
          expect("a " + r.type + " notice " + said[r.want], ours === r.want && read === 1, "the tap " + said[ours] + ", " + read + " read posts");
          expect("a " + r.type + " notice breaks nothing", broken.length === 0, broken.join(" | "));
        } finally { await app.context.close(); }
      }
    },
  },
  {
    id: "notifplace",
    label: "The bell and the phone open the right place: a chat notice and a tag notice open Chat on their chat, an announcement opens its sheet in the screen's language with who sent it and when, a tapped phone alert lands where the bell would, and ?open= at start opens the sheet once the person is in, and never twice",
    run: async (open, language, expect) => {
      const notice = (id, subjectType, subjectId, title) => ({ id: id, subjectType: subjectType, subjectId: subjectId, title: title, body: "An invented notice.", link: null, createdAt: "2026-10-01T18:00:00.000Z", readAt: null, count: 1 });
      const NOTICES = [
        notice("n-chat", "chat", "ch-north", "New messages in North Building"),
        notice("n-tag", "chat_mention", "ch-north", "Sam Second tagged you in North Building"),
        notice("n-ann", "announcement", ANNOUNCEMENT.id, "An announcement from the office"),
      ];
      const openBell = (page) => page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find(x => /notification|notificaciones/i.test(x.getAttribute("aria-label") || "")); if (b) b.click(); return !!b; });
      const tapNotice = (page, title) => page.evaluate((want) => {
        const b = Array.from(document.querySelectorAll('div[style*="z-index: 400"] button')).find(x => x.innerText.indexOf(want) !== -1);
        if (b) b.click();
        return !!b;
      }, title);
      // Where the portal is: the tab that reads as chosen on the bar, and
      // the chat that says it is chosen.
      const where = (page) => page.evaluate(() => {
        const bar = Array.from(document.querySelectorAll("div")).find((el) => { const s = getComputedStyle(el); return s.position === "fixed" && s.bottom === "0px" && el.querySelectorAll(":scope > button").length >= 5; });
        // The chosen tab's name is drawn at 600, the others at 500.
        const on = bar && Array.from(bar.querySelectorAll(":scope > button")).find(b => { const sp = b.querySelector("span"); return sp && getComputedStyle(sp).fontWeight === "600"; });
        const chat = Array.from(document.querySelectorAll('.sp-content button[aria-pressed="true"]')).map(b => b.textContent.replace(/\s+/g, " ").trim())[0] || null;
        return { tab: on ? on.textContent.trim().replace(/^[\d+]+/, "") : null, chat: chat };
      });
      const onNorth = (w) => !!w && w.tab === say("Chat", language) && !!w.chat && w.chat.indexOf("North Building") === 0;
      const title = ANNOUNCEMENT.title[language], body = ANNOUNCEMENT.body[language];
      const other = language === "es" ? "en" : "es";
      const sheetUp = (page) => page.evaluate(() => !!document.getElementById("ocsa-announcement-title"));

      // A chat notice, then a tag notice, each opening Chat on North Building.
      for (const n of NOTICES.slice(0, 2)) {
        const app = await open({ stubOptions: { notifications: [n] } });
        try {
          await pause(app.page, 900);
          await openBell(app.page);
          await pause(app.page, 900);
          await tapNotice(app.page, servedIn(n.title, "en"));
          await pause(app.page, 1300);
          const w = await where(app.page);
          expect("a " + n.subjectType + " notice opens Chat on the chat it names", onNorth(w), JSON.stringify(w));
          expect("a " + n.subjectType + " notice reads that chat", chatReads(app.stub).indexOf("ch-north") !== -1, JSON.stringify(chatReads(app.stub)));
        } finally { await app.context.close(); }
      }

      // An announcement notice opens its sheet, drawn in the screen's
      // language, with who sent it and when under the body.
      const ann = await open({ stubOptions: { notifications: [NOTICES[2]] } });
      try {
        await pause(ann.page, 900);
        await openBell(ann.page);
        await pause(ann.page, 900);
        await tapNotice(ann.page, "An announcement from the office");
        await pause(ann.page, 1200);
        const text = await sheetText(ann.page);
        const asked = sent(ann.stub, "GET", "/api/announcements/" + ANNOUNCEMENT.id).length;
        expect("an announcement notice opens its sheet, read from the announcement route", (await sheetUp(ann.page)) && asked === 1, asked + " reads: " + text.slice(0, 160));
        expect("the sheet draws the title and the body in the screen's language, with none of the other's", has(text, title) && has(text, body) && !has(text, ANNOUNCEMENT.title[other]), text.slice(0, 300));
        const from = fill(spanishOf("From {name}", language), { name: "Jordan Office" });
        const order = await ann.page.evaluate(([b, f]) => {
          const all = Array.from(document.querySelectorAll('[role="dialog"] div, [role="dialog"] span')).filter(e => e.children.length === 0);
          const bi = all.findIndex(e => e.textContent.trim() === b), fi = all.findIndex(e => e.textContent.trim() === f);
          return { body: bi, from: fi, under: bi !== -1 && fi > bi };
        }, [body, from]);
        expect("From and the time are under the body", order.under && /\d{1,2}:\d{2}/.test(text.slice(text.indexOf(from))), JSON.stringify(order) + " " + text.slice(0, 300));
        await spokenHere(ann, language, expect);
        await tapInSheet(ann.page, say("Close", language));
        expect("Close takes the sheet away", !(await sheetUp(ann.page)), "still up");
      } finally { await ann.context.close(); }

      // A tapped phone alert, told to a window already open: the worker's
      // message lands on the same place the bell would open.
      const tapped = await open({});
      try {
        await pause(tapped.page, 900);
        await tapped.page.evaluate(() => navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data: { type: "ocsa-open", subjectType: "chat_mention", subjectId: "ch-north" } })));
        await pause(tapped.page, 1300);
        const w = await where(tapped.page);
        expect("a phone alert's message opens Chat on the chat it names", onNorth(w), JSON.stringify(w));
        await tapped.page.evaluate((id) => navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data: { type: "ocsa-open", subjectType: "announcement", subjectId: id } })), ANNOUNCEMENT.id);
        await pause(tapped.page, 1200);
        expect("a phone alert's message about an announcement opens its sheet", await sheetUp(tapped.page), (await bodyText(tapped.page)).slice(0, 160));
      } finally { await tapped.context.close(); }

      // A tapped phone alert that opened a new window: ?open= at start,
      // held on the sign-in card, opened once the person is in, and never
      // opened again.
      const fresh = await open({ signedIn: false, path: "/?open=announcement:" + ANNOUNCEMENT.id });
      try {
        await pause(fresh.page, 600);
        expect("the address is cleared at once", await fresh.page.evaluate(() => window.location.search.indexOf("open=") === -1), await fresh.page.evaluate(() => window.location.href));
        expect("nothing opens over the sign-in card", !(await sheetUp(fresh.page)), "the sheet is up");
        await type(fresh.page, 'input[autocomplete="username"]', "4821");
        await type(fresh.page, 'input[type="password"]', "4907");
        await clickText(fresh.page, say("Sign In", language));
        await pause(fresh.page, 1800);
        expect("once the person is in, the announcement opens", (await sheetUp(fresh.page)) && has(await sheetText(fresh.page), title), (await sheetText(fresh.page)).slice(0, 160));
        await tapInSheet(fresh.page, say("Close", language));
        await openTab(fresh.page, "schedule", language);
        await pause(fresh.page, 900);
        await openTab(fresh.page, "clock", language);
        await pause(fresh.page, 900);
        const reads = sent(fresh.stub, "GET", "/api/announcements/" + ANNOUNCEMENT.id).length;
        expect("it never opens twice", !(await sheetUp(fresh.page)) && reads === 1, reads + " reads, sheet " + (await sheetUp(fresh.page)));
      } finally { await fresh.context.close(); }
    },
  },
  {
    id: "phonealerts",
    label: "Phone alerts: the Settings row only where the API has the route, the phone part only with a key, each of the five phone lines by permission and phone, a save turned away put back with its line, the card once and never after Not now, and signing out that takes this phone off first",
    run: async (open, language, expect) => {
      const row = (page) => hasButton(page, say("Phone alerts", language));
      const openAlerts = async (page) => {
        await openTab(page, "settings", language);
        await pause(page, 900);
        await tapWords(page, say("Phone alerts", language));
        await pause(page, 1500);
      };
      const cardUp = (page) => page.evaluate(() => !!document.getElementById("ocsa-alerts-card-title"));
      const LINES = {
        ios: "On an iPhone, add the app to your Home Screen first, then open it from there to turn on alerts.",
        unsupported: "This phone cannot receive alerts.",
        denied: "This phone blocked alerts for this app. Turn them on in the phone's settings.",
        on: "Alerts are on for this phone.",
      };
      const phoneSays = async (page) => {
        const text = await bodyText(page);
        return Object.keys(LINES).filter(k => has(text, spanishOf(LINES[k], language)));
      };

      // The row: hidden while the settings route answers 404, shown once
      // it answers.
      const noRoute = await open({ stubOptions: { alertSettings: null } });
      try {
        await openTab(noRoute.page, "settings", language);
        await pause(noRoute.page, 1000);
        expect("the Phone alerts row is hidden while the settings route answers 404", !(await row(noRoute.page)), "the row is there");
      } finally { await noRoute.context.close(); }

      // Each of the five phone lines, by the permission and the phone: an
      // iPhone browser tab, a browser with no Push API, alerts blocked,
      // alerts on, and nothing decided yet, which offers Turn on.
      const PHONES = [
        { what: "an iPhone browser tab", open: { push: { permission: "default" } }, says: ["ios"] },
        { what: "a browser with no Push API", open: { userAgent: ANDROID, push: { supported: false } }, says: ["unsupported"] },
        { what: "alerts blocked", open: { userAgent: ANDROID, push: { permission: "denied" } }, says: ["denied"] },
        { what: "alerts on", open: { userAgent: ANDROID, push: { permission: "granted", subscribed: true } }, says: ["on"], button: "Turn off on this phone" },
        { what: "nothing decided", open: { userAgent: ANDROID, push: { permission: "default" } }, says: [], button: "Turn on alerts on this phone", card: true },
      ];
      for (const p of PHONES) {
        const app = await open(p.open);
        try {
          await pause(app.page, 1500);
          // Nothing decided on an Android phone is where the card asks.
          if (p.card) {
            expect("on a phone that has decided nothing, the card asks after the first sign-in", await cardUp(app.page), "no card");
            await tapInSheet(app.page, say("Not now", language));
          }
          await openTab(app.page, "settings", language);
          await pause(app.page, 900);
          expect(p.what + ": the Phone alerts row is there once the settings route answers", await row(app.page), "no row");
          await openAlerts(app.page);
          const said = await phoneSays(app.page);
          expect(p.what + ": the phone part says " + (p.says.length ? JSON.stringify(LINES[p.says[0]]) : "nothing") + " and nothing else", JSON.stringify(said) === JSON.stringify(p.says), JSON.stringify(said));
          if (p.button) expect(p.what + ": the phone part offers " + p.button, await hasButton(app.page, say(p.button, language)), (await bodyText(app.page)).slice(0, 200));
          await spokenHere(app, language, expect);
          if (p.card) {
            // Turn on asks the browser from the tap, subscribes, and tells
            // the API; the part then says alerts are on.
            await tapWords(app.page, say("Turn on alerts on this phone", language));
            await pause(app.page, 1500);
            const posted = lastSent(app.stub, "POST", "/api/push/subscriptions");
            expect("Turn on subscribes and tells the API this phone's endpoint", !!posted && posted.body.endpoint === PUSH_ENDPOINT && !!posted.body.keys && !!posted.body.keys.p256dh, posted ? JSON.stringify(posted.body).slice(0, 160) : "nothing sent");
            expect("once turned on, the phone part says so", JSON.stringify(await phoneSays(app.page)) === JSON.stringify(["on"]), JSON.stringify(await phoneSays(app.page)));
          }
        } finally { await app.context.close(); }
      }

      // The phone part is hidden while the API has no key; the settings
      // part is still there.
      const noKey = await open({ userAgent: ANDROID, push: { permission: "granted", subscribed: true }, stubOptions: { pushKey: null } });
      try {
        await pause(noKey.page, 1200);
        await openAlerts(noKey.page);
        const text = await bodyText(noKey.page);
        expect("with no key, the phone part is hidden and the settings are there", (await phoneSays(noKey.page)).length === 0 && !has(text, spanishOf("Turn off on this phone", language)) && has(text, spanishOf("Chat messages", language)), text.slice(0, 220));
      } finally { await noKey.context.close(); }

      // A save the API turns away puts the choice back and says so under
      // the control, for the chat choice and for a switch.
      const saves = await open({});
      try {
        await openAlerts(saves.page);
        const checked = (page) => page.evaluate(() => ({
          chat: Array.from(document.querySelectorAll('.sp-content [role="radio"]')).filter(b => b.getAttribute("aria-checked") === "true").map(b => b.innerText.trim()),
          switches: Array.from(document.querySelectorAll('.sp-content [role="switch"]')).map(b => b.getAttribute("aria-checked")),
        }));
        const faults = (page) => page.evaluate((line) => Array.from(document.querySelectorAll('.sp-content [role="alert"]')).filter(a => a.textContent.trim() === line).length, spanishOf("Your settings did not save.", language));
        saves.stub.state.refuse["PATCH /api/notifications/settings"] = { status: 400, once: true, body: { error: "Send chat as all, mentions or off, and schedule, pickups, supplies, issues or forms as true or false", code: "notifications.badSetting", keys: ["chat"] } };
        await tapWords(saves.page, spanishOf("Only when I'm tagged", language));
        await pause(saves.page, 900);
        const afterChat = await checked(saves.page);
        expect("a chat choice turned away is put back", JSON.stringify(afterChat.chat) === JSON.stringify([spanishOf("Every message", language)]), JSON.stringify(afterChat));
        expect("the line says it did not save, under the chat choice", (await faults(saves.page)) === 1, (await faults(saves.page)) + " lines");
        saves.stub.state.refuse["PATCH /api/notifications/settings"] = { status: 400, once: true, body: { error: "Send chat as all, mentions or off, and schedule, pickups, supplies, issues or forms as true or false", code: "notifications.badSetting", keys: ["supplies"] } };
        await tapWords(saves.page, spanishOf("Supply requests", language));
        await pause(saves.page, 900);
        const afterSwitch = await checked(saves.page);
        expect("a switch turned away is put back on", afterSwitch.switches.every(v => v === "true") && afterSwitch.switches.length === 5, JSON.stringify(afterSwitch));
        await tapWords(saves.page, spanishOf("Only when I'm tagged", language));
        await pause(saves.page, 900);
        expect("a save that goes through is kept, on the screen and on the API", JSON.stringify((await checked(saves.page)).chat) === JSON.stringify([spanishOf("Only when I'm tagged", language)]) && saves.stub.state.push.settings.chat === "mentions", JSON.stringify(await checked(saves.page)) + " " + JSON.stringify(saves.stub.state.push.settings));
        await spokenHere(saves, language, expect);
      } finally { await saves.context.close(); }

      // The card after the first sign-in: once, and never again after Not now.
      const card = await open({ userAgent: ANDROID, push: { permission: "default" } });
      try {
        await pause(card.page, 1500);
        expect("the card asks once the portal is up", await cardUp(card.page), "no card");
        await spokenHere(card, language, expect);
        await tapInSheet(card.page, say("Not now", language));
        expect("Not now takes the card away", !(await cardUp(card.page)), "still up");
        await card.page.reload({ waitUntil: "domcontentloaded" });
        await card.page.waitForSelector(".sp-content", { timeout: 20000 }).catch(() => {});
        await pause(card.page, 2000);
        expect("after Not now the card never comes back", !(await cardUp(card.page)), "the card is back");
        expect("Not now asks nothing of the browser and posts nothing", sent(card.stub, "POST", "/api/push/subscriptions").length === 0, sent(card.stub, "POST", "/api/push/subscriptions").length + " posted");
      } finally { await card.context.close(); }

      // Signing out takes this phone's subscription off the API before the
      // token is forgotten.
      const out = await open({ userAgent: ANDROID, push: { permission: "granted", subscribed: true } });
      try {
        await pause(out.page, 1500);
        await out.page.evaluate(() => {
          const content = document.querySelector(".sp-content");
          const buttons = Array.from(document.querySelectorAll("button")).filter(x => content && (x.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING));
          const last = buttons[buttons.length - 1];
          if (last) last.click();
        });
        await pause(out.page, 1500);
        const del = lastSent(out.stub, "DELETE", "/api/push/subscriptions");
        expect("signing out sends the DELETE with this phone's endpoint, under the person's token", !!del && del.body && del.body.endpoint === PUSH_ENDPOINT && del.headers.authorization === "Bearer token-one", del ? JSON.stringify(del.body) + " " + del.headers.authorization : "nothing sent");
        expect("the API no longer holds the endpoint, and the person is signed out", !out.stub.state.push.rows[PUSH_ENDPOINT] && (await out.page.evaluate(() => !document.querySelector(".sp-content"))), JSON.stringify(out.stub.state.push.rows));
      } finally { await out.context.close(); }
    },
  },
  {
    id: "updatekeepsworker",
    label: "An update's reload keeps the service worker, and the phone's alerts with it",
    run: async (open, language, expect) => {
      const app = await open({ userAgent: ANDROID, push: { permission: "granted", subscribed: true }, buildStamp: "a-newer-build" });
      try {
        await app.page.waitForFunction(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller), null, { timeout: 10000 }).catch(() => {});
        await app.page.evaluate(() => { window.auditBeforeUpdate = true; });
        // The check runs five seconds after the portal starts; with nothing
        // underway, the update reloads the portal at once.
        await Promise.all([
          app.page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {}),
          app.page.clock.runFor(5600),
        ]);
        await app.page.waitForSelector(".sp-content", { timeout: 20000 }).catch(() => {});
        await pause(app.page, 1500);
        const after = await app.page.evaluate(async (keys) => ({
          reloaded: !window.auditBeforeUpdate,
          unregistered: Number(window.localStorage.getItem(keys.unregistered) || 0),
          registered: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0,
          subscription: !!window.localStorage.getItem(keys.sub),
        }), PUSH_KEYS);
        expect("the update reloads the portal", after.reloaded, JSON.stringify(after));
        expect("the update's reload never unregisters the service worker, and it is still there", after.unregistered === 0 && after.registered >= 1, JSON.stringify(after));
        expect("the phone's subscription is still in place after the reload", after.subscription, JSON.stringify(after));
        await openTab(app.page, "settings", language);
        await pause(app.page, 900);
        await tapWords(app.page, say("Phone alerts", language));
        await pause(app.page, 1500);
        expect("Phone alerts still says alerts are on for this phone", has(await bodyText(app.page), spanishOf("Alerts are on for this phone.", language)), (await bodyText(app.page)).slice(0, 200));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "phonefollows",
    label: "The phone follows whoever signed in: on boot with a stored session, and after another person signs in on the same phone, the endpoint is filed under the person signed in",
    run: async (open, language, expect) => {
      const app = await open({ userAgent: ANDROID, push: { permission: "granted", subscribed: true } });
      try {
        await pause(app.page, 1800);
        expect("on boot with a stored session, the phone's endpoint is filed under the person signed in", app.stub.state.push.rows[PUSH_ENDPOINT] === PERSON.id, JSON.stringify(app.stub.state.push.rows));
        // The session runs out, with no signing out, so the phone keeps its
        // subscription, and another person signs in on the same phone.
        await app.page.evaluate(() => window.dispatchEvent(new Event("ocsa-session-expired")));
        await pause(app.page, 900);
        app.stub.state.person = SECOND_PERSON;
        await type(app.page, 'input[autocomplete="username"]', "4822");
        await type(app.page, 'input[type="password"]', "4907");
        await clickText(app.page, say("Sign In", language));
        await pause(app.page, 1800);
        expect("after another person signs in, the endpoint is filed under them", app.stub.state.push.rows[PUSH_ENDPOINT] === SECOND_PERSON.id, JSON.stringify(app.stub.state.push.rows));
        const asked = await app.page.evaluate((keys) => window.localStorage.getItem(keys.permission), PUSH_KEYS);
        expect("nothing is asked of the browser along the way", asked === "granted", String(asked));
      } finally { await app.context.close(); }
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

      // One on the list that the API no longer has. Its refusal is the
      // API's own two words, in the language the request asks for.
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
        expect("an inspection the API no longer has says so", has(told, INSPECTION_NOT_FOUND[language === "es" ? 1 : 0]), told.slice(0, 200));
        await spokenHere(gone, language, expect);
      } finally { await gone.context.close(); }
    },
  },
  {
    id: "inspectionfixes",
    label: "An inspection scored: Not due yet in one tap, and Needs a fix files the problem report",
    run: async (open, language, expect) => {
      const inSpanish = (en) => (language === "es" && TWIN_ES.has(en) ? TWIN_ES.get(en) : en);
      const first = INSPECTION.items[0], second = INSPECTION.items[1];
      const card = (id) => '[data-inspect-item="' + id + '"]';
      // A button on one card, by its words.
      const tapIn = (page, id, text) => page.evaluate(([sel, t]) => {
        const b = Array.from(document.querySelectorAll(sel + " button")).find(x => x.textContent.trim() === t && !x.disabled);
        if (b) b.click();
        return !!b;
      }, [card(id), text]);
      // What one card shows: its score, its note, and whether each of the
      // two new controls reads as on.
      const cardState = (page, id) => page.evaluate((sel) => {
        const c = document.querySelector(sel);
        if (!c) return null;
        const range = c.querySelector('input[type="range"]');
        const note = c.querySelector('input:not([type="range"]):not([type="file"])');
        const notDue = c.querySelector("button[aria-pressed]");
        const fix = c.querySelector('button[role="switch"]');
        return { score: range ? range.value : null, note: note ? note.value : null, notDue: notDue ? notDue.getAttribute("aria-pressed") : null, fix: fix ? fix.getAttribute("aria-checked") : null };
      }, card(id));
      const noteIn = (page, id, words) => type(page, card(id) + ' input:not([type="range"]):not([type="file"])', words);
      const openScoring = async (app) => {
        await openTab(app.page, "inspect", language);
        await pause(app.page, 900);
        await app.page.evaluate((names) => {
          const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => names.some(n => x.textContent.indexOf(n) !== -1));
          if (b) b.click();
        }, [INSPECTION.template_name, inSpanish(INSPECTION.template_name)]);
        await pause(app.page, 900);
      };
      const completes = (stub) => sent(stub, "POST", "/api/inspections/scheduled/" + INSPECTION.id + "/complete");
      const submit = (page) => clickText(page, say("Submit Inspection", language));

      // 1. Not due yet, on and off. 2. Needs a fix with no note stops the send.
      const app = await open({ stubOptions: { inspections: [INSPECTION] } });
      try {
        await openScoring(app);
        expect("Not due yet is on the card", await tapIn(app.page, first.id, say("Not due yet", language)), "no such button on the first card");
        await pause(app.page, 300);
        let st = await cardState(app.page, first.id);
        expect("one tap scores the card at its maximum", !!st && String(st.score) === String(first.max_score), JSON.stringify(st));
        expect("one tap starts the note with Not due", !!st && /^Not due/.test(st.note || ""), JSON.stringify(st));
        expect("Not due yet reads as on", !!st && st.notDue === "true", JSON.stringify(st));
        await tapIn(app.page, first.id, say("Not due yet", language));
        await pause(app.page, 300);
        st = await cardState(app.page, first.id);
        expect("a second tap puts the score back", !!st && String(st.score) === "0", JSON.stringify(st));
        expect("a second tap takes Not due off the note", !!st && st.note === "", JSON.stringify(st));
        expect("Not due yet reads as off again", !!st && st.notDue === "false", JSON.stringify(st));
        await spokenHere(app, language, expect);

        expect("Needs a fix is on the card", await tapIn(app.page, first.id, say("Needs a fix", language)), "no such switch on the first card");
        await pause(app.page, 300);
        st = await cardState(app.page, first.id);
        expect("Needs a fix reads as on", !!st && st.fix === "true", JSON.stringify(st));
        await submit(app.page);
        await pause(app.page, 900);
        expect("a fix with no note is not sent", completes(app.stub).length === 0, completes(app.stub).length + " sent to /complete");
        const told = ((await toastText(app.page)) || "") + " " + (await bodyText(app.page));
        expect("the screen says what is missing", has(told, say("Say what needs fixing", language)), told.slice(0, 220));
        await spokenHere(app, language, expect);

        // 3. Two cards marked Needs a fix, each with a note, the second
        // with a photo: two reports, filed only after /complete, each to
        // the body written out here, and the photo on the second.
        await noteIn(app.page, first.id, "Smudges on the left door");
        await tapIn(app.page, second.id, say("Needs a fix", language));
        await noteIn(app.page, second.id, "Mat is wet and turned up");
        // A real picture since part 367 (PORT-27): the phone reads every
        // inspection photo before it goes, and refuses a file that is not one.
        await attachDrawn(app.page, card(second.id) + ' input[type="file"]', "mat.jpg", 40, 30);
        await pause(app.page, 900);
        expect("the photo is attached to the second card", has(await bodyText(app.page), say("Photo attached", language)), (await bodyText(app.page)).slice(0, 220));
        await submit(app.page);
        await pause(app.page, 1500);
        const calls = app.stub.state.calls;
        const at = (method, pathLike) => calls.map((c, i) => (c.method === method && c.path.indexOf(pathLike) === 0 ? i : -1)).filter(i => i >= 0);
        const completedAt = at("POST", "/api/inspections/scheduled/" + INSPECTION.id + "/complete");
        const filedAt = at("POST", "/api/issues").filter(i => calls[i].path === "/api/issues");
        const photosAt = at("POST", "/api/issues/").filter(i => /\/photos$/.test(calls[i].path));
        expect("the inspection is sent once", completedAt.length === 1, completedAt.length + " sent to /complete");
        expect("exactly two reports are filed", filedAt.length === 2, filedAt.length + " sent to /api/issues");
        expect("every report is filed after the inspection is in", completedAt.length === 1 && filedAt.every(i => i > completedAt[0]), JSON.stringify({ complete: completedAt, reports: filedAt }));
        const want = (item, note) => ({
          siteId: "site-north",
          title: "Inspection finding: Lobby",
          description: note + "\n" + item.label + "\nLobby walk, 2026-10-02",
          zone: "Lobby",
          severity: "medium",
        });
        // Since part 355 each report carries its own clientId, which Try
        // again sends with it; the rest is written the way Report writes it.
        const bodies = filedAt.map(i => calls[i].body);
        const ids = bodies.map(b => (b && typeof b.clientId === "string" && /^[0-9a-f-]{36}$/i.test(b.clientId) ? b.clientId : null));
        const rest = bodies.map((b) => { const o = Object.assign({}, b || {}); delete o.clientId; return o; });
        expect("the first report is the first card's, written the way Report writes one", JSON.stringify(rest[0]) === JSON.stringify(want(first, "Smudges on the left door")), JSON.stringify(bodies[0]));
        expect("the second report is the second card's", JSON.stringify(rest[1]) === JSON.stringify(want(second, "Mat is wet and turned up")), JSON.stringify(bodies[1]));
        expect("each report carries a clientId of its own", !!ids[0] && !!ids[1] && ids[0] !== ids[1], JSON.stringify(ids));
        expect("the one photo goes on the second report", photosAt.length === 1 && calls[photosAt[0]].path === "/api/issues/iss-2/photos" && calls[photosAt[0]].body && calls[photosAt[0]].body.photoUrl === "https://example.invalid/photo.jpg", JSON.stringify(photosAt.map(i => [calls[i].path, calls[i].body])));
        expect("the photo is sent after its report", photosAt.length === 1 && filedAt.length === 2 && photosAt[0] > filedAt[1], JSON.stringify({ reports: filedAt, photo: photosAt }));
        const said = await bodyText(app.page);
        expect("the screen says two problems were reported", has(said, say("Inspection sent. {n} problems reported for fixing.", language).replace("{n}", "2")), said.slice(0, 220));
        expect("nothing is listed as not reported", !has(said, say("Not reported: {0}", language).split("{")[0].trim()), said.slice(0, 220));
        await spokenHere(app, language, expect);
        await clickText(app.page, say("Done", language));
        await pause(app.page, 600);
        expect("Done returns to the list", has(await bodyText(app.page), say("My Inspections", language)), (await bodyText(app.page)).slice(0, 160));
      } finally { await app.context.close(); }

      // 4. One report refused: the other is filed, the refused one is
      // listed with Try again, which files only that one, and the
      // inspection is never sent twice.
      const again = await open({ stubOptions: { inspections: [INSPECTION] } });
      try {
        await openScoring(again);
        await tapIn(again.page, first.id, say("Needs a fix", language));
        await noteIn(again.page, first.id, "Smudges on the left door");
        await tapIn(again.page, second.id, say("Needs a fix", language));
        await noteIn(again.page, second.id, "Mat is wet and turned up");
        again.stub.state.refuse["POST /api/issues"] = { status: 500, error: "Something went wrong on our end. Try again in a minute.", once: true };
        await submit(again.page);
        await pause(again.page, 1500);
        const filed = () => sent(again.stub, "POST", "/api/issues").filter(c => c.path === "/api/issues");
        expect("the inspection is sent once when a report is refused", completes(again.stub).length === 1, completes(again.stub).length + " sent to /complete");
        expect("both reports were tried", filed().length === 2, filed().length + " sent to /api/issues");
        expect("the API kept one", again.stub.state.issues.length === 1, again.stub.state.issues.length + " kept");
        let shown = await bodyText(again.page);
        expect("the screen says one problem was reported", has(shown, say("Inspection sent. {n} problem reported for fixing.", language).replace("{n}", "1")), shown.slice(0, 220));
        expect("the refused one is listed as not reported", has(shown, say("Not reported: {0}", language).replace("{0}", first.label)), shown.slice(0, 220));
        expect("the refused one has Try again", has(shown, say("Try again", language)), shown.slice(0, 220));
        await spokenHere(again, language, expect);
        await clickText(again.page, say("Try again", language));
        await pause(again.page, 1200);
        expect("Try again files only that one", filed().length === 3 && again.stub.state.issues.length === 2, JSON.stringify({ tried: filed().length, kept: again.stub.state.issues.length }));
        expect("Try again files the refused card, not the other", again.stub.state.issues[1].body.description.indexOf("Smudges on the left door") === 0, JSON.stringify(again.stub.state.issues[1].body));
        expect("Try again never sends the inspection again", completes(again.stub).length === 1, completes(again.stub).length + " sent to /complete");
        shown = await bodyText(again.page);
        expect("the screen now says two problems were reported", has(shown, say("Inspection sent. {n} problems reported for fixing.", language).replace("{n}", "2")), shown.slice(0, 220));
        expect("nothing is left as not reported", !has(shown, say("Not reported: {0}", language).split("{")[0].trim()), shown.slice(0, 220));
        await spokenHere(again, language, expect);
      } finally { await again.context.close(); }
    },
  },
  {
    id: "leftovers",
    label: "Scout 142's leftovers: + Schedule only for someone who may schedule, every scored card folding away except the last one touched, and Register naming a weak PIN before anything is sent",
    run: async (open, language, expect) => {
      // + Schedule follows the capability the schedule route enforces.
      for (const [role, may] of [["custodial_lead", false], ["supervisor", true]]) {
        const app = await open({ stubOptions: { person: Object.assign({}, PERSON, { role: role }) } });
        try {
          await openTab(app.page, "inspect", language);
          await pause(app.page, 1100);
          const shown = await hasButton(app.page, say("+ Schedule", language));
          expect((may ? "a supervisor, who may schedule an inspection, sees + Schedule" : "a custodial lead, who may not schedule one, sees no + Schedule"), shown === may, "+ Schedule " + (shown ? "shown" : "not shown"));
          expect("the capability is read from the permissions route", sent(app.stub, "GET", "/api/users/me/permissions").length > 0, "never asked");
        } finally { await app.context.close(); }
      }

      // A long inspection: three cards scored, the first two fold away and
      // the one touched last stays, then the fold opens.
      const long = await open({ stubOptions: { inspections: [INSPECTION_LONG] } });
      try {
        await openTab(long.page, "inspect", language);
        await pause(long.page, 900);
        // The API sends an inspection's name as written, in English.
        await clickText(long.page, INSPECTION_LONG.template_name);
        await pause(long.page, 900);
        const drawn = () => long.page.evaluate(() => Array.from(document.querySelectorAll("[data-inspect-item]")).map(c => c.getAttribute("data-inspect-item")));
        for (const it of INSPECTION_LONG.items.slice(0, 3)) {
          await type(long.page, '[data-inspect-item="' + it.id + '"] input[type="range"]', "5");
          await pause(long.page, 300);
        }
        const open3 = await drawn();
        const show = fill(spanishOf("Show {0} scored items", language), { 0: 2 });
        expect("two scored cards fold away, and the one touched last stays", JSON.stringify(open3) === JSON.stringify(["il-3", "il-4", "il-5"]) && (await hasButton(long.page, show)) && has(await bodyText(long.page), spanishOf("Scored", language)), JSON.stringify(open3));
        await spokenHere(long, language, expect);
        await tapWords(long.page, show);
        await pause(long.page, 500);
        const all = await drawn();
        expect("the fold opens on the two scored cards", ["il-1", "il-2", "il-3", "il-4", "il-5"].every(id => all.indexOf(id) !== -1), JSON.stringify(all));
      } finally { await long.context.close(); }

      // Register with 12: a PIN that is not 4 digits, the one PIN the API
      // refuses there (Step 285), is named before anything is sent.
      const reg = await open({ signedIn: false });
      try {
        await clickText(reg.page, say("New Employee? Register Here", language));
        await pause(reg.page, 700);
        const person = ["Riley", "Invented", "0000000009", "nine@example.invalid", "12", "12"];
        for (let i = 0; i < person.length; i += 1) await typeNth(reg.page, "input", i, person[i]);
        await clickText(reg.page, say("Register", language));
        await pause(reg.page, 900);
        const text = await bodyText(reg.page);
        expect("Register names a PIN that is not 4 digits before anything is sent", has(text, spanishOf("PIN must be exactly 4 digits.", language)) && sent(reg.stub, "POST", "/api/auth/register").length === 0, text.slice(0, 260));
        await spokenHere(reg, language, expect);
      } finally { await reg.context.close(); }
    },
  },
  {
    id: "formsbyapp",
    label: "Forms by app, and a draft drawn from its own version: the catalog asked for the portal's forms, and a report opened on the version it was started on, with a newer one in the catalog",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { formVersions: true } });
      try {
        await openTab(app.page, "forms", language);
        await pause(app.page, 900);
        const asked = lastSent(app.stub, "GET", "/api/forms");
        expect("the catalog is asked for the forms offered on the portal", !!asked && asked.path === "/api/forms" && new URLSearchParams(asked.search).get("app") === "portal", asked ? asked.path + asked.search : "never asked");
        await clickText(app.page, say("Start report", language));
        await pause(app.page, 1500);
        const text = await bodyText(app.page);
        const kept = servedIn("Where did it happen", language), newer = servedIn("Which room was it in", language);
        expect("the report is drawn from the version sent beside its draft, with none of the catalog's newer questions", has(text, kept) && !has(text, newer), text.slice(0, 300));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "personquestion",
    label: "The person question: a person picked, saved as an id and a name, cleared and picked again, the review naming them, and the employee's signature card opening with their name",
    run: async (open, language, expect) => {
      const w = FORM_E_WORDS[language === "es" ? "es" : "en"];
      const saves = (stub) => stub.state.calls.filter(c => c.method === "PATCH" && c.path === "/api/forms/drafts/draft-four");
      const pickRow = (page, name) => page.evaluate((want) => {
        const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.innerText.replace(/\s+/g, " ").trim() === want);
        if (b) b.click();
        return !!b;
      }, name);
      const nameBox = (page) => page.evaluate((label) => {
        const l = Array.from(document.querySelectorAll(".sp-content div")).find(d => d.children.length === 0 && d.textContent.trim() === label && d.nextElementSibling && d.nextElementSibling.tagName === "INPUT");
        return l ? l.nextElementSibling.value : null;
      }, say("Name", language));
      const app = await open({ stubOptions: { personForm: true } });
      try {
        await openTab(app.page, "forms", language);
        await pause(app.page, 900);
        await startForm(app.page, w.title);
        await pause(app.page, 600);
        const listed = await app.page.evaluate(() => Array.from(document.querySelectorAll(".sp-content button")).map(b => b.innerText.replace(/\s+/g, " ").trim()));
        expect("the person question offers the staff by name, the one filing among them", listed.indexOf("Carla Castro") !== -1 && listed.indexOf("Alex Tester") !== -1, JSON.stringify(listed.slice(0, 20)));
        await pickRow(app.page, "Carla Castro");
        await pause(app.page, 400);
        expect("the pick is drawn as a chip", await app.page.evaluate((label) => Array.from(document.querySelectorAll(".sp-content button")).some(b => (b.getAttribute("aria-label") || "") === label), fill(say("Remove {name}", language), { name: "Carla Castro" })), "no chip");
        expect("the employee's signature card opens with the picked name in its Name box", (await nameBox(app.page)) === "Carla Castro", JSON.stringify(await nameBox(app.page)));
        await clickText(app.page, say("Next", language));
        await pause(app.page, 1000);
        let save = saves(app.stub).pop();
        expect("the pick is saved as the person's id and name", !!save && JSON.stringify(save.body.answers.who) === JSON.stringify({ id: "s-03", name: "Carla Castro" }), save ? JSON.stringify(save.body) : "nothing saved");
        expect("the review names the person", has(await bodyText(app.page), "Carla Castro"), (await bodyText(app.page)).slice(0, 300));
        await spokenHere(app, language, expect);

        // Cleared and picked again.
        await clickText(app.page, say("Back", language));
        await pause(app.page, 800);
        await tapLabel(app.page, fill(say("Remove {name}", language), { name: "Carla Castro" }));
        await pause(app.page, 400);
        await clickText(app.page, say("Next", language));
        await pause(app.page, 1000);
        save = saves(app.stub).pop();
        expect("cleared, the answer is saved as nothing", !!save && save.body.answers.who === null, save ? JSON.stringify(save.body) : "nothing saved");
        await clickText(app.page, say("Back", language));
        await pause(app.page, 800);
        await pickRow(app.page, "Ben Brooks");
        await pause(app.page, 400);
        expect("the signature card's Name box follows the new pick", (await nameBox(app.page)) === "Ben Brooks", JSON.stringify(await nameBox(app.page)));
        await clickText(app.page, say("Next", language));
        await pause(app.page, 1000);
        save = saves(app.stub).pop();
        expect("picked again, the new person is saved by id and name", !!save && JSON.stringify(save.body.answers.who) === JSON.stringify({ id: "s-02", name: "Ben Brooks" }) && JSON.stringify(app.stub.state.answersE.who) === JSON.stringify({ userId: "s-02", name: "Ben Brooks" }), save ? JSON.stringify(save.body) : "nothing saved");
        expect("the review names the new person", has(await bodyText(app.page), "Ben Brooks") && !has(await bodyText(app.page), "Carla Castro"), (await bodyText(app.page)).slice(0, 300));
      } finally { await app.context.close(); }
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
        const opened = await openShiftDetail(app.page, language, true);
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
    label: "Every PIN rule and PIN error, in the person's language: Set your PIN, Change PIN, an activation link, a reset link and Register",
    run: async (open, language, expect) => {
      // The API's own rules and words (Step 285): four of one digit, a
      // run up or down with no wrap, and the badge number.
      const RULES = [
        ["12", "PIN must be exactly 4 digits."],
        ["1111", "Choose a PIN that is not repeated digits, a sequence, or your badge number"],
        ["1234", "Choose a PIN that is not repeated digits, a sequence, or your badge number"],
        ["4821", "Choose a PIN that is not repeated digits, a sequence, or your badge number"],
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
        await said(settings, "Change PIN", "New PIN must be different from your current PIN");
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
        // Round 1 (PORT-08): a reset link refuses a weak PIN on the phone
        // too, in the same words, with nothing sent.
        await typeNth(reset.page, 'input[type="password"]', 0, "1234");
        await typeNth(reset.page, 'input[type="password"]', 1, "1234");
        await clickText(reset.page, say("Save PIN", language));
        await pause(reset.page, 600);
        await said(reset, "A reset link", RULES[2][1]);
        expect("A reset link sends nothing for a weak PIN", sent(reset.stub, "POST", "/api/auth/reset").length === 0, sent(reset.stub, "POST", "/api/auth/reset").length + " sent");
      } finally { await reset.context.close(); }

      // Registering, the fifth PIN screen, holds the same rule.
      const reg = await open({ signedIn: false });
      try {
        await clickText(reg.page, say("New Employee? Register Here", language));
        await pause(reg.page, 700);
        const person = ["Riley", "Invented", "0000000009", "nine@example.invalid", "1234", "1234"];
        for (let i = 0; i < person.length; i += 1) await typeNth(reg.page, "input", i, person[i]);
        await clickText(reg.page, say("Register", language));
        await pause(reg.page, 900);
        await said(reg, "Register", RULES[2][1]);
        expect("Register sends nothing for a weak PIN", sent(reg.stub, "POST", "/api/auth/register").length === 0, sent(reg.stub, "POST", "/api/auth/register").length + " sent");
      } finally { await reg.context.close(); }
    },
  },
  {
    id: "changepincodes",
    label: "Change PIN turned away by the API: each refusal under the box its code names, in the API's own words, in the person's language",
    run: async (open, language, expect) => {
      // Each code the API sends, the box it belongs under, and what the
      // screen says there: the API's own sentence, quoted from
      // helpers/words.js in ocsa-api byte for byte, in each language.
      const CASES = [
        ["PIN_INCORRECT", 0, "Current PIN is incorrect", "El PIN actual no es correcto"],
        ["PIN_UNCHANGED", 1, "New PIN must be different from your current PIN", "El PIN nuevo debe ser distinto de su PIN actual"],
        ["PIN_WEAK", 1, "Choose a PIN that is not repeated digits, a sequence, or your badge number", "Elija un PIN que no sea un mismo d\u00edgito repetido, una secuencia ni su n\u00famero de empleado"],
        ["PIN_FORMAT", 1, "PIN must be exactly 4 digits", "El PIN debe tener exactamente 4 d\u00edgitos"],
      ];
      const BOX = ["the current PIN", "the new PIN", "the repeated PIN"];
      const app = await open({});
      try {
        await openTab(app.page, "settings", language);
        await pause(app.page, 800);
        for (const [code, box, en, es] of CASES) {
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
          expect(code + " is said in the API's own words, in the person's language", has(under[box], language === "es" ? es : en), JSON.stringify(under));
          await spokenHere(app, language, expect);
        }
      } finally { await app.context.close(); }
    },
  },
  {
    id: "fortyfour",
    label: "Forty-four pixels: every control Step 178 gave the tap height is at least 44 tall at both ends of the text size scale, and the Profile camera 44 by 44, each reached the way a person reaches it",
    run: async (open, language, expect) => {
      // The size of the first control on the screen that reads exactly
      // these words, a button or a label, as it is drawn. The words are
      // read as written, since several of these buttons draw theirs in
      // capitals.
      const sizeOf = (page, words) => page.evaluate((w) => {
        const el = Array.from(document.querySelectorAll("button, label")).find(x => x.getClientRects().length > 0 && x.textContent.replace(/\s+/g, " ").trim() === w);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return [Math.round(r.width), Math.round(r.height)];
      }, words);
      // The shortest of the buttons in a grid of days: the week strip's
      // chips, or the month's cells.
      const shortestIn = (page, month) => page.evaluate((m) => {
        const grid = Array.from(document.querySelectorAll(".sp-content div")).find(d => getComputedStyle(d).display === "grid"
          && (m ? d.querySelectorAll(":scope > button").length >= 28 : d.children.length === 7));
        const buttons = grid ? Array.from(grid.querySelectorAll("button")).filter(b => b.getClientRects().length > 0) : [];
        if (!buttons.length) return null;
        const sizes = buttons.map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
        return sizes.sort((a, b) => a[1] - b[1])[0].concat([sizes.length]);
      }, !!month);
      const tapWordsAnywhere = (page, words) => page.evaluate((w) => {
        const b = Array.from(document.querySelectorAll("button")).find(x => x.getClientRects().length > 0 && x.textContent.replace(/\s+/g, " ").trim() === w && !x.disabled);
        if (b) b.click();
        return !!b;
      }, words);
      const labels = (slug) => (lookupsIn(language).find(c => c.slug === slug) || { values: [] }).values.map(v => v.displayLabel || spanishOf(v.label, language));
      for (const textSize of ["standard", "largest"]) {
        const tall = (what, size) => expect(what + " is at least 44 tall at the " + textSize + " text size", !!size && size[1] >= 44, size ? size.slice(0, 2).join(" by ") : "not on the screen");
        const app = await open({ textSize: textSize, stubOptions: { myPickups: [{ id: "pk-9", site_name: "South Building", scheduled_date: "2026-10-08", start_time: "17:00", end_time: "23:00", status: "claimed" }] } });
        try {
          // Home: the week strip's chips, and the month's cells.
          await openTab(app.page, "clock", language);
          await pause(app.page, 1000);
          tall("a chip on Home's week strip", await shortestIn(app.page, false));
          await tapWordsAnywhere(app.page, say("Month", language));
          await pause(app.page, 800);
          tall("a cell of Home's month", await shortestIn(app.page, true));
          await tapWordsAnywhere(app.page, say("Week", language));
          await pause(app.page, 500);

          // Schedule: a shift's detail, Request to Drop This Shift, and the
          // drop form's Cancel and Submit Request.
          await openTab(app.page, "schedule", language);
          await pause(app.page, 1000);
          tall("a chip on Schedule's week strip", await shortestIn(app.page, false));
          // A scheduled shift's chip reads its start and end; the shift on
          // site now reads its start alone.
          await openShiftDetail(app.page, language, false);
          tall("Request to Drop This Shift", await sizeOf(app.page, say("Request to Drop This Shift", language)));
          await tapWordsAnywhere(app.page, say("Request to Drop This Shift", language));
          await pause(app.page, 600);
          tall("the drop form's Cancel", await sizeOf(app.page, say("Cancel", language)));
          tall("the drop form's Submit Request", await sizeOf(app.page, say("Submit Request", language)));
          await app.page.mouse.click(8, 8);
          await pause(app.page, 600);

          // Tasks: an item's detail and Back to checklist.
          await openTab(app.page, "tasks", language);
          await pause(app.page, 1000);
          await openItem(app.page, itemName("task-1", language));
          await pause(app.page, 700);
          tall("Back to checklist", await sizeOf(app.page, say("Back to checklist", language)));
          await tapWordsAnywhere(app.page, say("Back to checklist", language));
          await pause(app.page, 500);

          // Assigned: its card, and in the detail Back, In Progress,
          // Resolved and Cannot Resolve, and each panel's Cancel and Submit.
          await openTab(app.page, "issuetasks", language);
          await pause(app.page, 900);
          const card = await app.page.evaluate((label) => {
            const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.innerText.indexOf(label) !== -1);
            if (!b) return null;
            const r = b.getBoundingClientRect();
            b.click();
            return [Math.round(r.width), Math.round(r.height)];
          }, "Replace the cracked light cover");
          tall("an assigned card", card);
          await pause(app.page, 700);
          for (const w of ["Back to assigned tasks", "In Progress", "Resolved", "Cannot Resolve"]) tall("Assigned's " + w, await sizeOf(app.page, say(w, language)));
          await tapWordsAnywhere(app.page, say("Resolved", language));
          await pause(app.page, 500);
          tall("the resolve panel's Cancel", await sizeOf(app.page, say("Cancel", language)));
          tall("Submit Resolution", await sizeOf(app.page, say("Submit Resolution", language)));
          await tapWordsAnywhere(app.page, say("Cancel", language));
          await pause(app.page, 400);
          await tapWordsAnywhere(app.page, say("Cannot Resolve", language));
          await pause(app.page, 500);
          tall("the cannot resolve panel's Cancel", await sizeOf(app.page, say("Cancel", language)));
          tall("the cannot resolve panel's Submit", await sizeOf(app.page, say("Submit", language)));
          await tapWordsAnywhere(app.page, say("Cancel", language));
          await pause(app.page, 400);
          await tapWordsAnywhere(app.page, say("Back to assigned tasks", language));
          await pause(app.page, 400);

          // Supplies: the request's type chips, its urgency buttons, its
          // Cancel and Submit Request, and Log Usage on an open supply.
          await openTab(app.page, "supplies", language);
          await pause(app.page, 900);
          await tapWordsAnywhere(app.page, say("+ Request", language));
          await pause(app.page, 600);
          for (const w of labels("request_types")) tall("the request type " + JSON.stringify(w), await sizeOf(app.page, w));
          for (const w of labels("urgency_levels")) tall("the urgency " + JSON.stringify(w), await sizeOf(app.page, w));
          tall("the request's Cancel", await sizeOf(app.page, say("Cancel", language)));
          tall("Submit Request", await sizeOf(app.page, say("Submit Request", language)));
          await tapWordsAnywhere(app.page, say("Cancel", language));
          await pause(app.page, 400);
          await app.page.evaluate(() => {
            const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.innerText.indexOf("Paper towels") !== -1);
            if (b) b.click();
          });
          await pause(app.page, 500);
          tall("Log Usage", await sizeOf(app.page, say("Log Usage", language)));

          // Pickup: Release Shift on a claimed shift.
          await openTab(app.page, "pickup", language);
          await pause(app.page, 900);
          await app.page.evaluate((w) => {
            const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.textContent.replace(/\s+/g, " ").trim().indexOf(w) === 0);
            if (b) b.click();
          }, say("My Pickups", language));
          await pause(app.page, 800);
          tall("Release Shift", await sizeOf(app.page, say("Release Shift", language)));

          // Profile: the camera, 44 by 44 around its gold circle, and
          // Cancel and Save while the profile is edited.
          await openTab(app.page, "profile", language);
          await pause(app.page, 1000);
          const camera = await app.page.evaluate(() => {
            const l = Array.from(document.querySelectorAll(".sp-content label")).find(x => x.querySelector('input[type="file"]'));
            if (!l) return null;
            const r = l.getBoundingClientRect();
            return [Math.round(r.width), Math.round(r.height)];
          });
          expect("the Profile camera is at least 44 by 44 at the " + textSize + " text size", !!camera && camera[0] >= 44 && camera[1] >= 44, camera ? camera.join(" by ") : "not on the screen");
          await tapWordsAnywhere(app.page, say("Edit", language));
          await pause(app.page, 600);
          tall("the profile's Cancel", await sizeOf(app.page, say("Cancel", language)));
          tall("the profile's Save", await sizeOf(app.page, say("Save", language)));
        } finally { await app.context.close(); }

        // Inspect, for someone who may schedule one: + Schedule, and Attach
        // Photo on an inspection's card.
        const insp = await open({ textSize: textSize, stubOptions: { person: Object.assign({}, PERSON, { role: "admin" }), inspections: [INSPECTION] } });
        try {
          await openTab(insp.page, "inspect", language);
          await pause(insp.page, 1000);
          tall("+ Schedule", await sizeOf(insp.page, say("+ Schedule", language)));
          await clickText(insp.page, INSPECTION.template_name);
          await pause(insp.page, 800);
          tall("Attach Photo", await sizeOf(insp.page, say("Attach Photo", language)));
        } finally { await insp.context.close(); }

        // Update now, on the bar that shows while a newer build waits on a
        // person who is in the middle of typing.
        const upd = await open({ textSize: textSize, buildStamp: "a-newer-build" });
        try {
          await openTab(upd.page, "agent", language);
          await pause(upd.page, 800);
          await upd.page.focus(".sp-content textarea").catch(() => {});
          await type(upd.page, ".sp-content textarea", "A question still being typed");
          await upd.page.clock.runFor(5600);
          await pause(upd.page, 800);
          tall("Update now", await sizeOf(upd.page, say("Update now", language)));
        } finally { await upd.context.close(); }
      }
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
          const card = Array.from(document.querySelectorAll(".sp-content button")).find(d => d.textContent.indexOf(t) !== -1);
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
  {
    id: "listfaults",
    label: "A list that did not load says so with Try again and comes back when it is tapped, on all eight lists that can fail; a site with no supplies says so; and a screen that throws draws the last resort, whose Reload brings the portal back",
    run: async (open, language, expect) => {
      const REFUSED = { status: 500, error: "Something went wrong on our end. Try again in a minute." };
      const LINE = "This list did not load.";
      // The line a list says in its place, and the Try again beside it.
      const faultOf = (page, line) => page.evaluate(([l, retry]) => {
        const a = Array.from(document.querySelectorAll('.sp-content [role="alert"]')).find(x => x.textContent.trim() === l && x.offsetParent !== null);
        const b = a && Array.from(a.parentElement.querySelectorAll("button")).find(x => x.textContent.trim() === retry);
        return { line: !!a, retry: !!b };
      }, [line, say("Try again", language)]);
      const tapRetry = (page, line) => page.evaluate(([l, retry]) => {
        const a = Array.from(document.querySelectorAll('.sp-content [role="alert"]')).find(x => x.textContent.trim() === l && x.offsetParent !== null);
        const b = a && Array.from(a.parentElement.querySelectorAll("button")).find(x => x.textContent.trim() === retry);
        if (b) b.click();
        return !!b;
      }, [line, say("Try again", language)]);
      const weekDrawn = (page) => page.evaluate(() => Array.from(document.querySelectorAll(".sp-content div")).some(d => getComputedStyle(d).display === "grid" && d.children.length === 7));
      const asked = (stub, route) => stub.state.calls.filter(c => c.method + " " + c.path === route).length;
      // Each list, the route that fills it, where a person meets it, the
      // line it says when the route fails, and what is back once it answers.
      const LISTS = [
        { what: "Home's sites", route: "GET /api/shift-sessions/sites", tab: "clock", line: "Your sites did not load.", stub: { clockedIn: false }, back: async page => has(await bodyText(page), "South Building") },
        { what: "Assigned", route: "GET /api/clock/tasks/assigned", tab: "issuetasks", line: LINE, back: async page => has(await bodyText(page), "Replace the cracked light cover") },
        { what: "Supplies", route: "GET /api/supplies", tab: "supplies", line: LINE, back: async page => has(await bodyText(page), "Paper towels") },
        { what: "Schedule", route: "GET /api/pickups/my-schedule", tab: "schedule", line: LINE, back: weekDrawn },
        { what: "Report, for an admin", route: "GET /api/issues", tab: "Issues", line: LINE, stub: { person: Object.assign({}, PERSON, { role: "admin" }) }, back: async page => has(await bodyText(page), spanishOf("No issues reported yet.", language)) },
        { what: "Pickup", route: "GET /api/pickups/available", tab: "pickup", line: LINE, back: async page => has(await bodyText(page), say("Claim This Shift", language)) },
        { what: "Inspect", route: "GET /api/inspections/scheduled", tab: "inspect", line: LINE, stub: { inspections: [INSPECTION] }, back: async page => has(await bodyText(page), INSPECTION.template_name) },
        { what: "Profile", route: "GET /api/users/profile/me", tab: "profile", line: "Your profile did not load.", back: async page => has(await bodyText(page), "OCSA-0001") },
      ];
      for (const c of LISTS) {
        const app = await open({ stubOptions: Object.assign({ refuse: { [c.route]: REFUSED } }, c.stub || {}) });
        try {
          await openTab(app.page, c.tab, language);
          await pause(app.page, 1200);
          const said = await faultOf(app.page, spanishOf(c.line, language));
          expect(c.what + ": a list that did not load says so where it would be, with Try again", said.line && said.retry, JSON.stringify(said) + " " + (await bodyText(app.page)).slice(0, 200));
          await spokenHere(app, language, expect);
          delete app.stub.state.refuse[c.route];
          const before = asked(app.stub, c.route);
          await tapRetry(app.page, spanishOf(c.line, language));
          await pause(app.page, 1200);
          const gone = !(await faultOf(app.page, spanishOf(c.line, language))).line;
          const back = await c.back(app.page);
          expect(c.what + ": Try again asks again and the list comes back", asked(app.stub, c.route) > before && gone && back,
            "asked " + (asked(app.stub, c.route) - before) + " more, line gone " + gone + ", back " + back + ": " + (await bodyText(app.page)).slice(0, 200));
        } finally { await app.context.close(); }
      }

      // A site with no supplies set up says so, apart from a list that
      // did not load.
      const none = await open({ stubOptions: { supplies: [] } });
      try {
        await openTab(none.page, "supplies", language);
        await pause(none.page, 1200);
        const text = await bodyText(none.page);
        expect("a site with no supplies says so", has(text, spanishOf("No supplies are set up for this site.", language)) && !has(text, spanishOf(LINE, language)), text.slice(0, 220));
        await spokenHere(none, language, expect);
      } finally { await none.context.close(); }

      // A profile answered without its user throws while it is drawn. The
      // last resort draws one line and Reload, in the phone's language, in
      // place of a blank page, and Reload brings the portal back.
      const thrown = await open({});
      try {
        thrown.stub.state.refuse["GET /api/users/profile/me"] = { status: 200, body: {}, once: true };
        await openTab(thrown.page, "profile", language);
        await pause(thrown.page, 1200);
        const last = await thrown.page.evaluate(([line, reload]) => ({
          line: Array.from(document.querySelectorAll('[role="alert"]')).some(a => a.textContent.trim() === line),
          reload: Array.from(document.querySelectorAll("button")).some(b => b.textContent.trim() === reload),
          portal: !!document.querySelector(".sp-content"),
        }), [spanishOf("Something went wrong on this screen.", language), spanishOf("Reload", language)]);
        expect("a screen that throws draws the last resort's line and Reload, in the phone's language, and nothing of the portal", last.line && last.reload && !last.portal, JSON.stringify(last) + " " + (await bodyText(thrown.page)).slice(0, 160));
        await spokenHere(thrown, language, expect);
        await Promise.all([
          thrown.page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {}),
          clickText(thrown.page, spanishOf("Reload", language)),
        ]);
        await thrown.page.waitForSelector(".sp-content", { timeout: 20000 }).catch(() => {});
        await pause(thrown.page, 1200);
        expect("Reload brings the portal back", await thrown.page.evaluate(() => !!document.querySelector(".sp-content")), (await bodyText(thrown.page)).slice(0, 160));
      } finally { await thrown.context.close(); }
    },
  },
  // --- Chat. Step 130: every chat reachable, and every message accounted for.
  {
    id: "chatpickfirst",
    label: "Chat: Send with words and no chat chosen says to pick a chat at the top first and sends nothing",
    run: async (open, language, expect) => {
      // Chat opens on the person's own site chat when they are on a shift
      // or assigned to a site (since c45f406, Oct 1), so the person
      // here is neither (part 344).
      const app = await open({ stubOptions: { clockedIn: false, assignedSites: [] } });
      try {
        await openChat(app.page, language);
        expect("with several chats, Chat chooses none on its own", chatReads(app.stub).length === 0, "read " + JSON.stringify(chatReads(app.stub)));
        const empty = await bodyText(app.page);
        expect("the empty screen says Pick a chat to start.", has(empty, say("Pick a chat to start.", language)), empty.slice(0, 240));
        const words = "A note typed before any chat is chosen";
        await type(app.page, CHAT_BOX, words);
        await pause(app.page, 300);
        expect("with words and no chat chosen, Send says it is not ready", (await sendReady(app.page, language)) === false, "Send reads as ready");
        await tapSend(app.page, language);
        await pause(app.page, 500);
        const told = await bodyText(app.page);
        expect("a tap on Send with no chat chosen sends nothing", chatSends(app.stub).length === 0, "sent " + chatSends(app.stub).length);
        expect("a tap on Send with no chat chosen says Pick a chat at the top first.", has(told, say("Pick a chat at the top first.", language)), told.slice(0, 240));
        await app.page.focus(CHAT_BOX).catch(() => {});
        await app.page.keyboard.press("Enter");
        await pause(app.page, 400);
        expect("Enter with no chat chosen sends nothing", chatSends(app.stub).length === 0, "sent " + chatSends(app.stub).length);
        expect("the words stay in the box", (await boxText(app.page, CHAT_BOX)) === words, JSON.stringify(await boxText(app.page, CHAT_BOX)));
        expect("both lines are said in the person's language", language !== "es" || (has(told, spanishOf("Pick a chat at the top first.", language)) && has(empty, spanishOf("Pick a chat to start.", language))), told.slice(0, 240));
        await spokenHere(app, language, expect);
        await tapChat(app.page, "North Building");
        await pause(app.page, 900);
        const after = await bodyText(app.page);
        expect("once a chat is chosen, the line to pick one goes", !has(after, say("Pick a chat at the top first.", language)), after.slice(0, 240));
        expect("once a chat is chosen, Send with words is ready", (await sendReady(app.page, language)) === true, "Send reads as not ready");
      } finally { await app.context.close(); }
    },
  },
  {
    id: "chatreopen",
    label: "Chat reopens on the chat last chosen while it is still listed, chooses the only chat when there is one, and never guesses among several",
    run: async (open, language, expect) => {
      const app = await open({});
      const again = async () => {
        await app.page.reload({ waitUntil: "domcontentloaded" });
        await app.page.waitForSelector(".sp-content", { timeout: 20000 });
        await pause(app.page, 900);
        await openChat(app.page, language);
      };
      try {
        await openChat(app.page, language);
        const tapped = await tapChat(app.page, "All staff");
        await pause(app.page, 900);
        expect("a chat can be chosen", tapped === "tapped" && chatReads(app.stub).slice(-1)[0] === "ch-all", tapped + ", read " + JSON.stringify(chatReads(app.stub)));
        const before = chatReads(app.stub).length;
        await again();
        expect("Chat reopens on the chat last chosen", chatReads(app.stub)[before] === "ch-all", "read " + JSON.stringify(chatReads(app.stub).slice(before)));
        const drawn = await chatButtons(app.page, ["All staff"]);
        expect("the chat it reopens on is drawn chosen", drawn.length === 1 && drawn[0].pressed === "true", JSON.stringify(drawn));
        app.stub.state.chat.channels = app.stub.state.chat.channels.filter(ch => ch.id !== "ch-all");
        const before2 = chatReads(app.stub).length;
        await again();
        const said = await bodyText(app.page);
        expect("a chat no longer listed is not reopened, and none is guessed among several", chatReads(app.stub).length === before2 && has(said, say("Pick a chat to start.", language)), "read " + JSON.stringify(chatReads(app.stub).slice(before2)) + " " + said.slice(0, 160));
      } finally { await app.context.close(); }
      const one = await open({ stubOptions: { chat: { only: "ch-north" } } });
      try {
        await openChat(one.page, language);
        expect("with one chat on the list, Chat opens on it", chatReads(one.stub)[0] === "ch-north", "read " + JSON.stringify(chatReads(one.stub)));
        const said = await bodyText(one.page);
        expect("with the only chat open, nothing asks to pick one", !has(said, say("Pick a chat to start.", language)), said.slice(0, 200));
      } finally { await one.context.close(); }
    },
  },
  {
    id: "chatsend",
    label: "Chat: a cleaner picks their site chat and sends, and the message shows once, as theirs, with its time",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openChat(app.page, language);
        await tapChat(app.page, "North Building");
        await pause(app.page, 900);
        const words = "An invented note for the site chat";
        await type(app.page, CHAT_BOX, "  " + words + "  ");
        await pause(app.page, 300);
        await tapSend(app.page, language);
        await pause(app.page, 1300);
        const posts = chatSends(app.stub);
        expect("the send goes to the chat chosen, once, with the words trimmed", posts.length === 1 && posts[0].path === "/api/chat/channels/ch-north/messages" && !!posts[0].body && posts[0].body.text === words, JSON.stringify(posts.map(p => [p.path, p.body])));
        let drawn = await bubbles(app.page, words);
        expect("the message shows once", drawn.length === 1, drawn.length + " drawn");
        const mine = drawn[0];
        expect("the message shows as the person's own", !!mine && mine.right >= mine.width - 40 && mine.left > 90, JSON.stringify(mine));
        expect("the message shows with its time", !!mine && /\d{1,2}:\d{2}/.test(mine.under), JSON.stringify(mine));
        expect("the box is empty once the API took the words", (await boxText(app.page, CHAT_BOX)) === "", JSON.stringify(await boxText(app.page, CHAT_BOX)));
        await app.page.clock.runFor(12500);
        await pause(app.page, 900);
        drawn = await bubbles(app.page, words);
        expect("after the next read of the chat, the message still shows once", drawn.length === 1, drawn.length + " drawn");
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "chatreach",
    label: "Chat: an admin reaches every group chat, the ninth included, and every private chat, at 375 pixels",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { person: ADMIN_PERSON, chat: { privates: 6 } } });
      try {
        await openChat(app.page, language);
        const list = app.stub.state.chat.channels;
        const groups = list.filter(ch => ch.type !== "admin_dm");
        const privates = list.filter(ch => ch.type === "admin_dm");
        const drawnGroups = await chatButtons(app.page, groups.map(ch => ch.name));
        const outside = drawnGroups.filter(b => b.left < 0 || b.right > 375);
        expect("every group chat is drawn inside the screen, the ninth included", groups.length === 9 && drawnGroups.length === 9 && outside.length === 0, drawnGroups.length + " of " + groups.length + " drawn; outside: " + JSON.stringify(outside.map(b => b.name + " " + b.left + " to " + b.right)));
        const ninth = groups[8];
        const t9 = await tapChat(app.page, ninth.name);
        await pause(app.page, 800);
        expect("the ninth group chat can be tapped and opens", t9 === "tapped" && chatReads(app.stub).slice(-1)[0] === ninth.id, t9 + ", read " + JSON.stringify(chatReads(app.stub).slice(-2)));
        const said = await bodyText(app.page);
        expect("the private chats sit under Private chats", has(said, say("Private chats", language)), said.slice(0, 300));
        expect("Private chats is said in the person's language", language !== "es" || has(said, spanishOf("Private chats", language)), said.slice(0, 300));
        // Unread first, then the newest last message first, and a chat never
        // written in after those. Ties keep the order the API sent.
        const when = (ch) => (ch.lastMessageAt ? Date.parse(ch.lastMessageAt) : 0);
        const want = privates.slice().sort((a, b) => ((a.unreadCount > 0 ? 0 : 1) - (b.unreadCount > 0 ? 0 : 1)) || (when(b) - when(a))).map(ch => ch.name);
        const drawnPrivates = (await chatButtons(app.page, privates.map(ch => ch.name))).map(b => b.name);
        expect("every private chat is drawn by the name the API sent, unread first and then the newest first", JSON.stringify(drawnPrivates) === JSON.stringify(want), JSON.stringify(drawnPrivates) + " wanted " + JSON.stringify(want));
        const missed = [];
        for (const ch of privates) {
          const r = await tapChat(app.page, ch.name);
          await pause(app.page, 500);
          if (r !== "tapped" || chatReads(app.stub).slice(-1)[0] !== ch.id) missed.push(ch.name + ": " + r);
        }
        expect("every private chat can be reached and opened", missed.length === 0, JSON.stringify(missed));
        expect("the page never moves sideways", (await sidewaysBy(app.page)) <= 0, "by " + (await sidewaysBy(app.page)));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "chatrefused",
    label: "Chat: a send turned away with no code, or cut off, keeps the words and says the portal's line, and Try again never sends a message twice",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openChat(app.page, language);
        await tapChat(app.page, "North Building");
        await pause(app.page, 900);
        const route = "POST /api/chat/channels/ch-north/messages";
        const unsaid = [];
        // A refusal with no code, the way the API wrote every Chat refusal
        // before Step 132, gets the portal's own line. The API's sentence,
        // English, drawn on a Spanish screen, is one line for the whole run.
        const leaked = [];
        const box = () => boxText(app.page, CHAT_BOX);
        for (const refusal of CHAT_UNCODED_REFUSALS) {
          const words = "An invented note turned away with " + refusal.status;
          app.stub.state.refuse[route] = { status: refusal.status, once: true, body: { error: refusal.error } };
          await type(app.page, CHAT_BOX, words);
          await pause(app.page, 300);
          await tapSend(app.page, language);
          await pause(app.page, 1000);
          const told = await bodyText(app.page);
          const line = chatSendLine(refusal.status);
          const kept = (await box()) === words;
          const shown = has(told, say(line, language)) && (await hasButton(app.page, say("Try again", language)));
          if (language === "es" && !has(told, spanishOf(line, language))) unsaid.push(line);
          expect("a send turned away with " + refusal.status + " keeps the words in the box", kept, JSON.stringify(await box()));
          expect("a send turned away with " + refusal.status + " says " + line + " with Try again", shown, told.slice(-240));
          if (language === "es" && has(told, refusal.error)) leaked.push(refusal.status + " " + refusal.error);
          expect("a send turned away with " + refusal.status + " draws nothing as sent", (await bubbles(app.page, words)).length === 0, "drawn");
          const reads = chatReads(app.stub).length;
          await tapWords(app.page, say("Try again", language));
          await pause(app.page, 1300);
          expect("Try again after " + refusal.status + " reads the chat before it sends", chatReads(app.stub).length > reads, "no read");
          expect("Try again after " + refusal.status + " sends it once more, and it shows once", chatSaved(app.stub, "ch-north", words) === 1 && (await bubbles(app.page, words)).length === 1 && (await box()) === "", chatSaved(app.stub, "ch-north", words) + " kept, " + (await bubbles(app.page, words)).length + " drawn, box " + JSON.stringify(await box()));
        }
        const offline = "An invented note with no signal";
        app.stub.state.offline = true;
        await type(app.page, CHAT_BOX, offline);
        await pause(app.page, 300);
        await tapSend(app.page, language);
        await pause(app.page, 1000);
        const cut = await bodyText(app.page);
        expect("a send with no signal keeps the words and says the portal's line for no signal, with Try again", (await box()) === offline && has(cut, say(OFFLINE_LINE, language)) && (await hasButton(app.page, say("Try again", language))), JSON.stringify(await box()) + " " + cut.slice(-200));
        app.stub.state.offline = false;
        await tapWords(app.page, say("Try again", language));
        await pause(app.page, 1300);
        expect("Try again once the signal is back sends it once", chatSaved(app.stub, "ch-north", offline) === 1 && (await bubbles(app.page, offline)).length === 1 && (await box()) === "", chatSaved(app.stub, "ch-north", offline) + " kept, " + (await bubbles(app.page, offline)).length + " drawn");
        const timed = "An invented note that timed out once saved";
        app.stub.state.chat.saveThenDrop = true;
        await type(app.page, CHAT_BOX, timed);
        await pause(app.page, 300);
        await tapSend(app.page, language);
        await pause(app.page, 1000);
        const lost = await bodyText(app.page);
        expect("a send whose answer never came keeps the words and says the line for no signal", (await box()) === timed && has(lost, say(OFFLINE_LINE, language)), JSON.stringify(await box()) + " " + lost.slice(-200));
        const posts = chatSends(app.stub, timed).length;
        const readsBefore = chatReads(app.stub).length;
        await tapWords(app.page, say("Try again", language));
        await pause(app.page, 1300);
        expect("Try again after a send that was saved reads the chat first", chatReads(app.stub).length > readsBefore, "no read");
        expect("Try again after a send that was saved does not send it twice", chatSends(app.stub, timed).length === posts && chatSaved(app.stub, "ch-north", timed) === 1, (chatSends(app.stub, timed).length - posts) + " more sent, " + chatSaved(app.stub, "ch-north", timed) + " kept");
        expect("the message that was saved shows once and the box empties", (await bubbles(app.page, timed)).length === 1 && (await box()) === "", (await bubbles(app.page, timed)).length + " drawn, box " + JSON.stringify(await box()));
        expect("each line is said in the person's language", unsaid.length === 0, JSON.stringify(unsaid));
        expect("a send turned away never shows the API's English sentence on a Spanish screen", leaked.length === 0, JSON.stringify(leaked));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "chatsaid",
    label: "Chat: a send turned away with one of Chat's codes keeps the words and shows the API's own words under the box, in the person's language, with Try again",
    run: async (open, language, expect, extra) => {
      const app = await open({});
      try {
        await openChat(app.page, language);
        await tapChat(app.page, "North Building");
        await pause(app.page, 900);
        const route = "POST /api/chat/channels/ch-north/messages";
        const box = () => boxText(app.page, CHAT_BOX);
        for (const refusal of CHAT_SEND_REFUSALS) {
          const words = "An invented note turned away with " + refusal.code;
          app.stub.state.refuse[route] = { chat: refusal.code, once: true };
          await type(app.page, CHAT_BOX, words);
          await pause(app.page, 300);
          await tapSend(app.page, language);
          await pause(app.page, 1000);
          const line = await chatFaultText(app.page);
          const kept = (await box()) === words;
          const shown = line === refusal[language] && (await hasButton(app.page, say("Try again", language)));
          expect("a send turned away with " + refusal.code + " keeps the words in the box", kept, JSON.stringify(await box()));
          expect("a send turned away with " + refusal.code + " shows the API's own words under the box, with Try again", shown, JSON.stringify(line) + " wanted " + JSON.stringify(refusal[language]));
          expect("a send turned away with " + refusal.code + " shows no line of the portal's own in their place", !has(line, say(chatSendLine(refusal.status), language)), JSON.stringify(line));
          expect("a send turned away with " + refusal.code + " draws nothing as sent", (await bubbles(app.page, words)).length === 0, "drawn");
          if (extra) extra.refusalsShown += kept && shown ? 1 : 0;
          const reads = chatReads(app.stub).length;
          await tapWords(app.page, say("Try again", language));
          await pause(app.page, 1300);
          expect("Try again after " + refusal.code + " reads the chat before it sends", chatReads(app.stub).length > reads, "no read");
          expect("Try again after " + refusal.code + " sends it once more, and it shows once", chatSaved(app.stub, "ch-north", words) === 1 && (await bubbles(app.page, words)).length === 1 && (await box()) === "", chatSaved(app.stub, "ch-north", words) + " kept, " + (await bubbles(app.page, words)).length + " drawn, box " + JSON.stringify(await box()));
        }
        // Try again's own read turned away with a code says the API's words
        // too, in place of the line the send was told in.
        const read = "An invented note whose second read is turned away";
        app.stub.state.refuse[route] = { status: 500, once: true, body: { error: "Server error" } };
        await type(app.page, CHAT_BOX, read);
        await pause(app.page, 300);
        await tapSend(app.page, language);
        await pause(app.page, 1000);
        const first = await chatFaultText(app.page);
        expect("a send turned away with no code says the portal's own line", first === say("Your message was not sent.", language), JSON.stringify(first));
        app.stub.state.refuse["GET /api/chat/channels/ch-north/messages"] = { chat: "chat.noAccess", once: true };
        await tapWords(app.page, say("Try again", language));
        await pause(app.page, 1300);
        const denied = CHAT_SEND_REFUSALS.find(r => r.code === "chat.noAccess")[language];
        const second = await chatFaultText(app.page);
        expect("Try again whose read is turned away with a code shows the API's own words, keeps the words and sends nothing",
          second === denied && (await box()) === read && chatSends(app.stub, read).length === 1, JSON.stringify(second) + ", box " + JSON.stringify(await box()) + ", " + chatSends(app.stub, read).length + " sent");
        const unsaid = chatCallsNotIn(app.stub, language);
        expect("every call Chat makes says the screen's language", unsaid.length === 0, JSON.stringify(unsaid.slice(0, 3)));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "chatlong",
    label: "Chat: the box stops at 2,000 characters, and a message that long goes whole",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openChat(app.page, language);
        await tapChat(app.page, "North Building");
        await pause(app.page, 900);
        const box = () => boxText(app.page, CHAT_BOX);
        // An invented note of 2,160 characters, eight to a word.
        const long = Array.from({ length: 270 }, (_, i) => "note" + String(i).padStart(3, "0")).join(" ");
        await type(app.page, CHAT_BOX, long);
        await pause(app.page, 300);
        const held = await box();
        const cap = await app.page.evaluate((sel) => { const e = document.querySelector(sel); return e ? e.maxLength : null; }, CHAT_BOX);
        expect("the box holds the first 2,000 characters of a longer message", held === long.slice(0, CHAT_TEXT_MAX), (held || "").length + " characters");
        expect("the box says it stops at 2,000 characters", cap === CHAT_TEXT_MAX, String(cap));
        await tapSend(app.page, language);
        await pause(app.page, 1200);
        const posts = chatSends(app.stub);
        expect("a message that fills the box goes whole, once, and is kept",
          posts.length === 1 && !!posts[0].body && posts[0].body.text === held.trim() && chatSaved(app.stub, "ch-north", held.trim()) === 1,
          posts.length + " sent, " + (posts[0] && posts[0].body ? String(posts[0].body.text).length : 0) + " characters");
        expect("a message that fills the box is not turned away, and the box empties", (await chatFaultText(app.page)) === "" && (await box()) === "", JSON.stringify(await chatFaultText(app.page)));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "chatownfirst",
    label: "Chat: the person's own private chat is drawn first under Private chats, wherever the API puts it in the list",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { person: ADMIN_PERSON, chat: { privates: 6, ownPrivate: true } } });
      try {
        await openChat(app.page, language);
        const privates = app.stub.state.chat.channels.filter(ch => ch.type === "admin_dm");
        expect("the API sends the person's own private chat last", privates.length > 1 && !privates[privates.length - 1].staffUserId, JSON.stringify(privates.map(ch => ch.name)));
        const drawn = (await chatButtons(app.page, privates.map(ch => chatName(ch, language)))).map(b => b.name);
        expect("the person's own private chat is drawn first under Private chats, by the portal's words for it",
          drawn.length === privates.length && drawn[0] === say("Admin (Private)", language), JSON.stringify(drawn));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "chatlists",
    label: "Chat: a list that did not load and a list that loaded empty each say their own line",
    run: async (open, language, expect) => {
      const failed = "Your chats did not load. Try again in a minute.";
      const none = "No chats are set up for you yet. Ask your supervisor.";
      // Refused from the start: the portal reads the list at sign in for
      // the bar's badge, and a list already drawn stays drawn when a later
      // read is turned away.
      const app = await open({ stubOptions: { refuse: { "GET /api/chat/channels": { status: 500, body: { error: "Server error" } } } } });
      try {
        await openChat(app.page, language);
        const said = await bodyText(app.page);
        expect("a list turned away says Your chats did not load, with Try again", has(said, say(failed, language)) && (await hasButton(app.page, say("Try again", language))), said.slice(0, 240));
        expect("a list turned away never says no chats are set up", !has(said, say(none, language)), said.slice(0, 240));
        expect("the line for a list that did not load is said in the person's language", language !== "es" || has(said, spanishOf(failed, language)), said.slice(0, 240));
        delete app.stub.state.refuse["GET /api/chat/channels"];
        await tapWords(app.page, say("Try again", language));
        await pause(app.page, 1000);
        const back = await chatButtons(app.page, ["North Building", "All staff"]);
        expect("Try again reads the list and draws it", back.length === 2, JSON.stringify(back));
      } finally { await app.context.close(); }
      const cut = await open({ stubOptions: { drop: { "GET /api/chat/channels": {} } } });
      try {
        await openChat(cut.page, language);
        const said = await bodyText(cut.page);
        expect("a list whose connection dropped says Your chats did not load", has(said, say(failed, language)) && !has(said, say(none, language)), said.slice(0, 240));
      } finally { await cut.context.close(); }
      const empty = await open({ stubOptions: { chat: { empty: true } } });
      try {
        await openChat(empty.page, language);
        const said = await bodyText(empty.page);
        expect("a list that loaded empty says No chats are set up for you yet", has(said, say(none, language)) && !has(said, say(failed, language)), said.slice(0, 240));
        expect("the line for an empty list is said in the person's language", language !== "es" || has(said, spanishOf(none, language)), said.slice(0, 240));
        await spokenHere(empty, language, expect);
      } finally { await empty.context.close(); }
    },
  },
  {
    id: "chatupdate",
    label: "Chat: an update waiting while a message is on its way does not reload the app until the answer is drawn",
    run: async (open, language, expect) => {
      const app = await open({ buildStamp: "a-newer-build" });
      try {
        await openChat(app.page, language);
        await tapChat(app.page, "North Building");
        await pause(app.page, 900);
        const words = "An invented note sent while an update waits";
        await type(app.page, CHAT_BOX, words);
        await pause(app.page, 300);
        // The update check runs five seconds after the app starts.
        await app.page.clock.runFor(6000);
        await pause(app.page, 900);
        expect("an update is waiting while the box holds words", await app.page.evaluate(() => !!document.getElementById("ocsa-update-bar")), "no update bar");
        // The moment the app decides to reload, it writes down the build
        // it reloads for. Whether the answer is on the screen at that
        // moment is written down beside it.
        const marks = [];
        await app.page.exposeFunction("auditReloadMark", (m) => { marks.push(m); });
        await app.page.evaluate((want) => {
          const set = Storage.prototype.setItem;
          Storage.prototype.setItem = function (k, v) {
            if (this === window.sessionStorage && k === "ocsa-update-tried") {
              const drawn = Array.from(document.querySelectorAll(".sp-content div")).some(d => d.children.length === 0 && d.textContent.trim() === want);
              window.auditReloadMark(drawn ? "after the answer was drawn" : "before the answer was drawn");
            }
            return set.apply(this, arguments);
          };
        }, words);
        app.stub.state.chat.holdMs = 1500;
        await tapSend(app.page, language);
        for (let i = 0; i < 40 && marks.length === 0; i += 1) await pause(app.page, 150);
        expect("the app does not reload while the message is on its way", marks[0] !== "before the answer was drawn", JSON.stringify(marks));
        expect("once the answer is drawn, the update goes ahead", marks[0] === "after the answer was drawn", JSON.stringify(marks));
        expect("the message was sent once", chatSends(app.stub, words).length === 1 && chatSaved(app.stub, "ch-north", words) === 1, chatSends(app.stub, words).length + " sent");
        await app.page.waitForSelector(".sp-content", { timeout: 20000 }).catch(() => {});
        await pause(app.page, 1500);
        expect("the app comes back after the update", await app.page.evaluate(() => !!document.querySelector(".sp-content") && document.body.innerText.trim().length > 0), "blank");
      } finally { await app.context.close(); }
    },
  },
  {
    id: "chatbadge",
    label: "Chat says what arrived and who it is for: the bar's Chat count sums the chats' counts and goes as each is opened, a read told once per opening, Tag someone from a typed @ and from its button and never in a private chat, a deleted @Name dropped from the send, and a tag drawn highlighted with the bubble marked only for the person tagged",
    run: async (open, language, expect) => {
      // The count on the bar's Chat tab, as drawn: its numeral, or "" for
      // none at all.
      const chatCount = (page) => page.evaluate((want) => {
        const bar = Array.from(document.querySelectorAll("div")).find((el) => { const s = getComputedStyle(el); return s.position === "fixed" && s.bottom === "0px" && el.querySelectorAll(":scope > button").length >= 5; });
        const b = bar && Array.from(bar.querySelectorAll(":scope > button")).find(x => x.textContent.trim().replace(/^[\d+]+/, "") === want);
        if (!b) return null;
        const n = Array.from(b.querySelectorAll("div")).find(d => d.children.length === 0 && /^\d+\+?$/.test(d.textContent.trim()));
        return n ? n.textContent.trim() : "";
      }, say("Chat", language));
      const readsOf = (stub, id) => stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/chat/channels/" + id + "/read").length;
      const tagUp = (page) => page.evaluate(() => !!document.getElementById("ocsa-tag-title"));
      const tagButton = (page) => page.evaluate((label) => Array.from(document.querySelectorAll(".sp-content button")).some(b => (b.getAttribute("aria-label") || "") === label), say("Tag someone", language));
      const pickInSheet = (page, name) => page.evaluate((want) => {
        const d = document.getElementById("ocsa-tag-title");
        const sheet = d && d.closest('[role="dialog"]');
        const b = sheet && Array.from(sheet.querySelectorAll("button")).find(x => x.innerText.replace(/\s+/g, " ").trim().indexOf(want) === 0);
        if (b) b.click();
        return !!b;
      }, name);
      const app = await open({ stubOptions: { chat: { unread: { "ch-north": 2, "ch-all": 3, "dm-u-one": 0 }, tagged: true } } });
      try {
        await pause(app.page, 600);
        expect("before Chat is opened, the bar's Chat count is the two chats' counts summed", (await chatCount(app.page)) === "5", JSON.stringify(await chatCount(app.page)));
        await openChat(app.page, language);
        await tapChat(app.page, "North Building");
        await pause(app.page, 1300);
        expect("opening one chat takes its count off at once", (await chatCount(app.page)) === "3", JSON.stringify(await chatCount(app.page)));
        expect("opening it tells the API once", readsOf(app.stub, "ch-north") === 1, readsOf(app.stub, "ch-north") + " reads");
        await tapChat(app.page, chatName({ id: "ch-all", type: "general", name: "All staff" }, language));
        await pause(app.page, 1300);
        expect("opening the other takes the count off the bar", (await chatCount(app.page)) === "", JSON.stringify(await chatCount(app.page)));
        expect("the other is told once too, and the first no more", readsOf(app.stub, "ch-all") === 1 && readsOf(app.stub, "ch-north") === 1, readsOf(app.stub, "ch-all") + " and " + readsOf(app.stub, "ch-north") + " reads");

        // In the site chat: a message that tags the reader is marked, one
        // that tags someone else is not, and both draw the tag highlighted.
        await tapChat(app.page, "North Building");
        await pause(app.page, 1200);
        const marks = await app.page.evaluate((texts) => texts.map((want) => {
          const d = Array.from(document.querySelectorAll(".sp-content div")).find(x => x.innerText.replace(/\s+/g, " ").trim() === want && x.querySelector("span"));
          if (!d) return null;
          const tag = Array.from(d.querySelectorAll("span")).map(s => ({ text: s.textContent.trim(), weight: Number(getComputedStyle(s).fontWeight) }));
          return { tag: tag, background: getComputedStyle(d).backgroundColor };
        }), ["@Alex Tester can you check the side door", "@Sam Second the spare key is at the desk"]);
        const [mine, theirs] = marks;
        expect("a tag is drawn highlighted", !!mine && !!theirs && mine.tag.some(s => s.text === "@Alex Tester" && s.weight >= 600) && theirs.tag.some(s => s.text === "@Sam Second" && s.weight >= 600), JSON.stringify(marks));
        expect("the bubble is marked only where the reader is tagged", !!mine && !!theirs && /231, 176, 23/.test(mine.background) && !/231, 176, 23/.test(theirs.background), JSON.stringify(marks));

        // Tag someone, from a typed @ and from its button.
        expect("a site chat offers Tag someone", await tagButton(app.page), "no button");
        await type(app.page, CHAT_BOX, "@");
        await pause(app.page, 500);
        expect("an @ typed at the start of a word opens Tag someone", await tagUp(app.page), "the sheet did not open");
        await spokenHere(app, language, expect);
        await pickInSheet(app.page, "Sam Second");
        await pause(app.page, 400);
        expect("a pick puts @Name and a space in the words", (await boxText(app.page, CHAT_BOX)) === "@Sam Second ", JSON.stringify(await boxText(app.page, CHAT_BOX)));
        await tapLabel(app.page, say("Tag someone", language));
        await pause(app.page, 500);
        expect("the button opens Tag someone too", await tagUp(app.page), "the sheet did not open");
        await pickInSheet(app.page, "Jordan Office");
        await pause(app.page, 400);
        // One of the two tags is deleted from the words before the send.
        const words = "@Sam Second please check the side door";
        await type(app.page, CHAT_BOX, words);
        await pause(app.page, 300);
        await tapSend(app.page, language);
        await pause(app.page, 1200);
        const last = chatSends(app.stub, words).pop();
        expect("a deleted @Name drops its id from the send, and the one left is sent", !!last && JSON.stringify(last.body.mentions) === JSON.stringify([SECOND_PERSON.id]), last ? JSON.stringify(last.body) : "nothing sent");

        // A private chat has no Tag someone, and an @ opens nothing.
        await tapChat(app.page, say("Admin (Private)", language));
        await pause(app.page, 1200);
        expect("a private chat has no Tag someone", !(await tagButton(app.page)), "the button is there");
        await type(app.page, CHAT_BOX, "@");
        await pause(app.page, 500);
        expect("an @ in a private chat opens nothing", !(await tagUp(app.page)), "the sheet opened");
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }

      // A chat nobody else can read says so, and an API with no members
      // route hides Tag someone altogether.
      const alone = await open({ stubOptions: { chat: { alone: true } } });
      try {
        await openChat(alone.page, language);
        await tapChat(alone.page, "North Building");
        await pause(alone.page, 1000);
        await tapLabel(alone.page, say("Tag someone", language));
        await pause(alone.page, 600);
        expect("a chat with nobody else says so", has(await sheetText(alone.page), spanishOf("No one else can read this chat.", language)), (await sheetText(alone.page)).slice(0, 160));
        await spokenHere(alone, language, expect);
      } finally { await alone.context.close(); }
      const noRoute = await open({ stubOptions: { chat: { membersRoute: false } } });
      try {
        await openChat(noRoute.page, language);
        await tapChat(noRoute.page, "North Building");
        await pause(noRoute.page, 1000);
        expect("an API that answers 404 on the members route shows no Tag someone", !(await tagButton(noRoute.page)), "the button is there");
      } finally { await noRoute.context.close(); }
    },
  },
  {
    id: "chatodd",
    label: "Chat: a send answered without its message, and message rows missing a field, never blank the app",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { chat: { oddRows: true } } });
      const alive = () => app.page.evaluate(() => !!document.querySelector(".sp-content") && document.body.innerText.trim().length > 0);
      try {
        await openChat(app.page, language);
        await tapChat(app.page, "North Building");
        await pause(app.page, 1000);
        const said = await bodyText(app.page);
        expect("rows missing a field are drawn with what they have", (await alive()) && has(said, "A note with no name on it.") && has(said, "A note with no time on it.") && has(said, "A note with no id on it."), said.slice(0, 300));
        expect("a row with no time draws no broken time", !/Invalid Date|NaN/.test(said), said.slice(0, 300));
        const words = "An invented note answered without its message";
        app.stub.state.chat.noMessage = true;
        const reads = chatReads(app.stub).length;
        await type(app.page, CHAT_BOX, words);
        await pause(app.page, 300);
        await tapSend(app.page, language);
        await pause(app.page, 1500);
        expect("a send answered without its message leaves the app drawn", await alive(), "the app went blank");
        expect("a send answered without its message reads the chat again", chatReads(app.stub).length > reads, "no read");
        expect("the message it sent shows once and the box empties", (await bubbles(app.page, words)).length === 1 && (await boxText(app.page, CHAT_BOX)) === "", (await bubbles(app.page, words)).length + " drawn, box " + JSON.stringify(await boxText(app.page, CHAT_BOX)));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
];

// --- weak signal and lost work (part 344, contract 5.16) ----------------
//
// Each action a cleaner takes on a phone that sends something, put through
// four kinds of trouble in the middle of it: the signal gone as the tap is
// made (the browser's offline switch, with the stub's own, since a routed
// request never meets the browser's); the API answering 500 once; the API
// taking 30 seconds, with a second tap while it waits (English alone, since
// the wait is the same in both); and the API keeping the work while the
// answer is lost on the way back, then the person trying again. Each run
// asks four things: is the work kept, does the screen say it has not gone,
// does it go by itself once the signal is back, and does the API end up
// with it once. A must that fails is a row; every answer goes to the file
// AUDIT_WEAK_TABLE names, one JSON line each, for the findings' table.
const WEAK_HOLD_MS = 30000;
const weakLines = (language) => [
  "Could not reach OCSA. Check your connection and try again.",
  "Something went wrong on our end. Try again in a minute.",
  "Saved on this phone. It sends when you have signal.",
  "Not sent yet. Check your signal and tap Submit report again.",
  "This was not signed. Try again.",
  "Photo upload failed",
  // Part 355: End Shift kept on the phone.
  "Your shift end is saved on this phone, with the time you tapped it. It sends when you have signal.",
].map(w => say(w, language));
const weakSeen = (page, lines, ms) => page.waitForFunction((ls) => {
  const text = document.body.innerText;
  return ls.some(l => text.indexOf(l) !== -1);
}, lines, { timeout: ms || 2500 }).then(() => true).catch(() => false);
const weakWrite = (line) => {
  const file = process.env.AUDIT_WEAK_TABLE;
  if (!file) return;
  try { require("fs").appendFileSync(file, JSON.stringify(line) + "\n"); } catch (e) {}
};
// A task's box by its label, read from the label's own pattern in the
// screen's language: one not done yet (Mark {name} done), or one done
// (Mark {name} not done), and the name it carries.
const labelRe = (template) => new RegExp("^" + template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("\\{name\\}", "(.+)") + "$");
const taskBox = (page, language, done) => page.evaluate(([on, off, wantDone]) => {
  const onRe = new RegExp(on), offRe = new RegExp(off);
  const b = Array.from(document.querySelectorAll(".sp-content button[aria-label]")).find((x) => {
    const l = x.getAttribute("aria-label");
    return !x.disabled && (wantDone ? offRe.test(l) : (onRe.test(l) && !offRe.test(l)));
  });
  return b ? b.getAttribute("aria-label") : null;
}, [labelRe(say("Mark {name} done", language)).source, labelRe(say("Mark {name} not done", language)).source, !!done]);
const nameIn = (label, template) => { const m = labelRe(template).exec(label || ""); return m ? m[1] : null; };
const tapAria = (page, label) => page.evaluate((l) => { const b = Array.from(document.querySelectorAll("button[aria-label]")).find(x => x.getAttribute("aria-label") === l); if (b) b.click(); return !!b; }, label);
const pendingTaps = (page) => page.evaluate(() => { try { const v = JSON.parse(window.localStorage.getItem("ocsa-pending-checkoffs") || "[]"); return Array.isArray(v) ? v.length : 0; } catch (e) { return -1; } });
const boxValue = (page, selector, n) => page.evaluate(([sel, i]) => { const e = document.querySelectorAll(sel)[i || 0]; return e ? e.value : null; }, [selector, n]);

// What each action is: the call it makes (path; reach adds the calls on
// the way to it, such as a photo's upload), how a person gets to the tap,
// the tap, and whether the work is still there. same tells two of the
// same apart where the API does (one clientId twice is one check-off),
// and queued says a kept tap goes again by itself, so a lost answer is
// never tried again by hand.
// must names the questions whose no is a fault for this action: kept,
// queue (goes by itself once the signal is back) and once (the API ends
// up with one record). said is a must for every action.
const issueReady = (photo) => async (app, language) => {
  await openTab(app.page, "issues", language);
  await clickText(app.page, say("Report an Issue", language));
  await typeNth(app.page, ".sp-content input", 0, "A leak under the sink, weak signal");
  if (photo) { await attachPhoto(app.page, '.sp-content input[type="file"]'); await pause(app.page, 700); }
  return {};
};
const sameClientId = (calls) => { const ids = calls.map(c => c.body && c.body.clientId); return ids.filter(x => !x).length + new Set(ids.filter(Boolean)).size; };
const WEAK_ACTIONS = [
  {
    id: "checkoff", name: "a check-off", method: "POST", path: /^\/api\/clock\/tasks\/[^/]+\/complete$/, must: ["kept", "queue", "once"],
    ready: async (app, language) => { await openTab(app.page, "tasks", language); await pause(app.page, 1200); return { label: await taskBox(app.page, language, false) }; },
    tap: async (app, language, ctx) => { await tapAria(app.page, ctx.label); },
    kept: async (app) => (await pendingTaps(app.page)) > 0,
    same: (calls) => new Set(calls.map(c => c.body && c.body.clientId)).size,
    queued: true,
  },
  {
    id: "uncheck", name: "an uncheck", method: "DELETE", path: /^\/api\/clock\/tasks\/[^/]+\/complete$/, must: ["kept", "queue", "once"],
    ready: async (app, language) => {
      await openTab(app.page, "tasks", language); await pause(app.page, 1200);
      const label = await taskBox(app.page, language, false);
      await tapAria(app.page, label); await pause(app.page, 1200);
      return { label: say("Mark {name} not done", language).replace("{name}", nameIn(label, say("Mark {name} done", language))) };
    },
    tap: async (app, language, ctx) => { await tapAria(app.page, ctx.label); },
    kept: async (app) => (await pendingTaps(app.page)) > 0,
    same: (calls) => new Set(calls.map(c => c.body && c.body.clientId)).size,
    queued: true,
  },
  {
    id: "startshift", name: "Start Shift", method: "POST", path: /^\/api\/shift-sessions$/, stubOptions: { clockedIn: false }, must: [],
    ready: async (app, language) => { await openTab(app.page, "clock", language); await pause(app.page, 900); await pickSite(app.page, "North Building"); await pause(app.page, 400); return {}; },
    tap: async (app, language) => { await clickText(app.page, say("Start Shift", language)); },
    kept: async (app, language) => app.page.evaluate((w) => Array.from(document.querySelectorAll(".sp-content button")).some(b => b.textContent.trim() === w && !b.disabled), say("Start Shift", language)),
  },
  {
    id: "endshift", name: "End Shift", method: "POST", path: /^\/api\/shift-sessions\/[^/]+\/end$/, must: ["queue", "once"],
    ready: async (app, language) => { await openTab(app.page, "clock", language); await pause(app.page, 900); return {}; },
    tap: async (app, language) => { await clickText(app.page, say("End Shift", language)); },
    kept: async (app, language) => app.page.evaluate((w) => Array.from(document.querySelectorAll(".sp-content button")).some(b => b.textContent.trim() === w), say("End Shift", language)),
  },
  {
    id: "issue", name: "an issue with a photo", method: "POST", path: /^\/api\/issues$/, reach: /^\/api\/(uploads|issues)$/, must: ["kept", "once"],
    ready: issueReady(true),
    tap: async (app, language) => { await clickText(app.page, say("Submit Issue", language)); },
    kept: async (app) => (await boxValue(app.page, ".sp-content input", 0)) === "A leak under the sink, weak signal",
    // Since part 355 a report carries a clientId the API keeps it once
    // by: sends with one clientId are one record, a send with none is one
    // each.
    same: sameClientId,
  },
  {
    id: "issuenophoto", name: "an issue with no photo", method: "POST", path: /^\/api\/issues$/, must: ["kept", "once"],
    ready: issueReady(false),
    tap: async (app, language) => { await clickText(app.page, say("Submit Issue", language)); },
    kept: async (app) => (await boxValue(app.page, ".sp-content input", 0)) === "A leak under the sink, weak signal",
    // Since part 355 a report carries a clientId the API keeps it once
    // by: sends with one clientId are one record, a send with none is one
    // each.
    same: sameClientId,
  },
  {
    id: "form", name: "a form submit", method: "POST", path: /^\/api\/forms\/drafts\/[^/]+\/submit$/, must: ["kept", "once"],
    // The incident report with every required answer already in its
    // draft, since the suite does not fill that form in yet: Next through
    // its pages to the review, then Submit report, which asks first.
    setup: (stub) => { stub.state.answers = { when: "2026-10-01", where: "Lobby", what: "Water on the floor by the doors", hurt: "no" }; },
    ready: async (app, language) => {
      await openTab(app.page, "forms", language); await pause(app.page, 900);
      await clickText(app.page, say("Start report", language)); await pause(app.page, 1300);
      for (let i = 0; i < 5; i += 1) { if (!(await clickText(app.page, say("Next", language)))) break; await pause(app.page, 700); }
      await clickText(app.page, say("Submit report", language)); await pause(app.page, 600);
      return {};
    },
    tap: async (app, language) => {
      // The send asks first; a second tap after a lost answer asks again.
      if (!(await clickText(app.page, say("Send it", language)))) { await clickText(app.page, say("Submit report", language)); await pause(app.page, 500); await clickText(app.page, say("Send it", language)); }
    },
    kept: async (app, language) => app.page.evaluate((w) => Array.from(document.querySelectorAll("button")).some(b => b.textContent.trim() === w.submit || b.textContent.trim() === w.send), { submit: say("Submit report", language), send: say("Send it", language) }),
  },
  {
    id: "signature", name: "a signature", method: "POST", path: /^\/api\/signatures\/[^/]+\/sign$/, stubOptions: { signatures: true }, path0: "/sign/sr-1", must: ["kept", "once"],
    ready: async (app) => {
      await app.page.waitForSelector('[data-sign-signature="1"] canvas', { timeout: 8000 }).catch(() => {});
      const sel = '[data-sign-signature="1"] canvas';
      await app.page.$eval(sel, (el) => el.scrollIntoView({ block: "center" })).catch(() => {});
      const box = await (await app.page.$(sel)).boundingBox();
      await app.page.mouse.move(box.x + 30, box.y + box.height * 0.6); await app.page.mouse.down();
      for (let i = 1; i <= 8; i += 1) await app.page.mouse.move(box.x + 30 + i * 20, box.y + box.height * (0.6 - (i % 2) * 0.2));
      await app.page.mouse.up(); await pause(app.page, 300);
      return {};
    },
    tap: async (app) => { await app.page.click('[data-sign-send="1"]', { timeout: 3000 }).catch(() => {}); },
    kept: async (app) => app.page.evaluate(() => !!document.querySelector('[data-sign="ready"][data-sign-state="waiting"] [data-sign-send="1"]')),
  },
  {
    id: "timeoff", name: "a time off request", method: "POST", path: /^\/api\/time-off$/, must: ["kept"],
    ready: async (app, language) => {
      await openTab(app.page, "schedule", language);
      await clickText(app.page, say("Request time off", language));
      await type(app.page, 'div[style*="z-index: 200"] select', "paid_sick");
      await typeNth(app.page, 'div[style*="z-index: 200"] input[type="date"]', 0, "2026-10-12");
      await typeNth(app.page, 'div[style*="z-index: 200"] input[type="date"]', 1, "2026-10-13");
      return {};
    },
    tap: async (app, language) => { await clickText(app.page, say("Send request", language)); },
    kept: async (app) => (await boxValue(app.page, 'div[style*="z-index: 200"] input[type="date"]', 0)) === "2026-10-12",
  },
];
const WEAK_TROUBLES = [
  { id: "offline", name: "the signal gone as the tap is made" },
  { id: "500", name: "the API answering 500" },
  { id: "slow", name: "the API taking 30 seconds, tapped twice", only: "en" },
  { id: "lost", name: "the work kept and the answer lost, then tried again" },
];
const weakJourneys = WEAK_ACTIONS.map(action => ({
  id: "weak" + action.id,
  label: "Weak signal: " + action.name + ", with the signal gone, a 500, 30 seconds and a lost answer",
  run: async (open, language, expect) => {
    for (const trouble of WEAK_TROUBLES) {
      if (trouble.only && trouble.only !== language) continue;
      const app = await open(Object.assign({ stubOptions: Object.assign({}, action.stubOptions || {}) }, action.path0 ? { path: action.path0 } : {}));
      // Every answer the stub gives, by status, so a repeat the API turns
      // away is never counted as a second record.
      const answers = [];
      const handle = app.stub.handle;
      app.stub.handle = (method, pathname, ...rest) => {
        const tr = app.stub.state.trouble;
        const met = tr ? tr.met || 0 : 0;
        const a = handle(method, pathname, ...rest);
        // The call whose answer was lost after the API kept its work.
        const saved = !!tr && tr.kind === "lose" && (tr.met || 0) > met && tr.saved >= 200 && tr.saved < 300;
        answers.push({ method: method, path: pathname, status: a && !a.abort ? a.status : null, saved: saved, body: rest[1] || null });
        return a;
      };
      const hits = (re) => answers.filter(c => c.method === action.method && re.test(c.path));
      const made = (from) => { const ok = hits(action.path).slice(from).filter(c => c.saved || (c.status >= 200 && c.status < 300)); return action.same ? action.same(ok) : ok.length; };
      const answer = { action: action.id, trouble: trouble.id, language: language };
      try {
        if (action.setup) action.setup(app.stub);
        await pause(app.page, 700);
        const ctx = await action.ready(app, language);
        const lines = weakLines(language);
        const reachRe = action.reach || action.path;
        const before = hits(action.path).length;
        const reachedFrom = answers.filter(c => reachRe.test(c.path)).length;
        if (trouble.id === "offline") {
          await app.context.setOffline(true); app.stub.state.offline = true;
          await action.tap(app, language, ctx);
          answer.said = await weakSeen(app.page, lines);
          await pause(app.page, 800);
          answer.kept = await action.kept(app, language, ctx);
          const cut = hits(action.path).length;
          answer.reached = answers.filter(c => reachRe.test(c.path)).length > reachedFrom;
          app.stub.state.offline = false; await app.context.setOffline(false);
          await pause(app.page, 6000);
          answer.wentByItself = made(cut) > 0;
          answer.records = made(before);
        } else {
          const kind = trouble.id === "500" ? "500" : trouble.id === "slow" ? "hold" : "lose";
          app.stub.state.trouble = { method: action.method, path: action.path, kind: kind, ms: WEAK_HOLD_MS };
          await action.tap(app, language, ctx);
          if (trouble.id === "slow") {
            await pause(app.page, 1500);
            answer.busyShown = await app.page.evaluate(() => Array.from(document.querySelectorAll("button")).some(b => b.disabled || /\.\.\.$/.test(b.textContent.trim())));
            await action.tap(app, language, ctx);
            await pause(app.page, WEAK_HOLD_MS + 1500);
          } else {
            answer.said = await weakSeen(app.page, lines);
            await pause(app.page, 800);
            answer.kept = await action.kept(app, language, ctx);
            if (trouble.id === "500") { const after = hits(action.path).length; await pause(app.page, 6000); answer.wentByItself = made(after) > 0; }
            else if (!action.queued) {
              // The person tries again: the same tap if the work is still
              // there, and the work done again if it is gone. A kept
              // check-off goes again by itself.
              if (answer.kept) await action.tap(app, language, ctx);
              else { const again = await action.ready(app, language); await action.tap(app, language, again); }
              await pause(app.page, 3000);
            } else await pause(app.page, 6000);
          }
          answer.reached = (app.stub.state.trouble.met || 0) > 0;
          // A lost answer's work was kept by the API all the same, and made()
          // counts it.
          answer.records = made(before);
          answer.calls = hits(action.path).length - before;
        }
        weakWrite(answer);
        const where = " (" + trouble.name + ")";
        const must = (q) => action.must.indexOf(q) !== -1;
        if (!answer.reached) { expect(action.name + " reached the API" + where, false, "the tap sent nothing: " + JSON.stringify(answers.slice(-4).map(c => c.method + " " + c.path))); continue; }
        if (trouble.id !== "slow") {
          if (must("kept")) expect(action.name + " is kept on the phone" + where, answer.kept, "the work is gone from the screen and the phone");
          expect(action.name + " says it has not gone" + where, answer.said, "no line said it was not sent");
        }
        if (trouble.id === "offline" && must("queue")) expect(action.name + " goes by itself once the signal is back" + where, answer.wentByItself, "nothing was sent after the signal came back");
        if ((trouble.id === "slow" || trouble.id === "lost") && must("once")) expect(action.name + " reaches the API once" + where, answer.records <= 1, answer.records + " records from " + answer.calls + " calls");
      } catch (e) {
        weakWrite(Object.assign(answer, { error: String(e.message).split("\n")[0] }));
        expect(action.name + " ran to the end (" + trouble.name + ")", false, String(e.message).split("\n")[0].slice(0, 160));
      } finally { await app.context.close(); }
    }
  },
}));

async function runJourneys(browser, base, opts) {
  const o = opts || {};
  const rows = [];
  const covered = [];
  const extra = { refusalsShown: 0 };
  const gaps = [];

  // AUDIT_JOURNEY=<id>,<id> runs only the journeys named, for working on
  // one (part 344); a full run drives them all.
  const named = String(process.env.AUDIT_JOURNEY || "").split(",").map(x => x.trim()).filter(Boolean);
  const chosen = named.length ? JOURNEYS.filter(j => named.indexOf(j.id) !== -1) : JOURNEYS;
  // Since part 344 each journey in each language is a piece run in lanes
  // (audit/lanes.js).
  const pieces = [];
  chosen.forEach(journey => LANGUAGES.forEach(language => pieces.push({ journey, language })));
  await inLanes(pieces, async ({ journey, language }) => {
    {
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
  });
  // A journey that judges the same screen twice reports each fault once.
  const once = new Set();
  const unique = rows.filter((r) => { const k = r.where + "|" + r.check + "|" + r.detail; if (once.has(k)) return false; once.add(k); return true; });
  rows.length = 0;
  unique.forEach(r => rows.push(r));
  return { rows: rows, covered: covered, journeys: JOURNEYS.length, refusalsShown: extra.refusalsShown, refusalsTotal: (TIME_OFF_REFUSALS.length + HR_CASE_REFUSALS.length + SHIFT_REFUSALS.length + CHAT_SEND_REFUSALS.length + Object.keys(API_REFUSALS).length) * LANGUAGES.length, gaps: gaps };
}

JOURNEYS.push(...weakJourneys);

// --- Round 1 (part 348): nothing a cleaner does is lost ------------------
//
// One journey for each Now finding Round 1 fixes that no case asked
// before: a check-off whose send stalls (PORT-04), check-offs waiting
// through a sign-out and someone else's sign-in (PORT-05), a resolution
// whose save fails (PORT-02), an issue whose photo does not attach
// (PORT-01), and the guide's steps for More and Home against the screen
// (PORT-12). Each fails on the main of part 344 and passes once its fix
// is in.
const CHECKOFF_PATH = /^\/api\/clock\/tasks\/[^/]+\/complete$/;
const checkoffSends = (stub) => stub.state.calls.filter(c => c.method === "POST" && CHECKOFF_PATH.test(c.path));
const doneLabel = (language, label) => say("Mark {name} not done", language).replace("{name}", nameIn(label, say("Mark {name} done", language)));
const hasAria = (page, label) => page.evaluate((l) => Array.from(document.querySelectorAll("button[aria-label]")).some(x => x.getAttribute("aria-label") === l), label);
const SAVED_LINE = "Saved on this phone. It sends when you have signal.";
// An entry of the guide, from its title line to the next.
const guideEntry = (title) => {
  const text = require("fs").readFileSync(require("path").join(__dirname, "..", "guide", "APP-PORTAL.md"), "utf8");
  const at = text.indexOf("## " + title + "\n");
  if (at === -1) return "";
  const end = text.indexOf("\n## ", at + 3);
  return text.slice(at, end === -1 ? text.length : end);
};
const ROUND1_SUPERVISOR = Object.assign({}, PERSON, { id: "u-round1-sup", role: "supervisor" });

const ROUND1_JOURNEYS = [
  {
    id: "stalledcheckoff",
    label: "A check-off whose send stalls: on the phone before it is sent, no signal after 15 seconds, and sent once by itself after the app is closed and opened again",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1200);
        const label = await taskBox(app.page, language, false);
        // The API takes the tap and answers a minute late.
        app.stub.state.trouble = { method: "POST", path: CHECKOFF_PATH, kind: "hold", ms: 60000 };
        await tapAria(app.page, label);
        await pause(app.page, 500);
        const waiting = await pendingTaps(app.page);
        expect("a check-off is kept on the phone before its send has an answer", waiting === 1, waiting + " on the phone while the send waits");
        expect("the box shows the tap at once", await hasAria(app.page, doneLabel(language, label)), "the box did not change while the send waits");
        expect("the saved line waits until a send has failed", !has(await bodyText(app.page), say(SAVED_LINE, language)), "shown while the first send waited");
        const shown = await weakSeen(app.page, [say(SAVED_LINE, language)], 18000);
        expect("a send with no answer in 15 seconds is no signal, and the line says the tap is saved on the phone", shown, "no line after 18 seconds");
        expect("the tap is still on the phone once the send ran out of time", (await pendingTaps(app.page)) === 1, (await pendingTaps(app.page)) + " on the phone");
        // The app closed and opened again with signal: the tap goes by
        // itself and leaves the phone.
        await app.page.reload();
        await pause(app.page, 3000);
        const sends = checkoffSends(app.stub);
        const left = await pendingTaps(app.page);
        expect("after the app opens again the tap goes by itself and leaves the phone", sends.length >= 2 && left === 0, sends.length + " sends, " + left + " on the phone");
        expect("every send of the tap carries one clientId, so the API keeps it once", new Set(sends.map(c => c.body && c.body.clientId)).size === 1, JSON.stringify(sends.map(c => c.body)));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "signoutkeeps",
    label: "Check-offs waiting through a sign-out: kept on the phone under the person, never sent under someone else's sign-in, and sent at the person's own next sign-in",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1200);
        const label = await taskBox(app.page, language, false);
        await app.context.setOffline(true); app.stub.state.offline = true;
        await tapAria(app.page, label);
        await pause(app.page, 900);
        expect("a tap with no signal is kept on the phone", (await pendingTaps(app.page)) === 1, (await pendingTaps(app.page)) + " on the phone");
        await tapAria(app.page, say("Sign out", language));
        await pause(app.page, 1500);
        expect("signing out with no signal keeps the tap on the phone", (await pendingTaps(app.page)) === 1, (await pendingTaps(app.page)) + " on the phone after signing out");
        app.stub.state.offline = false; await app.context.setOffline(false);
        // The sends tried with no signal are behind this mark.
        const tried = checkoffSends(app.stub).length;
        // Someone else signs in on the same phone (the suite's session
        // comes back on a reload, as the stub's second person).
        app.stub.state.person = Object.assign({}, SECOND_PERSON);
        await app.page.reload();
        await pause(app.page, 2000);
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1500);
        expect("another person's sign-in sends nothing of the first person's", checkoffSends(app.stub).length === tried, (checkoffSends(app.stub).length - tried) + " sent under the second person");
        expect("another person's sign-in keeps the first person's tap on the phone", (await pendingTaps(app.page)) === 1, (await pendingTaps(app.page)) + " on the phone");
        expect("the second person's checklist does not say the first person's tap is waiting", !has(await bodyText(app.page), say(SAVED_LINE, language)), "the saved line showed for someone else's tap");
        // The first person signs in again.
        app.stub.state.person = Object.assign({}, PERSON);
        await app.page.reload();
        await pause(app.page, 3000);
        const sends = checkoffSends(app.stub).slice(tried);
        expect("the person's own next sign-in sends their tap once and it leaves the phone", sends.length === 1 && (await pendingTaps(app.page)) === 0, sends.length + " sent, " + (await pendingTaps(app.page)) + " on the phone");
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "resolvekeeps",
    label: "A resolution whose save fails keeps the note and the photo, says why, and is saved on Submit Resolution again with the photo sent once",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "issuetasks", language);
        await pause(app.page, 900);
        await openItem(app.page, "Replace the cracked light cover");
        await pause(app.page, 700);
        await clickText(app.page, say("Resolved", language));
        const note = "Put a new cover on, weak signal";
        await typeNth(app.page, ".sp-content textarea", 0, note);
        await attachPhoto(app.page, '.sp-content input[type="file"]');
        await pause(app.page, 700);
        app.stub.state.trouble = { method: "PATCH", path: /^\/api\/clock\/tasks\/resolve\//, kind: "500" };
        await clickText(app.page, say("Submit Resolution", language));
        const said = await weakSeen(app.page, weakLines(language), 4000);
        await pause(app.page, 600);
        const kept = await boxValue(app.page, ".sp-content textarea", 0);
        const photo = await app.page.evaluate(() => !!document.querySelector('.sp-content img[src^="data:"]'));
        expect("a resolution whose save fails says why", said, "no line said it was not saved");
        expect("a resolution whose save fails keeps the note", kept === note, JSON.stringify(kept));
        expect("a resolution whose save fails keeps the photo", photo, "the photo is gone");
        await clickText(app.page, say("Submit Resolution", language));
        await pause(app.page, 1500);
        const saves = sent(app.stub, "PATCH", "/api/clock/tasks/resolve/");
        const ups = sent(app.stub, "POST", "/api/uploads");
        expect("Submit Resolution again saves it, with the note", saves.length === 2 && saves[1].body && saves[1].body.resolutionNote === note && !!saves[1].body.photoUrl, JSON.stringify(saves.map(c => c.body)));
        expect("the photo is sent once", ups.length === 1, ups.length + " uploads");
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "issuephoto",
    label: "An issue whose photo does not attach: the issue goes once, the screen says the photo did not attach, and Try again attaches it to the same issue",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await issueReady(true)(app, language);
        app.stub.state.trouble = { method: "POST", path: /^\/api\/issues\/[^/]+\/photos$/, kind: "500" };
        await clickText(app.page, say("Submit Issue", language));
        await pause(app.page, 1500);
        const line = say("Issue reported. Its photo did not attach.", language);
        expect("the screen says the photo did not attach", has(await bodyText(app.page), line), (await bodyText(app.page)).slice(0, 220));
        expect("the issue went once", app.stub.state.issues.length === 1, app.stub.state.issues.length + " issues");
        await clickText(app.page, say("Try again", language));
        await pause(app.page, 1500);
        const issues = app.stub.state.issues;
        expect("Try again attaches the photo to the same issue, and the line goes", issues.length === 1 && issues[0].photos.length === 1 && !has(await bodyText(app.page), line), issues.length + " issues, " + (issues[0] ? issues[0].photos.length : 0) + " photos");
        expect("the photo is uploaded once", sent(app.stub, "POST", "/api/uploads").length === 1, sent(app.stub, "POST", "/api/uploads").length + " uploads");
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "guidemore",
    label: "Help's steps for More and Home match the screen: every place under More is named in Use the bottom bar and More, and Home's cards are named in What Home shows in the order Home draws them",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { person: ROUND1_SUPERVISOR, sds: true, workspace: true, fieldKit: true, training: true, signatures: true, support: true, library: true, unfinishedForms: true, requests: true } });
      try {
        await pause(app.page, 2500);
        // Home's cards, by the words each one opens with, where the screen
        // shows them.
        // Each card as the guide names it, with the words it reads for one.
        const CARDS = [
          ["Your first trainings", null],
          ["{n} to sign", "1 to sign"],
          ["Unfinished forms ({n})", null],
          ["{n} client requests need you", "1 client request needs you"],
          ["{n} trainings to do", "1 training to do"],
        ];
        const text = await bodyText(app.page);
        const where = (en, one) => {
          const re = new RegExp(say(en, language).split("{n}").map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\d+"));
          const m = re.exec(text);
          const i = m ? m.index : -1;
          const j = one ? text.indexOf(say(one, language)) : -1;
          return i === -1 ? j : j === -1 ? i : Math.min(i, j);
        };
        const onHome = CARDS.map(([en, one]) => ({ en: en, at: where(en, one) })).filter(c => c.at !== -1).sort((a, b) => a.at - b.at).map(c => c.en);
        const home = guideEntry("What Home shows (staff portal)");
        const inGuide = onHome.map(en => home.indexOf("**" + en + "**"));
        expect("Home shows at least three of its cards here", onHome.length >= 3, JSON.stringify(onHome));
        expect("What Home shows names every card Home shows", inGuide.every(i => i !== -1), JSON.stringify(onHome.filter((en, k) => inGuide[k] === -1)));
        expect("What Home shows names Home's cards in the order Home draws them", inGuide.every((i, k) => k === 0 || i > inGuide[k - 1]), JSON.stringify(onHome));
        // More, the bar's last button.
        await app.page.evaluate(() => {
          const bar = Array.from(document.querySelectorAll("div")).find((el) => { const st = getComputedStyle(el); return st.position === "fixed" && st.bottom === "0px" && el.querySelectorAll(":scope > button").length >= 5; });
          const b = bar && Array.from(bar.querySelectorAll(":scope > button")).pop();
          if (b) b.click();
        });
        await pause(app.page, 1500);
        const items = await app.page.evaluate(() => {
          const grid = Array.from(document.querySelectorAll(".sp-more div")).find(d => getComputedStyle(d).display === "grid" && d.querySelectorAll(":scope > button").length >= 5);
          return grid ? Array.from(grid.querySelectorAll(":scope > button")).map(x => x.textContent.trim().replace(/^(9\+|\d+)/, "")) : [];
        });
        const more = guideEntry("Use the bottom bar and More (staff portal)");
        const missing = items.filter(w => more.indexOf("**" + w + "**") === -1);
        expect("More holds the places that show once OCSA answers", items.length >= 15, JSON.stringify(items));
        expect("Use the bottom bar and More names every place under More", missing.length === 0, JSON.stringify(missing));
      } finally { await app.context.close(); }
    },
  },
];
JOURNEYS.push(...ROUND1_JOURNEYS);

// --- Everyone on a shift sees the same list, live (part 350) -------------
//
// The checklist on screen reads itself again every ten seconds, and so
// does a site's list a supervisor follows from Home. A coworker's check is
// the stub's third person (an invented first name) checking a step at the
// same site, pushed into the stub while this phone holds its list. Each
// check fails on the main of part 348, which reads the list only when it
// opens.
const LIVE_WAIT_MS = 11500;
const COWORKER = "u-three";
const siteListReads = (stub) => stub.state.calls.filter(c => c.method === "GET" && /^\/api\/sites\/[^/]+\/tasks$/.test(c.path)).length;
// The step ids the stub's site list answers by the name the screen gives
// each, read without counting as one of the phone's reads.
const stepIds = (app, language) => {
  const a = app.stub.handle("GET", "/api/sites/site-north/tasks", "?day=today&locale=" + language, null, "", {});
  app.stub.state.calls.pop();
  const ids = {};
  (JSON.parse(a.body) || []).forEach((r) => { ids[(r.display && r.display.label) || r.label] = r.id; if (r.label) ids[r.label] = ids[r.label] || r.id; });
  return ids;
};
// A step on the checklist by its name: the words on its row and its box's
// label, which says whether it reads done.
const taskRow = (page, language, name) => page.evaluate(([on, off]) => {
  const b = Array.from(document.querySelectorAll("button[aria-label]")).find(x => x.getAttribute("aria-label") === on || x.getAttribute("aria-label") === off);
  const row = b ? (b.closest("[data-task-row]") || b.parentElement) : null;
  return row ? { text: row.innerText.replace(/\s+/g, " "), label: b.getAttribute("aria-label") } : null;
}, [say("Mark {name} done", language).replace("{name}", name), say("Mark {name} not done", language).replace("{name}", name)]);
// A step on a followed list by its name: the words on its row, and its
// mark, done or not.
const watchRow = (page, name) => page.evaluate((n) => {
  const row = Array.from(document.querySelectorAll("[data-task-row]")).find(r => r.innerText.indexOf(n) !== -1);
  const mark = row ? row.querySelector("[data-task-done]") : null;
  return row ? { text: row.innerText.replace(/\s+/g, " "), watchDone: mark ? mark.getAttribute("data-task-done") === "1" : null } : null;
}, name);
// The first step on the list with an open box: its name and id.
const openStep = async (app, language) => {
  const label = await taskBox(app.page, language, false);
  const name = label ? nameIn(label, say("Mark {name} done", language)) : null;
  const id = name ? stepIds(app, language)[name] : null;
  return name && id ? { name: name, id: id, label: label } : null;
};
const rowDone = (language, r) => !!r && labelRe(say("Mark {name} not done", language)).test(r.label || "");
const checkedByLine = (language) => say("Checked by {firstName}", language).replace("{firstName}", FIRST_NAMES[COWORKER]);
// The API logs each check-off as a change to the site's list (part 354),
// which GET /api/sites/:id/tasks/changed then answers.
const coworkerChecks = (app, id) => { app.stub.state.completions.push({ taskId: id, userId: COWORKER }); app.stub.noteChange("site-north"); };
// Waits for a list read after the one counted, and a moment for it to draw.
const nextRead = async (app, from, ms) => {
  const until = Date.now() + (ms || LIVE_WAIT_MS);
  while (Date.now() < until) { if (siteListReads(app.stub) > from) { await pause(app.page, 900); return true; } await pause(app.page, 250); }
  return false;
};
const LIVE_SUPERVISOR = Object.assign({}, PERSON, { id: "u-live-sup", role: "supervisor" });
// The site's shared list: a person linked to no step of their own sees
// the whole site's list, where a coworker's check shows as Checked by.
const SHARED_LIST = { links: {} };

const LIVE_JOURNEYS = [
  {
    id: "livecheckoff",
    label: "A coworker's check-off shows on the checklist on its own within ten seconds, with who checked it",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: SHARED_LIST });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1500);
        const step = await openStep(app, language);
        if (!step) { expect("the list has a step still to do", false, "no open box"); return; }
        const at = Date.now();
        coworkerChecks(app, step.id);
        let seen = null;
        while (Date.now() - at < LIVE_WAIT_MS) {
          const r = await taskRow(app.page, language, step.name);
          if (rowDone(language, r) && has(r.text, checkedByLine(language))) { seen = Date.now() - at; break; }
          await pause(app.page, 250);
        }
        expect("a coworker's check shows within ten seconds, with Checked by and their name", seen !== null, JSON.stringify(await taskRow(app.page, language, step.name)));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "livequeued",
    label: "A tap still waiting on the phone survives the checklist reading itself again",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: SHARED_LIST });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1500);
        const step = await openStep(app, language);
        if (!step) { expect("the list has a step still to do", false, "no open box"); return; }
        // The API answers 500 to the check, so it waits on the phone.
        app.stub.state.trouble = { method: "POST", path: CHECKOFF_PATH, kind: "500", left: 99 };
        await tapAria(app.page, step.label);
        await pause(app.page, 1500);
        const before = siteListReads(app.stub);
        // Since part 356 the list is read again when it changed: a coworker
        // checks another step.
        const other = Object.keys(stepIds(app, language)).map(n => stepIds(app, language)[n]).find(x => x !== step.id);
        if (other) coworkerChecks(app, other);
        const read = await nextRead(app, before);
        const r = await taskRow(app.page, language, step.name);
        expect("the checklist reads itself again while a tap waits", read, "no list read in " + LIVE_WAIT_MS + " ms");
        expect("the waiting tap still shows on its box after the read", rowDone(language, r), JSON.stringify(r));
        expect("the waiting tap is still on the phone after the read", (await pendingTaps(app.page)) === 1, (await pendingTaps(app.page)) + " on the phone");
        expect("the saved line still shows after the read", has(await bodyText(app.page), say(SAVED_LINE, language)), "the line is gone");
      } finally { await app.context.close(); }
    },
  },
  {
    id: "livescroll",
    label: "The checklist reading itself again never moves it: the scroll position holds while a coworker's check comes in",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: SHARED_LIST });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 2000);
        const want = await app.page.evaluate(() => { const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight); window.scrollTo(0, Math.min(240, max)); return window.scrollY; });
        await pause(app.page, 500);
        const step = await openStep(app, language);
        if (step) coworkerChecks(app, step.id);
        const read = await nextRead(app, siteListReads(app.stub));
        const after = await app.page.evaluate(() => window.scrollY);
        expect("the checklist reads itself again", read, "no list read in " + LIVE_WAIT_MS + " ms");
        expect("the list scrolled down stays where it was across the read", want > 0 && Math.abs(after - want) <= 2, "scrolled to " + want + ", then at " + after);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "livesamestep",
    label: "Two people tapping the same step: one check-off, and the second phone says Already done by the first, with no failure",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: SHARED_LIST });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1500);
        const step = await openStep(app, language);
        if (!step) { expect("the list has a step still to do", false, "no open box"); return; }
        const id = step.id;
        // The coworker checks it a moment before this phone's tap, with no
        // read of the list between.
        coworkerChecks(app, id);
        await tapAria(app.page, step.label);
        await pause(app.page, 1200);
        const line = say("Already done by {firstName}", language).replace("{firstName}", FIRST_NAMES[COWORKER]);
        const text = await bodyText(app.page);
        const toast = await toastText(app.page);
        const checks = app.stub.state.completions.filter(c => c.taskId === id);
        expect("two taps on one step leave one check-off", checks.length === 1 && checks[0].userId === COWORKER, JSON.stringify(checks));
        expect("the second phone says Already done by the first", has(text, line), text.slice(0, 260));
        expect("the second tap leaves the phone quietly, with no failure", (await pendingTaps(app.page)) === 0 && !has(toast || "", say("Something went wrong on our end. Try again in a minute.", language)) && !has(text, say(SAVED_LINE, language)), (await pendingTaps(app.page)) + " on the phone; toast " + JSON.stringify(toast));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "livewatch",
    label: "A supervisor with no shift follows a site's list from Home, and a cleaner's check-offs appear on it within ten seconds",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { person: LIVE_SUPERVISOR, clockedIn: false } });
      try {
        await pause(app.page, 2000);
        const opened = await app.page.evaluate(() => { const b = document.querySelector('button[data-site-list="site-north"]'); if (b) b.click(); return !!b; });
        await pause(app.page, 1500);
        expect("Home offers a supervisor the task list under a site of their own", opened, "no Task list for this site under North Building");
        if (!opened) return;
        const watching = await app.page.evaluate(() => !!document.querySelector('[data-site-list-sheet="site-north"][data-site-list-watch="1"]'));
        expect("the list opens to follow, with each step done or not", watching, "the sheet is a list to read");
        const id = await app.page.evaluate(() => { const r = Array.from(document.querySelectorAll("[data-task-row]")).find(x => { const m = x.querySelector("[data-task-done]"); return m && m.getAttribute("data-task-done") === "0"; }); return r ? r.getAttribute("data-task-row") : null; });
        if (!id) { expect("the site has a step still to do", false, "no open step"); return; }
        const name = Object.keys(stepIds(app, language)).find(n => stepIds(app, language)[n] === id && n);
        const at = Date.now();
        coworkerChecks(app, id);
        let seen = null;
        while (Date.now() - at < LIVE_WAIT_MS) {
          const r = await watchRow(app.page, name);
          if (r && r.watchDone && has(r.text, checkedByLine(language))) { seen = Date.now() - at; break; }
          await pause(app.page, 250);
        }
        expect("a cleaner's check-off appears within ten seconds, with who checked it", seen !== null, JSON.stringify(await watchRow(app.page, name)));
        expect("nothing on the followed list can be checked off", await app.page.evaluate((w) => !Array.from(document.querySelectorAll('[data-site-list-sheet] button[aria-label]')).some(b => new RegExp(w).test(b.getAttribute("aria-label"))), labelRe(say("Mark {name} done", language)).source), "a box to tap");
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
];
JOURNEYS.push(...LIVE_JOURNEYS);

// --- Round 2 (part 355): kept once, kept with no signal, refusals and
// notices that open something ----------------------------------------------
//
// One journey for each item of Round 2, each against the stub as it
// mirrors ocsa-api's main (49262a3): an issue sent again after the API
// kept it and answered 500 (PORT-01's clientId), End Shift tapped with the
// signal gone (PORT-06), the refusal codes main answers since Round 1 in
// the portal's own words, each notice type opening its place from the bell
// and from a phone alert (PORT-10), the case sheet (PORT-14), and no money
// anywhere a supervisor or an admin can reach. Each but the last fails on
// the main of part 350; the last holds on it too, and stays as a guard.
const ISSUE_PATH = /^\/api\/issues$/;
const issueSends = (stub) => stub.state.calls.filter(c => c.method === "POST" && ISSUE_PATH.test(c.path));
const ISSUE_TITLE = "A leak under the sink, weak signal";
const R2_SUPERVISOR = Object.assign({}, PERSON, { id: "u-r2-sup", role: "supervisor" });
const R2_ADMIN = Object.assign({}, ADMIN_PERSON, { id: "u-r2-admin" });
const R2_EVERYTHING = { sds: true, workspace: true, fieldKit: true, training: true, signatures: true, support: true, library: true, unfinishedForms: true, requests: true };
// The toasts on screen: each one's words, and whether it reads as a
// failure (white words on red) or as a notice.
const toastsNow = (page) => page.evaluate(() => {
  const strip = Array.from(document.querySelectorAll("div")).find((x) => { const s = getComputedStyle(x); return s.position === "fixed" && s.top === "80px"; });
  return strip ? Array.from(strip.children).map(k => ({ text: k.innerText.trim(), failure: getComputedStyle(k).color === "rgb(255, 255, 255)" })) : [];
});
const toastSaying = async (page, words, ms) => {
  const until = Date.now() + (ms || 4000);
  while (Date.now() < until) { const hit = (await toastsNow(page)).find(x => x.text === words); if (hit) return hit; await pause(page, 100); }
  return null;
};
// The line drawn right after a PIN box, the way sign-in and Register draw
// a refusal.
const lineUnderPin = (page, n) => page.evaluate((i) => {
  const box = document.querySelectorAll('input[type="password"], input[inputmode="numeric"]')[i];
  const e = box ? box.nextElementSibling : null;
  return e ? e.innerText.replace(/\s+/g, " ").trim() : "";
}, n || 0);
const ownWords = (en, language) => say(en, language);

const ROUND2_JOURNEYS = [
  {
    id: "issueonce",
    label: "An issue sent again after the API kept it and answered 500: one issue, the report on screen until the API has it, one clientId on every send, and a report typed differently filed as its own",
    run: async (open, language, expect) => {
      for (const photo of [false, true]) {
        const what = photo ? "an issue with a photo" : "an issue";
        const app = await open({});
        try {
          await issueReady(photo)(app, language);
          app.stub.state.trouble = { method: "POST", path: ISSUE_PATH, kind: "kept500" };
          await clickText(app.page, say("Submit Issue", language));
          await pause(app.page, 1500);
          expect(what + ": the report stays on screen after the 500", (await boxValue(app.page, ".sp-content input", 0)) === ISSUE_TITLE, JSON.stringify(await boxValue(app.page, ".sp-content input", 0)));
          expect(what + ": the API kept the first send", app.stub.state.issues.length === 1, app.stub.state.issues.length + " issues");
          await clickText(app.page, say("Submit Issue", language));
          await pause(app.page, 1800);
          const sends = issueSends(app.stub);
          const issues = app.stub.state.issues;
          expect(what + " sent again after a 500 makes one issue", issues.length === 1, issues.length + " issues from " + sends.length + " sends");
          expect(what + ": both sends carry the same clientId", sends.length === 2 && sends.every(c => c.body && typeof c.body.clientId === "string") && new Set(sends.map(c => c.body.clientId)).size === 1, JSON.stringify(sends.map(c => c.body && c.body.clientId)));
          expect(what + ": the report clears once the API has it", (await boxValue(app.page, ".sp-content input", 0)) === "", JSON.stringify(await boxValue(app.page, ".sp-content input", 0)));
          if (photo) {
            const ups = sent(app.stub, "POST", "/api/uploads").length;
            expect("the photo goes up once and is on the one issue once", ups === 1 && issues.length === 1 && issues[0].photos.length === 1, ups + " uploads, " + (issues[0] ? issues[0].photos.length : 0) + " photos");
          }
          await spokenHere(app, language, expect);
        } finally { await app.context.close(); }
      }
      // A report typed differently after a failure is a new report, never
      // taken for a replay of the one before.
      const app = await open({});
      try {
        await issueReady(false)(app, language);
        app.stub.state.trouble = { method: "POST", path: ISSUE_PATH, kind: "kept500" };
        await clickText(app.page, say("Submit Issue", language));
        await pause(app.page, 1500);
        await typeNth(app.page, ".sp-content input", 0, "The lobby light is out");
        await clickText(app.page, say("Submit Issue", language));
        await pause(app.page, 1800);
        const issues = app.stub.state.issues;
        expect("a report typed differently after a failure is filed as its own issue", issues.length === 2 && issues[1].body.title === "The lobby light is out", JSON.stringify(issues.map(x => x.body.title)));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "endshiftqueue",
    label: "End Shift tapped with the signal gone: kept on the phone and said so, then sent by itself once the signal is back, after the check-off waiting before it, with the time it was tapped",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1200);
        const label = await taskBox(app.page, language, false);
        await app.context.setOffline(true); app.stub.state.offline = true;
        await tapAria(app.page, label);
        await pause(app.page, 900);
        expect("a check-off with no signal waits on the phone", (await pendingTaps(app.page)) === 1, (await pendingTaps(app.page)) + " on the phone");
        await openTab(app.page, "clock", language);
        await pause(app.page, 900);
        const tappedAt = await app.page.evaluate(() => Date.now());
        await clickText(app.page, say("End Shift", language));
        await pause(app.page, 1500);
        const line = say("Your shift end is saved on this phone, with the time you tapped it. It sends when you have signal.", language);
        const waiting = await app.page.evaluate(() => !!document.querySelector('[data-end-waiting="1"]'));
        expect("End Shift with no signal says it is saved on the phone with the time it was tapped", waiting && has(await bodyText(app.page), line), (await bodyText(app.page)).slice(0, 260));
        expect("End Shift with no signal is kept on the phone", await app.page.evaluate(() => { try { return !!localStorage.getItem("ocsa-pending-end"); } catch (e) { return false; } }), "nothing kept");
        await spokenHere(app, language, expect);
        // Time passes with no signal, then the signal comes back.
        await pause(app.page, 3000);
        const from = app.stub.state.calls.length;
        const backAt = await app.page.evaluate(() => Date.now());
        app.stub.state.offline = false; await app.context.setOffline(false);
        await pause(app.page, 5000);
        const calls = app.stub.state.calls.slice(from);
        const checkAt = calls.findIndex(c => c.method === "POST" && CHECKOFF_PATH.test(c.path));
        const endAt = calls.findIndex(c => c.method === "POST" && /^\/api\/shift-sessions\/[^/]+\/end$/.test(c.path));
        expect("End Shift goes by itself once the signal is back", endAt !== -1, JSON.stringify(calls.map(c => c.method + " " + c.path).slice(0, 8)));
        expect("the check-off waiting before it goes first", checkAt !== -1 && endAt !== -1 && checkAt < endAt, "check-off at " + checkAt + ", end at " + endAt);
        const tap = app.stub.state.shiftTaps.filter(x => x.kind === "end").pop();
        const sentAt = tap && tap.sent ? Date.parse(tap.sent) : NaN;
        expect("the end carries the time it was tapped, and the API takes it", Number.isFinite(sentAt) && sentAt >= tappedAt - 1000 && sentAt <= tappedAt + 2000 && sentAt < backAt - 1000 && tap.taken === tap.sent, JSON.stringify({ tappedAt: new Date(tappedAt).toISOString(), backAt: new Date(backAt).toISOString(), tap: tap }));
        const left = await app.page.evaluate(() => ({ waiting: !!document.querySelector('[data-end-waiting="1"]'), kept: (() => { try { return !!localStorage.getItem("ocsa-pending-end"); } catch (e) { return true; } })() }));
        expect("once it has gone the line goes, nothing is left on the phone, and End Shift is gone", !left.waiting && !left.kept && (await pendingTaps(app.page)) === 0 && !has(await bodyText(app.page), say("End Shift", language)), JSON.stringify(left) + " " + (await bodyText(app.page)).slice(0, 160));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "refusalwords",
    label: "The refusal codes main answers since Round 1, each in the portal's own words with the next step: a PIN the office gave that expired, an account locked until the office, a weak PIN at Register, a sign-in that could not be checked, a photo the API would not store, a report sent wrong, a task already settled, an issue closed and a shift on approved time off",
    run: async (open, language, expect) => {
      // Sign-in: the PIN the office gave has expired, and the account is
      // locked until the office unlocks it.
      for (const [k, en] of [["givenPinExpired", "The PIN the office gave you has expired. Call the office for a new one, or tap Forgot your PIN? to choose your own by email."], ["lockedUntilOffice", "Too many tries today, so your account is locked until the office unlocks it. Call the office, or tap Forgot your PIN? to reset it by email."]]) {
        const app = await open({ signedIn: false });
        try {
          app.stub.state.refuse["POST /api/auth/login"] = { status: API_R2[k].status, body: apiR2Body(k, language), once: true };
          await type(app.page, 'input[autocomplete="username"]', "4821");
          await type(app.page, 'input[type="password"]', "4907");
          await clickText(app.page, say("Sign In", language));
          await pause(app.page, 1000);
          const line = await lineUnderPin(app.page, 0);
          expect(API_R2[k].code + " at sign-in is said under the PIN box in the portal's words, with what to do next", line === ownWords(en, language), JSON.stringify(line));
          await spokenHere(app, language, expect);
        } finally { await app.context.close(); }
      }
      // Register: a PIN the phone takes and the API turns away as weak.
      const reg = await open({ signedIn: false });
      try {
        await clickText(reg.page, say("New Employee? Register Here", language));
        await pause(reg.page, 700);
        reg.stub.state.refuse["POST /api/auth/register"] = { status: 400, body: { error: language === "es" ? "Elija un PIN que no sea un mismo d\u00edgito repetido, una secuencia ni su n\u00famero de empleado" : "Choose a PIN that is not repeated digits, a sequence, or your badge number", code: "PIN_WEAK" }, once: true };
        const person = ["Riley", "Invented", "0000000009", "nine@example.invalid", "5739", "5739"];
        for (let i = 0; i < person.length; i += 1) await typeNth(reg.page, "input", i, person[i]);
        await clickText(reg.page, say("Register", language));
        await pause(reg.page, 1000);
        const line = await lineUnderPin(reg.page, 0);
        const toasts = await toastsNow(reg.page);
        expect("PIN_WEAK at Register is said under the PIN box, with the form kept", line === say("Choose a PIN that is not repeated digits, a sequence, or your badge number", language) && toasts.every(x => !x.failure) && (await boxValue(reg.page, "input", 0)) === "Riley", JSON.stringify({ line: line, toasts: toasts }));
        await spokenHere(reg, language, expect);
      } finally { await reg.context.close(); }
      // A sign-in the API could not check, at start and on a send: try
      // again, never a failure.
      // A phone with no list kept, so the first screen says it.
      const boot = await open({ stubOptions: { refuse: { "GET /api/auth/me": { status: 503, body: apiR2Body("checkUnavailable", language), once: true } } } });
      try {
        await pause(boot.page, 1800);
        const text = await bodyText(boot.page);
        expect("auth.checkUnavailable at start says to try again in a moment, never that something went wrong", has(text, say("OCSA could not check your sign-in just now. Try again in a moment.", language)) && !has(text, say("Something went wrong on our end. Try again in a minute.", language)), text.slice(0, 220));
        await clickText(boot.page, say("Try again", language));
        await pause(boot.page, 1800);
        expect("Try again then opens the portal", await boot.page.evaluate(() => !!document.querySelector(".sp-content")), (await bodyText(boot.page)).slice(0, 160));
        // With a list kept on the phone, the app opens on it, the way it
        // does with no signal.
        await openTab(boot.page, "tasks", language);
        await pause(boot.page, 1500);
        boot.stub.state.refuse["GET /api/auth/me"] = { status: 503, body: apiR2Body("checkUnavailable", language), once: true };
        await boot.page.reload();
        await pause(boot.page, 2000);
        const kept = await bodyText(boot.page);
        expect("auth.checkUnavailable at start on a phone with a list kept opens that list, never a failure", (await boot.page.evaluate(() => !!document.querySelector(".sp-content"))) && !has(kept, say("Something went wrong on our end. Try again in a minute.", language)), kept.slice(0, 220));
      } finally { await boot.context.close(); }
      const busy = await open({});
      try {
        await issueReady(false)(busy, language);
        busy.stub.state.refuse["POST /api/issues"] = { status: 503, body: apiR2Body("checkUnavailable", language), once: true };
        await clickText(busy.page, say("Submit Issue", language));
        const toast = await toastSaying(busy.page, say("OCSA could not check your sign-in just now. Try again in a moment.", language));
        expect("auth.checkUnavailable on a send says to try again, as a notice and never as a failure", !!toast && !toast.failure, JSON.stringify(await toastsNow(busy.page)));
        expect("the report waits on screen for the try again", (await boxValue(busy.page, ".sp-content input", 0)) === ISSUE_TITLE, JSON.stringify(await boxValue(busy.page, ".sp-content input", 0)));
      } finally { await busy.context.close(); }
      // A photo the API will not store.
      const bucket = await open({});
      try {
        await issueReady(true)(bucket, language);
        bucket.stub.state.refuse["POST /api/uploads"] = { status: 400, body: apiR2Body("badBucket", language), once: true };
        await clickText(bucket.page, say("Submit Issue", language));
        const toast = await toastSaying(bucket.page, say("This photo could not be saved. Try again, and tell the office if it happens again.", language));
        expect("uploads.badBucket says the photo was not saved and what to do next", !!toast, JSON.stringify(await toastsNow(bucket.page)));
        expect("the report and its photo stay for the try again", (await boxValue(bucket.page, ".sp-content input", 0)) === ISSUE_TITLE && await bucket.page.evaluate(() => !!document.querySelector('.sp-content img[src^="data:"]')), "the report is gone");
      } finally { await bucket.context.close(); }
      // A report sent with a clientId the API will not take: the next send
      // makes a new one.
      const wrong = await open({});
      try {
        await issueReady(false)(wrong, language);
        wrong.stub.state.refuse["POST /api/issues"] = { status: 400, body: apiR2Body("clientIdInvalid", language), once: true };
        await clickText(wrong.page, say("Submit Issue", language));
        const toast = await toastSaying(wrong.page, say("This report could not be sent as it was. Tap Submit Issue again.", language));
        expect("issues.clientIdInvalid says to tap Submit Issue again", !!toast, JSON.stringify(await toastsNow(wrong.page)));
        await pause(wrong.page, 600);
        await clickText(wrong.page, say("Submit Issue", language));
        await pause(wrong.page, 1500);
        const sends = issueSends(wrong.stub);
        expect("Submit Issue again files the report with a new clientId", wrong.stub.state.issues.length === 1 && sends.length === 2 && sends[0].body.clientId !== sends[1].body.clientId, wrong.stub.state.issues.length + " issues, " + JSON.stringify(sends.map(c => c.body && c.body.clientId)));
      } finally { await wrong.context.close(); }
      // An assigned task already settled, and one whose issue is closed:
      // nothing more to send, said as a notice, and the list read again.
      for (const [k, en, panel] of [["alreadySettled", "This task is already finished or marked as unable to finish, so there is nothing more to send.", "Resolved"], ["issueClosed", "The problem behind this task is already closed, so there is nothing more to send.", "Cannot Resolve"]]) {
        const app = await open({});
        try {
          await openTab(app.page, "issuetasks", language);
          await pause(app.page, 900);
          await openItem(app.page, "Replace the cracked light cover");
          await pause(app.page, 700);
          await clickText(app.page, say(panel, language));
          await typeNth(app.page, ".sp-content textarea", 0, "Put a new cover on");
          if (panel === "Resolved") { await attachPhoto(app.page, '.sp-content input[type="file"]'); await pause(app.page, 700); }
          app.stub.state.refuse["PATCH /api/clock/tasks/resolve/at-1"] = { status: API_R2[k].status, body: apiR2Body(k, language), once: true };
          const reads = sent(app.stub, "GET", "/api/clock/tasks/assigned").length;
          await clickText(app.page, say(panel === "Resolved" ? "Submit Resolution" : "Submit", language));
          const toast = await toastSaying(app.page, ownWords(en, language));
          await pause(app.page, 900);
          expect(API_R2[k].code + " says there is nothing more to send, as a notice", !!toast && !toast.failure, JSON.stringify(await toastsNow(app.page)));
          expect(API_R2[k].code + " closes the task and reads the list again", !(await app.page.evaluate(() => !!document.querySelector(".sp-content textarea"))) && sent(app.stub, "GET", "/api/clock/tasks/assigned").length > reads, "the form is still open, or the list was not read again");
        } finally { await app.context.close(); }
      }
      // A shift on a day of approved time off.
      const pick = await open({});
      try {
        await openTab(pick.page, "pickup", language);
        await pause(pick.page, 900);
        for (let n = 1; n <= 5; n += 1) pick.stub.state.refuse["POST /api/pickups/pk-" + n + "/claim"] = { status: 409, body: apiR2Body("onLeave", language, { dates: "2026-10-08" }, { dates: ["2026-10-08"] }) };
        await clickText(pick.page, say("Claim This Shift", language));
        const toast = await toastSaying(pick.page, say("You have time off approved that day, so this shift cannot be yours. Pick a shift on another day.", language));
        expect("pickups.onLeave says the shift is on approved time off and to pick another day", !!toast, JSON.stringify(await toastsNow(pick.page)));
      } finally { await pick.context.close(); }
    },
  },
  {
    id: "noticeplaces",
    label: "Notices that open something, from the bell, from a phone alert on an open window, and from a phone alert that opens the app: a support ticket at the ticket, periodic work at the task, a client's concern on its own sheet, and an HR case on the case sheet",
    run: async (open, language, expect) => {
      const PLACES = [
        ["support_ticket", "st-1", '[data-support-focus="1"][data-support-ticket="st-1"]', "My tickets at the ticket"],
        ["periodic_overdue", "pw-1", '[data-fk-periodic-focus="1"][data-fk-periodic-item="pw-1"]', "Periodic work at the task"],
        ["customer_concern", "cc-1", '[data-concern-sheet="cc-1"] [data-concern-read="1"]', "the client's concern, read only"],
        ["hr_case_assigned", "case-1", '[data-case-sheet="case-1"] [data-case-read="1"]', "the case, read only"],
      ];
      const seen = (page, sel) => page.waitForSelector(sel, { timeout: 6000 }).then(() => true).catch(() => false);
      for (const [type, id, sel, place] of PLACES) {
        const row = EVERY_NOTICE.find(r => r.type === type);
        const notice = Object.assign({}, row.notice);
        const stubOptions = Object.assign({ person: R2_SUPERVISOR, notifications: [notice] }, R2_EVERYTHING);
        // From the bell.
        const bell = await open({ stubOptions: stubOptions });
        try {
          await bell.page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(x => /notification|notificaci/i.test(x.getAttribute("aria-label") || "")), null, { timeout: 8000 }).catch(() => {});
          await bell.page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find(x => /notification|notificaci/i.test(x.getAttribute("aria-label") || "")); if (b) b.click(); });
          await bell.page.waitForFunction((t) => Array.from(document.querySelectorAll("button")).some(b => b.innerText.indexOf(t) !== -1), notice.title, { timeout: 6000 }).catch(() => {});
          await bell.page.evaluate((t) => { const b = Array.from(document.querySelectorAll("button")).find(x => x.innerText.indexOf(t) !== -1); if (b) b.click(); }, notice.title);
          expect("a " + type + " notice on the bell opens " + place, await seen(bell.page, sel), (await bodyText(bell.page)).slice(0, 200));
          // App support names the build and the phone, which no language
          // reads.
          if (type !== "support_ticket") await spokenHere(bell, language, expect);
        } finally { await bell.context.close(); }
        // A phone alert tapped while the app is open.
        const live = await open({ stubOptions: stubOptions });
        try {
          await pause(live.page, 1500);
          await live.page.evaluate(([t, i]) => navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data: { type: "ocsa-open", subjectType: t, subjectId: i } })), [type, id]);
          expect("a " + type + " phone alert on an open app opens " + place, await seen(live.page, sel), (await bodyText(live.page)).slice(0, 200));
        } finally { await live.context.close(); }
        // A phone alert that opens the app.
        const fresh = await open({ path: "/?open=" + type + ":" + id, stubOptions: stubOptions });
        try {
          expect("a " + type + " phone alert that opens the app opens " + place, await seen(fresh.page, sel), (await bodyText(fresh.page)).slice(0, 200));
        } finally { await fresh.context.close(); }
      }
    },
  },
  {
    id: "casesheet",
    label: "The case sheet: an HR case notice opens it read only for a supervisor who holds manage_cases, in the screen's language, and a cleaner never sees it, from the bell or from a phone alert",
    run: async (open, language, expect) => {
      const notice = Object.assign({}, EVERY_NOTICE.find(r => r.type === "hr_case_filed").notice);
      const sup = await open({ stubOptions: { person: R2_SUPERVISOR, notifications: [notice] } });
      try {
        await sup.page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(x => /notification|notificaci/i.test(x.getAttribute("aria-label") || "")), null, { timeout: 8000 }).catch(() => {});
        await sup.page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find(x => /notification|notificaci/i.test(x.getAttribute("aria-label") || "")); if (b) b.click(); });
        await sup.page.waitForFunction((t) => Array.from(document.querySelectorAll("button")).some(b => b.innerText.indexOf(t) !== -1), notice.title, { timeout: 6000 }).catch(() => {});
        await sup.page.evaluate((t) => { const b = Array.from(document.querySelectorAll("button")).find(x => x.innerText.indexOf(t) !== -1); if (b) b.click(); }, notice.title);
        const up = await sup.page.waitForSelector('[data-case-sheet="case-1"] [data-case-read="1"]', { timeout: 6000 }).then(() => true).catch(() => false);
        expect("an HR case notice opens the case sheet for a supervisor who holds manage_cases", up, (await bodyText(sup.page)).slice(0, 200));
        if (up) {
          const sheet = await sup.page.evaluate(() => {
            const d = document.querySelector('[data-case-sheet="case-1"]');
            return { text: d.innerText.replace(/\s+/g, " "), fields: d.querySelectorAll("input, textarea, select, [contenteditable]").length, buttons: Array.from(d.querySelectorAll("button")).map(b => b.innerText.trim()), status: (d.querySelector("[data-case-status]") || {}).textContent || "" };
          });
          const summary = language === "es" ? "Inventado: alguien cambia el horario del carro sin avisar al equipo." : "Invented: someone keeps changing the cart schedule without telling the crew.";
          expect("the case sheet shows the case in the screen's language: its status, what was reported and its updates", has(sheet.text, summary) && sheet.status === say("Case in review", language) && has(sheet.text, say("Updates", language)), sheet.text.slice(0, 300));
          expect("the case sheet is read only: nothing to type in, with the notice's Open in the dashboard and Close its only buttons", sheet.fields === 0 && sheet.buttons.length === 2 && sheet.buttons[0] === say("Open in the dashboard", language) && sheet.buttons[1] === say("Close", language), JSON.stringify(sheet.buttons) + " " + sheet.fields + " fields");
          expect("the case sheet says it is read only and where the case is worked", has(sheet.text, say("Read only. The case is worked on the dashboard.", language)), sheet.text.slice(0, 200));
          expect("the case sheet reads the case once, through the case route", sent(sup.stub, "GET", "/api/hr-cases/case-1").length === 1, sent(sup.stub, "GET", "/api/hr-cases/case-1").length + " reads");
          await spokenHere(sup, language, expect);
          await clickText(sup.page, say("Close", language));
          await pause(sup.page, 500);
          expect("Close takes the case sheet away", !(await sup.page.evaluate(() => !!document.querySelector("[data-case-sheet]"))), "still up");
        }
      } finally { await sup.context.close(); }
      // A cleaner, from the bell and from a phone alert.
      const cleaner = await open({ stubOptions: { notifications: [notice] } });
      try {
        await cleaner.page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(x => /notification|notificaci/i.test(x.getAttribute("aria-label") || "")), null, { timeout: 8000 }).catch(() => {});
        await pause(cleaner.page, 1200);
        await cleaner.page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find(x => /notification|notificaci/i.test(x.getAttribute("aria-label") || "")); if (b) b.click(); });
        await cleaner.page.waitForFunction((t) => Array.from(document.querySelectorAll("button")).some(b => b.innerText.indexOf(t) !== -1), notice.title, { timeout: 6000 }).catch(() => {});
        await cleaner.page.evaluate((t) => { const b = Array.from(document.querySelectorAll("button")).find(x => x.innerText.indexOf(t) !== -1); if (b) b.click(); }, notice.title);
        await pause(cleaner.page, 1500);
        expect("a cleaner tapping an HR case notice never sees the case sheet, and the case is never read", !(await cleaner.page.evaluate(() => !!document.querySelector("[data-case-sheet]"))) && sent(cleaner.stub, "GET", "/api/hr-cases/").length === 0, sent(cleaner.stub, "GET", "/api/hr-cases/").length + " reads");
      } finally { await cleaner.context.close(); }
      const pushed = await open({ path: "/?open=hr_case_filed:case-1", stubOptions: { notifications: [notice] } });
      try {
        let ever = false;
        const until = Date.now() + 4000;
        while (Date.now() < until) { if (await pushed.page.evaluate(() => !!document.querySelector("[data-case-sheet]"))) { ever = true; break; } await pause(pushed.page, 100); }
        const bell = await pushed.page.evaluate((w) => Array.from(document.querySelectorAll("button")).some(b => b.innerText.trim() === w), say("Mark all read", language));
        expect("a cleaner's phone alert about an HR case opens the bell, never the case sheet", !ever && bell && sent(pushed.stub, "GET", "/api/hr-cases/").length === 0, "sheet " + ever + ", bell " + bell + ", " + sent(pushed.stub, "GET", "/api/hr-cases/").length + " reads");
      } finally { await pushed.context.close(); }
    },
  },
  {
    id: "nomoney",
    label: "No money anywhere: a supervisor and an admin go through every place on the bar, under More and in the field kit, and no dollar figure or cost shows, and none is kept on the phone",
    run: async (open, language, expect) => {
      const MONEY = /\$\s?\d|\d\s?\$|\bUSD\b|12[.,]5|cost per unit|costo por unidad/i;
      const KEPT = /cost_?per_?unit|unit_?cost|hourly_?rate|pay_?rate|wage|salary|labor_?cost|monthly_?price|annual_?price|"\$\s?\d/i;
      for (const person of [R2_SUPERVISOR, R2_ADMIN]) {
        const app = await open({ stubOptions: Object.assign({ person: person }, R2_EVERYTHING) });
        try {
          await pause(app.page, 2000);
          const found = [];
          const look = async (where) => { const text = await bodyText(app.page); const m = MONEY.exec(text); if (m) found.push(where + ": " + text.slice(Math.max(0, m.index - 40), m.index + 40)); };
          await look("Home");
          const bar = () => app.page.evaluate(() => {
            const b = Array.from(document.querySelectorAll("div")).find((el) => { const s = getComputedStyle(el); return s.position === "fixed" && s.bottom === "0px" && el.querySelectorAll(":scope > button").length >= 5; });
            return b ? b.querySelectorAll(":scope > button").length : 0;
          });
          const tapBar = (i) => app.page.evaluate((n) => {
            const b = Array.from(document.querySelectorAll("div")).find((el) => { const s = getComputedStyle(el); return s.position === "fixed" && s.bottom === "0px" && el.querySelectorAll(":scope > button").length >= 5; });
            const x = b && b.querySelectorAll(":scope > button")[n];
            if (x) x.click();
            return x ? x.textContent.trim() : null;
          }, i);
          const n = await bar();
          for (let i = 0; i < n - 1; i += 1) { const name = await tapBar(i); await pause(app.page, 1300); await look(name); }
          await tapBar(n - 1);
          await pause(app.page, 900);
          const items = await app.page.evaluate(() => {
            const grid = Array.from(document.querySelectorAll(".sp-more div")).find(d => getComputedStyle(d).display === "grid" && d.querySelectorAll(":scope > button").length >= 5);
            return grid ? grid.querySelectorAll(":scope > button").length : 0;
          });
          for (let j = 0; j < items; j += 1) {
            await tapBar(n - 1);
            await pause(app.page, 700);
            const name = await app.page.evaluate((k) => {
              const grid = Array.from(document.querySelectorAll(".sp-more div")).find(d => getComputedStyle(d).display === "grid" && d.querySelectorAll(":scope > button").length >= 5);
              const x = grid && grid.querySelectorAll(":scope > button")[k];
              if (x) x.click();
              return x ? x.textContent.trim() : null;
            }, j);
            await pause(app.page, 1300);
            await look(name);
          }
          // Every tile of the field kit.
          if (await openTab(app.page, "fieldkit", language)) {
            await pause(app.page, 1200);
            for (const tile of ["Issue PPE", "Periodic work", "Equipment", "Awaiting review", "Sign off training", "Training session", "Watch and sign off"]) {
              if (!(await clickText(app.page, say(tile, language)))) continue;
              await pause(app.page, 1300);
              await look("Field kit, " + tile);
              await clickText(app.page, say("Field kit", language));
              await pause(app.page, 700);
            }
          }
          expect("no dollar figure or cost shows anywhere a " + person.role + " can reach", found.length === 0 && items >= 10, items + " places under More; " + found.join(" | ").slice(0, 200));
          const kept = await app.page.evaluate(() => { const out = []; try { for (let i = 0; i < localStorage.length; i += 1) { const k = localStorage.key(i); out.push(k + "=" + localStorage.getItem(k)); } } catch (e) {} try { for (let i = 0; i < sessionStorage.length; i += 1) { const k = sessionStorage.key(i); out.push(k + "=" + sessionStorage.getItem(k)); } } catch (e) {} return out.join("\n"); });
          const m = KEPT.exec(kept);
          expect("no cost or pay figure is kept on a " + person.role + "'s phone", !m, m ? kept.slice(Math.max(0, m.index - 60), m.index + 60) : "");
        } finally { await app.context.close(); }
      }
    },
  },
];
JOURNEYS.push(...ROUND2_JOURNEYS);

// --- The three items that waited on the API (part 356) ------------------
//
// Against the stub as it mirrors ocsa-api's part 354: the status answers
// shift.othersOnShift, a check of a step on the site's shared list that
// somebody else already checked is 409 tasks.alreadyChecked with their
// firstName, and GET /api/sites/:id/tasks/changed?since= answers
// { changed, at }. Each journey fails on the main of part 355, which
// reads the status before each check and the whole list every ten
// seconds.
const CHANGED_PATH = /^\/api\/sites\/[^/]+\/tasks\/changed$/;
const LIST_PATH = /^\/api\/sites\/[^/]+\/tasks$/;
// Every answer the stub gives from here on: when, what and how it went.
const answersOf = (app) => {
  const out = [];
  const handle = app.stub.handle;
  app.stub.handle = (method, pathname, ...rest) => {
    const a = handle(method, pathname, ...rest);
    out.push({ method: method, path: pathname, search: rest[0] || "", status: a && !a.abort ? a.status : null, bytes: a && typeof a.body === "string" ? Buffer.byteLength(a.body) : 0, at: Date.now() });
    return a;
  };
  return out;
};
const alsoHereLine = (page) => page.evaluate(() => { const d = document.querySelector("[data-also-here]"); return d ? d.innerText.replace(/\s+/g, " ").trim() : null; });
const ONSHIFT = (names) => names.map((n, i) => ({ firstName: n, startedAt: new Date(NOW.getTime() - (3 - i) * 3600000).toISOString() }));

const LIVE2_JOURNEYS = [
  {
    id: "alsohere",
    label: "Also here: the checklist names the others on shift at this site now, from the status, refreshed with it, and shows nothing when nobody else is there or the status says nothing",
    run: async (open, language, expect) => {
      const names = [FIRST_NAMES["u-two"], FIRST_NAMES[COWORKER]];
      const line = (list) => say("Also here: {names}", language).replace("{names}", list.join(", "));
      const app = await open({ stubOptions: Object.assign({ othersOnShift: ONSHIFT(names.slice(0, 1)) }, SHARED_LIST) });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1500);
        expect("Also here names the coworker on shift at this site", (await alsoHereLine(app.page)) === line(names.slice(0, 1)), JSON.stringify(await alsoHereLine(app.page)));
        await spokenHere(app, language, expect);
        // A second coworker starts and checks a step: the list and the
        // status are read again, and the line names both.
        app.stub.state.othersOnShift = ONSHIFT(names);
        const step = await openStep(app, language);
        if (step) coworkerChecks(app, step.id);
        let seen = null;
        const at = Date.now();
        while (Date.now() - at < 9000) { if ((await alsoHereLine(app.page)) === line(names)) { seen = Date.now() - at; break; } await pause(app.page, 250); }
        expect("Also here is read again with the status, and names a coworker who has just started", seen !== null, JSON.stringify(await alsoHereLine(app.page)));
      } finally { await app.context.close(); }
      for (const [what, others] of [["nobody else is on shift", []], ["the status says nothing of who else is on shift", null]]) {
        const alone = await open({ stubOptions: Object.assign({ othersOnShift: others }, SHARED_LIST) });
        try {
          await openTab(alone.page, "tasks", language);
          await pause(alone.page, 1500);
          expect("Also here shows nothing when " + what, (await alsoHereLine(alone.page)) === null && !has(await bodyText(alone.page), say("Also here: {names}", language).split("{")[0].trim()), JSON.stringify(await alsoHereLine(alone.page)));
        } finally { await alone.context.close(); }
      }
    },
  },
  {
    id: "alreadychecked",
    label: "Already done by, from the answer: a check the API answers 409 tasks.alreadyChecked shows Already done by and the coworker's name on the row, leaves nothing on the phone, and says no failure",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: SHARED_LIST });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1500);
        const step = await openStep(app, language);
        if (!step) { expect("the list has a step still to do", false, "no open box"); return; }
        // The coworker's check lands at the API after this phone last read
        // anything, so only the check's own answer can tell it.
        const name = FIRST_NAMES[COWORKER];
        app.stub.state.refuse["POST /api/clock/tasks/" + step.id + "/complete"] = { status: 409, body: { error: refusalIn(API_R3.alreadyChecked, language, { firstName: name }), code: API_R3.alreadyChecked.code, firstName: name }, once: true };
        await tapAria(app.page, step.label);
        await pause(app.page, 1500);
        const row = await taskRow(app.page, language, step.name);
        const toasts = await toastsNow(app.page);
        const wanted = say("Already done by {firstName}", language).replace("{firstName}", name);
        expect("a 409 tasks.alreadyChecked shows Already done by and the coworker's name on the row", !!row && has(row.text, wanted), JSON.stringify(row));
        expect("the tap leaves the phone for good", (await pendingTaps(app.page)) === 0, (await pendingTaps(app.page)) + " on the phone");
        expect("no failure is said, as a toast or as the saved line", toasts.every(x => !x.failure) && !has(await bodyText(app.page), say(SAVED_LINE, language)), JSON.stringify(toasts));
        await pause(app.page, 6000);
        expect("the tap is never sent again", checkoffSends(app.stub).filter(c => c.path.indexOf(step.id) !== -1).length === 1, checkoffSends(app.stub).length + " sends");
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "nostatusfirst",
    label: "No status read goes before a check-off: a tap on the site's shared list goes straight to the check route",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: SHARED_LIST });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1500);
        const step = await openStep(app, language);
        if (!step) { expect("the list has a step still to do", false, "no open box"); return; }
        const from = app.stub.state.calls.length;
        await tapAria(app.page, step.label);
        await pause(app.page, 1500);
        const calls = app.stub.state.calls.slice(from);
        const sentAt = calls.findIndex(c => c.method === "POST" && CHECKOFF_PATH.test(c.path));
        const before = calls.slice(0, sentAt === -1 ? calls.length : sentAt).filter(c => c.method === "GET" && c.path === "/api/clock/status").length;
        expect("the check-off is sent", sentAt !== -1, JSON.stringify(calls.map(c => c.method + " " + c.path).slice(0, 6)));
        expect("no status read goes before it", sentAt !== -1 && before === 0, before + " status reads before the check-off: " + JSON.stringify(calls.map(c => c.method + " " + c.path).slice(0, 6)));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "changedlive",
    label: "A coworker's check shows within 5 seconds through the cheap check for changes, which then reads the list",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: SHARED_LIST });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 2000);
        const step = await openStep(app, language);
        if (!step) { expect("the list has a step still to do", false, "no open box"); return; }
        const answers = answersOf(app);
        const at = Date.now();
        coworkerChecks(app, step.id);
        let seen = null;
        while (Date.now() - at < 9000) {
          const r = await taskRow(app.page, language, step.name);
          if (rowDone(language, r) && has(r.text, checkedByLine(language))) { seen = Date.now() - at; break; }
          await pause(app.page, 200);
        }
        const asked = answers.filter(a => a.method === "GET" && CHANGED_PATH.test(a.path) && a.status === 200);
        const read = answers.find(a => a.method === "GET" && LIST_PATH.test(a.path));
        expect("a coworker's check shows within 5 seconds, with Checked by and their name", seen !== null && seen <= 5000, seen === null ? "not in 9 seconds" : seen + " ms");
        expect("it came through the cheap check, which asked before the list was read", asked.length > 0 && !!read && asked[0].at <= read.at, JSON.stringify(answers.map(a => a.method + " " + a.path + " " + a.status).slice(0, 6)));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "changedquiet",
    label: "With nothing changed, an open checklist reads no full list for a minute, and asks only the cheap check",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: SHARED_LIST });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 2000);
        const answers = answersOf(app);
        await pause(app.page, 60000);
        const full = answers.filter(a => a.method === "GET" && LIST_PATH.test(a.path));
        const asked = answers.filter(a => a.method === "GET" && CHANGED_PATH.test(a.path));
        const status = answers.filter(a => a.method === "GET" && a.path === "/api/clock/status");
        const bytes = answers.reduce((n, a) => n + a.bytes, 0);
        expect("no full list read goes for a minute with nothing changed", full.length === 0, full.length + " full reads, " + asked.length + " cheap checks, " + bytes + " bytes in all");
        expect("the cheap check asks about every four seconds", asked.length >= 12 && asked.length <= 16, asked.length + " cheap checks");
        expect("no status read goes with it", status.length === 0, status.length + " status reads");
      } finally { await app.context.close(); }
    },
  },
  {
    id: "sinceinvalid",
    label: "A cheap check turned away (400 tasks.sinceInvalid) falls back to reading the whole list every 10 seconds, and goes back to the cheap check once it answers",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: SHARED_LIST });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 2000);
        const answers = answersOf(app);
        const key = "GET /api/sites/site-north/tasks/changed";
        app.stub.state.refuse[key] = { status: 400, body: { error: refusalIn(API_R3.sinceInvalid, language), code: API_R3.sinceInvalid.code, keys: ["since"] } };
        await pause(app.page, 27000);
        const refused = answers.filter(a => CHANGED_PATH.test(a.path) && a.status === 400);
        const full = answers.filter(a => LIST_PATH.test(a.path));
        expect("the cheap check is asked and turned away", refused.length > 0, JSON.stringify(answers.map(a => a.method + " " + a.path + " " + a.status).slice(0, 6)));
        expect("turned away, the whole list is read every 10 seconds", full.length >= 2 && full.length <= 3 && (full.length < 2 || full[1].at - full[0].at >= 9000), full.length + " full reads, " + JSON.stringify(full.map(a => a.at - full[0].at)));
        delete app.stub.state.refuse[key];
        await pause(app.page, 12000);
        const from = answers.length;
        await pause(app.page, 15000);
        const later = answers.slice(from);
        expect("once the cheap check answers again, the list is read only when it changed", later.some(a => CHANGED_PATH.test(a.path) && a.status === 200) && !later.some(a => LIST_PATH.test(a.path)), JSON.stringify(later.map(a => a.method + " " + a.path + " " + a.status)));
        expect("nothing is said to the person about it", (await toastsNow(app.page)).every(x => !x.failure), JSON.stringify(await toastsNow(app.page)));
      } finally { await app.context.close(); }
    },
  },
];
JOURNEYS.push(...LIVE2_JOURNEYS);

// --- The API findings that need the staff app (part 359) ---------------
//
// Against the stub as it mirrors ocsa-api's main at af63dca, which holds
// its Round 3 (part 357). Each journey that can fail on the main of part
// 356 does. The ones that cannot, because main already does what the
// finding asks of the staff app, say so in their label and stay as guards.
const R4_SUPERVISOR = Object.assign({}, PERSON, { id: "u-r4-sup", role: "supervisor" });
const bellButton = (page) => page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find(x => /notification|notificaci/i.test(x.getAttribute("aria-label") || "")); if (b) b.click(); return !!b; });
const tapOnBell = async (app, title) => {
  await app.page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(x => /notification|notificaci/i.test(x.getAttribute("aria-label") || "")), null, { timeout: 8000 }).catch(() => {});
  await bellButton(app.page);
  await app.page.waitForFunction((t) => Array.from(document.querySelectorAll("button")).some(b => b.innerText.indexOf(t) !== -1), title, { timeout: 6000 }).catch(() => {});
  return app.page.evaluate((t) => { const b = Array.from(document.querySelectorAll("button")).find(x => x.innerText.indexOf(t) !== -1); if (b) b.click(); return !!b; }, title);
};
const tapAlert = (app, type, id) => app.page.evaluate(([t, i]) => navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data: { type: "ocsa-open", subjectType: t, subjectId: i } })), [type, id]);
const shows = (page, sel, ms) => page.waitForSelector(sel, { timeout: ms || 6000 }).then(() => true).catch(() => false);
const bellOpen = (page, language) => page.evaluate((w) => Array.from(document.querySelectorAll("button")).some(b => b.innerText.trim() === w), say("Mark all read", language));
// The tab that reads as chosen on the bar: its name is drawn at 600.
const chosenTab = (page) => page.evaluate(() => {
  const bar = Array.from(document.querySelectorAll("div")).find((el) => { const s = getComputedStyle(el); return s.position === "fixed" && s.bottom === "0px" && el.querySelectorAll(":scope > button").length >= 5; });
  const on = bar && Array.from(bar.querySelectorAll(":scope > button")).find(b => { const sp = b.querySelector("span"); return sp && getComputedStyle(sp).fontWeight === "600"; });
  return on ? on.textContent.trim().replace(/^[\d+]+/, "") : null;
});
const callsTo = (stub, method, path) => stub.state.calls.filter(c => c.method === method && c.path === path);
const noticeOf = (type) => Object.assign({}, EVERY_NOTICE.find(r => r.type === type).notice);
// The three ways a notice is opened: the bell, a phone alert on an open
// app, and a phone alert that opens the app at /?open=.
const threeWays = async (open, stubOptions, type, id, title, check) => {
  const bell = await open({ stubOptions: stubOptions });
  try { await tapOnBell(bell, title); await check(bell, "from the bell"); } finally { await bell.context.close(); }
  const live = await open({ stubOptions: stubOptions });
  try { await pause(live.page, 1500); await tapAlert(live, type, id); await check(live, "from a phone alert on an open app"); } finally { await live.context.close(); }
  const fresh = await open({ path: "/?open=" + type + ":" + id, stubOptions: stubOptions });
  try { await check(fresh, "from a phone alert that opens the app"); } finally { await fresh.context.close(); }
};

const ROUND4_JOURNEYS = [
  {
    id: "deviceid",
    label: "A deviceId on every sign-in (API-55): a staff account's sign-in carries the phone's own id, the same on the next sign-in, and an office account's code step carries the same one. Main already sends it on every sign-in, so this cannot fail on main; it waits on the API to read it",
    run: async (open, language, expect) => {
      const SHAPE = /^[A-Za-z0-9._:-]{8,200}$/;
      const app = await open({ signedIn: false });
      try {
        await type(app.page, 'input[autocomplete="username"]', "4821");
        await type(app.page, 'input[type="password"]', "4907");
        await clickText(app.page, say("Sign In", language));
        await pause(app.page, 1500);
        const first = lastSent(app.stub, "POST", "/api/auth/login");
        const id = first && first.body ? first.body.deviceId : null;
        expect("a staff account's sign-in carries a deviceId of the shape the API reads", typeof id === "string" && SHAPE.test(id), first ? JSON.stringify(first.body && Object.keys(first.body)) : "nothing sent");
        const kept = await app.page.evaluate(() => { try { return window.localStorage.getItem("ocsa-device-id"); } catch (e) { return null; } });
        expect("the id is the phone's own, kept for the next sign-in", kept === id, JSON.stringify(kept));
      } finally { await app.context.close(); }
      const office = await open({ signedIn: false, stubOptions: { person: Object.assign({}, ADMIN_PERSON), secondStep: true } });
      try {
        await type(office.page, 'input[autocomplete="username"]', "4821");
        await type(office.page, 'input[type="password"]', "4907");
        await clickText(office.page, say("Sign In", language));
        const code = await shows(office.page, "#ocsa-code");
        if (code) await type(office.page, "#ocsa-code", SECOND_STEP_CODE);
        await pause(office.page, 1500);
        const login = lastSent(office.stub, "POST", "/api/auth/login");
        const step = lastSent(office.stub, "POST", "/api/auth/second-step");
        expect("an office account's code step carries the same deviceId as its sign-in", code && !!login && !!step && SHAPE.test(String(login.body.deviceId)) && step.body.deviceId === login.body.deviceId, JSON.stringify({ login: login && login.body && login.body.deviceId, step: step && step.body && step.body.deviceId }));
      } finally { await office.context.close(); }
    },
  },
  {
    id: "tokenexpired",
    label: "A token past its 12 hours (API-56): a check-off answered 401 auth.tokenExpired stays on the phone, sign-in comes back, and the check goes once the person signs in again. Main already keeps the tap, so this cannot fail on main; renewal waits on the API's route",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1500);
        const step = await openStep(app, language);
        if (!step) { expect("the list has a step still to do", false, "no open box"); return; }
        app.stub.state.refuse["POST /api/clock/tasks/" + step.id + "/complete"] = { status: 401, body: { error: "Token expired", code: "auth.tokenExpired" }, once: true };
        await tapAria(app.page, step.label);
        await pause(app.page, 1500);
        expect("the check-off answered 401 auth.tokenExpired stays on the phone", (await pendingTaps(app.page)) === 1, (await pendingTaps(app.page)) + " on the phone");
        const signIn = await shows(app.page, 'input[autocomplete="username"]', 4000);
        expect("sign-in comes back", signIn, (await bodyText(app.page)).slice(0, 160));
        if (signIn) {
          await type(app.page, 'input[autocomplete="username"]', "4821");
          await type(app.page, 'input[type="password"]', "4907");
          await clickText(app.page, say("Sign In", language));
          let left = 1;
          const until = Date.now() + 12000;
          while (Date.now() < until) { left = await pendingTaps(app.page); if (left === 0) break; await pause(app.page, 300); }
          const sends = checkoffSends(app.stub).filter(c => c.path.indexOf(step.id) !== -1).length;
          expect("signed in again, the kept check goes and leaves the phone", left === 0 && sends >= 2, left + " on the phone, " + sends + " sends in all");
        }
      } finally { await app.context.close(); }
    },
  },
  {
    id: "shiftnotices",
    label: "Shift notices (API-62): shift_assigned opens My Schedule from the bell, from a phone alert on an open app and from one that opens the app, and so does any later shift_ type the API adds for a change or a cancel. Main already opens My Schedule for every shift_ type, so this cannot fail on main; the API's new types are its own to name",
    run: async (open, language, expect) => {
      for (const type of ["shift_assigned", "shift_changed", "shift_cancelled"]) {
        const notice = { id: "n-r4-" + type, subjectType: type, subjectId: "shift-9", title: "Invented notice about " + type, body: "An invented notice.", link: null, createdAt: "2026-10-01T19:00:00.000Z", readAt: null };
        await threeWays(open, { notifications: [notice] }, type, "shift-9", notice.title, async (app, how) => {
          let tab = null;
          const until = Date.now() + 5000;
          while (Date.now() < until) { tab = await chosenTab(app.page); if (tab === say("Schedule", language)) break; await pause(app.page, 200); }
          expect("a " + type + " notice " + how + " opens My Schedule", tab === say("Schedule", language), JSON.stringify(tab));
        });
      }
    },
  },
  {
    id: "myreports",
    label: "My reports on Speak Up (API-63): each report the person sent, or the office opened for them, with its day and where it stands in plain words; none, and a list that did not load; and an hr_case_opened_for notice opens it with that report marked, from the bell and from a phone alert, never reading the office's case",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "speakup", language);
        const up = await shows(app.page, '[data-my-reports="2"]');
        const rows = await app.page.evaluate(() => Array.from(document.querySelectorAll("[data-my-report]")).map(r => ({ id: r.getAttribute("data-my-report"), text: r.innerText.replace(/\s+/g, " ").trim() })));
        expect("My reports lists the person's reports from GET /api/hr-cases/mine, newest first", up && rows.map(r => r.id).join() === "hr-mine-2,hr-mine-1" && callsTo(app.stub, "GET", "/api/hr-cases/mine").length === 1, JSON.stringify(rows));
        const sentWord = say("Sent {date}", language).split("{")[0].trim();
        expect("each report says the day it was sent and where it stands, in plain words and never the API's code", rows.length === 2 && has(rows[0].text, say("Being looked into", language)) && has(rows[1].text, say("Report closed", language)) && rows.every(r => has(r.text, sentWord) && !/in_review|escalated\b/.test(r.text)), JSON.stringify(rows));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
      const none = await open({ stubOptions: { myCases: [] } });
      try {
        await openTab(none.page, "speakup", language);
        await shows(none.page, '[data-my-reports="0"]');
        expect("with no report, My reports says so", has(await bodyText(none.page), say("You have no reports yet.", language)), (await bodyText(none.page)).slice(-200));
      } finally { await none.context.close(); }
      const failed = await open({ stubOptions: { refuse: { "GET /api/hr-cases/mine": { status: 500, body: { error: "Something went wrong" }, once: true } } } });
      try {
        await openTab(failed.page, "speakup", language);
        await pause(failed.page, 1500);
        const text = await bodyText(failed.page);
        expect("a list that did not load says so and offers Try again", has(text, say("Your reports did not load.", language)), text.slice(-240));
        await failed.page.evaluate((w) => { const b = Array.from(document.querySelectorAll("[data-my-reports] button")).find(x => x.innerText.trim() === w); if (b) b.click(); }, say("Try again", language));
        expect("Try again reads the list again and shows it", await shows(failed.page, '[data-my-reports="2"]'), (await bodyText(failed.page)).slice(-200));
      } finally { await failed.context.close(); }
      const notice = noticeOf("hr_case_opened_for");
      await threeWays(open, { notifications: [notice] }, "hr_case_opened_for", "hr-mine-2", notice.title, async (o, how) => {
        const marked = await shows(o.page, '[data-my-report="hr-mine-2"][data-my-report-focus="1"]');
        expect("an hr_case_opened_for notice " + how + " opens My reports with that report marked", marked, (await bodyText(o.page)).slice(0, 200));
        expect("the notice " + how + " never reads the office's case", callsTo(o.stub, "GET", "/api/hr-cases/hr-mine-2").length === 0, callsTo(o.stub, "GET", "/api/hr-cases/hr-mine-2").length + " reads");
      });
    },
  },
  {
    id: "filedreport",
    label: "A filed report from its notice (API-83): a form notice opens the report read only for a reader of it, from the bell and from a phone alert, through GET /api/forms/responses/:id; anyone else keeps Open in the dashboard on the bell and never reads it, and a report the API hides opens the bell",
    run: async (open, language, expect) => {
      const notice = noticeOf("form");
      const words = FILED_WORDS[language === "es" ? "es" : "en"];
      const stubOptions = { person: R4_SUPERVISOR, notifications: [notice] };
      await threeWays(open, stubOptions, "form", "fr-1", notice.title, async (app, how) => {
        const up = await shows(app.page, '[data-report-sheet="fr-1"] [data-report-read="1"]');
        expect("a form notice " + how + " opens the filed report, read only", up, (await bodyText(app.page)).slice(0, 200));
        if (!up || how !== "from the bell") return;
        const sheet = await app.page.evaluate(() => { const d = document.querySelector('[data-report-sheet="fr-1"]'); return { text: d.innerText.replace(/\s+/g, " "), fields: d.querySelectorAll("input, textarea, select, [contenteditable]").length, buttons: Array.from(d.querySelectorAll("button")).map(b => b.innerText.trim()) }; });
        expect("the report sheet shows the report in the screen's language: its form, its site, the day it was sent and its answers", has(sheet.text, say("Filed report", language)) && has(sheet.text, words.formName) && has(sheet.text, "North Building") && has(sheet.text, say("Sent {date}", language).split("{")[0].trim()) && has(sheet.text, words.whatSaid) && has(sheet.text, words.whereSaid), sheet.text.slice(0, 300));
        expect("the report sheet is read only and says where the report is worked, with the notice's Open in the dashboard and Close", sheet.fields === 0 && has(sheet.text, say("Read only. The report is worked on the dashboard.", language)) && sheet.buttons.join("|") === say("Open in the dashboard", language) + "|" + say("Close", language), JSON.stringify(sheet.buttons));
        expect("the report is read once, through the route the API gives the staff app", callsTo(app.stub, "GET", "/api/forms/responses/fr-1").length === 1, callsTo(app.stub, "GET", "/api/forms/responses/fr-1").length + " reads");
        await spokenHere(app, language, expect);
      });
      // A cleaner, who reads no filed report.
      const cleaner = await open({ stubOptions: { notifications: [notice] } });
      try {
        await tapOnBell(cleaner, notice.title);
        await pause(cleaner.page, 1500);
        const offered = await cleaner.page.evaluate(([t, w]) => { const b = Array.from(document.querySelectorAll("button")).find(y => y.innerText.indexOf(t) !== -1); const row = b && b.parentElement; return !!row && Array.from(row.querySelectorAll("button")).some(y => y.innerText.trim() === w); }, [notice.title, say("Open in the dashboard", language)]);
        expect("a form notice to someone who reads no report keeps Open in the dashboard on the bell, and the report is never read", !(await cleaner.page.evaluate(() => !!document.querySelector("[data-report-sheet]"))) && offered && callsTo(cleaner.stub, "GET", "/api/forms/responses/fr-1").length === 0, "offered " + offered + ", " + callsTo(cleaner.stub, "GET", "/api/forms/responses/fr-1").length + " reads");
      } finally { await cleaner.context.close(); }
      // A report the API hides from this reader (404): the bell, and the
      // next tap never asks again.
      const hidden = await open({ stubOptions: Object.assign({}, stubOptions, { refuse: { "GET /api/forms/responses/fr-1": { status: 404, body: { error: "Report not found", code: "forms.reportNotFound" } } } }) });
      try {
        await tapOnBell(hidden, notice.title);
        await pause(hidden.page, 2000);
        expect("a report the API hides closes its sheet and opens the bell", !(await hidden.page.evaluate(() => !!document.querySelector("[data-report-sheet]"))) && (await bellOpen(hidden.page, language)), (await bodyText(hidden.page)).slice(0, 200));
        await hidden.page.evaluate((t) => { const b = Array.from(document.querySelectorAll("button")).find(x => x.innerText.indexOf(t) !== -1); if (b) b.click(); }, notice.title);
        await pause(hidden.page, 1200);
        expect("tapped again, the notice stays on the bell and the report is not asked for again", callsTo(hidden.stub, "GET", "/api/forms/responses/fr-1").length === 1, callsTo(hidden.stub, "GET", "/api/forms/responses/fr-1").length + " reads");
      } finally { await hidden.context.close(); }
    },
  },
  {
    id: "codestaff",
    label: "The code screen for a staff role (API-85): a sign-in answered secondStep shows the code screen whatever the person's role, and the code signs them in. Main already shows it for any role, so this cannot fail on main; who gets the code is the API's to decide",
    run: async (open, language, expect) => {
      const app = await open({ signedIn: false, stubOptions: { secondStep: true } });
      try {
        await type(app.page, 'input[autocomplete="username"]', "4821");
        await type(app.page, 'input[type="password"]', "4907");
        await clickText(app.page, say("Sign In", language));
        const code = await shows(app.page, "#ocsa-code");
        expect("a staff account's sign-in answered secondStep shows the code screen", code, (await bodyText(app.page)).slice(0, 200));
        if (code) {
          await spokenHere(app, language, expect);
          await type(app.page, "#ocsa-code", SECOND_STEP_CODE);
          expect("the code signs the staff account in", await shows(app.page, ".sp-content", 8000), (await bodyText(app.page)).slice(0, 160));
        }
      } finally { await app.context.close(); }
    },
  },
  {
    id: "registerwords",
    label: "Register's words (API-117): a registration sent says a supervisor reviews it and OCSA emails once the person can sign in, and since part 363 a phone or email that already has an account gets the same words, the 201 the API answers it, with nothing said under the email box",
    run: async (open, language, expect) => {
      const reg = await open({ signedIn: false });
      try {
        await clickText(reg.page, say("New Employee? Register Here", language));
        await pause(reg.page, 700);
        const person = ["Riley", "Invented", "0000000009", "nine@example.invalid", "5739", "5739"];
        for (let i = 0; i < person.length; i += 1) await typeNth(reg.page, "input", i, person[i]);
        await clickText(reg.page, say("Register", language));
        const toast = await toastSaying(reg.page, say("Thank you. A supervisor reviews each registration, and OCSA emails you once you can sign in.", language));
        expect("a registration sent says what happens next, as a notice", !!toast && !toast.failure, JSON.stringify(await toastsNow(reg.page)));
        expect("Register sends the registration once, and the sign-in screen comes back", callsTo(reg.stub, "POST", "/api/auth/register").length === 1 && (await shows(reg.page, 'input[autocomplete="username"]', 3000)), callsTo(reg.stub, "POST", "/api/auth/register").length + " sent");
      } finally { await reg.context.close(); }
      const taken = await open({ signedIn: false });
      try {
        await clickText(taken.page, say("New Employee? Register Here", language));
        await pause(taken.page, 700);
        const person = ["Riley", "Invented", "0000000000", "riley@example.invalid", "5739", "5739"];
        for (let i = 0; i < person.length; i += 1) await typeNth(taken.page, "input", i, person[i]);
        await clickText(taken.page, say("Register", language));
        const toast = await toastSaying(taken.page, say("Thank you. A supervisor reviews each registration, and OCSA emails you once you can sign in.", language));
        expect("a phone or email that already has an account gets the same thank-you words, as a notice", !!toast && !toast.failure, JSON.stringify(await toastsNow(taken.page)));
        expect("and the sign-in screen comes back, the registration sent once and nothing written", callsTo(taken.stub, "POST", "/api/auth/register").length === 1 && (taken.stub.state.registered || []).length === 0 && (await shows(taken.page, 'input[autocomplete="username"]', 3000)), callsTo(taken.stub, "POST", "/api/auth/register").length + " sent");
        await spokenHere(taken, language, expect);
      } finally { await taken.context.close(); }
    },
  },
  {
    id: "addressguard",
    label: "Photo addresses (API-68, API-119): on the issue sheet a photo whose address is javascript:, a data: page, a // address or a /\\ one is never drawn or linked, an https photo signed for a while is drawn with its address whole, and a notice whose link is javascript: offers no dashboard",
    run: async (open, language, expect) => {
      const SIGNED = "https://photos.example.invalid/sink.jpg?token=signed-for-twelve-hours";
      const app = await open({ stubOptions: { issueSheet: true } });
      try {
        app.stub.state.sheetIssues[0].photos = [
          { id: "ip-1", url: "javascript:alert(document.domain)" },
          { id: "ip-2", url: "data:text/html,<b>invented</b>" },
          { id: "ip-3", url: SIGNED },
          { id: "ip-4", url: "//photos.example.invalid/no-scheme.jpg" },
          { id: "ip-5", url: "/\\photos.example.invalid/backslash.jpg" },
        ];
        await openTab(app.page, "issuetasks", language);
        await shows(app.page, '[data-work-row="issue:iss-a1"]');
        await app.page.click('[data-work-row="issue:iss-a1"]');
        const up = await shows(app.page, '[data-issue-sheet="iss-a1"] img');
        const drawn = await app.page.evaluate(() => { const d = document.querySelector('[data-issue-sheet="iss-a1"]'); return d ? { imgs: Array.from(d.querySelectorAll("img")).map(i => i.getAttribute("src")), links: Array.from(d.querySelectorAll("a")).map(a => a.getAttribute("href")) } : null; });
        const unsafe = (u) => /^\s*(javascript:|data:text|\/\/|\/\\)/i.test(String(u || ""));
        expect("no photo address that opens a page or a script is drawn or linked", up && !!drawn && !drawn.imgs.some(unsafe) && !drawn.links.some(unsafe), JSON.stringify(drawn));
        expect("an https photo signed for a while is drawn and linked with its address whole", !!drawn && drawn.imgs.indexOf(SIGNED) !== -1 && drawn.links.indexOf(SIGNED) !== -1 && drawn.imgs.length === 1, JSON.stringify(drawn));
      } finally { await app.context.close(); }
      const bad = { id: "n-r4-js", subjectType: "a_type_from_tomorrow", subjectId: "x-2", title: "Invented notice with a script for a link", body: "An invented notice.", link: "javascript:alert(document.domain)", createdAt: "2026-10-01T19:00:00.000Z", readAt: null };
      const good = Object.assign({}, bad, { id: "n-r4-https", subjectId: "x-3", title: "Invented notice with a dashboard link", link: "https://admin.example.invalid/#reports" });
      const bell = await open({ stubOptions: { notifications: [bad, good] } });
      try {
        await bell.page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(x => /notification|notificaci/i.test(x.getAttribute("aria-label") || "")), null, { timeout: 8000 }).catch(() => {});
        await bellButton(bell.page);
        await pause(bell.page, 1200);
        const offers = (title) => bell.page.evaluate(([t, w]) => { const b = Array.from(document.querySelectorAll("button")).find(y => y.innerText.indexOf(t) !== -1); const row = b && b.parentElement; return !!row && Array.from(row.querySelectorAll("button")).some(y => y.innerText.trim() === w); }, [title, say("Open in the dashboard", language)]);
        expect("a notice whose link is javascript: offers no dashboard, and an https one does", !(await offers(bad.title)) && (await offers(good.title)), "javascript: " + (await offers(bad.title)) + ", https: " + (await offers(good.title)));
      } finally { await bell.context.close(); }
    },
  },
  {
    id: "datedays",
    label: "Date-only columns (API-96): a birthday and an assigned due date the API sends as that day at midnight UTC show as that day on a phone in Honolulu and on one in Tokyo. Main already reads the first ten characters as the day, so this cannot fail on main; the API's own fix waits",
    run: async (open, language, expect) => {
      for (const zone of ["Pacific/Honolulu", "Asia/Tokyo"]) {
        const app = await open({ timezoneId: zone, stubOptions: { midnightDates: true, assignedDue: "2026-10-02T00:00:00.000Z" } });
        try {
          const loc = language === "es" ? "es-US" : "en-US";
          const days = await app.page.evaluate(([l]) => ({ born: new Date(1990, 7, 14).toLocaleDateString(l, { month: "short", day: "numeric", year: "numeric" }), bornEve: new Date(1990, 7, 13).toLocaleDateString(l, { month: "short", day: "numeric", year: "numeric" }), due: new Date(2026, 9, 2).toLocaleDateString(l, { month: "short", day: "numeric" }), dueEve: new Date(2026, 9, 1).toLocaleDateString(l, { month: "short", day: "numeric" }) }), [loc]);
          await openTab(app.page, "profile", language);
          await pause(app.page, 1500);
          const profile = await bodyText(app.page);
          expect("in " + zone + " the profile shows the birthday as August 14", has(profile, days.born) && !has(profile, days.bornEve), profile.slice(0, 400));
          await openTab(app.page, "issuetasks", language);
          await pause(app.page, 1200);
          const card = await bodyText(app.page);
          expect("in " + zone + " the assigned card reads the due day as October 2", has(card, say("Due:", language) + " " + days.due) && !has(card, say("Due:", language) + " " + days.dueEve), card.slice(0, 300));
        } finally { await app.context.close(); }
      }
    },
  },
  {
    id: "newrefusals",
    label: "The refusals new since Round 2, each in plain words with the next step: a drop already asked for (409 pickups.alreadyPosted), something too large or unreadable (413 common.bodyTooLarge, 400 and 415 common.badBody), a file over the limit in megabytes (uploads.tooLarge with maxBytes), a photo question already full (400 forms.photoLimit) or a photo already gone (404 forms.photoNotFound), and a second Start Shift read as success (200 sessions.alreadyOpen)",
    run: async (open, language, expect) => {
      // A drop sent again after its first answer was lost, and a drop
      // asked for a shift the office already posted for pickup.
      for (const how of ["lost", "posted"]) {
        const drop = await open({});
        try {
          if (how === "posted") drop.stub.state.drops["sh-1"] = { id: "os-office-1", status: "open" };
          await openTab(drop.page, "schedule", language);
          await openShiftDetail(drop.page, language, true);
          if (how === "lost") {
            drop.stub.state.trouble = { method: "POST", path: /^\/api\/pickups\/request-drop$/, kind: "lose" };
            await clickText(drop.page, say("Submit Request", language));
            await pause(drop.page, 2500);
          }
          const reads = callsTo(drop.stub, "GET", "/api/pickups/my-schedule").length;
          await clickText(drop.page, say("Submit Request", language));
          const toast = await toastSaying(drop.page, say("This shift already has a drop request, or it is already posted for pickup. There is nothing more to send.", language));
          await pause(drop.page, 900);
          const what = how === "lost" ? "a drop sent again after its answer was lost" : "a drop for a shift the office already posted";
          expect(what + " says there is nothing more to send, as a notice (409 pickups.alreadyPosted)", !!toast && !toast.failure, JSON.stringify(await toastsNow(drop.page)));
          expect(what + " closes the drop form and reads the schedule again", !(await drop.page.evaluate((w) => Array.from(document.querySelectorAll("button")).some(b => b.textContent.trim() === w && b.offsetParent !== null), say("Submit Request", language))) && callsTo(drop.stub, "GET", "/api/pickups/my-schedule").length > reads, "the form is still open, or the schedule was not read again");
          expect(what + " writes one drop at most", Object.keys(drop.stub.state.drops).length === 1, JSON.stringify(drop.stub.state.drops));
          if (how === "lost") await spokenHere(drop, language, expect);
        } finally { await drop.context.close(); }
      }
      // Too large, and unreadable, on a report.
      for (const [k, status, en] of [["bodyTooLarge", 413, "What you sent is too large. Use fewer or smaller photos, or shorter text, then try again."], ["badBody", 400, "What you sent could not be read. Try again, and tell the office if it happens again."], ["badBody", 415, "What you sent could not be read. Try again, and tell the office if it happens again."]]) {
        const app = await open({});
        try {
          await issueReady(false)(app, language);
          app.stub.state.refuse["POST /api/issues"] = { status: status, body: apiR4Body(k, language), once: true };
          await clickText(app.page, say("Submit Issue", language));
          const toast = await toastSaying(app.page, say(en, language));
          expect(status + " " + API_R4[k].code + " says what to do next", !!toast, JSON.stringify(await toastsNow(app.page)));
          expect(status + " " + API_R4[k].code + " keeps the report on screen", (await boxValue(app.page, ".sp-content input", 0)) === ISSUE_TITLE, JSON.stringify(await boxValue(app.page, ".sp-content input", 0)));
        } finally { await app.context.close(); }
      }
      // A photo over the limit, said in megabytes.
      for (const [status, maxBytes, en, mb] of [[400, 10485760, "This file is over {mb} MB. Choose a smaller photo or file.", 10], [413, 52428800, "This file is over {mb} MB. Choose a smaller photo or file.", 50], [400, null, "This file is too large. Choose a smaller photo or file.", null]]) {
        const app = await open({});
        try {
          await issueReady(true)(app, language);
          app.stub.state.refuse["POST /api/uploads"] = { status: status, body: apiR4Body("uploadTooLarge", language, null, maxBytes ? { maxBytes: maxBytes } : {}), once: true };
          await clickText(app.page, say("Submit Issue", language));
          const words = say(en, language).replace("{mb}", String(mb));
          const toast = await toastSaying(app.page, words);
          expect(status + " uploads.tooLarge" + (maxBytes ? " with maxBytes " + maxBytes + " says the limit, " + mb + " MB," : " with no maxBytes says the file is too large") + " and what to do next", !!toast, JSON.stringify(await toastsNow(app.page)));
          expect("the report and its photo stay for the try again (" + status + ")", (await boxValue(app.page, ".sp-content input", 0)) === ISSUE_TITLE && await app.page.evaluate(() => !!document.querySelector('.sp-content img[src^="data:"]')), "the report is gone");
        } finally { await app.context.close(); }
      }
      // A photo question filled from another phone, then a photo taken off
      // there.
      const form = await open({});
      try {
        const f = formP(language);
        const q = f.fields.find(x => x.type === "photos");
        const input = '.sp-content input[type="file"]';
        const removeWord = say("Remove photo", language);
        await openTab(form.page, "forms", language);
        await pause(form.page, 900);
        await startForm(form.page, f.title);
        await attachPhotos(form.page, input, ["one.jpg", "two.jpg"]);
        await pause(form.page, 2500);
        const held = form.stub.state.answersP[q.key] || [];
        form.stub.state.answersP[q.key] = held.concat([{ id: "ph-other", name: "other.jpg", bytes: 10, contentType: "image/jpeg", uploadedAt: held.length ? held[0].uploadedAt : null }]);
        if (held[0]) form.stub.state.photoBytes["ph-other"] = form.stub.state.photoBytes[held[0].id];
        await attachPhotos(form.page, input, ["three.jpg"]);
        await pause(form.page, 1500);
        const limit = fill(say("This question takes {max} photos at most. Remove one to add another.", language), { max: FORM_P_MAX_PHOTOS });
        expect("a photo question already full says its limit and the next step", has(await bodyText(form.page), limit), (await bodyText(form.page)).slice(0, 500));
        // one.jpg is taken off on the other phone; this phone still shows it.
        form.stub.state.answersP[q.key] = form.stub.state.answersP[q.key].filter(p => p.name !== "one.jpg");
        const draftReads = callsTo(form.stub, "GET", "/api/forms/drafts/draft-two").length;
        await clickText(form.page, removeWord);
        const gone = await toastSaying(form.page, say("This photo was already removed. The question now shows the photos that are kept.", language));
        await pause(form.page, 1500);
        const text = await bodyText(form.page);
        expect("a photo already gone says so as a notice", !!gone && !gone.failure, JSON.stringify(await toastsNow(form.page)));
        expect("the question's photos are read again and show what the API kept", callsTo(form.stub, "GET", "/api/forms/drafts/draft-two").length > draftReads && !has(text, "one.jpg") && has(text, "two.jpg") && has(text, "other.jpg"), text.slice(0, 500));
        await spokenHere(form, language, expect);
      } finally { await form.context.close(); }
      // A second Start Shift after the first one's answer was lost.
      const start = await open({ stubOptions: { clockedIn: false } });
      try {
        await openTab(start.page, "clock", language);
        await pause(start.page, 800);
        await pickSite(start.page, "South Building");
        await pause(start.page, 400);
        start.stub.state.trouble = { method: "POST", path: /^\/api\/shift-sessions$/, kind: "lose" };
        await clickText(start.page, say("Start Shift", language));
        await pause(start.page, 2500);
        await clickText(start.page, say("Start Shift", language));
        const words = refusalIn(API_R4.alreadyOpen, language, { site: "South Building" });
        const toast = await toastSaying(start.page, words, 6000);
        await pause(start.page, 900);
        expect("a second Start Shift answered 200 sessions.alreadyOpen is read as success, in the API's words", !!toast && !toast.failure, JSON.stringify(await toastsNow(start.page)));
        expect("it opens the shift's checklist, and only one shift was started", (await chosenTab(start.page)) === say("Tasks", language) && start.stub.state.shiftTaps.filter(x => x.kind === "start").length === 1, JSON.stringify({ tab: await chosenTab(start.page), starts: start.stub.state.shiftTaps.length }));
      } finally { await start.context.close(); }
    },
  },
];
JOURNEYS.push(...ROUND4_JOURNEYS);

// --- The staff app's own findings (part 367) ------------------------------
//
// One journey for each Before 100 finding this part takes, PORT-18 to
// PORT-30 (PORT-31 aside) and PORT-33 and PORT-34, each failing on the
// main of part 359 and passing once its fix is in. Every one runs in
// English and in Spanish.
const P367_SUPERVISOR = Object.assign({}, PERSON, { id: "u-p367-sup", role: "supervisor" });
// The box under a label the screen draws, by the label's own words.
const typeLabeled = (page, label, value) => { TYPED.add(String(value)); return page.evaluate(([want, v]) => {
  const l = Array.from(document.querySelectorAll(".sp-content label")).find(x => x.textContent.trim() === want);
  const e = l && l.parentElement ? l.parentElement.querySelector("input, textarea") : null;
  if (!e) return false;
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(e, v);
  e.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}, [label, value]); };
const reloadApp = async (app) => { await app.page.reload(); await app.page.waitForFunction(() => !!document.querySelector(".sp-content"), null, { timeout: 10000 }).catch(() => {}); await pause(app.page, 1200); };
const errorToast = (page) => page.evaluate(() => {
  const strip = Array.from(document.querySelectorAll("div")).find((x) => { const s = getComputedStyle(x); return s.position === "fixed" && s.top === "80px"; });
  const kids = strip ? Array.from(strip.children).filter(k => k.tagName === "DIV") : [];
  return kids.map(k => ({ text: k.innerText.trim(), close: !!k.querySelector("button[aria-label]") }));
});
const uploadsOf = (stub) => sent(stub, "POST", "/api/uploads").map(c => (c.files && c.files[0]) || { bytes: 0, kind: null, size: null, ext: null });
// The kept page, the files and the network a service worker meets, for
// the worker the build carries, run in a sandbox of its own (PORT-28).
const workerAnswer = async (net, keptPaths, path, waitMs) => {
  const vm = require("vm");
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "build", "sw.js"), "utf8");
  const origin = "https://staff.example.invalid";
  const store = new Map((keptPaths || []).map(p => [p, new Response("kept " + p, { status: 200 })]));
  const cache = { match: async (p) => (store.has(p) ? store.get(p).clone() : undefined), put: async (p, r) => { store.set(p, r); } };
  const handlers = {};
  const self = { location: { origin: origin }, addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting: () => {}, clients: { claim: async () => {}, matchAll: async () => [] }, registration: { showNotification: async () => {} } };
  const ctx = vm.createContext({ self: self, caches: { open: async () => cache, delete: async () => true, keys: async () => [] }, fetch: net, Response: Response, URL: URL, Promise: Promise, setTimeout: setTimeout, clearTimeout: clearTimeout, console: { log() {}, warn() {}, error() {} } });
  vm.runInContext(src, ctx);
  const nav = path === "/";
  const event = { request: { method: "GET", url: origin + path, mode: nav ? "navigate" : "no-cors", referrer: nav ? "" : origin + "/" }, respondWith(p) { this.answer = p; }, waitUntil() {} };
  handlers.fetch(event);
  if (!event.answer) return { kind: "none" };
  const started = Date.now();
  const res = await Promise.race([Promise.resolve(event.answer).then(r => r, () => null), new Promise(done => setTimeout(() => done("waiting"), waitMs))]);
  if (res === "waiting") return { kind: "waiting", ms: Date.now() - started };
  if (!res) return { kind: "error", ms: Date.now() - started };
  return { kind: "answer", status: res.status, type: res.type, text: res.type === "error" ? "" : await res.clone().text().catch(() => ""), ms: Date.now() - started };
};

const PART367_JOURNEYS = [
  {
    id: "profilechanged",
    label: "Saving the profile sends only what the person changed (PORT-18): a city changed sends the city alone, never personalNotes or a field the read left out, and Save with nothing changed sends nothing",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "profile", language);
        await pause(app.page, 900);
        await clickText(app.page, say("Edit", language));
        await pause(app.page, 400);
        await clickText(app.page, say("Save", language));
        await pause(app.page, 900);
        expect("Save with nothing changed sends nothing", sent(app.stub, "PATCH", "/api/users/profile/me").length === 0, JSON.stringify(sent(app.stub, "PATCH", "/api/users/profile/me").map(c => c.body)));
        await clickText(app.page, say("Edit", language));
        await pause(app.page, 400);
        const typed = await typeLabeled(app.page, say("City", language), "Invented City");
        await clickText(app.page, say("Save", language));
        await pause(app.page, 1200);
        const saves = sent(app.stub, "PATCH", "/api/users/profile/me");
        const body = saves.length ? saves[saves.length - 1].body : null;
        expect("a city changed sends the city alone", typed && saves.length === 1 && !!body && JSON.stringify(Object.keys(body)) === JSON.stringify(["city"]) && body.city === "Invented City", JSON.stringify(saves.map(c => c.body)));
        expect("personalNotes, which the screen never draws, is never sent", !saves.some(c => c.body && Object.prototype.hasOwnProperty.call(c.body, "personalNotes")), JSON.stringify(saves.map(c => c.body && Object.keys(c.body))));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "sheetphoto",
    label: "Resolving an issue from its sheet with no task for it (PORT-19): the photo rides on the PATCH that resolves, the issue never reads resolved without it, and a save that fails keeps the note and the photo and goes again with the photo uploaded once",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { issueSheet: true } });
      try {
        app.stub.state.sheetIssues.push({ id: "iss-c3", site_id: "site-north", site_name: "North Building", title: "Invented cracked tile by the door", description: "A cracked floor tile, invented.", zone: "Entrance", severity: "low", status: "open", source: "staff",
          reported_by: "s-02", reported_by_name: "Ben Brooks", reported_at: "2026-10-01T19:00:00.000Z", assigned_to: PERSON.id, assigned_to_name: PERSON.firstName + " " + PERSON.lastName, linked_task_id: null, due_at: null, due_state: null, resolution_notes: null });
        app.stub.state.refuse["POST /api/issues/iss-c3/photos"] = { status: 500, error: "Something went wrong on our end. Try again in a minute." };
        await pause(app.page, 1500);
        await tapAlert(app, "issue", "iss-c3");
        const opened = await shows(app.page, '[data-issue-sheet="iss-c3"] [data-issue-action="resolve"]', 8000);
        expect("the issue's sheet opens with Resolved", opened, (await sheetText(app.page)).slice(0, 200));
        if (!opened) return;
        await app.page.click('[data-issue-sheet="iss-c3"] [data-issue-action="resolve"]');
        await pause(app.page, 400);
        const note = "Replaced the tile, invented";
        await type(app.page, "[data-issue-sheet] textarea", note);
        await attachPhoto(app.page, '[data-issue-sheet] input[type="file"]');
        await pause(app.page, 900);
        app.stub.state.trouble = { method: "PATCH", path: /^\/api\/issues\/iss-c3$/, kind: "500" };
        await app.page.click('[data-issue-send="resolve"]');
        await pause(app.page, 1800);
        const issue = () => app.stub.state.sheetIssues.find(i => i.id === "iss-c3");
        expect("a save that fails leaves the issue as it was", issue().status === "open", issue().status);
        expect("a save that fails keeps the note and the photo", (await boxValue(app.page, "[data-issue-sheet] textarea", 0)) === note && (await app.page.evaluate(() => !!document.querySelector('[data-issue-sheet] img[src^="data:"]'))), JSON.stringify(await boxValue(app.page, "[data-issue-sheet] textarea", 0)));
        await app.page.click('[data-issue-send="resolve"]').catch(() => {});
        await pause(app.page, 1800);
        const patches = app.stub.state.sheetCalls.filter(c => c.route === "issue" && c.id === "iss-c3");
        const last = patches[patches.length - 1];
        expect("the PATCH that resolves carries the photo's address", !!last && last.body.status === "resolved" && typeof last.body.photoUrl === "string" && last.body.photoUrl.length > 0, JSON.stringify(patches.map(c => c.body)));
        expect("the issue never reads resolved without its photo", issue().status !== "resolved" || (issue().photos || []).length >= 1, issue().status + ", " + (issue().photos || []).length + " photos");
        expect("the photo is uploaded once across both tries", sent(app.stub, "POST", "/api/uploads").length === 1, sent(app.stub, "POST", "/api/uploads").length + " uploads");
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "workkept",
    label: "Work in progress stays on the phone through a reload (PORT-20): an issue being reported with its photo, sent again after a lost answer as the same issue; a resolution on Assigned; one on an issue's sheet; a Help question; an App support ticket; and profile edits",
    run: async (open, language, expect) => {
      // The issue report, its photo, and its clientId after a lost answer.
      const app = await open({});
      try {
        await issueReady(true)(app, language);
        await typeNth(app.page, ".sp-content textarea", 0, "Water by the second sink, invented");
        await pause(app.page, 500);
        await reloadApp(app);
        await openTab(app.page, "issues", language);
        await pause(app.page, 800);
        const title = await boxValue(app.page, ".sp-content input", 0);
        const photo = await app.page.evaluate(() => !!document.querySelector('.sp-content img[src^="data:"]'));
        expect("an issue being reported is back after a reload, words and photo", title === "A leak under the sink, weak signal" && photo, JSON.stringify({ title, photo }));
        app.stub.state.trouble = { method: "POST", path: /^\/api\/issues$/, kind: "lose" };
        await clickText(app.page, say("Submit Issue", language));
        await pause(app.page, 2500);
        await reloadApp(app);
        await openTab(app.page, "issues", language);
        await pause(app.page, 800);
        await clickText(app.page, say("Submit Issue", language));
        await pause(app.page, 1800);
        const posts = issueSends(app.stub);
        expect("sent again after the answer was lost and the app reloaded, it is still one issue", posts.length === 2 && sameClientId(posts) === 1 && app.stub.state.issues.length === 1, posts.length + " sends, " + sameClientId(posts) + " clientIds, " + app.stub.state.issues.length + " issues");
        await reloadApp(app);
        await openTab(app.page, "issues", language);
        await pause(app.page, 800);
        expect("once it is in, nothing is kept or drawn back", (await boxValue(app.page, ".sp-content input", 0)) === "", JSON.stringify(await boxValue(app.page, ".sp-content input", 0)));
      } finally { await app.context.close(); }
      // A resolution on Assigned.
      const res = await open({});
      try {
        await openTab(res.page, "issuetasks", language);
        await pause(res.page, 900);
        await openItem(res.page, "Replace the cracked light cover");
        await pause(res.page, 700);
        await clickText(res.page, say("Resolved", language));
        await typeNth(res.page, ".sp-content textarea", 0, "Put a new cover on, kept");
        await attachPhoto(res.page, '.sp-content input[type="file"]');
        await pause(res.page, 900);
        await reloadApp(res);
        await openTab(res.page, "issuetasks", language);
        await pause(res.page, 900);
        await openItem(res.page, "Replace the cracked light cover");
        await pause(res.page, 900);
        const note = await boxValue(res.page, ".sp-content textarea", 0);
        const pic = await res.page.evaluate(() => !!document.querySelector('.sp-content img[src^="data:"]'));
        expect("a resolution on Assigned is back when its task opens again, note and photo", note === "Put a new cover on, kept" && pic, JSON.stringify({ note, pic }));
        await clickText(res.page, say("Submit Resolution", language));
        await pause(res.page, 1800);
        const left = await res.page.evaluate(() => Object.keys(window.localStorage).filter(k => k.indexOf("ocsa-staff-work:") === 0 && k.indexOf(":resolve:") !== -1));
        expect("once it is saved, nothing of it stays on the phone", sent(res.stub, "PATCH", "/api/clock/tasks/resolve/").length === 1 && left.length === 0, JSON.stringify(left));
      } finally { await res.context.close(); }
      // A resolution on an issue's sheet.
      const sh = await open({ stubOptions: { issueSheet: true } });
      try {
        await pause(sh.page, 1500);
        await tapAlert(sh, "issue", "iss-a1");
        if (await shows(sh.page, '[data-issue-sheet="iss-a1"] [data-issue-action="resolve"]', 8000)) {
          await sh.page.click('[data-issue-sheet="iss-a1"] [data-issue-action="resolve"]');
          await type(sh.page, "[data-issue-sheet] textarea", "Tightened the trap, kept");
          await pause(sh.page, 600);
        }
        await reloadApp(sh);
        await tapAlert(sh, "issue", "iss-a1");
        await shows(sh.page, "[data-issue-sheet] textarea", 8000);
        expect("a resolution on an issue's sheet is back when the sheet opens again", (await boxValue(sh.page, "[data-issue-sheet] textarea", 0)) === "Tightened the trap, kept", JSON.stringify(await boxValue(sh.page, "[data-issue-sheet] textarea", 0)));
      } finally { await sh.context.close(); }
      // A Help question, an App support ticket and profile edits.
      const more = await open({ stubOptions: { support: true } });
      try {
        await openTab(more.page, "agent", language);
        await pause(more.page, 900);
        await type(more.page, ".sp-content textarea", "Where do I find the mop sink, kept");
        await pause(more.page, 500);
        await reloadApp(more);
        await openTab(more.page, "agent", language);
        await pause(more.page, 900);
        expect("a Help question is back after a reload", (await boxValue(more.page, ".sp-content textarea", 0)) === "Where do I find the mop sink, kept", JSON.stringify(await boxValue(more.page, ".sp-content textarea", 0)));
        await openTab(more.page, "support", language);
        await pause(more.page, 900);
        await type(more.page, ".sp-content textarea", "The schedule froze, kept");
        await pause(more.page, 500);
        await openTab(more.page, "profile", language);
        await pause(more.page, 900);
        await clickText(more.page, say("Edit", language));
        await typeLabeled(more.page, say("City", language), "Kept City");
        await pause(more.page, 500);
        await reloadApp(more);
        await openTab(more.page, "support", language);
        await pause(more.page, 900);
        expect("an App support ticket is back after a reload", (await boxValue(more.page, ".sp-content textarea", 0)) === "The schedule froze, kept", JSON.stringify(await boxValue(more.page, ".sp-content textarea", 0)));
        await openTab(more.page, "profile", language);
        await pause(more.page, 1200);
        const city = await more.page.evaluate((want) => { const l = Array.from(document.querySelectorAll(".sp-content label")).find(x => x.textContent.trim() === want); const e = l && l.parentElement.querySelector("input"); return e ? e.value : null; }, say("City", language));
        expect("profile edits not yet saved are back after a reload, still editing", city === "Kept City", JSON.stringify(city));
        await clickText(more.page, say("Save", language));
        await pause(more.page, 1200);
        const saves = sent(more.stub, "PATCH", "/api/users/profile/me");
        expect("and Save then sends only the city", saves.length === 1 && JSON.stringify(Object.keys(saves[0].body || {})) === JSON.stringify(["city"]), JSON.stringify(saves.map(c => c.body)));
        await spokenHere(more, language, expect);
      } finally { await more.context.close(); }
    },
  },
  {
    id: "formleave",
    label: "Leaving a form (PORT-21): Leave whose save fails stays on the form and says the latest answers did not save, with Leave without saving; a tap on the bottom bar asks first, and leaves once the page has saved",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "forms", language);
        const started = await startForm(app.page, formP(language).title);
        expect("the form opens", started, (await bodyText(app.page)).slice(0, 160));
        if (!started) return;
        await typeNth(app.page, ".sp-content textarea, .sp-content input[type=\"text\"]", 0, "Invented note on the walk");
        await pause(app.page, 400);
        app.stub.state.trouble = { method: "PATCH", path: /^\/api\/forms\/drafts\/[^/]+$/, kind: "500", left: 3 };
        await clickText(app.page, say("Close", language));
        await clickText(app.page, say("Leave", language));
        await pause(app.page, 1500);
        const still = await app.page.evaluate(() => !!document.querySelector("[data-form-frame]"));
        const failed = await app.page.evaluate(() => { const d = document.querySelector('[data-form-leave="failed"]'); return d ? d.innerText : ""; });
        expect("Leave whose save fails stays on the form", still, "the form closed");
        expect("and says the latest answers did not save, offering Leave without saving", has(failed, say("Your latest answers did not save. Keep filling to try again, or leave without them.", language)) && has(failed, say("Leave without saving", language)), failed.slice(0, 200));
        await clickText(app.page, say("Keep filling", language));
        app.stub.state.trouble = null;
        // The bottom bar's Schedule while the form is open.
        await app.page.evaluate((want) => { const bar = Array.from(document.querySelectorAll("div")).find((el) => { const s = getComputedStyle(el); return s.position === "fixed" && s.bottom === "0px" && el.querySelectorAll(":scope > button").length >= 5; }); const b = bar && Array.from(bar.querySelectorAll(":scope > button")).find(x => x.textContent.trim().replace(/^[\d+]+/, "") === want); if (b) b.click(); }, say("Schedule", language));
        await pause(app.page, 800);
        const asked = await app.page.evaluate(() => !!document.querySelector('[data-form-leave="ask"]'));
        expect("a tap on the bottom bar under a form asks before leaving", asked && (await chosenTab(app.page)) !== say("Schedule", language), JSON.stringify({ asked, tab: await chosenTab(app.page) }));
        const before = sent(app.stub, "PATCH", "/api/forms/drafts/").length;
        await clickText(app.page, say("Leave", language));
        await pause(app.page, 1500);
        expect("Leave saves the page, then makes the move the bar asked for", sent(app.stub, "PATCH", "/api/forms/drafts/").length > before && (await chosenTab(app.page)) === say("Schedule", language), JSON.stringify({ saves: sent(app.stub, "PATCH", "/api/forms/drafts/").length - before, tab: await chosenTab(app.page) }));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "formroom",
    label: "A form at the Largest text size on a short phone (PORT-22): Next and Back, scrolled to, sit above the bottom bar and a tap on them reaches them, in Spanish whose foot takes two rows and in English",
    run: async (open, language, expect) => {
      const app = await open({ textSize: "largest", theme: "light", stubOptions: { accountPreferences: { language: language, textSize: "largest" } } });
      try {
        await openTab(app.page, "forms", language);
        const started = await startForm(app.page, formP(language).title);
        if (!started) { expect("the form opens", false, (await bodyText(app.page)).slice(0, 160)); return; }
        for (let i = 0; i < 2; i += 1) {
          const where = await app.page.evaluate((words) => {
            const bar = Array.from(document.querySelectorAll("div")).find((el) => { const s = getComputedStyle(el); return s.position === "fixed" && s.bottom === "0px" && el.querySelectorAll(":scope > button").length >= 5; });
            const top = bar ? bar.getBoundingClientRect().top : innerHeight;
            return words.map((w) => {
              const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.offsetParent && x.textContent.trim() === w);
              if (!b) return null;
              b.scrollIntoView({ block: "nearest" });
              const r = b.getBoundingClientRect();
              const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              return { word: w, bottom: Math.round(r.bottom), barTop: Math.round(top), reached: !!hit && (hit === b || b.contains(hit)) };
            }).filter(Boolean);
          }, [say("Next", language), say("Back", language)]);
          expect("page " + (i + 1) + ": Next and Back sit above the bottom bar once scrolled to, and a tap reaches them", where.length > 0 && where.every(w => w.bottom <= w.barTop + 1 && w.reached), JSON.stringify(where));
          await clickText(app.page, say("Next", language));
          await pause(app.page, 600);
        }
      } finally { await app.context.close(); }
    },
  },
  {
    id: "droponce",
    label: "A shift drop request tapped twice (PORT-23): Submit Request sends one request and reads Sending... while it goes",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "schedule", language);
        await pause(app.page, 1200);
        const opened = await openShiftDetail(app.page, language, true);
        expect("a shift's drop form opens", opened, (await bodyText(app.page)).slice(0, 160));
        if (!opened) return;
        app.stub.state.holdMs["POST /api/pickups/request-drop"] = 1500;
        const word = say("Submit Request", language);
        const tapped = await app.page.evaluate((w) => { const b = Array.from(document.querySelectorAll("button")).find(x => x.offsetParent && x.textContent.trim() === w); if (!b) return 0; b.click(); setTimeout(() => b.click(), 120); setTimeout(() => b.click(), 400); return 1; }, word);
        await pause(app.page, 700);
        const busy = await app.page.evaluate((w) => Array.from(document.querySelectorAll("button")).some(x => x.offsetParent && x.textContent.trim() === w && x.disabled), say("Sending...", language));
        await pause(app.page, 2200);
        const posts = sent(app.stub, "POST", "/api/pickups/request-drop");
        expect("Submit Request tapped three times sends one drop request", tapped && posts.length === 1, posts.length + " sent");
        expect("it reads Sending... and takes no tap while it goes", busy, "no busy button");
      } finally { await app.context.close(); }
    },
  },
  {
    id: "nightoverdue",
    label: "A critical block's Overdue on the checklist day, 4:00 AM to 4:00 AM (PORT-24): the evening's 6:00 PM block, unfinished, still reads Overdue at 12:30 AM, and the morning's 9:30 AM block reads Overdue at 3:30 AM, still the same checklist day",
    run: async (open, language, expect) => {
      const cases = [
        { at: "2026-10-02T04:30:00Z", shift: "Second shift", block: "Dining room reset", when: "at 12:30 AM" },
        { at: "2026-10-02T07:30:00Z", shift: "First shift", block: "Kitchen floor", when: "at 3:30 AM" },
      ];
      for (const c of cases) {
        const app = await open({ now: c.at, stubOptions: { site: "site-east", shiftLabel: c.shift, now: c.at } });
        try {
          await openTab(app.page, "tasks", language);
          await app.page.waitForFunction(() => document.querySelectorAll("[data-block]").length > 3, null, { timeout: 8000 }).catch(() => {});
          await pause(app.page, 600);
          const when = await app.page.evaluate((key) => { const b = document.querySelector('[data-block="' + key + '"]'); return b ? b.getAttribute("data-block-when") : null; }, c.block);
          expect("the " + c.shift + "'s " + c.block + " block, unfinished, reads Overdue " + c.when, when === "overdue", JSON.stringify(when));
        } finally { await app.context.close(); }
      }
    },
  },
  {
    id: "statusfault",
    label: "Home when the shift status did not load at sign-in (PORT-25): it says so with Try again in place of the site list and Start Shift, and Try again draws them once the status answers",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { clockedIn: false, refuse: { "GET /api/clock/status": { status: 500, error: "Something went wrong on our end. Try again in a minute." } } } });
      try {
        await openTab(app.page, "clock", language);
        await pause(app.page, 1500);
        const fault = await app.page.evaluate(() => { const d = document.querySelector("[data-status-fault]"); return d ? d.innerText : ""; });
        const startShift = () => app.page.evaluate((w) => Array.from(document.querySelectorAll(".sp-content button")).some(x => x.offsetParent !== null && x.innerText.replace(/\s+/g, " ").trim().indexOf(w) === 0), say("Start Shift", language));
        const start = await startShift();
        expect("Home says the shift did not load, with Try again", has(fault, say("Your shift did not load.", language)) && has(fault, say("Try again", language)), fault || (await bodyText(app.page)).slice(0, 200));
        expect("and draws no Start Shift while it does not know", !start, "Start Shift is drawn");
        delete app.stub.state.refuse["GET /api/clock/status"];
        await clickText(app.page, say("Try again", language));
        await pause(app.page, 1500);
        expect("Try again reads the status and draws the sites and Start Shift", !(await app.page.evaluate(() => !!document.querySelector("[data-status-fault]"))) && (await startShift()), (await bodyText(app.page)).slice(0, 200));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "timeofffault",
    label: "My Schedule when time off did not load (PORT-26): the leave types failing says Time off did not load with Try again, and My time off failing says so, never No time off requests yet",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { timeOffTypesLive: true, refuse: { "GET /api/time-off/types": { status: 500, error: "Something went wrong on our end. Try again in a minute.", once: true } } } });
      try {
        await openTab(app.page, "schedule", language);
        await pause(app.page, 1500);
        const types = await app.page.evaluate(() => { const d = document.querySelector('[data-timeoff-fault="types"]'); return d ? d.innerText : ""; });
        expect("the leave types failing says Time off did not load, with Try again", has(types, say("Time off did not load.", language)) && has(types, say("Try again", language)), types || (await bodyText(app.page)).slice(0, 200));
        await clickText(app.page, say("Try again", language));
        await pause(app.page, 1500);
        expect("Try again reads them and offers Request time off", await hasButton(app.page, say("Request time off", language)), (await bodyText(app.page)).slice(0, 200));
      } finally { await app.context.close(); }
      const mine = await open({ stubOptions: { timeOffTypesLive: true, refuse: { "GET /api/time-off/mine": { status: 500, error: "Something went wrong on our end. Try again in a minute.", once: true } } } });
      try {
        await openTab(mine.page, "schedule", language);
        await pause(mine.page, 1500);
        const text = await bodyText(mine.page);
        expect("My time off failing says so with Try again", has(text, say("Your time off requests did not load.", language)), text.slice(0, 260));
        expect("and never says there are none", !has(text, say("No time off requests yet.", language)), text.slice(0, 260));
        await spokenHere(mine, language, expect);
      } finally { await mine.context.close(); }
    },
  },
  {
    id: "issuephotosize",
    label: "Issue and resolution photos (PORT-27): a 4000 by 3000 photo on Report goes as a JPEG of 2000 pixels at most, a HEIC goes as a JPEG, and a resolution's photo on Assigned is held the same way",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "issues", language);
        await clickText(app.page, say("Report an Issue", language));
        await typeNth(app.page, ".sp-content input", 0, "A big photo of the leak, invented");
        await attachDrawn(app.page, '.sp-content input[type="file"]', "big.jpg", 4000, 3000);
        await pause(app.page, 2500);
        await clickText(app.page, say("Submit Issue", language));
        await pause(app.page, 2000);
        const big = uploadsOf(app.stub)[0];
        expect("a 4000 by 3000 photo goes as a JPEG of 2000 pixels at most", !!big && !!big.kind && big.kind.ext === "jpg" && !!big.size && Math.max(big.size.width, big.size.height) <= 2000, JSON.stringify(big));
        await clickText(app.page, say("Report an Issue", language));
        await typeNth(app.page, ".sp-content input", 0, "A HEIC photo of the leak, invented");
        await attachBytes(app.page, '.sp-content input[type="file"]', HEIC_FIXTURE, "IMG_0001.HEIC", "image/heic");
        await pause(app.page, 4000);
        await clickText(app.page, say("Submit Issue", language));
        await pause(app.page, 2000);
        const heic = uploadsOf(app.stub)[1];
        expect("a HEIC goes as a JPEG named .jpg", !!heic && heic.ext === "jpg" && !!heic.kind && heic.kind.ext === "jpg", JSON.stringify(heic));
      } finally { await app.context.close(); }
      const res = await open({});
      try {
        await openTab(res.page, "issuetasks", language);
        await pause(res.page, 900);
        await openItem(res.page, "Replace the cracked light cover");
        await pause(res.page, 700);
        await clickText(res.page, say("Resolved", language));
        await typeNth(res.page, ".sp-content textarea", 0, "Put a new cover on, invented");
        await attachDrawn(res.page, '.sp-content input[type="file"]', "big.jpg", 3000, 4000);
        await pause(res.page, 2500);
        await clickText(res.page, say("Submit Resolution", language));
        await pause(res.page, 2000);
        const up = uploadsOf(res.stub)[0];
        expect("a resolution's 3000 by 4000 photo goes as a JPEG of 2000 pixels at most", !!up && !!up.size && Math.max(up.size.width, up.size.height) <= 2000, JSON.stringify(up));
      } finally { await res.context.close(); }
    },
  },
  {
    id: "workerwaits",
    label: "The service worker with one bar (PORT-28): the page answers from what is kept within about four seconds when the network has not, a 503 for the page gives way to the kept copy, a file the page loads does the same, and with nothing kept the network is waited on",
    run: async (open, language, expect) => {
      const never = () => new Promise(() => {});
      const slow = await workerAnswer(never, ["/", "/sds"], "/", 8000);
      expect("the page answers from what is kept within about four seconds when the network has not", slow.kind === "answer" && slow.text === "kept /" && slow.ms < 6000, JSON.stringify(slow));
      const down = await workerAnswer(async () => new Response("bad gateway", { status: 503 }), ["/", "/sds"], "/", 8000);
      expect("a 503 for the page gives way to the kept copy", down.kind === "answer" && down.text === "kept /", JSON.stringify(down));
      const file = await workerAnswer(never, ["/", "/static/js/main.abc123.js"], "/static/js/main.abc123.js", 8000);
      expect("a file the page loads answers from what is kept within about four seconds too", file.kind === "answer" && file.text === "kept /static/js/main.abc123.js" && file.ms < 6000, JSON.stringify(file));
      const good = await workerAnswer(async () => new Response("fresh", { status: 200 }), ["/"], "/", 8000);
      expect("a good answer from the network is the one drawn", good.kind === "answer" && good.text === "fresh", JSON.stringify(good));
      const empty = await workerAnswer(() => new Promise(done => setTimeout(() => done(new Response("late", { status: 200 })), 5000)), [], "/", 9000);
      expect("with nothing kept, the network is waited on", empty.kind === "answer" && empty.text === "late", JSON.stringify(empty));
    },
  },
  {
    id: "noticesaid",
    label: "A notice that comes while the app is open is said, and the bell is read again when the app comes back to the front (PORT-29); an iPhone browser tab is told once why it gets no alerts, an older iPhone to update, and the install sheet says alerts need it",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await pause(app.page, 1500);
        const reads = callsTo(app.stub, "GET", "/api/notifications/unread-count").length;
        app.stub.state.notifications.push({ id: "n-p367", subjectType: "supply_request", subjectId: "sr-9", title: "Invented supply request approved", body: "An invented notice.", link: null, createdAt: "2026-10-01T21:20:00.000Z", readAt: null });
        await app.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
        const toast = await toastSaying(app.page, say("You have a new notice. Tap the bell to read it.", language), 5000);
        expect("coming back to the front reads the bell again", callsTo(app.stub, "GET", "/api/notifications/unread-count").length > reads, "no read");
        expect("a new notice is said as a notice", !!toast && !toast.failure, JSON.stringify(await toastsNow(app.page)));
      } finally { await app.context.close(); }
      const ios = await open({ iosAlerts: "fresh" });
      try {
        const card = await shows(ios.page, "[data-alerts-ios]", 8000);
        const words = card ? await ios.page.evaluate(() => document.querySelector("[data-alerts-ios]").innerText) : "";
        expect("an iPhone browser tab is told why it gets no alerts", card && has(words, say("On an iPhone, alerts come only to the app on your Home Screen. Add it with Share, then Add to Home Screen, and open it from there to turn alerts on.", language)), words || (await bodyText(ios.page)).slice(0, 200));
        await clickText(ios.page, say("Got it", language));
        await reloadApp(ios);
        await pause(ios.page, 1500);
        expect("once, and not again after Got it", !(await ios.page.evaluate(() => !!document.querySelector("[data-alerts-ios]"))), "the card came back");
      } finally { await ios.context.close(); }
      const old = await open({ iosAlerts: "fresh", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.7 Mobile/15E148 Safari/604.1" });
      try {
        const card = await shows(old.page, "[data-alerts-ios]", 8000);
        const words = card ? await old.page.evaluate(() => document.querySelector("[data-alerts-ios]").innerText) : "";
        expect("an iPhone before iOS 16.4 is told to update", card && has(words, say("Alerts need iOS 16.4 or later. Update this iPhone in Settings, General, Software Update.", language)), words || "no card");
      } finally { await old.context.close(); }
      const sheet = await open({ installSheet: "fresh" });
      try {
        await pause(sheet.page, 1200);
        await letSheetOffer(sheet.page);
        const line = await shows(sheet.page, "[data-a2hs-alerts]", 6000);
        expect("the install sheet on an iPhone says alerts come only to the app added this way", line && has(await sheet.page.evaluate(() => document.querySelector("[data-a2hs-alerts]").innerText), say("Alerts on an iPhone come only to the app added this way.", language)), "no line");
      } finally { await sheet.context.close(); }
    },
  },
  {
    id: "trainingcold",
    label: "A training notice on a phone just opened (PORT-30): My training opens and reads its list, says Loading while it comes and This list did not load with Try again when it failed, and never reads as if nothing were required",
    run: async (open, language, expect) => {
      const app = await open({ path: "/?open=training_assigned:tr-1", stubOptions: { training: true, trainingPortal: true, refuse: { "GET /api/training/me": { status: 500, error: "Something went wrong on our end. Try again in a minute." } } } });
      try {
        await pause(app.page, 2500);
        const text = await bodyText(app.page);
        expect("My training opens from the notice and says its list did not load, with Try again", has(text, say("My training", language)) && has(text, say("This list did not load.", language)) && has(text, say("Try again", language)), text.slice(0, 260));
        expect("and never says nothing is required", !has(text, say("Nothing is required for your role yet.", language)), text.slice(0, 260));
        delete app.stub.state.refuse["GET /api/training/me"];
        await clickText(app.page, say("Try again", language));
        await pause(app.page, 1800);
        expect("Try again draws the list", await app.page.evaluate(() => !!document.querySelector('[data-training="1"], [data-training="portal"]')), (await bodyText(app.page)).slice(0, 200));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
    },
  },
  {
    id: "failurestays",
    label: "A failure's toast (PORT-33): it stays past three seconds, carries Close, and Close takes it down at once; a success still goes in three",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "issues", language);
        await clickText(app.page, say("Report an Issue", language));
        await clickText(app.page, say("Submit Issue", language));
        await pause(app.page, 300);
        const first = await errorToast(app.page);
        await pause(app.page, 4500);
        const later = await errorToast(app.page);
        const words = say("Enter issue title", language);
        expect("a failure's toast is still there after four seconds", later.some(x => x.text === words), JSON.stringify({ first, later }));
        expect("and carries Close", later.some(x => x.text === words && x.close), JSON.stringify(later));
        await tapLabel(app.page, say("Close", language)).catch(() => {});
        await app.page.evaluate(() => { const strip = Array.from(document.querySelectorAll("div")).find((x) => { const s = getComputedStyle(x); return s.position === "fixed" && s.top === "80px"; }); const b = strip && strip.querySelector("button[aria-label]"); if (b) b.click(); });
        await pause(app.page, 300);
        expect("Close takes it down at once", !(await errorToast(app.page)).some(x => x.text === words), JSON.stringify(await errorToast(app.page)));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "alertread",
    label: "A phone alert tapped marks its notice read (PORT-34): from an open app and from one the alert opens, the notice about that subject is marked read, and the bell's count is read again",
    run: async (open, language, expect) => {
      const notice = { id: "n-p367-read", subjectType: "supply_request", subjectId: "sr-7", title: "Invented supply request approved", body: "An invented notice.", link: null, createdAt: "2026-10-01T21:00:00.000Z", readAt: null };
      const other = Object.assign({}, notice, { id: "n-p367-other", subjectId: "sr-8", title: "Another invented supply notice" });
      const live = await open({ stubOptions: { notifications: [Object.assign({}, notice), Object.assign({}, other)] } });
      try {
        await pause(live.page, 1500);
        const counts = callsTo(live.stub, "GET", "/api/notifications/unread-count").length;
        await tapAlert(live, "supply_request", "sr-7");
        await pause(live.page, 2000);
        expect("a tapped alert on an open app marks its notice read", callsTo(live.stub, "POST", "/api/notifications/n-p367-read/read").length === 1, JSON.stringify(live.stub.state.calls.filter(c => /notifications/.test(c.path)).map(c => c.method + " " + c.path)));
        expect("and leaves the other notice unread", callsTo(live.stub, "POST", "/api/notifications/n-p367-other/read").length === 0 && !live.stub.state.notifications.find(n => n.id === "n-p367-other").readAt, "the other was marked");
        expect("and the bell's count is read again", callsTo(live.stub, "GET", "/api/notifications/unread-count").length > counts, "no read");
      } finally { await live.context.close(); }
      const fresh = await open({ path: "/?open=supply_request:sr-7", stubOptions: { notifications: [Object.assign({}, notice)] } });
      try {
        await pause(fresh.page, 2500);
        expect("an alert that opens the app marks its notice read", callsTo(fresh.stub, "POST", "/api/notifications/n-p367-read/read").length === 1, JSON.stringify(fresh.stub.state.calls.filter(c => /notifications/.test(c.path)).map(c => c.method + " " + c.path)));
      } finally { await fresh.context.close(); }
    },
  },
];
JOURNEYS.push(...PART367_JOURNEYS);

// Part 369, section 1: what ocsa-api's Round 5 (part 363) answers the
// staff app, read at its main (ca4aafa).
const authOf = (call) => (call && call.headers ? call.headers.authorization || "" : "");
const keptToken = (page) => page.evaluate(() => { try { const v = JSON.parse(window.localStorage.getItem("ocsa_auth") || "null"); return v ? v.token : null; } catch (e) { return null; } });
// The shift a shift notice names, three weeks ahead, and one the office
// cancelled, which my-schedule no longer lists. Invented.
const SHIFT_AHEAD = { id: "sh-ahead", scheduled_date: "2026-10-21", start_time: "06:00", end_time: "14:00", site_name: "West Building", status: "scheduled", building_name: "Annex", floor_number: "1" };
const AHEAD_SCHEDULE = () => ({ scheduled: [{ id: "sh-1", scheduled_date: "2026-10-02", start_time: "17:00", end_time: "23:00", site_name: "North Building", status: "scheduled", building_name: "Main Hall", floor_number: "2" }, Object.assign({}, SHIFT_AHEAD)], actual: [], pickups: [] });
const SITE_NOTICE = (type, id, title) => ({ id: "n-p369-" + type + "-" + id, subjectType: type, subjectKey: null, subjectId: id, title: title, body: "An invented notice.", link: "https://staff.example.invalid/?open=" + type + ":" + id, createdAt: "2026-10-01T21:10:00.000Z", readAt: null });
// The two refusals part 363 adds to a task's writes (helpers/taskPhoto.js),
// in the API's own words, with the keys and maxLength it sends.
const TASK_REFUSALS = {
  photoUrlInvalid: { status: 400, code: "tasks.photoUrlInvalid", en: "photoUrl must be the address the app's upload gave for this photo, at most 500 characters", es: "photoUrl debe ser la direcci\u00f3n que dio la carga de esta foto en la app, de 500 caracteres como m\u00e1ximo", extra: { keys: ["photoUrl"], maxLength: 500 } },
  noteInvalid: { status: 400, code: "tasks.noteInvalid", en: "resolutionNote must be text of at most 2000 characters", es: "resolutionNote debe ser un texto de 2000 caracteres como m\u00e1ximo", extra: { keys: ["resolutionNote"], maxLength: 2000 } },
};
const taskRefusal = (k, language) => ({ status: TASK_REFUSALS[k].status, body: Object.assign({ error: language === "es" ? TASK_REFUSALS[k].es : TASK_REFUSALS[k].en, code: TASK_REFUSALS[k].code }, TASK_REFUSALS[k].extra), once: true });

const PART369_S1_JOURNEYS = [
  {
    id: "renewopen",
    label: "Renewal when the app opens (API-56): a phone opened on a kept session asks POST /api/auth/renew with its token before anything else, keeps the new token for every call after it, signs in again when the API says the token ran out, and opens as before when renewal cannot be reached",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { renewTo: "token-two" } });
      try {
        await shows(app.page, ".sp-content", 8000);
        await pause(app.page, 1500);
        const calls = app.stub.state.calls;
        const renews = calls.filter(c => c.method === "POST" && c.path === "/api/auth/renew");
        const meAt = calls.findIndex(c => c.method === "GET" && c.path === "/api/auth/me");
        const renewAt = calls.findIndex(c => c.method === "POST" && c.path === "/api/auth/renew");
        expect("the app opens with one renewal, under the kept token, before the person is read", renews.length === 1 && authOf(renews[0]) === "Bearer token-one" && renewAt !== -1 && meAt > renewAt, renews.length + " renewals, at " + renewAt + ", me at " + meAt);
        const after = calls.slice(renewAt + 1).filter(c => c.path.indexOf("/api/") === 0 && authOf(c));
        expect("every call after it carries the new token", after.length > 3 && after.every(c => authOf(c) === "Bearer token-two"), JSON.stringify(after.filter(c => authOf(c) !== "Bearer token-two").map(c => c.method + " " + c.path + " " + authOf(c)).slice(0, 4)));
        expect("and the phone keeps the new token for its next opening", (await keptToken(app.page)) === "token-two", JSON.stringify(await keptToken(app.page)));
      } finally { await app.context.close(); }
      const ran = await open({ stubOptions: { refuse: { "POST /api/auth/renew": { status: 401, body: { error: "Token expired", code: "auth.tokenExpired" } } } } });
      try {
        const signIn = await shows(ran.page, 'input[autocomplete="username"]', 8000);
        expect("a renewal answered 401 auth.tokenExpired brings sign-in back, and the person is never read under the old token", signIn && callsTo(ran.stub, "GET", "/api/auth/me").length === 0, (await bodyText(ran.page)).slice(0, 160));
        await spokenHere(ran, language, expect);
      } finally { await ran.context.close(); }
      const down = await open({ stubOptions: { refuse: { "POST /api/auth/renew": { status: 503, body: { error: "The sign-in check is not available. Try again in a minute.", code: "auth.checkUnavailable" } } } } });
      try {
        const up = await shows(down.page, ".sp-content", 8000);
        expect("a renewal that cannot be reached opens the app as before, on the kept token", up && (await keptToken(down.page)) === "token-one" && authOf(lastSent(down.stub, "GET", "/api/auth/me")) === "Bearer token-one", (await bodyText(down.page)).slice(0, 160));
      } finally { await down.context.close(); }
    },
  },
  {
    id: "renewqueued",
    label: "Renewal before a queued send (API-56): a check-off kept on the phone with no signal goes once the signal comes back, after a renewal, under the new token, so a long shift never ends in a sign-out with work still waiting",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { renewTo: "token-one" } });
      try {
        await openTab(app.page, "tasks", language);
        await pause(app.page, 1500);
        const step = await openStep(app, language);
        if (!step) { expect("the list has a step still to do", false, "no open box"); return; }
        // The session was renewed at opening; it is made older than the
        // ten minutes between renewals, as on a long shift.
        await app.page.evaluate(() => { try { const v = JSON.parse(window.localStorage.getItem("ocsa_auth")); v.savedAt = Date.now() - 11 * 60 * 1000; window.localStorage.setItem("ocsa_auth", JSON.stringify(v)); } catch (e) {} });
        app.stub.state.renewTo = "token-three";
        await app.context.setOffline(true); app.stub.state.offline = true;
        await tapAria(app.page, step.label);
        await pause(app.page, 900);
        expect("a check-off with no signal is kept on the phone", (await pendingTaps(app.page)) === 1, (await pendingTaps(app.page)) + " on the phone");
        const mark = app.stub.state.calls.length;
        app.stub.state.offline = false; await app.context.setOffline(false);
        let left = 1;
        const until = Date.now() + 12000;
        while (Date.now() < until) { left = await pendingTaps(app.page); if (left === 0) break; await pause(app.page, 300); }
        const since = app.stub.state.calls.slice(mark);
        const renewAt = since.findIndex(c => c.method === "POST" && c.path === "/api/auth/renew");
        const sendAt = since.findIndex(c => c.method === "POST" && c.path.indexOf("/api/clock/tasks/" + step.id) === 0);
        expect("the kept check-off goes once the signal is back, and leaves the phone", left === 0 && sendAt !== -1, left + " on the phone, sent at " + sendAt);
        expect("a renewal goes first, and the check-off goes under the new token", renewAt !== -1 && renewAt < sendAt && authOf(since[sendAt]) === "Bearer token-three", "renewal at " + renewAt + ", send at " + sendAt + " under " + authOf(since[sendAt]));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "shiftat",
    label: "A shift changed or cancelled (API-62): shift_changed opens My Schedule at that shift's week with its sheet open, three weeks ahead, and shift_cancelled says the shift is no longer on the schedule, from the bell, from a phone alert on an open app and from one that opens the app",
    run: async (open, language, expect) => {
      const changed = SITE_NOTICE("shift_changed", "sh-ahead", "Invented: your shift at West Building changed");
      await threeWays(open, { schedule: AHEAD_SCHEDULE(), notifications: [changed] }, "shift_changed", "sh-ahead", changed.title, async (app, how) => {
        const up = await shows(app.page, '[data-shift-detail="sh-ahead"]', 7000);
        const text = up ? await app.page.evaluate(() => document.querySelector('[data-shift-detail="sh-ahead"]').innerText.replace(/\s+/g, " ")) : "";
        expect("a shift_changed notice " + how + " opens My Schedule with that shift's sheet", up && has(text, say("Scheduled Shift", language)) && has(text, "West Building") && (await chosenTab(app.page)) === say("Schedule", language), text.slice(0, 200) || (await bodyText(app.page)).slice(0, 200));
        if (how !== "from the bell") return;
        await app.page.evaluate(() => { const d = document.querySelector('[data-shift-detail="sh-ahead"]'); if (d && d.parentElement) d.parentElement.click(); });
        await pause(app.page, 600);
        const week = await bodyText(app.page);
        const label = await app.page.evaluate((l) => new Date(2026, 9, 19).toLocaleDateString(l, { month: "short", day: "numeric" }) + " - " + new Date(2026, 9, 25).toLocaleDateString(l, { month: "short", day: "numeric", year: "numeric" }), language === "es" ? "es-US" : "en-US");
        expect("and the week drawn is the shift's own, Monday October 19 to Sunday October 25", has(week, label), label + " | " + week.slice(0, 300));
        await spokenHere(app, language, expect);
      });
      const cancelled = SITE_NOTICE("shift_cancelled", "sh-gone", "Invented: your shift at West Building was cancelled");
      await threeWays(open, { schedule: AHEAD_SCHEDULE(), notifications: [cancelled] }, "shift_cancelled", "sh-gone", cancelled.title, async (app, how) => {
        const line = await shows(app.page, '[data-shift-gone="1"]', 7000);
        const text = line ? await app.page.evaluate(() => document.querySelector('[data-shift-gone="1"]').innerText) : "";
        expect("a shift_cancelled notice " + how + " opens My Schedule saying the shift is no longer on it", line && has(text, say("This shift is no longer on your schedule.", language)) && !(await app.page.evaluate(() => !!document.querySelector("[data-shift-detail]"))), text || (await bodyText(app.page)).slice(0, 200));
        if (how === "from the bell") await spokenHere(app, language, expect);
      });
    },
  },
  {
    id: "casedone",
    label: "A reporter's case resolved or closed (API-63): hr_case_closed_for opens My reports with that report marked, from the bell, from a phone alert on an open app and from one that opens the app, and never reads the office's case",
    run: async (open, language, expect) => {
      const notice = SITE_NOTICE("hr_case_closed_for", "hr-mine-1", "Invented: your report was closed");
      await threeWays(open, { notifications: [notice] }, "hr_case_closed_for", "hr-mine-1", notice.title, async (o, how) => {
        const marked = await shows(o.page, '[data-my-report="hr-mine-1"][data-my-report-focus="1"]');
        expect("an hr_case_closed_for notice " + how + " opens My reports with that report marked", marked, (await bodyText(o.page)).slice(0, 200));
        expect("the notice " + how + " never reads the office's case", callsTo(o.stub, "GET", "/api/hr-cases/hr-mine-1").length === 0, callsTo(o.stub, "GET", "/api/hr-cases/hr-mine-1").length + " reads");
      });
    },
  },
  {
    id: "filedlink",
    label: "A filed report's notice with its staff app link (API-83): since part 363 a reader who is not an admin is linked to the staff app's /?open=form:<id>; the report opens read only with Close alone, never a dashboard button that leads back to this app, and a person who reads no report is offered nothing that leaves the app",
    run: async (open, language, expect) => {
      const notice = Object.assign({}, noticeOf("form"), { id: "n-p369-form", link: "https://staff.example.invalid/?open=form:fr-1", title: "Invented: a spill report was filed at North Building" });
      await threeWays(open, { person: R4_SUPERVISOR, notifications: [notice] }, "form", "fr-1", notice.title, async (app, how) => {
        const up = await shows(app.page, '[data-report-sheet="fr-1"] [data-report-read="1"]');
        const buttons = up ? await app.page.evaluate(() => Array.from(document.querySelectorAll('[data-report-sheet="fr-1"] button')).map(b => b.innerText.trim())) : [];
        expect("the report opens " + how + ", read only, with Close and no Open in the dashboard", up && buttons.join("|") === say("Close", language), JSON.stringify(buttons));
      });
      const cleaner = await open({ stubOptions: { notifications: [notice] } });
      try {
        await tapOnBell(cleaner, notice.title);
        await pause(cleaner.page, 1500);
        const offered = await cleaner.page.evaluate(([t, w]) => { const b = Array.from(document.querySelectorAll("button")).find(y => y.innerText.indexOf(t) !== -1); const row = b && b.parentElement; return !!row && Array.from(row.querySelectorAll("button")).some(y => y.innerText.trim() === w); }, [notice.title, say("Open in the dashboard", language)]);
        expect("a person who reads no report is offered no dashboard for a staff app link, and the report is never read", !offered && !(await cleaner.page.evaluate(() => !!document.querySelector("[data-report-sheet]"))) && callsTo(cleaner.stub, "GET", "/api/forms/responses/fr-1").length === 0, "offered " + offered);
      } finally { await cleaner.context.close(); }
    },
  },
  {
    id: "tasknotes",
    label: "A task's photo and note on a write (API-68): the resolution boxes hold 2000 characters at most, and a resolve the API refuses for its photo address or its note says so in plain words, never the API's field names",
    run: async (open, language, expect) => {
      for (const k of ["noteInvalid", "photoUrlInvalid"]) {
        const app = await open({});
        try {
          await openTab(app.page, "issuetasks", language);
          await pause(app.page, 900);
          await openItem(app.page, "Replace the cracked light cover");
          await pause(app.page, 700);
          await clickText(app.page, say("Resolved", language));
          const cap = await app.page.evaluate(() => { const b = document.querySelector(".sp-content textarea"); return b ? b.maxLength : null; });
          if (k === "noteInvalid") expect("the resolution box holds 2000 characters at most", cap === 2000, JSON.stringify(cap));
          await typeNth(app.page, ".sp-content textarea", 0, "Put a new cover on");
          await attachPhoto(app.page, '.sp-content input[type="file"]');
          await pause(app.page, 700);
          app.stub.state.refuse["PATCH /api/clock/tasks/resolve/at-1"] = taskRefusal(k, language);
          await clickText(app.page, say("Submit Resolution", language));
          const words = k === "noteInvalid" ? say("The note is too long. Keep it to {max} characters.", language).replace("{max}", "2000") : say("This photo could not be sent with the task. Take the photo again, then send it.", language);
          const toast = await toastSaying(app.page, words, 6000);
          expect(TASK_REFUSALS[k].code + " says what to do in plain words", !!toast, JSON.stringify(await toastsNow(app.page)));
          expect(TASK_REFUSALS[k].code + " never shows the API's field names", !has(await bodyText(app.page), "resolutionNote") && !has(await bodyText(app.page), "photoUrl"), (await bodyText(app.page)).slice(0, 200));
        } finally { await app.context.close(); }
      }
    },
  },
  {
    id: "daystart",
    label: "The checklist day's start from GET /api/settings (PORT-24, part 363): with the company's day starting at 6:00 AM, the evening's critical block, unfinished, still reads Overdue at 5:00 AM, where the 4:00 AM kept in clientConfig would have begun a new day",
    run: async (open, language, expect) => {
      const at = "2026-10-02T09:00:00Z";
      const app = await open({ now: at, stubOptions: { site: "site-east", shiftLabel: "Second shift", now: at, dayStartsAt: "06:00" } });
      try {
        await openTab(app.page, "tasks", language);
        await app.page.waitForFunction(() => document.querySelectorAll("[data-block]").length > 3, null, { timeout: 8000 }).catch(() => {});
        await pause(app.page, 900);
        const when = await app.page.evaluate(() => { const b = document.querySelector('[data-block="Dining room reset"]'); return b ? b.getAttribute("data-block-when") : null; });
        expect("the settings are read once the person is in", callsTo(app.stub, "GET", "/api/settings").length >= 1, callsTo(app.stub, "GET", "/api/settings").length + " reads");
        expect("the Second shift's Dining room reset, unfinished, reads Overdue at 5:00 AM on a 6:00 AM day", when === "overdue", JSON.stringify(when));
      } finally { await app.context.close(); }
    },
  },
];
JOURNEYS.push(...PART369_S1_JOURNEYS);

// Part 369, section 2: building maintenance, against ocsa-api's main
// (part 365, routes/maintenance.js), for a supervisor, who holds
// file_maintenance_requests by default.
const MAINT_SUP = Object.assign({}, PERSON, { id: "u-maint-sup", role: "supervisor" });
const maintIn = (language, list, key) => { const hit = MAINT_NAMES[list].find(x => x[0] === key); return hit ? (language === "es" ? hit[2] : hit[1]) : key; };
const maintPosts = (stub) => stub.state.calls.filter(c => c.method === "POST" && c.path === "/api/maintenance-requests");
// The field kit's Building maintenance at a site, from More.
const openMaintTile = async (app, language, siteName) => {
  if (!(await openTab(app.page, "fieldkit", language))) return false;
  await shows(app.page, "#ocsa-fk-site", 8000);
  if (siteName) await app.page.evaluate((n) => { const sel = document.querySelector("#ocsa-fk-site"); const o = sel && Array.from(sel.options).find(x => x.textContent === n); if (!o) return; const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set; set.call(sel, o.value); sel.dispatchEvent(new Event("change", { bubbles: true })); }, siteName);
  await pause(app.page, 500);
  if (!(await clickText(app.page, say("Building maintenance", language)))) return false;
  return shows(app.page, "[data-fk-maintenance]", 6000);
};
const pickIn = (page, sel, value) => page.evaluate(([q, v]) => { const el = document.querySelector(q); if (!el) return false; const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set; set.call(el, v); el.dispatchEvent(new Event("change", { bubbles: true })); return true; }, [sel, value]);
// What a new request is filled with, every word invented.
const fillMaint = async (app, words) => {
  if (words.building !== undefined) await type(app.page, "#ocsa-maint-building", words.building);
  if (words.floor !== undefined) await type(app.page, "#ocsa-maint-floor", words.floor);
  if (words.area !== undefined) await type(app.page, "#ocsa-maint-area", words.area);
  await pickIn(app.page, "#ocsa-maint-category", words.category);
  await app.page.evaluate((u) => { const b = document.querySelector('[data-maint-urgency="' + u + '"]'); if (b) b.click(); }, words.urgency);
  if (words.description !== undefined) await type(app.page, "#ocsa-maint-what", words.description);
};
const MAINT_WORDS = { building: "Annex", floor: "1", area: "Back hallway", category: "plumbing", urgency: "soon", description: "Invented: water under the hallway sink." };

const PART369_S2_JOURNEYS = [
  {
    id: "maintfile",
    label: "A maintenance request from the field kit (part 365): building, floor and area, the kind of problem, how soon, what is wrong and two camera photos, with who it goes to shown before Send; sent with no signal it waits on the phone and goes once, with its photos, when the signal comes back; a site with no contact cannot send",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { person: MAINT_SUP, fieldKit: true } });
      try {
        const tile = await openMaintTile(app, language, "North Building");
        expect("a supervisor's field kit has Building maintenance, listing the site's requests", tile && (await shows(app.page, '[data-maint-row="mr-1"]')) && (await shows(app.page, '[data-maint-row="mr-2"]')), (await bodyText(app.page)).slice(0, 240));
        if (!tile) return;
        const row = await app.page.evaluate(() => { const r = document.querySelector('[data-maint-row="mr-1"]'); return r ? { text: r.innerText.replace(/\s+/g, " "), age: (r.querySelector("[data-maint-age]") || {}).getAttribute ? r.querySelector("[data-maint-age]").getAttribute("data-maint-age") : null, late: !!r.querySelector("[data-maint-noanswer]") } : null; });
        expect("each request shows its status and its age, and one the building has not answered says so", !!row && has(row.text, maintIn(language, "statuses", "sent")) && row.age === "3" && has(row.text, say("Sent {n} days ago", language).replace("{n}", "3")) && row.late && has(row.text, say("No answer yet", language)), JSON.stringify(row));
        await clickText(app.page, say("New request", language));
        await shows(app.page, "#ocsa-maint-what");
        await fillMaint(app, MAINT_WORDS);
        await attachDrawn(app.page, "[data-maint-photo-input]", "one.jpg", 1600, 1200);
        await pause(app.page, 900);
        await attachDrawn(app.page, "[data-maint-photo-input]", "two.jpg", 1600, 1200);
        await pause(app.page, 900);
        const goes = await app.page.evaluate(() => Array.from(document.querySelectorAll("[data-maint-recipient]")).map(x => x.getAttribute("data-maint-recipient")));
        expect("who it goes to shows before Send: the Annex's engineer and the desk for every building", goes.join() === "desk@example.invalid,annex@example.invalid", JSON.stringify(goes));
        expect("the two photos are on the form", (await app.page.evaluate(() => document.querySelectorAll("[data-maint-taken]").length)) === 2, "photos");
        await spokenHere(app, language, expect);
        await app.context.setOffline(true); app.stub.state.offline = true;
        await clickText(app.page, say("Send", language));
        const saved = await toastSaying(app.page, say("Saved on this phone. It sends when you have signal.", language), 8000);
        await pause(app.page, 600);
        expect("sent with no signal, the request waits on the phone, said so, and the form closes", !!saved && !(await app.page.evaluate(() => !!document.querySelector("#ocsa-maint-what"))) && (await shows(app.page, "[data-maint-kept]")), JSON.stringify(await toastsNow(app.page)));
        expect("nothing is filed while there is no signal", app.stub.state.maint.requests.length === 2, app.stub.state.maint.requests.length + " requests");
        app.stub.state.offline = false; await app.context.setOffline(false);
        const sentWords = say("Sent to the building as {reference}.", language).replace("{reference}", "MR-2026-0003");
        const sent = await toastSaying(app.page, sentWords, 12000);
        await pause(app.page, 900);
        const filed = app.stub.state.maint.requests.filter(r => r.id !== "mr-1" && r.id !== "mr-2");
        const post = maintPosts(app.stub).filter(c => c.files && c.files.length).pop();
        expect("with the signal back it is filed once, and said so", !!sent && filed.length === 1, filed.length + " filed; " + JSON.stringify(await toastsNow(app.page)));
        expect("as one multipart filing carrying both photos, as JPEGs, and every field", !!post && post.files.length === 2 && post.files.every(f => f.kind && f.kind.ext === "jpg") && post.fields.siteId === "site-north" && post.fields.building === "Annex" && post.fields.floor === "1" && post.fields.area === "Back hallway" && post.fields.category === "plumbing" && post.fields.urgency === "soon" && post.fields.description === MAINT_WORDS.description, post ? JSON.stringify(post.fields) + " " + post.files.length : "no multipart post");
        expect("it leaves the phone and the site's list shows it", !(await app.page.evaluate(() => !!document.querySelector("[data-maint-kept]"))) && (await shows(app.page, '[data-maint-row="mr-3"]')), (await bodyText(app.page)).slice(0, 200));
      } finally { await app.context.close(); }
      // An answer lost on its way back: the request was filed and the
      // phone never heard; it reads the site's requests before trying
      // again, finds it, and sends nothing more.
      const lost = await open({ stubOptions: { person: MAINT_SUP, fieldKit: true, maintLoseNext: 1 } });
      try {
        if (!(await openMaintTile(lost, language, "North Building"))) { expect("the tile opens", false, "no tile"); return; }
        await clickText(lost.page, say("New request", language));
        await shows(lost.page, "#ocsa-maint-what");
        await fillMaint(lost, Object.assign({}, MAINT_WORDS, { building: "", floor: "", area: "Lobby" }));
        await clickText(lost.page, say("Send", language));
        await toastSaying(lost.page, say("Saved on this phone. It sends when you have signal.", language), 8000);
        await lost.page.evaluate(() => window.dispatchEvent(new Event("online")));
        const sent = await toastSaying(lost.page, say("Sent to the building as {reference}.", language).replace("{reference}", "MR-2026-0003"), 12000);
        await pause(lost.page, 900);
        const filed = lost.stub.state.maint.requests.filter(r => r.id !== "mr-1" && r.id !== "mr-2");
        expect("a send whose answer was lost is found on the site's list, and filed once in all", !!sent && filed.length === 1 && maintPosts(lost.stub).length === 1, filed.length + " filed, " + maintPosts(lost.stub).length + " posts");
      } finally { await lost.context.close(); }
      // South Building has no maintenance contact.
      const none = await open({ stubOptions: { person: MAINT_SUP, fieldKit: true } });
      try {
        if (!(await openMaintTile(none, language, "South Building"))) { expect("the tile opens at South Building", false, "no tile"); return; }
        await clickText(none.page, say("New request", language));
        await shows(none.page, "#ocsa-maint-what");
        await fillMaint(none, MAINT_WORDS);
        await pause(none.page, 600);
        const text = await none.page.evaluate(() => document.querySelector("[data-maint-goes-to]").innerText);
        const off = await none.page.evaluate(() => { const b = document.querySelector("[data-maint-send]"); return !!b && b.disabled; });
        expect("a site with no contact says so, and Send stays off", has(text, say("This site has no maintenance contact yet. Ask the office to add one before sending.", language)) && off, text);
      } finally { await none.context.close(); }
    },
  },
  {
    id: "maintissue",
    label: "From an issue (part 365): the issue's sheet offers Send to building maintenance, the form opens with the issue's area and words and its photos to send, the request carries the issue, and the sheet then shows it sent and offers it no more",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { person: MAINT_SUP, issueSheet: true } });
      try {
        app.stub.state.sheetIssues.find(i => i.id === "iss-b2").photos = [{ id: "ip-7", url: "https://photos.example.invalid/handrail.jpg" }];
        await openTab(app.page, "issues", language);
        await pause(app.page, 1200);
        await app.page.evaluate(() => { const b = document.querySelector('[data-issue-row="iss-b2"]'); if (b) b.click(); });
        const up = await shows(app.page, '[data-issue-sheet="iss-b2"] [data-issue-action="maintenance"]', 8000);
        expect("the issue's sheet offers Send to building maintenance", up && has(await app.page.evaluate(() => document.querySelector('[data-issue-action="maintenance"]').innerText), say("Send to building maintenance", language)), (await bodyText(app.page)).slice(0, 200));
        if (!up) return;
        await app.page.evaluate(() => document.querySelector('[data-issue-action="maintenance"]').click());
        await shows(app.page, "#ocsa-maint-what");
        await pause(app.page, 800);
        const pre = await app.page.evaluate(() => ({ area: document.querySelector("#ocsa-maint-area").value, what: document.querySelector("#ocsa-maint-what").value, photos: document.querySelectorAll("[data-maint-issue-photo]").length }));
        expect("the form is prefilled with the issue's area, its title and words, and offers its photo", pre.area === "Stairwell" && pre.what === "Invented loose handrail on the stairs\n\nThe handrail on the east stairs moves, invented." && pre.photos === 1, JSON.stringify(pre));
        await fillMaint(app, { category: "safety", urgency: "urgent_safety" });
        await app.page.evaluate(() => document.querySelector('[data-maint-issue-photo="ip-7"]').click());
        await clickText(app.page, say("Send", language));
        const sent = await toastSaying(app.page, say("Sent to the building as {reference}.", language).replace("{reference}", "MR-2026-0003"), 8000);
        const post = maintPosts(app.stub).pop();
        expect("the request goes once, carrying the issue and its photo", !!sent && maintPosts(app.stub).length === 1 && post.body && post.body.issueId === "iss-b2" && Array.isArray(post.body.issuePhotoIds) && post.body.issuePhotoIds.join() === "ip-7" && post.body.siteId === "site-north", post ? JSON.stringify(post.body) : "nothing");
        const shown = await shows(app.page, '[data-issue-sheet="iss-b2"] [data-issue-maint-request="mr-3"]', 6000);
        expect("the issue's sheet then shows it sent, and offers it no more", shown && !(await app.page.evaluate(() => !!document.querySelector('[data-issue-action="maintenance"]'))) && has(await app.page.evaluate(() => document.querySelector('[data-issue-maint-request="mr-3"]').innerText), say("Sent to the building as {reference}.", language).replace("{reference}", "MR-2026-0003")), (await bodyText(app.page)).slice(0, 300));
        await app.page.evaluate(() => document.querySelector('[data-issue-maint-request="mr-3"]').click());
        expect("and opens that request's sheet", await shows(app.page, '[data-maint-sheet="mr-3"] [data-maint-read="1"]'), (await bodyText(app.page)).slice(0, 200));
      } finally { await app.context.close(); }
      const cleaner = await open({ path: "/?open=issue:iss-a1", stubOptions: { issueSheet: true } });
      try {
        const sheet = await shows(cleaner.page, '[data-issue-sheet="iss-a1"]', 8000);
        await pause(cleaner.page, 1200);
        expect("someone without file_maintenance_requests is offered no Send to building maintenance on an issue's sheet", sheet && !(await cleaner.page.evaluate(() => !!document.querySelector('[data-issue-action="maintenance"]'))), "sheet " + sheet);
      } finally { await cleaner.context.close(); }
    },
  },
  {
    id: "maintsheet",
    label: "One request's sheet (part 365): its status, what is wrong, when and to whom it was emailed, its photos and its log; Record a response by phone with what they said, and Change the status to Fixed, each through POST /:id/log, the sheet drawn again from the answer",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { person: MAINT_SUP, fieldKit: true } });
      try {
        if (!(await openMaintTile(app, language, "North Building"))) { expect("the tile opens", false, "no tile"); return; }
        await app.page.evaluate(() => document.querySelector('[data-maint-row="mr-2"]').click());
        const up = await shows(app.page, '[data-maint-sheet="mr-2"] [data-maint-read="1"]');
        const text = up ? await app.page.evaluate(() => document.querySelector('[data-maint-sheet="mr-2"]').innerText.replace(/\s+/g, " ")) : "";
        expect("the sheet shows the request: its status, kind, where, what is wrong, who it went to, a photo and its log", up && has(text, "MR-2026-0002") && has(text, maintIn(language, "statuses", "scheduled")) && has(text, maintIn(language, "categories", "lighting")) && has(text, "Invented: two lights out by the back door.") && has(text, "annex@example.invalid") && (await app.page.evaluate(() => document.querySelectorAll("[data-maint-photo]").length)) === 1 && (await app.page.evaluate(() => document.querySelectorAll("[data-maint-log]").length)) === 3, text.slice(0, 400));
        if (!up) return;
        await spokenHere(app, language, expect);
        await app.page.evaluate(() => document.querySelector('[data-maint-action="response"]').click());
        await shows(app.page, "#ocsa-maint-channel");
        await pickIn(app.page, "#ocsa-maint-channel", "phone");
        await type(app.page, "#ocsa-maint-body", "Invented: the engineer is on the way.");
        await app.page.evaluate(() => document.querySelector("[data-maint-save]").click());
        await toastSaying(app.page, say("Saved.", language), 6000);
        const resp = sent(app.stub, "POST", "/api/maintenance-requests/mr-2/log").pop();
        expect("Record a response sends kind response, the channel and the words", !!resp && resp.body.kind === "response" && resp.body.channel === "phone" && resp.body.body === "Invented: the engineer is on the way.", resp ? JSON.stringify(resp.body) : "nothing");
        expect("and the sheet shows it in the log", (await app.page.evaluate(() => document.querySelectorAll('[data-maint-sheet="mr-2"] [data-maint-log]').length)) === 4, "log");
        await app.page.evaluate(() => document.querySelector('[data-maint-action="status"]').click());
        await shows(app.page, "#ocsa-maint-to");
        await pickIn(app.page, "#ocsa-maint-to", "fixed");
        await app.page.evaluate(() => document.querySelector("[data-maint-save]").click());
        await app.page.waitForFunction(() => { const c = document.querySelector('[data-maint-sheet="mr-2"] [data-maint-status]'); return !!c && c.getAttribute("data-maint-status") === "fixed"; }, null, { timeout: 6000 }).catch(() => {});
        const moved = sent(app.stub, "POST", "/api/maintenance-requests/mr-2/log").pop();
        const chip = await app.page.evaluate(() => { const c = document.querySelector('[data-maint-sheet="mr-2"] [data-maint-status]'); return c ? c.getAttribute("data-maint-status") + "|" + c.innerText : ""; });
        expect("Change the status to Fixed sends kind status, and the sheet reads Fixed", !!moved && moved.body.kind === "status" && moved.body.status === "fixed" && chip === "fixed|" + maintIn(language, "statuses", "fixed").toUpperCase(), chip + " " + (moved ? JSON.stringify(moved.body) : ""));
      } finally { await app.context.close(); }
      const late = await open({ stubOptions: { person: MAINT_SUP, fieldKit: true, maintEmailFails: true } });
      try {
        if (!(await openMaintTile(late, language, "North Building"))) return;
        await late.page.evaluate(() => document.querySelector('[data-maint-row="mr-1"]').click());
        await shows(late.page, '[data-maint-sheet="mr-1"] [data-maint-read="1"]');
        const text = await late.page.evaluate(() => document.querySelector('[data-maint-sheet="mr-1"]').innerText.replace(/\s+/g, " "));
        const due = await late.page.evaluate((l) => new Date(2026, 8, 30).toLocaleDateString(l, { month: "short", day: "numeric" }), language === "es" ? "es-US" : "en-US");
        expect("a request past its two business days says the building has not answered, and by when it was asked to", has(text, say("No answer from the building yet. It was asked to answer by {date}.", language).replace("{date}", due)), text.slice(0, 300));
        expect("and offers a follow-up", await late.page.evaluate(() => !!document.querySelector('[data-maint-action="follow-up"]')), "no follow-up");
      } finally { await late.context.close(); }
    },
  },
  {
    id: "maintnotices",
    label: "Notices about a request (part 365): maintenance_status and maintenance_no_response open the request's sheet from the bell, from a phone alert on an open app and from one that opens the app; someone without file_maintenance_requests stays on the bell and the request is never read",
    run: async (open, language, expect) => {
      for (const [type, id] of [["maintenance_status", "mr-2"], ["maintenance_no_response", "mr-1"]]) {
        const notice = Object.assign({}, noticeOf(type), { title: "Invented notice about " + type });
        await threeWays(open, { person: MAINT_SUP, notifications: [notice] }, type, id, notice.title, async (app, how) => {
          const up = await shows(app.page, '[data-maint-sheet="' + id + '"] [data-maint-read="1"]', 7000);
          expect("a " + type + " notice " + how + " opens the request's sheet", up, (await bodyText(app.page)).slice(0, 200));
        });
        const cleaner = await open({ stubOptions: { notifications: [notice] } });
        try {
          await tapOnBell(cleaner, notice.title);
          await pause(cleaner.page, 1500);
          expect("a " + type + " notice to someone who files no requests opens no sheet and reads nothing", !(await cleaner.page.evaluate(() => !!document.querySelector("[data-maint-sheet]"))) && callsTo(cleaner.stub, "GET", "/api/maintenance-requests/" + id).length === 0, callsTo(cleaner.stub, "GET", "/api/maintenance-requests/" + id).length + " reads");
        } finally { await cleaner.context.close(); }
      }
    },
  },
];
JOURNEYS.push(...PART369_S2_JOURNEYS);

// Part 369, section 3: leave balances, against ocsa-api's main (part 365,
// GET /api/leave/me and the leave every time off answer carries).
const twinOf = (language, en) => (language === "es" && TWIN_ES.has(en) ? TWIN_ES.get(en) : en);
const SICK = "Paid sick leave";
const SICK_LINE = "40 hours on January 1 each year; a new hire gets 40 hours on the hire date; usable 90 days after the hire date; nothing carries over to the next year.";
const hoursIn = (language, n) => say(n === 1 ? "{n} hour" : "{n} hours", language).replace("{n}", String(n));
const offSheet = (page) => page.evaluate(() => { const d = Array.from(document.querySelectorAll('div[style*="z-index: 200"]')).pop(); return d ? d.innerText.replace(/\s+/g, " ") : ""; });
const askOff = async (app, language, kind, from, to) => {
  await clickText(app.page, say("Request time off", language));
  await pause(app.page, 400);
  await type(app.page, 'div[style*="z-index: 200"] select', kind);
  await typeNth(app.page, 'div[style*="z-index: 200"] input[type="date"]', 0, from);
  await typeNth(app.page, 'div[style*="z-index: 200"] input[type="date"]', 1, to);
  await pause(app.page, 400);
};

const PART369_S3_JOURNEYS = [
  {
    id: "leaveshown",
    label: "My leave balances (part 365): under My time off, each kind the person's policy tracks, in hours and in days, with the policy's own line; nothing for a person whose policy tracks none, nothing when the route is not there, and a balance that did not load says so with Try again",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "schedule", language);
        const up = await shows(app.page, '[data-leave-balance="paid_sick"]', 8000);
        const text = up ? await app.page.evaluate(() => document.querySelector('[data-leave-balance="paid_sick"]').innerText.replace(/\s+/g, " ")) : "";
        expect("My time off shows paid sick leave's balance in hours and in days", up && has(text, twinOf(language, SICK)) && has(text, hoursIn(language, 40)) && has(text, say("{n} days", language).replace("{n}", "5")), text || (await bodyText(app.page)).slice(-300));
        expect("with the policy's own line for it", has(text, twinOf(language, SICK_LINE)), text);
        expect("read once, from GET /api/leave/me", callsTo(app.stub, "GET", "/api/leave/me").length === 1, callsTo(app.stub, "GET", "/api/leave/me").length + " reads");
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
      for (const [how, opts] of [["a person whose policy tracks no kind", { leaveNone: true }], ["an API with no leave route", { leaveRoute: false }]]) {
        const none = await open({ stubOptions: opts });
        try {
          await openTab(none.page, "schedule", language);
          await shows(none.page, '[data-timeoff-fault], button', 4000);
          await pause(none.page, 1500);
          expect(how + " sees no balance and nothing about one", !(await none.page.evaluate(() => !!document.querySelector("[data-leave-balances], [data-leave-fault]"))) && !has(await bodyText(none.page), say("Leave balances", language)), (await bodyText(none.page)).slice(-200));
        } finally { await none.context.close(); }
      }
      const failed = await open({ stubOptions: { refuse: { "GET /api/leave/me": { status: 500, body: { error: "Something went wrong" }, once: true } } } });
      try {
        await openTab(failed.page, "schedule", language);
        const fault = await shows(failed.page, "[data-leave-fault]", 6000);
        expect("a balance read that failed says so", fault && has(await failed.page.evaluate(() => document.querySelector("[data-leave-fault]").innerText), say("Your leave balances did not load.", language)), (await bodyText(failed.page)).slice(-200));
        await failed.page.evaluate((w) => { const b = Array.from(document.querySelectorAll("[data-leave-fault] button")).find(x => x.innerText.trim() === w); if (b) b.click(); }, say("Try again", language));
        expect("and Try again shows the balance", await shows(failed.page, '[data-leave-balance="paid_sick"]', 6000), (await bodyText(failed.page)).slice(-200));
      } finally { await failed.context.close(); }
    },
  },
  {
    id: "leaveform",
    label: "Request time off with a balance (part 365): the form shows the picked kind's balance before sending; once sent, the request's sheet says what it would leave, with the API's warning when it goes below zero or falls in the waiting period, and the request is sent all the same",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { leaveBalance: 32 } });
      try {
        await openTab(app.page, "schedule", language);
        await shows(app.page, '[data-leave-balance="paid_sick"]', 8000);
        await askOff(app, language, "paid_sick", "2026-10-05", "2026-10-09");
        const before = await app.page.evaluate(() => { const d = document.querySelector("[data-leave-picked]"); return d ? d.innerText.replace(/\s+/g, " ") : ""; });
        expect("before sending, the form shows the picked kind's balance", has(before, say("{kind} balance now: {hours}.", language).replace("{kind}", twinOf(language, SICK)).replace("{hours}", hoursIn(language, 32))), before);
        await type(app.page, 'div[style*="z-index: 200"] select', "unpaid");
        await pause(app.page, 300);
        expect("a kind the policy keeps no balance for shows none", !(await app.page.evaluate(() => !!document.querySelector("[data-leave-picked]"))), "a balance shows");
        await type(app.page, 'div[style*="z-index: 200"] select', "paid_sick");
        await clickText(app.page, say("Send request", language));
        const state = await shows(app.page, '[data-leave-state="pending"]', 6000);
        const after = state ? await app.page.evaluate(() => document.querySelector('[data-leave-state="pending"]').innerText.replace(/\s+/g, " ")) : "";
        const below = language === "es" ? "Esto dejar\u00eda el saldo de " + twinOf(language, SICK) + " por debajo de cero: quedar\u00edan -8 horas." : "This would take the " + SICK + " balance below zero: -8 hours left after it.";
        expect("once sent, the request's sheet says what it would leave", state && has(after, say("{kind}: this request is {hours}, and would leave {left}.", language).replace("{kind}", twinOf(language, SICK)).replace("{hours}", hoursIn(language, 40)).replace("{left}", hoursIn(language, -8))), after || (await offSheet(app.page)).slice(0, 300));
        expect("with the API's warning that it goes below zero, and that the request is sent", has(after, below) && has(after, say("Your request is sent. The person who approves time off decides.", language)), after);
        expect("the request was sent once", sent(app.stub, "POST", "/api/time-off").filter(c => c.path === "/api/time-off").length === 1, "posts");
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
      const waiting = await open({ stubOptions: { leaveUsableFrom: "2026-11-15" } });
      try {
        await openTab(waiting.page, "schedule", language);
        await shows(waiting.page, '[data-leave-balance="paid_sick"]', 8000);
        const usable = await waiting.page.evaluate(() => document.querySelector('[data-leave-balance="paid_sick"]').innerText.replace(/\s+/g, " "));
        const day = await waiting.page.evaluate((l) => new Date(2026, 10, 15).toLocaleDateString(l, { month: "short", day: "numeric", year: "numeric" }), language === "es" ? "es-US" : "en-US");
        expect("a new hire's balance says from when it can be used", has(usable, say("You can use it from {date}.", language).replace("{date}", day)), usable);
        await askOff(waiting, language, "paid_sick", "2026-10-12", "2026-10-12");
        await clickText(waiting.page, say("Send request", language));
        await shows(waiting.page, '[data-leave-state="pending"] [data-leave-warning]', 6000);
        const text = await waiting.page.evaluate(() => { const d = document.querySelector('[data-leave-state="pending"]'); return d ? d.innerText.replace(/\s+/g, " ") : ""; });
        const words = language === "es" ? "Esto cae en el per\u00edodo de espera: " + twinOf(language, SICK) + " se puede usar a partir del 15 de noviembre de 2026." : "This falls in the waiting period: " + SICK + " can be used from Nov 15, 2026.";
        expect("a request in the waiting period carries the API's warning, and is sent", has(text, words) && sent(waiting.stub, "POST", "/api/time-off").filter(c => c.path === "/api/time-off").length === 1, text);
      } finally { await waiting.context.close(); }
    },
  },
  {
    id: "leavesheet",
    label: "A request's hours (part 365): an approved request's sheet says the hours it took, one whose approval the office took back says the hours given back, and the time_off notice about it opens that sheet from the bell and from a phone alert",
    run: async (open, language, expect) => {
      const rows = () => [
        timeOffRow({ id: "to-taken", status: "approved", startsOn: "2026-09-21", endsOn: "2026-09-22", decidedAt: "2026-09-18T15:00:00.000Z", decidedByName: "Jordan Office" }),
        timeOffRow({ id: "to-back", status: "cancelled", startsOn: "2026-09-14", endsOn: "2026-09-14", decidedAt: "2026-09-10T15:00:00.000Z", cancelledAt: "2026-09-12T15:00:00.000Z", givenBack: true }),
      ];
      const app = await open({ stubOptions: { myTimeOff: rows(), leaveBalance: 24 } });
      try {
        await openTab(app.page, "schedule", language);
        await shows(app.page, '[data-leave-balance="paid_sick"]', 8000);
        const openRow = (i) => app.page.evaluate(([heading, n]) => { const h = Array.from(document.querySelectorAll(".sp-content div")).find(d => d.textContent.trim() === heading); const list = h ? Array.from(h.parentElement.querySelectorAll(":scope > button")) : []; if (list[n]) list[n].click(); }, [say("My time off", language), i]);
        await openRow(0);
        const taken = await shows(app.page, '[data-leave-state="taken"]', 6000);
        const takenText = taken ? await app.page.evaluate(() => document.querySelector('[data-leave-state="taken"]').innerText.replace(/\s+/g, " ")) : "";
        expect("an approved request's sheet says the hours it took and the balance now", taken && has(takenText, say("{kind}: this time off took {hours}.", language).replace("{kind}", twinOf(language, SICK)).replace("{hours}", hoursIn(language, 16))) && has(takenText, say("{kind} balance now: {hours}.", language).replace("{kind}", twinOf(language, SICK)).replace("{hours}", hoursIn(language, 24))), takenText || (await offSheet(app.page)).slice(0, 300));
        await clickText(app.page, say("Close", language));
        await pause(app.page, 500);
        await openRow(1);
        const back = await shows(app.page, '[data-leave-state="givenBack"]', 6000);
        const backText = back ? await app.page.evaluate(() => document.querySelector('[data-leave-state="givenBack"]').innerText.replace(/\s+/g, " ")) : "";
        expect("one whose approval the office took back says the hours given back", back && has(backText, say("{kind}: {hours} went back when the office took back the approval.", language).replace("{kind}", twinOf(language, SICK)).replace("{hours}", hoursIn(language, 8))), backText || (await offSheet(app.page)).slice(0, 300));
        await spokenHere(app, language, expect);
      } finally { await app.context.close(); }
      const notice = { id: "n-p369-timeoff", subjectType: "time_off", subjectKey: null, subjectId: "to-back", title: "Invented: your approved time off was taken back", body: "Sep 14, 2026", link: "https://staff.example.invalid/#schedule", createdAt: "2026-09-12T15:01:00.000Z", readAt: null };
      await threeWays(open, { myTimeOff: rows(), notifications: [notice] }, "time_off", "to-back", notice.title, async (o, how) => {
        const up = await shows(o.page, '[data-leave-state="givenBack"]', 7000);
        expect("a time_off notice " + how + " opens that request's sheet with the hours given back", up && (await chosenTab(o.page)) === say("Schedule", language), (await bodyText(o.page)).slice(0, 200));
      });
      // The office's own time_off notice, about someone else's request,
      // which the dashboard works: My Schedule, never that request on the
      // person's own sheet.
      const theirs = Object.assign({}, notice, { id: "n-p369-theirs", subjectId: "to-theirs", title: "Invented: a time off request from a coworker" });
      const office = await open({ stubOptions: { person: MAINT_SUP, myTimeOff: [timeOffRow({ id: "to-theirs", userId: "s-05", userName: "Eve Everett", status: "requested" })], notifications: [theirs] } });
      try {
        await tapOnBell(office, theirs.title);
        await pause(office.page, 2000);
        expect("an office time_off notice about someone else's request opens My Schedule and never their request as the person's own", (await chosenTab(office.page)) === say("Schedule", language) && !has(await bodyText(office.page), say("Cancel request", language)), (await bodyText(office.page)).slice(0, 200));
      } finally { await office.context.close(); }
    },
  },
];
JOURNEYS.push(...PART369_S3_JOURNEYS);

module.exports = { runJourneys, JOURNEYS };
