// Loads guide/APP-PORTAL.md into Help. Run by
// .github/workflows/guide-sync.yml on a merge to main that changes the
// file, and by hand from the Actions tab.
//
// No secret is stored anywhere. The run asks GitHub for its own OIDC
// token with the audience the API expects, and the API checks it against
// GitHub's published keys: the token says which repository and which
// branch the run came from, and only this repository's main branch may
// write APP-PORTAL. A run by hand from any other branch is refused.
//
// The answer's counts and fingerprint are printed. Anything but a 2xx
// fails the job, with the API's code and words, and the titles when the
// API refuses a sync that would retire more than three entries.
//
// GUIDE_DRY_RUN=true asks the API what it would change and writes
// nothing. Plain Node, no package.
const { GUIDE_CODE, readGuide, parseGuide, fingerprint } = require("./guide-file");

const API = (process.env.GUIDE_SYNC_API || "https://ocsa-api-production.up.railway.app").replace(/\/+$/, "");
const AUDIENCE = "ocsa-guide-sync";

function fail(line) {
  process.stdout.write("::error::" + line + "\n");
  process.exit(1);
}

async function oidcToken() {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const bearer = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !bearer) fail("No OIDC token on offer. The workflow needs permissions: id-token: write, and this runs only inside GitHub Actions.");
  const res = await fetch(url + (url.indexOf("?") === -1 ? "?" : "&") + "audience=" + encodeURIComponent(AUDIENCE), {
    headers: { Authorization: "bearer " + bearer, Accept: "application/json" },
  });
  if (!res.ok) fail("GitHub did not give an OIDC token: HTTP " + res.status + ".");
  const body = await res.json().catch(() => ({}));
  if (!body || typeof body.value !== "string" || !body.value) fail("GitHub answered with no OIDC token.");
  return body.value;
}

async function main() {
  const dryRun = String(process.env.GUIDE_DRY_RUN || "").toLowerCase() === "true";
  const markdown = readGuide();
  const parsed = parseGuide(markdown);
  const local = fingerprint(parsed.entries);
  const sourceCommit = process.env.GITHUB_SHA || null;
  process.stdout.write("guide " + GUIDE_CODE + ", " + parsed.entries.length + " entries, file fingerprint " + local + "\n");
  process.stdout.write("commit " + (sourceCommit || "unknown") + (dryRun ? ", dry run" : "") + "\n");

  const token = await oidcToken();
  let res;
  try {
    res = await fetch(API + "/api/guide-sync" + (dryRun ? "?dryRun=true" : ""), {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ docCode: GUIDE_CODE, markdown, sourceCommit }),
    });
  } catch (err) {
    fail("The API did not answer: " + err.message);
  }
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (e) { body = null; }

  if (!res.ok) {
    const b = body && typeof body === "object" ? body : {};
    const said = typeof b.error === "string" ? b.error.trim() : "";
    process.stdout.write("HTTP " + res.status + (b.code ? " " + b.code : "") + (said ? ": " + said : "") + "\n");
    if (Array.isArray(b.keys) && b.keys.length > 0) {
      process.stdout.write("titles:\n");
      b.keys.forEach((k) => process.stdout.write("  " + k + "\n"));
    }
    if (!body) process.stdout.write(text.slice(0, 2000) + "\n");
    fail("The guide sync was refused: HTTP " + res.status + (b.code ? " " + b.code : "") + ".");
  }

  const a = body && typeof body === "object" ? body : {};
  const count = (k) => (typeof a[k] === "number" ? a[k] : "?");
  process.stdout.write((a.dryRun ? "dry run, nothing written\n" : "synced\n") +
    "  updated      " + count("updated") + "\n" +
    "  inserted     " + count("inserted") + "\n" +
    "  reactivated  " + count("reactivated") + "\n" +
    "  deactivated  " + count("deactivated") + "\n" +
    "  unchanged    " + count("unchanged") + "\n" +
    "  rows active  " + count("rowsActive") + "\n" +
    "  fingerprint  " + (a.fingerprint || "?") + "\n");
  // The contract has the API count every row the document holds, so
  // the two can differ once an entry has been retired. Said, not failed.
  if (!a.dryRun && a.fingerprint && a.fingerprint !== local) {
    process.stdout.write("::notice::Help's fingerprint " + a.fingerprint + " differs from the file's " + local + ". Help counts every row it holds for this guide, retired entries included.\n");
  }
}

main().catch((err) => fail(err && err.message ? err.message : String(err)));
