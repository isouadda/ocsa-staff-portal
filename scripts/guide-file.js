// The Help guide file, read the way the API reads it.
//
// guide/APP-PORTAL.md is parsed here exactly as POST /api/guide-sync
// parses it (Step 198 in the API): the first line is
// "# <CODE> | <Title>", each entry starts at a line "## <entry title>"
// and runs to the next such line, and an entry's content is its lines
// with the ends trimmed. Both guide scripts read the file through this,
// so the check on a pull request and the sync on a merge never disagree
// about what an entry is.
//
// Plain Node, no package.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const GUIDE_CODE = "APP-PORTAL";
const GUIDE_FILE = path.join(__dirname, "..", "guide", GUIDE_CODE + ".md");

const HEAD_RE = /^# ([A-Z0-9-]+) \| (.*\S)\s*$/;
const ENTRY_RE = /^## (.*)$/;

// The file as text, its lines, and its entries. head is null when the
// first line does not read. Each entry carries the line its title is on,
// counted from 1, so a failure can name it.
function parseGuide(text) {
  const lines = String(text).split(/\r\n|\n/);
  const m = HEAD_RE.exec(lines[0] || "");
  const head = m ? { code: m[1], title: m[2].trim() } : null;
  const entries = [];
  let cur = null;
  for (let i = 1; i < lines.length; i += 1) {
    const e = ENTRY_RE.exec(lines[i]);
    if (e) {
      cur = { title: e[1].trim(), line: i + 1, body: [] };
      entries.push(cur);
    } else if (cur) {
      cur.body.push(lines[i]);
    }
  }
  return {
    lines,
    head,
    entries: entries.map((x) => ({ title: x.title, line: x.line, content: x.body.join("\n").trim() })),
  };
}

// The fingerprint the API answers after a sync: the md5 of the md5s of
// "<title>|<content>" for every entry, in order, run together.
function fingerprint(entries) {
  const md5 = (s) => crypto.createHash("md5").update(s, "utf8").digest("hex");
  return md5(entries.map((e) => md5(e.title + "|" + e.content)).join(""));
}

function readGuide() {
  return fs.readFileSync(GUIDE_FILE, "utf8");
}

module.exports = { GUIDE_CODE, GUIDE_FILE, parseGuide, fingerprint, readGuide };
