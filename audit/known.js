// Known failures: what the app gets wrong today, and accepted ones:
// what the app does on purpose.
//
// A known failure prints on every run and does not fail it. A known
// failure that starts passing fails the run until it is taken off the
// list, so a fix is always noticed.
//
// An accepted one prints as ACCEPTED and never fails a run either way,
// since it is the app behaving as it was asked to.
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "known.json");

function load() {
  if (!fs.existsSync(FILE)) return { notes: "", accepted: [], failures: [] };
  const file = JSON.parse(fs.readFileSync(FILE, "utf8"));
  if (!file.accepted) file.accepted = [];
  return file;
}

// An entry matches a row when the check is the same, the detail carries
// the text it names, and the screen is the one it names or any screen.
// An entry may also name a theme, since a color pair can be wrong in one
// theme and right in the other. One that names no theme matches both.
function matches(entry, row) {
  if (entry.check !== row.check) return false;
  if (entry.where !== "*" && row.where.indexOf(entry.where) !== 0) return false;
  if (entry.theme && row.where.indexOf("/" + entry.theme + "]") === -1) return false;
  return String(row.detail || "").indexOf(entry.what) !== -1;
}

// Returns { fresh, known, accepted, fixed }: rows nobody knew about,
// rows already on the list, rows the owner has accepted, and entries
// that matched nothing and are now fixed.
function sort(rows) {
  const file = load();
  const list = file.failures;
  const allowed = file.accepted;
  const hit = new Array(list.length).fill(0);
  const fresh = [];
  const known = [];
  const accepted = [];
  rows.forEach((row) => {
    const okAt = allowed.findIndex(e => matches(e, row));
    if (okAt !== -1) { accepted.push(Object.assign({}, row, { why: allowed[okAt].why })); return; }
    // Every entry that names this row is credited, not just the first.
    // One screen's name can be the start of another's, and an entry the
    // longer name's rows also answer to is not a fixed one.
    const at = [];
    list.forEach((e, i) => { if (matches(e, row)) at.push(i); });
    if (at.length === 0) fresh.push(row);
    else { at.forEach(i => { hit[i] += 1; }); known.push(Object.assign({}, row, { why: list[at[0]].why })); }
  });
  const fixed = list.filter((e, i) => hit[i] === 0);
  return { fresh: fresh, known: known, accepted: accepted, fixed: fixed, list: list };
}

// AUDIT_WRITE_KNOWN=1 writes what is failing today into known.json with
// a placeholder reason, so the list is started from a real run rather
// than by hand. The reasons are then written in, one line each.
function write(rows) {
  const current = load();
  const seen = new Set(current.failures.map(e => e.check + "|" + e.what));
  const grouped = new Map();
  rows.forEach((row) => {
    const quoted = String(row.detail || "").match(/^("[^"]*")/);
    const what = quoted ? quoted[1] : String(row.detail || "").slice(0, 60);
    const key = row.check + "|" + what;
    if (seen.has(key)) return;
    if (!grouped.has(key)) grouped.set(key, { where: "*", check: row.check, what: what, why: "TO BE WRITTEN", seen: 0 });
    grouped.get(key).seen += 1;
  });
  const added = Array.from(grouped.values()).map(e => ({ where: e.where, check: e.check, what: e.what, why: e.why }));
  current.failures = current.failures.concat(added);
  fs.writeFileSync(FILE, JSON.stringify(current, null, 2) + "\n");
  return added.length;
}

module.exports = { load, sort, write, FILE };
