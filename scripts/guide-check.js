// The check on the Help guide, run on every pull request by
// .github/workflows/guide-check.yml and by hand with npm run guide-check.
//
// It reads guide/APP-PORTAL.md the way the API reads it
// (scripts/guide-file.js) and fails when:
//
//   the first line does not read as "# APP-PORTAL | <Title>"
//   two entries share a title
//   an entry has no title or nothing under it
//   a bold name is not written **English** (**Spanish**) (**French**)
//     (Step 244: Help reads the third as the French screen's, Step 241)
//   a bold name has no row in translation/portal_words.csv with that
//     English and that Spanish, unless guide/check-allow.txt lists it
//   its French is not that row's French, or the French the allow list
//     gives it
//   the file holds an email address or a phone number
//
// It warns, and does not fail, when a row in the CSV has no French.
//
// Each failure is printed with its line. When the pull request changes
// src/ and not guide/, it writes a warning that the guide may need an
// entry, and does not fail for it. GUIDE_BASE names the branch to compare
// with (origin/main on a pull request); without it that warning is not
// looked for.
//
// Plain Node, no package.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { GUIDE_CODE, GUIDE_FILE, readGuide, parseGuide, fingerprint } = require("./guide-file");

const root = path.join(__dirname, "..");
const WORDS_FILE = path.join(root, "translation", "portal_words.csv");
const ALLOW_FILE = path.join(root, "guide", "check-allow.txt");
const rel = (f) => path.relative(root, f).split(path.sep).join("/");
const inActions = process.env.GITHUB_ACTIONS === "true";

// A bold name, its Spanish, and its French when it has one.
const PAIR_RE = /\*\*([^*]+?)\*\* \(\*\*([^*]+?)\*\*\)(?: \(\*\*([^*]+?)\*\*\))?/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?<![\d-])(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-]?)\d{3}[\s.-]?\d{4}(?![\d-])/g;

// A CSV read the usual way: commas between fields, a field in double
// quotes may hold commas, line breaks and "" for a quote.
function readCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const pairKey = (en, es) => en + "\u0000" + es;

// Every English and Spanish pair the portal draws, each with the French
// its rows give it. The English is the part of the key before "|", where
// a key carries one. Each column is found by its name on the first row,
// so a column added between them moves nothing. A row with no French is
// counted and named in a warning, since a key with no French shows its
// English on a French screen.
function wordPairs() {
  const rows = readCsv(fs.readFileSync(WORDS_FILE, "utf8"));
  const head = rows[0] || [];
  const col = (name, fallback) => (head.indexOf(name) === -1 ? fallback : head.indexOf(name));
  const EN = col("English", 0), ES = col("Spanish", 1), FR = col("French", -1);
  const map = new Map();
  const noFrench = [];
  rows.slice(1).forEach((r) => {
    if (r.length < 2) return;
    const key = pairKey(r[EN].split("|")[0], r[ES]);
    if (!map.has(key)) map.set(key, new Set());
    const fr = FR === -1 ? "" : String(r[FR] || "").trim();
    if (fr) map.get(key).add(fr);
    if (FR !== -1 && !fr) noFrench.push(r[EN]);
  });
  map.noFrench = FR === -1 ? null : noFrench;
  return map;
}

// The names the check lets through, one per line, written as the guide
// writes them, **English** (**Spanish**) (**French**). Each sits under a
// comment line that says why, and a blank line ends what a comment
// covers; a name with no comment above it, or a line that is not a name
// written that way, fails the check. Spanish and French letters may be
// written as \u escapes, the way src/words.js writes them, so the file
// can stay ASCII.
const unescape = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
function allowList(failures) {
  const allowed = new Map();
  if (!fs.existsSync(ALLOW_FILE)) return allowed;
  let why = false;
  fs.readFileSync(ALLOW_FILE, "utf8").split(/\r\n|\n/).forEach((raw, i) => {
    const line = unescape(raw.trim());
    if (!line) { why = false; return; }
    if (line[0] === "#") { why = true; return; }
    const m = /^\*\*([^*]+?)\*\* \(\*\*([^*]+?)\*\*\) \(\*\*([^*]+?)\*\*\)$/.exec(line);
    if (!m) { failures.push({ file: ALLOW_FILE, line: i + 1, text: "This line is not a name written **English** (**Spanish**) (**French**)." }); return; }
    if (!why) failures.push({ file: ALLOW_FILE, line: i + 1, text: "This name has no comment line above it saying why it is allowed." });
    allowed.set(pairKey(m[1], m[2]), { line: i + 1, used: false, french: m[3] });
  });
  return allowed;
}

// The files the pull request changes, or null when there is nothing to
// compare with.
function changedFiles() {
  const base = (process.env.GUIDE_BASE || "").trim();
  if (!base) return null;
  try {
    return execFileSync("git", ["diff", "--name-only", base + "...HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n").map((s) => s.trim()).filter(Boolean);
  } catch (err) {
    process.stdout.write("Could not compare with " + base + ", so the src/ warning was not looked for.\n");
    return null;
  }
}

function main() {
  const failures = [];
  const text = readGuide();
  const guide = parseGuide(text);

  if (!guide.head || guide.head.code !== GUIDE_CODE) {
    failures.push({ file: GUIDE_FILE, line: 1, text: "The first line does not read as # " + GUIDE_CODE + " | <Title>." });
  }
  if (guide.entries.length === 0) {
    failures.push({ file: GUIDE_FILE, line: 1, text: "The file has no entries. Each starts at a line ## <entry title>." });
  }

  const firstAt = new Map();
  guide.entries.forEach((e) => {
    if (!e.title) failures.push({ file: GUIDE_FILE, line: e.line, text: "This entry has no title." });
    else if (firstAt.has(e.title)) failures.push({ file: GUIDE_FILE, line: e.line, text: "Two entries share the title \"" + e.title + "\". The first is at line " + firstAt.get(e.title) + "." });
    else firstAt.set(e.title, e.line);
    if (!e.content) failures.push({ file: GUIDE_FILE, line: e.line, text: "The entry \"" + e.title + "\" has nothing under it." });
  });

  const words = wordPairs();
  const allowed = allowList(failures);
  let pairCount = 0, frenchCount = 0;
  guide.lines.forEach((line, i) => {
    for (const m of line.matchAll(PAIR_RE)) {
      pairCount += 1;
      const key = pairKey(m[1], m[2]);
      const french = m[3];
      let fromCsv = null;
      if (words.has(key)) fromCsv = Array.from(words.get(key));
      else if (allowed.has(key)) { allowed.get(key).used = true; fromCsv = [allowed.get(key).french]; }
      else {
        failures.push({ file: GUIDE_FILE, line: i + 1, text: m[0] + " has no row in " + rel(WORDS_FILE) + " with that English and that Spanish." });
        continue;
      }
      if (french === undefined) {
        failures.push({ file: GUIDE_FILE, line: i + 1, text: m[0] + " has no French name. Write it **" + m[1] + "** (**" + m[2] + "**) (**" + (fromCsv[0] || "?") + "**)." });
        continue;
      }
      if (fromCsv.indexOf(french) === -1) {
        failures.push({ file: GUIDE_FILE, line: i + 1, text: m[0] + ": the French is not " + (words.has(key) ? rel(WORDS_FILE) + "'s" : "the allow list's") + " for that English and Spanish, " + fromCsv.map((f) => JSON.stringify(f)).join(" or ") + "." });
        continue;
      }
      frenchCount += 1;
    }
    for (const m of line.matchAll(EMAIL_RE)) failures.push({ file: GUIDE_FILE, line: i + 1, text: "An email address is in the guide: " + m[0] + ". This repository is public." });
    for (const m of line.matchAll(PHONE_RE)) failures.push({ file: GUIDE_FILE, line: i + 1, text: "A phone number is in the guide: " + m[0].trim() + ". This repository is public." });
  });

  if (words.noFrench === null) process.stdout.write("warning: " + rel(WORDS_FILE) + " has no French column.\n");
  else if (words.noFrench.length > 0) {
    process.stdout.write("warning: " + words.noFrench.length + " rows in " + rel(WORDS_FILE) + " have no French, and show their English on a French screen: " +
      words.noFrench.slice(0, 5).map((w) => JSON.stringify(w)).join(", ") + (words.noFrench.length > 5 ? " and more" : "") + "\n");
  }

  allowed.forEach((v, key) => {
    if (!v.used) process.stdout.write(rel(ALLOW_FILE) + ":" + v.line + ": no longer in the guide, and can come off: " + key.replace("\u0000", " / ") + "\n");
  });

  const changed = changedFiles();
  if (changed && changed.some((f) => f.indexOf("src/") === 0) && !changed.some((f) => f.indexOf("guide/") === 0)) {
    const say = "This pull request changes src/ and not guide/. If a screen changed, guide/APP-PORTAL.md may need an entry.";
    process.stdout.write((inActions ? "::warning file=" + rel(GUIDE_FILE) + "::" : "warning: ") + say + "\n");
  }

  // The guide's own failures first, each file in line order.
  failures.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file === GUIDE_FILE ? -1 : 1));
  failures.forEach((f) => {
    const where = rel(f.file) + ":" + f.line;
    process.stdout.write(where + ": " + f.text + "\n");
    if (inActions) process.stdout.write("::error file=" + rel(f.file) + ",line=" + f.line + "::" + f.text + "\n");
  });
  process.stdout.write("guide-check: " + guide.entries.length + " entries, " + pairCount + " bold names, " + frenchCount + " with English, Spanish and French, " +
    allowed.size + " allowed, fingerprint " + fingerprint(guide.entries) + ", " +
    (failures.length === 0 ? "passed" : failures.length + " failed") + "\n");
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
