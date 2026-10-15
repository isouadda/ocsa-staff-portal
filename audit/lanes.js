// Part 344: the full suite's work, run in lanes side by side on the one
// browser, the way the smoke check runs its checks. Every piece is a case
// with its own phone and stub, so pieces never share a page; what they
// add to is the run's own list of rows, which each piece only appends to.
// AUDIT_LANES=<n> sets how many, three unless set; AUDIT_LANES=1 runs them
// one after another, the way the suite always ran.
const LANES = Math.max(1, Number(process.env.AUDIT_LANES) || 3);

// Each of items through fn, at most LANES at once, in the order given.
async function inLanes(items, fn) {
  const queue = items.slice();
  const lane = async () => { while (queue.length) { const item = queue.shift(); await fn(item); } };
  await Promise.all(Array.from({ length: Math.min(LANES, Math.max(1, items.length)) }, lane));
}

module.exports = { inLanes, LANES };
