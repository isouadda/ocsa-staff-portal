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

// The four pick lists the portal reads from /api/lookups. Every label is
// English, the way the live API sends it, and every one is the English
// the portal's own fallback draws when no list arrives.
const pick = (slug, rows) => ({ slug: slug, values: rows.map((r, i) => Object.assign({ value: r[0], label: r[1], is_active: true, sort_order: i + 1 }, r[2] || {})) });
const LOOKUPS = [
  pick("drop_reasons", [["sick", "Sick"], ["personal", "Personal"], ["scheduling_conflict", "Scheduling Conflict"], ["emergency", "Emergency"], ["other", "Other", { show_other_input: true }]]),
  pick("issue_severities", [["low", "Low", { color: "#2ECC71" }], ["medium", "Medium", { color: "#F39C12" }], ["high", "High", { color: "#E74C3C" }]]),
  pick("request_types", [["refill", "Refill"], ["damage_report", "Damage Report"], ["new_gear", "New Gear"], ["new_supply", "New Supply"]]),
  pick("urgency_levels", [["normal", "Normal"], ["urgent", "Urgent", { color: "#E74C3C" }]]),
];

// One scheduled inspection and the items it asks about. The template's
// name, each item and each item's zone are English, the way the live API
// sends them.
const INSPECTION = {
  id: "in-1", template_name: "Lobby walk", site_name: "North Building", scheduled_date: "2026-10-02", status: "scheduled",
  items: [
    { id: "it-1", label: "Glass doors are free of smudges", zone: "Lobby", max_score: 5 },
    { id: "it-2", label: "Floor mats are straight and dry", zone: "Lobby", max_score: 5 },
  ],
};
// One on the list that the API no longer has when it is opened.
const INSPECTION_GONE = { id: "in-gone", template_name: "Stairwell walk", site_name: "North Building", scheduled_date: "2026-10-02", status: "scheduled", gone: true };

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
    inspections: o.inspections || [],
    conversationId: "cv-one",
    uploadsFail: false,
    prefsPatches: [],
    // The second form's answers, and the sign-offs stamped on it.
    answersP: o.answersP ? Object.assign({}, o.answersP) : {},
    // Everyone Speak Up can name, and every report filed through it.
    staff: o.staff || STAFF.slice(),
    filed: [],
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

// --- names, words and codes ---------------------------------------------
//
// Every string the stub serves is one of three things, and the Spanish
// check treats each one its own way.
//
//   a name   a site, a building, a person, an id, a date, a number. Drawn
//            the way it was sent, in any language.
//   a word   something a person reads: a refusal, a message, form text, a
//            Help reply, a to-do item or its zone, a pick list choice, a
//            notice, a supply, an inspection item, a leave type, a shift
//            name, a site role. On a Spanish screen it has to be Spanish.
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
const tableTwin = (en) => [en, Object.prototype.hasOwnProperty.call(ES, en) ? ES[en] : null];

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
  // Refusals the portal's own table does not carry.
  ["Answer every required question before sending", "Responda todas las preguntas obligatorias antes de enviar"],
  ["This account is locked. Ask your supervisor to unlock it.", "Esta cuenta est\u00e1 bloqueada. Pida a su supervisor que la desbloquee."],
  ["A shift is already open at another site", "Ya hay un turno abierto en otro sitio"],
  ["Endpoint not found", "No se encontr\u00f3 la ruta"],
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
]
  // Words the portal's own table already carries, with its Spanish.
  .concat(["Describe what happened", "What happened", "No", "Yes", "Shift started", "Shift ended",
    "Sick", "Personal", "Scheduling Conflict", "Emergency", "Other", "Low", "High",
    "Refill", "Damage Report", "New Gear", "New Supply", "Normal", "Urgent"].map(tableTwin))
  .concat(LEAVE_TYPES.map(t => tableTwin(t.label)))
  .concat(TIME_OFF_REFUSALS.map(r => tableTwin(r.error)))
  .concat(HR_CASE_REFUSALS.map(tableTwin))
  .concat(["That sign-in did not match. Check your badge, phone or email and your PIN.", "Session expired", "Request failed",
    "Photo upload failed", "A sign-off is made with its own button", "That is not a sign-off on this form",
    "You cannot sign this part of the form", "This part is already signed"].map(tableTwin))
  // The second form, already written in both languages above.
  .concat(Object.keys(FORM_P_WORDS.en).map(k => [FORM_P_WORDS.en[k], FORM_P_WORDS.es[k]]))
  .concat([1, 2, 3, 4, 5].map(n => [ROW_WORD.en + " " + n, ROW_WORD.es + " " + n]));

const TWIN_ES = new Map();
const TWIN_EN = new Map();
TWIN_PAIRS.forEach(([en, es]) => {
  if (!en || !es) throw new Error("the stub has an English word with no Spanish twin: " + en);
  if (!TWIN_ES.has(en)) TWIN_ES.set(en, es);
  if (!TWIN_EN.has(es)) TWIN_EN.set(es, en);
});

// What a field carries. A field not named here holds a name.
const CODE_FIELDS = new Set(["status", "role", "priority", "severity", "origin", "resolution_status", "shift_status"]);
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
  [/^GET \/api\/sites\/[^/]+\/tasks$/, { label: "to-do item" }],
  [/^GET \/api\/clock\/tasks\/assigned$/, { label: "to-do item" }],
  [/^GET \/api\/lookups$/, { label: "pick list choice" }],
  [/^GET \/api\/notifications$/, { title: "notice", body: "notice" }],
  [/^GET \/api\/supplies$/, { name: "supply" }],
  [/^GET \/api\/time-off\/types$/, { label: "leave type" }],
  [/^[A-Z]+ \/api\/forms/, { title: "form text", label: "form text", rows: "form text" }],
  [/^GET \/api\/inspections\//, { name: "inspection item", label: "inspection item", zone: "inspection item" }],
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

// What the Spanish check reads, from one stub.
function servedFor(stub) {
  const st = stub && stub.state;
  if (!st) return { names: [], words: [], codes: [] };
  return { names: Array.from(st.served), words: Array.from(st.words.values()), codes: Array.from(st.codes) };
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
    // One with no zone, which the screen gathers under its own heading.
    { id: "task-5", label: "Refill the sanitizer stands", floor_number: "2", task_type: "standard" },
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
    if (key === "GET /api/auth/me") return json(200, Object.assign({ user: state.person, sites: SITES, preferences: state.accountPreferences }, state.mustSetPin ? { mustSetPin: true } : {}));
    if (key === "POST /api/auth/register") return json(200, { ok: true });
    if (key === "POST /api/auth/reset/request") return json(200, { ok: true });
    if (key === "POST /api/auth/change-pin") { state.mustSetPin = false; return json(200, { ok: true }); }
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
    // The four pick lists, in English, the way the live API sends them.
    // The colors are the ones the screens draw when no list arrives.
    if (key === "GET /api/lookups") return json(200, LOOKUPS);

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
    //
    // Two forms now: the one built today, and the second one carrying a
    // checklist, a table a person adds rows to, and a sign-off. Which
    // one a request means is read from the code in the path, or from the
    // draft id, the way the real API reads it.
    const lang = /locale=es/.test(String(search || "")) ? "es" : "en";
    const second = (p) => /TEST-FORM-P/.test(p) || /draft-two/.test(p);
    // The catalog carries each form whole, fields and all, because the
    // form is what says which questions a report has and the screen
    // reads them from here. It served only the code and the title until
    // now, which is why no question has ever drawn in the suite.
    if (pathname === "/api/forms") {
      return json(200, { forms: [FORM, formP(lang)] });
    }
    if (method === "GET" && /^\/api\/forms\/drafts\//.test(pathname)) {
      return second(pathname) ? json(200, { draft: draftP(state, lang), form: formP(lang) }) : json(200, { draft: draftOf(state), form: FORM });
    }
    if (method === "POST" && /^\/api\/forms\/[^/]+\/drafts$/.test(pathname)) {
      return second(pathname) ? json(200, { draft: draftP(state, lang), form: formP(lang) }) : json(200, { draft: draftOf(state), form: FORM });
    }
    if (method === "PATCH" && /^\/api\/forms\/drafts\//.test(pathname)) {
      const bag = second(pathname) ? state.answersP : state.answers;
      const written = (body && body.answers) || {};
      // A sign-off is never written this way, which is what the API says.
      const signoff = Object.keys(written).find(k => /Sign$/.test(k));
      if (second(pathname) && signoff) return json(400, { error: "A sign-off is made with its own button" });
      Object.keys(written).forEach((k) => { if (written[k] === null) delete bag[k]; else bag[k] = written[k]; });
      return second(pathname) ? json(200, { draft: draftP(state, lang), form: formP(lang) }) : json(200, { draft: draftOf(state), form: FORM });
    }
    if (method === "POST" && /^\/api\/forms\/drafts\/[^/]+\/submit$/.test(pathname)) {
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
  // Every answer goes through here on its way out. A word of a kind the
  // live API already sends in Spanish is served in the language the
  // request asked for, and every string is recorded as a name, a word or
  // a code, so the Spanish check knows what the screens were given.
  function remember(answer, method, pathname, search, accept) {
    if (!answer || typeof answer.body !== "string") return answer;
    let data;
    try { data = JSON.parse(answer.body); } catch (e) { return answer; }
    const kindOf = kindsFor(method, pathname);
    const signedOut = SIGNED_OUT.some(re => re.test(method + " " + pathname));
    const spanish = (signedOut ? signedOutLanguage(search, accept) : languageOf(search, state)) === "es";
    const record = (v, kind) => {
      if (kind === "name") { state.served.add(v); return; }
      if (kind === "code") { state.codes.add(v); return; }
      const en = TWIN_ES.has(v) ? v : (TWIN_EN.get(v) || v);
      const es = TWIN_ES.has(v) ? TWIN_ES.get(v) : (TWIN_EN.has(v) ? v : null);
      state.words.set(v, { value: v, en: en, es: es, kind: kind });
    };
    const walk = (v, field) => {
      if (typeof v === "string") {
        const kind = kindOf(field);
        const out = (spanish && (signedOut || LIVE_KINDS.has(kind)) && TWIN_ES.has(v)) ? TWIN_ES.get(v) : v;
        record(out, kind);
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
    return Object.assign({}, answer, { body: JSON.stringify(walk(data, "")) });
  }

  return { handle: (method, pathname, search, body, accept) => remember(handle(method, pathname, search, body), method, pathname, search, accept), state: state };
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

module.exports = { createStub, servedFor, NOW, PERSON, SECOND_PERSON, SITES, STAFF, LEAVE_TYPES, LOOKUPS, INSPECTION, INSPECTION_GONE, SIGNED_OUT, TIME_OFF_REFUSALS, HR_CASE_REFUSALS, FORM, FORM_P_CODE, FORM_P_WORDS, TWIN_ES, LIVE_KINDS, formP, timeOffRow, ymd, iso, DAY };
