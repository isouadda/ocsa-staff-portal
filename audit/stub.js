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
];

const LEAVE_TYPES = [
  { value: "paid_sick", label: "Paid sick leave" },
  { value: "unpaid", label: "Unpaid time off" },
  { value: "bereavement_personal", label: "Bereavement and personal" },
  { value: "jury_duty", label: "Jury duty" },
  { value: "military", label: "Military leave" },
];

// Every refusal the time off routes can answer with, in the order the
// Step 79 contract lists them. The suite shows each one word for word.
const TIME_OFF_REFUSALS = [
  { status: 400, error: "Choose a type of time off" },
  { status: 400, error: "Dates must be YYYY-MM-DD" },
  { status: 400, error: "The last day cannot be before the first day" },
  { status: 400, error: "A part day needs both a start and an end time, on one day" },
  { status: 400, error: "Times must be HH:MM, from 00:00 to 23:59" },
  { status: 400, error: "Hours must be a number from 0 to 999.99" },
  { status: 400, error: "Time off can start at most 30 days ago" },
  { status: 400, error: "Time off can start at most one year ahead" },
  { status: 400, error: "Keep the reason under 1000 characters" },
  { status: 404, error: "Request not found" },
  { status: 409, error: "You already have time off requested or approved for those days", requestId: "to-clash" },
  { status: 409, error: "This request was already approved" },
  { status: 409, error: "This request was already denied" },
  { status: 409, error: "This request was already cancelled" },
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
// refuse a submit with one still missing.
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
    // Flip these from a case to make a route answer differently.
    refuse: o.refuse || {},          // "POST /api/time-off": { status, body }
    offline: false,                  // every call fails at the network
    person: o.person || PERSON,
    accountPreferences: o.accountPreferences === undefined ? {} : o.accountPreferences,
    clockedIn: o.clockedIn !== false,
    schedule: o.schedule || null,
    timeOffTypesLive: o.timeOffTypesLive !== false,
    myTimeOff: o.myTimeOff || [],
    drafts: o.drafts || [],
    notifications: o.notifications || [],
    conversationId: "cv-one",
    uploadsFail: false,
    prefsPatches: [],
  };
}

const json = (status, body) => ({ status: status, contentType: "application/json", body: JSON.stringify(body) });

function createStub(opts) {
  const state = makeState(opts);

  const schedule = () => state.schedule || {
    scheduled: [{ id: "sh-1", scheduled_date: "2026-10-02", start_time: "17:00", end_time: "23:00", site_name: "North Building", status: "scheduled", building_name: "Main Hall", floor_number: "2" }],
    actual: [{ id: "ac-1", clock_in_time: iso(NOW.getTime() - 3 * 60 * 60 * 1000), shift_status: "active", site_name: "North Building" }],
    pickups: [],
  };

  const clockStatus = () => (state.clockedIn ? {
    clockedIn: true,
    shift: { sessionId: "sess-1", id: "sess-1", siteId: "site-north", siteName: "North Building", buildingName: "Main Hall", floorNumber: "2", clockInTime: iso(NOW.getTime() - 3 * 60 * 60 * 1000) },
    session: { id: "sess-1" },
    tasks: { total: 5, completed: 2, siteCompletedTaskIds: ["task-1", "task-2"], completedTaskIds: ["task-1"] },
  } : { clockedIn: false, shift: null, session: null, tasks: null });

  const tasks = () => ([
    { id: "task-1", label: "Wipe the entry doors and handles", zone: "Entrance", floor_number: "2", priority: "high", task_type: "standard", has_details: true, description: "Work top to bottom." },
    { id: "task-2", label: "Empty every bin on the floor", zone: "Entrance", floor_number: "2", task_type: "standard" },
    { id: "task-3", label: "Mop the corridor end to end", zone: "Corridor", floor_number: "2", task_type: "standard" },
    { id: "task-4", label: "Restock paper towels and soap", zone: "Restroom", floor_number: "2", task_type: "standard" },
    { id: "task-5", label: "Refill the sanitizer stands", zone: "Restroom", floor_number: "2", task_type: "standard" },
  ]);

  // A route a case has asked to refuse wins over the answer below it.
  function refusalFor(key) {
    const r = state.refuse[key];
    if (!r) return null;
    if (r.once) delete state.refuse[key];
    return json(r.status || 400, r.body || { error: r.error || "Request failed" });
  }

  function handle(method, pathname, search, body) {
    const key = method + " " + pathname;
    state.calls.push({ method: method, path: pathname, search: search || "", body: body || null });
    if (state.offline) return { abort: true };
    const refused = refusalFor(key);
    if (refused) return refused;

    // --- signing in and getting in
    if (key === "POST /api/auth/login") {
      if (body && body.pin !== "4907") return json(401, { error: "That sign-in did not match. Check your badge, phone or email and your PIN." });
      return json(200, { token: "token-one" });
    }
    if (key === "GET /api/auth/me") return json(200, { user: state.person, sites: SITES, preferences: state.accountPreferences });
    if (key === "POST /api/auth/register") return json(200, { ok: true });
    if (key === "POST /api/auth/reset/request") return json(200, { ok: true });
    if (key === "POST /api/auth/change-pin") return json(200, { ok: true });
    if (method === "GET" && /^\/api\/auth\/activate\//.test(pathname)) return json(200, { firstName: state.person.firstName, badgeAssigned: false, preferredLanguage: "en" });
    if (key === "POST /api/auth/activate") return json(200, { token: "token-one" });
    if (method === "GET" && /^\/api\/auth\/reset\//.test(pathname)) return json(200, { firstName: state.person.firstName });
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
      user: Object.assign({}, state.person, { employeeId: "OCSA-0001", preferredLanguage: "English", addressLine1: "", city: "", state: "", zipCode: "", emergencyContactName: "", emergencyContactPhone: "", birthday: null }),
      assignments: [{ site_name: "North Building", role_at_site: "Staff", shift_name: "Evening", shift_start: "17:00", shift_end: "23:00" }],
    });
    if (key === "PATCH /api/users/profile/me") return json(200, { ok: true });
    if (key === "POST /api/users/profile/photo") return json(200, { ok: true });

    // --- the shift
    if (key === "GET /api/clock/status") return json(200, clockStatus());
    if (key === "GET /api/clock/tasks/assigned") return json(200, [
      { task_id: "at-1", label: "Replace the cracked light cover", description: "Second floor corridor.", site_name: "North Building", building_name: "Main Hall", floor_number: "2", zone: "Corridor", priority: "high", created_by_name: "A supervisor", task_created_at: iso(NOW.getTime() - DAY) },
    ]);
    if (method === "POST" && /^\/api\/clock\/tasks\/[^/]+\/complete$/.test(pathname)) return json(200, { ok: true });
    if (method === "DELETE" && /^\/api\/clock\/tasks\/[^/]+\/complete$/.test(pathname)) return json(200, { ok: true });
    if (method === "PATCH" && /^\/api\/clock\/tasks\/resolve\//.test(pathname)) return json(200, { ok: true });
    if (key === "GET /api/shift-sessions/sites") return json(200, {
      scheduled: [{ siteId: "site-north", siteName: "North Building", address: "1 Example Way", city: "Philadelphia", buildingName: "Main Hall", floorNumber: "2" }],
      assigned: [{ siteId: "site-south", siteName: "South Building", address: "2 Example Way", city: "Philadelphia" }],
      all: SITES,
    });
    if (key === "POST /api/shift-sessions") { state.clockedIn = true; return json(200, { message: "Shift started", session: { id: "sess-1" } }); }
    if (method === "PATCH" && /^\/api\/shift-sessions\//.test(pathname)) { state.clockedIn = false; return json(200, { message: "Shift ended" }); }
    if (key === "GET /api/sites") return json(200, SITES);
    if (method === "GET" && /^\/api\/sites\/[^/]+\/tasks$/.test(pathname)) return json(200, tasks());
    if (key === "GET /api/lookups") return json(200, []);

    // --- the calendar
    if (pathname === "/api/pickups/my-schedule") return json(200, schedule());
    if (key === "GET /api/pickups/available") return json(200, [
      { id: "pk-1", scheduled_date: "2026-10-08", start_time: "17:00", end_time: "23:00", site_name: "South Building", origin: "shift_drop" },
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

    // --- chat
    if (key === "GET /api/chat/channels") return json(200, [
      { id: "ch-site", type: "site", name: "North Building", siteName: "North Building" },
      { id: "ch-dm", type: "admin_dm", name: "Office", unreadCount: 0 },
    ]);
    if (method === "GET" && /^\/api\/chat\/channels\/[^/]+\/messages$/.test(pathname)) return json(200, { messages: [] });
    if (method === "POST" && /^\/api\/chat\/channels\/[^/]+\/messages$/.test(pathname)) return json(200, { message: { id: "msg-1", text: body && body.text, senderName: "Alex Tester", createdAt: iso(NOW.getTime()) } });

    // --- Help
    if (key === "POST /api/agent/message") {
      return json(200, {
        reply: "Take the pads from the second floor store room.",
        conversationId: state.conversationId,
        citedDocs: [], degraded: false, noProcedure: false,
      });
    }
    if (pathname === "/api/agent/drafts" && method === "GET") return json(200, state.drafts);
    if (method === "GET" && /^\/api\/agent\/conversations\//.test(pathname)) return json(200, { messages: [] });
    if (method === "POST" && /^\/api\/agent\/drafts\/[^/]+\/submit$/.test(pathname)) return json(200, { ok: true });

    // --- report forms
    if (pathname === "/api/forms") return json(200, { forms: [{ code: FORM.code, title: FORM.title }] });
    if (method === "GET" && /^\/api\/forms\/drafts\//.test(pathname)) return json(200, { draft: draftOf(state), form: FORM });
    if (method === "POST" && /^\/api\/forms\/[^/]+\/drafts$/.test(pathname)) return json(200, { draft: draftOf(state), form: FORM });
    if (method === "PATCH" && /^\/api\/forms\/drafts\//.test(pathname)) {
      Object.assign(state.answers, (body && body.answers) || {});
      return json(200, { draft: draftOf(state), form: FORM });
    }
    if (method === "POST" && /^\/api\/forms\/drafts\/[^/]+\/submit$/.test(pathname)) {
      const missing = FORM.fields.filter(f => f.required && !state.answers[f.key]).map(f => f.key);
      if (missing.length > 0) return json(400, { error: "Answer every required question before sending", missing: missing });
      return json(200, { ok: true, reference: "OCSA-FIX-101-0001" });
    }
    if (method === "GET" && /^\/api\/forms\/[^/]+$/.test(pathname)) return json(200, { form: FORM });

    // --- reporting and supplies
    if (key === "GET /api/issues") return json(200, []);
    if (key === "POST /api/issues") return json(200, { issue: { id: "iss-1" } });
    if (method === "POST" && /^\/api\/issues\/[^/]+\/photos$/.test(pathname)) return json(200, { ok: true });
    if (key === "GET /api/supplies") return json(200, [{ id: "sup-1", name: "Paper towels", qr_code: "QR-0001", unit: "rolls", is_low: true }]);
    if (key === "POST /api/supplies/log-usage") return json(200, { message: "Usage logged", log: { id: "log-1", supply_name: "Paper towels", quantity: 1 }, lowStockAlert: false });
    if (key === "POST /api/supplies/requests") return json(200, { ok: true });

    // --- inspections
    if (pathname === "/api/inspections/scheduled") return json(200, []);
    if (key === "GET /api/inspections/templates") return json(200, []);
    if (method === "PATCH" && /^\/api\/inspections\/scheduled\//.test(pathname)) return json(200, { ok: true });
    if (key === "POST /api/inspections/scheduled") return json(200, { ok: true });

    // --- Speak Up
    if (key === "GET /api/contacts/case-subjects") return json(200, { subjects: [{ id: "p-1", name: "A shift supervisor", title: "Supervisor" }, { id: "p-2", name: "An area manager", title: "Area Manager" }] });
    if (key === "POST /api/hr-cases") return json(200, { caseNumber: "HR-0001" });

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
  return { handle: handle, state: state };
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

module.exports = { createStub, NOW, PERSON, SECOND_PERSON, SITES, LEAVE_TYPES, TIME_OFF_REFUSALS, FORM, timeOffRow, ymd, iso, DAY };
