// ============================================================
// THE PORTAL'S OWN WORDS
//
// Every word the portal draws itself lives here in English and
// Spanish. Help's answers and the two report forms are not in
// this file: those arrive from the API already in the chosen
// language.
//
// The key is the exact English a screen shows today. A reviewer
// reads each pair side by side in translation/portal_words.csv,
// and a key with no entry falls back to the English, so a word
// added later shows in English rather than blank or as a code.
//
// Accented letters and opening marks are written as \u escapes,
// so this file stays ASCII while the screen shows correct
// Spanish. The review sheet is the file written in real Spanish
// characters, because people read that one.
// ============================================================

// The language every screen reads. The root component sets it
// from the one piece of state Step 70 already keeps, during its
// own render, so the choice is in place before any screen below
// renders and choosing Spanish in Settings changes the whole
// portal at once with no reload. A module value rather than a
// context, because a good half of the portal's words are drawn
// by plain helper functions that cannot hold a hook.
let current = "en";

export function setWordsLanguage(lang) {
  current = lang === "es" ? "es" : "en";
}

export function wordsLanguage() {
  return current;
}

// English is the key, so there is no English table.
export const WORDS = {
  es: {},
};

// {name} is replaced after the language is chosen, so the
// Spanish decides where a value lands rather than the English
// word order.
function fill(text, vars) {
  if (!vars) return text;
  return String(text).replace(/\{(\w+)\}/g, function (whole, key) {
    return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole;
  });
}

// The one call every screen makes. Anything that is not a string
// comes back untouched, so a null or a number passed by mistake
// renders the way it did before.
export function tr(text, vars) {
  if (typeof text !== "string") return text;
  const table = WORDS[current];
  const out = table && Object.prototype.hasOwnProperty.call(table, text) ? table[text] : text;
  return fill(out, vars);
}

// What every date and time formatter passes.
export function dateLocale() {
  return current === "es" ? "es-US" : "en-US";
}
