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
// not show today. Every row carries touchpoint (Step 238) and critical
// (Step 247), false unless the item says otherwise; the API stores
// critical only on a touchpoint.
const TASK_ROW = { building_name: null, floor_number: null, zone: null, task_type: "standard", shift_label: null, block_label: null, anchor_time: null, block_sort_order: null, cims_category: "SD", period: "today", every: "daily", touchpoint: false, critical: false };
const taskRow = (o) => Object.assign({}, TASK_ROW, o);
const SITE_TASKS = {
  // Some people here are linked to particular items and most are not.
  // The open shift puts this person on Main Hall's second floor; the rest
  // are elsewhere on the site, and two carry no building and no floor.
  // The entry doors are a critical touchpoint and the corridor a
  // touchpoint (Step 249), one each, so the smoke check sees both chips.
  "site-north": [
    taskRow({ id: "task-1", label: "Wipe the entry doors and handles", zone: "Entrance", building_name: "Main Hall", floor_number: "2", priority: "high", has_details: true, description: "Work top to bottom.", touchpoint: true, critical: true }),
    taskRow({ id: "task-2", label: "Empty every bin on the floor", zone: "Entrance", building_name: "Main Hall", floor_number: "2" }),
    taskRow({ id: "task-3", label: "Mop the corridor end to end", zone: "Corridor", building_name: "Main Hall", floor_number: "2", touchpoint: true }),
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

// Each capability and the tiers that hold it by default, as the API's
// middleware/capabilities.js lists them. Nobody here holds an override.
const CAPABILITIES = {
  manage_permissions: ["admin"], manage_settings: ["admin"], manage_lookups: ["admin"], manage_staff: ["admin"],
  manage_sites: ["admin"], manage_integrations: ["admin"], manage_tasks: ["admin", "supervisor"],
  manage_inspections: ["admin", "supervisor"], manage_time: ["admin"], manage_schedule: ["admin", "supervisor"],
  approve_time_off: [], manage_supplies: ["admin"], manage_vendors: ["admin"], view_reports: ["admin", "supervisor"],
  read_incident_reports: ["admin"], export_payroll: ["admin"], manage_admins: [], send_announcements: ["admin"],
  view_help_insights: ["admin"],
};

// One scheduled inspection and the items it asks about. The template's
// name, each item and each item's zone are English, the way the live API
// sends them.
const INSPECTION = {
  id: "in-1", template_name: "Lobby walk", site_id: "site-north", site_name: "North Building", scheduled_date: "2026-10-02", status: "scheduled",
  items: [
    { id: "it-1", label: "Glass doors are free of smudges", zone: "Lobby", max_score: 5, cims_category: "SD" },
    { id: "it-2", label: "Floor mats are straight and dry", zone: "Lobby", max_score: 5, cims_category: "SD" },
  ],
};
// Step 255: an inspection of three cards for the findings check, opened
// by a stub whose findings switch is on. Two of its cards open a
// finding and one is fine, so the whole scores 11 of 15 and lands in
// the failed band (70 to 79.9), which requires a corrective action.
const INSPECTION_F = {
  id: "in-f", template_name: "Invented lobby walk", site_id: "site-north", site_name: "North Building", scheduled_date: "2026-10-05", status: "scheduled",
  items: [
    { id: "if-1", label: "Glass doors are free of smudges", zone: "Lobby", max_score: 5 },
    { id: "if-2", label: "Floor mats are straight and dry", zone: "Lobby", max_score: 5 },
    { id: "if-3", label: "Waste bins are emptied and lined", zone: "Lobby", max_score: 5 },
  ],
};
// Step 258: what GET /api/training/me answers (the Step 256 contract),
// behind the training switch: one item of each status and two records,
// every topic invented. trainingNone answers a person with nothing
// required.
const TRAINING_ME = {
  asOf: "2026-10-05",
  items: [
    { topicId: "tp-1", name: "Invented hazard communication", docCode: "OCSA-HR-009", docSection: "3", safetyCritical: true, siteId: null, siteName: null, status: "missing", completedDate: null, expiresOn: null, recordId: null, attemptId: null, lesson: null },
    { topicId: "tp-5", name: "Invented mandated reporter course", docCode: "OCSA-HR-006", docSection: "3", safetyCritical: false, siteId: null, siteName: null, status: "missing", completedDate: null, expiresOn: null, recordId: null, attemptId: null, lesson: null, linkUrl: "https://courses.example.invalid/invented-mandated-reporter" },
    { topicId: "tp-2", name: "Invented ladders", docCode: "OCSA-HR-016", docSection: "5", safetyCritical: true, siteId: null, siteName: null, status: "expired", completedDate: "2025-09-01", expiresOn: "2026-09-01", recordId: "tr-9", attemptId: null, lesson: null },
    { topicId: "tp-3", name: "Invented site orientation", docCode: "OCSA-HR-005", docSection: "2", safetyCritical: false, siteId: "site-north", siteName: "North Building", status: "refresherDue", completedDate: "2026-02-03", expiresOn: null, recordId: "tr-7", attemptId: null, lesson: null },
    { topicId: "tp-4", name: "Invented protective equipment", docCode: "OCSA-HR-012", docSection: "4", safetyCritical: true, siteId: null, siteName: null, status: "dueSoon", completedDate: "2025-10-20", expiresOn: "2026-10-20", recordId: "tr-8", attemptId: null, lesson: null },
    { topicId: "tp-6", name: "Invented injury reporting", docCode: "OCSA-HR-013", docSection: "2", safetyCritical: true, siteId: null, siteName: null, status: "current", completedDate: "2026-06-10", expiresOn: "2027-06-10", recordId: "tr-6", attemptId: null, lesson: null },
  ],
  records: [
    { id: "tr-8", name: "Invented protective equipment", completedDate: "2025-10-20", expiresOn: "2026-10-20", score: null, siteName: "South Building", locale: "es" },
    { id: "tr-6", name: "Invented injury reporting", completedDate: "2026-06-10", expiresOn: "2027-06-10", score: 95, siteName: "North Building", locale: "en" },
  ],
};
// Step 261: the lessons behind two of the items (the contract's slice
// 2), every word invented. The first needs a trainer and is written in
// English and Spanish; the second needs none and is English alone. Each
// has five questions; the right option is kept here and never served.
// TRAINING_AWAITING is an attempt another person passed and signed,
// waiting for a supervisor's sign-off at North Building.
// Step 267 (the Step 266 contract, sections 2 to 4), behind the
// trainingPortal switch: the fixed categories in order, each topic's
// category and place (tp-5 and tp-3 have none, and are answered under
// other), the checklist that signs tp-1 off, and the two pictures in the
// ladders lesson: a drawing (svg) and a photo (path), the photo served
// from an invented storage host through a signed address, the way the
// API's storage serves one.
const TRAINING_CATEGORIES = [
  { key: "start_here", en: "Start here", es: "Para empezar", fr: "Pour commencer" },
  { key: "safety", en: "Safety at work", es: "Seguridad en el trabajo", fr: "S\u00e9curit\u00e9 au travail" },
  { key: "chemicals", en: "Chemicals", es: "Productos qu\u00edmicos", fr: "Produits chimiques" },
  { key: "cleaning_methods", en: "Cleaning methods", es: "M\u00e9todos de limpieza", fr: "M\u00e9thodes de nettoyage" },
  { key: "floor_care", en: "Floor care", es: "Cuidado de pisos", fr: "Entretien des sols" },
  { key: "equipment", en: "Equipment", es: "Equipo", fr: "\u00c9quipement" },
  { key: "customer_service", en: "Customer service", es: "Servicio al cliente", fr: "Service \u00e0 la client\u00e8le" },
  { key: "site_security", en: "Building security", es: "Seguridad del edificio", fr: "S\u00e9curit\u00e9 du b\u00e2timent" },
  { key: "supervisors", en: "For supervisors", es: "Para supervisores", fr: "Pour les superviseurs" },
  { key: "other", en: "Other trainings", es: "Otras capacitaciones", fr: "Autres formations" },
];
const TRAINING_TOPIC_PLACE = {
  "tp-6": { category: "start_here", sortOrder: 100 },
  "tp-1": { category: "safety", sortOrder: 100, signoffTopicId: "tp-4" },
  "tp-2": { category: "safety", sortOrder: 200 },
  "tp-4": { category: "safety", sortOrder: 300 },
  "tp-5": { category: null, sortOrder: 100 },
  "tp-3": { category: null, sortOrder: 200 },
};
const LESSON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" role="img"><rect width="320" height="200" rx="12" fill="#EEF3F9"/><path d="M110 176 L140 24 M210 176 L180 24" stroke="#8A5F10" stroke-width="10" stroke-linecap="round"/><path d="M118 150h84M124 118h72M130 86h60M136 54h48" stroke="#8A5F10" stroke-width="8" stroke-linecap="round"/><circle cx="110" cy="178" r="9" fill="#2ECC71"/><circle cx="210" cy="178" r="9" fill="#2ECC71"/><circle cx="160" cy="86" r="9" fill="#2ECC71"/><text x="18" y="192" font-family="sans-serif" font-size="14" fill="#1B3058">Feet, rungs and locks, invented</text></svg>';
const LESSON_IMAGE_PATH = "lessons/11111111-2222-4333-8444-555555555555.png";
const LESSON_IMAGE_ID = "11111111-2222-4333-8444-555555555555";
const LESSON_IMAGE_HOST = "https://files.example.invalid";
const lessonImageSrc = (p) => LESSON_IMAGE_HOST + "/api/lesson-images/signed/" + String(p).replace(/^lessons\//, "").replace(/\.(jpg|png|webp)$/, "") + ".png?token=invented-signature";
// A small PNG drawn here, so the photo is a real file the browser decodes
// rather than a one-pixel stand-in: 48 by 32, a ladder's top two rungs in
// red over gray.
function crc32(buf) { let crc = 0xFFFFFFFF; for (let n = 0; n < buf.length; n += 1) { let c = (crc ^ buf[n]) & 0xFF; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xFFFFFFFF) >>> 0; }
function pngOf(w, h, pixel) {
  const zlib = require("zlib");
  const rows = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y += 1) { for (let x = 0; x < w; x += 1) { const px = pixel(x, y); const at = y * (w * 3 + 1) + 1 + x * 3; rows[at] = px[0]; rows[at + 1] = px[1]; rows[at + 2] = px[2]; } }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0); const td = Buffer.concat([Buffer.from(type, "ascii"), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}
const LESSON_PNG = pngOf(48, 32, (x, y) => (x >= 14 && x <= 33 && (y === 8 || y === 16) ? [231, 76, 60] : (x === 14 || x === 33) && y >= 4 ? [138, 95, 16] : [210, 219, 230]));
// Step 271 (the Step 270 contract, section 2), behind the signatures
// switch: three requests sent to the person's phone, a key, a pair of
// gloves and a written warning, each waiting; and the person's company
// property, the key waiting for its signature, a shirt signed on the
// office screen and a badge returned. Every value invented. The title and
// the statement are served in the request's language, as the API writes
// them.
const SIGN_WORDS = {
  property_issue: { title: { en: "Sign for your {item}", es: "Firme por su {item}" }, statement: { en: "I received {quantity} {item} on {date}. I will take care of it and return it when I leave OCSA or when asked.", es: "Recib\u00ed {quantity} {item} el {date}. Lo cuidar\u00e9 y lo devolver\u00e9 cuando deje OCSA o cuando me lo pidan." } },
  ppe_issue: { title: { en: "Sign for the PPE you received", es: "Firme por el EPP que recibi\u00f3" }, statement: { en: "I received {quantity} {item} on {date}, and I know how to wear it and care for it.", es: "Recib\u00ed {quantity} {item} el {date}, y s\u00e9 c\u00f3mo usarlo y cuidarlo." } },
  warning: { title: { en: "Sign for a written warning", es: "Firme por una amonestaci\u00f3n escrita" }, statement: { en: "Signing confirms I received this warning. It does not mean I agree.", es: "Firmar confirma que recib\u00ed esta amonestaci\u00f3n. No significa que est\u00e9 de acuerdo." } },
};
const PROPERTY_KIND_WORDS = { key: { en: "Key", es: "Llave" }, badge: { en: "Badge", es: "Gafete" }, fob: { en: "Fob", es: "Llavero" }, uniform_shirt: { en: "Uniform shirt", es: "Camisa de uniforme" }, uniform_other: { en: "Other uniform", es: "Otro uniforme" }, other: { en: "Other", es: "Otro" } };
const SIGN_SEED = [
  { id: "sr-1", kind: "property_issue", subjectId: "pi-1", item: { kind: "key", label: null, quantity: 1, size: null, siteId: "site-north", date: "2026-10-06" }, state: "waiting", requestedAt: "2026-10-06T14:05:00Z", requestedBy: "Jordan Office", signedAt: null, signedWhere: null, disputeNote: null, reminders: 0, warning: null },
  { id: "sr-2", kind: "ppe_issue", subjectId: "ppe-1", item: { kind: null, label: "Invented nitrile gloves", quantity: 2, size: "M", siteId: "site-north", date: "2026-10-06" }, state: "waiting", requestedAt: "2026-10-06T14:10:00Z", requestedBy: "Jordan Office", signedAt: null, signedWhere: null, disputeNote: null, reminders: 0, warning: null },
  { id: "sr-3", kind: "warning", subjectId: "da-1", item: { kind: null, label: null, quantity: null, size: null, siteId: null, date: "2026-10-05" }, state: "waiting", requestedAt: "2026-10-06T14:20:00Z", requestedBy: "Jordan Office", signedAt: null, signedWhere: null, disputeNote: null, reminders: 0, warning: { level: "written_warning", date: "2026-10-05", summary: "Invented: arrived late three times in September after a verbal warning.", pdfUrl: "/api/signatures/sr-3/warning.pdf" } },
];
const PROPERTY_SEED = [
  { id: "pi-1", kind: "key", description: null, size: null, quantity: 1, siteId: "site-north", issuedOn: "2026-10-06", issuedBy: "Jordan Office", note: null, returnedOn: null, requestId: "sr-1" },
  { id: "pi-2", kind: "uniform_shirt", description: null, size: "L", quantity: 2, siteId: null, issuedOn: "2026-09-01", issuedBy: "Jordan Office", note: null, returnedOn: null, requestId: null, signedWhere: "office" },
  { id: "pi-3", kind: "badge", description: null, size: null, quantity: 1, siteId: "site-south", issuedOn: "2026-03-02", issuedBy: "Jordan Office", note: null, returnedOn: "2026-08-30", requestId: null, signedWhere: "office" },
];
// Step 281: an API with Step 280 built, behind the supplyItems switch.
// The catalog the request form offers, and the person's requests as GET
// /api/supplies/requests answers them, each with its items: one refill
// the office decided, three of five paper towels approved and the glass
// cleaner denied with a note, and another person's request, which the
// API answers management alone. Every value invented.
const SUPPLY_CATALOG = [
  { id: "sup-1", name: "Paper towels", qr_code: "QR-0001", unit: "rolls", is_low: true },
  { id: "sup-2", name: "Invented hand soap", qr_code: "QR-0002", unit: "bottles", is_low: false },
  { id: "sup-3", name: "Invented trash liners", qr_code: "QR-0003", unit: "boxes", is_low: false },
  { id: "sup-4", name: "Invented glass cleaner", qr_code: "QR-0004", unit: "bottles", is_low: false },
];
const SUPPLY_DENY_NOTE = "Invented: the closet still holds four.";
const supplyLine = (id, sup, quantity, extra) => Object.assign({ id: id, supplyId: sup ? sup.id : null, name: sup ? sup.name : "", unit: sup ? sup.unit : "", quantity: quantity, note: null, decision: null, approvedQuantity: null, decisionNote: null, decidedAt: null, decidedBy: null }, extra || {});
const SUPPLY_REQ_SEED = () => [
  { id: "sreq-2", requested_by: "u-two", requested_by_name: "Sam Second", site_id: "site-north", site_name: "North Building", supply_id: "sup-2", supply_name: "Invented hand soap", request_type: "refill", item_name: null, description: null, urgency: "normal", status: "pending", admin_notes: null, handled_by: null, handled_at: null, created_at: "2026-10-01T15:00:00Z",
    items: [supplyLine("sri-3", SUPPLY_CATALOG[1], 4)] },
  { id: "sreq-1", requested_by: "u-one", requested_by_name: "Alex Tester", site_id: "site-north", site_name: "North Building", supply_id: "sup-1", supply_name: "Paper towels", request_type: "refill", item_name: null, description: "For the lobby restrooms, invented.", urgency: "normal", status: "approved", admin_notes: null, handled_by: "u-admin", handled_at: "2026-09-30T16:00:00Z", created_at: "2026-09-29T14:00:00Z",
    items: [
      supplyLine("sri-1", SUPPLY_CATALOG[0], 5, { decision: "approved", approvedQuantity: 3, decidedAt: "2026-09-30T16:00:00Z", decidedBy: { name: "Jordan Office" } }),
      supplyLine("sri-2", SUPPLY_CATALOG[3], 2, { decision: "denied", decisionNote: SUPPLY_DENY_NOTE, decidedAt: "2026-09-30T16:00:00Z", decidedBy: { name: "Jordan Office" } }),
    ] },
];
const SUPPLY_TYPES = ["refill", "damage_report", "new_gear", "new_supply"];

// The warning's document, served at the API's own path behind the token
// (Step 270 as built): a one-page PDF with one line, invented.
const WARNING_PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 58>>stream\nBT /F1 18 Tf 24 90 Td (Invented written warning) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n", "latin1");
const SIGN_REFUSALS = {
  "signatures.notFound": { status: 404, en: "This signature request was not found.", es: "No se encontr\u00f3 esta solicitud de firma." },
  "signatures.notYours": { status: 403, en: "This signature request is not yours.", es: "Esta solicitud de firma no es suya." },
  "signatures.notOpen": { status: 409, en: "This signature request is already done.", es: "Esta solicitud de firma ya est\u00e1 resuelta." },
  "signatures.signatureRequired": { status: 400, en: "Sign before you send.", es: "Firme antes de enviar." },
  "signatures.cannotDispute": { status: 409, en: "A warning cannot be sent back. You can decline to sign it.", es: "Una amonestaci\u00f3n no se puede devolver. Puede negarse a firmarla." },
  "signatures.cannotDecline": { status: 409, en: "Only a warning can be declined.", es: "Solo una amonestaci\u00f3n se puede rechazar." },
  "signatures.noteTooLong": { status: 400, en: "The note is too long.", es: "La nota es demasiado larga." },
};
const lessonWords = (en, es) => ({ en: en, es: es || en });
const TRAINING_LESSONS = [
  {
    versionId: "lv-1", topicId: "tp-1", version: 2, passPercent: 80, maxAttempts: 3, needsTrainer: true, locales: ["en", "es"],
    title: lessonWords("Invented hazard communication", "Comunicaci\u00f3n de riesgos inventada"),
    blocks: [
      { key: "b1", kind: "text", text: lessonWords("Every product at a site has a label and a safety sheet. Read the label before you open the bottle.", "Cada producto en un sitio tiene una etiqueta y una hoja de seguridad. Lea la etiqueta antes de abrir el envase."), items: [], source: { docCode: "OCSA-HR-009", sectionRef: "3.1" } },
      { key: "b2", kind: "list", text: lessonWords("The label tells you:", "La etiqueta le dice:"), items: [lessonWords("what the product is", "qu\u00e9 es el producto"), lessonWords("what it can do to you", "qu\u00e9 puede hacerle"), lessonWords("what to wear when you use it", "qu\u00e9 debe ponerse para usarlo")], source: null },
      { key: "b3", kind: "warning", text: lessonWords("Never mix two products. Bleach and ammonia together make a gas that can hurt you.", "Nunca mezcle dos productos. El cloro y el amoniaco juntos producen un gas que puede hacerle da\u00f1o."), items: [], source: { docCode: "OCSA-HR-009", sectionRef: "3.4" } },
    ],
    questions: [
      { key: "q1", text: lessonWords("Before you open a product for the first time, you:", "Antes de abrir un producto por primera vez, usted:"), options: [{ value: "a", text: lessonWords("Read its label", "Lee su etiqueta") }, { value: "b", text: lessonWords("Smell it", "Lo huele") }, { value: "c", text: lessonWords("Ask a coworker what it is", "Le pregunta a un compa\u00f1ero qu\u00e9 es") }], correct: "a" },
      { key: "q2", text: lessonWords("Where is a product's safety sheet?", "\u00bfD\u00f3nde est\u00e1 la hoja de seguridad de un producto?"), options: [{ value: "a", text: lessonWords("In the safety data sheets under More", "En las hojas de seguridad bajo M\u00e1s") }, { value: "b", text: lessonWords("There is none", "No hay") }], correct: "a" },
      { key: "q3", text: lessonWords("Two products can be mixed when:", "Dos productos se pueden mezclar cuando:"), options: [{ value: "a", text: lessonWords("Never", "Nunca") }, { value: "b", text: lessonWords("Both are cleaners", "Los dos son limpiadores") }, { value: "c", text: lessonWords("The bottle is almost empty", "El envase est\u00e1 casi vac\u00edo") }], correct: "a" },
      { key: "q4", text: lessonWords("A bottle with no label is:", "Un envase sin etiqueta es:"), options: [{ value: "a", text: lessonWords("Set aside and reported to your supervisor", "Apartado y reportado a su supervisor") }, { value: "b", text: lessonWords("Used up first", "Usado primero") }], correct: "a" },
      { key: "q5", text: lessonWords("The label says to wear gloves. You:", "La etiqueta dice que use guantes. Usted:"), options: [{ value: "a", text: lessonWords("Wear gloves", "Usa guantes") }, { value: "b", text: lessonWords("Wear gloves when a supervisor is there", "Usa guantes cuando hay un supervisor") }], correct: "a" },
    ],
    acknowledgement: lessonWords("I read this lesson and I understand it.", "Le\u00ed esta lecci\u00f3n y la entiendo."),
  },
  {
    versionId: "lv-2", topicId: "tp-2", version: 1, passPercent: 80, maxAttempts: 3, needsTrainer: false, locales: ["en"],
    title: lessonWords("Invented ladders"),
    blocks: [
      { key: "b1", kind: "text", text: lessonWords("Check a ladder before you climb it: the feet, the rungs and the locks."), items: [], source: { docCode: "OCSA-HR-016", sectionRef: "5.2" } },
      { key: "b2", kind: "warning", text: lessonWords("Never stand on the top two rungs."), items: [], source: null },
      { key: "b3", kind: "image", svg: LESSON_SVG, path: null, alt: lessonWords("A step ladder with its feet, rungs and locks marked"), caption: lessonWords("Check these three before you climb.") },
      { key: "b4", kind: "image", svg: null, path: LESSON_IMAGE_PATH, alt: lessonWords("The top two rungs of a ladder, marked in red"), caption: lessonWords("") },
    ],
    questions: [
      { key: "q1", text: lessonWords("Before you climb a ladder, you check:"), options: [{ value: "a", text: lessonWords("The feet, the rungs and the locks") }, { value: "b", text: lessonWords("The weather") }], correct: "a" },
      { key: "q2", text: lessonWords("You may stand on the top rung:"), options: [{ value: "a", text: lessonWords("Never") }, { value: "b", text: lessonWords("When someone holds the ladder") }], correct: "a" },
      { key: "q3", text: lessonWords("A ladder with a cracked rung is:"), options: [{ value: "a", text: lessonWords("Tagged out and reported") }, { value: "b", text: lessonWords("Used with care") }], correct: "a" },
      { key: "q4", text: lessonWords("You carry tools up a ladder:"), options: [{ value: "a", text: lessonWords("In a belt or a bucket on a line") }, { value: "b", text: lessonWords("In your hands") }], correct: "a" },
      { key: "q5", text: lessonWords("A ladder is set up on:"), options: [{ value: "a", text: lessonWords("Firm, level ground") }, { value: "b", text: lessonWords("Whatever is there") }], correct: "a" },
    ],
    acknowledgement: lessonWords("I read this lesson and I understand it."),
  },
];
const TRAINING_AWAITING = { id: "ta-7", versionId: "lv-1", topicId: "tp-1", personId: SECOND_PERSON.id, personName: SECOND_PERSON.firstName + " " + SECOND_PERSON.lastName, attemptNo: 1, locale: "en", siteId: "site-north", startedAt: "2026-10-04T15:02:00Z", scoredAt: "2026-10-04T15:18:00Z", scorePercent: 100, passed: true, missed: [], acknowledgedAt: "2026-10-04T15:20:00Z", awaitingTrainer: true, trainerSignedAt: null, trainerId: null, trainerName: null, demonstrated: false, voidedAt: null };
// The refusals the lesson routes write (the contract's section 8); the
// words are the stub's, since the contract gives none.
const TRAINING_REFUSALS = {
  "training.noLesson": { status: 404, en: "This topic has no lesson yet.", es: "Este tema todav\u00eda no tiene lecci\u00f3n." },
  "training.noAttemptsLeft": { status: 409, en: "You have no tries left on this lesson. Ask your supervisor for an in-person session.", es: "No le quedan intentos en esta lecci\u00f3n. P\u00eddale a su supervisor una sesi\u00f3n en persona." },
  "training.badAnswers": { status: 400, en: "Answer every question.", es: "Responda todas las preguntas." },
  "training.notPassed": { status: 409, en: "This attempt was not passed.", es: "Este intento no fue aprobado." },
  "training.signatureRequired": { status: 400, en: "Sign before you send.", es: "Firme antes de enviar." },
  "training.notReady": { status: 409, en: "This attempt is not waiting for a sign-off.", es: "Este intento no est\u00e1 esperando una firma." },
  "training.cannotSignOwn": { status: 403, en: "You cannot sign off your own training.", es: "No puede firmar su propia capacitaci\u00f3n." },
  "training.demonstrationRequired": { status: 400, en: "Watch the person do it before you sign.", es: "Vea a la persona hacerlo antes de firmar." },
  "training.attemptNotFound": { status: 404, en: "This attempt was not found.", es: "No se encontr\u00f3 este intento." },
  "training.noAccess": { status: 403, en: "You cannot see this.", es: "No puede ver esto." },
};
// Step 264: the Step 262 contract's answers behind the training switch,
// every value invented. A session another trainer opened at North
// Building, which a person joins by its code; the sessions a supervisor
// starts, with one sign-in arriving on the first read after the start; an
// observation checklist of three steps for a person at the site; and a
// document of three sections, in English alone, that everyone signs.
const TRAINING_SESSION_SEED = { id: "ts-1", title: "Invented ladders refresher", day: "2026-10-05", siteId: "site-north", locale: "en", trainerId: "u-trainer-other", trainerName: "Casey Trainer", topicIds: ["tp-2"], joinCode: "QR7K2M9P", status: "open", signins: [], note: "" };
const TRAINING_OBSERVATION = { versionId: "lv-3", topicId: "tp-4", version: 1, kind: "observation", maxAttempts: 3, needsTrainer: true, locales: ["en"], title: "Invented protective equipment, on the job",
  steps: [{ key: "s1", text: "Checks the gloves for tears before putting them on" }, { key: "s2", text: "Puts the glasses on before opening the product" }, { key: "s3", text: "Takes the gloves off without touching the outside" }],
  acknowledgement: "I did each step and I will do it this way every time." };
const TRAINING_DOCUMENT = { docCode: "OCSA-HR-002", title: "Invented employee handbook", version: "3", locales: ["en"],
  sections: [
    { ref: "1", title: "Welcome", content: "This handbook says how we work together. Read each section, then sign at the end.\n\nAsk your supervisor about anything that is not clear." },
    { ref: "2", title: "Your hours", content: "Start every shift from the app, and end it from the app.\n\nTell your supervisor before your shift when you cannot come in." },
    { ref: "3", title: "Safety", content: "Wear what the label says. Never mix two products. Report every injury the same day." },
  ],
  acknowledgement: { en: "I received this document, I read it, and I will follow it.", es: "Recib\u00ed este documento, lo le\u00ed y lo cumplir\u00e9.", fr: "J'ai re\u00e7u ce document, je l'ai lu et je le respecterai." } };
// The items due on the first day (the contract's section 5), by topic.
const TRAINING_FIRST_DAY = ["tp-1", "tp-3"];
// A one by one white PNG, what the QR route answers here.
const QR_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const SESSION_REFUSALS = {
  "training.sessionNotFound": { status: 404, en: "This session is not open.", es: "Esta sesi\u00f3n no est\u00e1 abierta." },
  "training.alreadySigned": { status: 409, en: "You already signed in to this session.", es: "Ya firm\u00f3 su entrada a esta sesi\u00f3n." },
  "training.understoodRequired": { status: 400, en: "Tick that you understood the training.", es: "Marque que entendi\u00f3 la capacitaci\u00f3n." },
  "training.cannotJoinOwn": { status: 403, en: "A trainer cannot sign in to their own session.", es: "Un capacitador no puede firmar su propia sesi\u00f3n." },
  "training.sessionClosed": { status: 409, en: "This session is closed.", es: "Esta sesi\u00f3n est\u00e1 cerrada." },
  "training.noSignins": { status: 400, en: "Nobody has signed in yet.", es: "Nadie ha firmado todav\u00eda." },
  "training.notObservation": { status: 409, en: "This lesson is a quiz, not a checklist.", es: "Esta lecci\u00f3n es un cuestionario, no una lista." },
  "training.stepsIncomplete": { status: 400, en: "Tick every step first.", es: "Marque todos los pasos primero." },
  "documents.notFound": { status: 404, en: "This document was not found.", es: "No se encontr\u00f3 este documento." },
  "documents.versionChanged": { status: 409, en: "This document changed. Read it again.", es: "Este documento cambi\u00f3. L\u00e9alo de nuevo." },
  "documents.alreadySigned": { status: 409, en: "You already signed this version.", es: "Ya firm\u00f3 esta versi\u00f3n." },
  "documents.signatureRequired": { status: 400, en: "Sign before you send.", es: "Firme antes de enviar." },
};
// The complete route's refusals about a finding (the Step 253 contract
// section 3, item 2); the words are the stub's, since the contract gives
// none, and the keys name the card.
const FINDING_REFUSALS = {
  "inspections.findingNoteRequired": { status: 400, en: "Say what needs fixing on this card.", es: "Diga qu\u00e9 hay que arreglar en esta tarjeta." },
  "inspections.badOwner": { status: 400, en: "Choose an owner from the list.", es: "Elija un responsable de la lista." },
};
// The band a score lands in (QMS-014 5.2), its due date from the
// completion, and the severity of each finding, as the contract's rule 2.
const findingBandOf = (pct) => (pct >= 90 ? "meets" : pct >= 80 ? "below" : pct >= 70 ? "failed" : "serious");
const FINDING_DUE_DAYS = { meets: 1, below: 3, failed: 10 };
const FINDING_SEVERITY = { meets: "low", below: "medium", failed: "high", serious: "high" };
// A long one, five items, for a case that scores several and watches the
// scored ones fold away.
const INSPECTION_LONG = {
  id: "in-long", template_name: "Restroom walk", site_id: "site-north", site_name: "North Building", scheduled_date: "2026-10-02", status: "scheduled",
  items: [
    { id: "il-1", label: "Mirrors are free of streaks", zone: "Restroom", max_score: 5, cims_category: "SD" },
    { id: "il-2", label: "Sinks are clean and dry", zone: "Restroom", max_score: 5, cims_category: "SD" },
    { id: "il-3", label: "Soap dispensers are full", zone: "Restroom", max_score: 5, cims_category: "SD" },
    { id: "il-4", label: "Floors are mopped", zone: "Restroom", max_score: 5, cims_category: "SD" },
    { id: "il-5", label: "Trash is emptied", zone: "Restroom", max_score: 5, cims_category: "SD" },
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
  // A how-to answer drawn from the app guide (Step 276 in the API), with
  // the pictures its cited entries name: the portal's own, and one of
  // the dashboard's, which the portal leaves to the dashboard.
  howTo: {
    pieces: ["Open the staff po", "rtal and type your badge num", "ber and your PIN.\n1. Tap **Sig", "n In**."],
    piecesEs: ["Abra el portal del per", "sonal y escriba su n\u00famero de empl", "eado y su PIN.\n1. Toque **Inic", "iar sesi\u00f3n**."],
    citedDocs: ["APP-PORTAL", "APP-DASHBOARD"],
    pictures: [
      { app: "portal", name: "sign-in", entry: "Sign in to the staff portal (staff portal)" },
      { app: "dashboard", name: "sign-in", entry: "Sign in to the dashboard (dashboard)" },
    ],
  },
  // One whose picture has no file in any language, which is left out.
  noFile: {
    pieces: ["Open the staff po", "rtal and type your badge num", "ber and your PIN.\n1. Tap **Sig", "n In**."],
    citedDocs: ["APP-PORTAL"],
    pictures: [{ app: "portal", name: "no-such-picture", entry: "An entry whose picture was never taken (staff portal)" }],
  },
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
// Each sentence is quoted from helpers/words.js in ocsa-api, byte for
// byte: auth.pinIncorrect, auth.pinUnchanged, auth.pinWeak and
// auth.pinFormat. The API also answers PIN_UNCHANGED with
// auth.pinSameAsGiven on a first PIN, which the portal never sends.
const PIN_REFUSALS = {
  PIN_INCORRECT: ["Current PIN is incorrect", "El PIN actual no es correcto"],
  PIN_UNCHANGED: ["New PIN must be different from your current PIN", "El PIN nuevo debe ser distinto de su PIN actual"],
  PIN_WEAK: ["Choose a PIN that is not repeated digits, a sequence, or your badge number", "Elija un PIN que no sea un mismo d\u00edgito repetido, una secuencia ni su n\u00famero de empleado"],
  PIN_FORMAT: ["PIN must be exactly 4 digits", "El PIN debe tener exactamente 4 d\u00edgitos"],
};
// A sign-in the API turns away, auth.invalidCredentials, in the words the
// Step 283 contract gives it (section 1.6; the API has not built them
// yet, so the Spanish is the portal's until the API's is written), an
// inspection the API no longer has, inspections.notFound, and an
// activation whose badge number does not match, BADGE_MISMATCH, the last
// two quoted byte for byte from helpers/words.js in both languages.
const LOGIN_REFUSAL = ["That badge number, phone, email or PIN is not right.", "Ese n\u00famero de empleado, tel\u00e9fono, correo o PIN no es correcto."];
// The rest of the sign-in the API's Step 283 answers (Step 285), written
// the same way: the 403 every route behind the token answers a person on
// a PIN they were given, and the 409 an office account with no email for
// a code meets at sign-in, from the contract's sections 1.1 and 1.7; and
// the three refusals of the code routes that send a person back to the
// PIN, quoted from helpers/words.js byte for byte.
const MUST_SET_PIN = { status: 403, en: "Choose your own PIN to go on.", es: "Elija su propio PIN para continuar." };
const NO_EMAIL_FOR_CODE = { status: 409, en: "Your account has no email we can send a code to. Ask the office to fix your email.", es: "Su cuenta no tiene un correo al que podamos enviar un c\u00f3digo. Pida a la oficina que corrija su correo." };
const CODE_EXPIRED = { status: 410, en: "This sign-in code has expired. Start again with your PIN.", es: "Este c\u00f3digo de inicio de sesi\u00f3n venci\u00f3. Empiece de nuevo con su PIN." };
const CODE_TOO_MANY = { status: 429, en: "Too many wrong codes. Start again with your PIN.", es: "Demasiados c\u00f3digos incorrectos. Empiece de nuevo con su PIN." };
const SEND_LIMIT = { status: 429, en: "No more codes for this sign-in. Start again with your PIN.", es: "No se pueden enviar m\u00e1s c\u00f3digos para este inicio de sesi\u00f3n. Empiece de nuevo con su PIN." };
// What signs in: the PIN every case types, and an office account's badge
// with no email for a code. A typed identifier misses five times in a row
// and the sixth try is locked, 429 auth.locked with the minutes, until a
// sign-in gets in.
const LOGIN_PIN = "4907";
const NO_EMAIL_BADGE = "9019";
const LOGIN_MISSES_LOCK = 5;
// The routes a person on a given PIN may still reach behind the token,
// the contract's section 1.1.
const MUST_SET_PIN_OPEN = ["GET /api/auth/me", "POST /api/auth/change-pin", "GET /api/languages/status", "GET /api/push/key"];
const INSPECTION_NOT_FOUND = ["Not found", "No se encontr\u00f3 la inspecci\u00f3n"];
const BADGE_MISMATCH = ["The badge number does not match this account.", "El n\u00famero de empleado no coincide con esta cuenta."];

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

// The incident report's second version, published after the first, whose
// second question reads differently. With stubOptions.formVersions the
// catalog lists this one, the latest, while a draft started on the first
// is sent beside the first.
const FORM_V2 = Object.assign({}, FORM, { version: 2, fields: FORM.fields.map(f => (f.key === "where" ? Object.assign({}, f, { label: "Which room was it in" }) : f)) });

// The forms the Help guide names by title (Step 277), so npm run shots
// can picture each one's card on Forms. Each is its title alone, in the
// words the guide gives it, and none of them opens: the stub holds none
// of their questions. Served with stubOptions.guideForms, after the two
// every case lists.
const GUIDE_FORMS = [
  ["GUIDE-DSL", "Daily Service Log", "Registro diario de servicio"],
  ["GUIDE-PPE", "PPE Compliance Log, monthly check", "Registro de cumplimiento de EPP, revisi\u00f3n mensual"],
  ["GUIDE-CCL", "Customer Complaint Log", "Registro de quejas de clientes"],
  ["GUIDE-SIC", "Safety Inspection Checklist", "Lista de inspecci\u00f3n de seguridad"],
  ["GUIDE-CAR", "Corrective Action Report", "Reporte de acci\u00f3n correctiva"],
  ["GUIDE-ECA", "Environmental Compliance Audit", "Auditor\u00eda de cumplimiento ambiental"],
  ["GUIDE-PHA", "PPE Hazard Assessment Written Verification", "Verificaci\u00f3n escrita de la evaluaci\u00f3n de riesgos para EPP"],
  ["GUIDE-SCM", "Safety Committee Minutes and Attendance", "Acta y asistencia del comit\u00e9 de seguridad"],
  ["GUIDE-PSA", "Pre-Service Site Assessment", "Evaluaci\u00f3n del sitio antes del servicio"],
  ["GUIDE-COS", "Change of Service Request", "Solicitud de cambio de servicio"],
  ["GUIDE-SOC", "Site-Specific Orientation Checklist", "Lista de orientaci\u00f3n espec\u00edfica del sitio"],
  ["GUIDE-CIL", "Call Intake and Communication Log", "Registro de llamadas y comunicaciones"],
];
const guideForms = (lang) => GUIDE_FORMS.map(([code, en, es]) => ({ code: code, title: lang === "es" ? es : en, fields: [] }));

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
    // pinGate (Step 285): the API as its Step 283 builds it. While
    // mustSetPin is true, every route behind the token answers 403
    // auth.mustSetPin but the four MUST_SET_PIN_OPEN names, and change-pin
    // answers a new token beside its message.
    pinGate: !!o.pinGate,
    // Misses at sign-in by what was typed, counted until one gets in, and
    // the second step's challenge: the codes sent, the wrong codes, and
    // whether it still works (Step 285).
    loginMisses: {},
    challenge: null,
    activationBadge: !!o.activationBadge,
    // The smoke check's switches (Step 237, audit/smoke.js), each off
    // unless a case turns it on, so every other case is answered as
    // before. languages: the list GET /api/languages answers, and a call
    // that says one of them is answered (French in English words, the
    // stub having no French twins). sds: invented safety data sheets.
    // secondStep: the right PIN is answered with the second sign-in step,
    // and SECOND_STEP_CODE signs in. workspace: an office person's
    // projects and to-dos; anyone else is turned away. customerAsks
    // (Step 240): link-asks and link-walk answer the two forms that ask
    // the person's name and role themselves. equipment (Step 240): one
    // item on the register, opened by EQ_CODE, and the events recorded on
    // it. concern (Step 244): link-concern answers OCSA-FRM-009's client
    // part and a receipt with a reference. fieldKit (Step 246): the
    // supervisor's field kit, its sites and what each tile reads, for an
    // admin or a supervisor; anyone else is turned away from its routes.
    // linkPhotos: every photo the public photo route took, for any link
    // whose form's photoRoute is true, with the id the filing names.
    languages: Array.isArray(o.languages) ? o.languages.slice() : null,
    sds: !!o.sds,
    secondStep: !!o.secondStep,
    workspace: !!o.workspace,
    customerAsks: !!o.customerAsks,
    concern: !!o.concern,
    linkPhotos: [],
    // requests (Step 252): the request links and the Client requests
    // routes, with every filing and every photo the public route took,
    // the rows as they move, and the ids a case says someone else decided
    // first. supplyQr (Step 252): the supply label's two routes.
    requests: !!o.requests,
    requestsFiled: [],
    requestPhotos: [],
    requestRows: o.requests ? REQUEST_ROWS(o.now ? new Date(o.now).getTime() : NOW.getTime()) : [],
    requestsTaken: [],
    supplyQr: !!o.supplyQr,
    equipment: !!o.equipment,
    equipmentEvents: [],
    fieldKit: !!o.fieldKit,
    ppeIssues: FK_PPE_ISSUES.map(x => Object.assign({}, x)),
    // Each review's signatures by result id, the inspector's line first.
    reviewSigs: Object.fromEntries(FK_REVIEWS.map(r => [r.resultId, [{ line: "inspector", signer_id: r.inspector.id, signer_name: r.inspector.first_name + " " + r.inspector.last_name, signed_at: r.scheduled_date + "T21:00:00.000Z" }]])),
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
    // Every draft discarded, by id.
    discarded: [],
    notifications: o.notifications || [],
    // Copied, since /complete marks one completed and the fixture is shared.
    inspections: (o.inspections || []).map(i => Object.assign({}, i)),
    // Step 145: every problem filed through POST /api/issues, in order.
    issues: [],
    // Step 255: an API with Step 253 built, which answers owners on the
    // scheduled read, opens one ticket per deficient card at completion
    // and lists them as source inspection. The first completion is turned
    // away once with findingNoteRequired on its first deficient card, laid
    // over the stub, so a check sees the refusal under the card.
    findings: o.findings === true,
    findingRows: [],
    findingRefusals: o.findings === true ? 1 : 0,
    // Step 258: an API with Step 256 built, which answers GET
    // /api/training/me; trainingNone answers it with nothing required.
    training: o.training === true || o.trainingNone === true,
    trainingNone: o.trainingNone === true,
    // Step 261: every attempt on a lesson, seeded with the one another
    // person passed and signed, waiting for a supervisor's sign-off.
    trainingAttempts: o.training === true ? [Object.assign({}, TRAINING_AWAITING)] : [],
    // Step 264: the sessions, with one another trainer opened; the
    // document acknowledgments; and the documents switch, which puts the
    // document to sign and the first-day items on GET /api/training/me.
    trainingSessions: o.training === true ? [JSON.parse(JSON.stringify(TRAINING_SESSION_SEED))] : [],
    documentAcks: [],
    documents: o.documents === true,
    // Step 267: an API with Step 266 built, which answers categories and
    // continue on GET /api/training/me, with each item's category.
    trainingPortal: o.trainingPortal === true,
    // Step 271: an API with Step 270 built, which answers the person's
    // signature requests and their company property.
    signatures: o.signatures === true,
    signRequests: o.signatures === true ? JSON.parse(JSON.stringify(SIGN_SEED)) : [],
    propertyIssues: o.signatures === true ? JSON.parse(JSON.stringify(PROPERTY_SEED)) : [],
    // Step 281: an API with Step 280 built, whose supply requests take
    // and answer items, with the person's requests seeded.
    supplyItems: o.supplyItems === true,
    // supplyEmpty (Step 285): the same API, with no request yet.
    supplyRequests: o.supplyItems === true && !o.supplyEmpty ? SUPPLY_REQ_SEED() : [],
    // The supplies at the open shift's site, which a case can answer
    // with none. null answers the one supply every case has always had.
    supplies: Array.isArray(o.supplies) ? o.supplies : o.supplyItems === true ? SUPPLY_CATALOG.map(x => Object.assign({}, x)) : null,
    // A due date on the assigned task, as the API sends one, when a case
    // gives it: a DATE column reaches JSON as that day at midnight UTC.
    assignedDue: o.assignedDue || null,
    // The open shifts this person has claimed, none unless a case says.
    myPickups: o.myPickups || [],
    // The announcements the office has sent.
    announcements: o.announcements || [ANNOUNCEMENT],
    // permissionsRoute false is an API from before Step 179, which answers
    // GET /api/users/me/permissions 404.
    permissionsRoute: o.permissionsRoute !== false,
    // Phone alerts. key is the server's public key, null when it has none,
    // and "missing" for an API with no key route yet. settings is null for
    // an API whose settings route is not there yet, which answers 404.
    // rows holds each endpoint the API keeps and whose it is.
    push: {
      key: o.pushKey === undefined ? PUSH_KEY : o.pushKey,
      settings: o.alertSettings === null ? null : Object.assign({}, ALERT_DEFAULTS, o.alertSettings || {}),
      rows: Object.assign({}, o.pushRows || {}),
    },
    conversationId: "cv-one",
    // Help: what the next question is answered with, the points the one
    // being answered can be stopped at, and the conversation as the API
    // keeps it. See helpPlay below.
    help: { next: null, holds: {}, asked: 0, seq: 0 },
    stored: [],
    uploadsFail: false,
    prefsPatches: [],
    // The second form's answers, and the sign-offs stamped on it. Its
    // photos live in the answers as the API keeps them, one record each,
    // and their bytes beside them by id.
    answersP: o.answersP ? Object.assign({}, o.answersP) : {},
    photoBytes: {},
    photoSeq: 0,
    // The drawing behind each sign-off stamped on it, by key.
    signatureBytes: {},
    // The customer's filings, each as the page sent it, and how many went
    // from this phone, since the API takes five an hour.
    customerFiled: [],
    // A route a case has asked to answer late, by "METHOD /path", in
    // milliseconds, so a screen can be read while it waits.
    holdMs: o.holdMs || {},
    // The form with titled sections, served when a case asks, and its
    // answers.
    sectionsForm: o.sectionsForm === "one" ? "one" : !!o.sectionsForm,
    answersS: {},
    // The incident report's second version in the catalog.
    formVersions: !!o.formVersions,
    // The form about one person, served when a case asks, and its answers.
    personForm: !!o.personForm,
    // The forms the Help guide names, title only (Step 277).
    guideForms: !!o.guideForms,
    // GET /api/chat/people, the people Chat's New message offers an
    // office person: the office first, then the staff (Step 277's
    // picture of it). Off, the route is not answered, as before.
    chatPeopleRoute: !!o.chatPeopleRoute,
    answersE: {},
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
  channels.forEach((ch) => { messages[ch.id] = chatSeed(ch.id, !!c.oddRows, !!c.tagged); });
  // unread sets a chat's count on the list by its id.
  const unread = c.unread || {};
  return {
    channels: channels.map(ch => Object.assign({ unreadCount: 0 }, ch, unread[ch.id] !== undefined ? { unreadCount: unread[ch.id] } : {})),
    messages: messages, seq: 0, holdMs: 0, saveThenDrop: false, noMessage: false,
    // membersRoute false is an API from before Step 179, which answers the
    // members route 404; alone is a chat nobody else can read.
    membersRoute: c.membersRoute !== false, alone: !!c.alone,
  };
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
    roomHelp: "The number on the door, or the name the site uses for it.",
    pics: "Photos of the walk", picsHelp: "Add a photo of anything worth a second look.",
    count: "How many rooms did you enter", countHelp: "A number. Half a room counts as 0.5.",
    guest: "Customer acknowledgement",
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
    roomHelp: "El numero de la puerta, o el nombre que el sitio le da.",
    pics: "Fotos del recorrido", picsHelp: "Agregue una foto de lo que valga la pena revisar.",
    count: "Cuantos cuartos recorrio", countHelp: "Un numero. Medio cuarto cuenta como 0.5.",
    guest: "Conformidad del cliente",
    lead: "Lider de equipo", manager: "Gerente de area",
  },
};
// Rows the checklist asks about, and the row a table somebody added is
// named by when it is short an answer.
const FORM_P_ROWS = ["hallway", "restroom", "entry"];
const FORM_P_MAX_PHOTOS = 3;
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
      // A photos question, the shape Step 163 gave the API: never
      // required, answered through its own routes, and holding at most
      // maxPhotos pictures. Three here rather than the API's six, so a
      // case reaches the limit in one screen.
      { key: "pics", label: w.pics, type: "photos", section: w.walk, required: false, help: w.picsHelp, maxPhotos: FORM_P_MAX_PHOTOS },
      // A checklist: the rows are the form's, and a person answers each one.
      { key: "check", label: w.check, type: "grid", section: w.areas, required: true,
        columns: [
          { key: "result", label: w.result, type: "select", required: true,
            options: [{ value: "pass", label: w.pass }, { value: "fail", label: w.fail }] },
          { key: "note", label: w.note, type: "text", required: false },
        ],
        rows: FORM_P_ROWS.map(k => ({ key: k, label: w[k] })) },
      // A table a person adds rows to, two to three of them, the floor
      // the PPE check's wear checks table has. One column carries a help
      // line, the way the API sends one since its Step 153, in the
      // language the request asks for; the others carry no help key.
      { key: "visits", label: w.visits, type: "grid", section: w.rooms, required: true,
        columns: [
          { key: "day", label: w.visitDay, type: "date", required: true },
          { key: "at", label: w.visitAt, type: "time", required: true },
          { key: "room", label: w.room, type: "text", required: true, help: w.roomHelp },
        ],
        rows: null, minRows: 2, maxRows: 3 },
      // A number, the type Step 167 gave the API, never required here.
      { key: "count", label: w.count, type: "number", section: w.rooms, required: false, help: w.countHelp },
      // The one the person filing makes, and one that belongs to the
      // supervisor half and is never drawn on the portal.
      { key: "leadSign", label: w.lead, type: "signoff", section: w.signIt, signer: "filer", required: true },
      { key: "managerSign", label: w.manager, type: "signoff", section: w.signIt, signer: "area_manager" },
      // A customer's signature taken on the staff member's phone, Step
      // 167's type, saved through its own route and never required here.
      { key: "guest", label: w.guest, type: "customer_signature", section: w.signIt, required: false },
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
// asks for, and the third has none. The second carries a help line
// beside its title, the way the API sends one since its Step 153, and
// the first carries no help key. Served only to a case that asks for
// it with stubOptions.sectionsForm, so every other case reads the
// catalog it always has. stubOptions.sectionsForm of "one" serves the
// first section alone, a form of one titled section, which the portal
// heads with the form's own name and nothing else.
const FORM_S_CODE = "TEST-FORM-S";
const FORM_S_WORDS = {
  en: {
    title: "Closing check", first: "Before you lock up", second: "The supply room",
    secondHelp: "Count only what is on the shelf tonight.",
    doors: "Which doors did you lock", lights: "Are the lights off", yes: "Yes", no: "No",
    low: "What is running low", notes: "Anything else to report",
  },
  es: {
    title: "Revision de cierre", first: "Antes de cerrar", second: "El cuarto de suministros",
    secondHelp: "Cuente solo lo que hay en el estante esta noche.",
    doors: "Que puertas cerro", lights: "Estan apagadas las luces", yes: "Si", no: "No",
    low: "Que se esta acabando", notes: "Algo mas que reportar",
  },
};

function formS(lang, one) {
  const w = FORM_S_WORDS[lang === "es" ? "es" : "en"];
  const field = (key, type, section, required, options) => ({
    key: key, label: w[key], type: type, required: required, osha: false, prefilled: false,
    options: options || [], appliesWhen: null, help: null, section: section,
  });
  return {
    code: FORM_S_CODE,
    title: w.title,
    version: 1,
    sections: [{ key: "1", title: w.first }].concat(one ? [] : [{ key: "2", title: w.second, help: w.secondHelp }]),
    fields: [
      field("doors", "text", "1", true),
      field("lights", "select", "1", true, [{ value: "yes", label: w.yes }, { value: "no", label: w.no }]),
    ].concat(one ? [] : [
      field("low", "text", "2", false),
      field("notes", "textarea", "3", false),
    ]),
  };
}

// A fourth form, invented: a check-in about one employee, with a person
// question, Step 186's type, that says who the form is about, and the
// employee's signature, drawn on the phone. The form names its person
// question as aboutPerson. Served only to a case that asks for it with
// stubOptions.personForm.
const FORM_E_CODE = "TEST-FORM-E";
const FORM_E_WORDS = {
  en: { title: "Employee check-in", first: "Who and how it went", who: "Who is this about", notes: "What went well", sign: "Employee signature" },
  es: { title: "Revision con el empleado", first: "Quien y como le fue", who: "De quien se trata", notes: "Que salio bien", sign: "Firma del empleado" },
};
function formE(lang) {
  const w = FORM_E_WORDS[lang === "es" ? "es" : "en"];
  const field = (key, type, required) => ({ key: key, label: w[key], type: type, required: required, osha: false, prefilled: false, options: [], appliesWhen: null, help: null, section: "1" });
  return {
    code: FORM_E_CODE, title: w.title, version: 1, aboutPerson: "who",
    sections: [{ key: "1", title: w.first }],
    fields: [field("who", "person", true), field("notes", "textarea", false), field("sign", "customer_signature", false)],
  };
}
function draftE(state, lang) {
  const form = formE(lang);
  const answers = state.answersE;
  const answered = form.fields.filter(f => answers[f.key] !== undefined && answers[f.key] !== null && answers[f.key] !== "").length;
  return {
    id: "draft-four", formCode: form.code, formName: form.title,
    answers: JSON.parse(JSON.stringify(answers)),
    status: "draft", answered: answered, remaining: form.fields.length - answered,
    missing: form.fields.filter(f => f.required && !answers[f.key]).map(f => f.key),
  };
}

function draftS(state, lang) {
  const form = formS(lang, state.sectionsForm === "one");
  const answers = state.answersS;
  const answered = form.fields.filter(f => answers[f.key] !== undefined && answers[f.key] !== null && answers[f.key] !== "").length;
  return {
    id: "draft-three", formCode: form.code, formName: form.title,
    answers: Object.assign({}, answers),
    status: "draft", answered: answered, remaining: form.fields.length - answered,
    missing: form.fields.filter(f => f.required && !answers[f.key]).map(f => f.key),
  };
}

// A customer's forms, Step 167 in the API, each invented: a cleanliness
// check whose customer has to give a name and sign, and a survey that asks
// for neither. Served as the public route sends a form, the catalog view
// with the agent half only, in the language the request asks for, with a
// last section that belongs to OCSA and carries no question of the
// customer's, which the page never draws. Each link's token is invented
// too, and one link is closed.
const FORM_C_CODE = "TEST-FORM-C";
const FORM_V_CODE = "TEST-FORM-V";
// The concern link (Step 242): the client's part of OCSA-FRM-009 on
// link-concern, answered only when its switch is on, with its own photo
// route, a receipt that carries a reference, and customerTitle (v3), the
// title the client sees in place of the form's own. Invented words under
// the code the contract names, on the keys the API built (Step 242 as
// built): client_name, client_role, client_email, client_phone and the
// rest in the API's order.
const FORM_N_CODE = "OCSA-FRM-009";
const CONCERN_REF = "C-0042-INVENTED";
// The request links (Step 252, the Step 250 contract section 4), answered
// only when the requests switch is on: req-area carries an area, req-site
// is the site-wide link that asks where, req-closed is disabled. The
// categories, the title, the scope line and the thanks are the API's
// words, invented here in English and Spanish; an area is the office's
// own label, so a name.
const REQUEST_LINKS = {
  "req-area": { area: "Second floor restroom", closed: false },
  "req-site": { area: null, closed: false },
  "req-closed": { area: "Lobby restroom", closed: true },
};
const REQUEST_CATEGORIES = [
  { key: "spill", severity: "high", en: ["Spill or wet floor", "Something spilled or the floor is wet."], es: ["Derrame o piso mojado", "Algo se derram\u00f3 o el piso est\u00e1 mojado."] },
  { key: "urgent", severity: "high", en: ["Flood or broken glass", "Water that keeps coming, broken glass, or a mess that cannot wait."], es: ["Inundaci\u00f3n o vidrio roto", "Agua que sigue saliendo, vidrio roto o un desorden que no puede esperar."] },
  { key: "supplies", severity: "medium", en: ["Out of paper or soap", "Toilet paper, paper towels, soap or a trash liner ran out."], es: ["Sin papel o jab\u00f3n", "Se acab\u00f3 el papel higi\u00e9nico, las toallas de papel, el jab\u00f3n o la bolsa de basura."] },
  { key: "cleaning", severity: "medium", en: ["Something needs cleaning", "A full trash can, a restroom that needs attention, or something missed."], es: ["Algo necesita limpieza", "Un bote de basura lleno, un ba\u00f1o que necesita atenci\u00f3n o algo que se pas\u00f3."] },
  { key: "other", severity: "low", en: ["Something else", "A question, or something extra you would like done. The office will look at it."], es: ["Otra cosa", "Una pregunta o algo m\u00e1s que quisiera que se hiciera. La oficina lo revisar\u00e1."] },
];
const REQUEST_WORDS = {
  en: { title: "Ask for help here", scope: "Invented Cleaning Co does not clean blood or handle needles. Please tell the building's staff.", where: "Where in the building?",
    thanks: "Thank you. Invented Cleaning Co has your request.", ref: "Your reference is {reference}.", mail: "We will email you as it moves.", joined: "Someone already asked for this. It is on our list.", danger: "If anyone is in danger, call the building's security now." },
  es: { title: "Pida ayuda aqu\u00ed", scope: "Invented Cleaning Co no limpia sangre ni maneja agujas. Av\u00edsele al personal del edificio.", where: "\u00bfEn qu\u00e9 parte del edificio?",
    thanks: "Gracias. Invented Cleaning Co recibi\u00f3 su solicitud.", ref: "Su referencia es {reference}.", mail: "Le escribiremos por correo conforme avance.", joined: "Alguien ya pidi\u00f3 esto. Est\u00e1 en nuestra lista.", danger: "Si alguien est\u00e1 en peligro, llame ahora a la seguridad del edificio." },
};
const REQUEST_REF = "R-0007-INVENTED";
const REQUEST_OFFICE_PHONE = "0000000000";
const REQUEST_CONCERN_URL = "/c/link-concern";
const requestWord = (lang, k, vars) => String(REQUEST_WORDS[lang === "es" ? "es" : "en"][k]).replace(/\{(\w+)\}/g, (w, key) => (vars && key in vars ? String(vars[key]) : w));
const requestCategoryTitle = (key, lang) => { const c = REQUEST_CATEGORIES.find(x => x.key === key); return c ? c[lang === "es" ? "es" : "en"][0] : key; };
// Client requests in the app (Step 252, section 7), answered only when the
// requests switch is on: two waiting for approval at North Building and
// one assigned to the person signed in. Each is the one view the contract
// gives everywhere. The clock is the stub's.
const REQUEST_ROWS = (now) => [
  { id: "cr-1", reference: "R-0001-INVENTED", siteId: "site-north", siteName: "North Building", area: "Second floor restroom", category: "spill", severity: "high", status: "awaiting_approval", reportedAt: new Date(now - 12 * 60 * 1000).toISOString(), respondBy: new Date(now + 3 * 60 * 1000).toISOString(), dueAt: new Date(now + 3 * 60 * 60 * 1000).toISOString(), note: "Water by the sinks, invented.", photos: [] },
  { id: "cr-2", reference: "R-0002-INVENTED", siteId: "site-north", siteName: "North Building", area: "Lobby restroom", category: "supplies", severity: "medium", status: "awaiting_approval", reportedAt: new Date(now - 40 * 60 * 1000).toISOString(), respondBy: new Date(now - 10 * 60 * 1000).toISOString(), dueAt: new Date(now + 3 * 60 * 60 * 1000).toISOString(), note: "", photos: [] },
  { id: "cr-3", reference: "R-0003-INVENTED", siteId: "site-north", siteName: "North Building", area: "Break room", category: "cleaning", severity: "medium", status: "open", reportedAt: new Date(now - 60 * 60 * 1000).toISOString(), respondBy: new Date(now + 2 * 60 * 60 * 1000).toISOString(), dueAt: new Date(now + 3 * 60 * 60 * 1000).toISOString(), note: "The trash can by the window is full, invented.", photos: [], assignedToMe: true, approvedAt: new Date(now - 50 * 60 * 1000).toISOString() },
];
const REQUEST_ASSIGNEES = [
  { id: "u-two", name: "Sam Second", role: "lead", onShift: true },
  { id: "u-three", name: "Robin Third", role: "custodian", onShift: false },
];
// The supply label (Step 252, section 10), answered only when the
// supplyQr switch is on: one product, its safety sheet in the library, and
// one site that holds it.
const SUP_CODE = "OCSA0000123456";
const SUP_ITEM = { id: "sup-qr", code: SUP_CODE, name: "Invented Neutral Rinse", maker: "Example Rinse Co.", category: "chemical", unit: "bottles", sdsUrl: null, sdsCode: "SDS-INVENTED-TWO" };
const SUP_SITES = [{ siteId: "site-north", siteName: "North Building", currentStock: 4, lowThreshold: 2 }];
// The two forms that ask the person's name and role themselves, each
// answered only when the customerAsks switch is on (Step 240): link-asks
// carries the code and the keys of OCSA-FRM-007, your_name and your_role;
// link-walk the code and the key of OCSA-FRM-006, completed_by, one
// required question for both. Invented words on both.
const FORM_A_CODE = "OCSA-FRM-007";
const FORM_W_CODE = "OCSA-FRM-006";
const CUSTOMER_LINKS = {
  "link-checklist": { form: FORM_C_CODE, closed: false },
  "link-survey": { form: FORM_V_CODE, closed: false },
  "link-closed": { form: FORM_V_CODE, closed: true },
  "link-asks": { form: FORM_A_CODE, closed: false, only: "customerAsks" },
  "link-walk": { form: FORM_W_CODE, closed: false, only: "customerAsks" },
  "link-concern": { form: FORM_N_CODE, closed: false, only: "concern" },
};
// What the public form answer says about each form, in the shapes the
// API answers since Step 242 (STEP242_AS_BUILT): customerFields names the
// form's own name and role questions by key, role null where one
// question takes both, and is null for a form the API's map does not
// name, which keeps the page's own Your name and Your role; photoRoute
// is true for every customer form with a photos question, whose photos
// then go through POST /api/public/forms/:token/photos and are filed by
// id. The two invented test forms keep photoRoute false, so the other
// path, photos as data URLs inside the filing, stays proven too.
const CUSTOMER_FIELDS = {
  [FORM_W_CODE]: { name: "completed_by", role: null },
  [FORM_A_CODE]: { name: "your_name", role: "your_role" },
  [FORM_N_CODE]: { name: "client_name", role: "client_role" },
};
const customerFieldsOf = (code) => CUSTOMER_FIELDS[code] || null;
const photoRouteOf = (code) => Object.prototype.hasOwnProperty.call(CUSTOMER_FIELDS, code);
const PUBLIC_MAX_PHOTOS = 3;
const PUBLIC_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PUBLIC_FILINGS_MAX = 5;
const PUBLIC_SITE = "Harbor Point School";
const PUBLIC_COMPANY = "Invented Cleaning Co";
const FORM_C_WORDS = {
  en: {
    title: "Building walk with the customer", first: "What you looked at", second: "Anything else", ocsa: "For the OCSA office",
    visited: "Which areas did you walk", lobby: "The lobby", restroom: "The restrooms",
    ok: "Acceptable", bad: "Deficient", na: "Not applicable",
    remarks: "Anything we should know", pics: "Photos of what you saw", picsHelp: "Up to three.", signed: "Your signature",
  },
  es: {
    title: "Recorrido del edificio con el cliente", first: "Lo que reviso", second: "Algo mas", ocsa: "Para la oficina de OCSA",
    visited: "Que areas recorrio", lobby: "El vestibulo", restroom: "Los banos",
    ok: "Aceptable", bad: "Deficiente", na: "No aplica",
    remarks: "Algo que debamos saber", pics: "Fotos de lo que vio", picsHelp: "Hasta tres.", signed: "Su firma",
  },
};
const FORM_V_WORDS = {
  en: {
    title: "How are we doing", first: "About you", second: "Your ratings", ocsa: "For the OCSA office",
    org: "Your organization", years: "How long have we served you", under: "Under a year", over: "A year or more",
    clean: "How clean is the building", crew: "How is the crew", response: "How fast do we answer",
    notes: "Anything else", pics: "Photos, if any",
  },
  es: {
    title: "Como lo estamos haciendo", first: "Sobre usted", second: "Sus calificaciones", ocsa: "Para la oficina de OCSA",
    org: "Su organizacion", years: "Cuanto tiempo llevamos atendiendolo", under: "Menos de un ano", over: "Un ano o mas",
    clean: "Que tan limpio esta el edificio", crew: "Como es el equipo", response: "Que tan rapido respondemos",
    notes: "Algo mas", pics: "Fotos, si las hay",
  },
};
const customerField = (key, label, type, section, required, extra) => Object.assign({
  key: key, label: label, type: type, required: !!required, osha: false, prefilled: false, options: [], appliesWhen: null, help: null, section: section,
}, extra || {});
function formC(lang) {
  const w = FORM_C_WORDS[lang === "es" ? "es" : "en"];
  const scale = [{ value: "ok", label: w.ok }, { value: "bad", label: w.bad }, { value: "na", label: w.na }];
  return {
    code: FORM_C_CODE, title: w.title, version: 1,
    sections: [{ key: "1", title: w.first }, { key: "2", title: w.second }, { key: "3", title: w.ocsa }],
    fields: [
      customerField("visited", w.visited, "text", "1", true),
      customerField("lobby", w.lobby, "select", "1", true, { options: scale }),
      customerField("restroom", w.restroom, "select", "1", true, { options: scale }),
      customerField("remarks", w.remarks, "textarea", "2", false),
      customerField("pics", w.pics, "photos", "2", false, { help: w.picsHelp, maxPhotos: PUBLIC_MAX_PHOTOS }),
      customerField("signed", w.signed, "customer_signature", "2", true),
    ],
  };
}
function formV(lang) {
  const w = FORM_V_WORDS[lang === "es" ? "es" : "en"];
  const stars = [1, 2, 3, 4, 5].map(n => ({ value: String(n), label: String(n) }));
  return {
    code: FORM_V_CODE, title: w.title, version: 1,
    sections: [{ key: "1", title: w.first }, { key: "2", title: w.second }, { key: "3", title: w.ocsa }],
    fields: [
      customerField("org", w.org, "text", "1", true),
      customerField("years", w.years, "select", "1", false, { options: [{ value: "under", label: w.under }, { value: "over", label: w.over }] }),
      customerField("clean", w.clean, "select", "2", false, { options: stars }),
      customerField("crew", w.crew, "select", "2", false, { options: stars }),
      customerField("response", w.response, "select", "2", false, { options: stars }),
      customerField("notes", w.notes, "textarea", "2", false),
      customerField("pics", w.pics, "photos", "2", false, { maxPhotos: PUBLIC_MAX_PHOTOS }),
    ],
  };
}
const FORM_A_WORDS = {
  en: { title: "Quarterly check in", first: "About you", second: "Your ratings", ocsa: "For the OCSA office", org: "Organization", name: "Your name", role: "Your role", overall: "Overall quality", notes: "Anything else", pics: "Photos, if any" },
  es: { title: "Revision trimestral", first: "Sobre usted", second: "Sus calificaciones", ocsa: "Para la oficina de OCSA", org: "Organizacion", name: "Su nombre", role: "Su puesto", overall: "Calidad general", notes: "Algo mas", pics: "Fotos, si las hay" },
};
function formA(lang) {
  const w = FORM_A_WORDS[lang === "es" ? "es" : "en"];
  const stars = [1, 2, 3, 4, 5].map(n => ({ value: String(n), label: String(n) }));
  return {
    code: FORM_A_CODE, title: w.title, version: 1,
    sections: [{ key: "1", title: w.first }, { key: "2", title: w.second }, { key: "3", title: w.ocsa }],
    fields: [
      customerField("organization", w.org, "text", "1", true),
      customerField("your_name", w.name, "text", "1", false),
      customerField("your_role", w.role, "text", "1", false),
      customerField("overall", w.overall, "select", "2", false, { options: stars }),
      customerField("notes", w.notes, "textarea", "2", false),
      customerField("pics", w.pics, "photos", "2", false, { maxPhotos: PUBLIC_MAX_PHOTOS }),
    ],
  };
}
// OCSA-FRM-006's client half, invented: one required question for the
// person's name and role, completed_by, and a photos question.
const FORM_W_WORDS = {
  en: { title: "Walk through with the customer", first: "Who you are", second: "What you saw", ocsa: "For the OCSA office", who: "Name and role", area: "Which area did you walk", clean: "How clean was it", good: "Good", fair: "Fair", poor: "Poor", pics: "Photos of what you saw", notes: "Anything else" },
  es: { title: "Recorrido con el cliente", first: "Quien es usted", second: "Lo que vio", ocsa: "Para la oficina de OCSA", who: "Nombre y puesto", area: "Que area recorrio", clean: "Que tan limpia estaba", good: "Bien", fair: "Regular", poor: "Mal", pics: "Fotos de lo que vio", notes: "Algo mas" },
};
function formW(lang) {
  const w = FORM_W_WORDS[lang === "es" ? "es" : "en"];
  return {
    code: FORM_W_CODE, title: w.title, version: 1,
    sections: [{ key: "1", title: w.first }, { key: "2", title: w.second }, { key: "3", title: w.ocsa }],
    fields: [
      customerField("completed_by", w.who, "text", "1", true),
      customerField("area", w.area, "text", "2", false),
      customerField("clean", w.clean, "select", "2", false, { options: [{ value: "good", label: w.good }, { value: "fair", label: w.fair }, { value: "poor", label: w.poor }] }),
      customerField("pics", w.pics, "photos", "2", false, { maxPhotos: PUBLIC_MAX_PHOTOS }),
      customerField("notes", w.notes, "textarea", "2", false),
    ],
  };
}
const FORM_N_WORDS = {
  en: { title: "Report a concern", officeTitle: "Customer Complaint Log", first: "About you", second: "What happened", ocsa: "For the OCSA office", name: "Your name", orgRole: "Your organization or role", email: "Email", phone: "Phone",
    contactBy: "How would you like us to contact you", byEmail: "By email", byPhone: "By phone", where: "Where in the building", what: "What happened", noticed: "When did you notice it",
    photos: "Photos, if any", staff: "Is this about how a member of our staff treated you?", yes: "Yes", no: "No" },
  es: { title: "Informar un problema", officeTitle: "Registro de quejas de clientes", first: "Sobre usted", second: "Lo que pas\u00f3", ocsa: "Para la oficina de OCSA", name: "Su nombre", orgRole: "Su organizaci\u00f3n o puesto", email: "Correo electr\u00f3nico", phone: "Tel\u00e9fono",
    contactBy: "C\u00f3mo prefiere que lo contactemos", byEmail: "Por correo electr\u00f3nico", byPhone: "Por tel\u00e9fono", where: "D\u00f3nde en el edificio", what: "Qu\u00e9 pas\u00f3", noticed: "Cu\u00e1ndo lo not\u00f3",
    photos: "Fotos, si las hay", staff: "\u00bfSe trata de c\u00f3mo lo trat\u00f3 un miembro de nuestro personal?", yes: "S\u00ed", no: "No" },
};
function formN(lang) {
  const w = FORM_N_WORDS[lang === "es" ? "es" : "en"];
  return {
    code: FORM_N_CODE, title: w.officeTitle, version: 2,
    sections: [{ key: "1", title: w.first }, { key: "2", title: w.second }, { key: "3", title: w.ocsa }],
    fields: [
      customerField("client_name", w.name, "text", "1", true),
      customerField("client_role", w.orgRole, "text", "1", false),
      customerField("client_email", w.email, "text", "1", false),
      customerField("client_phone", w.phone, "text", "1", false),
      customerField("contact_preference", w.contactBy, "select", "1", false, { options: [{ value: "email", label: w.byEmail }, { value: "phone", label: w.byPhone }] }),
      customerField("building_area", w.where, "text", "2", false),
      customerField("what_happened", w.what, "textarea", "2", true),
      customerField("noticed_on", w.noticed, "text", "2", false),
      customerField("photos", w.photos, "photos", "2", false, { maxPhotos: 5 }),
      customerField("about_staff", w.staff, "select", "2", true, { options: [{ value: "no", label: w.no }, { value: "yes", label: w.yes }] }),
    ],
  };
}
const customerFormOf = (code, lang) => (code === FORM_C_CODE ? formC(lang) : code === FORM_A_CODE ? formA(lang) : code === FORM_W_CODE ? formW(lang) : code === FORM_N_CODE ? formN(lang) : formV(lang));
// Checked against the form's own name question where it has one: 006's
// completed_by and 009's client_name are required, 007's your_name is not.
const customerNameRequired = (code) => code === FORM_C_CODE || code === FORM_W_CODE || code === FORM_N_CODE;

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
// language, and the two Step 179 added for a message that tags people.
// A read can get the first two, and a send any of the six.
const CHAT_TEXT_MAX = 2000;
const CHAT_MENTIONS_MAX = 10;
const CHAT_REFUSALS = {
  "chat.notFound": { status: 404, en: "This chat was not found.", es: "No se encontr\u00f3 este chat." },
  "chat.noAccess": { status: 403, en: "You do not have access to this chat.", es: "No tiene acceso a este chat." },
  "chat.textRequired": { status: 400, en: "Type a message first.", es: "Escriba un mensaje primero." },
  "chat.textTooLong": { status: 400, en: "This message is too long. Keep it to 2000 characters or fewer.", es: "Este mensaje es demasiado largo. Use 2000 caracteres o menos." },
  "chat.mentionNotMember": { status: 400, en: "One of the people tagged is not in this chat.", es: "Una de las personas etiquetadas no est\u00e1 en este chat." },
  "chat.tooManyMentions": { status: 400, en: "Tag at most 10 people in one message.", es: "Etiquete como m\u00e1ximo 10 personas en un mensaje." },
};
// The people who can read each chat, Step 179 in the API, whom a message
// there may tag: a site chat's are the people at the site and the office,
// the general chat's are everyone, and a private chat's are its staff
// member and the office. The members route answers them without the
// caller, by name.
const CHAT_PEOPLE = [PERSON, SECOND_PERSON, ADMIN_PERSON].map(p => ({ id: p.id, name: p.firstName + " " + p.lastName, role: p.role }))
  .concat(STAFF.slice(0, 3).map(p => ({ id: p.id, name: p.firstName + " " + p.lastName, role: "custodian" })));
const chatPeopleOf = (id) => {
  const byName = (list) => list.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (id === CHAT_GENERAL.id) return byName(CHAT_PEOPLE);
  if (id === "ch-north") return byName(CHAT_PEOPLE.slice(0, 4));
  if (/^dm-/.test(id)) return byName(CHAT_PEOPLE.filter(p => p.role === "admin" || "dm-" + p.id === id));
  return byName(CHAT_PEOPLE.filter(p => p.role === "admin").concat([CHAT_PEOPLE[4]]));
};
// A message's words cut at every tag it carries, the way the screen draws
// them: the tags, and the words between, each a piece of its own.
const mentionPieces = (text, mentions) => {
  const names = (mentions || []).filter(m => m && m.name).map(m => "@" + m.name).sort((a, b) => b.length - a.length);
  if (!names.length) return [text];
  return String(text).split(new RegExp("(" + names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")")).map(p => p.trim()).filter(Boolean);
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
  // A sign-in the API has locked after too many wrong tries, Step 175:
  // 429, with the minutes the lock lasts, fifteen by default.
  "auth.locked": { status: 429, en: "Too many tries. Wait {minutes} minutes, then try again.", es: "Demasiados intentos. Espere {minutes} minutos y vuelva a intentarlo.", vars: { minutes: 15 } },
  // An answer rated that is not one of the person's own, Step 183.
  "help.messageNotFound": { status: 404, en: "Answer not found", es: "No se encontr\u00f3 la respuesta" },
  // A draft discarded that is gone or no longer a draft, Step 183.
  "forms.reportNotFound": { status: 404, en: "Report not found", es: "No se encontr\u00f3 el reporte" },
  "forms.notADraft": { status: 409, en: "Only a draft can be discarded.", es: "Solo se puede descartar un borrador." },
  "timeOff.lastBeforeFirst": { status: 400, en: "The last day cannot be before the first day", es: "El \u00faltimo d\u00eda no puede ser anterior al primer d\u00eda" },
  "pickups.alreadyClaimed": { status: 409, en: "Shift was already claimed", es: "Este turno ya fue tomado" },
  "supplies.requestTypeRequired": { status: 400, en: "Request type is required", es: "Elija el tipo de solicitud" },
  // Step 280: a request's items the API turns away, with the keys it names.
  "supplies.badDetails": { status: 400, en: "Some details are missing or not valid", es: "Faltan algunos datos o no son v\u00e1lidos" },
  // Photos on a form, as the API's Step 163 writes them. The limit names
  // the question's own ceiling, which is what fills {max}.
  "forms.photoTooLarge": { status: 400, en: "This photo is over 10 MB.", es: "Esta foto pesa m\u00e1s de 10 MB." },
  "forms.photoType": { status: 400, en: "Use a JPG, PNG, HEIC or WebP photo.", es: "Use una foto JPG, PNG, HEIC o WebP." },
  "forms.photoLimit": { status: 400, en: "This question takes {max} photos at most.", es: "Esta pregunta acepta como m\u00e1ximo {max} fotos.", vars: { max: FORM_P_MAX_PHOTOS } },
  // A sign-off with no drawing, as the API's Step 163 writes it.
  "forms.signatureRequired": { status: 400, en: "Sign with your finger or mouse before pressing Sign.", es: "Firme con el dedo o el mouse antes de presionar Firmar." },
  // A number that is not one, and a customer signature saved on a staff
  // form under a key that is not one, as the API's Step 167 writes them.
  "forms.badNumber": { status: 400, en: "Enter a number", es: "Escriba un n\u00famero" },
  "forms.notACustomerSignature": { status: 400, en: "That question is not a customer signature", es: "Esa pregunta no es una firma del cliente" },
  // The customer's page, as the API's Step 167 writes them.
  "customer.linkUnknown": { status: 404, en: "This link is not valid.", es: "Este enlace no es v\u00e1lido." },
  "customer.linkClosed": { status: 410, en: "This form is closed. Call the office at 1(877)466-2721.", es: "Este formulario est\u00e1 cerrado. Llame a la oficina al 1(877)466-2721." },
  "customer.tooManyRequests": { status: 429, en: "Too many requests. Try again in a minute.", es: "Demasiadas solicitudes. Intente de nuevo en un minuto." },
  "customer.tooManyFilings": { status: 429, en: "This form was sent too many times from this device. Try again later.", es: "Este formulario se envi\u00f3 demasiadas veces desde este dispositivo. Intente m\u00e1s tarde." },
  "customer.bodyTooLarge": { status: 413, en: "The form is too large to send. Use fewer or smaller photos.", es: "El formulario es demasiado grande para enviarlo. Use menos fotos o fotos m\u00e1s peque\u00f1as." },
  "customer.nameRequired": { status: 400, en: "Give your name.", es: "Escriba su nombre." },
  // The concern link's own, as the contract for the API's Step 242 names
  // them; the words are the stub's.
  "customer.contactRequired": { status: 400, en: "Give an email address or a phone number.", es: "Escriba un correo electr\u00f3nico o un n\u00famero de tel\u00e9fono." },
  "customer.photoType": { status: 415, en: "Send a photo: JPG, PNG or WebP.", es: "Env\u00ede una foto: JPG, PNG o WebP." },
  "customer.photoTooBig": { status: 413, en: "That photo is too large. Each can be up to 10 MB.", es: "Esa foto es demasiado grande. Cada una puede ser de hasta 10 MB." },
  "customer.tooManyPhotos": { status: 400, en: "Up to 5 photos can be sent.", es: "Se pueden enviar hasta 5 fotos." },
  // The request link's own (Step 252, the Step 250 contract section 4);
  // the words are the stub's.
  "customer.request.badCategory": { status: 400, en: "Choose one of the five.", es: "Elija una de las cinco." },
  "customer.request.areaRequired": { status: 400, en: "Say where in the building.", es: "Diga en qu\u00e9 parte del edificio." },
  "customer.request.tooLong": { status: 400, en: "That is too long.", es: "Es demasiado largo." },
  "customer.request.badEmail": { status: 400, en: "That email address does not look right.", es: "Ese correo electr\u00f3nico no parece correcto." },
  // Client requests in the app (Step 252, section 7) and the supply label.
  "issues.request.alreadyDecided": { status: 409, en: "Someone already decided this request.", es: "Alguien ya decidi\u00f3 esta solicitud." },
  "issues.noteRequired": { status: 400, en: "Say why in a note.", es: "Diga por qu\u00e9 en una nota." },
  "issues.request.wrongState": { status: 409, en: "This request moved on.", es: "Esta solicitud ya cambi\u00f3." },
  "supplies.notFound": { status: 404, en: "This label does not match any supply.", es: "Esta etiqueta no corresponde a ning\u00fan suministro." },
};
// The photo and signature refusals the stub answers on its own, which no
// screen should meet once the phone makes every photo small and draws
// every signature: a HEIC that reached the API, no file at all, a photo
// that is not there, a photos answer written as if it were any other, a
// drawing that is not a PNG or is too large, and a drawing nobody made.
const FILE_REFUSALS = {
  "forms.photoHeic": { status: 400, en: "HEIC photos cannot be converted here. Use a JPG or PNG photo.", es: "Las fotos HEIC no se pueden convertir aqu\u00ed. Use una foto JPG o PNG." },
  "forms.photoNoFile": { status: 400, en: "Attach at least one photo.", es: "Adjunte al menos una foto." },
  "forms.photoNotFound": { status: 404, en: "Photo not found", es: "No se encontr\u00f3 la foto" },
  "forms.notAPhotosQuestion": { status: 400, en: "That question does not take photos", es: "Esa pregunta no acepta fotos" },
  "forms.photosByRoute": { status: 400, en: "Photos are added with their own button", es: "Las fotos se agregan con su propio bot\u00f3n" },
  "forms.signatureInvalid": { status: 400, en: "The signature must be a PNG drawing.", es: "La firma debe ser un dibujo PNG." },
  "forms.signatureTooLarge": { status: 400, en: "The signature is over 300 KB.", es: "La firma pesa m\u00e1s de 300 KB." },
  "forms.signatureNotFound": { status: 404, en: "Signature not found", es: "No se encontr\u00f3 la firma" },
  // The customer's filing, checked whole by the API. The page judges the
  // same rules itself before it sends, so a customer meets none of these
  // unless the API disagrees with the page.
  "customer.photoTooLarge": { status: 400, en: "This photo is over 5 MB.", es: "Esta foto pesa m\u00e1s de 5 MB." },
  "forms.requiredUnanswered": { status: 400, en: "Required fields are unanswered", es: "Faltan campos obligatorios por responder" },
  "forms.unanswerable": { status: 400, en: "These fields cannot be answered here", es: "Estos campos no se pueden responder aqu\u00ed" },
  "forms.invalidAnswers": { status: 400, en: "Some answers are not valid", es: "Algunas respuestas no son v\u00e1lidas" },
  "forms.answersShape": { status: 400, en: "Send answers as an object of key and value", es: "Env\u00ede las respuestas como un objeto de clave y valor" },
  "forms.customerSignatureByRoute": { status: 400, en: "The customer signs with the Customer signature button", es: "El cliente firma con el bot\u00f3n de firma del cliente" },
};
// The line the API answers a saved customer signature with, the way
// helpers/formCatalog.js writes it: who, then the date and the time.
const SIGNED_TEXT = {
  en: { by: "Signed by ", on: " on ", at: " at " },
  es: { by: "Firmado por ", on: " el ", at: " a las " },
};
function customerSignatureLine(stamp, lang) {
  const t = SIGNED_TEXT[lang === "es" ? "es" : "en"];
  const who = [stamp.name, stamp.role].map(x => String(x || "").trim()).filter(Boolean).join(", ");
  const d = new Date(stamp.at);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(d);
  const get = (k) => { const x = parts.find(y => y.type === k); return x ? x.value : ""; };
  return t.by + who + t.on + get("year") + "-" + get("month") + "-" + get("day") + t.at + get("hour") + ":" + get("minute") + " " + String(get("dayPeriod")).toUpperCase();
}
const SIGNATURE_MAX_BYTES = 300 * 1024;
// A one pixel PNG, the bytes every streamed image falls back to.
const ONE_PIXEL_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const image = (contentType, bytes) => ({ status: 200, contentType: contentType, body: bytes });

// What a request's multipart body holds: one part per file, each with the
// field name, the file name, the type the browser said, and the bytes.
// The body reaches the stub as the bytes the browser sent, so what the
// phone made of a photo can be read off them.
function multipartParts(body, headers) {
  const ct = String((headers || {})["content-type"] || "");
  const m = /boundary=("?)([^";]+)\1/.exec(ct);
  if (!m || !body) return [];
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), "latin1");
  const mark = Buffer.from("--" + m[2]);
  const parts = [];
  let at = buf.indexOf(mark);
  while (at !== -1) {
    const next = buf.indexOf(mark, at + mark.length);
    if (next === -1) break;
    const chunk = buf.slice(at + mark.length, next);
    const headEnd = chunk.indexOf("\r\n\r\n");
    if (headEnd !== -1) {
      const head = chunk.slice(0, headEnd).toString("latin1");
      const name = /name="([^"]*)"/.exec(head);
      const filename = /filename="([^"]*)"/.exec(head);
      const type = /content-type:\s*([^\r\n]+)/i.exec(head);
      // The bytes end before the \r\n that precedes the next mark.
      const bytes = chunk.slice(headEnd + 4, chunk.length - 2);
      parts.push({ name: name ? name[1] : "", filename: filename ? filename[1] : null, type: type ? type[1].trim() : "", bytes: bytes });
    }
    at = next;
  }
  return parts;
}
// A picture's width and height, read off its bytes: a PNG's from its
// first chunk, a JPEG's from its first frame marker. Null for anything
// else, so a case can tell what size the phone sent a photo at.
function imageSize(buf) {
  const kind = sniffImage(buf);
  if (!kind || kind.heic) return null;
  if (kind.ext === "png") return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (kind.ext === "webp") return null;
  let at = 2;
  while (at + 9 < buf.length) {
    if (buf[at] !== 0xff) { at += 1; continue; }
    const marker = buf[at + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
    const len = buf.readUInt16BE(at + 2);
    const frame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (frame) return { height: buf.readUInt16BE(at + 5), width: buf.readUInt16BE(at + 7) };
    at += 2 + len;
  }
  return null;
}
// What a file is, from its first bytes, the way the API reads it.
function sniffImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", contentType: "image/jpeg" };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: "png", contentType: "image/png" };
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return { ext: "webp", contentType: "image/webp" };
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12).toLowerCase();
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].indexOf(brand) !== -1) return { heic: true };
  }
  return null;
}
// --- announcements, Step 179 in the API ---------------------------------
//
// One announcement from the office, the way GET /api/announcements/:id
// sends it: its title and body in both languages, who sent it and when.
// An id that names none answers announcements.notFound. Invented.
const ANNOUNCEMENT = {
  id: "an-1",
  title: { en: "The lobby floor is being waxed", es: "Se est\u00e1 encerando el piso del vest\u00edbulo" },
  body: { en: "Use the side entrance on Friday night. The front doors stay locked until 6 AM.", es: "Use la entrada lateral el viernes en la noche. Las puertas del frente siguen cerradas hasta las 6 AM." },
  audience: { type: "all" }, sentBy: { id: "u-admin", name: "Jordan Office" }, sentAt: "2026-10-01T20:00:00.000Z",
  recipients: 12, withPush: true, translated: true,
};
const ANNOUNCEMENT_NOT_FOUND = ["Announcement not found", "No se encontr\u00f3 el anuncio"];

// A rating the API turns away, Step 183, which the portal never sends: a
// rating that is not true or false, and a note over 500 characters.
const RATING_NOTE_MAX = 500;
const RATING_INVALID = { en: "Say whether the answer was helpful: helpful must be true or false", es: "Indique si la respuesta fue \u00fatil: helpful debe ser true o false" };
const RATING_NOTE_LONG = { en: "The note can be at most {max} characters", es: "La nota puede tener como m\u00e1ximo {max} caracteres" };

// --- phone alerts, Step 179 in the API ----------------------------------
//
// GET /api/push/key answers the server's public key, or null when it has
// none, and the apps then offer nothing. POST /api/push/subscriptions
// takes an endpoint, which must be https, and its p256dh and auth keys,
// and files the endpoint under the caller: the same endpoint sent again
// moves to whoever sends it. DELETE takes the caller's own endpoint off,
// and answers ok whether or not it was there. The settings are the chat
// choice and five switches, each read with its default when unset, and a
// PATCH writes only the keys it carries and refuses the whole body when
// any key is wrong. The key is invented, 87 characters of base64url the
// way a real one is, so the browser can read it as 65 bytes.
const PUSH_KEY = "BInventedPublicKeyForTheAuditOnly000000000000000000000000000000000000000000000000000000";
const ALERT_DEFAULTS = { chat: "all", schedule: true, pickups: true, supplies: true, issues: true, forms: true };
const ALERT_SWITCHES = ["schedule", "pickups", "supplies", "issues", "forms"];
const ALERT_CHAT = ["all", "mentions", "off"];
const PUSH_REFUSALS = {
  "notifications.badSetting": { status: 400, en: "Send chat as all, mentions or off, and schedule, pickups, supplies, issues or forms as true or false", es: "Env\u00ede chat como all, mentions u off, y schedule, pickups, supplies, issues o forms como true o false" },
  "push.badSubscription": { status: 400, en: "Send the subscription's endpoint and its p256dh and auth keys", es: "Env\u00ede el endpoint de la suscripci\u00f3n y sus claves p256dh y auth" },
};

// A chat's messages as the API keeps them, oldest first. Every text is
// invented. oddRows adds rows missing a name, a time, or both.
// tagged adds two messages to the site chat that tag people, one of them
// the person a case signs in as.
const chatSeed = (channelId, odd, tagged) => {
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
  if (tagged && channelId === "ch-north") {
    rows.push({ id: "m-t1", senderId: SECOND_PERSON.id, senderName: SECOND_PERSON.firstName + " " + SECOND_PERSON.lastName, senderRole: "lead", text: "@Alex Tester can you check the side door", sentAt: at(2), isEdited: false, isPinned: false, mentions: [{ id: PERSON.id, name: "Alex Tester" }] });
    rows.push({ id: "m-t2", senderId: ADMIN_PERSON.id, senderName: ADMIN_PERSON.firstName + " " + ADMIN_PERSON.lastName, senderRole: "admin", text: "@Sam Second the spare key is at the desk", sentAt: at(1), isEdited: false, isPinned: false, mentions: [{ id: SECOND_PERSON.id, name: "Sam Second" }] });
  }
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
//
// Since Step 137 every refusal and every message the API writes on the
// routes the portal calls comes out of helpers/words.js in the request's
// language, ?locale= first and the account's after it, so a refusal and
// a message are live kinds beside a form's text. Since Step 124 a
// checklist's shift and block names come the same way, as display.shift
// and display.block on each item and as displayLabel on each shift and
// block of a session, so a shift header is a live kind too. The label
// beside each one, shift_label, block_label, label and shiftLabel, is
// the key the portal sends back to change a shift, and is served as a
// code: the screen is meant to draw the display name, never the key.
const LIVE_KINDS = new Set(["form text", "refusal", "message", "shift header", "request category"]);

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
// West Building's shifts, each with its Spanish twin, and the way the
// invalid shift refusal names them: by their display names, in the
// request's language.
const WEST_SHIFTS = [["Day shift", "Turno de d\u00eda"], ["Night shift", "Turno de noche"]];
const westShiftNames = (lang) => ({ shifts: WEST_SHIFTS.map(p => p[lang === "es" ? 1 : 0]).join(", ") });

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
  ["Check the restroom supplies", "Revise los suministros de los ba\u00f1os"],
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
  ...WEST_SHIFTS,
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
  // The field kit's refusals (Step 246), each in the API's own words.
  ["Insufficient permissions", "No tiene permiso para hacer esto"],
  ["Site not found", "No se encontr\u00f3 el sitio"],
  ["Some details of the issue are missing or not valid", "Faltan algunos datos de la entrega o no son v\u00e1lidos"],
  ["The employee must sign for the equipment", "El empleado debe firmar que recibi\u00f3 el equipo"],
  ["That line is not open for signing on this inspection.", "Esa l\u00ednea no est\u00e1 abierta para firmar en esta inspecci\u00f3n."],
  ["That line is already signed.", "Esa l\u00ednea ya est\u00e1 firmada."],
  ["Not found", "No se encontr\u00f3 la inspecci\u00f3n"],
  ["That signature could not be read. Clear it and sign again.", "No se pudo leer esa firma. B\u00f3rrela y vuelva a firmar."],
  // The field kit's inspections waiting for review (Step 246).
  ["Invented monthly walk", "Recorrido mensual inventado"],
  ["Invented quarterly audit", "Auditor\u00eda trimestral inventada"],
  ["Floors are clean and dry", "Los pisos est\u00e1n limpios y secos"],
  ["Mirrors are spotless", "Los espejos est\u00e1n impecables"],
  ["Trash is emptied", "La basura est\u00e1 vac\u00eda"],
  // The field kit's PPE stock (Step 246).
  ["Invented nitrile gloves", "Guantes de nitrilo inventados"],
  ["Invented safety glasses", "Lentes de seguridad inventados"],
  ["boxes", "cajas"],
  ["pairs", "pares"],
  // Notices.
  ["Supply request approved", "Solicitud de suministros aprobada"],
  ["Two cases of paper towels.", "Dos cajas de toallas de papel."],
  ["Something happened", "Algo pas\u00f3"],
  ["An invented notice.", "Un aviso inventado."],
  // A site role, a shift name and a service.
  ["Staff", "Personal"],
  ["Evening", "Tarde"],
  ["Day porter", "Conserje de d\u00eda"],
  // Messages and Help's reply.
  ["Usage logged", "Uso registrado"],
  ["Request submitted", "Solicitud enviada"],
  ["Take the pads from the second floor store room.", "Tome los pa\u00f1os del almac\u00e9n del segundo piso."],
  // Help's other answers, the procedure one cites, and its refusals.
  [helpReply(HELP_ANSWERS.spill), HELP_ANSWERS.spill.piecesEs.join("")],
  [helpReply(HELP_ANSWERS.howTo), HELP_ANSWERS.howTo.piecesEs.join("")],
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
  // The long inspection and its items.
  ["Restroom walk", "Recorrido de los ba\u00f1os"],
  ["Mirrors are free of streaks", "Los espejos no tienen rayas"],
  ["Sinks are clean and dry", "Los lavabos est\u00e1n limpios y secos"],
  ["Soap dispensers are full", "Los dispensadores de jab\u00f3n est\u00e1n llenos"],
  ["Floors are mopped", "Los pisos est\u00e1n trapeados"],
  ["Trash is emptied", "La basura est\u00e1 vac\u00eda"],
  INSPECTION_NOT_FOUND,
  ["This inspection was already completed", "Esta inspecci\u00f3n ya fue completada"],
  ["Stairwell walk", "Recorrido de la escalera"],
  BADGE_MISMATCH,
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
  .concat([LOGIN_REFUSAL])
  .concat([MUST_SET_PIN, NO_EMAIL_FOR_CODE, CODE_EXPIRED, CODE_TOO_MANY, SEND_LIMIT].map(r => [r.en, r.es]))
  .concat([["Your PIN has been changed.", "Su PIN fue cambiado."]])
  .concat(["Session expired", "Request failed",
    "Photo upload failed", "A sign-off is made with its own button", "That is not a sign-off on this form",
    "You cannot sign this part of the form", "This part is already signed"].map(tableTwin))
  // The second form, already written in both languages above.
  .concat(Object.keys(FORM_P_WORDS.en).map(k => [FORM_P_WORDS.en[k], FORM_P_WORDS.es[k]]))
  .concat([1, 2, 3, 4, 5].map(n => [ROW_WORD.en + " " + n, ROW_WORD.es + " " + n]))
  // A shift change turned away, each sentence as the API writes it.
  .concat(SHIFT_REFUSALS.map(r => [refusalIn(r, "en", westShiftNames("en")), refusalIn(r, "es", westShiftNames("es"))]))
  // Chat's refusals as Step 132 writes them, in each language.
  .concat(CHAT_SEND_REFUSALS.map(r => [r.en, r.es]))
  // The refusals a cleaner meets, as Step 137 writes them, each filled the
  // way the route fills it, and the photo refusals the stub answers on its own.
  .concat(Object.keys(API_REFUSALS).map(k => [refusalIn(API_REFUSALS[k], "en", API_REFUSALS[k].vars), refusalIn(API_REFUSALS[k], "es", API_REFUSALS[k].vars)]))
  .concat(Object.keys(FILE_REFUSALS).map(k => [FILE_REFUSALS[k].en, FILE_REFUSALS[k].es]))
  // An announcement the API no longer has, and the notices that name a
  // chat, a tag and an announcement.
  .concat([ANNOUNCEMENT_NOT_FOUND,
    ["New messages in North Building", "Mensajes nuevos en North Building"],
    ["Sam Second tagged you in North Building", "Sam Second lo etiquet\u00f3 en North Building"],
    ["An announcement from the office", "Un anuncio de la oficina"]])
  // A rating turned away, which the portal never sends.
  .concat([[RATING_INVALID.en, RATING_INVALID.es], [refusalIn(RATING_NOTE_LONG, "en", { max: RATING_NOTE_MAX }), refusalIn(RATING_NOTE_LONG, "es", { max: RATING_NOTE_MAX })]])
  // Phone alerts' two refusals, which the portal answers with a line of
  // its own and never draws.
  .concat(Object.keys(PUSH_REFUSALS).map(k => [PUSH_REFUSALS[k].en, PUSH_REFUSALS[k].es]))
  // The form with titled sections, written in both languages above.
  .concat(Object.keys(FORM_S_WORDS.en).map(k => [FORM_S_WORDS.en[k], FORM_S_WORDS.es[k]]))
  // The customer's two forms, written in both languages above.
  .concat(Object.keys(FORM_C_WORDS.en).map(k => [FORM_C_WORDS.en[k], FORM_C_WORDS.es[k]]))
  .concat(Object.keys(FORM_V_WORDS.en).map(k => [FORM_V_WORDS.en[k], FORM_V_WORDS.es[k]]))
  // The incident report's second version.
  .concat([["Which room was it in", "En qu\u00e9 cuarto fue"]])
  // The form about one person.
  .concat(Object.keys(FORM_E_WORDS.en).map(k => [FORM_E_WORDS.en[k], FORM_E_WORDS.es[k]]))
  // The forms the Help guide names (Step 277).
  .concat(GUIDE_FORMS.map(([code, en, es]) => [en, es]))
  // The concern link's form (Step 244), and 006's client half (Step 249).
  .concat(Object.keys(FORM_N_WORDS.en).map(k => [FORM_N_WORDS.en[k], FORM_N_WORDS.es[k]]))
  .concat(Object.keys(FORM_W_WORDS.en).map(k => [FORM_W_WORDS.en[k], FORM_W_WORDS.es[k]]))
  // The request link's words (Step 252).
  .concat(REQUEST_CATEGORIES.map(c => [c.en[0], c.es[0]]))
  .concat(REQUEST_CATEGORIES.map(c => [c.en[1], c.es[1]]))
  .concat(Object.keys(REQUEST_WORDS.en).map(k => [REQUEST_WORDS.en[k], REQUEST_WORDS.es[k]]));

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
  // A shift's and a block's keys are codes; their display names are the
  // words, in the request's language. See LIVE_KINDS.
  [/^GET \/api\/sites\/[^/]+\/tasks$/, { label: "to-do item", shift_label: "code", block_label: "code", shift: "shift header", block: "shift header" }],
  // Every session answer names the site's shifts and their blocks.
  [/^(GET \/api\/clock\/status|POST \/api\/shift-sessions|PATCH \/api\/shift-sessions\/[^/]+\/shift|GET \/api\/shift-sessions\/today|POST \/api\/shift-sessions\/[^/]+\/end)$/, { label: "code", displayLabel: "shift header", shiftLabel: "code" }],
  [/^GET \/api\/clock\/tasks\/assigned$/, { label: "to-do item" }],
  [/^GET \/api\/lookups$/, { label: "pick list choice", displayLabel: "pick list choice" }],
  [/^GET \/api\/notifications$/, { title: "notice", body: "notice" }],
  [/^GET \/api\/supplies$/, { name: "supply" }],
  [/^GET \/api\/time-off\/types$/, { label: "leave type" }],
  [/^[A-Z]+ \/api\/forms/, { title: "form text", label: "form text", rows: "form text" }],
  // The customer's form, the same view; the site's and the company's names
  // are names.
  [/^[A-Z]+ \/api\/public\/forms/, { title: "form text", label: "form text", rows: "form text", name: "name" }],
  [/^GET \/api\/inspections\//, { name: "inspection item", label: "inspection item", zone: "inspection item", kind: "code", formCode: "code", line: "code" }],
  // The request link (Step 252): its title, tiles, scope line and thanks
  // are the API's words in the request's language; an area, a site and a
  // company are names; a reference is a name.
  [/^[A-Z]+ \/api\/public\/requests\//, { title: "request category", help: "request category", scopeLine: "request category", thanks: "request category", name: "name", area: "name", reference: "name", key: "code", concernUrl: "name", officePhone: "name" }],
  // Client requests in the app: the category's title comes in the
  // reader's language; the area, the site, the note and every person are
  // names; the states are codes.
  [/^[A-Z]+ \/api\/issues\//, { categoryTitle: "request category", area: "name", siteName: "name", note: "name", name: "name", reference: "name", category: "code", respondState: "code", dueState: "code", route: "code", action: "code", details: "name", text: "name" }],
  // Supply requests (Step 280): every line's name, unit and notes, and
  // the request's details, are names; a decision is a code.
  [/^[A-Z]+ \/api\/supplies\/requests$/, { name: "name", unit: "name", note: "name", decisionNote: "name", description: "name", item_name: "name", supply_name: "name", site_name: "name", requested_by_name: "name", request_type: "code", urgency: "code", decision: "code" }],
  // The supply label: the product and its maker are names.
  [/^GET \/api\/(public\/)?supplies\//, { name: "name", maker: "name", code: "name", category: "code", unit: "name", sdsCode: "name", sdsUrl: "name", siteName: "name" }],
  // A piece of Help's answer, as the streaming route sends it.
  [/^POST \/api\/agent\/message\/stream$/, { text: "Help reply" }],
  // The smoke check's routes: a sheet as its maker wrote it, and what
  // office people wrote in the workspace, are names.
  [/^GET \/api\/sds/, { title: "name", content: "name" }],
  [/^[A-Z]+ \/api\/workspace\//, { name: "name", title: "name", description: "name", projectName: "name", notes: "name" }],
  // The field kit's (Step 246): a PPE issue names its supply; what was
  // typed for it, its size and its note are names.
  [/^[A-Z]+ \/api\/ppe-issues$/, { supplyName: "supply", item: "name", size: "name", note: "name" }],
  // Periodic work's items are the checklist's, in the request's language
  // under display; how often and its state are codes.
  [/^GET \/api\/periodic-work$/, { label: "to-do item", zone: "to-do zone", frequency: "code", state: "code" }],
  // A signed review line answers the lines again; each label is in every
  // language the API speaks, so its strings are names; the line is a code.
  [/^POST \/api\/inspections\/results\//, { line: "code", label: "name" }],
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
  // The customer's page, Step 167: no sign-in, answered the same way.
  /^GET \/api\/public\/forms\/[^/]+$/, /^POST \/api\/public\/forms\/[^/]+\/responses$/,
  // The request link and the supply label (Step 252), the same way.
  /^GET \/api\/public\/requests\/[^/]+$/, /^POST \/api\/public\/requests\/[^/]+$/, /^GET \/api\/public\/supplies\/[^/]+$/,
  // A lesson picture's signed address (Step 267): a storage file the
  // browser fetches as an image, with no token and no language.
  /^GET \/api\/lesson-images\/signed\/[^/]+\.png$/,
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
// A stub that offers more languages (the smoke check's French) knows them
// too.
const localeFault = (search, known) => {
  const said = new URLSearchParams(String(search || "")).getAll("locale");
  if (said.length === 0) return "says no language";
  if (said.length > 1) return "says its language " + said.length + " times: " + said.join(", ");
  if ((known || ["en", "es"]).indexOf(said[0]) === -1) return "says a language the API does not know: " + said[0];
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

// --- the smoke check's routes (Step 237) ---------------------------------
//
// Invented answers for routes the full suite does not ask for, each behind
// its switch in makeState.
const SECOND_STEP_CODE = "246810";
const SECOND_STEP_HINT = "o***@example.invalid";
const CODE_WRONG = { status: 400, en: "That code is not right.", es: "Ese c\u00f3digo no es correcto." };
const SDS_SHEETS = [
  { code: "SDS-INVENTED-ONE", product: "Invented Glass Cleaner", maker: "Example Chemical Co.", revised: "2026-03-04" },
  { code: "SDS-INVENTED-TWO", product: "Invented Neutral Rinse", maker: "Example Rinse Co.", revised: "2025-01-02" },
];
const sdsSheet = (s) => Object.assign({}, s, { sections: ["Identification and hazards", "First aid", "Fire, spills and leaks"].map((n, i) => ({ ref: String(i + 1), title: n, content: "Invented text for " + n.toLowerCase() + "." })) });
const WS_NOT_OFFICE = { status: 403, en: "The workspace is for office accounts.", es: "El espacio de trabajo es para cuentas de oficina." };
const WS_PROJECT = { id: "p-smoke", company: "ocsa", name: "Invented project", description: "Invented to test the workspace.", color: "#24A4F4", status: "active" };
const WS_TODO = { id: "t-smoke", projectId: "p-smoke", projectName: "Invented project", listId: "l-smoke", title: "Invented to-do for the smoke check", notes: "", dueOn: null, completedAt: null };
const WS_OFFICE = ["admin", "supervisor"];
// Step 240: one invented item on the equipment register, opened from its
// label's code, and the events recorded on it.
// The supervisor's field kit (Step 246). Its routes answer an admin or a
// supervisor, the way the API's management routes do, and turn anyone
// else away; GET /api/forms/my-sites answers them every site, and anyone
// else is answered as before the switch.
const FK_MANAGEMENT = ["admin", "supervisor"];
const FK_ROUTES = [/^GET \/api\/ppe-issues$/, /^POST \/api\/ppe-issues$/, /^GET \/api\/periodic-work$/, /^GET \/api\/equipment$/, /^GET \/api\/sites\/[^/]+$/, /^POST \/api\/inspections\/results\/[^/]+\/signatures\/[^/]+$/];
const FK_NOT_MANAGEMENT = { status: 403, en: "Insufficient permissions", es: "No tiene permiso para hacer esto" };
const FK_SITE_NOT_FOUND = { status: 404, en: "Site not found", es: "No se encontr\u00f3 el sitio" };
// The site's people as GET /api/sites/:id lists them, its PPE stock as
// GET /api/supplies?site_id&category=ppe answers, and one issue already
// made, all invented.
const FK_STAFF = STAFF.slice(0, 3).map(p => ({ id: p.id, first_name: p.firstName, last_name: p.lastName, role: "custodian", role_at_site: null, shift_name: null }));
const FK_PPE_STOCK = [
  { id: "sup-ppe-1", name: "Invented nitrile gloves", category: "ppe", unit: "boxes", site_stock: 12, site_threshold: 3, par_level: 20, is_low: false },
  { id: "sup-ppe-2", name: "Invented safety glasses", category: "ppe", unit: "pairs", site_stock: 2, site_threshold: 4, par_level: 10, is_low: true },
];
const FK_PPE_ISSUES = [{
  id: "ppe-seed-1", userId: FK_STAFF[1].id, userName: FK_STAFF[1].first_name + " " + FK_STAFF[1].last_name, siteId: "site-north", siteName: "North Building",
  supplyId: "sup-ppe-1", supplyName: "Invented nitrile gloves", item: "Invented nitrile gloves", size: "M", quantity: 2, fitOk: true, note: null,
  issuedBy: "u-admin", issuedByName: "Jordan Office", issuedAt: "2026-10-01T15:00:00.000Z", signed: true, signatureUrl: "/api/ppe-issues/ppe-seed-1/signature",
}];
// The site's periodic work as GET /api/periodic-work answers it, overdue
// first, its words the checklist's own, so each has its Spanish twin.
const FK_PERIODIC = [
  { taskId: "pw-1", label: "Clean the light fixtures", zone: "Office", frequency: "monthly", lastDoneAt: "2026-08-12T23:10:00.000Z", lastDoneBy: { name: "Ana Alvarez", initials: "AA" }, nextDueOn: "2026-09-01", dueBy: "2026-09-30", state: "overdue" },
  { taskId: "pw-2", label: "Scrub the grout in the restrooms", zone: "Restroom", frequency: "biweekly", lastDoneAt: "2026-09-16T23:40:00.000Z", lastDoneBy: { name: "Ben Brooks", initials: "BB" }, nextDueOn: "2026-09-30", dueBy: "2026-10-13", state: "due" },
  { taskId: "pw-3", label: "Wash the outside windows", zone: "Outside", frequency: "seasonal", lastDoneAt: null, lastDoneBy: null, nextDueOn: "2026-09-01", dueBy: "2026-11-30", state: "due" },
  { taskId: "pw-4", label: "Dust the picture frames", zone: "Lobby", frequency: "weekly", lastDoneAt: "2026-09-29T22:05:00.000Z", lastDoneBy: { name: "Carla Castro", initials: "CC" }, nextDueOn: "2026-10-05", dueBy: "2026-10-11", state: "done" },
];
// The site's register as GET /api/equipment answers it: the label the
// smoke check opens, one tagged out and one whose service is due.
const FK_EQUIPMENT = [
  { id: "eq-fk-2", name: "Invented wet vacuum", category: "Vacuum", status: "out_of_service", nextServiceOn: "2026-10-05", serviceDue: false, qrCode: "fkLabel2" },
  { id: "eq-fk-3", name: "Invented carpet extractor", category: "Carpet", status: "in_service", nextServiceOn: "2026-09-25", serviceDue: true, qrCode: "fkLabel3" },
];
// Two completed inspections waiting for review, as GET
// /api/inspections/scheduled?awaiting=review lists them and GET
// /api/inspections/scheduled/:id opens them: a supervisor's walk with
// its reviewer line, and an audit under 80 percent with findings
// received and the executive's line, which only an admin signs. The
// photos are invented addresses a run can answer itself.
const FK_PHOTO = "https://storage.example.invalid/storage/v1/object/public/task-media/task-1759100000-a1.jpg";
const FK_PHOTO_WHOLE = "https://storage.example.invalid/storage/v1/object/public/task-media/task-1759100001-b2.jpg";
const FK_LINES = {
  reviewer: { kind: "supervisor", roles: ["admin", "supervisor"], label: { en: "Reviewed", es: "Revisado", fr: "V\u00e9rifi\u00e9" } },
  received: { kind: "audit", roles: ["admin", "supervisor"], label: { en: "Findings received", es: "Hallazgos recibidos", fr: "Constats re\u00e7us" } },
  executive: { kind: "audit", roles: ["admin"], belowOnly: true, label: { en: "Executive review (score below 80)", es: "Revisi\u00f3n ejecutiva (puntaje menor de 80)", fr: "Examen par la direction (note inf\u00e9rieure \u00e0 80)" } },
};
const FK_REVIEWS = [
  {
    id: "fk-insp-1", resultId: "fk-res-1", kind: "supervisor", template_name: "Invented monthly walk", scheduled_date: "2026-09-29", inspector: FK_STAFF[0], total: 17, max: 20,
    items: [
      { id: "fk-it-1", label: "Floors are clean and dry", zone: "Lobby", cims_category: "SD", max_score: 10 },
      { id: "fk-it-2", label: "Mirrors are spotless", zone: "Restroom", cims_category: "SD", max_score: 10 },
    ],
    scores: [
      { template_item_id: "fk-it-1", score: 9, notes: "Invented note: one wet patch by the door.", photo_urls: [FK_PHOTO] },
      { template_item_id: "fk-it-2", score: 8, notes: null, photo_urls: [] },
    ],
    overall_notes: "Invented overall note for the walk.", photo_urls: [FK_PHOTO_WHOLE],
  },
  {
    id: "fk-insp-2", resultId: "fk-res-2", kind: "audit", template_name: "Invented quarterly audit", scheduled_date: "2026-09-26", inspector: FK_STAFF[2], total: 14, max: 20,
    items: [
      { id: "fk-it-3", label: "Trash is emptied", zone: "Office", cims_category: "SD", max_score: 10 },
      { id: "fk-it-4", label: "Floors are clean and dry", zone: "Office", cims_category: "SD", max_score: 10 },
    ],
    scores: [
      { template_item_id: "fk-it-3", score: 6, notes: "Invented note: two bins were full.", photo_urls: [] },
      { template_item_id: "fk-it-4", score: 8, notes: null, photo_urls: [] },
    ],
    overall_notes: null, photo_urls: [],
  },
];
const FK_LINE_NOT_OPEN = { status: 409, en: "That line is not open for signing on this inspection.", es: "Esa l\u00ednea no est\u00e1 abierta para firmar en esta inspecci\u00f3n." };
const FK_SIGNED_ALREADY = { status: 409, en: "That line is already signed.", es: "Esa l\u00ednea ya est\u00e1 firmada." };
const FK_INSPECTION_GONE = { status: 404, en: "Not found", es: "No se encontr\u00f3 la inspecci\u00f3n" };
const FK_BAD_SIGNATURE = { status: 400, en: "That signature could not be read. Clear it and sign again.", es: "No se pudo leer esa firma. B\u00f3rrela y vuelva a firmar." };
const FK_PPE_BAD = { status: 400, en: "Some details of the issue are missing or not valid", es: "Faltan algunos datos de la entrega o no son v\u00e1lidos" };
const FK_PPE_SIGN = { status: 400, en: "The employee must sign for the equipment", es: "El empleado debe firmar que recibi\u00f3 el equipo" };

const EQ_CODE = "smokeLabel7";
const EQ_ITEM = { id: "eq-smoke", name: "Invented floor scrubber", category: "Floor machine", siteId: "site-north", siteName: "North Building", status: "in_service", nextServiceOn: "2026-10-20", qrCode: EQ_CODE };

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
    // Since Step 183 the answer's id is chosen before the answer is kept,
    // so done carries it and the person can rate the answer by it. The
    // names of the sources it cites come when a case gives them.
    state.help.seq += 1;
    const messageId = "00000000-0000-4000-8000-" + String(state.help.seq).padStart(12, "0");
    const done = Object.assign({
      messageId: messageId, reply: reply, conversationId: state.conversationId,
      citedDocs: next.citedDocs || answer.citedDocs || [], degraded: !!answer.degraded, noProcedure: !!answer.noProcedure,
      // Step 276: the pictures of the guide entries the answer cites,
      // none for an answer that cites none.
      pictures: (answer.pictures || []).map(x => Object.assign({}, x)),
    }, next.citedNames ? { citedNames: next.citedNames } : {}, answer.formResponse ? { formResponse: answer.formResponse } : {});
    if (next.error) steps.push({ event: "error", data: { error: next.error.error, status: next.error.status } });
    else if (next.drop) steps.push({ drop: true });
    else steps.push({ event: "done", data: done });
    // The question is kept at once and the answer once it is written. A
    // dropped connection still finishes the answer and keeps it; an error
    // keeps nothing.
    state.stored.push({ role: "user", text: body && typeof body.text === "string" ? body.text : "", at: 0 });
    const kept = { id: messageId, role: "assistant", text: reply, citedDocs: done.citedDocs, citedNames: next.citedNames || null, pictures: done.pictures, degraded: done.degraded, noProcedure: done.noProcedure, feedback: null, at: Infinity };
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
  // Step 255: who may own a finding at the site, as the scheduled read
  // answers owners: the person signed in first, then two invented people.
  const findingOwners = () => [
    { id: state.person.id, name: state.person.firstName + " " + state.person.lastName, role: state.person.role },
    { id: "s-02", name: "Ben Brooks", role: "custodian" },
    { id: "s-05", name: "Eve Everett", role: "supervisor" },
  ];
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
    const r = API_REFUSALS[key] || FILE_REFUSALS[key];
    return json(r.status, { error: refusalIn(r, languageOf(search, state), r.vars), code: key });
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

  // --- Supply requests with items (Step 281), behind state.supplyItems
  //
  // The person's own requests, or everyone's for management, newest
  // first; and a request taken as Step 280 takes it: items, 1 to 30, each
  // a catalog supply or a typed name with a quantity from 1 to 999 and a
  // note of up to 500, refused with supplies.badDetails and the keys
  // items or items.<n>.<field>, n counting from 0. A body with no items
  // is one line, quantity 1, from supplyId or itemName.
  function supplyRequestAnswer(method, search, body, lang) {
    const copy = (r) => JSON.parse(JSON.stringify(r));
    if (method === "GET") {
      const all = FK_MANAGEMENT.indexOf(state.person.role) !== -1;
      const status = new URLSearchParams(search || "").get("status");
      return json(200, state.supplyRequests.filter(r => (all || r.requested_by === state.person.id) && (!status || r.status === status)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).map(copy));
    }
    const b = body && typeof body === "object" ? body : {};
    if (!b.requestType) return apiRefusal("supplies.requestTypeRequired", search);
    const bad = (keys) => json(400, { error: refusalIn(API_REFUSALS["supplies.badDetails"], lang), code: "supplies.badDetails", keys: keys });
    if (SUPPLY_TYPES.indexOf(b.requestType) === -1) return bad(["requestType"]);
    const catalog = state.supplies || SUPPLY_CATALOG;
    const given = b.items !== undefined ? b.items : [{ supplyId: b.supplyId || undefined, itemName: b.itemName || undefined, quantity: 1 }];
    if (!Array.isArray(given) || given.length < 1 || given.length > 30 || (b.requestType === "damage_report" && given.length !== 1)) return bad(["items"]);
    const keys = [];
    const lines = given.map((x, i) => {
      const it = x && typeof x === "object" ? x : {};
      const sup = it.supplyId ? catalog.find(s => s.id === it.supplyId) : null;
      const typed = typeof it.itemName === "string" ? it.itemName.trim() : "";
      if (it.supplyId && !sup) keys.push("items." + i + ".supplyId");
      else if (!it.supplyId && (typed.length < 1 || typed.length > 255)) keys.push("items." + i + ".itemName");
      if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 999) keys.push("items." + i + ".quantity");
      if (it.note !== undefined && it.note !== null && (typeof it.note !== "string" || it.note.length > 500)) keys.push("items." + i + ".note");
      return supplyLine("sri-" + (state.supplyRequests.length + 1) + "-" + (i + 1), sup || null, it.quantity, sup ? { note: it.note || null } : { name: typed, note: it.note || null });
    });
    if (keys.length > 0) return bad(keys);
    const first = lines[0];
    const row = {
      id: "sreq-" + (state.supplyRequests.length + 1), requested_by: state.person.id, requested_by_name: state.person.firstName + " " + state.person.lastName,
      site_id: b.siteId || null, site_name: b.siteId ? ((SITES.find(x => x.siteId === b.siteId) || {}).siteName || null) : null,
      supply_id: first.supplyId, supply_name: first.supplyId ? first.name : null, request_type: b.requestType, item_name: first.supplyId ? (b.itemName || null) : first.name,
      description: b.description || null, urgency: b.urgency || "normal", status: "pending", admin_notes: null, handled_by: null, handled_at: null, created_at: new Date(clockNow()).toISOString(), items: lines,
    };
    state.supplyRequests.push(row);
    return json(201, { message: "Request submitted", code: "supplies.requestSubmitted", request: copy(row) });
  }

  // --- The supervisor's field kit (Step 246), behind state.fieldKit
  //
  // Answers its routes in the shapes the API answers them, or nothing,
  // so the call goes on to be answered as before the switch.
  function fieldKitAnswer(method, pathname, search, body, key, lang) {
    const management = FK_MANAGEMENT.indexOf(state.person.role) !== -1;
    const q = new URLSearchParams(search || "");
    if (key === "GET /api/forms/my-sites") return management ? json(200, { sites: SITES.map(x => ({ id: x.siteId, name: x.siteName })) }) : null;
    // The register's two other labels open the way the smoke check's does.
    const label = FK_EQUIPMENT.find(x => key === "GET /api/equipment/by-qr/" + x.qrCode);
    if (label) return json(200, { equipment: Object.assign({ siteId: "site-north", siteName: "North Building" }, label), events: [] });
    // The review list answers anyone; nobody but management is assigned
    // these, so anyone else gets none.
    if (key === "GET /api/inspections/scheduled" && q.get("awaiting") === "review") {
      if (!management) return json(200, []);
      return json(200, FK_REVIEWS.filter(r => reviewOpen(r) && (!q.get("site_id") || q.get("site_id") === "site-north")).map(r => reviewRow(r)));
    }
    const review = FK_REVIEWS.find(r => key === "GET /api/inspections/scheduled/" + r.id);
    if (review) return management ? json(200, reviewDetail(review)) : json(FK_INSPECTION_GONE.status, { error: refusalIn(FK_INSPECTION_GONE, lang), code: "inspections.notFound" });
    // Anyone may read a site's supplies; the kit asks for its PPE.
    if (key === "GET /api/supplies" && q.get("category") === "ppe") return json(200, q.get("site_id") ? FK_PPE_STOCK : []);
    if (!FK_ROUTES.some(re => re.test(key))) return null;
    if (!management) return json(FK_NOT_MANAGEMENT.status, { error: refusalIn(FK_NOT_MANAGEMENT, lang), code: "access.insufficientPermissions" });
    const one = /^GET \/api\/sites\/([^/]+)$/.exec(key);
    if (one) {
      const site = SITES.find(x => x.siteId === decodeURIComponent(one[1]));
      if (!site) return json(FK_SITE_NOT_FOUND.status, { error: refusalIn(FK_SITE_NOT_FOUND, lang), code: "sites.notFound" });
      return json(200, { site: { id: site.siteId, name: site.siteName }, staff: FK_STAFF, zones: [], taskCount: 0 });
    }
    if (key === "GET /api/ppe-issues") {
      const siteId = q.get("siteId");
      return json(200, { issues: state.ppeIssues.filter(x => !siteId || x.siteId === siteId) });
    }
    if (key === "POST /api/ppe-issues") return ppeIssue(body, lang);
    const signing = /^POST \/api\/inspections\/results\/([^/]+)\/signatures\/([^/]+)$/.exec(key);
    if (signing) return signLine(decodeURIComponent(signing[1]), decodeURIComponent(signing[2]), body, lang);
    if (key === "GET /api/periodic-work") {
      const site = SITES.find(x => x.siteId === q.get("siteId")) || SITES[0];
      return json(200, { items: FK_PERIODIC.map(x => Object.assign({ siteId: site.siteId, siteName: site.siteName }, x, {
        display: { label: lang === "es" && TWIN_ES.has(x.label) ? TWIN_ES.get(x.label) : x.label, zone: lang === "es" && TWIN_ES.has(x.zone) ? TWIN_ES.get(x.zone) : x.zone },
      })) });
    }
    if (key === "GET /api/equipment") {
      const site = SITES.find(x => x.siteId === q.get("siteId")) || SITES[0];
      const mine = Object.assign({}, EQ_ITEM, { serviceDue: false, latestEvent: state.equipmentEvents[0] || null });
      return json(200, { equipment: [mine].concat(FK_EQUIPMENT.map(x => Object.assign({ siteId: site.siteId, siteName: site.siteName, latestEvent: null }, x))) });
    }
    return null;
  }
  // A review's lines, as the reading route answers them for this person.
  function reviewLines(r) {
    const sigs = state.reviewSigs[r.resultId];
    return Object.keys(FK_LINES).filter(l => FK_LINES[l].kind === r.kind && (!FK_LINES[l].belowOnly || r.total * 100 < 80 * r.max)).map(l => {
      const signed = sigs.some(x => x.line === l);
      return { line: l, label: FK_LINES[l].label, required: true, signed: signed, canSign: !signed && FK_LINES[l].roles.indexOf(state.person.role) !== -1 && state.person.id !== r.inspector.id };
    });
  }
  const reviewOpen = (r) => reviewLines(r).some(l => !l.signed);
  const reviewSignatures = (r) => state.reviewSigs[r.resultId].map(x => ({ line: x.line, signerName: x.signer_name, signedAt: x.signed_at, path: "/api/inspections/results/" + r.resultId + "/signatures/" + x.line }));
  const reviewRow = (r) => ({ id: r.id, template_id: "tpl-" + r.id, site_id: "site-north", template_name: r.template_name, site_name: "North Building", scheduled_date: r.scheduled_date, status: "completed", assigned_to: r.inspector.id,
    assigned_name: r.inspector.first_name + " " + r.inspector.last_name, result_id: r.resultId, total_score: r.total, max_possible_score: r.max, kind: r.kind, formCode: r.kind === "audit" ? "OCSA-FRM-004" : "OCSA-FRM-003" });
  const reviewDetail = (r) => Object.assign(reviewRow(r), {
    items: r.items,
    result: { id: r.resultId, total_score: r.total, max_possible_score: r.max, overall_notes: r.overall_notes, photo_urls: r.photo_urls, completed_by_name: r.inspector.first_name + " " + r.inspector.last_name, completed_at: r.scheduled_date + "T21:00:00.000Z" },
    scores: r.scores, capture: { photosPerItem: 3, photosOverall: 10, signatureRequired: true }, signatures: reviewSignatures(r), lines: reviewLines(r),
  });
  // POST /api/inspections/results/:resultId/signatures/:line, in the API's
  // order: not there, the line not open, a role that does not sign it, the
  // inspector, already signed, then the drawing's own refusals.
  function signLine(resultId, line, body, lang) {
    const r = FK_REVIEWS.find(x => x.resultId === resultId);
    const refuse = (w, code) => json(w.status, { error: refusalIn(w, lang), code: code });
    if (!r) return refuse(FK_INSPECTION_GONE, "inspections.notFound");
    const open = reviewLines(r).find(l => l.line === line);
    if (!open) return refuse(FK_LINE_NOT_OPEN, "inspections.lineNotOpen");
    if (FK_LINES[line].roles.indexOf(state.person.role) === -1) return refuse(FK_NOT_MANAGEMENT, "access.insufficientPermissions");
    if (open.signed) return refuse(FK_SIGNED_ALREADY, "inspections.alreadySigned");
    const raw = body && typeof body.signature === "string" ? body.signature.trim() : "";
    const drawn = raw ? /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw) : null;
    const bytes = drawn ? Buffer.from(drawn[1].replace(/\s+/g, ""), "base64") : null;
    if (!bytes || !sniffImage(bytes) || sniffImage(bytes).ext !== "png") return refuse(FK_BAD_SIGNATURE, raw ? "inspections.badSignature" : "inspections.signatureRequired");
    state.calls[state.calls.length - 1].signature = { bytes: bytes.length, size: imageSize(bytes) };
    state.reviewSigs[resultId].push({ line: line, signer_id: state.person.id, signer_name: state.person.firstName + " " + state.person.lastName, signed_at: iso(clockNow()) });
    return json(201, { signatures: reviewSignatures(r), lines: reviewLines(r) });
  }

  // POST /api/ppe-issues, in the API's order: what is wrong with the body,
  // 400 ppe.badDetails with keys; then a signature missing, 400
  // ppe.signatureRequired; then a person, a site or a supply that is not
  // there, ppe.badDetails again.
  function ppeIssue(body, lang) {
    const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
    const keys = [];
    const textOf = (v, max, key) => { if (v === undefined || v === null) return ""; if (typeof v !== "string" || v.trim().length > max) { keys.push(key); return ""; } return v.trim(); };
    if (typeof b.userId !== "string" || !b.userId) keys.push("userId");
    if (typeof b.siteId !== "string" || !b.siteId) keys.push("siteId");
    const supplyId = b.supplyId === undefined || b.supplyId === null || b.supplyId === "" ? null : b.supplyId;
    if (supplyId !== null && typeof supplyId !== "string") keys.push("supplyId");
    const item = textOf(b.item, 120, "item");
    if (!item && supplyId === null && keys.indexOf("item") === -1) keys.push("item");
    const size = textOf(b.size, 40, "size");
    const quantity = b.quantity === undefined || b.quantity === null ? 1 : b.quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) keys.push("quantity");
    if (b.fitOk !== undefined && b.fitOk !== null && typeof b.fitOk !== "boolean") keys.push("fitOk");
    const note = textOf(b.note, 1000, "note");
    const raw = typeof b.employeeSignature === "string" ? b.employeeSignature.trim() : "";
    const drawn = raw ? /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw) : null;
    const bytes = drawn ? Buffer.from(drawn[1].replace(/\s+/g, ""), "base64") : null;
    const png = !!bytes && !!sniffImage(bytes) && sniffImage(bytes).ext === "png" && bytes.length <= SIGNATURE_MAX_BYTES;
    if ((b.employeeSignature !== undefined && b.employeeSignature !== null && typeof b.employeeSignature !== "string") || (raw && !png)) keys.push("employeeSignature");
    if (keys.length > 0) return json(FK_PPE_BAD.status, { error: refusalIn(FK_PPE_BAD, lang), code: "ppe.badDetails", keys: keys });
    if (!raw) return json(FK_PPE_SIGN.status, { error: refusalIn(FK_PPE_SIGN, lang), code: "ppe.signatureRequired" });
    const person = FK_STAFF.find(p => p.id === b.userId);
    const site = SITES.find(x => x.siteId === b.siteId);
    const supply = supplyId ? FK_PPE_STOCK.find(x => x.id === supplyId) : null;
    const missing = [];
    if (!person) missing.push("userId");
    if (!site) missing.push("siteId");
    if (supplyId && !supply) missing.push("supplyId");
    if (missing.length > 0) return json(FK_PPE_BAD.status, { error: refusalIn(FK_PPE_BAD, lang), code: "ppe.badDetails", keys: missing });
    state.calls[state.calls.length - 1].signature = { bytes: bytes.length, size: imageSize(bytes) };
    const id = "ppe-made-" + (state.ppeIssues.length + 1);
    const issue = {
      id: id, userId: person.id, userName: person.first_name + " " + person.last_name, siteId: site.siteId, siteName: site.siteName,
      supplyId: supply ? supply.id : null, supplyName: supply ? supply.name : null, item: item || supply.name, size: size || null, quantity: quantity,
      fitOk: b.fitOk === true || b.fitOk === false ? b.fitOk : null, note: note || null, issuedBy: state.person.id,
      issuedByName: state.person.firstName + " " + state.person.lastName, issuedAt: iso(clockNow()), signed: true, signatureUrl: "/api/ppe-issues/" + id + "/signature",
    };
    state.ppeIssues.unshift(issue);
    return json(201, { issue: issue });
  }

  // Step 261: this person's attempts on a lesson, oldest first; the tries
  // used and left on it (three in all, the contract's default); and an
  // attempt as the routes answer it, with no correct value anywhere.
  function lessonAttempts(lesson) { return state.trainingAttempts.filter(a => a.versionId === lesson.versionId && a.personId === state.person.id && !a.voidedAt); }
  function lessonTries(lesson) { const used = lessonAttempts(lesson).length; return { used: used, left: Math.max(0, lesson.maxAttempts - used) }; }
  function attemptView(a) {
    const topic = TRAINING_ME.items.find(i => i.topicId === a.topicId);
    return { id: a.id, versionId: a.versionId, topicId: a.topicId, topicName: topic ? topic.name : "", attemptNo: a.attemptNo, locale: a.locale, startedAt: a.startedAt, scoredAt: a.scoredAt, scorePercent: a.scorePercent, passed: a.passed, missed: a.missed.slice(), acknowledgedAt: a.acknowledgedAt, awaitingTrainer: a.awaitingTrainer, trainerSignedAt: a.trainerSignedAt, trainer: a.trainerName ? { name: a.trainerName } : null, demonstrated: a.demonstrated, siteId: a.siteId, voidedAt: a.voidedAt };
  }
  function handle(method, pathname, search, body, headers) {
    const key = method + " " + pathname;
    state.calls.push({ method: method, path: pathname, search: search || "", body: body || null, headers: headers || {} });
    // A request that does not say its language once is kept, and a
    // signed-in one is turned away before anything else answers it. The
    // seven calls made before signing in are answered as before, in the
    // phone's language, which is what the case for them catches.
    const fault = localeFault(search, state.languages);
    if (fault) {
      state.localeFaults.push(key + (search || "") + " " + fault);
      noteLocaleFault(key, search, fault);
      if (!SIGNED_OUT.some(re => re.test(key))) return json(400, { error: "Request failed", code: "LOCALE_REQUIRED" });
    }
    if (state.offline) return { abort: true };
    const dropped = state.drop[key];
    if (dropped) { if (dropped.once) delete state.drop[key]; return { abort: true }; }
    if (state.pinGate && state.mustSetPin && /^Bearer /.test(String((headers || {}).authorization || "")) && MUST_SET_PIN_OPEN.indexOf(key) === -1 && !SIGNED_OUT.some(re => re.test(key))) {
      return json(MUST_SET_PIN.status, { error: refusalIn(MUST_SET_PIN, languageOf(search, state)), code: "auth.mustSetPin" });
    }
    const refused = refusalFor(key, search);
    if (refused) return refused;
    if (state.holdMs[key] > 0) {
      const ms = state.holdMs[key];
      delete state.holdMs[key];
      return Object.assign(answerNow(method, pathname, search, body, headers, key), { after: new Promise(done => setTimeout(done, ms)) });
    }
    return answerNow(method, pathname, search, body, headers, key);
  }

  function answerNow(method, pathname, search, body, headers, key) {
    const lang = languageOf(search, state);
    // --- signing in and getting in
    if (key === "POST /api/auth/login") {
      // A wrong PIN carries its key as its code, the way the API's
      // errorBody sends every refusal; the portal counts the ones in a
      // row by it. Five misses in a row on what was typed lock it, and a
      // sign-in that gets in clears them (Step 285, the API's Step 283).
      const typed = String((body && (body.identifier || body.phone)) || "").trim().toLowerCase();
      if ((state.loginMisses[typed] || 0) >= LOGIN_MISSES_LOCK) return apiRefusal("auth.locked", search);
      if (!body || body.pin !== LOGIN_PIN) {
        state.loginMisses[typed] = (state.loginMisses[typed] || 0) + 1;
        return json(401, { error: LOGIN_REFUSAL[0], code: "auth.invalidCredentials" });
      }
      delete state.loginMisses[typed];
      if (typed === NO_EMAIL_BADGE) return json(NO_EMAIL_FOR_CODE.status, { error: refusalIn(NO_EMAIL_FOR_CODE, lang), code: "auth.noEmailForCode" });
      if (state.secondStep) {
        state.challenge = { id: "challenge-smoke", sends: 1, wrong: 0, dead: false };
        return json(200, { secondStep: true, challengeId: state.challenge.id, emailHint: SECOND_STEP_HINT });
      }
      return json(200, Object.assign({ token: "token-one" }, state.mustSetPin ? { mustSetPin: true } : {}));
    }
    // The smoke check's routes, each behind its switch. The code routes
    // answer the way helpers/secondStep.js does: five wrong codes end the
    // challenge, 429 auth.codeTooMany; a fourth send is 429
    // auth.sendLimit; and a challenge that ended, or that this stub never
    // started (a reload the API restarted under), is 410 auth.codeExpired.
    if (state.secondStep && key === "POST /api/auth/second-step") {
      const ch = state.challenge;
      if (!ch || ch.dead || !body || body.challengeId !== ch.id) return json(CODE_EXPIRED.status, { error: refusalIn(CODE_EXPIRED, lang), code: "auth.codeExpired" });
      if (body.code === SECOND_STEP_CODE) { ch.dead = true; return json(200, { token: "token-one" }); }
      ch.wrong += 1;
      if (ch.wrong >= 5) { ch.dead = true; return json(CODE_TOO_MANY.status, { error: refusalIn(CODE_TOO_MANY, lang), code: "auth.codeTooMany" }); }
      return json(CODE_WRONG.status, { error: refusalIn(CODE_WRONG, lang), code: "auth.codeWrong", attemptsLeft: 5 - ch.wrong });
    }
    if (state.secondStep && key === "POST /api/auth/second-step/resend") {
      const ch = state.challenge;
      if (!ch || ch.dead || !body || body.challengeId !== ch.id) return json(CODE_EXPIRED.status, { error: refusalIn(CODE_EXPIRED, lang), code: "auth.codeExpired" });
      if (ch.sends >= 3) { ch.dead = true; return json(SEND_LIMIT.status, { error: refusalIn(SEND_LIMIT, lang), code: "auth.sendLimit" }); }
      ch.sends += 1;
      return json(200, { secondStep: true, challengeId: ch.id, emailHint: SECOND_STEP_HINT });
    }
    if (state.languages && key === "GET /api/languages") return json(200, { languages: state.languages });
    if (state.sds && key === "GET /api/sds") return json(200, { sheets: SDS_SHEETS });
    if (state.sds && method === "GET" && /^\/api\/sds\/[^/]+$/.test(pathname)) {
      const one = SDS_SHEETS.find(x => x.code === decodeURIComponent(pathname.slice("/api/sds/".length)));
      return one ? json(200, sdsSheet(one)) : json(404, { error: "That safety data sheet was not found", code: "sds.notFound" });
    }
    if (state.workspace && pathname.indexOf("/api/workspace/") === 0) {
      if (WS_OFFICE.indexOf(state.person.role) === -1) return json(WS_NOT_OFFICE.status, { error: refusalIn(WS_NOT_OFFICE, lang), code: "workspace.notOffice" });
      if (key === "GET /api/workspace/projects") return json(200, { projects: [WS_PROJECT] });
      if (key === "GET /api/workspace/me") return json(200, { todos: [Object.assign({}, WS_TODO, { assigneeIds: [state.person.id] })], changes: [] });
    }
    if (state.fieldKit) {
      const kit = fieldKitAnswer(method, pathname, search, body, key, lang);
      if (kit) return kit;
    }
    if (state.equipment && pathname.indexOf("/api/equipment/") === 0) {
      if (key === "GET /api/equipment/by-qr/" + EQ_CODE) return json(200, { equipment: EQ_ITEM, events: state.equipmentEvents.slice(0, 10) });
      if (key === "POST /api/equipment/" + EQ_ITEM.id + "/events") {
        const b = body && typeof body === "object" ? body : {};
        if (b.kind !== "check" && b.kind !== "tagged_out") return json(400, { error: "Bad details", code: "equipment.badDetails" });
        const e = { id: "ev-smoke-" + (state.equipmentEvents.length + 1), kind: b.kind, note: String(b.note || ""), by: { name: state.person.firstName + " " + state.person.lastName }, at: new Date(clockNow()).toISOString() };
        state.equipmentEvents.unshift(e);
        return json(201, { event: e });
      }
      return json(404, { error: "That equipment was not found.", code: "equipment.notFound" });
    }
    if (key === "GET /api/auth/me") return json(200, Object.assign({ user: state.person, sites: SITES, preferences: state.accountPreferences }, state.mustSetPin ? { mustSetPin: true } : {}));
    if (key === "POST /api/auth/register") return json(200, { ok: true });
    if (key === "POST /api/auth/reset/request") return json(200, { ok: true });
    if (key === "POST /api/auth/change-pin") {
      // A refusal a case asked for: its code, and its sentence in the
      // request's language, ?locale= first and the account's after it,
      // the way Step 137 answers.
      // A wrong current PIN is a 401, the way the API answers it; every
      // other refusal is a 400.
      if (state.pinRefusal) {
        const code = state.pinRefusal;
        state.pinRefusal = null;
        return json(code === "PIN_INCORRECT" ? 401 : 400, { error: PIN_REFUSALS[code][languageOf(search, state) === "es" ? 1 : 0], code: code });
      }
      state.mustSetPin = false;
      // The API's Step 283 ends every other session on a change and
      // answers this device a new one.
      if (state.pinGate) return json(200, { message: "Your PIN has been changed.", code: "auth.pinChanged", mustSetPin: false, token: "token-two" });
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
        return json(400, { error: BADGE_MISMATCH[0], code: "BADGE_MISMATCH" });
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
    // The caller's own capabilities, Step 179 in the API, read off the role
    // the way middleware/capabilities.js reads them: an admin and a
    // supervisor hold the ones their tier holds, and everyone else, a lead
    // or a custodial lead among them, holds a staff member's.
    if (key === "GET /api/users/me/permissions") {
      if (!state.permissionsRoute) return json(404, { error: "Endpoint not found" });
      const tier = state.person.role === "admin" || state.person.role === "supervisor" ? state.person.role : "staff";
      const capabilities = {};
      Object.keys(CAPABILITIES).forEach((k) => { capabilities[k] = CAPABILITIES[k].indexOf(tier) !== -1; });
      return json(200, { role: state.person.role, capabilities: capabilities });
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
      Object.assign({ task_id: "at-1", label: "Replace the cracked light cover", description: "Second floor corridor.", site_name: "North Building", building_name: "Main Hall", floor_number: "2", zone: "Corridor", priority: "high", cims_category: "SD", created_by_name: "A supervisor", task_created_at: iso(NOW.getTime() - DAY) },
        state.assignedDue ? { due_date: state.assignedDue } : {}),
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
      if (wanted !== null && labels.indexOf(wanted) === -1) return refuse("shiftInvalid", { shifts: labels.map(l => inLanguage(l, lang)).join(", ") });
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
    // One open shift of every origin, the first of them the one a case
    // claims, and one marked urgent, so the sweep draws every badge the
    // card can carry and the URGENT chip beside a name.
    if (key === "GET /api/pickups/available") return json(200, [
      { id: "pk-1", scheduled_date: "2026-10-08", start_time: "17:00", end_time: "23:00", site_name: "South Building", origin: "voluntary_drop", service_category: "Day porter" },
      { id: "pk-2", scheduled_date: "2026-10-09", start_time: "06:00", end_time: "14:00", site_name: "North Building", origin: "callout", urgency: "urgent", service_category: "Day porter" },
      { id: "pk-3", scheduled_date: "2026-10-10", start_time: "22:00", end_time: "06:00", site_name: "West Building", origin: "no_show", service_category: "Day porter" },
      { id: "pk-4", scheduled_date: "2026-10-11", start_time: "08:00", end_time: "12:00", site_name: "South Building", origin: "extra_coverage", service_category: "Day porter" },
      { id: "pk-5", scheduled_date: "2026-10-12", start_time: "14:00", end_time: "18:00", site_name: "North Building", origin: "new_shift", service_category: "Day porter" },
    ]);
    if (key === "GET /api/pickups/my-pickups") return json(200, state.myPickups);
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
    // refusals as Step 132 writes them; and Step 179's read receipt, the
    // people a message may tag, and the tags on a message
    if (state.chatPeopleRoute && key === "GET /api/chat/people") return json(200, { people: [{ userId: ADMIN_PERSON.id, name: ADMIN_PERSON.firstName + " " + ADMIN_PERSON.lastName, role: ADMIN_PERSON.role, kind: "office" }]
      .concat(STAFF.slice(0, 8).map(x => ({ userId: x.id, name: x.firstName + " " + x.lastName, role: "custodian", kind: "staff" }))) });
    if (key === "GET /api/chat/channels") return json(200, state.chat.channels.map(ch => Object.assign({}, ch)));
    const chatRoute = /^\/api\/chat\/channels\/([^/]+)\/(messages|read|members)$/.exec(pathname);
    if (chatRoute && (chatRoute[2] === "messages" ? (method === "GET" || method === "POST") : chatRoute[2] === "read" ? method === "POST" : method === "GET")) {
      const id = decodeURIComponent(chatRoute[1]);
      // An API from before Step 179 has no members route.
      if (chatRoute[2] === "members" && !state.chat.membersRoute) return json(404, { error: "Endpoint not found" });
      const mine = state.chat.channels.some(ch => ch.id === id);
      const anywhere = mine || id === CHAT_GENERAL.id || CHAT_SITES.some(s => s.id === id) || /^dm-/.test(id);
      if (!anywhere) return chatRefusal("chat.notFound", search);
      if (!mine) return chatRefusal("chat.noAccess", search);
      // Reading a chat, by its messages or by the read route, moves the
      // caller's receipt to now, so its count on the list is zero.
      const seen = () => state.chat.channels.forEach((ch) => { if (ch.id === id) ch.unreadCount = 0; });
      if (chatRoute[2] === "read") { seen(); return json(200, { ok: true }); }
      if (chatRoute[2] === "members") {
        const people = state.chat.alone ? [] : chatPeopleOf(id).filter(p => p.id !== state.person.id);
        return json(200, { members: people.map(p => ({ id: p.id, name: p.name, role: p.role })) });
      }
      const kept = state.chat.messages[id] || (state.chat.messages[id] = []);
      if (method === "GET") {
        seen();
        // A message that tags someone is drawn cut at each tag, and each
        // piece is still the sender's own words.
        kept.forEach((m) => { if (Array.isArray(m.mentions) && m.mentions.length) mentionPieces(m.text, m.mentions).forEach(p => recordWord(p, "name")); });
        return json(200, kept.slice(-50).map(m => Object.assign({ mentions: [] }, m)));
      }
      const text = body && typeof body.text === "string" ? body.text.trim() : "";
      if (!text) return chatRefusal("chat.textRequired", search);
      if (text.length > CHAT_TEXT_MAX) return chatRefusal("chat.textTooLong", search);
      // The people it tags: at most ten, each someone else who can read
      // the chat, a repeated id counted once, the way the API reads them.
      const asked = body && body.mentions !== undefined && body.mentions !== null ? body.mentions : [];
      if (!Array.isArray(asked)) return chatRefusal("chat.mentionNotMember", search);
      const ids = Array.from(new Set(asked.map(v => String(v))));
      if (ids.length > CHAT_MENTIONS_MAX) return chatRefusal("chat.tooManyMentions", search);
      const people = chatPeopleOf(id);
      if (ids.some(x => x === state.person.id || !people.some(p => p.id === x))) return chatRefusal("chat.mentionNotMember", search);
      const tagged = ids.map(x => people.find(p => p.id === x)).sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ id: p.id, name: p.name }));
      state.chat.seq += 1;
      const row = { id: "m-sent-" + state.chat.seq, senderId: state.person.id, senderName: state.person.firstName + " " + state.person.lastName, senderRole: state.person.role, text: text, sentAt: iso(clockNow()), mentions: tagged };
      if (tagged.length) mentionPieces(text, tagged).forEach(p => recordWord(p, "name"));
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
    // The unfinished reports, a discarded one no longer among them.
    if (pathname === "/api/agent/drafts" && method === "GET") return json(200, state.drafts.filter(d => state.discarded.indexOf(String(d.id)) === -1));
    // The conversation as the API keeps it: every question, and every
    // answer once it is written. An answer is a Help reply, and a question
    // is the person's own words. Since Step 183 each answer carries its id
    // and its rating, null until it is rated.
    if (method === "GET" && /^\/api\/agent\/conversations\//.test(pathname)) {
      const now = Date.now();
      const messages = pathname.split("/").pop() === state.conversationId
        ? state.stored.filter(m => m.at <= now).map(m => (m.role === "assistant"
          ? Object.assign({ id: m.id, role: m.role, text: m.text, citedDocs: m.citedDocs, pictures: (m.pictures || []).map(x => Object.assign({}, x)), degraded: m.degraded, noProcedure: m.noProcedure, feedback: m.feedback ? Object.assign({}, m.feedback) : null }, m.citedNames ? { citedNames: m.citedNames } : {})
          : { role: m.role, text: m.text }))
        : [];
      messages.forEach((m) => { if (m.role === "assistant") recordWord(m.text, "Help reply"); });
      return json(200, { messages: messages });
    }
    // Rating an answer, Step 183: helpful true or false, and a note of at
    // most 500 characters. Rating again replaces the rating. An id that is
    // not one of this person's answers answers help.messageNotFound.
    const rating = method === "POST" ? /^\/api\/agent\/messages\/([^/]+)\/feedback$/.exec(pathname) : null;
    if (rating) {
      const b = body && typeof body === "object" ? body : {};
      const lang = languageOf(search, state);
      if (b.note !== undefined && b.note !== null && String(b.note).trim().length > RATING_NOTE_MAX) return json(400, { error: refusalIn(RATING_NOTE_LONG, lang, { max: RATING_NOTE_MAX }), code: "help.noteTooLong" });
      if (typeof b.helpful !== "boolean") return json(400, { error: refusalIn(RATING_INVALID, lang), code: "help.feedbackInvalid" });
      const note = b.note === undefined || b.note === null ? null : String(b.note).trim() || null;
      const row = state.stored.find(m => m.role === "assistant" && m.id === decodeURIComponent(rating[1]));
      if (!row) return apiRefusal("help.messageNotFound", search);
      row.feedback = { helpful: b.helpful, note: note, at: iso(clockNow()) };
      return json(200, { ok: true, feedback: Object.assign({}, row.feedback) });
    }
    if (method === "POST" && /^\/api\/agent\/drafts\/[^/]+\/submit$/.test(pathname)) return json(200, { ok: true });

    // --- the customer's page, Step 167 in the API
    //
    // No sign-in: answered in the language the request asks for, the
    // browser's own after it, like every call made before signing in.
    // The filing is checked whole and answered { ok: true } and nothing
    // else. Every refusal carries its code, and the ones that name a
    // question carry keys.
    const publicLang = signedOutLanguage(search, (headers || {})["accept-language"]);
    const publicRefusal = (code, extra, vars) => {
      const r = API_REFUSALS[code] || FILE_REFUSALS[code];
      return json(r.status, Object.assign({ error: refusalIn(r, publicLang, vars || r.vars), code: code }, extra || {}));
    };
    // --- the request link (Step 252), behind state.requests
    const requestGet = /^\/api\/public\/requests\/([^/]+)$/.exec(pathname);
    const requestPhotos = /^\/api\/public\/requests\/([^/]+)\/photos$/.exec(pathname);
    if (requestGet || requestPhotos) {
      const token = (requestGet || requestPhotos)[1];
      const link = state.requests ? REQUEST_LINKS[token] : null;
      if (!link) return publicRefusal("customer.linkUnknown");
      if (link.closed) return publicRefusal("customer.linkClosed", { officePhone: REQUEST_OFFICE_PHONE });
      if (method === "POST" && requestPhotos) {
        const bytes = Buffer.isBuffer(body) ? body : Buffer.alloc(0);
        const parts = bytes.toString("latin1").split(/name="photos"/).slice(1);
        if (parts.length === 0) return publicRefusal("customer.photoType");
        if (parts.some(p => !/Content-Type: image\/(jpeg|png|webp)/i.test(p.slice(0, 400)))) return publicRefusal("customer.photoType");
        if (state.requestPhotos.length + parts.length > 3) return publicRefusal("customer.tooManyPhotos");
        const photos = parts.map((p, i) => ({ id: "rp-" + (state.requestPhotos.length + i + 1), name: (/filename="([^"]*)"/.exec(p) || [])[1] || "photo" }));
        photos.forEach(ph => state.requestPhotos.push(ph));
        return json(201, { photos: photos });
      }
      if (method === "GET" && requestGet) {
        return json(200, {
          title: requestWord(publicLang, "title"), site: { name: PUBLIC_SITE }, company: { name: PUBLIC_COMPANY, logoUrl: null },
          area: link.area, askArea: link.area === null,
          categories: REQUEST_CATEGORIES.map(c => ({ key: c.key, title: c[publicLang === "es" ? "es" : "en"][0], help: c[publicLang === "es" ? "es" : "en"][1] })),
          maxPhotos: 3, maxNote: 500, officePhone: REQUEST_OFFICE_PHONE, concernUrl: REQUEST_CONCERN_URL, scopeLine: requestWord(publicLang, "scope"),
        });
      }
      if (method === "POST" && requestGet) {
        const b = body && typeof body === "object" ? body : {};
        if (typeof b.website === "string" && b.website.trim() !== "") return json(200, { ok: true });
        if (!REQUEST_CATEGORIES.some(c => c.key === b.category)) return publicRefusal("customer.request.badCategory", { keys: ["category"] });
        const area = link.area === null ? String(b.area || "").trim() : link.area;
        if (link.area === null && !area) return publicRefusal("customer.request.areaRequired", { keys: ["area"] });
        if (area.length > 80) return publicRefusal("customer.request.tooLong", { keys: ["area"] });
        if (String(b.note || "").length > 500) return publicRefusal("customer.request.tooLong", { keys: ["note"] });
        const email = String(b.email || "").trim();
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return publicRefusal("customer.request.badEmail", { keys: ["email"] });
        // Each photo as the photo route answered it, { id, name }: an id
        // alone, or a pair the route never answered, is refused.
        const given = Array.isArray(b.photos) ? b.photos : [];
        if (given.some(x => !x || typeof x !== "object" || !state.requestPhotos.some(ph => ph.id === x.id && ph.name === x.name))) return publicRefusal("forms.photoType", { keys: ["photos"] });
        const ids = given.map(x => x.id);
        // A filing whose category matches an open one from the same link
        // joins it; other never joins.
        const open = state.requestsFiled.find(f => f.token === token && f.category === b.category && b.category !== "other");
        state.requestsFiled.push({ token: token, locale: publicLang, category: b.category, area: area, note: String(b.note || ""), email: email, photos: given.map(x => ({ id: x.id, name: x.name })), body: b, joined: !!open });
        const lines = [requestWord(publicLang, "thanks"), requestWord(publicLang, "ref", { reference: REQUEST_REF })];
        if (open) lines.push(requestWord(publicLang, "joined"));
        if (email) lines.push(requestWord(publicLang, "mail"));
        if (b.category === "urgent") lines.push(requestWord(publicLang, "danger"));
        return json(open ? 200 : 201, { ok: true, reference: REQUEST_REF, joined: !!open, emailed: !!email, thanks: lines });
      }
    }
    // --- the supply label (Step 252), behind state.supplyQr: the public
    // read, and the signed-in read of the sites that hold it.
    const supplyPublic = /^\/api\/public\/supplies\/([^/]+)$/.exec(pathname);
    if (method === "GET" && supplyPublic) {
      if (!state.supplyQr || supplyPublic[1] !== SUP_CODE) return publicRefusal("supplies.notFound");
      return json(200, { supply: Object.assign({}, SUP_ITEM, { id: undefined }), company: { name: PUBLIC_COMPANY, logoUrl: null } });
    }
    const supplyByQr = /^\/api\/supplies\/by-qr\/([^/]+)$/.exec(pathname);
    if (method === "GET" && supplyByQr) {
      if (!state.supplyQr || supplyByQr[1] !== SUP_CODE) return apiRefusal("supplies.notFound", search);
      return json(200, { supply: { id: SUP_ITEM.id, code: SUP_ITEM.code, name: SUP_ITEM.name, unit: SUP_ITEM.unit, category: SUP_ITEM.category }, sites: SUP_SITES });
    }
    const publicGet = /^\/api\/public\/forms\/([^/]+)$/.exec(pathname);
    const publicPost = /^\/api\/public\/forms\/([^/]+)\/responses$/.exec(pathname);
    // The link's photo route, open to every form whose photoRoute is true:
    // each photo a multipart part named photos, images only, answered with
    // an id the filing names.
    const publicPhotos = /^\/api\/public\/forms\/([^/]+)\/photos$/.exec(pathname);
    const linkOf = (token) => { const l = CUSTOMER_LINKS[token]; return l && (!l.only || state[l.only]) ? l : null; };
    if (method === "POST" && publicPhotos) {
      const link = linkOf(publicPhotos[1]);
      if (!link) return publicRefusal("customer.linkUnknown");
      if (link.closed) return publicRefusal("customer.linkClosed");
      if (!photoRouteOf(link.form)) return publicRefusal("customer.linkUnknown");
      const bytes = Buffer.isBuffer(body) ? body : Buffer.alloc(0);
      const parts = bytes.toString("latin1").split(/name="photos"/).slice(1);
      if (parts.length === 0) return publicRefusal("customer.photoType");
      if (parts.some(p => !/Content-Type: image\/(jpeg|png|webp)/i.test(p.slice(0, 400)))) return publicRefusal("customer.photoType");
      if (state.linkPhotos.length + parts.length > 5) return publicRefusal("customer.tooManyPhotos");
      const photos = parts.map((p, i) => {
        const name = (/filename="([^"]*)"/.exec(p) || [])[1] || "photo";
        const id = "cp-" + (state.linkPhotos.length + i + 1);
        return { id: id, name: name, exif: p.indexOf("Exif") !== -1, gps: p.indexOf("GPS-INVENTED") !== -1, head: Buffer.from(p.slice(p.indexOf("\r\n\r\n") + 4, p.indexOf("\r\n\r\n") + 6), "latin1").toString("hex") };
      });
      photos.forEach(ph => state.linkPhotos.push(ph));
      return json(201, { photos: photos.map(ph => ({ id: ph.id, name: ph.name })) });
    }
    if ((method === "GET" && publicGet) || (method === "POST" && publicPost)) {
      const token = (publicGet || publicPost)[1];
      const link = linkOf(token);
      if (!link) return publicRefusal("customer.linkUnknown");
      if (link.closed) return publicRefusal("customer.linkClosed");
      const form = customerFormOf(link.form, publicLang);
      // The form's own name and role questions, where it asks them.
      const asked = customerFieldsOf(link.form);
      if (method === "GET") {
        return json(200, {
          form: form, site: { name: PUBLIC_SITE }, company: { name: PUBLIC_COMPANY, logoUrl: null },
          customerNameRequired: customerNameRequired(link.form),
          customerFields: asked,
          photoRoute: photoRouteOf(link.form),
          customerTitle: link.form === FORM_N_CODE ? FORM_N_WORDS[publicLang === "es" ? "es" : "en"].title : null,
        });
      }
      const b = body && typeof body === "object" ? body : {};
      // The honeypot: a filing that fills it is answered as if it went.
      if (typeof b.website === "string" && b.website.trim() !== "") return json(200, { ok: true });
      if (state.customerFiled.length >= PUBLIC_FILINGS_MAX) return publicRefusal("customer.tooManyFilings");
      const answers = b.answers === undefined || b.answers === null ? {} : b.answers;
      if (!answers || typeof answers !== "object" || Array.isArray(answers)) return publicRefusal("forms.answersShape");
      const unanswerable = [];
      const invalid = [];
      const got = {};
      for (const k of Object.keys(answers)) {
        const field = form.fields.find(f => f.key === k);
        const v = answers[k];
        if (!field) { unanswerable.push(k); continue; }
        if (v === null || v === undefined || v === "") continue;
        if (field.type === "customer_signature") {
          const o = v && typeof v === "object" ? v : {};
          if (!String(o.name || "").trim()) return publicRefusal("customer.nameRequired", { keys: [k] });
          const drawn = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(String(o.signature || "").trim());
          if (!String(o.signature || "").trim()) return publicRefusal("forms.signatureRequired", { keys: [k] });
          const bytes = drawn ? Buffer.from(drawn[1].replace(/\s+/g, ""), "base64") : null;
          if (!bytes || !sniffImage(bytes) || sniffImage(bytes).ext !== "png") return publicRefusal("forms.signatureInvalid", { keys: [k] });
          if (bytes.length > SIGNATURE_MAX_BYTES) return publicRefusal("forms.signatureTooLarge", { keys: [k] });
          got[k] = { name: String(o.name).trim(), role: String(o.role || "").trim(), bytes: bytes.length, size: imageSize(bytes) };
          continue;
        }
        if (field.type === "photos" && photoRouteOf(link.form)) {
          // Named by the ids the photo route answered, never sent again.
          const list = Array.isArray(v) ? v : [v];
          const ids = list.map(e => (e && typeof e === "object" ? e.id : null));
          if (ids.some(id => !state.linkPhotos.some(ph => ph.id === id))) return publicRefusal("forms.photoType", { keys: [k] });
          if (list.length > (field.maxPhotos || 5)) return publicRefusal("customer.tooManyPhotos", { keys: [k] });
          got[k] = ids;
          continue;
        }
        if (field.type === "photos") {
          const list = Array.isArray(v) ? v : [v];
          if (list.length > PUBLIC_MAX_PHOTOS) return publicRefusal("forms.photoLimit", { keys: [k] }, { max: PUBLIC_MAX_PHOTOS });
          const kept = [];
          for (const entry of list) {
            const data = entry && typeof entry === "object" ? entry.data : entry;
            const m = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)?;base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(data || "").trim());
            if (!m) return publicRefusal("forms.photoType", { keys: [k] });
            const bytes = Buffer.from(m[2].replace(/\s+/g, ""), "base64");
            if (bytes.length > PUBLIC_PHOTO_MAX_BYTES) return publicRefusal("customer.photoTooLarge", { keys: [k] });
            const kind = sniffImage(bytes);
            if (!kind || kind.heic) return publicRefusal("forms.photoType", { keys: [k] });
            kept.push({ name: entry && typeof entry === "object" ? String(entry.name || "photo") : "photo", bytes: bytes.length, kind: kind, size: imageSize(bytes) });
          }
          if (kept.length > 0) got[k] = kept;
          continue;
        }
        if (field.type === "select") {
          if (!(field.options || []).some(o => o.value === String(v))) { invalid.push(k); continue; }
          got[k] = String(v);
          continue;
        }
        if (typeof v === "object") { invalid.push(k); continue; }
        got[k] = String(v);
      }
      if (unanswerable.length > 0) return publicRefusal("forms.unanswerable", { keys: unanswerable });
      if (invalid.length > 0) return publicRefusal("forms.invalidAnswers", { keys: invalid });
      // A form whose own questions ask for the person takes the name and
      // role from them, and the body's are not read (Step 242).
      const customerName = String((asked ? got[asked.name] : b.customerName) || "").replace(/\s+/g, " ").trim();
      if (customerNameRequired(link.form) && !customerName) return publicRefusal("customer.nameRequired", asked ? { keys: [asked.name] } : undefined);
      if (link.form === FORM_N_CODE && !got.client_email && !got.client_phone) return publicRefusal("customer.contactRequired", { keys: ["client_email", "client_phone"] });
      const missing = form.fields.filter(f => f.required && got[f.key] === undefined).map(f => f.key);
      if (missing.length > 0) {
        return publicRefusal("forms.requiredUnanswered", { missing: missing, missingFields: missing.map(k => ({ key: k, label: form.fields.find(f => f.key === k).label })) });
      }
      // The call's record carries what the API read off the body, so a
      // case can judge the photos and the drawing by their bytes.
      state.calls[state.calls.length - 1].read = got;
      state.customerFiled.push({ token: token, locale: publicLang, customerName: customerName, customerRole: String((asked ? got[asked.role] : b.customerRole) || "").trim(), answers: got, body: b });
      if (link.form === FORM_N_CODE) return json(200, { ok: true, reference: CONCERN_REF, emailed: !!got.client_email });
      return json(200, { ok: true });
    }

    // --- discarding a draft, Step 183: the person who started it, while it
    // is a draft. A discarded draft leaves the drafts list; one discarded
    // already answers forms.notADraft, and one that is not there answers
    // forms.reportNotFound. The report Help starts is draft-one.
    const discarding = method === "POST" ? /^\/api\/forms\/drafts\/([^/]+)\/discard$/.exec(pathname) : null;
    if (discarding) {
      const id = decodeURIComponent(discarding[1]);
      if (state.discarded.indexOf(id) !== -1) {
        const r = apiRefusal("forms.notADraft", search);
        return json(r.status, Object.assign(JSON.parse(r.body), { status: "void" }));
      }
      if (id !== "draft-one" && !state.drafts.some(d => String(d.id) === id)) return apiRefusal("forms.reportNotFound", search);
      state.discarded.push(id);
      return json(200, { ok: true });
    }

    // --- report forms
    //
    // Two forms now: the one built today, and the second one carrying a
    // checklist, a table a person adds rows to, and a sign-off. Which
    // one a request means is read from the code in the path, or from the
    // draft id, the way the real API reads it.
    const second = (p) => /TEST-FORM-P/.test(p) || /draft-two/.test(p);
    const third = (p) => state.sectionsForm && (/TEST-FORM-S/.test(p) || /draft-three/.test(p));
    const thirdForm = () => formS(lang, state.sectionsForm === "one");
    // The form about one person, served when a case asks for it.
    const fourth = (p) => state.personForm && (/TEST-FORM-E/.test(p) || /draft-four/.test(p));
    // The catalog carries each form whole, fields and all, because the
    // form is what says which questions a report has and the screen
    // reads them from here. It served only the code and the title until
    // now, which is why no question has ever drawn in the suite. Since
    // Step 186 it is the latest published version of each form, and a
    // draft keeps the version it was started on, which the draft routes
    // send beside it; with formVersions the incident report has a second
    // version out.
    if (pathname === "/api/forms") {
      return json(200, { forms: [state.formVersions ? FORM_V2 : FORM, formP(lang)].concat(state.sectionsForm ? [thirdForm()] : []).concat(state.personForm ? [formE(lang)] : []).concat(state.guideForms ? guideForms(lang) : []) });
    }
    if (fourth(pathname)) {
      if (method === "GET" && /^\/api\/forms\/drafts\//.test(pathname)) return json(200, { draft: draftE(state, lang), form: formE(lang) });
      if (method === "POST" && /^\/api\/forms\/[^/]+\/drafts$/.test(pathname)) return json(200, { draft: draftE(state, lang), form: formE(lang) });
      if (method === "GET" && /^\/api\/forms\/[^/]+$/.test(pathname)) return json(200, { form: formE(lang) });
      // A person is read off the staff by its id, the way Step
      // 186 reads one: the id picks the person, and the name kept is the
      // one the staff list has today. Every key is checked before any is
      // written.
      if (method === "PATCH" && /^\/api\/forms\/drafts\//.test(pathname)) {
        const written = (body && body.answers) || {};
        const fields = formE(lang).fields;
        const merge = {};
        const invalid = [];
        Object.keys(written).forEach((k) => {
          const f = fields.find(x => x.key === k);
          const v = written[k];
          if (!f) { invalid.push(k); return; }
          if (v === null || v === "") { merge[k] = null; return; }
          if (f.type !== "person") { merge[k] = v; return; }
          const id = v && typeof v === "object" ? String(v.userId || v.id || "") : String(v);
          const who = state.staff.concat([state.person]).find(p => String(p.id) === id);
          if (!who) { invalid.push(k); return; }
          merge[k] = { userId: who.id, name: who.firstName + " " + who.lastName };
        });
        if (invalid.length > 0) { const r = apiRefusal("forms.invalidAnswers", search); return json(r.status, Object.assign(JSON.parse(r.body), { keys: invalid })); }
        Object.keys(merge).forEach((k) => { if (merge[k] === null) delete state.answersE[k]; else state.answersE[k] = merge[k]; });
        return json(200, { draft: draftE(state, lang), form: formE(lang) });
      }
      if (method === "POST" && /^\/api\/forms\/drafts\/[^/]+\/submit$/.test(pathname)) {
        const short = draftE(state, lang).missing;
        if (short.length > 0) return json(400, { error: "Answer every required question before sending", missing: short });
        return json(200, { ok: true, reference: "TEST-FORM-E-0001" });
      }
    }
    if (method === "GET" && /^\/api\/forms\/drafts\//.test(pathname)) {
      if (third(pathname)) return json(200, { draft: draftS(state, lang), form: thirdForm() });
      return second(pathname) ? json(200, { draft: draftP(state, lang), form: formP(lang) }) : json(200, { draft: draftOf(state), form: FORM });
    }
    if (method === "POST" && /^\/api\/forms\/[^/]+\/drafts$/.test(pathname)) {
      if (third(pathname)) return json(200, { draft: draftS(state, lang), form: thirdForm() });
      return second(pathname) ? json(200, { draft: draftP(state, lang), form: formP(lang) }) : json(200, { draft: draftOf(state), form: FORM });
    }
    if (method === "PATCH" && /^\/api\/forms\/drafts\//.test(pathname)) {
      const bag = third(pathname) ? state.answersS : second(pathname) ? state.answersP : state.answers;
      const written = (body && body.answers) || {};
      // A sign-off is never written this way, which is what the API says.
      const signoff = Object.keys(written).find(k => /Sign$/.test(k));
      if (second(pathname) && signoff) return json(400, { error: "A sign-off is made with its own button" });
      if (second(pathname) && Object.keys(written).some(k => formP(lang).fields.some(f => f.key === k && f.type === "photos"))) return apiRefusal("forms.photosByRoute", search);
      if (second(pathname) && Object.keys(written).some(k => formP(lang).fields.some(f => f.key === k && f.type === "customer_signature"))) return apiRefusal("forms.customerSignatureByRoute", search);
      if (second(pathname)) {
        const notNumbers = Object.keys(written).filter(k => written[k] !== null && formP(lang).fields.some(f => f.key === k && f.type === "number") && !(typeof written[k] === "number" && Number.isFinite(written[k])));
        if (notNumbers.length > 0) { const r = apiRefusal("forms.badNumber", search); return json(r.status, Object.assign(JSON.parse(r.body), { keys: notNumbers })); }
      }
      Object.keys(written).forEach((k) => { if (written[k] === null) delete bag[k]; else bag[k] = written[k]; });
      if (third(pathname)) return json(200, { draft: draftS(state, lang), form: thirdForm() });
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
    // A customer's signature on the second form, saved on the staff
    // member's phone through its own route, Step 167 in the API: the
    // name required, the role optional, the drawing a PNG under 300 KB.
    // The answer is the draft with the stamp on it, and the field views
    // with the line the stamp reads as.
    if (method === "POST" && pathname === "/api/forms/drafts/draft-two/customer-signature") {
      const wanted = String((body && body.key) || "");
      const field = formP(lang).fields.find(f => f.key === wanted && f.type === "customer_signature");
      if (!field) return apiRefusal("forms.notACustomerSignature", search);
      const name = String((body && body.name) || "").replace(/\s+/g, " ").trim();
      if (!name) return apiRefusal("customer.nameRequired", search);
      const raw = body && body.signature !== undefined && body.signature !== null ? String(body.signature).trim() : "";
      if (!raw) return apiRefusal("forms.signatureRequired", search);
      const drawn = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw);
      const bytes = drawn ? Buffer.from(drawn[1].replace(/\s+/g, ""), "base64") : null;
      if (!bytes || !sniffImage(bytes) || sniffImage(bytes).ext !== "png") return apiRefusal("forms.signatureInvalid", search);
      if (bytes.length > SIGNATURE_MAX_BYTES) return apiRefusal("forms.signatureTooLarge", search);
      state.signatureBytes[wanted] = bytes;
      state.calls[state.calls.length - 1].signature = { bytes: bytes.length, size: imageSize(bytes) };
      const stamp = { name: name, role: String((body && body.role) || "").trim() || null, signatureId: "csig-" + wanted + "-" + (++state.photoSeq), at: iso(NOW.getTime()) };
      state.answersP[wanted] = stamp;
      return json(200, { draft: draftP(state, lang), fields: formP(lang).fields.map(f => (f.key === wanted ? { key: f.key, type: f.type, value: stamp, displayValue: customerSignatureLine(stamp, lang), signature: { id: stamp.signatureId } } : { key: f.key, type: f.type })) });
    }
    // Photos on the second form, the four routes Step 163 gave the API.
    // The bytes are read for what they are, every file is checked before
    // any is kept, and the answer is the question's list.
    const photoPost = /^\/api\/forms\/responses\/draft-two\/photos\/([^/]+)$/.exec(pathname);
    const photoOne = /^\/api\/forms\/responses\/draft-two\/photos\/([^/]+)\/([^/]+)$/.exec(pathname);
    const photoQuestion = (k) => formP(lang).fields.find(f => f.key === k && f.type === "photos");
    const photoList = (k) => (Array.isArray(state.answersP[k]) ? state.answersP[k] : []);
    const writePhotoList = (k, list) => { if (list.length === 0) delete state.answersP[k]; else state.answersP[k] = list; };
    if (method === "POST" && photoPost) {
      const field = photoQuestion(photoPost[1]);
      if (!field) return apiRefusal("forms.notAPhotosQuestion", search);
      const parts = multipartParts(body, headers).filter(p => p.name === "photos" && p.filename !== null);
      // What the phone sent, on the record for the case to read.
      const call = state.calls[state.calls.length - 1];
      call.files = parts.map(p => ({ name: p.filename, type: p.type, bytes: p.bytes.length, kind: sniffImage(p.bytes), size: imageSize(p.bytes) }));
      if (parts.length === 0) return apiRefusal("forms.photoNoFile", search);
      const held = photoList(field.key);
      if (held.length + parts.length > field.maxPhotos) return apiRefusal("forms.photoLimit", search);
      for (const p of parts) {
        const kind = sniffImage(p.bytes);
        if (p.bytes.length > 10 * 1024 * 1024) return apiRefusal("forms.photoTooLarge", search);
        if (kind && kind.heic) return apiRefusal("forms.photoHeic", search);
        if (!kind) return apiRefusal("forms.photoType", search);
      }
      const added = parts.map((p) => {
        const id = "ph-" + (++state.photoSeq);
        const kind = sniffImage(p.bytes);
        state.photoBytes[id] = { bytes: p.bytes, contentType: kind.contentType };
        return { id: id, name: p.filename || "photo", bytes: p.bytes.length, contentType: kind.contentType, uploadedAt: iso(NOW.getTime()) };
      });
      writePhotoList(field.key, held.concat(added));
      return json(201, { key: field.key, photos: photoList(field.key) });
    }
    if (method === "DELETE" && photoOne) {
      const field = photoQuestion(photoOne[1]);
      if (!field) return apiRefusal("forms.notAPhotosQuestion", search);
      const held = photoList(field.key);
      if (!held.some(p => p.id === photoOne[2])) return apiRefusal("forms.photoNotFound", search);
      writePhotoList(field.key, held.filter(p => p.id !== photoOne[2]));
      return json(200, { key: field.key, photos: photoList(field.key) });
    }
    if (method === "GET" && photoOne && photoOne[2] === "thumb") {
      const kept = state.photoBytes[photoOne[1]];
      if (!kept) return apiRefusal("forms.photoNotFound", search);
      return image(kept.contentType, kept.bytes);
    }
    if (method === "GET" && photoPost) {
      const kept = state.photoBytes[photoPost[1]];
      if (!kept) return apiRefusal("forms.photoNotFound", search);
      return image(kept.contentType, kept.bytes);
    }
    // One sign-off, made with its own button, stamped by the server with
    // the person signing and the clock.
    if (method === "POST" && /^\/api\/forms\/responses\/[^/]+\/signoff$/.test(pathname)) {
      const wanted = String((body && body.key) || "");
      const field = formP(lang).fields.find(f => f.key === wanted && f.type === "signoff");
      if (!field) return json(400, { error: "That is not a sign-off on this form" });
      if (field.signer !== "filer") return json(403, { error: "You cannot sign this part of the form" });
      if (state.answersP[wanted]) return json(409, { error: "This part is already signed" });
      // Since Step 163 the body carries the drawing, a PNG data URL of at
      // most 300 KB, checked before anything is written, and the stamp
      // carries its id.
      const raw = body && body.signature !== undefined && body.signature !== null ? String(body.signature).trim() : "";
      if (!raw) return apiRefusal("forms.signatureRequired", search);
      const drawn = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw);
      const bytes = drawn ? Buffer.from(drawn[1].replace(/\s+/g, ""), "base64") : null;
      if (!bytes || !sniffImage(bytes) || sniffImage(bytes).ext !== "png") return apiRefusal("forms.signatureInvalid", search);
      if (bytes.length > SIGNATURE_MAX_BYTES) return apiRefusal("forms.signatureTooLarge", search);
      state.signatureBytes[wanted] = bytes;
      state.calls[state.calls.length - 1].signature = { bytes: bytes.length, size: imageSize(bytes) };
      state.answersP[wanted] = {
        userId: state.person.id, name: state.person.firstName + " " + state.person.lastName,
        role: state.person.role, at: iso(NOW.getTime()), signatureId: "sig-" + wanted,
      };
      return json(200, { response: draftP(state, lang) });
    }
    // The drawing behind a sign-off, streamed to anyone who may read the
    // report. A stamp made before drawings were kept has none.
    const signatureGet = /^\/api\/forms\/responses\/draft-two\/signatures\/([^/]+)$/.exec(pathname);
    if (method === "GET" && signatureGet) {
      const stamp = state.answersP[signatureGet[1]];
      const kept = state.signatureBytes[signatureGet[1]];
      if (!stamp || !stamp.signatureId || !kept) return apiRefusal("forms.signatureNotFound", search);
      return image("image/png", kept);
    }
    if (method === "GET" && /^\/api\/forms\/[^/]+$/.test(pathname)) {
      if (third(pathname)) return json(200, { form: thirdForm() });
      return second(pathname) ? json(200, { form: formP(lang) }) : json(200, { form: FORM });
    }

    // --- Client requests (Step 252, the Step 250 contract section 7),
    // behind state.requests. Approvers are admins and supervisors; anyone
    // else reads the requests assigned to them. The view is the contract's
    // one shape, its can* flags set for the person signed in.
    if (state.requests && pathname.indexOf("/api/issues/") === 0) {
      const management = FK_MANAGEMENT.indexOf(state.person.role) !== -1;
      const me = { id: state.person.id, name: state.person.firstName + " " + state.person.lastName };
      const view = (r) => {
        const mine = r.assignedToMe === true || (r.assignedTo && r.assignedTo.id === state.person.id);
        const waiting = r.status === "awaiting_approval";
        const working = r.status === "open" || r.status === "in_progress";
        const late = (at) => (at && new Date(at).getTime() < clockNow());
        return {
          id: r.id, reference: r.reference, siteId: r.siteId, siteName: r.siteName, area: r.area, category: r.category, categoryTitle: requestCategoryTitle(r.category, lang),
          note: r.note, severity: r.severity, status: r.status, reportedAt: r.reportedAt, lastReportedAt: r.reportedAt, reportsCount: 1, attendedAtReport: true,
          respondBy: r.respondBy, respondState: r.firstResponseAt ? "answered" : late(r.respondBy) ? "late" : "dueSoon", dueAt: r.dueAt, dueState: r.resolvedAt ? "answered" : late(r.dueAt) ? "late" : "onTime",
          approvedAt: r.approvedAt || null, approvedBy: r.approvedAt ? me : null, declinedAt: r.declinedAt || null, declinedBy: r.declinedAt ? me : null, declineReason: r.declineReason || null,
          assignedTo: r.assignedTo || (r.assignedToMe ? me : null), firstResponseAt: r.firstResponseAt || null, firstResponseBy: r.firstResponseAt ? me : null,
          resolvedAt: r.resolvedAt || null, resolvedBy: r.resolvedAt ? me : null, responseMinutes: null, resolutionMinutes: r.resolvedAt ? 95 : null,
          route: null, absorbedMinutes: null, photos: r.photos, hasEmail: false, linkId: "req-area",
          canApprove: management && waiting, canDecline: management && waiting, canStart: (mine || management) && r.status === "open", canFinish: (mine || management) && working, canCannot: (mine || management) && working,
          canNote: mine || management, canSendToClient: false, canRoute: false,
        };
      };
      const readable = (r) => management || r.assignedToMe === true || (r.assignedTo && r.assignedTo.id === state.person.id);
      if (key === "GET /api/issues/requests") {
        const q = new URLSearchParams(search || "");
        const want = q.get("state") || "open";
        const shown = state.requestRows.filter(readable).filter(r => want === "all" || (want === "waiting" ? r.status === "awaiting_approval" : want === "closed" ? ["resolved", "closed", "declined"].indexOf(r.status) !== -1 : ["awaiting_approval", "open", "in_progress", "escalated"].indexOf(r.status) !== -1));
        return json(200, { requests: shown.map(view) });
      }
      const one = /^\/api\/issues\/requests\/([^/]+)$/.exec(pathname);
      if (method === "GET" && one) {
        const r = state.requestRows.find(x => x.id === one[1]);
        if (!r || !readable(r)) return json(404, { error: lang === "es" ? "No se encontr\u00f3 el problema" : "Issue not found", code: "issues.notFound" });
        const v = view(r);
        const answer = { request: v, activity: [{ id: "a-1", action: "filed", details: null, at: r.reportedAt, by: null, sentToClientAt: null }] };
        if (v.canApprove) answer.assignees = [REQUEST_ASSIGNEES[0], Object.assign({}, me, { role: state.person.role, onShift: false }), REQUEST_ASSIGNEES[1]];
        return json(200, answer);
      }
      const act = /^\/api\/issues\/([^/]+)\/(approve|decline|progress)$/.exec(pathname);
      if (method === "POST" && act) {
        const r = state.requestRows.find(x => x.id === act[1]);
        if (!r || !readable(r)) return json(404, { error: lang === "es" ? "No se encontr\u00f3 el problema" : "Issue not found", code: "issues.notFound" });
        const b = body && typeof body === "object" ? body : {};
        if (act[2] === "approve" || act[2] === "decline") {
          if (!management) return json(403, { error: lang === "es" ? "No tiene acceso" : "No access", code: "issues.noAccess" });
          // A request a case says someone else decided first: the other
          // approver's tap landed before this one, and every later read
          // answers their win.
          if (state.requestsTaken.indexOf(r.id) !== -1 && r.status === "awaiting_approval") { r.status = "open"; r.approvedAt = new Date(clockNow() - 60 * 1000).toISOString(); r.assignedTo = { id: REQUEST_ASSIGNEES[1].id, name: REQUEST_ASSIGNEES[1].name }; r.assignedToMe = false; r.takenElsewhere = true; }
          if (r.takenElsewhere || r.status !== "awaiting_approval") {
            const refusal = apiRefusal("issues.request.alreadyDecided", search);
            return json(409, Object.assign(JSON.parse(refusal.body), { status: "open", decidedBy: { name: ADMIN_PERSON.firstName + " " + ADMIN_PERSON.lastName }, decidedAt: new Date(clockNow() - 60 * 1000).toISOString() }));
          }
          if (act[2] === "approve") {
            const who = b.assignedTo === state.person.id ? Object.assign({}, me) : REQUEST_ASSIGNEES.map(a => ({ id: a.id, name: a.name })).find(a => a.id === b.assignedTo);
            if (!who) return json(400, { error: lang === "es" ? "Elija a alguien de la lista" : "Choose someone on the list", code: "issues.badAssignee" });
            r.status = "open"; r.approvedAt = new Date(clockNow()).toISOString(); r.assignedTo = who; r.assignedToMe = who.id === state.person.id;
          } else {
            if (!String(b.reason || "").trim()) return apiRefusal("issues.noteRequired", search);
            r.status = "declined"; r.declinedAt = new Date(clockNow()).toISOString(); r.declineReason = String(b.reason).trim(); r.firstResponseAt = r.declinedAt;
          }
          return json(200, { request: view(r) });
        }
        if (b.action === "start" && r.status === "open") { r.status = "in_progress"; r.firstResponseAt = new Date(clockNow()).toISOString(); }
        else if (b.action === "done" && (r.status === "open" || r.status === "in_progress")) { r.status = "resolved"; r.resolvedAt = new Date(clockNow()).toISOString(); r.firstResponseAt = r.firstResponseAt || r.resolvedAt; r.doneNote = String(b.note || ""); }
        else if (b.action === "cannot" && (r.status === "open" || r.status === "in_progress")) { if (!String(b.note || "").trim()) return apiRefusal("issues.noteRequired", search); r.status = "escalated"; r.cannotNote = String(b.note).trim(); }
        else if (["start", "done", "cannot"].indexOf(b.action) === -1) return json(400, { error: lang === "es" ? "Acci\u00f3n no v\u00e1lida" : "Bad action", code: "issues.request.badAction" });
        else { const refusal = apiRefusal("issues.request.wrongState", search); return json(409, Object.assign(JSON.parse(refusal.body), { status: r.status })); }
        return json(200, { request: view(r) });
      }
      const photo = /^\/api\/issues\/([^/]+)\/photos$/.exec(pathname);
      if (method === "POST" && photo && state.requestRows.some(x => x.id === photo[1])) {
        const r = state.requestRows.find(x => x.id === photo[1]);
        if (!body || !body.photoUrl) return json(400, { error: "Photo URL is required" });
        r.photos.push({ id: "rph-" + (r.photos.length + 1), url: String(body.photoUrl) });
        return json(201, { photo: { id: "rph-" + r.photos.length, url: String(body.photoUrl) } });
      }
    }
    // --- Step 264: the documents to read and sign (the Step 262
    // contract, section 6), behind state.training: one document for
    // everyone, in English alone, signed once per version.
    if (state.training && pathname.indexOf("/api/documents/") === 0) {
      const refuseDoc = (k, extra) => { const r = SESSION_REFUSALS[k]; return json(r.status, Object.assign({ error: refusalIn(r, lang), code: k }, extra || {})); };
      const signed = state.documentAcks.find(a => a.docCode === TRAINING_DOCUMENT.docCode && a.version === TRAINING_DOCUMENT.version && a.personId === state.person.id) || null;
      if (key === "GET /api/documents/to-sign") return json(200, { documents: signed ? [] : [{ docCode: TRAINING_DOCUMENT.docCode, title: TRAINING_DOCUMENT.title, version: TRAINING_DOCUMENT.version, locales: TRAINING_DOCUMENT.locales.slice(), signedVersion: null }] });
      const doc = /^(GET|POST) \/api\/documents\/([^/]+)\/(read|acknowledge)$/.exec(key);
      if (doc) {
        if (decodeURIComponent(doc[2]) !== TRAINING_DOCUMENT.docCode) return refuseDoc("documents.notFound");
        if (doc[3] === "read") {
          const loc = TRAINING_DOCUMENT.locales.indexOf(lang) !== -1 ? lang : "en";
          return json(200, { document: { docCode: TRAINING_DOCUMENT.docCode, title: TRAINING_DOCUMENT.title, version: TRAINING_DOCUMENT.version, locale: loc, locales: TRAINING_DOCUMENT.locales.slice(), sections: TRAINING_DOCUMENT.sections.map(s => Object.assign({}, s)), acknowledgement: TRAINING_DOCUMENT.acknowledgement[loc] || TRAINING_DOCUMENT.acknowledgement.en } });
        }
        const b = body && typeof body === "object" ? body : {};
        if (String(b.version || "") !== TRAINING_DOCUMENT.version) return refuseDoc("documents.versionChanged", { version: TRAINING_DOCUMENT.version });
        if (signed) return refuseDoc("documents.alreadySigned");
        const raw = typeof b.signature === "string" ? b.signature.trim() : "";
        const drawn = raw ? /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw) : null;
        const bytes = drawn ? Buffer.from(drawn[1].replace(/\s+/g, ""), "base64") : null;
        if (!bytes || !sniffImage(bytes) || sniffImage(bytes).ext !== "png") return refuseDoc("documents.signatureRequired");
        state.calls[state.calls.length - 1].signature = { bytes: bytes.length, size: imageSize(bytes) };
        const ack = { id: "da-" + (state.documentAcks.length + 1), docCode: TRAINING_DOCUMENT.docCode, version: TRAINING_DOCUMENT.version, personId: state.person.id, locale: b.locale === "es" || b.locale === "fr" ? b.locale : "en", signedAt: new Date().toISOString() };
        state.documentAcks.push(ack);
        return json(201, { acknowledgment: { id: ack.id, docCode: ack.docCode, version: ack.version, locale: ack.locale, signedAt: ack.signedAt } });
      }
      return refuseDoc("documents.notFound");
    }
    // --- My training (Step 258) and its lessons (Step 261), behind
    // state.training. Items tp-1 and tp-2 carry a lesson; an attempt of
    // this person on one moves the item to inProgress or awaitingTrainer.
    if (key === "GET /api/training/me") {
      if (!state.training) return json(404, { error: "Not found" });
      if (state.trainingNone) return json(200, { asOf: TRAINING_ME.asOf, items: [], records: [], attempts: [] });
      const me = JSON.parse(JSON.stringify(TRAINING_ME));
      me.items.forEach(item => {
        const lesson = TRAINING_LESSONS.find(l => l.topicId === item.topicId);
        if (!lesson) return;
        item.lesson = { versionId: lesson.versionId, attemptsUsed: lessonTries(lesson).used, attemptsLeft: lessonTries(lesson).left };
        const latest = lessonAttempts(lesson).slice(-1)[0] || null;
        if (!latest) return;
        if (latest.acknowledgedAt && latest.awaitingTrainer) { item.status = "awaitingTrainer"; item.attemptId = latest.id; }
        else if (latest.acknowledgedAt && !latest.awaitingTrainer) { item.status = "current"; item.completedDate = "2026-10-05"; item.attemptId = latest.id; }
        else if ((!latest.scoredAt || !latest.passed) && lessonTries(lesson).left > 0) { item.status = "inProgress"; item.attemptId = latest.id; }
      });
      me.attempts = TRAINING_LESSONS.map(l => lessonAttempts(l).slice(-1)[0]).filter(Boolean).map(attemptView);
      // Step 267, behind the trainingPortal switch (the Step 266 contract,
      // section 3): each item's category, place and sign-off checklist,
      // the items in category order, the categories the person holds an
      // item in with their counts, and Continue where you left off.
      if (state.trainingPortal) {
        const rank = (cat) => { const n = TRAINING_CATEGORIES.findIndex(c => c.key === (cat || "other")); return n === -1 ? TRAINING_CATEGORIES.length : n; };
        me.items.forEach(i => {
          const p = TRAINING_TOPIC_PLACE[i.topicId] || { category: null, sortOrder: 100 };
          const lesson = TRAINING_LESSONS.find(l => l.topicId === i.topicId);
          const signoff = p.signoffTopicId ? TRAINING_ME.items.find(x => x.topicId === p.signoffTopicId) : null;
          Object.assign(i, { topicKey: i.topicId, category: p.category, sortOrder: p.sortOrder, needsTrainer: i.safetyCritical || !!(lesson && lesson.needsTrainer), signoffBy: signoff ? { topicId: signoff.topicId, name: signoff.name } : null });
        });
        me.items.sort((a, b) => rank(a.category) - rank(b.category) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || String(a.siteName || "").localeCompare(String(b.siteName || "")));
        const isDone = (i) => i.status === "current" || i.status === "dueSoon";
        me.categories = TRAINING_CATEGORIES.map(c => {
          const rows = me.items.filter(i => (i.category || "other") === c.key);
          if (rows.length === 0) return null;
          const next = rows.find(i => !isDone(i) && i.status !== "awaitingTrainer");
          return { key: c.key, name: c[lang] || c.en, names: { en: c.en, es: c.es, fr: c.fr }, required: rows.length, done: rows.filter(isDone).length, toDo: rows.filter(i => !isDone(i) && i.status !== "inProgress" && i.status !== "awaitingTrainer").length, inProgress: rows.filter(i => i.status === "inProgress").length, awaitingTrainer: rows.filter(i => i.status === "awaitingTrainer").length, nextTopicId: next ? next.topicId : null };
        }).filter(Boolean);
        const open = state.trainingAttempts.filter(a => a.personId === state.person.id && !a.scoredAt && !a.voidedAt).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0] || null;
        const openItem = open ? me.items.find(i => i.topicId === open.topicId && i.lesson) : null;
        const first = me.items.find(i => ["missing", "expired", "refresherDue"].indexOf(i.status) !== -1 && i.lesson && i.lesson.attemptsLeft > 0) || null;
        const go = openItem || first;
        const cat = go ? TRAINING_CATEGORIES.find(c => c.key === (go.category || "other")) : null;
        me.continue = go ? { topicId: go.topicId, name: go.name, category: cat.key, categoryName: cat[lang] || cat.en, attemptId: openItem ? open.id : null, versionId: go.lesson.versionId, siteId: go.siteId || null } : null;
      }
      // Step 264, behind the documents switch: the first-day items, the
      // document to sign until it is signed, and a certificate on file.
      if (state.documents) {
        me.firstDay = me.items.filter(i => TRAINING_FIRST_DAY.indexOf(i.topicId) !== -1 && i.status !== "current").map(i => Object.assign({}, i));
        const signedDoc = state.documentAcks.some(a => a.docCode === TRAINING_DOCUMENT.docCode && a.version === TRAINING_DOCUMENT.version && a.personId === state.person.id);
        me.documentsToSign = signedDoc ? [] : [{ docCode: TRAINING_DOCUMENT.docCode, title: TRAINING_DOCUMENT.title, version: TRAINING_DOCUMENT.version, locales: TRAINING_DOCUMENT.locales.slice(), signedVersion: null }];
        me.records.forEach(r => { if (r.id === "tr-6") r.certificate = true; });
      }
      return json(200, me);
    }
    // --- Step 271: signatures sent to the person's phone, and the
    // person's company property (the Step 270 contract, section 2).
    if (state.signatures && (pathname.indexOf("/api/signatures") === 0 || pathname === "/api/hr/property/mine")) {
      const signRefuse = (k, extra) => { const r = SIGN_REFUSALS[k]; return json(r.status, Object.assign({ error: refusalIn(r, lang), code: k }, extra || {})); };
      const fill = (w, vars) => String(w[lang] || w.en).replace(/\{(\w+)\}/g, (whole, k) => (k in vars ? String(vars[k]) : whole));
      const itemLabel = (it) => (it.label ? it.label : it.kind && PROPERTY_KIND_WORDS[it.kind] ? PROPERTY_KIND_WORDS[it.kind][lang] || PROPERTY_KIND_WORDS[it.kind].en : "");
      const requestView = (r) => {
        const site = SITES.find(x => x.siteId === r.item.siteId) || null;
        const label = itemLabel(r.item);
        const w = SIGN_WORDS[r.kind];
        return { id: r.id, kind: r.kind, subjectId: r.subjectId, person: { id: state.person.id, name: state.person.firstName + " " + state.person.lastName },
          title: fill(w.title, { item: label }), statement: fill(w.statement, { item: label, quantity: r.item.quantity === null ? 1 : r.item.quantity, date: r.item.date }),
          item: { label: label, quantity: r.item.quantity, size: r.item.size, site: site ? { id: site.siteId, name: site.siteName } : null, date: r.item.date },
          state: r.state, requestedAt: r.requestedAt, requestedBy: { name: r.requestedBy }, signedAt: r.signedAt, signedWhere: r.signedWhere, disputeNote: r.disputeNote, reminders: r.reminders,
          warning: r.warning ? Object.assign({}, r.warning) : null };
      };
      if (key === "GET /api/signatures/mine") {
        const rows = state.signRequests.filter(r => r.state === "waiting" || r.state === "disputed").sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
        return json(200, { requests: rows.map(requestView) });
      }
      if (key === "GET /api/hr/property/mine") {
        const issueView = (p) => {
          const site = SITES.find(x => x.siteId === p.siteId) || null;
          const r = p.requestId ? state.signRequests.find(x => x.id === p.requestId) : null;
          return { id: p.id, person: { id: state.person.id, name: state.person.firstName + " " + state.person.lastName }, kind: p.kind, description: p.description, size: p.size, quantity: p.quantity, site: site ? { id: site.siteId, name: site.siteName } : null, issuedOn: p.issuedOn, issuedBy: { name: p.issuedBy }, note: p.note, returnedOn: p.returnedOn, returnedTo: p.returnedOn ? { name: p.issuedBy } : null, returnNote: null,
            signature: r ? { state: r.state, requestId: r.id, requestedAt: r.requestedAt, signedAt: r.signedAt, signedWhere: r.signedWhere } : { state: "signed", requestId: null, requestedAt: null, signedAt: p.issuedOn + "T15:00:00Z", signedWhere: p.signedWhere || "office" } };
        };
        const rows = state.propertyIssues.slice().sort((a, b) => ((a.returnedOn ? 1 : 0) - (b.returnedOn ? 1 : 0)) || (a.issuedOn < b.issuedOn ? 1 : -1));
        return json(200, { issues: rows.map(issueView) });
      }
      const one = /^(GET|POST) \/api\/signatures\/([^/]+)(?:\/(sign|dispute|decline|warning\.pdf))?$/.exec(key);
      if (!one) return json(404, { error: "Not found" });
      const r = state.signRequests.find(x => x.id === decodeURIComponent(one[2]));
      if (!r) return signRefuse("signatures.notFound");
      if (one[3] === "warning.pdf") {
        if (one[1] !== "GET" || !r.warning) return json(404, { error: "Not found" });
        if (!/^Bearer /.test(String((headers || {}).authorization || ""))) return json(401, { error: "Sign in first", code: "auth.required" });
        return image("application/pdf", WARNING_PDF);
      }
      if (one[1] === "GET") return json(200, { request: requestView(r) });
      const b = body && typeof body === "object" ? body : {};
      const act = one[3];
      if (!act) return json(404, { error: "Not found" });
      if (act === "sign") {
        if (r.state !== "waiting" && r.state !== "disputed") return signRefuse("signatures.notOpen");
        const raw = typeof b.signature === "string" ? b.signature.trim() : "";
        const drawn = raw ? /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw) : null;
        const bytes = drawn ? Buffer.from(drawn[1].replace(/\s+/g, ""), "base64") : null;
        if (!bytes || !sniffImage(bytes) || sniffImage(bytes).ext !== "png") return signRefuse("signatures.signatureRequired");
        state.calls[state.calls.length - 1].signature = { bytes: bytes.length, size: imageSize(bytes) };
        r.state = "signed"; r.signedAt = new Date().toISOString(); r.signedWhere = "phone"; r.locale = b.locale === "es" ? "es" : "en";
        return json(200, { request: requestView(r) });
      }
      const note = typeof b.note === "string" ? b.note.trim() : "";
      if (note.length > 500) return signRefuse("signatures.noteTooLong", { keys: ["note"] });
      if (r.state !== "waiting") return signRefuse("signatures.notOpen");
      if (act === "dispute") {
        if (r.kind === "warning") return signRefuse("signatures.cannotDispute");
        if (!note) return signRefuse("signatures.badDetails" in SIGN_REFUSALS ? "signatures.badDetails" : "signatures.noteTooLong", { keys: ["note"] });
        r.state = "disputed"; r.disputeNote = note; r.disputedAt = new Date().toISOString();
        return json(200, { request: requestView(r) });
      }
      if (r.kind !== "warning") return signRefuse("signatures.cannotDecline");
      r.state = "declined"; r.disputeNote = note || null; r.declinedAt = new Date().toISOString();
      return json(200, { request: requestView(r) });
    }
    // Step 267: a lesson picture at its signed address, from storage.
    if (state.training && /^GET \/api\/lesson-images\/signed\/[^/]+\.png$/.test(key)) return image("image/png", LESSON_PNG);
    if (state.training && pathname.indexOf("/api/training/") === 0) {
      const management = FK_MANAGEMENT.indexOf(state.person.role) !== -1;
      const refuse = (k, extra) => { const r = TRAINING_REFUSALS[k]; return json(r.status, Object.assign({ error: refusalIn(r, lang), code: k }, extra || {})); };
      // --- Step 264: sessions signed on phones, watched sign-offs, the
      // documents to sign (the Step 262 contract, sections 2, 3 and 6).
      const sessionRefuse = (k, extra) => { const r = SESSION_REFUSALS[k]; return json(r.status, Object.assign({ error: refusalIn(r, lang), code: k }, extra || {})); };
      const sessionView = (x, withSignins) => {
        const site = SITES.find(y => y.siteId === x.siteId) || null;
        const v = { id: x.id, title: x.title, day: x.day, site: site ? { id: site.siteId, name: site.siteName } : null, locale: x.locale, trainer: { id: x.trainerId, name: x.trainerName }, topics: x.topicIds.map(id => { const tp = TRAINING_ME.items.find(i => i.topicId === id); return tp ? { id: id, name: tp.name, docCode: tp.docCode, docSection: tp.docSection } : null; }).filter(Boolean), joinCode: x.joinCode, joinUrl: "https://portal.example.invalid/join/" + x.joinCode, status: x.status, closedAt: x.closedAt || null, note: x.note || "" };
        if (withSignins !== false) v.signins = x.signins.filter(s => !s.removedAt).map(s => ({ id: s.id, person: { id: s.personId, name: s.personName }, signedAt: s.signedAt }));
        return v;
      };
      const q = new URLSearchParams(search || "");
      if (key === "GET /api/training/topics") {
        if (!management) return refuse("training.noAccess");
        return json(200, { topics: TRAINING_ME.items.filter((i, n, all) => all.findIndex(x => x.topicId === i.topicId) === n).map(i => ({ id: i.topicId, name: i.name, docCode: i.docCode, docSection: i.docSection, safetyCritical: i.safetyCritical, active: true })) });
      }
      const joined = /^(GET|POST) \/api\/training\/join\/([^/]+)$/.exec(key);
      if (joined) {
        const sess = state.trainingSessions.find(x => x.joinCode === decodeURIComponent(joined[2]) && x.status === "open");
        if (!sess) return sessionRefuse("training.sessionNotFound");
        const mine = sess.signins.find(x => x.personId === state.person.id && !x.removedAt);
        if (method === "GET") return json(200, { session: Object.assign(sessionView(sess, false), { siteName: sessionView(sess, false).site ? sessionView(sess, false).site.name : null, trainerName: sess.trainerName, alreadySigned: !!mine }) });
        const b = body && typeof body === "object" ? body : {};
        if (sess.trainerId === state.person.id) return sessionRefuse("training.cannotJoinOwn");
        if (mine) return sessionRefuse("training.alreadySigned");
        if (b.understood !== true) return sessionRefuse("training.understoodRequired", { keys: ["understood"] });
        const raw = typeof b.signature === "string" ? b.signature.trim() : "";
        const drawn = raw ? /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw) : null;
        const bytes = drawn ? Buffer.from(drawn[1].replace(/\s+/g, ""), "base64") : null;
        if (!bytes || !sniffImage(bytes) || sniffImage(bytes).ext !== "png") return refuse("training.signatureRequired");
        state.calls[state.calls.length - 1].signature = { bytes: bytes.length, size: imageSize(bytes) };
        const signin = { id: "si-" + (sess.signins.length + 1), personId: state.person.id, personName: state.person.firstName + " " + state.person.lastName, signedAt: new Date().toISOString(), removedAt: null };
        sess.signins.push(signin);
        return json(201, { signin: { id: signin.id, signedAt: signin.signedAt } });
      }
      if (pathname.indexOf("/api/training/sessions") === 0) {
        if (!management) return refuse("training.noAccess");
        if (key === "GET /api/training/sessions") {
          const want = q.get("status") || "";
          const site = q.get("siteId") || "";
          return json(200, { sessions: state.trainingSessions.filter(x => (!want || x.status === want) && (!site || x.siteId === site)).map(x => sessionView(x, false)) });
        }
        if (key === "POST /api/training/sessions") {
          const b = body && typeof body === "object" ? body : {};
          const keys = [];
          if (typeof b.title !== "string" || !b.title.trim() || b.title.trim().length > 120) keys.push("title");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.day || ""))) keys.push("day");
          if (!SITES.some(x => x.siteId === b.siteId)) keys.push("siteId");
          if (["en", "es", "fr"].indexOf(b.locale) === -1) keys.push("locale");
          const ids = Array.isArray(b.topicIds) ? b.topicIds.filter(id => TRAINING_ME.items.some(i => i.topicId === id)) : [];
          if (!Array.isArray(b.topicIds) || ids.length !== b.topicIds.length || ids.length < 1 || ids.length > 10) keys.push("topicIds");
          if (keys.length > 0) return json(400, { error: refusalIn(FK_PPE_BAD, lang), code: "training.badDetails", keys: keys });
          const made = { id: "ts-made-" + (state.trainingSessions.length + 1), title: b.title.trim(), day: b.day, siteId: b.siteId, locale: b.locale, trainerId: state.person.id, trainerName: state.person.firstName + " " + state.person.lastName, topicIds: ids, joinCode: "MADE" + String(1000 + state.trainingSessions.length), status: "open", signins: [], note: typeof b.note === "string" ? b.note.trim() : "", reads: 0 };
          state.trainingSessions.push(made);
          return json(201, { session: sessionView(made) });
        }
        const one = /^(GET|POST|DELETE) \/api\/training\/sessions\/([^/]+)(?:\/(qr\.png|close|cancel|signins\/([^/]+)))?$/.exec(key);
        const sess = one ? state.trainingSessions.find(x => x.id === decodeURIComponent(one[2])) : null;
        if (!sess) return sessionRefuse("training.sessionNotFound");
        if (!one[3] && method === "GET") {
          // A sign-in arrives on the second read of a session this
          // trainer started, the way a person at the session would sign.
          if (sess.id.indexOf("ts-made-") === 0) { sess.reads = (sess.reads || 0) + 1; if (sess.reads === 2 && sess.signins.length === 0) sess.signins.push({ id: "si-arrived", personId: STAFF[1].id, personName: STAFF[1].firstName + " " + STAFF[1].lastName, signedAt: new Date().toISOString(), removedAt: null }); }
          return json(200, { session: sessionView(sess) });
        }
        if (one[3] === "qr.png") return image("image/png", QR_PNG);
        if (sess.status !== "open") return sessionRefuse("training.sessionClosed");
        if (one[3] === "cancel") { sess.status = "cancelled"; return json(200, { session: sessionView(sess) }); }
        if (one[3] && one[3].indexOf("signins/") === 0) {
          const s = sess.signins.find(x => x.id === decodeURIComponent(one[4]) && !x.removedAt);
          if (!s) return refuse("training.attemptNotFound");
          s.removedAt = new Date().toISOString();
          return json(200, { session: sessionView(sess) });
        }
        // close
        const b = body && typeof body === "object" ? body : {};
        const raw = typeof b.signature === "string" ? b.signature.trim() : "";
        const drawn = raw ? /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw) : null;
        const bytes = drawn ? Buffer.from(drawn[1].replace(/\s+/g, ""), "base64") : null;
        if (!bytes || !sniffImage(bytes) || sniffImage(bytes).ext !== "png") return refuse("training.signatureRequired");
        const live = sess.signins.filter(x => !x.removedAt);
        if (live.length === 0) return sessionRefuse("training.noSignins");
        state.calls[state.calls.length - 1].signature = { bytes: bytes.length, size: imageSize(bytes) };
        sess.status = "closed"; sess.closedAt = new Date().toISOString();
        const saved = [];
        live.forEach(s => sess.topicIds.forEach(tid => saved.push({ userId: s.personId, topicId: tid, recordId: "tr-sess-" + s.id + "-" + tid })));
        return json(200, { session: sessionView(sess), saved: saved, already: [] });
      }
      if (key === "GET /api/training/gaps/people/" + encodeURIComponent(STAFF[0].id) || /^GET \/api\/training\/gaps\/people\/[^/]+$/.test(key)) {
        if (!management) return refuse("training.noAccess");
        const who = STAFF.find(p => key === "GET /api/training/gaps/people/" + p.id) || STAFF[0];
        const quiz = TRAINING_ME.items.find(i => i.topicId === "tp-1");
        const obs = TRAINING_ME.items.find(i => i.topicId === TRAINING_OBSERVATION.topicId);
        const done = state.trainingAttempts.some(a => a.versionId === TRAINING_OBSERVATION.versionId && a.personId === who.id && a.trainerSignedAt);
        return json(200, { person: { id: who.id, name: who.firstName + " " + who.lastName, role: "custodian", hireDate: "2026-09-01", language: "en", sites: [{ id: "site-north", name: "North Building" }] }, items: [
          Object.assign({}, quiz, { lesson: { versionId: "lv-1", kind: "quiz", attemptsUsed: 0, attemptsLeft: 3 } }),
          Object.assign({}, obs, { status: done ? "current" : "missing", lesson: { versionId: TRAINING_OBSERVATION.versionId, kind: "observation", attemptsUsed: 0, attemptsLeft: 3 } }),
        ] });
      }
      if (key === "POST /api/training/observations") {
        if (!management) return refuse("training.noAccess");
        const b = body && typeof body === "object" ? body : {};
        if (b.versionId !== TRAINING_OBSERVATION.versionId) return sessionRefuse("training.notObservation");
        if (b.userId === state.person.id) return refuse("training.cannotSignOwn");
        const who = STAFF.find(p => p.id === b.userId);
        if (!who) return refuse("training.personNotFound" in TRAINING_REFUSALS ? "training.personNotFound" : "training.attemptNotFound");
        const made = { id: "ta-obs-" + (state.trainingAttempts.length + 1), versionId: TRAINING_OBSERVATION.versionId, topicId: TRAINING_OBSERVATION.topicId, personId: who.id, personName: who.firstName + " " + who.lastName, attemptNo: 1, locale: "en", siteId: b.siteId || null, startedAt: new Date().toISOString(), scoredAt: null, scorePercent: null, passed: null, missed: [], acknowledgedAt: null, awaitingTrainer: false, trainerSignedAt: null, trainerId: null, trainerName: null, demonstrated: false, voidedAt: null, observerId: state.person.id, steps: {} };
        state.trainingAttempts.push(made);
        return json(201, { attempt: attemptView(made), checklist: { title: TRAINING_OBSERVATION.title, steps: TRAINING_OBSERVATION.steps.map(s => ({ key: s.key, text: s.text })), acknowledgement: TRAINING_OBSERVATION.acknowledgement } });
      }
      const obsAct = /^POST \/api\/training\/observations\/([^/]+)\/(steps|person-sign)$/.exec(key);
      if (obsAct) {
        const a = state.trainingAttempts.find(x => x.id === decodeURIComponent(obsAct[1]));
        if (!a) return refuse("training.attemptNotFound");
        if (a.observerId !== state.person.id) return refuse("training.noAccess");
        const b = body && typeof body === "object" ? body : {};
        if (obsAct[2] === "steps") {
          const given = b.steps && typeof b.steps === "object" ? b.steps : {};
          const missing = TRAINING_OBSERVATION.steps.filter(s => given[s.key] !== true).map(s => s.key);
          if (missing.length > 0) return sessionRefuse("training.stepsIncomplete", { keys: missing });
          a.steps = given; a.scorePercent = 100; a.passed = true; a.scoredAt = new Date().toISOString(); a.missed = [];
          return json(200, { attempt: attemptView(a) });
        }
        if (!a.passed) return refuse("training.notPassed");
        const raw = typeof b.signature === "string" ? b.signature.trim() : "";
        const drawn = raw ? /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw) : null;
        const bytes = drawn ? Buffer.from(drawn[1].replace(/\s+/g, ""), "base64") : null;
        if (!bytes || !sniffImage(bytes) || sniffImage(bytes).ext !== "png") return refuse("training.signatureRequired");
        state.calls[state.calls.length - 1].signature = { bytes: bytes.length, size: imageSize(bytes) };
        a.acknowledgedAt = new Date().toISOString(); a.awaitingTrainer = true;
        return json(200, { attempt: attemptView(a) });
      }
      const version = /^GET \/api\/training\/lesson-versions\/([^/]+)$/.exec(key);
      if (version) {
        const lesson = TRAINING_LESSONS.find(l => l.versionId === decodeURIComponent(version[1]));
        if (!lesson) return refuse("training.noLesson");
        const loc = lesson.locales.indexOf(lang) !== -1 ? lang : "en";
        const inLoc = (w) => (w && typeof w === "object" ? (w[loc] || w.en) : w);
        const tries = lessonTries(lesson);
        return json(200, { lesson: {
          versionId: lesson.versionId, topicId: lesson.topicId, version: lesson.version, title: inLoc(lesson.title), locale: loc, locales: lesson.locales.slice(),
          // Step 267: an image block is answered as its src, alt and caption
          // in the lesson's language; the stored svg and path never reach a
          // learner. A safety lesson with no Spanish read for a Spanish
          // reader is answered in English with spanishHeld.
          blocks: lesson.blocks.map(b => (b.kind === "image"
            ? { key: b.key, kind: "image", src: b.svg ? "data:image/svg+xml;base64," + Buffer.from(b.svg, "utf8").toString("base64") : lessonImageSrc(b.path), alt: inLoc(b.alt), caption: inLoc(b.caption) }
            : { key: b.key, kind: b.kind, text: inLoc(b.text), items: b.items.map(inLoc), source: b.source ? Object.assign({}, b.source) : null })),
          spanishHeld: lang === "es" && lesson.locales.indexOf("es") === -1 && TRAINING_ME.items.some(i => i.topicId === lesson.topicId && i.safetyCritical),
          questions: lesson.questions.map(qn => ({ key: qn.key, text: inLoc(qn.text), options: qn.options.map(o => ({ value: o.value, text: inLoc(o.text) })) })),
          acknowledgement: inLoc(lesson.acknowledgement), passPercent: lesson.passPercent, needsTrainer: lesson.needsTrainer, attemptsUsed: tries.used, attemptsLeft: tries.left,
        } });
      }
      if (key === "POST /api/training/attempts") {
        const lesson = TRAINING_LESSONS.find(l => body && l.versionId === body.versionId);
        if (!lesson) return refuse("training.noLesson");
        const open = lessonAttempts(lesson).find(a => !a.scoredAt);
        if (open) return json(201, { attempt: attemptView(open) });
        const tries = lessonTries(lesson);
        if (tries.left <= 0) return refuse("training.noAttemptsLeft");
        const made = { id: "ta-made-" + (state.trainingAttempts.length + 1), versionId: lesson.versionId, topicId: lesson.topicId, personId: state.person.id, personName: state.person.firstName + " " + state.person.lastName, attemptNo: tries.used + 1, locale: body.locale === "es" ? "es" : "en", siteId: body.siteId || null, startedAt: new Date().toISOString(), scoredAt: null, scorePercent: null, passed: null, missed: [], acknowledgedAt: null, awaitingTrainer: false, trainerSignedAt: null, trainerId: null, trainerName: null, demonstrated: false, voidedAt: null };
        state.trainingAttempts.push(made);
        return json(201, { attempt: attemptView(made) });
      }
      const act = /^POST \/api\/training\/attempts\/([^/]+)\/(answers|acknowledge|signoff)$/.exec(key);
      if (act) {
        const a = state.trainingAttempts.find(x => x.id === decodeURIComponent(act[1]));
        if (!a) return refuse("training.attemptNotFound");
        const lesson = TRAINING_LESSONS.find(l => l.versionId === a.versionId);
        const b = body && typeof body === "object" ? body : {};
        if (act[2] === "answers") {
          if (a.personId !== state.person.id) return refuse("training.noAccess");
          if (a.scoredAt) return refuse("training.notReady");
          const given = b.answers && typeof b.answers === "object" ? b.answers : {};
          const keys = lesson.questions.filter(qn => typeof given[qn.key] !== "string" || !qn.options.some(o => o.value === given[qn.key])).map(qn => "answers." + qn.key);
          if (keys.length > 0) return refuse("training.badAnswers", { keys: keys });
          a.missed = lesson.questions.filter(qn => given[qn.key] !== qn.correct).map(qn => qn.key);
          a.scorePercent = Math.round((lesson.questions.length - a.missed.length) * 100 / lesson.questions.length);
          a.passed = a.scorePercent >= lesson.passPercent;
          a.scoredAt = new Date().toISOString();
          return json(200, { attempt: attemptView(a) });
        }
        const raw = typeof b.signature === "string" ? b.signature.trim() : "";
        const drawn = raw ? /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw) : null;
        const bytes = drawn ? Buffer.from(drawn[1].replace(/\s+/g, ""), "base64") : null;
        const png = !!bytes && !!sniffImage(bytes) && sniffImage(bytes).ext === "png" && bytes.length <= SIGNATURE_MAX_BYTES;
        if (act[2] === "acknowledge") {
          if (a.personId !== state.person.id) return refuse("training.noAccess");
          if (!a.passed) return refuse("training.notPassed");
          if (!png) return refuse("training.signatureRequired");
          state.calls[state.calls.length - 1].signature = { bytes: bytes.length, size: imageSize(bytes) };
          a.acknowledgedAt = new Date().toISOString();
          a.awaitingTrainer = lesson.needsTrainer;
          const record = lesson.needsTrainer ? null : { id: "tr-made-" + a.id, name: TRAINING_ME.items.find(i => i.topicId === a.topicId).name, completedDate: "2026-10-05", expiresOn: null, score: a.scorePercent + "%", siteName: null, locale: a.locale };
          return json(200, { attempt: attemptView(a), record: record });
        }
        if (!management) return refuse("training.noAccess");
        if (a.personId === state.person.id) return refuse("training.cannotSignOwn");
        if (!a.acknowledgedAt || !a.awaitingTrainer) return refuse("training.notReady");
        if (b.demonstrated !== true) return refuse("training.demonstrationRequired");
        if (!png) return refuse("training.signatureRequired");
        state.calls[state.calls.length - 1].signature = { bytes: bytes.length, size: imageSize(bytes) };
        a.awaitingTrainer = false; a.demonstrated = true; a.trainerSignedAt = new Date().toISOString(); a.trainerId = state.person.id; a.trainerName = state.person.firstName + " " + state.person.lastName; a.trainerNote = typeof b.note === "string" ? b.note.trim() : "";
        return json(200, { attempt: attemptView(a), record: { id: "tr-made-" + a.id, name: TRAINING_ME.items.find(i => i.topicId === a.topicId).name, completedDate: "2026-10-05", expiresOn: null, score: a.scorePercent + "%", siteName: null, locale: a.locale } });
      }
      if (key === "GET /api/training/awaiting") {
        if (!management) return refuse("training.noAccess");
        const site = new URLSearchParams(search || "").get("siteId") || "";
        const rows = state.trainingAttempts.filter(a => a.acknowledgedAt && a.awaitingTrainer && !a.voidedAt && a.personId !== state.person.id && (!site || a.siteId === site));
        return json(200, { attempts: rows.map(a => Object.assign(attemptView(a), { person: { id: a.personId, name: a.personName } })) });
      }
    }
    // --- reporting and supplies
    // Step 255: the findings the stub opened, listed as source inspection
    // to the person signed in, and resolved by their owner with the PATCH
    // the API as built takes ({ status, resolutionNotes }).
    if (state.findings && key === "GET /api/issues") {
      const q = new URLSearchParams(search || "");
      return json(200, q.get("source") === "inspection" ? state.findingRows.map(r => Object.assign({}, r)) : []);
    }
    if (state.findings && method === "PATCH" && /^\/api\/issues\/[^/]+$/.test(pathname)) {
      const row = state.findingRows.find(r => pathname === "/api/issues/" + r.id);
      if (!row) return json(404, { error: "Issue not found", code: "issues.notFound" });
      const b = body && typeof body === "object" ? body : {};
      if (b.status === "resolved") {
        if (row.assigned_to !== state.person.id && FK_MANAGEMENT.indexOf(state.person.role) === -1) return json(403, { error: "This is not assigned to you", code: "issues.cannotResolve" });
        row.status = "resolved"; row.resolved_at = new Date(clockNow()).toISOString(); row.resolved_by = state.person.id; row.due_state = "answered";
      } else if (b.status === "closed") return json(409, { error: "Use verify", code: "issues.useVerify" });
      if (b.resolutionNotes) row.resolution_notes = String(b.resolutionNotes);
      return json(200, { message: "Issue updated", code: "issues.updated", issue: Object.assign({}, row) });
    }
    if (key === "GET /api/issues") return json(200, []);
    if (key === "POST /api/issues") {
      if (!body || !body.siteId || !body.title) return json(400, { error: "Site and title are required" });
      const issue = { id: "iss-" + (state.issues.length + 1), photos: [] };
      state.issues.push(Object.assign(issue, { body: body }));
      return json(201, { message: "Issue reported", code: "issues.reported", issue: { id: issue.id } });
    }
    if (method === "POST" && /^\/api\/issues\/[^/]+\/photos$/.test(pathname)) {
      const finding = state.findings ? state.findingRows.find(r => pathname === "/api/issues/" + r.id + "/photos") : null;
      if (finding) { if (!body || !body.photoUrl) return json(400, { error: "Photo URL is required" }); finding.photos.push({ id: "fph-" + (finding.photos.length + 1), url: String(body.photoUrl) }); return json(201, { photo: { id: "fph-" + finding.photos.length, url: String(body.photoUrl) } }); }
      const issue = state.issues.find(i => pathname === "/api/issues/" + i.id + "/photos");
      if (!issue) return json(404, { error: "Issue not found" });
      if (!body || !body.photoUrl) return json(400, { error: "Photo URL is required" });
      issue.photos.push(body.photoUrl);
      return json(201, { photo: { id: "ph-" + issue.photos.length, issue_id: issue.id, photo_url: body.photoUrl } });
    }
    if (key === "GET /api/supplies") return json(200, state.supplies || [{ id: "sup-1", name: "Paper towels", qr_code: "QR-0001", unit: "rolls", is_low: true }]);
    if (key === "POST /api/supplies/log-usage") return json(200, { message: "Usage logged", log: { id: "log-1", supply_name: "Paper towels", quantity: 1 }, lowStockAlert: false });
    if (state.supplyItems && (key === "GET /api/supplies/requests" || key === "POST /api/supplies/requests")) return supplyRequestAnswer(method, search, body, lang);
    // The API's own index with Step 280 built, the route the office
    // decides items through among its supply routes (Step 285).
    if (state.supplyItems && key === "GET /api") return json(200, { name: "Invented API", endpoints: { supplies: { "GET /api/supplies/requests": "The supply requests", "POST /api/supplies/requests/:reqId/decide": "Decide a request's items" } } });
    if (key === "POST /api/supplies/requests") return json(200, { ok: true });

    // --- inspections
    if (pathname === "/api/inspections/scheduled" && method === "GET") return json(200, state.inspections.filter(i => i.status !== "completed").map(i => Object.assign({}, i, { items: undefined, gone: undefined })));
    // Step 145. Completing one the way the API does: scores required, a
    // second completion turned away, and the row marked completed.
    const completing = pathname.match(/^\/api\/inspections\/scheduled\/([^/]+)\/complete$/);
    if (method === "POST" && completing) {
      if (!body || !Array.isArray(body.scores)) return json(400, { error: "Scores are required" });
      const one = state.inspections.find(i => i.id === completing[1] && !i.gone);
      if (!one) return json(404, { error: INSPECTION_NOT_FOUND[0] });
      if (one.status === "completed") return json(400, { error: "This inspection was already completed" });
      const total = body.scores.reduce((s, x) => s + (parseInt(x.score) || 0), 0);
      if (state.findings) {
        // Step 255, as the Step 253 contract's section 3 item 2: a card
        // marked deficient or scored under 80 percent of its maximum is a
        // finding, needs a note, and may name an owner from the list.
        const items = one.items || [];
        const refuse = (key, keys) => { const r = FINDING_REFUSALS[key]; return json(r.status, { error: refusalIn(r, lang), code: key, keys: keys }); };
        const rows = body.scores.map(x => { const item = items.find(i => i.id === x.template_item_id) || { max_score: 0 }; const score = parseInt(x.score) || 0; return { x: x, item: item, score: score, deficient: x.deficient === true || score * 100 < 80 * item.max_score }; }).filter(r => r.deficient);
        const ownerIds = findingOwners().map(o => o.id);
        const noNote = rows.filter(r => !String(r.x.notes || "").trim());
        if (noNote.length) return refuse("inspections.findingNoteRequired", noNote.map(r => r.x.template_item_id));
        const badOwner = rows.filter(r => r.x.ownerId !== undefined && r.x.ownerId !== null && ownerIds.indexOf(String(r.x.ownerId)) === -1);
        if (badOwner.length) return refuse("inspections.badOwner", badOwner.map(r => r.x.template_item_id));
        if (state.findingRefusals > 0 && rows.length) { state.findingRefusals -= 1; return refuse("inspections.findingNoteRequired", [rows[0].x.template_item_id]); }
        one.status = "completed";
        const max = items.reduce((s, i) => s + (i.max_score || 0), 0);
        const pct = max > 0 ? Math.round(total * 1000 / max) / 10 : 0;
        const band = findingBandOf(pct);
        const at = new Date(clockNow());
        const due = new Date(at.getTime());
        if (band === "serious") due.setHours(23, 59, 0, 0); else due.setDate(due.getDate() + FINDING_DUE_DAYS[band]);
        const opened = rows.map(r => {
          const owner = r.x.ownerId ? findingOwners().find(o => o.id === String(r.x.ownerId)) : null;
          const row = { id: "fnd-" + (state.findingRows.length + 1), site_id: one.site_id, site_name: one.site_name, title: r.item.label, description: String(r.x.notes || "").trim(), zone: r.item.zone || null, severity: FINDING_SEVERITY[band], status: "open", source: "inspection", reference: null,
            reported_at: at.toISOString(), reported_by: state.person.id, assigned_to: owner ? owner.id : null, assigned_to_name: owner ? owner.name : null, due_at: due.toISOString(), due_state: "onTime", first_response_at: owner ? at.toISOString() : null, resolved_at: null, resolved_by: null, verified_at: null, verified_by_name: null, item_score_id: "sc-" + r.x.template_item_id, corrective_action_id: null, photos: [] };
          state.findingRows.push(row);
          return { issueId: row.id, templateItemId: r.x.template_item_id, label: r.item.label, zone: r.item.zone || null, score: r.score, maxScore: r.item.max_score, severity: row.severity, dueAt: row.due_at, owner: owner ? { id: owner.id, name: owner.name } : null };
        });
        return json(200, { success: true, result: { id: "res-" + one.id, scheduled_inspection_id: one.id, total_score: total, max_possible_score: max }, scorePct: pct, band: band, correctiveActionRequired: pct < 80, findings: opened });
      }
      one.status = "completed";
      return json(200, { success: true, result: { id: "res-" + one.id, scheduled_inspection_id: one.id, total_score: total } });
    }
    if (method === "GET" && /^\/api\/inspections\/scheduled\/[^/]+$/.test(pathname)) {
      const one = state.inspections.find(i => pathname.endsWith("/" + i.id) && !i.gone);
      if (one && state.findings) return json(200, Object.assign({}, one, { owners: findingOwners() }));
      return one ? json(200, one) : json(404, { error: INSPECTION_NOT_FOUND[0] });
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

    // --- an announcement, opened from its notice
    const announcementOne = method === "GET" ? /^\/api\/announcements\/([^/]+)$/.exec(pathname) : null;
    if (announcementOne) {
      const found = state.announcements.find(a => a.id === decodeURIComponent(announcementOne[1]));
      if (!found) return json(404, { error: ANNOUNCEMENT_NOT_FOUND[languageOf(search, state) === "es" ? 1 : 0], code: "announcements.notFound" });
      return json(200, { announcement: JSON.parse(JSON.stringify(found)) });
    }

    // --- phone alerts, Step 179 in the API
    if (key === "GET /api/push/key") {
      if (state.push.key === "missing") return json(404, { error: "Endpoint not found" });
      return json(200, { publicKey: state.push.key });
    }
    if (key === "POST /api/push/subscriptions" || key === "DELETE /api/push/subscriptions") {
      const b = body && typeof body === "object" ? body : {};
      const endpoint = typeof b.endpoint === "string" && /^https:\/\//i.test(b.endpoint.trim()) ? b.endpoint.trim() : null;
      const bad = () => { const r = PUSH_REFUSALS["push.badSubscription"]; return json(r.status, { error: refusalIn(r, languageOf(search, state)), code: "push.badSubscription" }); };
      if (method === "POST") {
        const keys = b.keys && typeof b.keys === "object" ? b.keys : {};
        if (!endpoint || !keys.p256dh || !keys.auth) return bad();
        state.push.rows[endpoint] = state.person.id;
        return json(201, { ok: true });
      }
      if (!endpoint) return bad();
      if (state.push.rows[endpoint] === state.person.id) delete state.push.rows[endpoint];
      return json(200, { ok: true });
    }
    if (key === "GET /api/notifications/settings" || key === "PATCH /api/notifications/settings") {
      if (state.push.settings === null) return json(404, { error: "Endpoint not found" });
      if (method === "GET") return json(200, Object.assign({}, state.push.settings));
      const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
      const wrong = Object.keys(b).filter(k => !(k === "chat" ? ALERT_CHAT.indexOf(b[k]) !== -1 : ALERT_SWITCHES.indexOf(k) !== -1 && typeof b[k] === "boolean"));
      if (wrong.length > 0 || Object.keys(b).length === 0) {
        const r = PUSH_REFUSALS["notifications.badSetting"];
        return json(r.status, { error: refusalIn(r, languageOf(search, state)), code: "notifications.badSetting", keys: wrong.length ? wrong : ["chat"].concat(ALERT_SWITCHES) });
      }
      Object.assign(state.push.settings, b);
      return json(200, Object.assign({}, state.push.settings));
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

module.exports = { createStub, servedFor, replyPieces, HELP_ANSWERS, HELP_REFUSALS, helpReply, NOW, PERSON, SECOND_PERSON, SITES, STAFF, LEAVE_TYPES, LOOKUPS, INSPECTION, INSPECTION_LONG, INSPECTION_GONE, INSPECTION_NOT_FOUND, INSPECTION_F, FINDING_REFUSALS, TRAINING_ME, TRAINING_LESSONS, TRAINING_AWAITING, TRAINING_REFUSALS, TRAINING_SESSION_SEED, TRAINING_OBSERVATION, TRAINING_DOCUMENT, TRAINING_FIRST_DAY, TRAINING_CATEGORIES, TRAINING_TOPIC_PLACE, LESSON_IMAGE_HOST, SIGN_SEED, SIGN_WORDS, PROPERTY_SEED, PROPERTY_KIND_WORDS, SIGN_REFUSALS, SESSION_REFUSALS, LOGIN_REFUSAL, BADGE_MISMATCH, SIGNED_OUT, TIME_OFF_REFUSALS, HR_CASE_REFUSALS, PIN_REFUSALS, FORM, FORM_P_CODE, FORM_P_WORDS, TWIN_ES, LIVE_KINDS, SITE_TASKS, SHIFT_ORDER, LINKS, taskWords, lookupsIn, formP, formS, timeOffRow, ymd, iso, DAY,
  SHIFT_REFUSALS, NOT_YOUR_CHECK, westShiftNames, CATEGORY_CODES, PERIODS, FIRST_NAMES, refusalIn, shiftsFor,
  SECOND_STEP_CODE, SECOND_STEP_HINT, SDS_SHEETS, WS_PROJECT, WS_TODO, FORM_A_WORDS, FORM_W_WORDS, EQ_CODE, EQ_ITEM, FORM_N_WORDS, CONCERN_REF,
  ADMIN_PERSON, CHAT_SITES, CHAT_GENERAL, CHAT_STAFF, CHAT_SEND_REFUSALS, CHAT_UNCODED_REFUSALS, CHAT_TEXT_MAX, OWN_PRIVATE, staffPrivate, chatSeed,
  API_REFUSALS, FILE_REFUSALS, FORM_P_MAX_PHOTOS, SIGNATURE_MAX_BYTES, localeFault, localeRows,
  CUSTOMER_LINKS, FORM_C_CODE, FORM_V_CODE, formC, formV, PUBLIC_SITE, PUBLIC_COMPANY, PUBLIC_MAX_PHOTOS, PUBLIC_FILINGS_MAX, customerSignatureLine,
  ANNOUNCEMENT, FORM_E_WORDS,
  REQUEST_LINKS, REQUEST_CATEGORIES, REQUEST_WORDS, REQUEST_REF, REQUEST_OFFICE_PHONE, requestWord, requestCategoryTitle, REQUEST_ASSIGNEES, SUP_CODE, SUP_ITEM, SUP_SITES,
  SUPPLY_CATALOG, SUPPLY_DENY_NOTE };
