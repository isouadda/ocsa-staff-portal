// Every screen and every sheet, in English and Spanish, at all four text
// sizes, and in light as well as dark. The inventory says what has to be
// covered; this says how each one is reached and puts it through the
// checks.

const { openApp, letSheetOffer } = require("./browser");
const { INSPECT, rowsFrom } = require("./checks");
const { LEAKABLE, SPANISH, SPANISH_PATTERNS, say } = require("./words");
const { SCREEN_CASES, SHEET_CASES } = require("./inventory");
const { timeOffRow, formP, STAFF, servedFor, PERSON, INSPECTION } = require("./stub");

const SIZES = ["standard", "large", "xlarge", "largest"];
const LANGUAGES = ["en", "es"];
// Light mode is seen at the two ends of the text size scale, in both
// languages. Every other combination is dark, which is where all eight
// of them ran before.
const LIGHT_SIZES = ["standard", "largest"];
const COMBINATIONS = [];
LANGUAGES.forEach(language => SIZES.forEach(size => COMBINATIONS.push({ language: language, size: size, theme: "dark" })));
LANGUAGES.forEach(language => LIGHT_SIZES.forEach(size => COMBINATIONS.push({ language: language, size: size, theme: "light" })));

// What light mode draws on every screen that carries them. The header is
// the steel blue the brand uses for panels; the bar is white, the way the
// phone's own tab bars are.
const LIGHT_HEADER = "#15558F";
const LIGHT_BAR = "#FFFFFF";

// Names, and only names: the app's own name, invented codes, invented
// people and invented places, and the name of each language, which is
// always written in that language so a person can find their own. None
// of them is a translation fault when it shows on a Spanish screen.
//
// No word is here. A word the stub serves, a to-do item, a supply, a
// notice, a Help reply, a form's title, a shift name or a site role, is
// judged by what it is: on a Spanish screen it passes only in Spanish.
// See "names, words and codes" in audit/stub.js.
const ALLOWED = [
  "English", "Espa\u00f1ol",
  "OCSA Staff", "OCSA Cleaning", "OCSA-0001", "OCSA-FIX-101",
  "Alex", "Tester", "Alex Tester", "Sam", "Second", "Sam Second",
  "North Building", "South Building", "West Building", "Main Hall", "Robin",
// The staff list the Speak Up picker draws. The route sends a first and
// a last name, and the screen joins them, so the whole name is read
// here as one value rather than as two the suite has never seen
// together.
].concat(STAFF.map(p => p.firstName + " " + p.lastName));

// The second form's pages, in order, walked in every combination the
// sweep drives. The form the portal has always drawn is covered by the
// cases above; this one carries the checklist, the table a person adds
// rows to and the sign-off.
const FORM_P_PAGES = [
  "Site walk, the walk",
  "Site walk, every area",
  "Site walk, the rooms",
  "Site walk, sign it",
  "Site walk, review",
];

// The Tasks tab a second time, drawn from the whole site's list in shifts.
// Its name starts with the tab's, so what is known about the tab is known
// about it too.
const WHOLE_SITE_TASKS = "Tasks, the whole site in shifts";

// The Tasks tab three more times, at West Building, whose list is shaped
// like the busiest live one: the sheet that asks which shift, the same
// sheet once a change could not reach OCSA, and the night shift's list,
// Today and each period's section with its count, who did what and when,
// a coworker's check, and the line a tap on it says.
const SHIFT_SHEET = "Tasks, which shift";
const SHIFT_SHEET_OFFLINE = "Tasks, which shift, no signal";
const PERIOD_LIST = "Tasks, today and the periods";

// Help three more times, with answers on it: while one is being written,
// once it is done, and once a connection has dropped and the answer could
// not be read back yet. Each name starts with the tab's, the same way.
const HELP_ARRIVING = "Help, while the answer arrives";
const HELP_DONE = "Help, the answer done";
const HELP_DROPPED = "Help, the connection dropped";
// Step 145: an inspection open on its cards, the first marked Not due yet
// and the second Needs a fix.
const INSPECTION_OPEN = "Inspect, an inspection open";
// The same inspection sent with both cards marked Needs a fix and the first
// report refused, so the count, Not reported and Try again are all drawn.
const INSPECTION_SENT = "Inspect, sent";

// Chat four more times, each name starting with the tab's: a list of nine
// group chats and twenty private chats with a group chat open; a send that
// did not go, its words kept and its line under the box with Try again;
// Send tapped with words and no chat chosen; and a list that did not load.
const CHAT_EVERY = "Chat, every chat";
const CHAT_NOT_SENT = "Chat, a message not sent";
const CHAT_PICK_FIRST = "Chat, pick a chat first";
const CHAT_NO_LIST = "Chat, the list did not load";
// A chat on the screen tapped by its name.
const tapChatNamed = (page, name) => page.evaluate((want) => {
  const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.innerText.replace(/\s+/g, " ").trim().indexOf(want) === 0);
  if (b) b.click();
  return !!b;
}, name);
// Words in the composer's box, the way a person types them.
const typeInBox = (page, words) => page.evaluate((v) => {
  const e = document.querySelector(".sp-content input");
  if (!e) return false;
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(e, v);
  e.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}, words);
const tapSendLabel = (page, language) => page.evaluate((want) => {
  const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => (x.getAttribute("aria-label") || "").trim() === want);
  if (b) b.click();
  return !!b;
}, say("Send", language));

const TAB_LABEL = {
  clock: "Home", schedule: "Schedule", tasks: "Tasks", chat: "Chat",
  agent: "Help", issuetasks: "Assigned", issues: "Report", supplies: "Supplies",
  pickup: "Pickup", inspect: "Inspect", speakup: "Speak Up", settings: "Settings",
  forms: "Forms",
};

const pause = (page, ms) => page.waitForTimeout(ms || 500);

// The bar carries Home and four shortcuts; everything else is under More.
async function openTab(page, tabId, language) {
  if (tabId === "profile") {
    await page.evaluate(() => {
      const content = document.querySelector(".sp-content");
      const b = Array.from(document.querySelectorAll("button")).find(x => content && (x.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING));
      if (b) b.click();
    });
    await pause(page, 900);
    return true;
  }
  const wanted = say(TAB_LABEL[tabId] || tabId, language);
  const more = say("More", language);
  const where = await page.evaluate(([name, moreName]) => {
    const bar = Array.from(document.querySelectorAll("div")).find((el) => {
      const s = getComputedStyle(el);
      return s.position === "fixed" && s.bottom === "0px" && el.querySelectorAll(":scope > button").length >= 5;
    });
    if (!bar) return "no bar";
    const clean = (b) => b.textContent.trim().replace(/^\d+/, "");
    const onBar = Array.from(bar.querySelectorAll(":scope > button")).find(b => clean(b) === name);
    if (onBar) { onBar.click(); return "bar"; }
    const moreBtn = Array.from(bar.querySelectorAll(":scope > button")).find(b => clean(b) === moreName) || Array.from(bar.querySelectorAll(":scope > button")).pop();
    if (moreBtn) { moreBtn.click(); return "more"; }
    return "nothing";
  }, [wanted, more]);
  await pause(page, 500);
  if (where === "more") {
    await page.evaluate((name) => {
      const grid = Array.from(document.querySelectorAll("div")).find(d => getComputedStyle(d).display === "grid" && d.querySelectorAll(":scope > button").length >= 5);
      const b = grid && Array.from(grid.querySelectorAll(":scope > button")).find(x => x.textContent.trim().replace(/^\d+/, "") === name);
      if (b) b.click();
    }, wanted);
    await pause(page, 800);
  }
  return where !== "nothing" && where !== "no bar";
}

// Every sheet, by the shortest route a person would take to it.
const SHEET_OPENERS = {
  "TextSizeButton#0": async (page, language) => {
    await openTab(page, "settings", language);
    await clickText(page, say("Text size", language));
  },
  "OCSAStaffPortal#0": async (page) => {
    await page.evaluate(() => {
      const bar = Array.from(document.querySelectorAll("div")).find((el) => {
        const s = getComputedStyle(el);
        return s.position === "fixed" && s.bottom === "0px" && el.querySelectorAll(":scope > button").length >= 5;
      });
      if (bar) Array.from(bar.querySelectorAll(":scope > button")).pop().click();
    });
    await pause(page, 600);
  },
  "MyScheduleSection#0": async (page, language) => {
    await openTab(page, "schedule", language);
    await clickText(page, say("Request time off", language));
  },
  "MyScheduleSection#1": async (page, language) => {
    await openTab(page, "schedule", language);
    await page.evaluate(([heading]) => {
      const h = Array.from(document.querySelectorAll(".sp-content div")).find(d => d.textContent.trim() === heading);
      const b = h && h.parentElement.querySelector("button");
      if (b) b.click();
    }, [say("My time off", language)]);
    await pause(page, 900);
  },
  "MyScheduleSection#2": async (page, language) => {
    await openTab(page, "schedule", language);
    await page.evaluate(() => {
      const grid = Array.from(document.querySelectorAll(".sp-content div")).find(d => getComputedStyle(d).display === "grid" && d.children.length === 7);
      const card = grid && Array.from(grid.querySelectorAll("div")).find(d => d.onclick);
      if (card) card.click();
    });
    await pause(page, 800);
  },
  "ShortcutsSheet#0": async (page, language) => {
    await openTab(page, "settings", language);
    await clickText(page, say("Edit shortcuts", language));
  },
  "ShortcutsSheet#1": async (page, language) => {
    await SHEET_OPENERS["ShortcutsSheet#0"](page, language);
    await page.evaluate(() => {
      const sheet = Array.from(document.querySelectorAll("div")).find(d => { const s = getComputedStyle(d); return s.position === "fixed" && s.zIndex === "400"; });
      const b = sheet && sheet.querySelectorAll("button")[1];
      if (b) b.click();
    });
    await pause(page, 700);
  },
  "ShortcutsSheet#2": async (page, language) => {
    await SHEET_OPENERS["ShortcutsSheet#0"](page, language);
    await clickText(page, say("Start over", language));
  },
  "NotificationsSheet#0": async (page) => {
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find(x => /notification|notificaciones/i.test(x.getAttribute("aria-label") || ""));
      if (b) b.click();
    });
    await pause(page, 900);
  },
  "FormFiller#0": async (page, language) => {
    await openForm(page, language);
    // Answer through to the end, where Submit report replaces Next.
    for (let i = 0; i < 4; i += 1) {
      await answerThisPage(page);
      const moved = await clickText(page, say("Next", language));
      if (!moved) break;
    }
    await clickText(page, say("Submit report", language));
  },
  "FormFiller#1": async (page, language) => {
    await openForm(page, language);
    await clickText(page, say("Close", language));
  },
  "InspectView#0": async (page, language) => {
    await openTab(page, "inspect", language);
    await clickText(page, say("+ Schedule", language));
  },
  "HomeScreenPrompt#0": async (page) => { await letSheetOffer(page); },
};

// The Forms screen lists more than one form now, so a case says which
// card it means by the title on it.
async function startForm(page, title) {
  const hit = await page.evaluate((want) => {
    const cards = Array.from(document.querySelectorAll(".sp-content div"));
    const card = cards.find(d => d.querySelector(":scope > button") && d.textContent.indexOf(want) === 0);
    const b = card && card.querySelector(":scope > button");
    if (b) { b.click(); return true; }
    return false;
  }, title);
  await pause(page, 1500);
  return hit;
}

async function clickText(page, text) {
  const hit = await page.evaluate((t) => {
    const on = Array.from(document.querySelectorAll("button")).filter(x => x.offsetParent !== null && !x.disabled);
    const b = on.find(x => x.textContent.trim() === t) || on.find(x => x.textContent.trim().indexOf(t) !== -1);
    if (b) { b.click(); return true; }
    return false;
  }, text);
  await pause(page, 800);
  return hit;
}

// One question to Help, typed and sent. What a person types is theirs, a
// name wherever it shows, the way the journeys count it.
async function askHelp(page, stub, language, question) {
  stub.state.served.add(question);
  await page.evaluate((v) => {
    const box = document.querySelector(".sp-content textarea");
    if (!box) return;
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(box, v);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  }, question);
  await pause(page, 300);
  await page.evaluate((label) => {
    const b = Array.from(document.querySelectorAll(".sp-content button")).find(x => x.getAttribute("aria-label") === label && !x.disabled);
    if (b) b.click();
  }, say("Send", language));
}
// Help takes the next question once the answer to the last one is done.
async function helpAnswered(page) {
  for (let i = 0; i < 100; i += 1) {
    const busy = await page.evaluate(() => { const box = document.querySelector(".sp-content textarea"); return !box || box.disabled; });
    if (!busy) return true;
    await pause(page, 100);
  }
  return false;
}
// The answer stopped at a point the stub was told to hold it at.
async function helpHeld(page, stub, name) {
  for (let i = 0; i < 100; i += 1) {
    const gate = stub.state.help.holds[name];
    if (gate && gate.reached) { await pause(page, 500); return true; }
    await pause(page, 100);
  }
  return false;
}

// Fills whatever the page in front of a person is asking for.
async function answerThisPage(page) {
  await page.evaluate(() => {
    Array.from(document.querySelectorAll(".sp-content input, .sp-content textarea, .sp-content select")).forEach((e, i) => {
      if (e.type === "checkbox" || e.type === "radio" || e.type === "file") return;
      const proto = e.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : e.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
      const value = e.type === "date" ? "2026-10-01" : e.tagName === "SELECT" ? (e.options[1] ? e.options[1].value : "") : "An invented answer " + i;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(e, value);
      e.dispatchEvent(new Event(e.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
    });
  });
  await pause(page, 400);
}

async function openForm(page, language) {
  await openTab(page, "forms", language);
  await pause(page, 700);
  await clickText(page, say("Start report", language));
  await pause(page, 1300);
}

// One screen or sheet, in one language at one size in one theme. What
// the stub served goes in with the rest, sorted into names, words and
// codes, so a name it invented is never read as an English word the app
// forgot, and a word it served in English is never read as a name.
async function inspect(page, scope, caseName, language, size, stub, theme) {
  const served = servedFor(stub);
  const found = await page.evaluate(INSPECT, {
    leakable: LEAKABLE, allowed: ALLOWED, language: language, scope: scope,
    spanish: SPANISH, patterns: SPANISH_PATTERNS,
    names: served.names, words: served.words, codes: served.codes,
    light: theme === "light" ? { header: LIGHT_HEADER, bar: LIGHT_BAR } : null,
  });
  return rowsFrom(found, caseName, language, size, theme);
}

// The whole sweep. Returns rows for anything that went wrong plus what
// was covered.
async function runScreens(browser, base, opts) {
  const o = opts || {};
  const rows = [];
  const covered = { screens: [], sheets: [] };
  const gaps = [];
  let combinations = 0;

  const stubFor = (language, size) => ({
    accountPreferences: { language: language, textSize: size },
    myTimeOff: [timeOffRow({ id: "to-one", status: "requested" })],
    drafts: [{ id: "draft-one", formName: "Incident report", answered: 3, remaining: 2, conversationId: "cv-one" }],
    notifications: [{ id: "n-1", subjectType: "supply_request", subjectId: "sr-1", title: "Supply request approved", body: "Two cases of paper towels.", link: null, createdAt: "2026-10-01T18:00:00.000Z", readAt: null }],
  });

  for (const combination of COMBINATIONS) {
    const language = combination.language, size = combination.size, theme = combination.theme;
    // Every tab in one session, the way a person moves through them.
    const tabCases = SCREEN_CASES.filter(c => c.kind === "tab");
    const app = await openApp(browser, base, { language: language, textSize: size, theme: theme, signedIn: true, stubOptions: stubFor(language, size) });
    try {
      // The portal itself, before any tab is chosen.
      rows.push(...await inspect(app.page, null, "The portal itself", language, size, app.stub, theme));
      if (covered.screens.indexOf("main") === -1) covered.screens.push("main");
      combinations += 1;
      for (const sc of tabCases) {
        const ok = await openTab(app.page, sc.id, language);
        if (!ok) rows.push({ where: sc.label + " [" + language + "/" + size + "/" + theme + "]", check: "reachable", detail: "the tab could not be opened" });
        rows.push(...await inspect(app.page, null, sc.label, language, size, app.stub, theme));
        if (covered.screens.indexOf(sc.id) === -1) covered.screens.push(sc.id);
        combinations += 1;
      }

      // The second form, page by page, in this same session.
      await openTab(app.page, "forms", language);
      const started = await startForm(app.page, formP(language).title);
      if (!started) {
        rows.push({ where: FORM_P_PAGES[0] + " [" + language + "/" + size + "/" + theme + "]", check: "reachable", detail: "the second form could not be started" });
      } else {
        for (let i = 0; i < FORM_P_PAGES.length; i += 1) {
          rows.push(...await inspect(app.page, null, FORM_P_PAGES[i], language, size, app.stub, theme));
          if (i < FORM_P_PAGES.length - 1) await clickText(app.page, say("Next", language));
        }
      }
    } finally {
      await app.context.close();
    }

    // The checklist most people open: the whole site's list, for someone
    // linked to nothing, at a site whose long list is set out in shifts.
    // Its own session, since the site and the links are the stub's.
    const whole = await openApp(browser, base, {
      language: language, textSize: size, theme: theme, signedIn: true,
      stubOptions: Object.assign(stubFor(language, size), { site: "site-south", links: {} }),
    });
    try {
      const ok = await openTab(whole.page, "tasks", language);
      if (!ok) rows.push({ where: WHOLE_SITE_TASKS + " [" + language + "/" + size + "/" + theme + "]", check: "reachable", detail: "the tab could not be opened" });
      await pause(whole.page, 900);
      rows.push(...await inspect(whole.page, null, WHOLE_SITE_TASKS, language, size, whole.stub, theme));
    } finally {
      await whole.context.close();
    }

    // West Building three times, each in a session of its own. The sheet
    // first, in a session that carries no shift yet; then the same sheet
    // after Use this shift could not reach OCSA; then the night shift's
    // list, with the coworker's check tapped so the line it says is on
    // the screen, the clock held while the checks read it.
    const whereAt = (name) => name + " [" + language + "/" + size + "/" + theme + "]";
    for (const variant of [SHIFT_SHEET, SHIFT_SHEET_OFFLINE, PERIOD_LIST]) {
      const west = await openApp(browser, base, {
        language: language, textSize: size, theme: theme, signedIn: true,
        stubOptions: Object.assign(stubFor(language, size), { site: "site-west", links: {} }, variant === PERIOD_LIST ? { shiftLabel: "Night shift" } : {}),
      });
      try {
        const ok = await openTab(west.page, "tasks", language);
        if (!ok) rows.push({ where: whereAt(variant), check: "reachable", detail: "the tab could not be opened" });
        await pause(west.page, 1200);
        if (variant === SHIFT_SHEET_OFFLINE) {
          west.stub.state.offline = true;
          await clickText(west.page, say("Use this shift", language));
          await pause(west.page, 900);
        }
        let held = false;
        if (variant === PERIOD_LIST) {
          await west.page.evaluate((label) => {
            const b = Array.from(document.querySelectorAll(".sp-content button[aria-label]")).find(x => x.getAttribute("aria-label") === label);
            if (b) b.click();
          }, say("Mark {name} not done", language).replace("{name}", "Wipe the restroom sinks"));
          await pause(west.page, 300);
          const pageNow = await west.page.evaluate(() => Date.now());
          await west.page.clock.pauseAt(pageNow + 50).catch(() => {});
          held = true;
        }
        rows.push(...await inspect(west.page, null, variant, language, size, west.stub, theme));
        if (held) await west.page.clock.resume().catch(() => {});
      } finally {
        await west.context.close();
      }
    }

    // Chat four times, each in a session of its own. The first is an
    // admin's list, nine group chats and twenty private chats, the private
    // row scrolling on its own, with a group chat open. The person is the
    // one every other case signs in as, with an admin's role.
    for (const variant of [CHAT_EVERY, CHAT_NOT_SENT, CHAT_PICK_FIRST, CHAT_NO_LIST]) {
      const chat = await openApp(browser, base, {
        language: language, textSize: size, theme: theme, signedIn: true,
        stubOptions: Object.assign(stubFor(language, size), variant === CHAT_EVERY ? { person: Object.assign({}, PERSON, { role: "admin" }), chat: { privates: 20 } } : {}),
      });
      try {
        if (variant === CHAT_NO_LIST) chat.stub.state.refuse["GET /api/chat/channels"] = { status: 500, body: { error: "Server error" } };
        const ok = await openTab(chat.page, "chat", language);
        if (!ok) rows.push({ where: whereAt(variant), check: "reachable", detail: "the tab could not be opened" });
        await pause(chat.page, 1200);
        if (variant === CHAT_EVERY || variant === CHAT_NOT_SENT) { await tapChatNamed(chat.page, "North Building"); await pause(chat.page, 900); }
        if (variant === CHAT_NOT_SENT || variant === CHAT_PICK_FIRST) await typeInBox(chat.page, "A note for the chat");
        if (variant === CHAT_NOT_SENT) chat.stub.state.refuse["POST /api/chat/channels/ch-north/messages"] = { status: 500, once: true, body: { error: "Server error" } };
        if (variant === CHAT_NOT_SENT || variant === CHAT_PICK_FIRST) { await pause(chat.page, 200); await tapSendLabel(chat.page, language); await pause(chat.page, 900); }
        rows.push(...await inspect(chat.page, null, variant, language, size, chat.stub, theme));
      } finally {
        await chat.context.close();
      }
    }

    // An inspection open on its cards, in its own session: the first card
    // marked Not due yet, the second Needs a fix.
    const insp = await openApp(browser, base, { language: language, textSize: size, theme: theme, signedIn: true, stubOptions: Object.assign(stubFor(language, size), { inspections: [INSPECTION] }) });
    try {
      const ok = await openTab(insp.page, "inspect", language);
      if (!ok) rows.push({ where: whereAt(INSPECTION_OPEN), check: "reachable", detail: "the tab could not be opened" });
      await pause(insp.page, 900);
      const opened = await clickText(insp.page, INSPECTION.template_name);
      if (!opened) rows.push({ where: whereAt(INSPECTION_OPEN), check: "reachable", detail: "the inspection could not be opened" });
      await pause(insp.page, 600);
      await insp.page.evaluate(([firstId, secondId, notDue, fix]) => {
        const on = (id, text) => { const b = Array.from(document.querySelectorAll('[data-inspect-item="' + id + '"] button')).find(x => x.textContent.trim() === text); if (b) b.click(); };
        on(firstId, notDue);
        on(secondId, fix);
      }, [INSPECTION.items[0].id, INSPECTION.items[1].id, say("Not due yet", language), say("Needs a fix", language)]);
      await pause(insp.page, 400);
      rows.push(...await inspect(insp.page, null, INSPECTION_OPEN, language, size, insp.stub, theme));
      // Then sent: Not due yet off again, both cards Needs a fix with a
      // note, the first report refused once.
      await insp.page.evaluate(([firstId, secondId, notDue, fix]) => {
        const on = (id, text) => { const b = Array.from(document.querySelectorAll('[data-inspect-item="' + id + '"] button')).find(x => x.textContent.trim() === text); if (b) b.click(); };
        const say = (id, words) => { const e = document.querySelector('[data-inspect-item="' + id + '"] input:not([type="range"]):not([type="file"])'); if (!e) return; Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(e, words); e.dispatchEvent(new Event("input", { bubbles: true })); };
        on(firstId, notDue);
        on(firstId, fix);
        say(firstId, "Smudges on the left door");
        say(secondId, "Mat is wet and turned up");
      }, [INSPECTION.items[0].id, INSPECTION.items[1].id, say("Not due yet", language), say("Needs a fix", language)]);
      insp.stub.state.refuse["POST /api/issues"] = { status: 500, error: "Something went wrong on our end. Try again in a minute.", once: true };
      await clickText(insp.page, say("Submit Inspection", language));
      await pause(insp.page, 1200);
      const sentLine = say("Inspection sent. {n} problem reported for fixing.", language).split("{")[0].trim();
      const saidSent = await insp.page.evaluate((line) => document.body.innerText.indexOf(line) !== -1, sentLine);
      if (!saidSent) rows.push({ where: whereAt(INSPECTION_SENT), check: "reachable", detail: "the sent view never came up" });
      rows.push(...await inspect(insp.page, null, INSPECTION_SENT, language, size, insp.stub, theme));
    } finally {
      await insp.context.close();
    }

    // Help with answers on it, in its own session. A report started first,
    // so its card is on the screen, then an answer stopped halfway through
    // being written, a bold phrase and a step drawn and more to come, then
    // the same answer done. Last, one whose connection dropped after its
    // first words and whose conversation could not be read back, so the
    // line and Try again stay.
    const help = await openApp(browser, base, { language: language, textSize: size, theme: theme, signedIn: true, stubOptions: stubFor(language, size) });
    try {
      const where = " [" + language + "/" + size + "/" + theme + "]";
      const ok = await openTab(help.page, "agent", language);
      if (!ok) rows.push({ where: HELP_ARRIVING + where, check: "reachable", detail: "the tab could not be opened" });
      await pause(help.page, 800);
      help.stub.state.help.next = { answer: "report" };
      await askHelp(help.page, help.stub, language, "Someone slipped in the hall");
      await helpAnswered(help.page);
      help.stub.state.help.next = { answer: "spill", holds: { halfway: 4 } };
      await askHelp(help.page, help.stub, language, "What do I do about a spill");
      if (!(await helpHeld(help.page, help.stub, "halfway"))) rows.push({ where: HELP_ARRIVING + where, check: "reachable", detail: "the answer never started" });
      rows.push(...await inspect(help.page, null, HELP_ARRIVING, language, size, help.stub, theme));
      help.stub.state.help.holds.halfway.open();
      await helpAnswered(help.page);
      rows.push(...await inspect(help.page, null, HELP_DONE, language, size, help.stub, theme));
      help.stub.state.help.next = { answer: "pads", drop: { after: 1 } };
      help.stub.state.refuse["GET /api/agent/conversations/cv-one"] = { status: 500, error: "Something went wrong on our end. Try again in a minute.", once: true };
      await askHelp(help.page, help.stub, language, "Where are the floor pads");
      await helpAnswered(help.page);
      await pause(help.page, 300);
      rows.push(...await inspect(help.page, null, HELP_DROPPED, language, size, help.stub, theme));
    } finally {
      await help.context.close();
    }

    // Everything before signing in wants its own session. Set your PIN is
    // the screen an account that has to choose a new PIN opens on, so its
    // case asks the stub for such an account; without it the case drew
    // the portal behind it.
    for (const sc of SCREEN_CASES.filter(c => c.kind === "screen" && c.id !== "main")) {
      const one = await openApp(browser, base, {
        language: language, textSize: size, theme: theme, signedIn: sc.signedIn !== false,
        path: sc.path || "/", stubOptions: Object.assign(stubFor(language, size), sc.mustSetPin ? { mustSetPin: true } : {}),
      });
      try {
        if (sc.via === "register") await clickText(one.page, say("Register Here", language));
        if (sc.via === "forgot") await clickText(one.page, say("Forgot your PIN?", language));
        rows.push(...await inspect(one.page, null, sc.label, language, size, one.stub, theme));
        if (covered.screens.indexOf(sc.id) === -1) covered.screens.push(sc.id);
        combinations += 1;
      } finally {
        await one.context.close();
      }
    }
  }

  // The sheets, at the two ends of the text size scale, since a sheet's
  // own layout is what the size changes.
  for (const language of LANGUAGES) {
    for (const size of ["standard", "largest"]) {
      for (const sh of SHEET_CASES) {
        const app = await openApp(browser, base, {
          language: language, textSize: size, signedIn: true,
          installSheet: sh.id === "HomeScreenPrompt#0" ? "fresh" : "dismissed",
          stubOptions: {
            accountPreferences: { language: language, textSize: size },
            myTimeOff: [timeOffRow({ id: "to-one", status: "requested" })],
          },
        });
        try {
          const opener = SHEET_OPENERS[sh.id];
          if (opener) await opener(app.page, language);
          const up = await app.page.evaluate(() => Array.from(document.querySelectorAll("div")).some((d) => {
            const s = getComputedStyle(d);
            return s.position === "fixed" && s.top === "0px" && s.left === "0px" && s.right === "0px" && s.bottom === "0px";
          }));
          if (!up) {
            // A case exists for it; the suite cannot open it yet. Named
            // on every run rather than counted as covered.
            const line = sh.label + ": the suite cannot open this sheet yet";
            if (gaps.indexOf(line) === -1) gaps.push(line);
          } else {
            // Marked so the checks read the sheet rather than the screen
            // it is sitting over.
            await app.page.evaluate(() => {
              const sheet = Array.from(document.querySelectorAll("div")).filter((d) => {
                const s = getComputedStyle(d);
                return s.position === "fixed" && s.top === "0px" && s.left === "0px" && s.right === "0px" && s.bottom === "0px";
              }).pop();
              if (sheet) sheet.setAttribute("data-audit-sheet", "1");
            });
            rows.push(...await inspect(app.page, "[data-audit-sheet]", sh.label, language, size, app.stub, "dark"));
            if (covered.sheets.indexOf(sh.id) === -1) covered.sheets.push(sh.id);
          }
          combinations += 1;
        } finally {
          await app.context.close();
        }
      }
    }
  }

  return { rows: rows, covered: covered, gaps: gaps, combinations: COMBINATIONS.length };
}

module.exports = { runScreens, openTab, clickText, startForm, SIZES, LANGUAGES, COMBINATIONS, FORM_P_PAGES, ALLOWED };
