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

module.exports = { ES, say, LEAKABLE };
