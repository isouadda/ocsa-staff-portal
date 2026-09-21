// Every check a screen and sheet is put through, in both languages, at
// all four text sizes, and in light as well as dark.
//
// They run inside the page in one pass, so a screen is measured as a
// person would meet it rather than element by element over many round
// trips.

// Returns { sideways, clipped, unreachable, small, english, contrast,
// lightFaults }. Each is a list of what went wrong, empty when the
// screen is right.
const INSPECT = function (args) {
  const leakable = args.leakable;
  const allowed = args.allowed;
  const scope = args.scope ? document.querySelector(args.scope) : document.body;
  const out = { sideways: null, clipped: [], unreachable: [], small: [], english: [], contrast: [], lightFaults: [] };
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
  const label = (el) => String(el.getAttribute("aria-label") || el.innerText || el.textContent || el.getAttribute("placeholder") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
  const SKIP = { STYLE: 1, SCRIPT: 1, TITLE: 1, NOSCRIPT: 1 };

  // --- color, for the contrast check ----------------------------------
  //
  // Everything here reads what the browser computed, so a color written
  // as a token, as a gradient, or with transparency is measured the way
  // it was actually painted.
  const parseColor = (v) => {
    const m = String(v || "").match(/rgba?\(([^)]*)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(x => x.length).map(parseFloat);
    if (p.length < 3 || p.slice(0, 3).some(n => !isFinite(n))) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 && isFinite(p[3]) ? p[3] : 1 };
  };
  const hex = (c) => "#" + [c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0").toUpperCase()).join("");
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const luminance = (c) => {
    const f = (v) => { const u = v / 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratioOf = (a, b) => {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  // "one, two" at the top level, so a gradient's own commas stay inside it.
  const layersOf = (v) => {
    const parts = [];
    let depth = 0, start = 0;
    for (let i = 0; i < v.length; i += 1) {
      const ch = v[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      else if (ch === "," && depth === 0) { parts.push(v.slice(start, i)); start = i + 1; }
    }
    parts.push(v.slice(start));
    return parts.map(x => x.trim()).filter(x => x.length);
  };

  // What one element paints behind its own text. A gradient is read as
  // its color stops and judged on the worst of them. The last layer is
  // the one under the others, which is the one that covers the whole box
  // wherever this app lays a thin line over a panel.
  const paintOf = (el) => {
    const s = window.getComputedStyle(el);
    if (s.backgroundImage && s.backgroundImage !== "none") {
      const layers = layersOf(s.backgroundImage);
      const stops = (layers[layers.length - 1].match(/rgba?\([^)]*\)/g) || []).map(parseColor).filter(Boolean);
      if (stops.length) return stops;
    }
    const c = parseColor(s.backgroundColor);
    return c && c.a > 0.004 ? [c] : [];
  };

  // Behind the whole page, where nothing else paints.
  const pageBehind = (function () {
    const b = parseColor(window.getComputedStyle(document.body).backgroundColor);
    if (b && b.a > 0.99) return b;
    const h = parseColor(window.getComputedStyle(doc).backgroundColor);
    if (h && h.a > 0.99) return h;
    return { r: 255, g: 255, b: 255, a: 1 };
  })();

  // Every opaque color that can end up behind one element. Anything see
  // through is composited onto what is under it, and the walk stops at
  // the first paint nothing can show through.
  const behind = (el) => {
    const stack = [];
    for (let a = el; a && a !== doc; a = a.parentElement) {
      const paint = paintOf(a);
      if (!paint.length) continue;
      stack.push(paint);
      if (paint.every(c => c.a > 0.99)) break;
    }
    let found = [pageBehind];
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const next = [];
      const add = (c) => { if (next.every(x => hex(x) !== hex(c))) next.push(c); };
      stack[i].forEach((c) => { if (c.a > 0.99) add(c); else found.forEach(b => add(over(c, b))); });
      found = next.slice(0, 6);
    }
    return found;
  };

  // The size on the glass: what the page was written at, times every
  // zoom above it. The text size setting scales the whole app this way.
  const drawnScale = (el) => {
    let z = 1;
    for (let a = el; a; a = a.parentElement) {
      const v = parseFloat(window.getComputedStyle(a).zoom || "1");
      if (v && v !== 1) z *= v;
    }
    return z;
  };

  // What a person would point at. The words themselves are never quoted.
  const roleOf = (el) => {
    const own = el.tagName.toLowerCase();
    let holder = "";
    for (let a = el.parentElement; a && !holder; a = a.parentElement) {
      const tag = a.tagName.toLowerCase();
      if (tag === "button" || tag === "a" || tag === "label" || tag === "li" || tag === "th" || tag === "td") holder = tag;
    }
    return holder ? own + " in a " + holder : own;
  };

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

  // 4. English on a Spanish screen, judged two ways.
  //
  // The first is a leak: a string the app itself has a different Spanish
  // word for, showing in English.
  //
  // The second is the one that catches a word added tomorrow. Every
  // piece of text on a Spanish screen has to be one of four things: a
  // Spanish value out of the app's own table, a value the stub served, a
  // number, or a date or a time the phone's own formatter drew. Anything
  // else is English that never went through the table. The stub's values
  // are known to the suite, so an invented name is never ambiguous.
  if (args.language === "es") {
    const set = new Set(leakable);
    const ok = new Set(allowed);
    const spanish = new Set(args.spanish || []);
    const patterns = (args.patterns || []).map(p => new RegExp(p));
    // A served value is matched on its words rather than letter for
    // letter, since a screen may draw one title cased or with its
    // underscores taken out.
    const plain = (v) => String(v).toLowerCase().replace(/[\s_\u00a0-]+/g, " ").trim();
    const served = new Set((args.served || []).map(plain));
    // The words in a date or a time come from the phone's formatter, not
    // from anything the app chose.
    const DATE_WORD = "ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|lun|mar|mi\u00e9|mie|jue|vie|s\u00e1b|sab|dom|lunes|martes|mi\u00e9rcoles|miercoles|jueves|viernes|s\u00e1bado|sabado|domingo|de|del|a|p|m|h|hrs|am|pm";
    const counted = new RegExp("^(?:[0-9\\s.,:;/()%+#\u00b0\u2013-]|(?:" + DATE_WORD + ")(?![a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]))+$", "i");
    // One piece of text. Under three letters is not a word, which is the
    // same line the leak list draws.
    const one = (text) => text.length < 3 || spanish.has(text) || ok.has(text) || served.has(plain(text))
      || counted.test(text) || patterns.some(re => re.test(text));
    // A line built by joining a value to a word, like a building and its
    // floor, is judged piece by piece.
    const strip = (v) => v.replace(/^[\s|>\u00b7\u2013-]+/, "").replace(/[\s|>\u00b7\u2013-]+$/, "");
    const spoken = (text) => one(text) || strip(text).split(/\s*[>|\u00b7]\s*|\s+[-\u2013]\s+|,\s+/).every(part => !part.trim() || one(part.trim()));

    const walk = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    const hits = new Set();
    const strays = new Set();
    let node;
    while ((node = walk.nextNode())) {
      const parent = node.parentElement;
      if (!parent || SKIP[parent.tagName] || !seen(parent)) continue;
      const text = String(node.nodeValue || "").trim();
      if (!text || ok.has(text)) continue;
      if (set.has(text)) { hits.add(text); continue; }
      if (!spoken(text)) strays.add(text);
    }
    // A control's own label, which is often an attribute rather than text.
    controls.forEach((el) => {
      ["aria-label", "placeholder"].forEach((name) => {
        const v = (el.getAttribute(name) || "").trim();
        if (!v || ok.has(v)) return;
        if (set.has(v)) { hits.add(v); return; }
        if (!spoken(v)) strays.add(v);
      });
    });
    out.english = Array.from(hits);
    out.stray = Array.from(strays);
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

  // 6. Contrast, in every combination, dark included. Every visible piece
  // of text against what is painted behind it. Small text has to clear
  // 4.5 to 1. Text drawn at 24 pixels and up, or at 18.66 and up when it
  // is at weight 600 or more, has to clear 3 to 1. One row per color pair
  // on a screen, since the same pair is usually drawn many times.
  const pairs = {};
  const reading = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
  let piece;
  while ((piece = reading.nextNode())) {
    const el = piece.parentElement;
    if (!el || SKIP[el.tagName] || !seen(el)) continue;
    if (!String(piece.nodeValue || "").trim()) continue;
    const s = window.getComputedStyle(el);
    const ink = parseColor(s.color);
    if (!ink || ink.a < 0.05) continue;
    const px = Math.round(parseFloat(s.fontSize) * drawnScale(el) * 100) / 100;
    const weight = Number(s.fontWeight) || 400;
    const needs = (px >= 24 || (px >= 18.66 && weight >= 600)) ? 3 : 4.5;
    let worst = null;
    behind(el).forEach((bg) => {
      const drawn = ink.a > 0.99 ? ink : over(ink, bg);
      const r = ratioOf(drawn, bg);
      if (!worst || r < worst.r) worst = { r: r, ink: drawn, bg: bg };
    });
    if (!worst || worst.r >= needs) continue;
    const key = hex(worst.ink) + "|" + hex(worst.bg) + "|" + needs;
    if (pairs[key]) continue;
    pairs[key] = 1;
    out.contrast.push({
      ink: hex(worst.ink), behind: hex(worst.bg), ratio: Math.round(worst.r * 100) / 100,
      needs: needs, role: roleOf(el), px: px, weight: weight,
    });
  }

  // 7. Light mode, where the case asked for it. The header is the steel
  // blue and the bar is white, both read off what the browser painted, so
  // a seed the app ignored shows up here as the dark theme's colors. The
  // screens before signing in carry neither, and are not asked for them.
  if (args.light && !args.scope) {
    // The width is read off the document rather than the window, which
    // can be the wider of the two when something overflows, so the header
    // is still found at the Largest size.
    const header = Array.from(document.querySelectorAll("div")).find((el) => {
      const s = window.getComputedStyle(el);
      if (!s.backgroundImage || s.backgroundImage === "none") return false;
      const r = el.getBoundingClientRect();
      return r.top <= 1 && r.width >= doc.clientWidth - 1 && r.height > 20;
    });
    if (header) {
      const painted = paintOf(header).map(hex);
      if (!painted.length || !painted.every(c => c === args.light.header)) {
        out.lightFaults.push({ what: "the header", found: painted.join(" and ") || "nothing", wanted: args.light.header });
      }
    }
    if (bar) {
      const painted = paintOf(bar).map(hex);
      if (painted.length !== 1 || painted[0] !== args.light.bar) {
        out.lightFaults.push({ what: "the bottom bar", found: painted.join(" and ") || "nothing", wanted: args.light.bar });
      }
    }
  }
  return out;
};

// Turns one inspection into failure rows.
function rowsFrom(found, caseName, language, size, theme) {
  const where = caseName + " [" + language + "/" + size + "/" + (theme || "dark") + "]";
  const rows = [];
  if (found.missing) { rows.push({ where: where, check: "present", detail: "nothing matched " + found.missing }); return rows; }
  if (found.sideways) rows.push({ where: where, check: "sideways", detail: "scrollWidth " + found.sideways.scrollWidth + " against clientWidth " + found.sideways.clientWidth });
  found.clipped.forEach(c => rows.push({ where: where, check: "clipped", detail: JSON.stringify(c.text) + " cut off by " + c.by }));
  found.unreachable.forEach(u => rows.push({ where: where, check: "covered", detail: JSON.stringify(u.control) + " at " + u.at.join(",") + " hits " + u.hit }));
  found.small.forEach(s => rows.push({ where: where, check: "too small", detail: JSON.stringify(s.control) + " is " + s.size.join(" by ") }));
  (found.english || []).forEach(e => rows.push({ where: where, check: "english", detail: JSON.stringify(e) + " on a Spanish screen" }));
  (found.stray || []).forEach(e => rows.push({ where: where, check: "not translated", detail: JSON.stringify(e) + " on a Spanish screen is not a Spanish word, a value the stub served, a number, a date or a time" }));
  if (found.bar && (!found.bar.insideTheScreen || !found.bar.everyButtonInside)) {
    rows.push({ where: where, check: "bottom bar", detail: "left " + found.bar.left + " right " + found.bar.right + " against a 375 screen" });
  }
  (found.contrast || []).forEach(c => rows.push({
    where: where, check: "contrast",
    detail: JSON.stringify(c.ink + " on " + c.behind) + " is " + c.ratio.toFixed(2) + " to 1, under the "
      + c.needs + " to 1 it needs at " + c.px + " pixels weight " + c.weight + " (" + c.role + ")",
  }));
  (found.lightFaults || []).forEach(l => rows.push({
    where: where, check: "light mode", detail: l.what + " is " + l.found + ", not " + l.wanted,
  }));
  return rows;
}

module.exports = { INSPECT, rowsFrom };
