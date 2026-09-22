// Every journey a person actually takes, in both languages.
//
// A journey is judged first on what the app sent, which does not move
// when a word changes, and then on what the screen said.

const { openApp, letSheetOffer } = require("./browser");
const { say, ES } = require("./words");
const { openTab, clickText, startForm } = require("./screens");
const { TIME_OFF_REFUSALS, HR_CASE_REFUSALS, timeOffRow, PERSON, SECOND_PERSON, formP, STAFF } = require("./stub");

const LANGUAGES = ["en", "es"];
const pause = (page, ms) => page.waitForTimeout(ms || 600);

// --- small hands ------------------------------------------------------

const type = (page, selector, value) => page.evaluate(([sel, v]) => {
  const e = document.querySelector(sel);
  if (!e) return false;
  const proto = e.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype
    : e.tagName === "SELECT" ? window.HTMLSelectElement.prototype
      : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(e, v);
  e.dispatchEvent(new Event(e.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  if (e.tagName === "SELECT") e.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}, [selector, value]);

const typeNth = (page, selector, n, value) => page.evaluate(([sel, i, v]) => {
  const e = document.querySelectorAll(sel)[i];
  if (!e) return false;
  const proto = e.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype
    : e.tagName === "SELECT" ? window.HTMLSelectElement.prototype
      : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(e, v);
  e.dispatchEvent(new Event(e.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  if (e.tagName === "SELECT") e.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}, [selector, n, value]);

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
        expect("a wrong PIN says so", /did not match|no coinciden/i.test(await bodyText(app.page)), await bodyText(app.page));

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

        app.stub.state.refuse["POST /api/auth/login"] = { status: 423, error: "This account is locked. Ask your supervisor to unlock it." };
        await type(app.page, 'input[type="password"]', "4907");
        await clickText(app.page, say("Sign In", language));
        await pause(app.page, 1200);
        expect.notYet("what a locked account is told, which arrives as a toast that has faded by the time the suite reads the screen");
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
    id: "shift",
    label: "Start a shift, then end it",
    run: async (open, language, expect) => {
      const app = await open({ stubOptions: { clockedIn: false } });
      try {
        await openTab(app.page, "clock", language);
        await pause(app.page, 800);
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
          const wanted = say(refusal.error, language);
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
        await pickPerson(app.page, STAFF[0].name);
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
        await type(app.page, ".sp-content input[type=\"text\"]", wanted.name.split(" ")[1]);
        await pause(app.page, 500);
        let text = await bodyText(app.page);
        expect("searching narrows the list to the name typed",
          text.indexOf(wanted.name) !== -1 && text.indexOf(STAFF[0].name) === -1, text.slice(0, 300));

        // A name nobody has.
        await type(app.page, ".sp-content input[type=\"text\"]", "Zzz");
        await pause(app.page, 500);
        expect("a name nobody has says so",
          (await bodyText(app.page)).indexOf(say("No one matches that name.", language)) !== -1,
          (await bodyText(app.page)).slice(0, 300));

        // Picking, then removing.
        await type(app.page, ".sp-content input[type=\"text\"]", "");
        await pause(app.page, 400);
        await pickPerson(app.page, wanted.name);
        await pause(app.page, 500);
        expect("a name picked shows as a chip", await chipCount(app.page, language) === 1, "chips on screen: " + (await chipCount(app.page, language)));
        await pickPerson(app.page, STAFF[4].name);
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
        await pickPerson(app.page, wanted.name);
        await pause(app.page, 400);
        await pickPerson(app.page, STAFF[4].name);
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
          app3.stub.state.refuse["GET /api/hr/cases/people"] = { status: 500, error: "Something went wrong on our end. Try again in a minute." };
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
          const drawn = text.indexOf(say(said, language)) !== -1;
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

        await attachPhoto(app.page, '.sp-content input[type="file"]');
        await pause(app.page, 1500);
        const uploaded = app.stub.state.calls.filter(c => c.path === "/api/uploads");
        expect("a photo is uploaded before it is sent", uploaded.length > 0, JSON.stringify(app.stub.state.calls.slice(-4).map(c => c.method + " " + c.path)));

        // A message that failed, then sent again.
        app.stub.state.refuse["POST /api/agent/message"] = { status: 500, error: "Something went wrong on our end. Try again in a minute.", once: true };
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
        }, other === "es" ? "Español" : "English");
        await pause(app.page, 700);
        await app.page.evaluate(() => {
          const b = Array.from(document.querySelectorAll("button")).find(x => /Largest|Más grande|Extra/i.test(x.textContent.trim()));
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
        }, other === "es" ? "Español" : "English");
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
        await app.page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find(x => x.textContent.trim() === "Español"); if (b) b.click(); });
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
  return { rows: rows, covered: covered, journeys: JOURNEYS.length, refusalsShown: extra.refusalsShown, refusalsTotal: (TIME_OFF_REFUSALS.length + HR_CASE_REFUSALS.length) * LANGUAGES.length, gaps: gaps };
}

module.exports = { runJourneys, JOURNEYS };
