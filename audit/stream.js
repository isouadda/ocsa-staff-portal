// Help's streaming route, played the way the API plays it: a real HTTP
// answer written in pieces, with a pause between them.
//
// Playwright's route.fulfill hands the browser a body whole, so a stream
// cannot go through it. The route in browser.js answers the streaming
// route with a 307 to this server instead, and the browser follows it
// here. The request the app made is still the one the stub records, and
// what comes back arrives over a real connection, piece by piece, the way
// the API's does. A dropped connection is the socket destroyed part way,
// so the app meets the same error a phone losing its signal meets.
//
// A play is what the stub decided to answer: its steps in order, each an
// event, a hold, a drop or the end, and the pause before each event.
// holds are the stub's own gates, so a case can stop the answer at a
// point, read the screen, and let it go on.

const http = require("http");

let started = null;
let seq = 0;
const plays = new Map();

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

// One event on the wire, the way a server writes Server-Sent Events.
const frame = (event, data) => "event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n";

// One server for the whole run, started the first time a play needs it.
function start() {
  if (started) return started;
  const server = http.createServer((req, res) => {
    // A redirected request carries a null origin, and this server answers
    // it the way the API answers the portal.
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" };
    if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }
    const id = String(req.url || "").split("/").pop();
    const play = plays.get(id);
    plays.delete(id);
    req.resume();
    // A page closed part way leaves nobody to write to, which is not a
    // fault of the run.
    req.on("error", () => {});
    res.on("error", () => {});
    if (!play) {
      res.writeHead(404, Object.assign({ "Content-Type": "application/json" }, cors));
      res.end(JSON.stringify({ error: "Endpoint not found" }));
      return;
    }
    res.writeHead(200, Object.assign({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }, cors));
    run(play, (event, data, split) => {
      const bytes = Buffer.from(frame(event, data), "utf8");
      // A piece the case asked to arrive in two parts is cut through its
      // bytes: inside its first accented letter when it has one, so the
      // app has to put the letter back together, and in the middle when
      // it has none.
      if (!split) { res.write(bytes); return null; }
      const wide = bytes.findIndex(b => b >= 0x80);
      const cut = wide !== -1 ? wide + 1 : Math.floor(bytes.length / 2);
      res.write(bytes.subarray(0, cut));
      return () => res.write(bytes.subarray(cut));
    }, () => { try { res.socket.destroy(); } catch (e) {} }, () => res.end()).catch(() => { try { res.end(); } catch (e) {} });
  });
  started = new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      server.unref();
      resolve("http://127.0.0.1:" + server.address().port);
    });
  });
  return started;
}

// Walks one play. send writes an event and may hand back the second half
// of one cut in two; drop and end close the connection one way or the
// other. With no connection at all, the same walk is the time the API
// takes to write the whole answer, which is what the message route waits
// before it answers.
async function run(play, send, drop, end) {
  for (const step of play.steps) {
    if (step.hold) {
      const gate = play.holds[step.hold];
      if (gate) { gate.reached = true; await gate.opened; }
      continue;
    }
    await wait(step.pause !== undefined ? step.pause : play.pauseMs);
    if (step.drop) { play.finished(); if (drop) drop(); return "drop"; }
    if (step.event) {
      const rest = send ? send(step.event, step.data, !!step.split) : null;
      if (rest) { await wait(play.pauseMs); rest(); }
    }
  }
  play.finished();
  if (end) end();
  return "end";
}

// Where the browser is sent to read one play.
async function streamUrl(play) {
  const at = await start();
  const id = String(++seq);
  plays.set(id, play);
  return at + "/help-stream/" + id;
}

// The same play with nobody listening, for the route that answers once the
// whole answer is written.
const silently = (play) => run(play, null, null, null);

module.exports = { streamUrl, silently };
