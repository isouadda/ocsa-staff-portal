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
// drops its share glyph into the middle of a sentence.
const SPANISH = [];
const SPANISH_PATTERNS = [];
Object.keys(ES).forEach((key) => {
  const value = String(ES[key]);
  SPANISH.push(value.trim());
  if (!/\{/.test(value)) return;
  SPANISH_PATTERNS.push("^" + value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{\w+\\\}/g, "[\\s\\S]*") + "$");
  value.split(/\{\w+\}/).forEach((piece) => { const p = piece.trim(); if (p) SPANISH.push(p); });
});

module.exports = { ES, say, LEAKABLE, SPANISH, SPANISH_PATTERNS };
