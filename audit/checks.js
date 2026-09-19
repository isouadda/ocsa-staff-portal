// The five checks every screen and sheet is put through, in both
// languages and at all four text sizes.
//
// They run inside the page in one pass, so a screen is measured as a
// person would meet it rather than element by element over many round
// trips.

// Returns { sideways, clipped, unreachable, small, english }.
// Each is a list of what went wrong, empty when the screen is right.
const INSPECT = function (args) {
  const leakable = args.leakable;
  const allowed = args.allowed;
  const scope = args.scope ? document.querySelector(args.scope) : document.body;
  const out = { sideways: null, clipped: [], unreachable: [], small: [], english: [] };
  if (!scope) return { missing: args.scope };

  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth) {
    out.sideways = { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, over: doc.scrollWidth - doc.clientWidth };
  }

  const seen = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = window.getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
  };
  const label = (el) => (el.innerText || el.textContent || el.getAttribute("aria-label") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);

  // 1. Text cut off, by its own box or by an ancestor that hides what
  // sticks out of it.
  Array.from(scope.querySelectorAll("*")).forEach((el) => {
    if (el.children.length > 0 || !seen(el)) return;
    const text = (el.innerText || el.textContent || "").trim();
    if (!text) return;
    const s = window.getComputedStyle(el);
    const ownClip = (s.overflowX === "hidden" || s.overflowX === "clip") && el.scrollWidth > el.clientWidth + 1;
    let byAncestor = null;
    const r = el.getBoundingClientRect();
    for (let a = el.parentElement; a && !byAncestor; a = a.parentElement) {
      const as = window.getComputedStyle(a);
      if (as.overflowX !== "hidden" && as.overflowX !== "clip") continue;
      const ar = a.getBoundingClientRect();
      if (r.right > ar.right + 0.5 || r.left < ar.left - 0.5) byAncestor = label(a);
    }
    if (ownClip || byAncestor) out.clipped.push({ text: text.slice(0, 40), by: byAncestor || "its own box" });
  });

  // 2. Every control reachable, and 3. big enough to hit.
  const controls = Array.from(scope.querySelectorAll("button, a[href], input, select, textarea")).filter(seen);
  controls.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) out.small.push({ control: label(el), size: [Math.round(r.width), Math.round(r.height)] });
  });

  // Reachability last, because it scrolls. A control is brought to the
  // middle of the screen first, which is what a person does, so a row
  // that happens to sit under the bottom bar right now is not a fault.
  // What is left is something genuinely covering it.
  const scrolled = window.scrollY;
  controls.forEach((el) => {
    try { el.scrollIntoView({ block: "center", inline: "center" }); } catch (e) {}
    const r = el.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
      out.unreachable.push({ control: label(el), at: [x, y], hit: "off the screen even after scrolling to it" });
      return;
    }
    const hit = document.elementFromPoint(x, y);
    const reached = !!hit && (hit === el || el.contains(hit) || (hit.contains && hit.contains(el)));
    if (!reached) out.unreachable.push({ control: label(el), at: [x, y], hit: hit ? (hit.tagName.toLowerCase() + " " + label(hit)) : "nothing" });
  });
  window.scrollTo(0, scrolled);

  // 4. English on a Spanish screen. Only a string the app itself has a
  // different Spanish word for can be a leak, so an invented name or a
  // form title the stub serves cannot be flagged by accident.
  if (args.language === "es") {
    const set = new Set(leakable);
    const ok = new Set(allowed);
    const walk = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    const hits = new Set();
    let node;
    while ((node = walk.nextNode())) {
      const text = String(node.nodeValue || "").trim();
      if (!text || ok.has(text)) continue;
      if (set.has(text)) hits.add(text);
    }
    // A control's own label, which is often an attribute rather than text.
    controls.forEach((el) => {
      const a = (el.getAttribute("aria-label") || "").trim();
      if (a && !ok.has(a) && set.has(a)) hits.add(a);
      const ph = (el.getAttribute("placeholder") || "").trim();
      if (ph && !ok.has(ph) && set.has(ph)) hits.add(ph);
    });
    out.english = Array.from(hits);
  }

  // 5. The bottom bar, measured on every screen, since two faults have
  // already landed there.
  const bar = Array.from(document.querySelectorAll("div")).find((el) => {
    const s = window.getComputedStyle(el);
    return s.position === "fixed" && s.bottom === "0px" && el.querySelectorAll(":scope > button").length >= 5;
  });
  if (bar) {
    const r = bar.getBoundingClientRect();
    const buttons = Array.from(bar.querySelectorAll(":scope > button")).map(b => b.getBoundingClientRect());
    out.bar = {
      left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
      insideTheScreen: r.left >= -0.5 && r.right <= window.innerWidth + 0.5,
      everyButtonInside: buttons.every(b => b.left >= -0.5 && b.right <= window.innerWidth + 0.5 && b.width > 0),
      buttons: buttons.length,
    };
  }
  return out;
};

// Turns one inspection into failure rows.
function rowsFrom(found, caseName, language, size) {
  const where = caseName + " [" + language + "/" + size + "]";
  const rows = [];
  if (found.missing) { rows.push({ where: where, check: "present", detail: "nothing matched " + found.missing }); return rows; }
  if (found.sideways) rows.push({ where: where, check: "sideways", detail: "scrollWidth " + found.sideways.scrollWidth + " against clientWidth " + found.sideways.clientWidth });
  found.clipped.forEach(c => rows.push({ where: where, check: "clipped", detail: JSON.stringify(c.text) + " cut off by " + c.by }));
  found.unreachable.forEach(u => rows.push({ where: where, check: "covered", detail: JSON.stringify(u.control) + " at " + u.at.join(",") + " hits " + u.hit }));
  found.small.forEach(s => rows.push({ where: where, check: "too small", detail: JSON.stringify(s.control) + " is " + s.size.join(" by ") }));
  (found.english || []).forEach(e => rows.push({ where: where, check: "english", detail: JSON.stringify(e) + " on a Spanish screen" }));
  if (found.bar && (!found.bar.insideTheScreen || !found.bar.everyButtonInside)) {
    rows.push({ where: where, check: "bottom bar", detail: "left " + found.bar.left + " right " + found.bar.right + " against a 375 screen" });
  }
  return rows;
}

module.exports = { INSPECT, rowsFrom };
