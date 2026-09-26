// The whole API, in one file, so the next build extends it in one place.
//
// Every value here is invented. No real person, site, badge, phone,
// email, form or message appears anywhere in this file.
//
// createStub(opts) returns { handle, state }. handle answers one request;
// state records every request the app made and holds the fixtures a case
// can change before or during a run.

const DAY = 24 * 60 * 60 * 1000;

// The suite's own clock: 9:30 PM on Thursday, October 1, 2026, in New
// York, which is already October 2 in UTC. A date read as UTC midnight
// shows a day early against this, which is the point of choosing it.
const NOW = new Date("2026-10-02T01:30:00Z");
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const iso = (ms) => new Date(ms).toISOString();

const PERSON = {
  id: "u-one", firstName: "Alex", lastName: "Tester", role: "custodian",
  badgeNumber: "4821", phone: "0000000000", email: "one@example.invalid",
};
const SECOND_PERSON = {
  id: "u-two", firstName: "Sam", lastName: "Second", role: "lead",
  badgeNumber: "4822", phone: "0000000001", email: "two@example.invalid",
};
const SITES = [
  { siteId: "site-north", siteName: "North Building" },
  { siteId: "site-south", siteName: "South Building" },
  { siteId: "site-west", siteName: "West Building" },
];

const LEAVE_TYPES = [
  { value: "paid_sick", label: "Paid sick leave" },
  { value: "unpaid", label: "Unpaid time off" },
  { value: "bereavement_personal", label: "Bereavement and personal" },
  { value: "jury_duty", label: "Jury duty" },
  { value: "military", label: "Military leave" },
];

// The four pick lists the portal reads from /api/lookups. Every label is
// English, the way the live API sends it, and every one is the English
// the portal's own fallback draws when no list arrives.
const pick = (slug, rows) => ({ slug: slug, values: rows.map((r, i) => Object.assign({ value: r[0], label: r[1], is_active: true, sort_order: i + 1 }, r[2] || {})) });
// The drop reasons carry one choice the portal's own table does not know,
// the way an admin can add one.
const LOOKUPS = [
  pick("drop_reasons", [["sick", "Sick"], ["personal", "Personal"], ["scheduling_conflict", "Scheduling Conflict"], ["emergency", "Emergency"], ["car_trouble", "Car trouble"], ["other", "Other", { show_other_input: true }]]),
  pick("issue_severities", [["low", "Low", { color: "#2ECC71" }], ["medium", "Medium", { color: "#F39C12" }], ["high", "High", { color: "#E74C3C" }]]),
  pick("request_types", [["refill", "Refill"], ["damage_report", "Damage Report"], ["new_gear", "New Gear"], ["new_supply", "New Supply"]]),
  pick("urgency_levels", [["normal", "Normal"], ["urgent", "Urgent", { color: "#E74C3C" }]]),
];
// Step 118 in the API sends a choice's own word as displayLabel, in the
// language the request asks for. The stub sends it on two: one the
// portal's table knows, and one it does not.
const DISPLAY_CHOICES = new Set(["emergency", "car_trouble"]);
const lookupsIn = (lang) => LOOKUPS.map(c => Object.assign({}, c, { values: c.values.map(v => (DISPLAY_CHOICES.has(v.value) ? Object.assign({}, v, { displayLabel: inLanguage(v.label, lang) }) : v)) }));

// --- the checklist -------------------------------------------------------
//
// Every active item at each site, the way GET /api/sites/:id/tasks
// answers when it is called plainly. Called with ?user_id=, it answers
// only the items a manager has linked to that person. Links are rows in
// task_assignments, and nothing writes one when a person joins a site or
// an item is added, so most people at most sites have none.
// building_name and floor_number are matched exactly, the way the API
// matches them, so an item with no building or no floor drops out when
// either is sent. Every row carries the four fields of its shift header,
// null where it has none, and the category code the live API sends on
// every item, which no screen should draw.
//
// Step 124 in the API answers each row's period and what the checklist
// day says about it (see "the checklist day" below). Two fields here are
// the stub's own and never served: every, how often an item of the day's
// own work repeats, and shown, false for an item the checklist day does
// not show today.
const TASK_ROW = { building_name: null, floor_number: null, zone: null, task_type: "standard", shift_label: null, block_label: null, anchor_time: null, block_sort_order: null, cims_category: "SD", period: "today", every: "daily" };
const taskRow = (o) => Object.assign({}, TASK_ROW, o);
const SITE_TASKS = {
  // Some people here are linked to particular items and most are not.
  // The open shift puts this person on Main Hall's second floor; the rest
  // are elsewhere on the site, and two carry no building and no floor.
  "site-north": [
    taskRow({ id: "task-1", label: "Wipe the entry doors and handles", zone: "Entrance", building_name: "Main Hall", floor_number: "2", priority: "high", has_details: true, description: "Work top to bottom." }),
    taskRow({ id: "task-2", label: "Empty every bin on the floor", zone: "Entrance", building_name: "Main Hall", floor_number: "2" }),
    taskRow({ id: "task-3", label: "Mop the corridor end to end", zone: "Corridor", building_name: "Main Hall", floor_number: "2" }),
    taskRow({ id: "task-4", label: "Restock paper towels and soap", zone: "Restroom", building_name: "Main Hall", floor_number: "2" }),
    // One with no zone, which the screen gathers under its own heading.
    taskRow({ id: "task-5", label: "Refill the sanitizer stands", building_name: "Main Hall", floor_number: "2" }),
    taskRow({ id: "task-6", label: "Dust the stair rails", zone: "Stairwell", building_name: "Main Hall", floor_number: "1" }),
    taskRow({ id: "task-7", label: "Sweep the loading dock", zone: "Loading dock", building_name: "Annex", floor_number: "1" }),
    taskRow({ id: "task-8", label: "Wipe down the lobby benches", zone: "Lobby" }),
    taskRow({ id: "task-9", label: "Check that the exit signs are lit" }),
  ],
  // A long list set out in shifts, with nobody linked to anything, served
  // in no useful order. The morning's restroom round comes twice, around
  // the midday block, so a block's name alone never says where it goes.
  // The two evening blocks share a sort order, so the time is what puts
  // one before the other. The last item has no shift at all.
  "site-south": [
    taskRow({ id: "s-8", label: "Turn off the hallway lights", zone: "Hallway", shift_label: "Evening", block_label: "Last round", anchor_time: "22:00:00", block_sort_order: 5 }),
    taskRow({ id: "s-11", label: "Wipe the restroom mirrors", zone: "Restroom", shift_label: "Morning", block_label: "Restroom round", anchor_time: "13:00:00", block_sort_order: 4 }),
    taskRow({ id: "s-3", label: "Wipe the front desk", zone: "Front desk", shift_label: "Morning", block_label: "Midday reset", anchor_time: "11:00:00", block_sort_order: 3 }),
    taskRow({ id: "s-6", label: "Mop the restroom floors", zone: "Restroom", shift_label: "Evening", block_label: "Closing walk", anchor_time: "18:30:00", block_sort_order: 5 }),
    taskRow({ id: "s-1", label: "Unlock the restroom doors", zone: "Restroom", shift_label: "Morning", block_label: "Opening walk", anchor_time: "06:00:00", block_sort_order: 1 }),
    taskRow({ id: "s-9", label: "Refill the hand soap", zone: "Restroom" }),
    taskRow({ id: "s-10", label: "Restock the restroom paper", zone: "Restroom", shift_label: "Morning", block_label: "Restroom round", anchor_time: "09:00:00", block_sort_order: 2 }),
    taskRow({ id: "s-5", label: "Sweep the main hallway", zone: "Hallway", shift_label: "Evening", block_label: "Closing walk", anchor_time: "18:00:00", block_sort_order: 5 }),
    taskRow({ id: "s-4", label: "Empty the break room bins", zone: "Break room", shift_label: "Morning", block_label: "Midday reset", anchor_time: "11:30:00", block_sort_order: 3 }),
    taskRow({ id: "s-7", label: "Lock up the restrooms", zone: "Restroom", shift_label: "Evening", block_label: "Last round", anchor_time: "21:30:00", block_sort_order: 5 }),
    taskRow({ id: "s-2", label: "Turn on the hallway lights", zone: "Hallway", shift_label: "Morning", block_label: "Opening walk", anchor_time: "06:30:00", block_sort_order: 1 }),
  ],
  // A list shaped like the busiest live one, smaller and invented: a day
  // shift and a night shift that runs past midnight, a block in each with
  // no time, work that repeats every week, every two weeks, every month,
  // every quarter and every season, an every other day item done
  // yesterday, one as needed, one the checklist day does not show, and
  // two items tied to no shift. Served in no useful order.
  "site-west": [
    taskRow({ id: "w-9", label: "Dust the window sills", zone: "Office", shift_label: "Night shift", block_label: "Office sweep", anchor_time: "21:00:00", block_sort_order: 7, period: "week" }),
    taskRow({ id: "w-24", label: "Sweep the entry mat", zone: "Entrance", shift_label: "Day shift", block_label: "Closing checks", anchor_time: "15:00:00", block_sort_order: 4 }),
    taskRow({ id: "w-2", label: "Wipe the restroom sinks", zone: "Restroom", shift_label: "Night shift", block_label: "Restroom Round 1", anchor_time: "19:00:00", block_sort_order: 6 }),
    taskRow({ id: "w-14", label: "Wash the outside windows", zone: "Outside", shift_label: "Night shift", block_label: "Deep clean", block_sort_order: 10, period: "season" }),
    taskRow({ id: "w-17", label: "Take out the recycling", zone: "Break room" }),
    taskRow({ id: "w-6", label: "Lock the side doors", zone: "Entrance", shift_label: "Night shift", block_label: "Late round", anchor_time: "01:30:00", block_sort_order: 9 }),
    taskRow({ id: "w-21", label: "Wipe the reception counter", zone: "Lobby", shift_label: "Day shift", block_label: "Opening checks", anchor_time: "07:30:00", block_sort_order: 1 }),
    taskRow({ id: "w-12", label: "Clean the light fixtures", zone: "Office", shift_label: "Night shift", block_label: "Office sweep", anchor_time: "21:00:00", block_sort_order: 7, period: "month" }),
    taskRow({ id: "w-4", label: "Vacuum the office carpet", zone: "Office", shift_label: "Night shift", block_label: "Office sweep", anchor_time: "21:00:00", block_sort_order: 7, every: "every_other_day" }),
    taskRow({ id: "w-15", label: "Clean up spills", zone: "Lobby", period: "as_needed" }),
    taskRow({ id: "w-1", label: "Check the restroom supplies", zone: "Restroom", shift_label: "Night shift", block_label: "Restroom Round 1", anchor_time: "19:00:00", block_sort_order: 6 }),
    taskRow({ id: "w-23", label: "Dust the picture frames", zone: "Lobby", shift_label: "Day shift", block_label: "Floor care", block_sort_order: 3, period: "week" }),
    taskRow({ id: "w-10", label: "Wash the trash cans", zone: "Break room", shift_label: "Night shift", block_label: "Deep clean", block_sort_order: 10, period: "week" }),
    taskRow({ id: "w-5", label: "Wipe the elevator buttons", zone: "Elevator", shift_label: "Night shift", block_label: "Common areas", anchor_time: "23:00:00", block_sort_order: 8, every: "per_visit" }),
    taskRow({ id: "w-30", label: "Clean the break room fridge", zone: "Break room", shift_label: "Night shift", block_label: "Office sweep", anchor_time: "21:00:00", block_sort_order: 7, period: "week", shown: false }),
    taskRow({ id: "w-20", label: "Open the blinds", zone: "Office", shift_label: "Day shift", block_label: "Opening checks", anchor_time: "07:30:00", block_sort_order: 1 }),
    taskRow({ id: "w-16", label: "Polish the lobby brass", zone: "Lobby", shift_label: "Night shift", block_label: "Late round", anchor_time: "01:30:00", block_sort_order: 9, every: "every_other_day" }),
    taskRow({ id: "w-11", label: "Scrub the grout in the restrooms", zone: "Restroom", shift_label: "Night shift", block_label: "Restroom Round 1", anchor_time: "19:00:00", block_sort_order: 6, period: "biweekly" }),
    taskRow({ id: "w-22", label: "Mop the lobby floor", zone: "Lobby", shift_label: "Day shift", block_label: "Lobby reset", anchor_time: "11:00:00", block_sort_order: 2 }),
    taskRow({ id: "w-13", label: "Wipe the air vents", zone: "Office", shift_label: "Night shift", block_label: "Deep clean", block_sort_order: 10, period: "quarter" }),
    taskRow({ id: "w-3", label: "Empty the office bins", zone: "Office", shift_label: "Night shift", block_label: "Office sweep", anchor_time: "21:00:00", block_sort_order: 7 }),
  ],
};
// The order a person on the morning shift reads South Building's list in,
// written out by hand: the shift, each block under it, each item under its
// block, and the item tied to no shift last.
const SHIFT_ORDER = [
  "Morning", "Opening walk", "s-1", "s-2", "Restroom round", "s-10",
  "Midday reset", "s-3", "s-4", "Restroom round", "s-11",
  "s-9",
];
// Where an open shift at each site puts the person.
const OPEN_SHIFT = {
  "site-north": { siteId: "site-north", siteName: "North Building", buildingName: "Main Hall", floorNumber: "2" },
  "site-south": { siteId: "site-south", siteName: "South Building", buildingName: null, floorNumber: null },
  "site-west": { siteId: "site-west", siteName: "West Building", buildingName: null, floorNumber: null },
};
// The shift an open session carries when a case says nothing. North
// Building has no shifts. The session at South Building was started on
// the morning shift. The one at West Building carries none yet, which is
// what the screen asks about.
const SESSION_SHIFT = { "site-north": null, "site-south": "Morning", "site-west": null };
// The person a case signs in as is linked to six items at North
// Building, one of them with no building or floor. Nobody else is.
const LINKS = { "u-one": ["task-1", "task-2", "task-3", "task-4", "task-5", "task-8"] };
// Step 118 in the API sends each checklist item's own words as display:
// { label, description, zone }, in the language the request asks for.
// The stub sends them on these two and leaves them off the rest, so a
// screen is seen drawing both.
const DISPLAYED = new Set(["task-1", "task-8"]);
const inLanguage = (en, lang) => (en && lang === "es" && TWIN_ES.has(en) ? TWIN_ES.get(en) : en);
const displayOf = (row, lang) => ({ label: inLanguage(row.label, lang), description: row.description ? inLanguage(row.description, lang) : null, zone: row.zone ? inLanguage(row.zone, lang) : null });
// An item's words as a screen in one language should draw them.
const taskWords = (id, lang) => {
  const row = [].concat(...Object.keys(SITE_TASKS).map(k => SITE_TASKS[k])).find(r => r.id === id);
  if (!row) return { label: id, description: null, zone: null };
  return DISPLAYED.has(id) ? displayOf(row, lang) : { label: row.label, description: row.description || null, zone: row.zone };
};
// The people who check things off besides the one a case signs in as,
// by the first name the API sends with each check.
const FIRST_NAMES = { "u-one": "Alex", "u-two": "Sam", "u-three": "Robin" };
// Checked off. With no time a check was made today, a minute before the
// stub's clock. The rest are at West Building on the days they name, on
// the company's clock: Monday September 28, Tuesday September 29,
// Wednesday September 30, which is yesterday, and September 3.
const COMPLETIONS = [
  { taskId: "task-1", userId: "u-one" },
  { taskId: "task-2", userId: "u-three" },
  { taskId: "s-5", userId: "u-three" },
  { taskId: "w-1", userId: "u-one" },
  { taskId: "w-2", userId: "u-three" },
  { taskId: "w-12", userId: "u-two" },
  { taskId: "w-21", userId: "u-two" },
  { taskId: "w-9", userId: "u-two", at: Date.parse("2026-09-28T23:00:00Z") },
  { taskId: "w-11", userId: "u-one", at: Date.parse("2026-09-30T00:30:00Z") },
  { taskId: "w-4", userId: "u-two", at: Date.parse("2026-09-30T00:10:00Z") },
  { taskId: "w-16", userId: "u-two", at: Date.parse("2026-10-01T02:00:00Z") },
  { taskId: "w-14", userId: "u-three", at: Date.parse("2026-09-03T23:00:00Z") },
];
// The category code the live API sends on every checklist item, on an
// assigned task and on an inspection's items. It is a certification
// category, and no screen should ever draw it.
const CATEGORY_CODES = ["SD"];

// --- the checklist day ---------------------------------------------------
//
// Step 124 in the API: the checklist day starts at 4:00 AM on the
// company's clock, New York's, so a check made after midnight stays with
// the night it belongs to. A per visit or daily item shown today is due,
// and so is an every other day item shown today that nobody checked the
// checklist day before. Only due items count in the day's numbers. Work
// that repeats every week, every two weeks, every month, every quarter or
// every season stays on the list until anyone at the site does it in its
// period, and as needed work is never counted.
const ZONE = "America/New_York";
const DAY_STARTS_HOUR = 4;
const PERIODS = ["week", "biweekly", "month", "quarter", "season"];
const zoneFormat = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const zoneParts = (ms) => {
  const p = {};
  zoneFormat.formatToParts(new Date(ms)).forEach((x) => { p[x.type] = Number(x.value); });
  return p;
};
// The checklist day an instant falls on, counted in days since 1970.
const checklistDay = (ms) => { const p = zoneParts(ms - DAY_STARTS_HOUR * 3600 * 1000); return Math.round(Date.UTC(p.year, p.month - 1, p.day) / DAY); };
// A day's period, as a number that is the same for every day in it.
// Weeks start on Monday; every two weeks is counted from a Monday; the
// seasons are the three month ones, winter taking December.
const periodOf = (period, day) => {
  const d = new Date(day * DAY), y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (period === "week") return Math.floor((day + 3) / 7);
  if (period === "biweekly") return Math.floor((day + 3) / 14);
  if (period === "month") return y * 12 + m;
  if (period === "quarter") return y * 4 + Math.floor(m / 3);
  return (m === 11 ? y + 1 : y) * 4 + (m === 11 || m < 2 ? 0 : m < 5 ? 1 : m < 8 ? 2 : 3);
};
// A time of day written HH:MM:SS, as seconds, and back.
const secondsOf = (hms) => { const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(hms || "")); return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0) : null; };
const clockOf = (s) => { const x = ((s % 86400) + 86400) % 86400; return [Math.floor(x / 3600), Math.floor((x % 3600) / 60), x % 60].map(n => String(n).padStart(2, "0")).join(":"); };

// A site's shifts, the way every session answer carries them: none at a
// site with fewer than two, and otherwise one per shift in label order,
// each with its blocks and the hours they span. A block's time is its
// earliest item's. The window opens an hour before the first timed block
// and ends at the last; a shift with no timed block has none. The shift
// suggested is the one whose window holds the session's start, or opens
// next after it, and none when no shift has a time.
function shiftsFor(siteId, startMs) {
  const rows = SITE_TASKS[siteId] || [];
  const labels = Array.from(new Set(rows.map(r => r.shift_label).filter(Boolean))).sort();
  if (labels.length < 2) return [];
  const list = labels.map((label) => {
    const blocks = [];
    rows.filter(r => r.shift_label === label && r.block_label).forEach((r) => {
      let b = blocks.find(x => x.label === r.block_label && x.order === r.block_sort_order);
      if (!b) { b = { label: r.block_label, displayLabel: r.block_label, time: null, order: r.block_sort_order }; blocks.push(b); }
      if (r.anchor_time && (b.time === null || secondsOf(r.anchor_time) < secondsOf(b.time))) b.time = r.anchor_time;
    });
    blocks.sort((a, b) => a.order - b.order || (secondsOf(a.time) === null ? 1 : secondsOf(b.time) === null ? -1 : secondsOf(a.time) - secondsOf(b.time)));
    const timed = blocks.filter(b => b.time !== null);
    const window = timed.length === 0 ? null : {
      opensAt: clockOf(secondsOf(timed[0].time) - 3600),
      startsAt: timed[0].time,
      endsAt: timed[timed.length - 1].time,
      crossesMidnight: secondsOf(timed[timed.length - 1].time) < secondsOf(timed[0].time),
    };
    return { label: label, displayLabel: label, suggested: false, window: window, blocks: blocks };
  });
  const p = zoneParts(startMs);
  const at = p.hour * 3600 + p.minute * 60 + p.second;
  const holds = (w) => {
    const from = secondsOf(w.opensAt), to = secondsOf(w.endsAt);
    return from <= to ? at >= from && at <= to : at >= from || at <= to;
  };
  const withTime = list.filter(s => s.window);
  const gap = (s) => (secondsOf(s.window.opensAt) - at + 86400) % 86400;
  const pick = withTime.find(s => holds(s.window)) || withTime.slice().sort((a, b) => gap(a) - gap(b))[0];
  if (pick) pick.suggested = true;
  return list;
}

// One scheduled inspection and the items it asks about. The template's
// name, each item and each item's zone are English, the way the live API
// sends them.
const INSPECTION = {
  id: "in-1", template_name: "Lobby walk", site_name: "North Building", scheduled_date: "2026-10-02", status: "scheduled",
  items: [
    { id: "it-1", label: "Glass doors are free of smudges", zone: "Lobby", max_score: 5, cims_category: "SD" },
    { id: "it-2", label: "Floor mats are straight and dry", zone: "Lobby", max_score: 5, cims_category: "SD" },
  ],
};
// One on the list that the API no longer has when it is opened.
const INSPECTION_GONE = { id: "in-gone", template_name: "Stairwell walk", site_name: "North Building", scheduled_date: "2026-10-02", status: "scheduled", gone: true };

// --- Help ----------------------------------------------------------------
//
// Help's answers, each written in the pieces the streaming route sends,
// cut wherever the writing happened to be: in the middle of a word, and in
// the middle of a bold phrase, marks and all. Joined, the pieces are the
// reply the message route sends whole. Every key besides the pieces is a
// key of that reply, the way the API sends it.
const HELP_ANSWERS = {
  // The one every question gets unless a case asks for another.
  pads: { pieces: ["Take the pa", "ds from the se", "cond floor store", " room."] },
  // A bold phrase cut in two, its opening marks cut in two as well, and
  // numbered steps, citing a procedure and working from the written one.
  spill: {
    pieces: ["Put a *", "*wet fl", "oor sign** by the spill", " first.\n1. Wipe up wh", "at you can with paper tow", "els.\n2. Mop the spot with", " the blue mop from the clo", "set."],
    // The same answer in Spanish, cut the same way, for a reading that
    // asks for it. A letter with an accent is cut through its bytes.
    piecesEs: ["Ponga primero un *", "*letrero de pi", "so mojado** junto al", " derrame.\n1. Limpie lo q", "ue pueda con toallas de pa", "pel.\n2. Trapee el \u00e1r", "ea con el trapeador azul del cua", "rto de limpieza."],
    citedDocs: ["Spill response"], degraded: true,
  },
  // One that starts a report, the way an answer opens a form today.
  report: {
    pieces: ["I started an incid", "ent report for you. Tell me wh", "en it happened."],
    formResponse: { id: "draft-one", formCode: "OCSA-FIX-101", formName: "Incident report", status: "draft", answered: 1, remaining: 4, nextQuestion: "When did it happen" },
  },
  // One with no written procedure behind it.
  unknown: { pieces: ["I do not have a writ", "ten procedure for that. Ask your super", "visor."], noProcedure: true },
  // The first try at an answer the API throws away and writes again.
  firstTry: { pieces: ["Mop the spill right aw", "ay with any mop."] },
};
const helpReply = (a) => a.pieces.join("");
// The refusals a case can ask Help for, each a sentence the API writes.
const HELP_REFUSALS = {
  busy: { status: 429, error: "Too many questions at once. Wait a minute and ask again." },
  unfinished: { status: 502, error: "The answer could not be finished. Ask again." },
};
// One answer cut into n pieces of about the same length, for a reading
// that wants a set number of them.
const cutInto = (text, n) => {
  const out = [];
  const size = Math.ceil(text.length / n);
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
};

// Every refusal Change PIN can answer with, by its code, in English and in
// Spanish. Since Step 137 the API writes the sentence in the request's
// language, ?locale= first and the account's after it; the code is the
// same in both.
const PIN_REFUSALS = {
  PIN_INCORRECT: ["Current PIN is incorrect", "El PIN actual no es correcto"],
  PIN_UNCHANGED: ["New PIN must be different from the current PIN", "El PIN nuevo debe ser distinto del actual"],
  PIN_WEAK: ["New PIN is too easy to guess", "El PIN nuevo es muy f\u00e1cil de adivinar"],
  PIN_FORMAT: ["New PIN must be exactly 4 digits", "El PIN nuevo debe tener exactamente 4 d\u00edgitos"],
};

// Every refusal the time off routes can answer with, in the order the
// Step 79 contract lists them. The suite shows each one word for word.
// Each carries the API's own key as its code, the way Step 137 answers,
// and extra is what the API sends beside it.
const TIME_OFF_REFUSALS = [
  { status: 400, error: "Choose a type of time off", code: "timeOff.typeRequired" },
  { status: 400, error: "Dates must be YYYY-MM-DD", code: "timeOff.datesFormat" },
  { status: 400, error: "The last day cannot be before the first day", code: "timeOff.lastBeforeFirst" },
  { status: 400, error: "A part day needs both a start and an end time, on one day", code: "timeOff.partDay" },
  { status: 400, error: "Times must be HH:MM, from 00:00 to 23:59", code: "timeOff.timesFormat" },
  { status: 400, error: "Hours must be a number from 0 to 999.99", code: "timeOff.hoursRange" },
  { status: 400, error: "Time off can start at most 30 days ago", code: "timeOff.tooFarBack" },
  { status: 400, error: "Time off can start at most one year ahead", code: "timeOff.tooFarAhead" },
  { status: 400, error: "Keep the reason to 1000 characters or fewer.", code: "timeOff.reasonTooLong" },
  { status: 404, error: "Request not found", code: "timeOff.notFound" },
  { status: 409, error: "You already have time off requested or approved for those days", code: "timeOff.overlap", extra: { requestId: "to-clash" } },
  { status: 409, error: "This request was already approved", code: "timeOff.alreadyStatus", extra: { status: "approved" } },
  { status: 409, error: "This request was already denied", code: "timeOff.alreadyStatus", extra: { status: "denied" } },
  { status: 409, error: "This request was already cancelled", code: "timeOff.alreadyStatus", extra: { status: "cancelled" } },
];

const timeOffRow = (o) => Object.assign({
  id: "to-one", userId: PERSON.id, userName: "Alex Tester",
  leaveType: "paid_sick", leaveTypeLabel: "Paid sick leave",
  startsOn: "2026-10-05", endsOn: "2026-10-05",
  startTime: null, endTime: null, partDay: false,
  hours: null, reason: null, status: "requested",
  decidedBy: null, decidedByName: null, decidedAt: null, decisionNote: null,
  cancelledAt: null, createdAt: iso(NOW.getTime() - DAY), updatedAt: iso(NOW.getTime() - DAY),
  shifts: [],
}, o || {});

// One incident report, enough fields to walk a person through it and to
// refuse a submit with one still missing. Its words are written here in
// English and served in the language the request asks for, the way the
// real catalog serves every form.
const FORM = {
  code: "OCSA-FIX-101",
  title: "Incident report",
  fields: [
    { key: "when", label: "When did it happen", type: "date", section: "What happened", required: true },
    { key: "where", label: "Where did it happen", type: "text", section: "What happened", required: true },
    { key: "what", label: "Describe what happened", type: "textarea", section: "What happened", required: true },
    { key: "hurt", label: "Was anyone hurt", type: "select", section: "People", required: true, options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }] },
    { key: "who", label: "Who else was there", type: "text", section: "People", required: false },
  ],
};

function makeState(opts) {
  const o = opts || {};
  return {
    // Every request the app made, newest last.
    calls: [],
    // Every request that did not say its language once, as ?locale= with
    // en or es, and what was wrong with it. See localeFault below.
    localeFaults: [],
    // Every name the stub has served. A Spanish screen showing one of
    // these is showing a value, not a word the app forgot to translate.
    served: new Set(),
    // Every word it has served, by the value sent, with both twins and
    // its kind, and every code. See "names, words and codes" below.
    words: new Map(),
    codes: new Set(),
    // The account asks for a new PIN before anything else, and an
    // activation link whose row carries a badge number.
    mustSetPin: !!o.mustSetPin,
    activationBadge: !!o.activationBadge,
    // Flip these from a case to make a route answer differently.
    refuse: o.refuse || {},          // "POST /api/time-off": { status, body }, { chat: code } or { api: key }
    offline: false,                  // every call fails at the network
    person: o.person || PERSON,
    accountPreferences: o.accountPreferences === undefined ? {} : o.accountPreferences,
    clockedIn: o.clockedIn !== false,
    // The code the next Change PIN is turned away with, once.
    pinRefusal: null,
    // The open shift's site, who is linked to what, and every check made
    // today. A check made on one phone is seen on another through here.
    site: o.site || "site-north",
    links: o.links || LINKS,
    completions: (o.completions || COMPLETIONS).map(c => Object.assign({}, c)),
    // Step 124: the stub's own clock, which a case can move, the shift the
    // open session carries, and when that session started. It started
    // three hours before the clock unless a case says otherwise.
    now: o.now ? new Date(o.now).getTime() : null,
    shiftLabel: o.shiftLabel !== undefined ? o.shiftLabel : (SESSION_SHIFT[o.site || "site-north"] || null),
    sessionStartedAt: o.sessionStartedAt ? new Date(o.sessionStartedAt).getTime() : (o.now ? new Date(o.now).getTime() : NOW.getTime()) - 3 * 60 * 60 * 1000,
    schedule: o.schedule || null,
    timeOffTypesLive: o.timeOffTypesLive !== false,
    myTimeOff: o.myTimeOff || [],
    drafts: o.drafts || [],
    notifications: o.notifications || [],
    inspections: o.inspections || [],
    conversationId: "cv-one",
    // Help: what the next question is answered with, the points the one
    // being answered can be stopped at, and the conversation as the API
    // keeps it. See helpPlay below.
    help: { next: null, holds: {}, asked: 0 },
    stored: [],
    uploadsFail: false,
    prefsPatches: [],
    // The second form's answers, and the sign-offs stamped on it.
    answersP: o.answersP ? Object.assign({}, o.answersP) : {},
    // The form with titled sections, served when a case asks, and its
    // answers.
    sectionsForm: !!o.sectionsForm,
    answersS: {},
    // Everyone Speak Up can name, and every report filed through it.
    staff: o.staff || STAFF.slice(),
    filed: [],
    // Routes a case has asked to drop at the network, by "METHOD /path".
    // once drops only the next one.
    drop: o.drop || {},
    // Chat. o.chat, all optional:
    //   privates   how many staff private chats an admin's list carries,
    //              six by default and at most twenty
    //   ownPrivate an admin's list ends with a private chat of their own,
    //              the one an admin has when it was made before
    //   only       the one chat the list holds
    //   empty      the list comes back empty
    //   oddRows    the site chat holds rows missing a field
    // and, flipped from a case: holdMs holds each send's answer that long;
    // saveThenDrop keeps the next send and then drops its connection;
    // noMessage answers the next send 201 with no message in it.
    chat: chatStateOf(o),
  };
}

function chatStateOf(o) {
  const c = o.chat || {};
  const person = o.person || PERSON;
  const admin = person.role === "admin" || person.role === "supervisor";
  const privates = Math.max(0, Math.min(CHAT_STAFF.length, c.privates === undefined ? 6 : c.privates));
  const ownSite = CHAT_SITES.find(s => s.siteId === (o.site || "site-north")) || CHAT_SITES[0];
  const own = { id: "dm-" + person.id, type: "admin_dm", name: OWN_PRIVATE, unreadCount: 1 };
  let channels = admin
    ? CHAT_SITES.concat([CHAT_GENERAL]).sort((a, b) => a.name.localeCompare(b.name)).concat(CHAT_STAFF.slice(0, privates).map(staffPrivate), c.ownPrivate ? [own] : [])
    : [ownSite, CHAT_GENERAL].sort((a, b) => a.name.localeCompare(b.name)).concat([own]);
  if (c.only) channels = channels.filter(ch => ch.id === c.only);
  if (c.empty) channels = [];
  const messages = {};
  channels.forEach((ch) => { messages[ch.id] = chatSeed(ch.id, !!c.oddRows); });
  return { channels: channels.map(ch => Object.assign({ unreadCount: 0 }, ch)), messages: messages, seq: 0, holdMs: 0, saveThenDrop: false, noMessage: false };
}


// A second form, invented like everything else here, carrying the three
// parts Step 101 taught the API: a checklist of fixed rows, a table a
// person adds rows to, and a sign-off. Served in the language the
// request asks for, the way the real catalog is.
const FORM_P_CODE = "TEST-FORM-P";
const FORM_P_WORDS = {
  en: {
    title: "Site walk",
    walk: "The walk", areas: "Every area", rooms: "Rooms", signIt: "Sign it",
    day: "What day did you walk it", start: "What time did you start",
    where: "Where did you start", notes: "Anything worth adding",
    shift: "Which shift", shiftDay: "Day", shiftEvening: "Evening",
    carried: "What did you carry", cart: "Cart", vacuum: "Vacuum", ladder: "Ladder",
    check: "Check each area", result: "Result", pass: "Pass", fail: "Fail", note: "Note",
    hallway: "Hallway", restroom: "Restroom", entry: "Entry",
    visits: "Rooms you entered", visitDay: "Date", visitAt: "Time", room: "Room",
    lead: "Crew lead", manager: "Area manager",
  },
  es: {
    title: "Recorrido del sitio",
    walk: "El recorrido", areas: "Cada area", rooms: "Cuartos", signIt: "Firme",
    day: "Que dia lo recorrio", start: "A que hora empezo",
    where: "Donde empezo", notes: "Algo mas que agregar",
    shift: "Cual turno", shiftDay: "Dia", shiftEvening: "Tarde",
    carried: "Que llevo", cart: "Carro", vacuum: "Aspiradora", ladder: "Escalera",
    check: "Revise cada area", result: "Resultado", pass: "Aprobado", fail: "Falla", note: "Nota",
    hallway: "Pasillo", restroom: "Bano", entry: "Entrada",
    visits: "Cuartos en los que entro", visitDay: "Fecha", visitAt: "Hora", room: "Cuarto",
    lead: "Lider de equipo", manager: "Gerente de area",
  },
};
// Rows the checklist asks about, and the row a table somebody added is
// named by when it is short an answer.
const FORM_P_ROWS = ["hallway", "restroom", "entry"];
const ROW_WORD = { en: "Row", es: "Fila" };

function formP(lang) {
  const w = FORM_P_WORDS[lang === "es" ? "es" : "en"];
  return {
    code: FORM_P_CODE,
    title: w.title,
    fields: [
      { key: "day", label: w.day, type: "date", section: w.walk, required: true },
      { key: "start", label: w.start, type: "time", section: w.walk, required: true },
      { key: "where", label: w.where, type: "text", section: w.walk, required: true },
      { key: "notes", label: w.notes, type: "textarea", section: w.walk, required: false },
      { key: "shift", label: w.shift, type: "select", section: w.walk, required: true,
        options: [{ value: "day", label: w.shiftDay }, { value: "evening", label: w.shiftEvening }] },
      { key: "carried", label: w.carried, type: "multiselect", section: w.walk, required: false,
        options: [{ value: "cart", label: w.cart }, { value: "vacuum", label: w.vacuum }, { value: "ladder", label: w.ladder }] },
      // A checklist: the rows are the form's, and a person answers each one.
      { key: "check", label: w.check, type: "grid", section: w.areas, required: true,
        columns: [
          { key: "result", label: w.result, type: "select", required: true,
            options: [{ value: "pass", label: w.pass }, { value: "fail", label: w.fail }] },
          { key: "note", label: w.note, type: "text", required: false },
        ],
        rows: FORM_P_ROWS.map(k => ({ key: k, label: w[k] })) },
      // A table a person adds rows to, one to three of them.
      { key: "visits", label: w.visits, type: "grid", section: w.rooms, required: true,
        columns: [
          { key: "day", label: w.visitDay, type: "date", required: true },
          { key: "at", label: w.visitAt, type: "time", required: true },
          { key: "room", label: w.room, type: "text", required: true },
        ],
        rows: null, minRows: 1, maxRows: 3 },
      // The one the person filing makes, and one that belongs to the
      // supervisor half and is never drawn on the portal.
      { key: "leadSign", label: w.lead, type: "signoff", section: w.signIt, signer: "filer", required: true },
      { key: "managerSign", label: w.manager, type: "signoff", section: w.signIt, signer: "area_manager" },
    ],
  };
}

// What is still short an answer on the second form, as the API says it:
// the keys, and for each one a label, with a grid's incomplete rows
// named after it.
function formPMissing(answers, lang) {
  const form = formP(lang);
  const w = FORM_P_WORDS[lang === "es" ? "es" : "en"];
  const out = [];
  form.fields.forEach((f) => {
    if (!f.required) return;
    const v = answers[f.key];
    if (f.type === "grid" && Array.isArray(f.rows)) {
      const rows = f.rows.filter((r) => {
        const cells = (v && typeof v === "object" ? v[r.key] : null) || {};
        return f.columns.some(c => c.required && !cells[c.key]);
      }).map(r => r.label);
      if (rows.length > 0) out.push({ key: f.key, label: f.label, rows: rows });
      return;
    }
    if (f.type === "grid") {
      const list = Array.isArray(v) ? v : [];
      const rows = [];
      if (list.length < (f.minRows || 0)) rows.push(ROW_WORD[lang === "es" ? "es" : "en"] + " " + (list.length + 1));
      list.forEach((cells, i) => {
        if (f.columns.some(c => c.required && !(cells || {})[c.key])) rows.push(ROW_WORD[lang === "es" ? "es" : "en"] + " " + (i + 1));
      });
      if (rows.length > 0) out.push({ key: f.key, label: f.label, rows: rows });
      return;
    }
    if (f.type === "signoff") { if (!v) out.push({ key: f.key, label: f.label }); return; }
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) out.push({ key: f.key, label: f.label });
  });
  return out;
}

function draftP(state, lang) {
  const form = formP(lang);
  const answers = state.answersP;
  const answered = form.fields.filter(f => answers[f.key] !== undefined && answers[f.key] !== null && answers[f.key] !== "").length;
  const missingFields = formPMissing(answers, lang);
  return {
    id: "draft-two", formCode: form.code, formName: form.title,
    answers: Object.assign({}, answers),
    status: "draft", answered: answered, remaining: form.fields.length - answered,
    missing: missingFields.map(m => m.key), missingFields: missingFields,
  };
}

// A third form, invented, whose sections carry titles the way a key in
// the catalog would send them, since the live API keeps them in its
// definitions and sends none yet. Section keys are the API's own kind,
// "1" to "3". The first two have a title, in the language the request
// asks for, and the third has none. Served only to a case that asks for
// it with stubOptions.sectionsForm, so every other case reads the
// catalog it always has.
const FORM_S_CODE = "TEST-FORM-S";
const FORM_S_WORDS = {
  en: {
    title: "Closing check", first: "Before you lock up", second: "The supply room",
    doors: "Which doors did you lock", lights: "Are the lights off", yes: "Yes", no: "No",
    low: "What is running low", notes: "Anything else to report",
  },
  es: {
    title: "Revision de cierre", first: "Antes de cerrar", second: "El cuarto de suministros",
    doors: "Que puertas cerro", lights: "Estan apagadas las luces", yes: "Si", no: "No",
    low: "Que se esta acabando", notes: "Algo mas que reportar",
  },
};

function formS(lang) {
  const w = FORM_S_WORDS[lang === "es" ? "es" : "en"];
  const field = (key, type, section, required, options) => ({
    key: key, label: w[key], type: type, required: required, osha: false, prefilled: false,
    options: options || [], appliesWhen: null, help: null, section: section,
  });
  return {
    code: FORM_S_CODE,
    title: w.title,
    version: 1,
    sections: [{ key: "1", title: w.first }, { key: "2", title: w.second }],
    fields: [
      field("doors", "text", "1", true),
      field("lights", "select", "1", true, [{ value: "yes", label: w.yes }, { value: "no", label: w.no }]),
      field("low", "text", "2", false),
      field("notes", "textarea", "3", false),
    ],
  };
}

function draftS(state, lang) {
  const form = formS(lang);
  const answers = state.answersS;
  const answered = form.fields.filter(f => answers[f.key] !== undefined && answers[f.key] !== null && answers[f.key] !== "").length;
  return {
    id: "draft-three", formCode: form.code, formName: form.title,
    answers: Object.assign({}, answers),
    status: "draft", answered: answered, remaining: form.fields.length - answered,
    missing: form.fields.filter(f => f.required && !answers[f.key]).map(f => f.key),
  };
}

// Everyone the Speak Up picker can offer, invented, each one a first and
// a last name, sorted by last name then first name the way the route
// sorts them. The signed in person is not among them, because the route
// leaves the caller out.
// The API's own words when it turns a report away, each one a 400. The
// route below answers with them, and the cases ask for them by name, so
// the suite never invents a sentence the API does not say.
const HR_CASE_REFUSALS = [
  "Say whether this is about someone in management",
  "Pick at least one person this is about",
  "You cannot pick yourself",
  "One of the people picked is not on the staff list",
  "Pick up to 10 people",
];

const STAFF = [
  { id: "s-01", firstName: "Ana", lastName: "Alvarez" },
  { id: "s-02", firstName: "Ben", lastName: "Brooks" },
  { id: "s-03", firstName: "Carla", lastName: "Castro" },
  { id: "s-04", firstName: "Dan", lastName: "Delgado" },
  { id: "s-05", firstName: "Eve", lastName: "Everett" },
  { id: "s-06", firstName: "Femi", lastName: "Fisher" },
  { id: "s-07", firstName: "Gina", lastName: "Gomez" },
  { id: "s-08", firstName: "Hal", lastName: "Hunter" },
  { id: "s-09", firstName: "Ida", lastName: "Ibarra" },
  { id: "s-10", firstName: "Jon", lastName: "Jenkins" },
  { id: "s-11", firstName: "Kay", lastName: "Kowalski" },
  { id: "s-12", firstName: "Luis", lastName: "Lozano" },
];

// --- Chat, as Scout 138 read and ran it, and as Step 132 left it ----------
//
// GET /api/chat/channels answers an array: the site and general chats,
// sorted by name, then the private chats. An admin sees every site chat,
// every general chat and every staff member's private chat, each named
// for that person with staffUserId, lastMessage and lastMessageAt, and has
// no private chat of their own unless one was made before. Everyone else
// sees their site's chat, the general chat and their own private chat,
// which the API names the literal "Admin (Private)" and gives no
// staffUserId. The caller's own private chat comes last. Messages come
// back oldest first, the newest 50. A send answers 201 with the message,
// its text trimmed. Every refusal carries a code beside error, and error
// is in the request's language, ?locale= first and then the account's.
const ADMIN_PERSON = {
  id: "u-admin", firstName: "Jordan", lastName: "Office", role: "admin",
  badgeNumber: "4800", phone: "0000000009", email: "office@example.invalid",
};
const CHAT_GENERAL = { id: "ch-all", type: "general", name: "All staff", siteName: null, siteId: null };
const CHAT_SITES = [
  ["ch-north", "North Building", "site-north"], ["ch-south", "South Building", "site-south"],
  ["ch-west", "West Building", "site-west"], ["ch-east", "East Annex", "site-east"],
  ["ch-harbor", "Harbor Point", "site-harbor"], ["ch-lake", "Lakeside Hall", "site-lake"],
  ["ch-maple", "Maple Court", "site-maple"], ["ch-river", "River Terrace", "site-river"],
].map(([id, name, siteId]) => ({ id: id, type: "site", name: name, siteName: name, siteId: siteId }));
// Twenty invented people with a private chat, the first eight of them
// with long names, the way a real list has a few.
const CHAT_STAFF = STAFF.map(p => ({ id: p.id, name: p.firstName + " " + p.lastName })).concat([
  { id: "s-13", name: "Maria Guadalupe Villanueva Echeverria" },
  { id: "s-14", name: "Nate Nolan" },
  { id: "s-15", name: "Olga Ortiz" },
  { id: "s-16", name: "Pat Price" },
  { id: "s-17", name: "Quinn Quintero Castellanos" },
  { id: "s-18", name: "Rosa Ramos" },
  { id: "s-19", name: "Tom Tran" },
  { id: "s-20", name: "Uma Underwood" },
]);
const OWN_PRIVATE = "Admin (Private)";
// Each staff member's private chat as an admin's list carries it: some
// with unread messages, most with a last message at some hour before
// the suite's clock, and every fifth never written in.
const staffPrivate = (p, i) => ({
  id: "dm-" + p.id, type: "admin_dm", name: p.name, staffUserId: p.id,
  lastMessage: i % 5 === 4 ? null : "An invented note " + (i + 1),
  lastMessageAt: i % 5 === 4 ? null : iso(NOW.getTime() - ((i * 7) % 23 + 1) * 60 * 60 * 1000),
  unreadCount: i % 4 === 1 ? (i % 3) + 1 : 0,
});
// Chat's refusals as Step 132 writes them, one per code, in each
// language. A read can get the first two, and a send any of the four.
const CHAT_TEXT_MAX = 2000;
const CHAT_REFUSALS = {
  "chat.notFound": { status: 404, en: "This chat was not found.", es: "No se encontr\u00f3 este chat." },
  "chat.noAccess": { status: 403, en: "You do not have access to this chat.", es: "No tiene acceso a este chat." },
  "chat.textRequired": { status: 400, en: "Type a message first.", es: "Escriba un mensaje primero." },
  "chat.textTooLong": { status: 400, en: "This message is too long. Keep it to 2000 characters or fewer.", es: "Este mensaje es demasiado largo. Use 2000 caracteres o menos." },
};
const CHAT_SEND_REFUSALS = Object.keys(CHAT_REFUSALS).map(code => Object.assign({ code: code }, CHAT_REFUSALS[code]));
// The refusals a send got before Step 132, English with no code. An API
// that answers this way still gets the portal's own line.
const CHAT_UNCODED_REFUSALS = [
  { status: 400, error: "Message text is required" },
  { status: 403, error: "Access denied to this channel" },
  { status: 404, error: "Channel not found" },
  { status: 500, error: "Server error" },
];
// Three refusals a cleaner meets, as Step 137 writes them, under the API's
// own key, quoted from helpers/words.js in ocsa-api: a time off date
// problem, a shift somebody else already took, and a supply request the
// API reads with no type. A case turns a route away with one through
// state.refuse as { api: key }, and its sentence is written in the
// request's language, ?locale= first and the account's after it.
const API_REFUSALS = {
  "timeOff.lastBeforeFirst": { status: 400, en: "The last day cannot be before the first day", es: "El \u00faltimo d\u00eda no puede ser anterior al primer d\u00eda" },
  "pickups.alreadyClaimed": { status: 409, en: "Shift was already claimed", es: "Este turno ya fue tomado" },
  "supplies.requestTypeRequired": { status: 400, en: "Request type is required", es: "Elija el tipo de solicitud" },
};
// A chat's messages as the API keeps them, oldest first. Every text is
// invented. oddRows adds rows missing a name, a time, or both.
const chatSeed = (channelId, odd) => {
  const at = (h) => iso(NOW.getTime() - h * 60 * 60 * 1000);
  const rows = {
    "ch-north": [
      { id: "m-n1", senderId: SECOND_PERSON.id, senderName: SECOND_PERSON.firstName + " " + SECOND_PERSON.lastName, senderRole: "lead", text: "The side door sticks, use the front.", sentAt: at(5), isEdited: false, isPinned: false },
      { id: "m-n2", senderId: ADMIN_PERSON.id, senderName: ADMIN_PERSON.firstName + " " + ADMIN_PERSON.lastName, senderRole: "admin", text: "Thanks for the heads up.", sentAt: at(4), isEdited: false, isPinned: false },
    ],
    "ch-all": [
      { id: "m-a1", senderId: ADMIN_PERSON.id, senderName: ADMIN_PERSON.firstName + " " + ADMIN_PERSON.lastName, senderRole: "admin", text: "Welcome to the team chat.", sentAt: at(30), isEdited: false, isPinned: true },
    ],
    "dm-u-one": [
      { id: "m-d1", senderId: ADMIN_PERSON.id, senderName: ADMIN_PERSON.firstName + " " + ADMIN_PERSON.lastName, senderRole: "admin", text: "Your badge is ready at the office.", sentAt: at(3), isEdited: false, isPinned: false },
    ],
  }[channelId] || [];
  if (odd && channelId === "ch-north") {
    rows.push({ id: "m-odd1", senderId: "s-03", text: "A note with no name on it." });
    rows.push({ id: "m-odd2", senderId: "s-04", senderName: "Dan Delgado", senderRole: "custodian", text: "A note with no time on it." });
    rows.push({ senderId: "s-05", senderName: "Eve Everett", text: "A note with no id on it.", sentAt: at(2) });
  }
  return rows.map(r => Object.assign({}, r));
};

// --- names, words and codes ---------------------------------------------
//
// Every string the stub serves is one of three things, and the Spanish
// check treats each one its own way.
//
//   a name   a site, a building, a person, an id, a date, a number. Drawn
//            the way it was sent, in any language.
//   a word   something a person reads: a refusal, a message, form text, a
//            Help reply, a to-do item or its zone, a checklist's shift
//            header, a pick list choice, a notice, a supply, an inspection
//            item, a leave type, a shift name, a site role. On a Spanish
//            screen it has to be Spanish.
//   a code   a status, a role, a priority, a severity or an origin. The
//            screen is meant to put it into words, never draw it as sent.
//
// Every invented word has a Spanish twin below. A kind the live API
// already sends in Spanish is served in the language the request asked
// for: the locale it carries, or the person's own saved language on a
// route that carries none. Every other kind is served in English, the way
// the live API serves it today, so a Spanish screen that draws one as
// sent shows the gap, and audit/known.json names it with its reason. The
// day the API sends a kind in Spanish, it joins LIVE_KINDS, its twins are
// served, and the known entry stops matching and has to come off.
const LIVE_KINDS = new Set(["form text"]);

const { ES } = require("./words");
const { silently } = require("./stream");
const tableTwin = (en) => [en, Object.prototype.hasOwnProperty.call(ES, en) ? ES[en] : null];

// Step 124's refusals when a session's shift is changed, and the one an
// uncheck gets when somebody else made the check. The API writes each one
// in the request's language, and the stub answers the same way.
const SERVER_ERROR = "Something went wrong on our end. Try again in a minute.";
const SHIFT_REFUSALS = [
  { key: "shiftInvalid", status: 400, en: "Choose one of this site's shifts: {shifts}", es: "Elija uno de los turnos de este sitio: {shifts}" },
  { key: "notYours", status: 403, en: "You can only change your own shift", es: "Solo puede cambiar su propio turno" },
  { key: "notFound", status: 404, en: "Session not found", es: "No se encontr\u00f3 el turno" },
  { key: "ended", status: 409, code: "SESSION_ALREADY_ENDED", en: "This shift has already ended", es: "Este turno ya termin\u00f3" },
  { key: "serverError", status: 500, en: SERVER_ERROR, es: ES[SERVER_ERROR] },
];
const NOT_YOUR_CHECK = { status: 403, code: "NOT_YOUR_CHECK", en: "Only the person who checked this can uncheck it.", es: "Solo la persona que marc\u00f3 esta tarea puede desmarcarla." };
// One refusal's sentence in a language, with what fills it.
const refusalIn = (r, lang, vars) => String(lang === "es" ? r.es : r.en).replace(/\{(\w+)\}/g, (whole, k) => (vars && k in vars ? String(vars[k]) : whole));
// West Building's shifts, as the invalid shift refusal names them.
const WEST_SHIFT_NAMES = { shifts: "Day shift, Night shift" };

const TWIN_PAIRS = [
  // To-do items, their instructions and their zones.
  ["Wipe the entry doors and handles", "Limpie las puertas de entrada y las manijas"],
  ["Work top to bottom.", "Trabaje de arriba hacia abajo."],
  ["Empty every bin on the floor", "Vac\u00ede todos los botes de basura del piso"],
  ["Mop the corridor end to end", "Trapee el pasillo de punta a punta"],
  ["Restock paper towels and soap", "Reponga las toallas de papel y el jab\u00f3n"],
  ["Refill the sanitizer stands", "Rellene los dispensadores de desinfectante"],
  ["Replace the cracked light cover", "Cambie la cubierta rota de la l\u00e1mpara"],
  ["Second floor corridor.", "Pasillo del segundo piso."],
  ["Entrance", "Entrada"],
  ["Corridor", "Pasillo"],
  ["Restroom", "Ba\u00f1o"],
  ["Dust the stair rails", "Sacuda los pasamanos de la escalera"],
  ["Stairwell", "Escalera"],
  ["Sweep the loading dock", "Barra el muelle de carga"],
  ["Loading dock", "Muelle de carga"],
  ["Wipe down the lobby benches", "Limpie las bancas del vest\u00edbulo"],
  ["Check that the exit signs are lit", "Revise que los letreros de salida est\u00e9n encendidos"],
  // A list set out in shifts: its items, their zones, and its headers.
  ["Unlock the restroom doors", "Abra las puertas de los ba\u00f1os"],
  ["Turn on the hallway lights", "Encienda las luces del pasillo"],
  ["Wipe the front desk", "Limpie la recepci\u00f3n"],
  ["Empty the break room bins", "Vac\u00ede los botes de la sala de descanso"],
  ["Sweep the main hallway", "Barra el pasillo principal"],
  ["Mop the restroom floors", "Trapee los pisos de los ba\u00f1os"],
  ["Lock up the restrooms", "Cierre los ba\u00f1os con llave"],
  ["Turn off the hallway lights", "Apague las luces del pasillo"],
  ["Refill the hand soap", "Rellene el jab\u00f3n de manos"],
  ["Restock the restroom paper", "Reponga el papel de los ba\u00f1os"],
  ["Wipe the restroom mirrors", "Limpie los espejos de los ba\u00f1os"],
  ["Front desk", "Recepci\u00f3n"],
  ["Break room", "Sala de descanso"],
  ["Morning", "Ma\u00f1ana"],
  ["Opening walk", "Recorrido de apertura"],
  ["Midday reset", "Repaso del mediod\u00eda"],
  ["Restroom round", "Ronda de los ba\u00f1os"],
  ["Closing walk", "Recorrido de cierre"],
  ["Last round", "\u00daltima ronda"],
  // West Building's list: its items, their zones, its shifts and blocks.
  ["Check the restroom supplies", "Revise los insumos de los ba\u00f1os"],
  ["Wipe the restroom sinks", "Limpie los lavabos de los ba\u00f1os"],
  ["Scrub the grout in the restrooms", "Talle las juntas de los ba\u00f1os"],
  ["Empty the office bins", "Vac\u00ede los botes de las oficinas"],
  ["Vacuum the office carpet", "Aspire la alfombra de las oficinas"],
  ["Dust the window sills", "Sacuda los alf\u00e9izares de las ventanas"],
  ["Clean the light fixtures", "Limpie las l\u00e1mparas"],
  ["Clean the break room fridge", "Limpie el refrigerador de la sala de descanso"],
  ["Wipe the elevator buttons", "Limpie los botones del elevador"],
  ["Lock the side doors", "Cierre las puertas laterales"],
  ["Polish the lobby brass", "Pula el bronce del vest\u00edbulo"],
  ["Wash the trash cans", "Lave los botes de basura"],
  ["Wipe the air vents", "Limpie las rejillas de ventilaci\u00f3n"],
  ["Wash the outside windows", "Lave las ventanas por fuera"],
  ["Clean up spills", "Limpie los derrames"],
  ["Take out the recycling", "Saque el reciclaje"],
  ["Open the blinds", "Abra las persianas"],
  ["Wipe the reception counter", "Limpie el mostrador de recepci\u00f3n"],
  ["Mop the lobby floor", "Trapee el piso del vest\u00edbulo"],
  ["Dust the picture frames", "Sacuda los marcos de los cuadros"],
  ["Sweep the entry mat", "Barra el tapete de la entrada"],
  ["Office", "Oficina"],
  ["Elevator", "Elevador"],
  ["Outside", "Afuera"],
  ["Day shift", "Turno de d\u00eda"],
  ["Night shift", "Turno de noche"],
  ["Opening checks", "Revisi\u00f3n de apertura"],
  ["Lobby reset", "Repaso del vest\u00edbulo"],
  ["Floor care", "Cuidado de pisos"],
  ["Closing checks", "Revisi\u00f3n de cierre"],
  ["Restroom Round 1", "Ronda de ba\u00f1os 1"],
  ["Office sweep", "Barrido de oficinas"],
  ["Common areas", "\u00c1reas comunes"],
  ["Late round", "Ronda de la madrugada"],
  ["Deep clean", "Limpieza a fondo"],
  // Supplies.
  ["Paper towels", "Toallas de papel"],
  ["rolls", "rollos"],
  // Notices.
  ["Supply request approved", "Solicitud de insumos aprobada"],
  ["Two cases of paper towels.", "Dos cajas de toallas de papel."],
  ["Something happened", "Algo pas\u00f3"],
  ["An invented notice.", "Un aviso inventado."],
  // A site role, a shift name and a service.
  ["Staff", "Personal"],
  ["Evening", "Tarde"],
  ["Day porter", "Conserje de d\u00eda"],
  // Messages and Help's reply.
  ["Usage logged", "Uso registrado"],
  ["Take the pads from the second floor store room.", "Tome los pa\u00f1os del almac\u00e9n del segundo piso."],
  // Help's other answers, the procedure one cites, and its refusals.
  [helpReply(HELP_ANSWERS.spill), HELP_ANSWERS.spill.piecesEs.join("")],
  ["I started an incident report for you. Tell me when it happened.", "Empec\u00e9 un reporte de incidente para usted. D\u00edgame cu\u00e1ndo pas\u00f3."],
  ["I do not have a written procedure for that. Ask your supervisor.", "No tengo un procedimiento escrito para eso. Pregunte a su supervisor."],
  ["Mop the spill right away with any mop.", "Trapee el derrame de inmediato con cualquier trapeador."],
  ["Spill response", "Respuesta a derrames"],
  [HELP_REFUSALS.busy.error, "Demasiadas preguntas a la vez. Espere un minuto y vuelva a preguntar."],
  [HELP_REFUSALS.unfinished.error, "No se pudo terminar la respuesta. Vuelva a preguntar."],
  // Refusals the portal's own table does not carry.
  ["Answer every required question before sending", "Responda todas las preguntas obligatorias antes de enviar"],
  ["This account is locked. Ask your supervisor to unlock it.", "Esta cuenta est\u00e1 bloqueada. Pida a su supervisor que la desbloquee."],
  ["A shift is already open at another site", "Ya hay un turno abierto en otro sitio"],
  ["Endpoint not found", "No se encontr\u00f3 la ruta"],
  // What a check an uncheck cannot take back is told, and a message the
  // uncheck answers with that no screen draws.
  [NOT_YOUR_CHECK.en, NOT_YOUR_CHECK.es],
  ["Task uncompleted", "Tarea desmarcada"],
  // The first form, which the catalog serves in either language.
  ["Incident report", "Reporte de incidente"],
  ["When did it happen", "Cu\u00e1ndo pas\u00f3"],
  ["Where did it happen", "D\u00f3nde pas\u00f3"],
  ["Was anyone hurt", "Alguien sali\u00f3 herido"],
  ["People", "Personas"],
  ["Who else was there", "Qui\u00e9n m\u00e1s estaba ah\u00ed"],
  // An inspection, its items and their zone.
  ["Lobby walk", "Recorrido del vest\u00edbulo"],
  ["Glass doors are free of smudges", "Las puertas de vidrio no tienen manchas"],
  ["Floor mats are straight and dry", "Los tapetes est\u00e1n derechos y secos"],
  ["Lobby", "Vest\u00edbulo"],
  ["Inspection not found", "No se encontr\u00f3 la inspecci\u00f3n"],
  ["Stairwell walk", "Recorrido de la escalera"],
  ["The badge number does not match this account.", "El n\u00famero de empleado no coincide con esta cuenta."],
  // The one pick list label the portal's own table does not carry yet.
  ["Medium", "Media"],
  // A drop reason an admin added, which only the API can put into Spanish.
  ["Car trouble", "Problemas con el carro"],
]
  // Words the portal's own table already carries, with its Spanish.
  .concat(["Describe what happened", "What happened", "No", "Yes", "Shift started", "Shift ended",
    "Sick", "Personal", "Scheduling Conflict", "Emergency", "Other", "Low", "High",
    "Refill", "Damage Report", "New Gear", "New Supply", "Normal", "Urgent"].map(tableTwin))
  .concat(LEAVE_TYPES.map(t => tableTwin(t.label)))
  .concat(TIME_OFF_REFUSALS.map(r => tableTwin(r.error)))
  .concat(HR_CASE_REFUSALS.map(tableTwin))
  .concat(Object.keys(PIN_REFUSALS).map(k => PIN_REFUSALS[k]))
  .concat(["That sign-in did not match. Check your badge, phone or email and your PIN.", "Session expired", "Request failed",
    "Photo upload failed", "A sign-off is made with its own button", "That is not a sign-off on this form",
    "You cannot sign this part of the form", "This part is already signed"].map(tableTwin))
  // The second form, already written in both languages above.
  .concat(Object.keys(FORM_P_WORDS.en).map(k => [FORM_P_WORDS.en[k], FORM_P_WORDS.es[k]]))
  .concat([1, 2, 3, 4, 5].map(n => [ROW_WORD.en + " " + n, ROW_WORD.es + " " + n]))
  // A shift change turned away, each sentence as the API writes it.
  .concat(SHIFT_REFUSALS.map(r => [refusalIn(r, "en", WEST_SHIFT_NAMES), refusalIn(r, "es", WEST_SHIFT_NAMES)]))
  // Chat's refusals as Step 132 writes them, in each language.
  .concat(CHAT_SEND_REFUSALS.map(r => [r.en, r.es]))
  // The three refusals a cleaner meets, as Step 137 writes them.
  .concat(Object.keys(API_REFUSALS).map(k => [API_REFUSALS[k].en, API_REFUSALS[k].es]))
  // The form with titled sections, written in both languages above.
  .concat(Object.keys(FORM_S_WORDS.en).map(k => [FORM_S_WORDS.en[k], FORM_S_WORDS.es[k]]));

const TWIN_ES = new Map();
const TWIN_EN = new Map();
TWIN_PAIRS.forEach(([en, es]) => {
  if (!en || !es) throw new Error("the stub has an English word with no Spanish twin: " + en);
  if (!TWIN_ES.has(en)) TWIN_ES.set(en, es);
  if (!TWIN_EN.has(es)) TWIN_EN.set(es, en);
});

// What a field carries. A field not named here holds a name.
const CODE_FIELDS = new Set(["status", "role", "priority", "severity", "origin", "resolution_status", "shift_status", "period", "cims_category"]);
const WORD_FIELDS = {
  error: "refusal", message: "message", reply: "Help reply", citedDocs: "procedure name",
  leaveTypeLabel: "leave type", role_at_site: "site role", shift_name: "shift name",
  service_category: "service", supply_name: "supply", unit: "supply",
  template_name: "inspection item", description: "to-do item", zone: "to-do zone",
  issue_title: "to-do item", issue_description: "to-do item",
  formName: "form text", section: "form text", help: "form text",
};
// The fields whose meaning depends on the route that sent them.
const ROUTE_WORDS = [
  [/^GET \/api\/sites\/[^/]+\/tasks$/, { label: "to-do item", shift_label: "shift header", block_label: "shift header", shift: "shift header", block: "shift header" }],
  // Every session answer names the site's shifts and their blocks.
  [/^(GET \/api\/clock\/status|POST \/api\/shift-sessions|PATCH \/api\/shift-sessions\/[^/]+\/shift|GET \/api\/shift-sessions\/today|POST \/api\/shift-sessions\/[^/]+\/end)$/, { label: "shift header", displayLabel: "shift header", shiftLabel: "shift header" }],
  [/^GET \/api\/clock\/tasks\/assigned$/, { label: "to-do item" }],
  [/^GET \/api\/lookups$/, { label: "pick list choice", displayLabel: "pick list choice" }],
  [/^GET \/api\/notifications$/, { title: "notice", body: "notice" }],
  [/^GET \/api\/supplies$/, { name: "supply" }],
  [/^GET \/api\/time-off\/types$/, { label: "leave type" }],
  [/^[A-Z]+ \/api\/forms/, { title: "form text", label: "form text", rows: "form text" }],
  [/^GET \/api\/inspections\//, { name: "inspection item", label: "inspection item", zone: "inspection item" }],
  // A piece of Help's answer, as the streaming route sends it.
  [/^POST \/api\/agent\/message\/stream$/, { text: "Help reply" }],
];
const kindsFor = (method, pathname) => {
  const hit = ROUTE_WORDS.find(r => r[0].test(method + " " + pathname));
  const own = hit ? hit[1] : {};
  return (field) => own[field] || WORD_FIELDS[field] || (CODE_FIELDS.has(field) ? "code" : "name");
};

// Step 113 in the API: the seven calls made before anyone signs in are
// answered in the language the request asks for, ?locale= first and the
// browser's Accept-Language after it. Every word on them is served that
// way, so a call that forgets ?locale= hears back in the phone's language.
const SIGNED_OUT = [
  /^POST \/api\/auth\/login$/, /^POST \/api\/auth\/register$/,
  /^GET \/api\/auth\/activate\/[^/]+$/, /^POST \/api\/auth\/activate$/,
  /^POST \/api\/auth\/reset\/request$/, /^GET \/api\/auth\/reset\/[^/]+$/, /^POST \/api\/auth\/reset$/,
];
const signedOutLanguage = (search, accept) => {
  const m = String(search || "").match(/[?&]locale=(en|es)\b/);
  if (m) return m[1];
  return /^\s*es\b/i.test(String(accept || "")) ? "es" : "en";
};

// The language one request asked for.
const languageOf = (search, state) => {
  const m = String(search || "").match(/[?&]locale=(en|es)\b/);
  if (m) return m[1];
  return state.accountPreferences && state.accountPreferences.language === "es" ? "es" : "en";
};

// Every request says the screen's language once, as ?locale= with en or
// es. Step 137 answers a signed-in call in ?locale= first and in the
// account's language after it, so a call that says none is answered in
// the account's language whatever the screen shows, and one that says it
// twice reaches the API as a list, which names no language, and is
// answered the same way. What is wrong with one request, or null.
const localeFault = (search) => {
  const said = new URLSearchParams(String(search || "")).getAll("locale");
  if (said.length === 0) return "says no language";
  if (said.length > 1) return "says its language " + said.length + " times: " + said.join(", ");
  if (said[0] !== "en" && said[0] !== "es") return "says a language the API does not know: " + said[0];
  return null;
};
// The first fault on each route, from every stub in the run, so the run
// fails on each one by name and a call added later without its language
// fails the suite. See localeRows.
const LOCALE_FAULTS = new Map();
function noteLocaleFault(key, search, fault) {
  if (!LOCALE_FAULTS.has(key)) LOCALE_FAULTS.set(key, { key: key, search: search || "", fault: fault });
}
// One row per route, the way the table reads a row.
function localeRows() {
  return Array.from(LOCALE_FAULTS.values()).map(f => ({ where: "Every request to OCSA", check: "says the screen's language once", detail: f.key + f.search + " " + f.fault }));
}

// What the Spanish check reads, from one stub.
function servedFor(stub) {
  const st = stub && stub.state;
  if (!st) return { names: [], words: [], codes: [] };
  return { names: Array.from(st.served), words: Array.from(st.words.values()), codes: Array.from(st.codes) };
}

const json = (status, body) => ({ status: status, contentType: "application/json", body: JSON.stringify(body) });

// A reply the way the screen draws it: a line at a time, a numbered
// step's words apart from its number, and a bold phrase apart from the
// words around it. Each piece is a text of its own on the screen, so each
// is a word the screen was given. The same reading as agentReplyParts in
// src/App.js, written again here because the suite never imports the app.
function replyPieces(text) {
  const out = [];
  String(text == null ? "" : text).split("\n").forEach((line) => {
    const step = /^\s*(\d{1,2})\.\s+(.+)$/.exec(line);
    const s = step ? step[2] : line;
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf("**", i);
      const close = open === -1 ? -1 : s.indexOf("**", open + 2);
      if (open === -1 || close === -1) { out.push(s.slice(i)); break; }
      if (open > i) out.push(s.slice(i, open));
      out.push(s.slice(open + 2, close));
      i = close + 2;
    }
  });
  return out.map(p => p.trim()).filter(p => p.length > 0);
}

// A reply the way a screen reader hears it once it is done: each line in
// turn, a step with its number, and every bold mark taken out. The same
// reading as agentSpoken in src/App.js.
function replySpoken(text) {
  return String(text == null ? "" : text).split("\n").map((line) => {
    const step = /^\s*(\d{1,2})\.\s+(.+)$/.exec(line);
    return (step ? step[1] + ". " + step[2] : line).replace(/\*\*([\s\S]*?)\*\*/g, "$1");
  }).join("\n").trim();
}

// A point a case stops Help's answer at. reached turns true when the
// answer gets there, and open lets it go on. Each one opens by itself
// after 20 seconds, so a case that never lets go cannot hang the run.
function makeGate(name) {
  let open = null;
  const opened = new Promise((done) => { open = done; });
  const gate = { name: name, reached: false, opened: opened, open: () => open() };
  setTimeout(() => open(), 20000).unref();
  return gate;
}

function createStub(opts) {
  const state = makeState(opts);

  // --- Help's answer, as the API writes it
  //
  // One question, answered with state.help.next when a case set it and
  // with the answer every question gets otherwise. Both routes play the
  // same steps: the streaming route sends each one as it is written, and
  // the message route waits until the last is written and sends the reply
  // whole, the way it always has.
  //
  // state.help.next, all optional, used once:
  //   answer   a key of HELP_ANSWERS
  //   rewrite  a key of HELP_ANSWERS written first and cleared with reset
  //   holds    { name: n } stops after the nth piece, or at "meta" or
  //            "reset"; state.help.holds names the gates to let go
  //   error    { after, status, error } sends the error after n pieces
  //   refuse   a key of HELP_REFUSALS, turned away before any stream
  //   drop     { after, storedAfterMs } drops the connection after n
  //            pieces; the answer is kept storedAfterMs later
  //   pauseMs  the pause before each event, 120 by default
  //   pieces   cuts the answer into this many pieces instead
  //   split    the pieces, counted from 1, that arrive in two parts
  //   language "es" writes the answer's Spanish twin, for a reading
  //   citedDocs the codes the answer cites, in place of its own
  function helpPlay(body) {
    const next = state.help.next || {};
    state.help.next = null;
    state.help.asked += 1;
    // Turned away before anything is written or kept, on either route,
    // since both answer to the same gates.
    if (next.refuse) return { refuse: HELP_REFUSALS[next.refuse] };
    const answer = HELP_ANSWERS[next.answer || "pads"];
    let pieces = next.language === "es" && answer.piecesEs ? answer.piecesEs : answer.pieces;
    if (next.pieces) pieces = cutInto(pieces.join(""), next.pieces);
    const reply = pieces.join("");
    const holds = {};
    Object.keys(next.holds || {}).forEach((name) => { holds[name] = makeGate(name); });
    const steps = [];
    const holdAt = (mark) => Object.keys(next.holds || {}).filter(n => next.holds[n] === mark).forEach(n => steps.push({ hold: n }));
    let sent = 0, written = "";
    const piece = (text) => {
      sent += 1;
      written += text;
      // The answer so far, the way the screen draws it while it arrives:
      // its marks taken out and a lone star at the end held back. It is a
      // Help reply too, and on a Spanish screen it is judged as one.
      recordWord(written.replace(/\*\*/g, "").replace(/\*$/, "").trim(), "Help reply");
      steps.push({ event: "delta", data: { text: text }, split: (next.split || []).indexOf(sent) !== -1 });
      holdAt(sent);
    };
    steps.push({ event: "meta", data: { conversationId: state.conversationId, requestId: "rq-" + state.help.asked } });
    holdAt("meta");
    if (next.rewrite) {
      HELP_ANSWERS[next.rewrite].pieces.forEach(piece);
      written = "";
      steps.push({ event: "reset", data: {} });
      holdAt("reset");
    }
    const upTo = next.error ? next.error.after : next.drop ? next.drop.after : pieces.length;
    pieces.slice(0, upTo).forEach(piece);
    const done = Object.assign({
      reply: reply, conversationId: state.conversationId,
      citedDocs: next.citedDocs || answer.citedDocs || [], degraded: !!answer.degraded, noProcedure: !!answer.noProcedure,
    }, answer.formResponse ? { formResponse: answer.formResponse } : {});
    if (next.error) steps.push({ event: "error", data: { error: next.error.error, status: next.error.status } });
    else if (next.drop) steps.push({ drop: true });
    else steps.push({ event: "done", data: done });
    // The question is kept at once and the answer once it is written. A
    // dropped connection still finishes the answer and keeps it; an error
    // keeps nothing.
    state.stored.push({ role: "user", text: body && typeof body.text === "string" ? body.text : "", at: 0 });
    const kept = { role: "assistant", text: reply, citedDocs: done.citedDocs, degraded: done.degraded, noProcedure: done.noProcedure, at: Infinity };
    if (!next.error) state.stored.push(kept);
    state.help.holds = holds;
    return {
      steps: steps, holds: holds, pauseMs: next.pauseMs !== undefined ? next.pauseMs : 120,
      done: done, error: next.error || null, drop: next.drop || null, refuse: null,
      finished: () => { kept.at = Date.now() + ((next.drop && next.drop.storedAfterMs) || 0); },
    };
  }

  const schedule = () => state.schedule || {
    scheduled: [{ id: "sh-1", scheduled_date: "2026-10-02", start_time: "17:00", end_time: "23:00", site_name: "North Building", status: "scheduled", building_name: "Main Hall", floor_number: "2" }],
    actual: [{ id: "ac-1", clock_in_time: iso(NOW.getTime() - 3 * 60 * 60 * 1000), shift_status: "active", site_name: "North Building" }],
    pickups: [],
  };

  // --- the checklist day, as Step 124 answers it
  //
  // The stub's clock, which a case can move, and when a check was made. A
  // check with no time was made a minute before the clock.
  const clockNow = () => (state.now !== null ? state.now : NOW.getTime());
  const atOf = (c) => (c.at !== undefined ? c.at : clockNow() - 60 * 1000);
  const firstNameOf = (userId) => (userId === state.person.id ? state.person.firstName : (FIRST_NAMES[userId] || "Someone"));
  const latest = (list) => list.slice().sort((a, b) => atOf(b) - atOf(a))[0];
  // The shift the open session carries, at a site with shifts.
  const sessionShift = () => (shiftsFor(state.site, state.sessionStartedAt).length > 0 ? state.shiftLabel : null);

  // Every item at a site with what the checklist day says about it: its
  // period, whether it is shown today and due today, whether anyone did it
  // in its period, and who checked it today, this person first.
  const dayRows = (siteId) => {
    const today = checklistDay(clockNow());
    return (SITE_TASKS[siteId] || []).map((row) => {
      const checks = state.completions.filter(c => c.taskId === row.id && checklistDay(atOf(c)) <= today);
      const on = (day) => checks.filter(c => checklistDay(atOf(c)) === day);
      const todays = on(today), yesterdays = on(today - 1);
      const shown = row.shown !== false;
      const every = row.every || "daily";
      const due = row.period === "today" && shown && !(every === "every_other_day" && yesterdays.length > 0);
      let done = null;
      if (PERIODS.indexOf(row.period) !== -1) done = latest(checks.filter(c => periodOf(row.period, checklistDay(atOf(c))) === periodOf(row.period, today)));
      else if (row.period === "today" && every === "every_other_day" && yesterdays.length > 0) done = latest(yesterdays);
      else if (row.period === "as_needed" && todays.length > 0) done = latest(todays);
      const checked = todays.find(c => c.userId === state.person.id) || latest(todays);
      return {
        row: row, period: row.period, shown: shown, due: due,
        done: done ? { completedAt: iso(atOf(done)), firstName: firstNameOf(done.userId) } : null,
        checked: checked ? { byCaller: checked.userId === state.person.id, firstName: firstNameOf(checked.userId), completedAt: iso(atOf(checked)) } : null,
        mine: todays.some(c => c.userId === state.person.id),
      };
    });
  };
  // The items of a shift and the items tied to no shift, or every item
  // when there is no shift to go by.
  const inShift = (shift) => (x) => !shift || !x.row.shift_label || x.row.shift_label === shift;
  const linkedTo = (userId, siteId) => {
    const here = new Set((SITE_TASKS[siteId] || []).map(r => r.id));
    return (state.links[userId] || []).filter(id => here.has(id));
  };

  // What every session answer says about the checklist: the day's due
  // items, the ones linked to this person and every one at the site, what
  // has been checked off among them, by this person and by anyone at the
  // site, the repeating work by period over the list this person is shown,
  // whether this person has links here, and who checked what today.
  const progress = () => {
    const shown = dayRows(state.site).filter(x => x.shown).filter(inShift(sessionShift()));
    const linked = linkedTo(state.person.id, state.site);
    const theirs = shown.filter(x => linked.indexOf(x.row.id) !== -1);
    const due = shown.filter(x => x.due);
    const list = linked.length > 0 ? theirs : shown;
    const periodic = {};
    PERIODS.forEach((p) => {
      const rows = list.filter(x => x.period === p);
      if (rows.length > 0) periodic[p] = { total: rows.length, done: rows.filter(x => x.done).length };
    });
    const ids = (xs) => xs.map(x => x.row.id);
    return {
      total: theirs.filter(x => x.due).length,
      completed: due.filter(x => x.mine).length,
      siteTotal: due.length,
      completedTaskIds: ids(due.filter(x => x.mine)),
      siteCompletedTaskIds: ids(due.filter(x => x.checked)),
      periodic: periodic,
      hasLinkedItems: linked.length > 0,
      checkedToday: shown.filter(x => x.checked).map(x => Object.assign({ taskId: x.row.id }, x.checked)),
    };
  };

  // The open session, the way every session answer carries it.
  const sessionOf = () => {
    const shifts = shiftsFor(state.site, state.sessionStartedAt);
    return { id: "sess-1", siteId: state.site, startedAt: iso(state.sessionStartedAt), shiftLabel: shifts.length > 0 ? state.shiftLabel : null, shifts: shifts };
  };

  const clockStatus = () => (state.clockedIn ? {
    clockedIn: true,
    shift: Object.assign({ sessionId: "sess-1", id: "sess-1" }, OPEN_SHIFT[state.site], { clockInTime: iso(state.sessionStartedAt) }),
    session: sessionOf(),
    tasks: progress(),
  } : { clockedIn: false, shift: null, session: null, tasks: null });

  // One site's list, asked for the way the request asks, with Step 118's
  // words on the items that carry them and Step 124's day on every one.
  // day=today answers what the checklist day shows and day=all every item;
  // with neither, a manager with no open session at the site gets every
  // item and everyone else today's. shift names a shift; without it the
  // open session's decides.
  const tasks = (siteId, search) => {
    const q = new URLSearchParams(search || "");
    const lang = languageOf(search, state);
    const manager = state.person.role === "admin" || state.person.role === "supervisor";
    const openHere = state.clockedIn && state.site === siteId;
    const every = q.get("day") === "all" || (!q.has("day") && manager && !openHere);
    const shift = q.has("shift") ? q.get("shift") : (openHere ? sessionShift() : null);
    let rows = dayRows(siteId).filter(x => every || x.shown).filter(inShift(shift));
    if (q.has("user_id")) {
      const linked = linkedTo(q.get("user_id"), siteId);
      rows = rows.filter(x => linked.indexOf(x.row.id) !== -1);
    }
    if (q.has("building_name")) rows = rows.filter(x => x.row.building_name === q.get("building_name"));
    if (q.has("floor_number")) rows = rows.filter(x => x.row.floor_number === q.get("floor_number"));
    return rows.map((x) => {
      const { every: often, shown, ...row } = x.row;
      const display = Object.assign(DISPLAYED.has(row.id) ? displayOf(row, lang) : {}, {
        shift: row.block_label ? row.shift_label : null,
        block: row.block_label || null,
      });
      return Object.assign(row, { period: x.period, dueToday: x.due, doneThisPeriod: x.done, shownToday: x.shown, checkedToday: x.checked, display: display });
    });
  };

  // One of Chat's refusals the way Step 132 writes it: its code beside
  // error, and error in the language the request asks for.
  const chatRefusal = (code, search) => {
    const r = CHAT_REFUSALS[code];
    return json(r.status, { error: r[languageOf(search, state)], code: code });
  };
  // One of the three refusals a cleaner meets, the same way: its key as
  // the code, and error in the language the request asks for.
  const apiRefusal = (key, search) => {
    const r = API_REFUSALS[key];
    return json(r.status, { error: r[languageOf(search, state)], code: key });
  };
  // A route a case has asked to refuse wins over the answer below it. A
  // refusal named by one of Chat's codes, or by the API's own key, is
  // written the way the API does.
  function refusalFor(key, search) {
    const r = state.refuse[key];
    if (!r) return null;
    if (r.once) delete state.refuse[key];
    if (r.chat) return chatRefusal(r.chat, search);
    if (r.api) return apiRefusal(r.api, search);
    return json(r.status || 400, r.body || { error: r.error || "Request failed" });
  }

  function handle(method, pathname, search, body, headers) {
    const key = method + " " + pathname;
    state.calls.push({ method: method, path: pathname, search: search || "", body: body || null, headers: headers || {} });
    // A request that does not say its language once is kept, and a
    // signed-in one is turned away before anything else answers it. The
    // seven calls made before signing in are answered as before, in the
    // phone's language, which is what the case for them catches.
    const fault = localeFault(search);
    if (fault) {
      state.localeFaults.push(key + (search || "") + " " + fault);
      noteLocaleFault(key, search, fault);
      if (!SIGNED_OUT.some(re => re.test(key))) return json(400, { error: "Request failed", code: "LOCALE_REQUIRED" });
    }
    if (state.offline) return { abort: true };
    const dropped = state.drop[key];
    if (dropped) { if (dropped.once) delete state.drop[key]; return { abort: true }; }
    const refused = refusalFor(key, search);
    if (refused) return refused;

    // --- signing in and getting in
    if (key === "POST /api/auth/login") {
      if (body && body.pin !== "4907") return json(401, { error: "That sign-in did not match. Check your badge, phone or email and your PIN." });
      return json(200, { token: "token-one" });
    }
    if (key === "GET /api/auth/me") return json(200, Object.assign({ user: state.person, sites: SITES, preferences: state.accountPreferences }, state.mustSetPin ? { mustSetPin: true } : {}));
    if (key === "POST /api/auth/register") return json(200, { ok: true });
    if (key === "POST /api/auth/reset/request") return json(200, { ok: true });
    if (key === "POST /api/auth/change-pin") {
      // A refusal a case asked for: its code, and its sentence in the
      // request's language, ?locale= first and the account's after it,
      // the way Step 137 answers.
      if (state.pinRefusal) {
        const code = state.pinRefusal;
        state.pinRefusal = null;
        return json(400, { error: PIN_REFUSALS[code][languageOf(search, state) === "es" ? 1 : 0], code: code });
      }
      state.mustSetPin = false;
      return json(200, { ok: true });
    }
    // A link is good for twelve hours from the suite's clock. The account's
    // saved language rides along when the account has one.
    const linkInfo = () => Object.assign({ firstName: state.person.firstName, expiresAt: iso(NOW.getTime() + 12 * 60 * 60 * 1000) },
      (state.accountPreferences && (state.accountPreferences.language === "en" || state.accountPreferences.language === "es")) ? { preferredLanguage: state.accountPreferences.language } : {});
    if (method === "GET" && /^\/api\/auth\/activate\//.test(pathname)) return json(200, Object.assign(linkInfo(), { badgeAssigned: state.activationBadge }));
    // A link whose row carries a badge number turns away one that does
    // not match, with a code the screen reads and a sentence it does not.
    if (key === "POST /api/auth/activate") {
      if (state.activationBadge && body && body.badgeNumber && body.badgeNumber !== state.person.badgeNumber) {
        return json(400, { error: "The badge number does not match this account.", code: "BADGE_MISMATCH" });
      }
      return json(200, { token: "token-one" });
    }
    if (method === "GET" && /^\/api\/auth\/reset\//.test(pathname)) return json(200, { firstName: state.person.firstName, expiresAt: linkInfo().expiresAt });
    if (key === "POST /api/auth/reset") return json(200, { token: "token-one" });

    // --- the person's own settings
    if (key === "PATCH /api/users/me/preferences") {
      state.prefsPatches.push(body);
      // A real account remembers what it was told, so a reload reads
      // back the choice rather than the value it held before.
      Object.assign(state.accountPreferences, body || {});
      return json(200, { ok: true });
    }
    if (key === "GET /api/users/profile/me") return json(200, {
      user: Object.assign({}, state.person, { employeeId: "OCSA-0001", preferredLanguage: "English", addressLine1: "", city: "", state: "", zipCode: "", emergencyContactName: "", emergencyContactPhone: "", birthday: "1990-08-14" }),
      assignments: [{ site_name: "North Building", role_at_site: "Staff", shift_name: "Evening", shift_start: "17:00", shift_end: "23:00" }],
    });
    if (key === "PATCH /api/users/profile/me") return json(200, { ok: true });
    if (key === "POST /api/users/profile/photo") return json(200, { ok: true });

    // --- the shift
    if (key === "GET /api/clock/status") return json(200, clockStatus());
    if (key === "GET /api/clock/tasks/assigned") return json(200, [
      { task_id: "at-1", label: "Replace the cracked light cover", description: "Second floor corridor.", site_name: "North Building", building_name: "Main Hall", floor_number: "2", zone: "Corridor", priority: "high", cims_category: "SD", created_by_name: "A supervisor", task_created_at: iso(NOW.getTime() - DAY) },
    ]);
    // A check needs no link, only an open session at the item's site, and
    // counts once a checklist day for each person. An uncheck takes back
    // this person's own check today and no one else's: with none of their
    // own and somebody else's there, Step 124 turns it away, and with
    // neither it answers as if it had taken one back.
    if (method === "POST" && /^\/api\/clock\/tasks\/[^/]+\/complete$/.test(pathname)) {
      const id = pathname.split("/")[4];
      const today = checklistDay(clockNow());
      if (!state.completions.some(c => c.taskId === id && c.userId === state.person.id && checklistDay(atOf(c)) === today)) state.completions.push({ taskId: id, userId: state.person.id, at: clockNow() });
      return json(200, { ok: true });
    }
    if (method === "DELETE" && /^\/api\/clock\/tasks\/[^/]+\/complete$/.test(pathname)) {
      const id = pathname.split("/")[4];
      const today = checklistDay(clockNow());
      const todays = state.completions.filter(c => c.taskId === id && checklistDay(atOf(c)) === today);
      if (todays.length > 0 && !todays.some(c => c.userId === state.person.id)) {
        return json(NOT_YOUR_CHECK.status, { error: refusalIn(NOT_YOUR_CHECK, languageOf(search, state)), code: NOT_YOUR_CHECK.code });
      }
      state.completions = state.completions.filter(c => !(c.taskId === id && c.userId === state.person.id && checklistDay(atOf(c)) === today));
      return json(200, { message: "Task uncompleted" });
    }
    if (method === "PATCH" && /^\/api\/clock\/tasks\/resolve\//.test(pathname)) return json(200, { ok: true });
    if (key === "GET /api/shift-sessions/sites") return json(200, {
      scheduled: [{ siteId: "site-north", siteName: "North Building", address: "1 Example Way", city: "Philadelphia", buildingName: "Main Hall", floorNumber: "2" }],
      assigned: [{ siteId: "site-south", siteName: "South Building", address: "2 Example Way", city: "Philadelphia" }, { siteId: "site-west", siteName: "West Building", address: "3 Example Way", city: "Philadelphia" }],
      all: SITES,
    });
    // Start Shift takes the site and, at a site with shifts, the shift. A
    // session starts on the stub's clock and carries no shift unless one
    // of the site's was named.
    if (key === "POST /api/shift-sessions") {
      if (body && OPEN_SHIFT[body.siteId]) state.site = body.siteId;
      state.clockedIn = true;
      state.sessionStartedAt = clockNow();
      const labels = shiftsFor(state.site, state.sessionStartedAt).map(x => x.label);
      state.shiftLabel = body && labels.indexOf(body.shiftLabel) !== -1 ? body.shiftLabel : null;
      return json(200, { message: "Shift started", session: sessionOf(), tasks: progress() });
    }
    // Step 124: the shift a session carries, changed by its owner while it
    // is open, to one of the site's shifts or to none. Each refusal is the
    // API's, in the request's language.
    const shiftChange = method === "PATCH" ? /^\/api\/shift-sessions\/([^/]+)\/shift$/.exec(pathname) : null;
    if (shiftChange) {
      const lang = languageOf(search, state);
      const refuse = (k, vars) => { const r = SHIFT_REFUSALS.find(x => x.key === k); return json(r.status, Object.assign({ error: refusalIn(r, lang, vars) }, r.code ? { code: r.code } : {})); };
      if (shiftChange[1] !== "sess-1") return refuse("notFound");
      if (!state.clockedIn) return refuse("ended");
      const labels = shiftsFor(state.site, state.sessionStartedAt).map(x => x.label);
      const wanted = body ? body.shiftLabel : undefined;
      if (wanted !== null && labels.indexOf(wanted) === -1) return refuse("shiftInvalid", { shifts: labels.join(", ") });
      state.shiftLabel = wanted;
      return json(200, { today: ymd(new Date(checklistDay(clockNow()) * DAY + 12 * 60 * 60 * 1000)), session: sessionOf(), tasks: progress() });
    }
    if (key === "GET /api/shift-sessions/today") {
      return json(200, { today: ymd(new Date(checklistDay(clockNow()) * DAY + 12 * 60 * 60 * 1000)), session: state.clockedIn ? sessionOf() : null, tasks: state.clockedIn ? progress() : null });
    }
    if (method === "POST" && /^\/api\/shift-sessions\/[^/]+\/end$/.test(pathname)) {
      if (!state.clockedIn) {
        const r = SHIFT_REFUSALS.find(x => x.key === "ended");
        return json(r.status, { error: refusalIn(r, languageOf(search, state)), code: r.code });
      }
      const session = Object.assign(sessionOf(), { endedAt: iso(clockNow()) });
      const counted = progress();
      state.clockedIn = false;
      return json(200, { message: "Shift ended", session: session, tasks: counted });
    }
    if (method === "PATCH" && /^\/api\/shift-sessions\//.test(pathname)) { state.clockedIn = false; return json(200, { message: "Shift ended" }); }
    if (key === "GET /api/sites") return json(200, SITES);
    if (method === "GET" && /^\/api\/sites\/[^/]+\/tasks$/.test(pathname)) return json(200, tasks(pathname.split("/")[3], search));
    // The four pick lists, their labels in English the way the live API
    // sends them, with Step 118's displayLabel on two choices. The colors
    // are the ones the screens draw when no list arrives.
    if (key === "GET /api/lookups") return json(200, lookupsIn(languageOf(search, state)));

    // --- the calendar
    if (pathname === "/api/pickups/my-schedule") return json(200, schedule());
    if (key === "GET /api/pickups/available") return json(200, [
      { id: "pk-1", scheduled_date: "2026-10-08", start_time: "17:00", end_time: "23:00", site_name: "South Building", origin: "voluntary_drop", service_category: "Day porter" },
    ]);
    if (key === "GET /api/pickups/my-pickups") return json(200, []);
    if (key === "POST /api/pickups/request-drop") return json(200, { ok: true });
    if (method === "POST" && /^\/api\/pickups\/[^/]+\/claim$/.test(pathname)) return json(200, { ok: true });
    if (method === "DELETE" && /^\/api\/pickups\//.test(pathname)) return json(200, { ok: true });

    // --- time off
    if (key === "GET /api/time-off/types") return state.timeOffTypesLive ? json(200, { types: LEAVE_TYPES }) : json(404, { error: "Endpoint not found" });
    if (pathname === "/api/time-off/mine") return json(200, { requests: state.myTimeOff });
    if (key === "POST /api/time-off") return json(201, { request: timeOffRow({ id: "to-new", leaveType: body && body.leaveType, startsOn: body && body.startsOn, endsOn: body && body.endsOn }) });
    if (method === "POST" && /^\/api\/time-off\/[^/]+\/cancel$/.test(pathname)) return json(200, { request: timeOffRow({ status: "cancelled", cancelledAt: iso(NOW.getTime()) }) });
    if (method === "GET" && /^\/api\/time-off\/[^/]+$/.test(pathname)) {
      const id = pathname.split("/").pop();
      const row = state.myTimeOff.find(r => r.id === id);
      return row ? json(200, { request: row }) : json(404, { error: "Request not found" });
    }

    // --- chat, the three routes as Scout 138 read and ran them, and the
    // refusals as Step 132 writes them
    if (key === "GET /api/chat/channels") return json(200, state.chat.channels.map(ch => Object.assign({}, ch)));
    if (/^\/api\/chat\/channels\/[^/]+\/messages$/.test(pathname) && (method === "GET" || method === "POST")) {
      const id = decodeURIComponent(pathname.split("/")[4]);
      const mine = state.chat.channels.some(ch => ch.id === id);
      const anywhere = mine || id === CHAT_GENERAL.id || CHAT_SITES.some(s => s.id === id) || /^dm-/.test(id);
      if (!anywhere) return chatRefusal("chat.notFound", search);
      if (!mine) return chatRefusal("chat.noAccess", search);
      const kept = state.chat.messages[id] || (state.chat.messages[id] = []);
      if (method === "GET") return json(200, kept.slice(-50).map(m => Object.assign({}, m)));
      const text = body && typeof body.text === "string" ? body.text.trim() : "";
      if (!text) return chatRefusal("chat.textRequired", search);
      if (text.length > CHAT_TEXT_MAX) return chatRefusal("chat.textTooLong", search);
      state.chat.seq += 1;
      const row = { id: "m-sent-" + state.chat.seq, senderId: state.person.id, senderName: state.person.firstName + " " + state.person.lastName, senderRole: state.person.role, text: text, sentAt: iso(clockNow()) };
      kept.push(Object.assign({ isEdited: false, isPinned: false }, row));
      const held = state.chat.holdMs > 0 ? { after: new Promise(done => setTimeout(done, state.chat.holdMs)) } : {};
      // Kept, and then the connection goes before the answer does, the way
      // a send times out after the API saved it.
      if (state.chat.saveThenDrop) { state.chat.saveThenDrop = false; return Object.assign({ abort: true }, held); }
      if (state.chat.noMessage) { state.chat.noMessage = false; return Object.assign(json(201, {}), held); }
      return Object.assign(json(201, { message: row }), held);
    }

    // --- Help
    //
    // The streaming route answers with the steps themselves, which
    // browser.js hands to stream.js to send as they are written. A refusal
    // before the stream opens is JSON, the same refusal the message route
    // gives.
    if (key === "POST /api/agent/message/stream") {
      const play = helpPlay(body);
      if (play.refuse) return json(play.refuse.status, { error: play.refuse.error });
      return { stream: play };
    }
    // The message route answers once the whole answer is written: done's
    // body as it is, an error as a refusal with its status, and a dropped
    // connection as no answer at all.
    if (key === "POST /api/agent/message") {
      const play = helpPlay(body);
      if (play.refuse) return json(play.refuse.status, { error: play.refuse.error });
      const after = silently(play);
      if (play.drop) return { abort: true, after: after };
      if (play.error) return Object.assign(json(play.error.status, { error: play.error.error }), { after: after });
      return Object.assign(json(200, play.done), { after: after });
    }
    if (pathname === "/api/agent/drafts" && method === "GET") return json(200, state.drafts);
    // The conversation as the API keeps it: every question, and every
    // answer once it is written. An answer is a Help reply, and a question
    // is the person's own words.
    if (method === "GET" && /^\/api\/agent\/conversations\//.test(pathname)) {
      const now = Date.now();
      const messages = pathname.split("/").pop() === state.conversationId
        ? state.stored.filter(m => m.at <= now).map(m => (m.role === "assistant"
          ? { role: m.role, text: m.text, citedDocs: m.citedDocs, degraded: m.degraded, noProcedure: m.noProcedure }
          : { role: m.role, text: m.text }))
        : [];
      messages.forEach((m) => { if (m.role === "assistant") recordWord(m.text, "Help reply"); });
      return json(200, { messages: messages });
    }
    if (method === "POST" && /^\/api\/agent\/drafts\/[^/]+\/submit$/.test(pathname)) return json(200, { ok: true });

    // --- report forms
    //
    // Two forms now: the one built today, and the second one carrying a
    // checklist, a table a person adds rows to, and a sign-off. Which
    // one a request means is read from the code in the path, or from the
    // draft id, the way the real API reads it.
    const lang = /locale=es/.test(String(search || "")) ? "es" : "en";
    const second = (p) => /TEST-FORM-P/.test(p) || /draft-two/.test(p);
    const third = (p) => state.sectionsForm && (/TEST-FORM-S/.test(p) || /draft-three/.test(p));
    // The catalog carries each form whole, fields and all, because the
    // form is what says which questions a report has and the screen
    // reads them from here. It served only the code and the title until
    // now, which is why no question has ever drawn in the suite.
    if (pathname === "/api/forms") {
      return json(200, { forms: [FORM, formP(lang)].concat(state.sectionsForm ? [formS(lang)] : []) });
    }
    if (method === "GET" && /^\/api\/forms\/drafts\//.test(pathname)) {
      if (third(pathname)) return json(200, { draft: draftS(state, lang), form: formS(lang) });
      return second(pathname) ? json(200, { draft: draftP(state, lang), form: formP(lang) }) : json(200, { draft: draftOf(state), form: FORM });
    }
    if (method === "POST" && /^\/api\/forms\/[^/]+\/drafts$/.test(pathname)) {
      if (third(pathname)) return json(200, { draft: draftS(state, lang), form: formS(lang) });
      return second(pathname) ? json(200, { draft: draftP(state, lang), form: formP(lang) }) : json(200, { draft: draftOf(state), form: FORM });
    }
    if (method === "PATCH" && /^\/api\/forms\/drafts\//.test(pathname)) {
      const bag = third(pathname) ? state.answersS : second(pathname) ? state.answersP : state.answers;
      const written = (body && body.answers) || {};
      // A sign-off is never written this way, which is what the API says.
      const signoff = Object.keys(written).find(k => /Sign$/.test(k));
      if (second(pathname) && signoff) return json(400, { error: "A sign-off is made with its own button" });
      Object.keys(written).forEach((k) => { if (written[k] === null) delete bag[k]; else bag[k] = written[k]; });
      if (third(pathname)) return json(200, { draft: draftS(state, lang), form: formS(lang) });
      return second(pathname) ? json(200, { draft: draftP(state, lang), form: formP(lang) }) : json(200, { draft: draftOf(state), form: FORM });
    }
    if (method === "POST" && /^\/api\/forms\/drafts\/[^/]+\/submit$/.test(pathname)) {
      if (third(pathname)) {
        const short = draftS(state, lang).missing;
        if (short.length > 0) return json(400, { error: "Answer every required question before sending", missing: short });
        return json(200, { ok: true, reference: "TEST-FORM-S-0001" });
      }
      if (second(pathname)) {
        const short = formPMissing(state.answersP, lang);
        if (short.length > 0) {
          return json(400, { error: "Answer every required question before sending", missing: short.map(m => m.key), missingFields: short });
        }
        return json(200, { ok: true, reference: "TEST-FORM-P-0001" });
      }
      const missing = FORM.fields.filter(f => f.required && !state.answers[f.key]).map(f => f.key);
      if (missing.length > 0) return json(400, { error: "Answer every required question before sending", missing: missing });
      return json(200, { ok: true, reference: "OCSA-FIX-101-0001" });
    }
    // One sign-off, made with its own button, stamped by the server with
    // the person signing and the clock.
    if (method === "POST" && /^\/api\/forms\/responses\/[^/]+\/signoff$/.test(pathname)) {
      const wanted = String((body && body.key) || "");
      const field = formP(lang).fields.find(f => f.key === wanted && f.type === "signoff");
      if (!field) return json(400, { error: "That is not a sign-off on this form" });
      if (field.signer !== "filer") return json(403, { error: "You cannot sign this part of the form" });
      if (state.answersP[wanted]) return json(409, { error: "This part is already signed" });
      state.answersP[wanted] = {
        userId: state.person.id, name: state.person.firstName + " " + state.person.lastName,
        role: state.person.role, at: iso(NOW.getTime()),
      };
      return json(200, { response: draftP(state, lang) });
    }
    if (method === "GET" && /^\/api\/forms\/[^/]+$/.test(pathname)) {
      if (third(pathname)) return json(200, { form: formS(lang) });
      return second(pathname) ? json(200, { form: formP(lang) }) : json(200, { form: FORM });
    }

    // --- reporting and supplies
    if (key === "GET /api/issues") return json(200, []);
    if (key === "POST /api/issues") return json(200, { issue: { id: "iss-1" } });
    if (method === "POST" && /^\/api\/issues\/[^/]+\/photos$/.test(pathname)) return json(200, { ok: true });
    if (key === "GET /api/supplies") return json(200, [{ id: "sup-1", name: "Paper towels", qr_code: "QR-0001", unit: "rolls", is_low: true }]);
    if (key === "POST /api/supplies/log-usage") return json(200, { message: "Usage logged", log: { id: "log-1", supply_name: "Paper towels", quantity: 1 }, lowStockAlert: false });
    if (key === "POST /api/supplies/requests") return json(200, { ok: true });

    // --- inspections
    if (pathname === "/api/inspections/scheduled" && method === "GET") return json(200, state.inspections.map(i => Object.assign({}, i, { items: undefined, gone: undefined })));
    if (method === "GET" && /^\/api\/inspections\/scheduled\/[^/]+$/.test(pathname)) {
      const one = state.inspections.find(i => pathname.endsWith("/" + i.id) && !i.gone);
      return one ? json(200, one) : json(404, { error: "Inspection not found" });
    }
    if (pathname === "/api/inspections/scheduled") return json(200, []);
    if (key === "GET /api/inspections/templates") return json(200, []);
    if (method === "PATCH" && /^\/api\/inspections\/scheduled\//.test(pathname)) return json(200, { ok: true });
    if (key === "POST /api/inspections/scheduled") return json(200, { ok: true });

    // --- Speak Up
    //
    // The picker's list: every active person, name and id, sorted by last
    // name, with the caller left out. A case can empty it or make it fail.
    if (key === "GET /api/hr-cases/people") {
      return json(200, { people: state.staff.filter(p => p.id !== state.person.id) });
    }
    if (key === "GET /api/contacts/case-subjects") return json(200, { subjects: [{ id: "p-1", name: "A shift supervisor", title: "Supervisor" }, { id: "p-2", name: "An area manager", title: "Area Manager" }] });
    // Filing. The body carries what was written, whether it is about
    // someone in management, and the people it names. Each refusal below
    // is the API's own, word for word, and a case asks for one by name.
    if (key === "POST /api/hr-cases") {
      const said = body || {};
      const ids = Array.isArray(said.subjectUserIds) ? said.subjectUserIds : [];
      if (said.aboutManagement !== true && said.aboutManagement !== false) return json(400, { error: HR_CASE_REFUSALS[0] });
      if (said.aboutManagement === true && ids.length === 0) return json(400, { error: HR_CASE_REFUSALS[1] });
      if (ids.indexOf(state.person.id) !== -1) return json(400, { error: HR_CASE_REFUSALS[2] });
      if (ids.some(id => !state.staff.some(p => p.id === id))) return json(400, { error: HR_CASE_REFUSALS[3] });
      if (ids.length > 10) return json(400, { error: HR_CASE_REFUSALS[4] });
      state.filed.push(said);
      return json(201, { id: "hr-case-one", status: "open", createdAt: iso(NOW), updatedAt: iso(NOW) });
    }

    // --- the bell
    if (pathname === "/api/notifications/unread-count") return json(200, { unread: state.notifications.filter(n => !n.readAt).length });
    if (pathname === "/api/notifications") return json(200, { unread: state.notifications.filter(n => !n.readAt).length, notifications: state.notifications });
    if (method === "POST" && /^\/api\/notifications\/[^/]+\/read$/.test(pathname)) return json(200, { ok: true });
    if (key === "POST /api/notifications/read-all") return json(200, { ok: true });

    // --- photos
    if (pathname === "/api/uploads") {
      if (state.uploadsFail) return json(500, { error: "Photo upload failed" });
      return json(200, { url: "https://example.invalid/photo.jpg", path: "agent-photos/one.jpg" });
    }

    // Anything not named above answers plainly rather than hanging, and
    // the call is on the record either way.
    return json(200, { ok: true });
  }

  state.answers = {};
  // Every string is recorded as a name, a word or a code, so the Spanish
  // check knows what the screens were given. A Help reply is drawn a line,
  // a step and a bold phrase at a time, and heard whole by a screen
  // reader, so each of those is recorded as well, beside the same of the
  // Spanish twin.
  function recordWord(v, kind) {
    if (kind === "name") { state.served.add(v); return; }
    if (kind === "code") { state.codes.add(v); return; }
    const en = TWIN_ES.has(v) ? v : (TWIN_EN.get(v) || v);
    const es = TWIN_ES.has(v) ? TWIN_ES.get(v) : (TWIN_EN.has(v) ? v : null);
    state.words.set(v, { value: v, en: en, es: es, kind: kind });
    if (kind !== "Help reply") return;
    // What a screen reader hears once the answer is done, beside the
    // same of the Spanish twin.
    const heard = replySpoken(v);
    if (heard !== v && !state.words.has(heard)) state.words.set(heard, { value: heard, en: replySpoken(en), es: es ? replySpoken(es) : null, kind: kind });
    const drawn = replyPieces(v), enPieces = replyPieces(en), esPieces = es ? replyPieces(es) : [];
    if (drawn.length < 2) return;
    drawn.forEach((p, i) => {
      if (state.words.has(p)) return;
      const pe = enPieces.length === drawn.length ? enPieces[i] : p;
      const ps = esPieces.length === drawn.length ? esPieces[i] : null;
      state.words.set(p, { value: p, en: pe, es: ps, kind: kind });
    });
  }

  // Every answer goes through here on its way out. A word of a kind the
  // live API already sends in Spanish is served in the language the
  // request asked for, and every string is recorded.
  function translate(data, method, pathname, search, accept) {
    const kindOf = kindsFor(method, pathname);
    const signedOut = SIGNED_OUT.some(re => re.test(method + " " + pathname));
    const spanish = (signedOut ? signedOutLanguage(search, accept) : languageOf(search, state)) === "es";
    const walk = (v, field) => {
      if (typeof v === "string") {
        const kind = kindOf(field);
        const out = (spanish && (signedOut || LIVE_KINDS.has(kind)) && TWIN_ES.has(v)) ? TWIN_ES.get(v) : v;
        recordWord(out, kind);
        return out;
      }
      if (Array.isArray(v)) return v.map(x => walk(x, field));
      if (v && typeof v === "object") {
        const o = {};
        Object.keys(v).forEach((k) => { o[k] = walk(v[k], k); });
        return o;
      }
      return v;
    };
    return walk(data, "");
  }

  function remember(answer, method, pathname, search, accept) {
    // A stream's events are each an answer of their own, and each goes
    // through the same reading on its way out.
    if (answer && answer.stream) {
      answer.stream.steps.forEach((s) => { if (s.data) s.data = translate(s.data, method, pathname, search, accept); });
      return answer;
    }
    if (!answer || typeof answer.body !== "string") return answer;
    let data;
    try { data = JSON.parse(answer.body); } catch (e) { return answer; }
    return Object.assign({}, answer, { body: JSON.stringify(translate(data, method, pathname, search, accept)) });
  }

  // peek reads what the API would answer right now without asking it, so
  // nothing is recorded: what the status would count, a list as a request
  // would get it, and the open session. A journey judges a screen by it.
  const peek = { progress: () => progress(), rows: (siteId, search) => tasks(siteId, search), session: () => sessionOf() };
  return { handle: (method, pathname, search, body, accept, headers) => remember(handle(method, pathname, search, body, headers), method, pathname, search, accept), state: state, peek: peek };
}

function draftOf(state) {
  const answered = FORM.fields.filter(f => state.answers[f.key]).length;
  return {
    id: "draft-one", formCode: FORM.code, formName: FORM.title,
    answers: Object.assign({}, state.answers),
    status: "draft", answered: answered, remaining: FORM.fields.length - answered,
    missing: FORM.fields.filter(f => f.required && !state.answers[f.key]).map(f => f.key),
  };
}

module.exports = { createStub, servedFor, replyPieces, HELP_ANSWERS, HELP_REFUSALS, helpReply, NOW, PERSON, SECOND_PERSON, SITES, STAFF, LEAVE_TYPES, LOOKUPS, INSPECTION, INSPECTION_GONE, SIGNED_OUT, TIME_OFF_REFUSALS, HR_CASE_REFUSALS, PIN_REFUSALS, FORM, FORM_P_CODE, FORM_P_WORDS, TWIN_ES, LIVE_KINDS, SITE_TASKS, SHIFT_ORDER, LINKS, taskWords, lookupsIn, formP, formS, timeOffRow, ymd, iso, DAY,
  SHIFT_REFUSALS, NOT_YOUR_CHECK, WEST_SHIFT_NAMES, CATEGORY_CODES, PERIODS, FIRST_NAMES, refusalIn, shiftsFor,
  ADMIN_PERSON, CHAT_SITES, CHAT_GENERAL, CHAT_STAFF, CHAT_SEND_REFUSALS, CHAT_UNCODED_REFUSALS, CHAT_TEXT_MAX, OWN_PRIVATE, staffPrivate, chatSeed,
  API_REFUSALS, localeFault, localeRows };
