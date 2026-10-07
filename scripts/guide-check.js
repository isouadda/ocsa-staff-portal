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
//   an entry's pictures break a rule of Step 276 (guide/README.md):
//     more than two Picture: lines in an entry, a line not written
//     "Picture: <name>" with a name of 1 to 60 of a-z, 0-9 and -, a
//     Picture: line anywhere but just before Last checked:, a picture
//     whose English or Spanish JPEG in public/guide-shots/ is missing,
//     not a JPEG or over 250 KB, two entries naming the same picture,
//     or a file in public/guide-shots/ that no entry names
//   an entry's pictures are older than the entry (Step 294): its
//     Last checked: is later than the day guide/shots-taken.json gives
//     any of its pictures, or a picture it names has no day there; the
//     failure names the command that takes the entry's pictures again,
//     npm run shots -- "<entry title>"
//   an entry names no picture and guide/no-picture.txt does not list its
//     title with a reason, or that file lists a title the guide does not
//     have, one with no reason, or one whose entry names a picture
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
// The pictures of the screen Help draws under an answer (Step 276 in the
// API, 277 here): public/guide-shots/<name>.<lang>.jpg, written by
// npm run shots, one file in each of these languages.
const SHOTS_DIR = path.join(root, "public", "guide-shots");
const SHOT_LANGUAGES = ["en", "es"];
const SHOT_MAX_BYTES = 250 * 1024;
const SHOTS_PER_ENTRY = 2;
const PICTURE_LINE_RE = /^Picture:/;
const PICTURE_RE = /^Picture: ([a-z0-9-]{1,60})$/;
const SHOT_FILE_RE = /^([a-z0-9-]{1,60})\.([a-z]+)\.jpg$/;
const ALLOW_FILE = path.join(root, "guide", "check-allow.txt");
// The day each picture was taken (Step 294), written by npm run shots,
// and the entries that have no picture, each with the reason.
const TAKEN_FILE = path.join(root, "guide", "shots-taken.json");
const NO_PICTURE_FILE = path.join(root, "guide", "no-picture.txt");
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const CHECKED_RE = /^Last checked: (\S+)/;
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

// Each entry's Picture: lines, read against the rules Help's sync holds
// them to, and every file in public/guide-shots/ against the names the
// entries give. Returns how many pictures the entries name.
function pictureFailures(guide, failures) {
  const lines = guide.lines;
  const starts = [];
  lines.forEach((line, i) => { if (/^## /.test(line)) starts.push(i); });
  const named = new Map();
  starts.forEach((at, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    const title = lines[at].replace(/^## /, "").trim();
    let count = 0;
    for (let i = at + 1; i < end; i += 1) {
      if (!PICTURE_LINE_RE.test(lines[i])) continue;
      count += 1;
      const m = PICTURE_RE.exec(lines[i]);
      if (!m) { failures.push({ file: GUIDE_FILE, line: i + 1, text: "Write a picture line as Picture: <name>, the name 1 to 60 of a-z, 0-9 and -." }); continue; }
      // Just before Last checked:, after any other Picture: lines.
      let j = i + 1;
      while (j < end && PICTURE_LINE_RE.test(lines[j])) j += 1;
      if (j >= end || !/^Last checked:/.test(lines[j])) failures.push({ file: GUIDE_FILE, line: i + 1, text: "A Picture: line goes just before Last checked: in its entry." });
      if (count === SHOTS_PER_ENTRY + 1) failures.push({ file: GUIDE_FILE, line: i + 1, text: "The entry \"" + title + "\" names more than " + SHOTS_PER_ENTRY + " pictures." });
      const name = m[1];
      if (named.has(name)) { failures.push({ file: GUIDE_FILE, line: i + 1, text: "The picture " + name + " is named already, at line " + named.get(name) + ". Each picture belongs to one entry." }); continue; }
      named.set(name, i + 1);
      SHOT_LANGUAGES.forEach((lang) => {
        const file = path.join(SHOTS_DIR, name + "." + lang + ".jpg");
        if (!fs.existsSync(file)) { failures.push({ file: GUIDE_FILE, line: i + 1, text: rel(file) + " is missing. Take it with npm run shots -- " + name + "." }); return; }
        const bytes = fs.readFileSync(file);
        if (bytes.length > SHOT_MAX_BYTES) failures.push({ file: GUIDE_FILE, line: i + 1, text: rel(file) + " is " + Math.ceil(bytes.length / 1024) + " KB, over 250 KB." });
        if (bytes[0] !== 0xff || bytes[1] !== 0xd8) failures.push({ file: GUIDE_FILE, line: i + 1, text: rel(file) + " is not a JPEG." });
      });
    }
  });
  // Every file in the folder is one of those, in one of the languages.
  if (fs.existsSync(SHOTS_DIR)) {
    fs.readdirSync(SHOTS_DIR).sort().forEach((f) => {
      const m = SHOT_FILE_RE.exec(f);
      if (m && named.has(m[1]) && SHOT_LANGUAGES.indexOf(m[2]) !== -1) return;
      failures.push({ file: path.join(SHOTS_DIR, f), line: 1, text: m && SHOT_LANGUAGES.indexOf(m[2]) !== -1 ? "No entry names the picture " + m[1] + ". Add Picture: " + m[1] + " to its entry, or take the file off." : "Not a picture file. Each is " + SHOT_LANGUAGES.map(l => "<name>." + l + ".jpg").join(" or ") + "." });
    });
  }
  pictureAge(guide, starts, failures);
  return named.size;
}

// The days npm run shots wrote, by picture name, or null when the file is
// missing or does not read, which is a failure of its own.
function takenDays(failures) {
  if (!fs.existsSync(TAKEN_FILE)) { failures.push({ file: TAKEN_FILE, line: 1, text: rel(TAKEN_FILE) + " is missing. npm run shots writes it." }); return null; }
  let days = null;
  try { days = JSON.parse(fs.readFileSync(TAKEN_FILE, "utf8")); } catch (e) { days = null; }
  if (!days || typeof days !== "object" || Array.isArray(days)) { failures.push({ file: TAKEN_FILE, line: 1, text: rel(TAKEN_FILE) + " does not read as one object of picture names and days." }); return null; }
  Object.keys(days).forEach((k) => { if (!DAY_RE.test(String(days[k]))) failures.push({ file: TAKEN_FILE, line: 1, text: k + " has no day written YYYY-MM-DD." }); });
  return days;
}

// The titles guide/no-picture.txt excuses, one a line, written
// "<entry title> | <reason>"; a line starting # is a comment.
function noPictureTitles(failures) {
  const out = new Map();
  if (!fs.existsSync(NO_PICTURE_FILE)) return out;
  fs.readFileSync(NO_PICTURE_FILE, "utf8").split(/\r\n|\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line[0] === "#") return;
    const at = line.indexOf(" | ");
    const title = at === -1 ? line : line.slice(0, at).trim();
    const why = at === -1 ? "" : line.slice(at + 3).trim();
    if (!why) { failures.push({ file: NO_PICTURE_FILE, line: i + 1, text: "Write the reason after the title: <entry title> | <reason>." }); return; }
    if (out.has(title)) { failures.push({ file: NO_PICTURE_FILE, line: i + 1, text: "\"" + title + "\" is listed twice." }); return; }
    out.set(title, i + 1);
  });
  return out;
}

// Step 294: every entry's pictures are at least as new as the entry, and
// every entry has a picture or a reason it has none.
function pictureAge(guide, starts, failures) {
  const lines = guide.lines;
  const days = takenDays(failures);
  const excused = noPictureTitles(failures);
  const titles = new Set();
  starts.forEach((at, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    const title = lines[at].replace(/^## /, "").trim();
    titles.add(title);
    const names = [];
    let checked = null, checkedAt = at;
    for (let i = at + 1; i < end; i += 1) {
      const m = PICTURE_RE.exec(lines[i]);
      if (m) names.push(m[1]);
      const c = CHECKED_RE.exec(lines[i]);
      if (c) { checked = c[1]; checkedAt = i; }
    }
    const retake = "npm run shots -- \"" + title + "\"";
    if (names.length === 0) {
      if (!excused.has(title)) failures.push({ file: GUIDE_FILE, line: at + 1, text: "The entry \"" + title + "\" names no picture. Take one with npm run shots, or list the title in " + rel(NO_PICTURE_FILE) + " with the reason." });
      return;
    }
    if (excused.has(title)) failures.push({ file: NO_PICTURE_FILE, line: excused.get(title), text: "\"" + title + "\" names a picture now. Take it off this list." });
    if (!days) return;
    names.forEach((name) => {
      const day = days[name];
      if (!day) { failures.push({ file: GUIDE_FILE, line: checkedAt + 1, text: "The picture " + name + " has no day in " + rel(TAKEN_FILE) + ". Take it with " + retake + "." }); return; }
      if (checked && DAY_RE.test(checked) && checked > day) failures.push({ file: GUIDE_FILE, line: checkedAt + 1, text: "The entry \"" + title + "\" was last checked " + checked + ", after its picture " + name + " was taken on " + day + ". Take it again with " + retake + "." });
    });
  });
  excused.forEach((line, title) => { if (!titles.has(title)) failures.push({ file: NO_PICTURE_FILE, line: line, text: "\"" + title + "\" is not an entry in the guide." }); });
  if (days) {
    const named = new Set();
    starts.forEach((at, k) => { const end = k + 1 < starts.length ? starts[k + 1] : lines.length; for (let i = at + 1; i < end; i += 1) { const m = PICTURE_RE.exec(lines[i]); if (m) named.add(m[1]); } });
    Object.keys(days).forEach((name) => { if (!named.has(name)) failures.push({ file: TAKEN_FILE, line: 1, text: "No entry names the picture " + name + ". Take it off " + rel(TAKEN_FILE) + "." }); });
  }
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

  const pictures = pictureFailures(guide, failures);

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
  failures.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file === GUIDE_FILE ? -1 : b.file === GUIDE_FILE ? 1 : a.file < b.file ? -1 : 1));
  failures.forEach((f) => {
    const where = rel(f.file) + ":" + f.line;
    process.stdout.write(where + ": " + f.text + "\n");
    if (inActions) process.stdout.write("::error file=" + rel(f.file) + ",line=" + f.line + "::" + f.text + "\n");
  });
  process.stdout.write("guide-check: " + guide.entries.length + " entries, " + pairCount + " bold names, " + frenchCount + " with English, Spanish and French, " +
    allowed.size + " allowed, " + pictures + " pictures, fingerprint " + fingerprint(guide.entries) + ", " +
    (failures.length === 0 ? "passed" : failures.length + " failed") + "\n");
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
