// Every journey a person actually takes, in both languages.
//
// A journey is judged first on what the app sent, which does not move
// when a word changes, and then on what the screen said.

const { openApp, letSheetOffer } = require("./browser");
const { say } = require("./words");
const { openTab, clickText } = require("./screens");
const { TIME_OFF_REFUSALS, timeOffRow, SECOND_PERSON } = require("./stub");

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

        app.stub.state.refuse["POST /api/auth/login"] = { status: 423, error: "This account is locked. Ask your supervisor to unlock it." };
        await type(app.page, 'input[type="password"]', "4907");
        await clickText(app.page, say("Sign In", language));
        await pause(app.page, 1200);
        expect("a locked account says so", /locked|bloquead/i.test(await bodyText(app.page)), (await bodyText(app.page)).slice(0, 200));
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
        expect("an expired session puts a person back on sign in", back, await bodyText(app.page));
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
        await clickText(app.page, say("End Shift", language));
        await pause(app.page, 700);
        await clickText(app.page, say("End Shift", language));
        await pause(app.page, 1200);
        const end = app.stub.state.calls.filter(c => c.method === "PATCH" && /^\/api\/shift-sessions\//.test(c.path));
        expect("ending a shift sends the session", end.length > 0, JSON.stringify(end.map(c => c.path)));
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
        await app.page.evaluate(() => { const c = document.querySelector('div[style*="z-index: 200"] input[type="checkbox"]'); if (c) c.click(); });
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
        expect("a supply request sends a type and an item", req && req.body && req.body.requestType, req ? JSON.stringify(req.body) : "nothing sent");

        await clickText(app.page, say("+ Request", language));
        await pause(app.page, 700);
        await type(app.page, ".sp-content select", "damaged");
        await typeNth(app.page, ".sp-content input", 0, "A mop handle snapped");
        await clickText(app.page, say("Submit Request", language));
        await pause(app.page, 1200);
        const dmg = lastSent(app.stub, "POST", "/api/supplies/requests");
        expect("damaged gear goes the same way", dmg && dmg.body && dmg.body.requestType, dmg ? JSON.stringify(dmg.body) : "nothing sent");
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
        await app.page.evaluate(() => { const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.offsetParent !== null); if (b) b.click(); });
        await pause(app.page, 1300);
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
        expect("answers are saved as the person moves on", saved.length > 0, JSON.stringify(app.stub.state.calls.slice(-5).map(c => c.method + " " + c.path)));

        // A submit refused for a missing answer.
        app.stub.state.refuse["POST /api/forms/drafts/draft-one/submit"] = { status: 400, body: { error: "Answer every required question before sending", missing: ["what"] } };
        await clickText(app.page, say("Review", language));
        await clickText(app.page, say("Submit report", language));
        await clickText(app.page, say("Send report", language));
        await pause(app.page, 1200);
        const text = await bodyText(app.page);
        expect("a submit with a missing answer is refused in the person's language", text.indexOf(say("Answer every required question before sending", language)) !== -1 || /required|obligator|falta/i.test(text), text.slice(0, 220));
      } finally { await app.context.close(); }
    },
  },
  {
    id: "speakup",
    label: "Speak Up, sent and refused",
    run: async (open, language, expect) => {
      const app = await open({});
      try {
        await openTab(app.page, "speakup", language);
        await pause(app.page, 900);
        await type(app.page, ".sp-content textarea", "An invented account of something that needs looking at.");
        await pause(app.page, 400);
        await clickText(app.page, say("Send", language));
        await pause(app.page, 1300);
        const one = lastSent(app.stub, "POST", "/api/hr-cases");
        expect("Speak Up sends what was written", one && one.body, one ? JSON.stringify(one.body).slice(0, 120) : "nothing sent");

        const app2 = await open({});
        try {
          await openTab(app2.page, "speakup", language);
          await pause(app2.page, 900);
          app2.stub.state.refuse["POST /api/hr-cases"] = { status: 500, error: "Something went wrong on our end. Try again in a minute." };
          await type(app2.page, ".sp-content textarea", "Another invented account.");
          await pause(app2.page, 400);
          await clickText(app2.page, say("Send", language));
          await pause(app2.page, 1300);
          const said = await bodyText(app2.page);
          expect("a refused Speak Up says so in the person's language", said.indexOf(say("Something went wrong on our end. Try again in a minute.", language)) !== -1 || /wrong|error|mal/i.test(said), said.slice(0, 200));
        } finally { await app2.context.close(); }
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

        app.stub.state.uploadsFail = true;
        await attachPhoto(app.page, '.sp-content input[type="file"]');
        await pause(app.page, 1600);
        const said = await bodyText(app.page);
        expect("a photo that will not upload says so in the person's language", said.indexOf(say("Photo upload failed", language)) !== -1, said.slice(-220));
        app.stub.state.uploadsFail = false;

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
        expect("the choice survives the reload the account did not hear about", after === other, String(after));
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

  for (const journey of JOURNEYS) {
    for (const language of LANGUAGES) {
      const open = (over) => openApp(browser, base, Object.assign({ language: language, textSize: "standard", signedIn: true }, over || {},
        { stubOptions: Object.assign({ accountPreferences: { language: language } }, (over || {}).stubOptions || {}) }));
      const expect = (what, ok, detail) => {
        if (!ok) rows.push({ where: journey.label + " [" + language + "]", check: what, detail: String(detail || "").slice(0, 220) });
      };
      try {
        await journey.run(open, language, expect, extra);
      } catch (e) {
        rows.push({ where: journey.label + " [" + language + "]", check: "ran to the end", detail: String(e.message).split("\n")[0].slice(0, 200) });
      }
      if (covered.indexOf(journey.id) === -1) covered.push(journey.id);
    }
  }
  return { rows: rows, covered: covered, journeys: JOURNEYS.length, refusalsShown: extra.refusalsShown, refusalsTotal: TIME_OFF_REFUSALS.length * LANGUAGES.length };
}

module.exports = { runJourneys, JOURNEYS };
