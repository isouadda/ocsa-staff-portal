// Writes one build stamp to two places, so the running app and the
// server agree on what "current" means:
//
//   public/version.json   what a running copy asks the server for
//   src/buildStamp.js     what the bundle itself carries
//
// Plain Node, no package. Run by npm run build before react-scripts.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

// Vercel hands every build the commit it is building. Anywhere else,
// the word local and the time, to the second.
const sha = (process.env.VERCEL_GIT_COMMIT_SHA || "").trim();
const stamp = sha || "local-" + new Date().toISOString().replace(/\.\d+Z$/, "Z");

fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public/version.json"), JSON.stringify({ stamp: stamp }) + "\n");

fs.writeFileSync(path.join(root, "src/buildStamp.js"),
  "// Written by scripts/stamp.js on every build. The value committed is\n" +
  "// a placeholder, so a fresh clone compiles before anything is run.\n" +
  "export const BUILD_STAMP = " + JSON.stringify(stamp) + ";\n");

process.stdout.write("stamp " + stamp + "\n");
