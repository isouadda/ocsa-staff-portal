// What the app can show, read out of the app itself.
//
// The suite proves its own coverage: this file discovers the tabs, the
// sign in screens and the full screen sheets from src, and the case
// lists below say which of them a case drives. Anything discovered with
// no case is printed as NO CASE and fails the run, so a screen added
// tomorrow cannot land untested.

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const appSource = () => fs.readFileSync(path.join(SRC, "App.js"), "utf8");

// --- what the app can show ------------------------------------------

// The bottom bar and the More grid are both built from this one list.
function discoverTabs() {
  const src = appSource();
  const block = src.match(/const DESTINATIONS = \[([\s\S]*?)\n\];/);
  if (!block) throw new Error("DESTINATIONS not found in src/App.js");
  const ids = [];
  block[1].replace(/\bid:\s*"([^"]+)"/g, (whole, id) => { ids.push(id); return whole; });
  // Reached from the header rather than the bar, so it is not in the list.
  const fromHeader = [];
  src.replace(/setActiveTab\("([a-z]+)"\)/g, (whole, id) => { if (ids.indexOf(id) === -1 && fromHeader.indexOf(id) === -1) fromHeader.push(id); return whole; });
  return ids.concat(fromHeader);
}

// Everything before signing in, plus main.
function discoverScreens() {
  const src = appSource();
  const seen = [];
  src.replace(/screen === "([a-z]+)"/g, (whole, id) => { if (seen.indexOf(id) === -1) seen.push(id); return whole; });
  return seen;
}

// Every sheet, dialog and confirmation shares one shape: a fixed box
// pinned to all four edges. Nothing else in the app is one.
const OVERLAY = /position: "fixed", top: 0, left: 0, right: 0, bottom: 0/g;
function discoverSheets() {
  const files = [
    { name: "App.js", text: appSource() },
    { name: "HomeScreenPrompt.js", text: fs.readFileSync(path.join(SRC, "HomeScreenPrompt.js"), "utf8") },
  ];
  const found = [];
  files.forEach((f) => {
    const lines = f.text.split("\n");
    const perOwner = {};
    lines.forEach((line, i) => {
      OVERLAY.lastIndex = 0;
      if (!OVERLAY.test(line)) return;
      let owner = f.name.replace(".js", "");
      for (let j = i; j >= 0; j--) {
        const m = lines[j].match(/^(?:export default )?function ([A-Za-z0-9_]+)\(/);
        if (m) { owner = m[1]; break; }
      }
      perOwner[owner] = (perOwner[owner] || 0);
      const id = owner + "#" + perOwner[owner];
      perOwner[owner] += 1;
      // A label a person can read: the comment above it, or the state
      // that opens it.
      let label = "";
      for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
        const c = lines[j].match(/\{\/\* (.+?) \*\/\}/);
        if (c) { label = c[1].toLowerCase(); break; }
        const s = lines[j].match(/\{([A-Za-z0-9_.]+) && \(?$/);
        if (s) { label = "when " + s[1]; break; }
      }
      found.push({ id: id, owner: owner, line: i + 1, label: label });
    });
  });
  return found;
}

// --- what the suite drives ------------------------------------------

// One case per screen. Each says how to get there from a fresh load.
// "tab" drives the bottom bar or More; "screen" opens a path.
const SCREEN_CASES = [
  { id: "login", kind: "screen", path: "/", signedIn: false, label: "Sign in" },
  { id: "register", kind: "screen", path: "/", signedIn: false, via: "register", label: "Register" },
  { id: "forgot", kind: "screen", path: "/", signedIn: false, via: "forgot", label: "Forgot your PIN" },
  { id: "activate", kind: "screen", path: "/activate?token=fixture", signedIn: false, label: "Activate an account" },
  { id: "reset", kind: "screen", path: "/reset-pin?token=fixture", signedIn: false, label: "Reset a PIN" },
  { id: "setpin", kind: "screen", path: "/", signedIn: true, mustSetPin: true, label: "Set your PIN" },
  { id: "main", kind: "screen", path: "/", signedIn: true, label: "The portal itself" },

  { id: "clock", kind: "tab", label: "Home" },
  { id: "schedule", kind: "tab", label: "Schedule" },
  { id: "tasks", kind: "tab", label: "Tasks" },
  { id: "chat", kind: "tab", label: "Chat" },
  { id: "agent", kind: "tab", label: "Help" },
  { id: "issuetasks", kind: "tab", label: "Assigned" },
  { id: "issues", kind: "tab", label: "Report" },
  { id: "supplies", kind: "tab", label: "Supplies" },
  { id: "pickup", kind: "tab", label: "Pickup" },
  { id: "inspect", kind: "tab", label: "Inspect" },
  { id: "speakup", kind: "tab", label: "Speak Up" },
  { id: "settings", kind: "tab", label: "Settings" },
  { id: "forms", kind: "tab", label: "Forms" },
  { id: "profile", kind: "tab", label: "Profile" },
];

// One case per sheet, keyed by what discoverSheets finds.
const SHEET_CASES = [
  { id: "TextSizeButton#0", label: "Text size" },
  { id: "OCSAStaffPortal#0", label: "More" },
  { id: "MyScheduleSection#0", label: "Request time off" },
  { id: "MyScheduleSection#1", label: "One time off request" },
  { id: "MyScheduleSection#2", label: "Shift detail, with the drop form inside it" },
  { id: "ShortcutsSheet#0", label: "Shortcuts" },
  { id: "ShortcutsSheet#1", label: "Shortcuts, pick something for this spot" },
  { id: "ShortcutsSheet#2", label: "Shortcuts, start over" },
  { id: "NotificationsSheet#0", label: "Notifications" },
  { id: "FormFiller#0", label: "Report, send it" },
  { id: "FormFiller#1", label: "Report, leave it" },
  { id: "InspectView#0", label: "Inspect, schedule one" },
  { id: "HomeScreenPrompt#0", label: "Add to home screen" },
];

// Every form a person can fill in and send. Required fields are the ones
// the screen or the API refuses without.
const FORM_CASES = [
  { id: "signin", label: "Sign in", where: "Sign in", fields: "badge, phone or email (required); PIN (required)" },
  { id: "register", label: "Register", where: "Sign in", fields: "first name (required); last name; phone (required); email (required); PIN (required)" },
  { id: "forgot", label: "Forgot your PIN", where: "Sign in", fields: "badge, phone or email (required)" },
  { id: "activate", label: "Activate an account", where: "Activate", fields: "badge number (required when the row carries one); PIN (required); repeat PIN (required); language" },
  { id: "resetpin", label: "Reset a PIN", where: "Reset", fields: "PIN (required); repeat PIN (required)" },
  { id: "setpin", label: "Set your PIN", where: "Set your PIN", fields: "PIN (required); repeat PIN (required)" },
  { id: "changepin", label: "Change your PIN", where: "Settings", fields: "current PIN (required); new PIN (required); repeat PIN (required)" },
  { id: "timeoff", label: "Request time off", where: "Schedule", fields: "type (required, the API refuses an empty one); first day (required); last day (required); part of the day; from and to; hours; reason" },
  { id: "dropshift", label: "Request to drop a shift", where: "Schedule", fields: "reason (required); specify the reason (required when Other); notes" },
  { id: "issue", label: "Report a problem", where: "Report", fields: "title (required); description; zone; severity; site (required when off shift); photo" },
  { id: "supplyusage", label: "Log supply usage", where: "Supplies", fields: "supply (required); quantity (required)" },
  { id: "supplyrequest", label: "Request supplies or report damaged gear", where: "Supplies", fields: "type (required); item name (required for new gear or a new supply); description; urgency" },
  { id: "resolvetask", label: "Resolve an assigned task", where: "Assigned", fields: "note (required); photo (required)" },
  { id: "speakup", label: "Speak Up", where: "Speak Up", fields: "who it is about; what happened (required)" },
  { id: "inspection", label: "Fill in an inspection", where: "Inspect", fields: "a score per item (required); notes per item; photos; overall notes" },
  { id: "scheduleinspection", label: "Schedule an inspection", where: "Inspect", fields: "template (required); site (required); date (required)" },
  { id: "profile", label: "Edit your profile", where: "Profile", fields: "address; city; state; zip; emergency contact name and phone; birthday" },
  { id: "incidentreport", label: "Fill in an incident report", where: "Forms", fields: "when (required); where (required); what happened (required); was anyone hurt (required); who else was there" },
  { id: "helpcomposer", label: "Ask Help", where: "Help", fields: "a question or a photo (one of the two required)" },
  { id: "chatcomposer", label: "Send a chat message", where: "Chat", fields: "a message (required)" },
  { id: "shortcuts", label: "Choose your shortcuts", where: "Shortcuts", fields: "four different tabs (all four required)" },
];

// Reconciles what the app has against what the suite drives.
function coverage() {
  const tabs = discoverTabs();
  const screens = discoverScreens();
  const sheets = discoverSheets();

  const wantScreens = screens.concat(tabs.filter(t => screens.indexOf(t) === -1));
  const haveScreens = SCREEN_CASES.map(c => c.id);
  const missingScreens = wantScreens.filter(id => haveScreens.indexOf(id) === -1);
  const strayScreens = haveScreens.filter(id => wantScreens.indexOf(id) === -1);

  const haveSheets = SHEET_CASES.map(c => c.id);
  const missingSheets = sheets.filter(s => haveSheets.indexOf(s.id) === -1);
  const straySheets = haveSheets.filter(id => sheets.map(s => s.id).indexOf(id) === -1);

  return {
    tabs: tabs, screens: screens, sheets: sheets,
    wantScreens: wantScreens,
    missingScreens: missingScreens, strayScreens: strayScreens,
    missingSheets: missingSheets, straySheets: straySheets,
  };
}

module.exports = { discoverTabs, discoverScreens, discoverSheets, coverage, SCREEN_CASES, SHEET_CASES, FORM_CASES };
