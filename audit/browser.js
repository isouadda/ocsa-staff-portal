// One place that opens a phone-shaped page with the whole API answered
// by the stub, the clock fixed, and storage seeded the way a case wants.
const { chromium } = require("playwright");
const { createStub, NOW } = require("./stub");
const fs = require("fs");
const path = require("path");

// The stamp the build carries. Answering the version check with anything
// else would put the update bar over every screen and reload the app in
// the middle of a case.
function builtStamp() {
  try {
    const file = path.join(__dirname, "..", "build", "version.json");
    return JSON.parse(fs.readFileSync(file, "utf8")).stamp;
  } catch (e) { return "audit"; }
}

// A phone, not a desktop window scaled down. The user agent matters:
// the install sheet only offers itself on a phone or tablet.
const PHONE = {
  viewport: { width: 375, height: 667 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  timezoneId: "America/New_York",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
};

const AUTH_KEY = "ocsa_auth";
const LANGUAGE_KEY = "ocsa-staff-language";
const TEXT_SIZE_KEY = "ocsa-staff-text-size";
const THEME_KEY = "ocsa-staff-theme";
const PROMPT_KEY = "ocsa-home-screen-prompt";

// The sheet waits this long after a load before it offers itself.
const SHEET_SETTLE_MS = 2500;

async function launch() {
  return chromium.launch();
}

// opts: { language, textSize, theme, signedIn, installSheet, stub, locale,
//         storeLanguage, phone }
// phone: "en" or "es", the language the phone itself is set to, which is
// the case's language unless a case says otherwise. The browser sends it
// on every request as Accept-Language.
// storeLanguage: false opens a phone that has never chosen a language:
// nothing is stored on the first load, the phone itself is set to the
// case's language, and whatever the app stores after that is kept.
// installSheet: "dismissed" (the default, so it is out of the way of
// every other case) or "fresh" (nothing stored, so it offers itself).
// theme: "dark", which is what every case ran in before light mode
// joined the sweep, or "light". Seeded before the first paint, so the app
// draws the theme the case asked for from the first frame rather than
// turning into it.
async function openApp(browser, base, opts) {
  const o = opts || {};
  const stub = o.stub || createStub(o.stubOptions);
  // The phone itself is set to dark, the way every case has run until
  // now. A light case therefore proves two things at once: the seed below
  // reached the app, and a stored choice still beats what the phone says.
  const theme = o.theme === "light" ? "light" : "dark";
  const context = await browser.newContext(Object.assign({}, PHONE, {
    locale: (o.phone || o.language) === "es" ? "es-US" : "en-US",
    colorScheme: "dark",
  }));

  await context.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    let body = null;
    const raw = req.postData();
    if (raw) { try { body = JSON.parse(raw); } catch (e) { body = raw; } }
    const answer = stub.handle(req.method(), url.pathname, url.search, body, (req.headers() || {})["accept-language"] || "");
    if (answer && answer.abort) { await route.abort("failed"); return; }
    await route.fulfill(answer);
  });

  // The app's own version check asks for this file. The suite answers it
  // with the stamp the build carries, so nothing reloads mid case.
  await context.route("**/version.json*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stamp: o.buildStamp || builtStamp() }) });
  });

  await context.clock.install({ time: NOW });
  await context.addInitScript(([signedIn, language, textSize, theme, sheet, keys, fresh]) => {
    try {
      const ls = window.localStorage;
      // Stamped with whatever the faked clock reads, so a case that moves
      // days forward does not age the token past the app's own ceiling.
      if (signedIn) ls.setItem(keys.auth, JSON.stringify({ token: "token-one", savedAt: Date.now() }));
      else ls.removeItem(keys.auth);
      if (fresh) {
        if (!window.sessionStorage.getItem("audit-language-fresh")) {
          window.sessionStorage.setItem("audit-language-fresh", "1");
          ls.removeItem(keys.language);
        }
      } else if (language) ls.setItem(keys.language, language); else ls.removeItem(keys.language);
      if (textSize) ls.setItem(keys.textSize, textSize); else ls.removeItem(keys.textSize);
      if (theme) ls.setItem(keys.theme, theme); else ls.removeItem(keys.theme);
      if (sheet === "dismissed") ls.setItem(keys.prompt, JSON.stringify({ never: true }));
      else if (sheet === "fresh" && !window.sessionStorage.getItem("audit-sheet-live")) {
        window.sessionStorage.setItem("audit-sheet-live", "1");
        ls.removeItem(keys.prompt);
      }
    } catch (e) {}
  }, [o.signedIn !== false, o.language || "en", o.textSize || "standard", theme, o.installSheet || "dismissed",
      { auth: AUTH_KEY, language: LANGUAGE_KEY, textSize: TEXT_SIZE_KEY, theme: THEME_KEY, prompt: PROMPT_KEY }, o.storeLanguage === false]);

  const page = await context.newPage();
  // One screen still asks through the browser's own confirm box. Left
  // unanswered it blocks the journey, so the suite says yes the way a
  // person would.
  page.on("dialog", (d) => { d.accept().catch(() => {}); });
  const problems = [];
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|Failed to load resource/.test(m.text())) problems.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => problems.push("pageerror: " + String(e.message).slice(0, 160)));

  await page.goto(base + (o.path || "/"), { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".sp-content, input[type=\"password\"], form, button", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(900);

  return { context: context, page: page, stub: stub, problems: problems };
}

// Past the install sheet's own wait, for a case that wants to see it.
async function letSheetOffer(page) {
  await page.clock.runFor(SHEET_SETTLE_MS + 400);
  await page.waitForTimeout(400);
}

module.exports = { launch, openApp, letSheetOffer, PHONE, SHEET_SETTLE_MS, AUTH_KEY, LANGUAGE_KEY, TEXT_SIZE_KEY, THEME_KEY, PROMPT_KEY };
