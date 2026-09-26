// The app's Spanish table, read out of src/words.js without importing it,
// so the suite can both find a screen's controls by their Spanish label
// and tell when an English string reached a Spanish screen.
const fs = require("fs");
const path = require("path");

function loadTable() {
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "words.js"), "utf8");
  const block = src.match(/export const WORDS = \{\s*es: \{([\s\S]*?)\n  \},\n\};/);
  if (!block) throw new Error("the Spanish table was not found in src/words.js");
  const body = block[1]
    .split("\n")
    .filter(line => line.trim() && !line.trim().startsWith("//"))
    .join("\n")
    .replace(/,\s*$/, "");
  const table = JSON.parse("{" + body + "}");
  return table;
}

const ES = loadTable();

// English for a key, in whichever language a case is running.
function say(english, language) {
  if (language !== "es") return english;
  return Object.prototype.hasOwnProperty.call(ES, english) ? ES[english] : english;
}

// The English strings that have a Spanish entry and would be a leak if
// they showed on a Spanish screen. A key whose Spanish is the same word
// is not a leak, since there is nothing to tell apart.
const LEAKABLE = Object.keys(ES).filter(k => ES[k] !== k && !/\{/.test(k) && k.length >= 3);

// Every Spanish value the app can draw. A value written with a
// {placeholder} becomes a pattern, so the line a person reads with the
// placeholder filled in is still recognised as one of the app's own, and
// each piece between the placeholders is kept too, since a screen may
// draw those pieces around something else the way the install sheet
// drops its share glyph into the middle of a sentence. Each placeholder
// is a group, so the check can judge what fills it: a Spanish sentence
// with an English word inside it is still English on a Spanish screen.
const SPANISH = [];
const SPANISH_PATTERNS = [];
Object.keys(ES).forEach((key) => {
  const value = String(ES[key]);
  SPANISH.push(value.trim());
  if (!/\{/.test(value)) return;
  SPANISH_PATTERNS.push("^" + value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{\w+\\\}/g, "([\\s\\S]*?)") + "$");
  value.split(/\{\w+\}/).forEach((piece) => { const p = piece.trim(); if (p) SPANISH.push(p); });
});

// Every word the portal's own code writes, read out of src: each tr()
// called with a string, or with a choice between two strings. A word
// with no Spanish entry falls back to English in the app, so a screen
// that draws it only after a tap, a refusal or a slow network would show
// English that no sweep ever reaches. The suite fails on each one it finds
// with no entry, whether or not a case happens to draw it.
function literalWords() {
  const files = ["App.js", "HomeScreenPrompt.js"];
  const out = [];
  const unquote = (q) => JSON.parse('"' + q + '"');
  const STR = '"((?:[^"\\\\\\n]|\\\\.)*)"';
  const direct = new RegExp("\\btr\\(\\s*" + STR, "g");
  const choice = new RegExp("\\btr\\([^\"()\\n]*\\?\\s*" + STR + "\\s*:\\s*" + STR, "g");
  // A choice between a named line and a written one.
  const NAME = "[A-Za-z_$][\\w$.]*";
  const lastIs = new RegExp("\\btr\\([^\"()\\n]*\\?\\s*" + NAME + "\\s*:\\s*" + STR + "\\s*\\)", "g");
  const firstIs = new RegExp("\\btr\\([^\"()\\n]*\\?\\s*" + STR + "\\s*:\\s*" + NAME + "\\s*\\)", "g");
  files.forEach((name) => {
    const text = fs.readFileSync(path.join(__dirname, "..", "src", name), "utf8");
    const lineOf = (at) => text.slice(0, at).split("\n").length;
    let m;
    while ((m = direct.exec(text))) out.push({ key: unquote(m[1]), file: name, line: lineOf(m.index) });
    while ((m = choice.exec(text))) {
      out.push({ key: unquote(m[1]), file: name, line: lineOf(m.index) });
      out.push({ key: unquote(m[2]), file: name, line: lineOf(m.index) });
    }
    while ((m = lastIs.exec(text))) out.push({ key: unquote(m[1]), file: name, line: lineOf(m.index) });
    while ((m = firstIs.exec(text))) out.push({ key: unquote(m[1]), file: name, line: lineOf(m.index) });
  });
  return out;
}

// The words above with no Spanish entry, one row each, the first place
// each is written.
function untranslated() {
  const seen = new Set();
  return literalWords().filter((w) => {
    if (Object.prototype.hasOwnProperty.call(ES, w.key) || seen.has(w.key)) return false;
    seen.add(w.key);
    return true;
  });
}

// Words the apps have settled, beside the ones they retired. The API and
// the admin dashboard say suministro for a supply, so the portal does
// too, and a retired word never comes back into src or the review sheet
// in translation. Written plainly, since none of them carries an accent.
const RETIRED = [
  { word: "insumo", settled: "suministro" },
];

// Every line in src or translation that writes a retired word, one row
// each, whatever its case.
function retiredRows() {
  const root = path.join(__dirname, "..");
  const rows = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) { walk(p); return; }
    if (!/\.(js|csv|json|md)$/.test(d.name)) return;
    fs.readFileSync(p, "utf8").split("\n").forEach((line, i) => {
      RETIRED.forEach((r) => {
        if (line.toLowerCase().indexOf(r.word) === -1) return;
        rows.push({ where: path.relative(root, p), check: "a retired word", detail: JSON.stringify(r.word) + " on line " + (i + 1) + ", where the apps say " + r.settled });
      });
    });
  });
  ["src", "translation"].forEach(d => walk(path.join(root, d)));
  return rows;
}

module.exports = { ES, say, LEAKABLE, SPANISH, SPANISH_PATTERNS, literalWords, untranslated, RETIRED, retiredRows };
