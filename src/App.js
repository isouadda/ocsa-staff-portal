import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import clientConfig from './clientConfig';
import { tr, dateLocale, setWordsLanguage } from "./words";
import { BUILD_STAMP } from "./buildStamp";

const API = process.env.REACT_APP_API_URL || "https://ocsa-api-production.up.railway.app";

// The two lines every screen says when a request fails with no sentence of
// its own. A request that never reached OCSA carries no status. The line
// about a sign-in not matching is for the API's own refusal, so a signal
// that dropped is never blamed on the person's PIN.
const ERR_GENERIC = "Something went wrong on our end. Try again in a minute.";
const ERR_OFFLINE = "Could not reach OCSA. Check your connection and try again.";

// Every request to OCSA goes through these two. A request that never gets
// an answer, no signal or the server out of reach, throws the browser's
// own words, which are never the app's, so it says the line every screen
// says for it instead, in the person's language, and still carries no
// status. An answer that cannot be read says the other one.
async function reach(url, init) {
  try { return await fetch(url, init); } catch (e) { throw new Error(ERR_OFFLINE); }
}
async function readJson(res) {
  try { return await res.json(); } catch (e) { const x = new Error(ERR_GENERIC); x.status = res.status; throw x; }
}

// --- Part way through ---------------------------------------------------
// One place that answers whether a person is in the middle of something,
// so the update check has a single thing to ask.
//
// Requests count themselves, since api and uploadPhoto are the only two
// ways this app talks to its API. A screen holding typed text, a picked
// photo or an unsaved answer reports its own key through useBusy. Sheets
// are read straight off the page: every sheet, dialog and confirmation
// here is a fixed box pinned to all four edges, and nothing else is.
let inFlight = 0;
const busyKeys = new Set();
const busyWatchers = new Set();
const notifyBusy = () => { busyWatchers.forEach(fn => { try { fn(); } catch (e) {} }); };
const watchBusy = (fn) => { busyWatchers.add(fn); return () => { busyWatchers.delete(fn); }; };
const flightUp = () => { inFlight += 1; };
const flightDown = () => { inFlight = inFlight > 0 ? inFlight - 1 : 0; notifyBusy(); };

function setBusy(key, on) {
  if (on === busyKeys.has(key)) return;
  if (on) busyKeys.add(key); else busyKeys.delete(key);
  notifyBusy();
}
// Reports one key for as long as the condition holds, and clears it when
// the screen goes away, so a tab change can never leave a key set.
function useBusy(key, on) {
  useEffect(() => { setBusy(key, !!on); }, [key, on]);
  useEffect(() => () => setBusy(key, false), [key]);
}

const UPDATE_BAR_ID = "ocsa-update-bar";

function anySheetOpen() {
  const all = document.querySelectorAll("div");
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el.id === UPDATE_BAR_ID) continue;
    const st = window.getComputedStyle(el);
    if (st.position !== "fixed") continue;
    if (st.top === "0px" && st.left === "0px" && st.right === "0px" && st.bottom === "0px") return true;
  }
  return false;
}

// A field with something in it, under the cursor right now.
function focusHoldsValue() {
  const el = document.activeElement;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return false;
  if (el.type === "checkbox" || el.type === "radio") return false;
  return String(el.value == null ? "" : el.value).length > 0;
}

const somethingIsUnderway = () => busyKeys.size > 0 || inFlight > 0 || anySheetOpen() || focusHoldsValue();

// --- The app keeps itself current ---------------------------------------
// A phone keeps this app open on its home screen for days, so a tab that
// is never closed never asks for index.html again and keeps running the
// bundle it first loaded. The app carries its own stamp, asks the server
// for the current one, and reloads itself when nobody is mid sentence.
const UPDATE_FIRST_MS = 5000;
const UPDATE_PERIOD_MS = 15 * 60 * 1000;
const UPDATE_GAP_MS = 60 * 1000;
const UPDATE_RETEST_MS = 20 * 1000;
const UPDATE_FETCH_MS = 8000;
const UPDATE_TAB_KEY = "ocsa-update-tab";
const UPDATE_TRIED_KEY = "ocsa-update-tried";

const sessionGet = (k) => { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } };
const sessionSet = (k, v) => { try { window.sessionStorage.setItem(k, v); } catch (e) {} };
const sessionDrop = (k) => { try { window.sessionStorage.removeItem(k); } catch (e) {} };

// Nothing here is allowed to make noise. A check that fails, times out or
// answers without a stamp leaves the app exactly as it was.
async function readServerStamp() {
  const base = process.env.PUBLIC_URL || "";
  let timer = null;
  try {
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    if (ctl) timer = setTimeout(() => { try { ctl.abort(); } catch (e) {} }, UPDATE_FETCH_MS);
    const opts = ctl ? { cache: "no-store", signal: ctl.signal } : { cache: "no-store" };
    const res = await fetch(base + "/version.json?t=" + Date.now(), opts);
    if (!res || !res.ok) return null;
    const data = await res.json();
    const stamp = data && typeof data.stamp === "string" ? data.stamp.trim() : "";
    return stamp || null;
  } catch (e) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// The tab is remembered first, so it survives even if the rest throws.
async function clearAndReload(tab, stamp) {
  sessionSet(UPDATE_TAB_KEY, tab || "clock");
  sessionSet(UPDATE_TRIED_KEY, stamp);
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (let i = 0; i < regs.length; i++) { try { await regs[i].unregister(); } catch (e) {} }
    }
  } catch (e) {}
  try {
    if (window.caches && window.caches.keys) {
      const names = await window.caches.keys();
      for (let i = 0; i < names.length; i++) { try { await window.caches.delete(names[i]); } catch (e) {} }
    }
  } catch (e) {}
  try { window.location.reload(); } catch (e) {}
}

function useSelfUpdate(activeTab) {
  // The server's stamp, once it differs from this bundle's.
  const [ahead, setAhead] = useState(null);
  // The bar only appears once a reload has been held back, so an idle
  // app updates with nothing shown and nothing tapped.
  const [showBar, setShowBar] = useState(false);
  const aheadRef = useRef(null);
  const goingRef = useRef(false);
  const lastRef = useRef(0);
  const tabRef = useRef(activeTab);
  useEffect(() => { tabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { aheadRef.current = ahead; }, [ahead]);

  const check = useCallback(async () => {
    lastRef.current = Date.now();
    const stamp = await readServerStamp();
    if (!stamp || stamp === BUILD_STAMP) return;
    setAhead(stamp);
  }, []);

  useEffect(() => {
    const soon = () => { if (!document.hidden) check(); };
    const first = setTimeout(soon, UPDATE_FIRST_MS);
    const iv = setInterval(soon, UPDATE_PERIOD_MS);
    // The one that matters most: a phone on a home screen spends its
    // life hidden, and this is the moment a person looks at it again.
    const onShow = () => { if (!document.hidden && Date.now() - lastRef.current > UPDATE_GAP_MS) check(); };
    const onOnline = () => { check(); };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(first); clearInterval(iv);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("online", onOnline);
    };
  }, [check]);

  const tryNow = useCallback(() => {
    const stamp = aheadRef.current;
    if (!stamp || goingRef.current) return;
    // A reload already happened for this value and the stamps still
    // differ, so reloading again would only loop. Leave the bar up.
    if (sessionGet(UPDATE_TRIED_KEY) === stamp) { setShowBar(true); return; }
    if (somethingIsUnderway()) { setShowBar(true); return; }
    goingRef.current = true;
    clearAndReload(tabRef.current, stamp);
  }, []);

  useEffect(() => {
    if (!ahead) return;
    tryNow();
    const iv = setInterval(tryNow, UPDATE_RETEST_MS);
    const off = watchBusy(tryNow);
    // Closing a sheet is a tap, so one debounced listener catches it
    // without watching the whole page for changes.
    let t = null;
    const onTap = () => { if (t) clearTimeout(t); t = setTimeout(tryNow, 400); };
    document.addEventListener("click", onTap, true);
    return () => { clearInterval(iv); off(); document.removeEventListener("click", onTap, true); if (t) clearTimeout(t); };
  }, [ahead, activeTab, tryNow]);

  const updateNow = useCallback(() => {
    const stamp = aheadRef.current;
    if (!stamp || goingRef.current) return;
    goingRef.current = true;
    clearAndReload(tabRef.current, stamp);
  }, []);

  return { showBar: showBar, updateNow: updateNow };
}

async function uploadPhoto(file, token) {
  const ext = file.name.split(".").pop().toLowerCase();
  flightUp();
  let res;
  try {
    res = await reach(API + "/api/uploads?bucket=issue-photos&ext=" + encodeURIComponent(ext), {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Content-Type": file.type },
      body: file,
    });
  } finally { flightDown(); }
  if (res.status === 401) { window.dispatchEvent(new Event("ocsa-session-expired")); throw new Error("Session expired"); }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || AGENT_PHOTO_FAILED); }
  const data = await readJson(res);
  return data.url;
}

async function uploadTaskMedia(file, token) {
  const ext = file.name.split(".").pop().toLowerCase();
  const res = await reach(API + "/api/uploads?bucket=task-media&ext=" + encodeURIComponent(ext), {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": file.type },
    body: file,
  });
  if (res.status === 401) { window.dispatchEvent(new Event("ocsa-session-expired")); throw new Error("Session expired"); }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || UPLOAD_FAILED); }
  return readJson(res);
}

// Photos sent to the agent from the Help tab. Each one is prepared in the
// browser before it leaves the phone: decoded, drawn to a canvas no larger
// than the agent reads, and exported as JPEG. Re-encoding through a canvas
// drops the location and camera data the phone wrote into the file, which
// is intended. Canvas pixel sizes come from the image, never from layout,
// so the text size zoom on the root element cannot change what is sent.
const AGENT_PHOTO_MAX_EDGE = 1568;
const AGENT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const AGENT_PHOTO_QUALITIES = [0.85, 0.7, 0.5];
const AGENT_PHOTO_LIMIT = 3;
const AGENT_PHOTO_LIMIT_TITLE = "You can send up to 3 photos with one message.";
const AGENT_PHOTO_UNREADABLE = "This photo could not be read here. Choose a JPEG or PNG, or take a screenshot of it.";
// Thrown wherever an upload is refused, so the words and the Spanish
// entry for them cannot drift apart.
const AGENT_PHOTO_FAILED = "Photo upload failed";
// The same, for the two uploads that are not the agent's photo path.
const UPLOAD_FAILED = "Upload failed";

async function decodeAgentPhoto(file) {
  if (typeof window.createImageBitmap === "function") {
    try { return await window.createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) {}
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(AGENT_PHOTO_UNREADABLE)); };
    img.src = url;
  });
}

async function prepareAgentPhoto(file) {
  const src = await decodeAgentPhoto(file);
  const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
  if (!w0 || !h0) throw new Error(AGENT_PHOTO_UNREADABLE);
  // Never enlarged. Only a photo longer than the limit is brought down.
  const scale = Math.min(1, AGENT_PHOTO_MAX_EDGE / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(AGENT_PHOTO_UNREADABLE);
  ctx.drawImage(src, 0, 0, w, h);
  if (typeof src.close === "function") { try { src.close(); } catch (e) {} }
  let blob = null;
  for (let i = 0; i < AGENT_PHOTO_QUALITIES.length; i++) {
    blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", AGENT_PHOTO_QUALITIES[i]));
    if (!blob) throw new Error(AGENT_PHOTO_UNREADABLE);
    if (blob.size <= AGENT_PHOTO_MAX_BYTES) break;
  }
  if (!blob) throw new Error(AGENT_PHOTO_UNREADABLE);
  return blob;
}

// The response carries a storage path and no URL of any kind. The path is
// what goes to the message route; the thumbnail is drawn from memory.
async function uploadAgentPhoto(blob, token) {
  const res = await reach(API + "/api/uploads?bucket=agent-photos&ext=jpg", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/octet-stream" },
    body: blob,
  });
  if (res.status === 401) { window.dispatchEvent(new Event("ocsa-session-expired")); throw new Error("Session expired"); }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || AGENT_PHOTO_FAILED); }
  const data = await res.json().catch(() => null);
  if (!data || !data.path) throw new Error(AGENT_PHOTO_FAILED);
  return data.path;
}

const GOLD = clientConfig.brand.gold, GOLD_LIGHT = "#FCEA4A", GREEN = "#2ECC71", RED = "#E74C3C", ORANGE = "#F39C12", BLUE = "#24A4F4";
const NAVY = clientConfig.brand.navy;
const BLUE_DEEP = clientConfig.brand.blueDeep;
const BLUE_BRIGHT = clientConfig.brand.blueBright;
const GOLD_MID = clientConfig.brand.goldMid;
const PANEL_LIGHT = clientConfig.brand.panelLight;
const SWEEP = "linear-gradient(100deg, " + BLUE_DEEP + " 0%, " + BLUE_BRIGHT + " 28%, #FFFFFF 50%, " + GOLD + " 72%, " + GOLD_MID + " 100%)";
const SWEEP_BAR = "linear-gradient(100deg, " + BLUE_DEEP + " 0%, " + BLUE_BRIGHT + " 30%, " + GOLD + " 70%, " + GOLD_MID + " 100%)";
const SWEEP_LIGHT = "linear-gradient(100deg, #FFFFFF 0%, " + GOLD_LIGHT + " 45%, " + GOLD + " 100%)";

function compressImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (blob) resolve(new File([blob], "photo.jpg", { type: "image/jpeg" }));
        else reject(new Error("Compression failed"));
      }, "image/jpeg", quality || 0.8);
    };
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = URL.createObjectURL(file);
  });
}
const LOGO_SM = process.env.PUBLIC_URL + "/ocsa-logo-sm.png";
const LOGO_LG = process.env.PUBLIC_URL + "/ocsa-logo.png";

// The phone's own typeface, the stack the install sheet already uses. On
// an iPhone that is the system face and on Android it is Roboto, so the
// first screen draws with nothing downloaded. The logo carries the brand.
// Both names stay, so every screen keeps saying which of the two it means.
const SYSTEM_STACK = "-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_HEAD = SYSTEM_STACK;
const FONT_BODY = SYSTEM_STACK;
const R = { sm: 8, md: 10, lg: 14, pill: 999 };

const DARK = {
  bg: NAVY, card: "#132240", cardAlt: "#1B3058", border: "rgba(255,255,255,0.06)", borderSolid: "#1B3058",
  text: "#F8F7F4", textSec: "#A8B8C8", textMut: "#8899AA", inputBg: "rgba(255,255,255,0.04)", inputBorder: "#1B3058",
  hover: "rgba(255,255,255,0.02)", goldBg: "rgba(231,176,23,0.12)", goldBorder: "rgba(231,176,23,0.25)",
  shadow: "0 4px 20px rgba(0,0,0,0.30)", popShadow: "0 18px 50px rgba(0,0,0,0.55)",
  modalOverlay: "rgba(0,0,0,0.7)", headerBg: NAVY, headerBg2: "#132240",
  scrollThumb: "#1B3058", greenSubtle: "rgba(46,204,113,0.06)", greenBorder: "rgba(46,204,113,0.15)",
  blueSubtle: "rgba(36,164,244,0.06)", blueBorder: "rgba(36,164,244,0.15)",
  navBg: "#132240", navBorder: "#1B3058",
  btnGhost: "#1B3058", redSubtle: "rgba(231,76,60,0.06)", redBorder: "rgba(231,76,60,0.2)",
  orangeSubtle: "rgba(243,156,18,0.08)", orangeBorder: "rgba(243,156,18,0.2)",
  goldSubtle: "rgba(231,176,23,0.06)", goldText: GOLD,
  // The unread count. Dark draws the red it has always drawn.
  badgeBg: RED,
};
const LIGHT = {
  bg: "#F4F7FB", card: "#FFFFFF", cardAlt: "#EEF3F9", border: "#E4EAF2", borderSolid: "#D2DBE6",
  text: NAVY, textSec: "#4A5C70", textMut: "#5F6E7F", inputBg: "#FFFFFF", inputBorder: "#D2DBE6",
  hover: "#F0F5FC", goldBg: "rgba(231,176,23,0.08)", goldBorder: "rgba(231,176,23,0.35)",
  shadow: "0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)", popShadow: "0 18px 45px rgba(16,24,40,0.18)",
  modalOverlay: "rgba(0,0,0,0.4)", headerBg: PANEL_LIGHT, headerBg2: PANEL_LIGHT,
  scrollThumb: "#C6D2E0", greenSubtle: "rgba(46,204,113,0.06)", greenBorder: "rgba(46,204,113,0.15)",
  blueSubtle: "rgba(36,164,244,0.06)", blueBorder: "rgba(36,164,244,0.15)",
  navBg: "#FFFFFF", navBorder: "#E4EAF2",
  btnGhost: "#E7EDF5", redSubtle: "rgba(231,76,60,0.06)", redBorder: "rgba(231,76,60,0.15)",
  orangeSubtle: "rgba(243,156,18,0.06)", orangeBorder: "rgba(243,156,18,0.15)",
  goldSubtle: "rgba(231,176,23,0.06)", goldText: "#8A5F10",
  // A deeper red, so a white numeral on it reads at 5.62 to 1 where the
  // red above it and an off white numeral read at 3.57.
  badgeBg: "#C62828",
};

// The numeral on a badge: white on light mode's deeper red, and the off
// white the dark theme draws everywhere else.
const badgeInk = (th) => (th.badgeBg === LIGHT.badgeBg ? "#FFFFFF" : "#F8F7F4");

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (opts.token) headers["Authorization"] = "Bearer " + opts.token;
  flightUp();
  let res;
  try {
    res = await reach(API + path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  } finally { flightDown(); }
  if (res.status === 401 && !opts.noAuthEvent) { window.dispatchEvent(new Event("ocsa-session-expired")); throw new Error("Session expired"); }
  if (!res.ok) { const err = await res.json().catch(() => ({ error: "Request failed" })); const e = new Error(err.error || "Request failed"); e.status = res.status; e.code = err.code || null; e.body = err; throw e; }
  return readJson(res);
}

const formatTime = (d) => new Date(d).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit", hour12: true });
const formatDate = (d) => new Date(d).toLocaleDateString(dateLocale(), { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const formatDayShort = (d) => new Date(d).toLocaleDateString(dateLocale(), { weekday: "short", month: "short", day: "numeric" });
// Same calendar day on the person's own clock, never UTC. A shift that
// started at 11 PM last night has to say so at 1 AM.
const sameLocalDay = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };
const now = () => new Date();

// ------------------------------------------------------------
// Calendar dates, read and written locally
//
// A YYYY-MM-DD string handed to new Date() is read as UTC midnight,
// which is the evening before in Philadelphia, so the date shows a
// day early. These read the parts and build a local date instead.
// Today comes from the phone's own calendar rather than
// toISOString, which gives tomorrow after 8 PM here.
// ------------------------------------------------------------
function localDay(ymd) {
  const p = String(ymd || "").split("-");
  if (p.length !== 3) return null;
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return isNaN(d.getTime()) ? null : d;
}
function todayLocal() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function ymdLocal(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
// Every day from one YYYY-MM-DD to another, inclusive, as strings.
function daySpan(startYmd, endYmd) {
  const a = localDay(startYmd), b = localDay(endYmd) || localDay(startYmd);
  if (!a || !b) return [];
  const out = [];
  for (let d = a; d <= b && out.length < 400; d = addDays(d, 1)) out.push(ymdLocal(d));
  return out;
}

// ------------------------------------------------------------
// Time off
// ------------------------------------------------------------
const TIME_OFF_MIN_BACK = 30;
const TIME_OFF_MAX_AHEAD = 365;
const TIME_OFF_PAGE = 50;
// A colour the calendar does not already use for Scheduled, Worked
// or Pickup, and readable on both themes.
const TIME_OFF_COLOR = "#8E6FD8";
const timeOffStatusColor = (status, t) => (
  status === "approved" ? GREEN :
  status === "denied" ? RED :
  status === "cancelled" ? t.textMut : ORANGE
);
const timeOffStatusWord = (status) => (
  status === "approved" ? tr("Approved") :
  status === "denied" ? tr("Denied") :
  status === "cancelled" ? tr("Cancelled") : tr("Requested")
);
// One day reads as its own date. A range says both ends, and drops
// the repeated year only when both ends share one.
function timeOffDates(startsOn, endsOn) {
  const a = localDay(startsOn);
  if (!a) return "";
  const b = localDay(endsOn) || a;
  const full = { month: "short", day: "numeric", year: "numeric" };
  const noYear = { month: "short", day: "numeric" };
  if (ymdLocal(a) === ymdLocal(b)) return a.toLocaleDateString(dateLocale(), full);
  if (a.getFullYear() === b.getFullYear()) {
    return tr("{start} to {end}, {year}", {
      start: a.toLocaleDateString(dateLocale(), noYear),
      end: b.toLocaleDateString(dateLocale(), noYear),
      year: String(a.getFullYear()),
    });
  }
  return tr("{start} to {end}", {
    start: a.toLocaleDateString(dateLocale(), full),
    end: b.toLocaleDateString(dateLocale(), full),
  });
}
const timeOffHours = (h) => {
  if (h === null || h === undefined || h === "") return null;
  const n = Number(h);
  if (!isFinite(n)) return null;
  const shown = String(Math.round(n * 100) / 100);
  return n === 1 ? tr("{n} hour", { n: shown }) : tr("{n} hours", { n: shown });
};

// --- Codes, put into words ---------------------------------------------
const titleCase = (code) => String(code || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
const ROLE_WORDS = {
  custodian: () => tr("Custodian"), custodial_lead: () => tr("Custodial Lead"), lead: () => tr("Lead"),
  supervisor: () => tr("Supervisor"), admin: () => tr("Admin"),
};
const roleWord = (code) => (ROLE_WORDS[code] ? ROLE_WORDS[code]() : titleCase(code));
// A shift, a pickup, an inspection, an assigned task or a reported issue.
const STATUS_WORDS = {
  scheduled: () => tr("Scheduled"), completed: () => tr("Completed"), pending: () => tr("Pending"),
  claimed: () => tr("Claimed"), filled: () => tr("Filled"), approved: () => tr("Approved"), denied: () => tr("Denied"),
  cancelled: () => tr("Cancelled"), in_progress: () => tr("In Progress"), resolved: () => tr("Resolved"),
  unable_to_resolve: () => tr("Unable to resolve"), open: () => tr("Open"), closed: () => tr("Closed"),
};
const statusWord = (code) => (STATUS_WORDS[code] ? STATUS_WORDS[code]() : titleCase(code));
// A severity or a priority.
const LEVEL_WORDS = { low: () => tr("Low"), medium: () => tr("Medium"), high: () => tr("High"), critical: () => tr("Critical") };
const levelWord = (code) => (LEVEL_WORDS[code] ? LEVEL_WORDS[code]() : code);
// Where an open shift came from.
const ORIGIN_WORDS = {
  callout: () => tr("Callout"), no_show: () => tr("No-Show"), extra_coverage: () => tr("Extra Coverage"),
  voluntary_drop: () => tr("Voluntary Drop"), new_shift: () => tr("New Shift"),
};
// The word in the toast that says what an assigned task became.
const taskStatusWord = (s) => (s === "in_progress" ? tr("in progress") : s === "resolved" ? tr("resolved") : s === "unable_to_resolve" ? tr("unable to resolve") : tr(String(s).replace(/_/g, " ")));
// A time of day the API sends as HH:MM or HH:MM:SS, drawn the way every
// other time is, in the reader's language. Anything else is drawn as sent.
function clockTime(v) {
  const m = String(v || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(v || "");
  return new Date(2024, 0, 1, Number(m[1]), Number(m[2])).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" });
}

const Ico = ({ d, sz = 18, c = "currentColor", style: s, ...p }) => (<svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} {...p}><path d={d} /></svg>);
const ClockIco = (p) => <Ico d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 0v10l4 4" {...p} />;
const CheckIco = (p) => <Ico d="M20 6L9 17l-5-5" {...p} />;
const AlertIco = (p) => <Ico d="M12 2L2 22h20L12 2zm0 7v5m0 3h.01" {...p} />;
const BoxIco = (p) => <Ico d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" {...p} />;
const MapIco = (p) => <Ico d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" {...p} />;
const CamIco = (p) => <Ico d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" {...p} />;
const ChatIco = (p) => <Ico d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...p} />;
const SendIco = (p) => <Ico d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" {...p} />;
const LogOutIco = (p) => <Ico d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" {...p} />;
const MinusIco = (p) => <Ico d="M5 12h14" {...p} />;
const PlusIco = (p) => <Ico d="M12 5v14M5 12h14" {...p} />;
const ChevIco = (p) => <Ico d="M9 18l6-6-6-6" {...p} />;
const SunIco = (p) => <Ico d="M12 3v1m0 16v1m-8-9H3m18 0h-1m-2.636-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" {...p} />;
const MoonIco = (p) => <Ico d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" {...p} />;
const WrkIco = (p) => <Ico d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" {...p} />;
const ClipIco = (p) => <Ico d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 12l2 2 4-4" {...p} />;
const SwapIco = (p) => <Ico d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" {...p} />;
const CalIco = (p) => <Ico d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18" {...p} />;
const HomeIco = (p) => <Ico d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...p} />;
const HelpIco = (p) => <Ico d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" {...p} />;
const GlobeIco = (p) => <Ico d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" {...p} />;
const PersonIco = (p) => <Ico d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" {...p} />;
const GearIco = (p) => <Ico d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" {...p} />;
const BellIco = (p) => <Ico d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" {...p} />;
const DocIco = (p) => <Ico d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4" {...p} />;
const LockIco = ({ sz = 12, c = BLUE }) => (<svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>);

// Every destination the portal has, in one list, so the bottom bar and the
// More overlay cannot drift apart. Labels, icons and role conditions are
// exactly what they were when the bar was the same for everyone. Home is
// always the first place on the bar and is never one of the four choices.
// A destination added here later appears under More on its own.
const DESTINATIONS = [
  { id: "clock", label: () => "Home", icon: HomeIco, home: true },
  { id: "schedule", label: () => "Schedule", icon: CalIco },
  { id: "tasks", label: () => "Tasks", icon: CheckIco },
  { id: "chat", label: () => "Chat", icon: ChatIco },
  { id: "agent", label: () => "Help", icon: HelpIco },
  { id: "issuetasks", label: () => "Assigned", icon: WrkIco, badge: "assigned" },
  { id: "issues", label: (ctx) => ctx.isAdmin ? "Issues" : "Report", icon: AlertIco },
  { id: "supplies", label: () => "Supplies", icon: BoxIco },
  { id: "pickup", label: () => "Pickup", icon: SwapIco },
  { id: "inspect", label: () => "Inspect", icon: ClipIco },
  { id: "speakup", label: () => "Speak Up", icon: PersonIco },
  { id: "settings", label: () => "Settings", icon: GearIco },
  { id: "forms", label: () => "Forms", icon: DocIco },
];
const destById = (id) => DESTINATIONS.find(d => d.id === id) || null;

// The four places between Home and More. The default is the bar as it was:
// Schedule, Tasks, Chat, Help, which leaves the same six under More in the
// same order.
const SHORTCUT_SLOTS = 4;
const DEFAULT_SHORTCUTS = ["schedule", "tasks", "chat", "agent"];
const SHORTCUTS_KEY_PREFIX = "ocsa-staff-shortcuts:";
const shortcutsKey = (userId) => SHORTCUTS_KEY_PREFIX + String(userId || "");

// Which destinations this person may put on the bar. Home is not one of
// them, and a destination their role cannot open is not either.
function shortcutChoicesFor(ctx) {
  return DESTINATIONS.filter(d => !d.home && (!d.role || d.role(ctx)));
}

// A stored layout is trusted only if it is exactly four known, distinct ids
// this person can open. Anything else reads as null, and the caller falls
// back to the default.
function validShortcuts(value, allowedIds) {
  if (!Array.isArray(value) || value.length !== SHORTCUT_SLOTS) return null;
  const seen = {};
  for (let i = 0; i < value.length; i++) {
    const id = value[i];
    if (typeof id !== "string") return null;
    if (allowedIds.indexOf(id) === -1) return null;
    if (seen[id]) return null;
    seen[id] = true;
  }
  return value.slice();
}

// Kept per person, so two people signing in on the same phone each keep
// their own. Every read and write in try and catch, the same pattern as
// Text size; a storage that throws means the default.
function readShortcuts(userId, allowedIds) {
  try {
    const raw = window.localStorage.getItem(shortcutsKey(userId));
    if (!raw) return DEFAULT_SHORTCUTS.slice();
    return validShortcuts(JSON.parse(raw), allowedIds) || DEFAULT_SHORTCUTS.slice();
  } catch (e) { return DEFAULT_SHORTCUTS.slice(); }
}
// The raw list this device saved, before any role check, so the sync can
// see whether this device ever had one.
function storedShortcuts(userId) {
  try {
    var raw = window.localStorage.getItem(shortcutsKey(userId));
    if (!raw) return null;
    var v = JSON.parse(raw);
    return Array.isArray(v) ? v : null;
  } catch (e) { return null; }
}
function saveShortcuts(userId, ids) {
  try { window.localStorage.setItem(shortcutsKey(userId), JSON.stringify(ids)); } catch (e) {}
}

const SHORTCUTS_CARD_LINE = "Choose what sits on your bottom bar. Everything else is under More.";
const SHORTCUTS_EMPTY_SLOT = "Pick something for this spot";

// The smallest a control may be, either way, at every text size. It is
// the size Apple asks for and the size someone with poor sight can hit.
const TAP = 44;
// A control whose drawing is meant to stay smaller than that. The button
// becomes a see-through frame of at least 44 by 44 and the look moves to
// the span inside it, so the tap area grows and the drawing does not.
const mkTapFrame = (extra) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: TAP, minHeight: TAP, padding: 0, background: "none", border: "none", cursor: "pointer", ...(extra || {}) });

const mkLabel = (t) => ({ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 600, marginBottom: 6, display: "block", fontFamily: FONT_HEAD });
const mkInput = (t) => ({ width: "100%", minHeight: TAP, padding: "11px 14px", borderRadius: R.md, border: "1px solid " + t.inputBorder, background: t.inputBg, color: t.text, fontSize: 14, outline: "none", fontFamily: FONT_BODY });
const mkSmallPill = (t) => ({ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid " + t.border, borderRadius: 8, padding: "6px 14px", color: t.textMut, fontSize: 11 });
const mkQtyBtn = (t) => ({ width: 36, height: 36, borderRadius: "50%", border: "1px solid " + t.borderSolid, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.text });

const SUPPORT_LINE = "Contact your supervisor to have a new link sent.";
const PIN_RE = /^[0-9]{4}$/;
const PIN_INPUT_PROPS = { type: "password", inputMode: "numeric", pattern: "[0-9]*", maxLength: 4, autoComplete: "off" };
const mkPinInput = (t) => ({ ...mkInput(t), letterSpacing: "8px", textAlign: "center", fontSize: 20 });
const mkFieldErr = (t) => ({ fontSize: 11, color: RED, marginTop: 6, lineHeight: 1.4 });
const mkHelp = (t) => ({ fontSize: 11, color: t.textMut, marginTop: 6, lineHeight: 1.4 });
const mkPrimaryBtn = (t, busy) => ({ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, " + GOLD + ", " + GOLD_LIGHT + ")", color: NAVY, fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: busy ? 0.6 : 1, boxShadow: "0 6px 18px rgba(231,176,23,0.30)", fontFamily: FONT_HEAD });
const mkGhostBtn = (t) => ({ width: "100%", minHeight: TAP, padding: "12px", marginTop: 12, borderRadius: 10, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec, fontSize: 13, cursor: "pointer" });
const mkCardText = (t) => ({ fontSize: 14, color: t.text, lineHeight: 1.55, marginBottom: 14 });

// Weak PIN rules, client side. The API checks shape only. Returns a
// message naming what is wrong, or null when the PIN is acceptable.
function weakPinReason(pin, badgeNumber) {
  if (!PIN_RE.test(pin)) return tr("PIN must be exactly 4 digits.");
  if (/^([0-9])\1{3}$/.test(pin)) return tr("Four of the same digit is too easy to guess. Use a mix of digits.");
  var d = pin.split("").map(Number);
  var up = true, down = true;
  for (var i = 1; i < 4; i++) {
    if ((d[i] - d[i - 1] + 10) % 10 !== 1) up = false;
    if ((d[i - 1] - d[i] + 10) % 10 !== 1) down = false;
  }
  if (up || down) return tr("Digits in a row, like 1234 or 4321, are too easy to guess. Use a different order.");
  var badge = badgeNumber ? String(badgeNumber).trim() : "";
  if (badge && (pin === badge || pin === badge.slice(-4))) return tr("Your PIN cannot be your badge number or its last four digits.");
  return null;
}

// Entry from an emailed link. Read once at module scope, before the
// first render, so it stays out of the render path.
function readEntryFromUrl() {
  try {
    var path = String(window.location.pathname || "").replace(/\/+$/, "").toLowerCase();
    var token = new URLSearchParams(window.location.search || "").get("token");
    if (path === "/activate") return { screen: "activate", token: token || null };
    if (path === "/reset-pin") return { screen: "reset", token: token || null };
    return null;
  } catch (e) { return null; }
}
const ENTRY = readEntryFromUrl();
if (ENTRY && ENTRY.token) {
  try { window.history.replaceState({}, "", window.location.pathname); } catch (e) {}
}
// Once the person leaves an entry screen, the address bar goes back to
// the root so a later reload boots the stored session instead of the
// incomplete-link card.
function leaveEntryPath() {
  if (!ENTRY) return;
  try { window.history.replaceState({}, "", "/"); } catch (e) {}
}

// Session persistence. Only the JWT and the time it was saved. Never
// the PIN, the identifier, or anything from the user record.
const AUTH_KEY = "ocsa_auth";
const AUTH_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function saveAuth(tok) {
  try { window.localStorage.setItem(AUTH_KEY, JSON.stringify({ token: tok, savedAt: Date.now() })); } catch (e) {}
}
function readAuth() {
  try {
    var raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    var p = JSON.parse(raw);
    if (!p || !p.token) return null;
    if (!p.savedAt || (Date.now() - p.savedAt) > AUTH_MAX_AGE_MS) return null;
    return p.token;
  } catch (e) { return null; }
}
function clearAuth() {
  try { window.localStorage.removeItem(AUTH_KEY); } catch (e) {}
}

// Text size. One setting scales the whole page, so a person who cannot
// read 10 pixel type can read every screen without the thousands of
// inline sizes being rewritten. Kept on the device, never sent anywhere.
const THEME_KEY = "ocsa-staff-theme";
function storedTheme() {
  try { var v = window.localStorage.getItem(THEME_KEY); return (v === "light" || v === "dark") ? v : null; } catch (e) { return null; }
}
function saveTheme(v) { try { window.localStorage.setItem(THEME_KEY, v); } catch (e) {} }
// Until a person chooses, the app opens the way their phone is set. A
// choice made here, or one the account carries, still wins. The frame
// before React loads is painted from these same two answers by the small
// script at the top of public/index.html, so nothing flashes.
function phoneTheme() {
  try { return (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark"; } catch (e) { return "dark"; }
}
function firstTheme() { return storedTheme() || phoneTheme(); }

// The language every screen reads, Help answers in and the report forms
// ask their questions in. A choice stored on this phone wins. Until there
// is one the phone's own language decides, the way the theme follows the
// phone until a person picks one, so a phone set to Spanish opens the
// portal in Spanish from its very first screen. An account's own value
// still arrives with signing in and applies the way it always has. The
// small script at the top of public/index.html reads these same two
// answers, so the page is marked with its language from the first frame.
const LANGUAGE_KEY = "ocsa-staff-language";
const LANGUAGES = [{ id: "en", label: "English" }, { id: "es", label: "Espa\u00f1ol" }];
function storedLanguage() {
  try { var v = window.localStorage.getItem(LANGUAGE_KEY); return (v === "en" || v === "es") ? v : null; } catch (e) { return null; }
}
function phoneLanguage() {
  try {
    var first = (navigator.languages && navigator.languages[0]) || navigator.language || "";
    return /^es\b/i.test(String(first)) ? "es" : "en";
  } catch (e) { return "en"; }
}
function firstLanguage() { return storedLanguage() || phoneLanguage(); }
// The seven calls made before anyone is signed in carry the language on
// the screen. The API answers them in the language the request asks for,
// ?locale= first and the browser's own language after it, so without this
// a phone set to Spanish would get Spanish refusals on a screen set to
// English, and the other way round.
function signedOut(path, language) {
  return path + (path.indexOf("?") === -1 ? "?" : "&") + "locale=" + (language === "es" ? "es" : "en");
}
function saveLanguage(v) { try { window.localStorage.setItem(LANGUAGE_KEY, v); } catch (e) {} }

// Settings belong to the account once the API carries them. Until then each
// device works on its own exactly as before, and nothing is sent anywhere.
const PREF_KEYS = ["shortcuts", "textSize", "theme", "language"];
const PREFS_PENDING_PREFIX = "ocsa-staff-prefs-pending:";
const prefsPendingKey = (userId) => PREFS_PENDING_PREFIX + String(userId || "");
function readPendingPrefs(userId) {
  try {
    var raw = window.localStorage.getItem(prefsPendingKey(userId));
    var a = raw ? JSON.parse(raw) : null;
    return Array.isArray(a) ? a.filter(k => PREF_KEYS.indexOf(k) !== -1) : [];
  } catch (e) { return []; }
}
function savePendingPrefs(userId, keys) {
  try {
    if (!keys || keys.length === 0) window.localStorage.removeItem(prefsPendingKey(userId));
    else window.localStorage.setItem(prefsPendingKey(userId), JSON.stringify(keys));
  } catch (e) {}
}

const TEXT_SIZE_KEY = "ocsa-staff-text-size";
const TEXT_SIZES = [
  { id: "standard", label: "Standard", zoom: 1 },
  { id: "large", label: "Large", zoom: 1.15 },
  { id: "xlarge", label: "Extra large", zoom: 1.3 },
  { id: "largest", label: "Largest", zoom: 1.5 },
];
const zoomOf = (id) => (TEXT_SIZES.find(s => s.id === id) || TEXT_SIZES[0]).zoom;
// A label on the bottom bar stops growing at the Large size, so every
// label still fits on one line in both languages at every size. The root
// carries the zoom, so dividing by it leaves the label drawn at the Large
// size and no larger. The icons and the tap areas keep scaling with the
// rest of the app, which is how the phone's own tab bar behaves.
const barFontSize = (px, zoom) => px * Math.min(zoom, zoomOf("large")) / zoom;
// The shift timer is eight characters at 40 pixels inside a card no wider
// than the screen. Past the Extra large size a typeface with wide digits
// draws it wider than the card and the screen scrolls sideways, so it
// stops growing there, the same way. At the Largest size it is still
// drawn at 52 pixels against the 40 it draws at Standard.
const timerFontSize = (px, zoom) => px * Math.min(zoom, zoomOf("xlarge")) / zoom;
// Read before the first render. An unreadable or unknown value is Standard.
function readTextSize() {
  try {
    var v = window.localStorage.getItem(TEXT_SIZE_KEY);
    return TEXT_SIZES.some(s => s.id === v) ? v : "standard";
  } catch (e) { return "standard"; }
}
function storedTextSize() {
  try {
    var v = window.localStorage.getItem(TEXT_SIZE_KEY);
    return TEXT_SIZES.some(s => s.id === v) ? v : null;
  } catch (e) { return null; }
}
function saveTextSize(id) {
  try { window.localStorage.setItem(TEXT_SIZE_KEY, id); } catch (e) {}
}
// The install sheet renders beside the app rather than inside it, so it
// reads the setting here and puts the same zoom on its own root.
export const storedZoom = () => zoomOf(readTextSize());
// zoom scales lengths, so a height written against the viewport has to be
// divided by it or the screen grows past the bottom of the phone. These
// two are set on the scaled root and read by the screens that fill the
// window. At Standard they are exactly 100vh and 100dvh.
function viewportVars(z) {
  return { "--ocsa-vh": "calc(100vh / " + z + ")", "--ocsa-dvh": "calc(100dvh / " + z + ")" };
}
// The header and the bottom bar are measured on the screen, not guessed,
// because the header is one row at the two smaller text sizes and two at
// the larger ones, and no single number is right at all four. These two
// are written beside the pair above, in the page's own pixels rather than
// the screen's, so the zoom is divided out the same way.
//
//   --ocsa-chrome  the header and the bar together, what the three pages
//                  that fill the window subtract
//   --ocsa-bar     the bar alone, what the page leaves below its content
//                  so a screen that scrolls can clear it
function chromeVars(headerPx, barPx, z) {
  if (!(headerPx > 0) || !(barPx > 0)) return {};
  return { "--ocsa-chrome": (headerPx + barPx) / z + "px", "--ocsa-bar": barPx / z + "px" };
}
// Until the two have been measured, and anywhere ResizeObserver is
// missing, the three pages fall back to this. It is the tallest the pair
// was ever measured at, so nothing runs past the bottom of the phone
// before the real value lands.
const CHROME_FALLBACK = 197;
const fillsTheWindow = () => ({
  height: "calc(var(--ocsa-vh, 100vh) - var(--ocsa-chrome, " + CHROME_FALLBACK + "px))",
  maxHeight: "calc(var(--ocsa-dvh, 100dvh) - var(--ocsa-chrome, " + CHROME_FALLBACK + "px))",
});

// The setting reaches the sign-in screens and Profile through context, so
// no screen has to thread it down.
const TextSizeCtx = createContext({ textSize: "standard", setTextSize: () => {} });
// The language, and the way to change it, reach them the same way.
const LanguageCtx = createContext({ language: "en", setLanguage: () => {} });

// The four choices, as buttons. Used on the sign-in screens and in Profile.
function TextSizeChoices({ value, onChange, t }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {TEXT_SIZES.map(s => {
        const picked = value === s.id;
        return (
          <button key={s.id} type="button" onClick={() => onChange(s.id)} style={{
            display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 44, padding: "10px 14px",
            borderRadius: R.md, cursor: "pointer", textAlign: "left",
            background: picked ? t.goldBg : t.card, border: picked ? "1.5px solid " + GOLD : "1px solid " + t.borderSolid, color: t.text,
          }}>
            <div style={{ width: 18, height: 18, flexShrink: 0, borderRadius: "50%", background: picked ? GOLD : "transparent", border: picked ? "none" : "2px solid " + t.borderSolid }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: picked ? 600 : 500, fontFamily: FONT_HEAD }}>{tr(s.label)}</span>
          </button>
        );
      })}
    </div>
  );
}

// The sign-in screens open the choices in a sheet, so the card itself
// keeps its shape. Closing it is a tap anywhere outside or Done.
function TextSizeButton({ t }) {
  const { textSize: value, setTextSize: onChange } = useContext(TextSizeCtx);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={mkTapFrame()}>
        <span style={mkSmallPill(t)}><span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1 }}>{tr("A")}</span>{tr("Text size")}</span>
      </button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.modalOverlay, zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: "16px 16px 0 0", border: "1px solid " + t.borderSolid, width: "100%", maxWidth: 560, padding: "18px 18px 26px", boxShadow: t.popShadow, textAlign: "left" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: t.textMut, margin: "0 auto 14px", opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 4, fontFamily: FONT_HEAD }}>{tr("Text size")}</div>
            <div style={{ fontSize: 12, color: t.textSec, marginBottom: 14, lineHeight: 1.4 }}>{tr("Makes everything in the app bigger on this phone.")}</div>
            <TextSizeChoices value={value} onChange={onChange} t={t} />
            <button type="button" onClick={() => setOpen(false)} style={{ width: "100%", minHeight: 44, marginTop: 14, borderRadius: R.md, border: "1px solid " + t.borderSolid, background: "transparent", color: t.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Done")}</button>
          </div>
        </div>
      )}
    </>
  );
}

// The screens before signing in offer the other language beside the text
// size and the theme, named in its own language so a person who reads
// only that one can find it. One tap turns every screen at once and is
// kept on this phone, the same as a choice made in Settings.
function LanguageButton({ t }) {
  const { language, setLanguage } = useContext(LanguageCtx);
  const other = LANGUAGES.find(l => l.id !== language) || LANGUAGES[0];
  return (
    <button type="button" onClick={() => setLanguage(other.id)} style={mkTapFrame()}>
      <span lang={other.id} style={mkSmallPill(t)}><GlobeIco sz={14} c={t.textMut} />{other.label}</span>
    </button>
  );
}

export default function OCSAStaffPortal() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [sites, setSites] = useState([]);
  const [screen, setScreen] = useState(ENTRY ? ENTRY.screen : "login");
  const [booting, setBooting] = useState(!ENTRY && !!readAuth());
  const [activeTab, setActiveTab] = useState("clock");
  const [clockStatus, setClockStatus] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [sessionSites, setSessionSites] = useState(null);
  // A site that is chosen and not yet started. selectedSite means the
  // open session's site and is read in several places, so the pending
  // choice gets its own name. Cleared on start, on end, and on sign out.
  const [pendingSite, setPendingSite] = useState(null);
  // The notice shown when Start is refused because a shift is still open
  // somewhere. Cleared on the next choice, start, or end.
  const [startBlock, setStartBlock] = useState(null);
  // null until the site's list has come back, so the Tasks tab can tell
  // a list still loading from a building with no checklist.
  const [tasks, setTasks] = useState(null);
  // The fetch came back empty-handed. Separate from tasks staying null,
  // which is a list still on its way.
  const [tasksFailed, setTasksFailed] = useState(false);
  const [completedTaskIds, setCompletedTaskIds] = useState(new Set());
  // Which server list fills the checklist. True reads the building's list,
  // so a task ticked by anyone on site today shows as ticked to everyone
  // there. False reads only this person's own ticks. Flipping it is one word.
  const SHARED_SITE_CHECKLIST = true;
  // Every clock status request takes a number and only the newest one may
  // fill the Set. An older response landing late would otherwise clear a
  // box that was ticked after it was requested.
  const statusSeq = useRef(0);
  const nextStatusSeq = () => ++statusSeq.current;
  const hydrateCompleted = (cs, seq) => {
    if (seq !== statusSeq.current) return;
    const tk = cs ? cs.tasks : null;
    const ids = tk ? (SHARED_SITE_CHECKLIST ? tk.siteCompletedTaskIds : tk.completedTaskIds) : null;
    setCompletedTaskIds(new Set(Array.isArray(ids) ? ids : []));
  };
  // Task ids with a tick or untick request in flight. A second tap on the
  // same task is ignored until the first answers. Other tasks stay tappable.
  const inFlightTaskIds = useRef(new Set());
  const [issues, setIssues] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [supplyLogs, setSupplyLogs] = useState([]);
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [currentTime, setCurrentTime] = useState(now());
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lookups, setLookups] = useState([]);
  const queuePrefRef = useRef(null);
  const queuePref = (changed) => { if (queuePrefRef.current) queuePrefRef.current(changed); };
  const applyPrefsRef = useRef(null);
  // A preference chosen on the way in, before this person has an id to
  // mark it pending against. The merge below treats it the way it
  // treats any key still on its way up to the account.
  const chosenOnEntryRef = useRef(null);
  const [themeMode, setThemeMode] = useState(firstTheme);
  const t = themeMode === "light" ? LIGHT : DARK;
  // The header and the bar, as the screen actually draws them. A
  // ResizeObserver on each catches the header taking a second row at the
  // larger text sizes, a language whose words run longer, and anything a
  // later build puts in either of them.
  const headerRef = useRef(null);
  const barRef = useRef(null);
  const [chrome, setChrome] = useState({ header: 0, bar: 0 });
  useEffect(() => {
    const read = () => {
      const h = headerRef.current ? headerRef.current.getBoundingClientRect().height : 0;
      const b = barRef.current ? barRef.current.getBoundingClientRect().height : 0;
      // Nothing is written back unless the screen really moved, so a
      // measurement can never set off another one.
      setChrome(was => (Math.abs(was.header - h) < 0.5 && Math.abs(was.bar - b) < 0.5) ? was : { header: h, bar: b });
    };
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const watch = new ResizeObserver(read);
    if (headerRef.current) watch.observe(headerRef.current);
    if (barRef.current) watch.observe(barRef.current);
    return () => watch.disconnect();
  }, [booting, screen]);
  // The bar at the top of the browser takes the header's own color, so the
  // phone's chrome and the app meet without a seam, and the screen behind
  // the app takes the background. The first frame is painted by the script
  // at the top of public/index.html; this keeps both right when someone
  // changes the setting.
  useEffect(() => {
    try {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", t.headerBg);
      document.body.style.background = t.bg;
    } catch (e) {}
  }, [t]);
  const setTheme = (next) => { setThemeMode(next); saveTheme(next); queuePref({ theme: next }); };
  // The sign in screen keeps its own toggle, which now goes through the same
  // path, so a choice made before signing in is sent up afterwards.
  const toggleTheme = () => setTheme(themeMode === "dark" ? "light" : "dark");
  const [language, setLanguageState] = useState(firstLanguage);
  const setLanguage = (v) => { setLanguageState(v); saveLanguage(v); queuePref({ language: v }); };
  // The page says which language it is in, so a screen reader reads it in
  // the right voice and the browser never offers to translate it, and the
  // tab and the app switcher name it in the same language.
  useEffect(() => {
    try {
      document.documentElement.lang = language;
      document.title = tr("{brand} Staff Portal", { brand: clientConfig.company.brandTag });
    } catch (e) {}
  }, [language]);
  // Every screen below reads its words from this. Set during the
  // render that carries the new value, so the whole portal turns
  // at once; an effect would run after the first paint and show
  // one frame of the language the person just left. It derives
  // from state alone, so running it twice changes nothing.
  setWordsLanguage(language);
  const [textSize, setTextSizeState] = useState(readTextSize);
  const setTextSize = (id) => { setTextSizeState(id); saveTextSize(id); queuePref({ textSize: id }); };
  const zoom = zoomOf(textSize);

  useEffect(() => { const i = setInterval(() => setCurrentTime(now()), 1000); return () => clearInterval(i); }, []);
  const showToast = useCallback((msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }, []);
  const loadAssignedTasks = useCallback(async (tkn) => { try { const data = await api("/api/clock/tasks/assigned", { token: tkn || token }); setAssignedTasks(data); } catch (err) { console.error(err); } }, [token]);
  const loadSessionSites = useCallback(async (tkn) => { try { const data = await api("/api/shift-sessions/sites", { token: tkn || token }); setSessionSites(data); } catch (err) { console.error(err); } }, [token]);
  // One read of clock status for every path that has to redraw from the
  // server's view: after a start, a refused start, an end that already
  // happened elsewhere, and the app coming back into view.
  const refreshClockStatus = useCallback(async (tkn) => {
    const seq = nextStatusSeq();
    const cs = await api("/api/clock/status", { token: tkn || token });
    setClockStatus(cs); hydrateCompleted(cs, seq);
    setSelectedSite(cs.clockedIn && cs.shift ? cs.shift.siteId : null);
    return cs;
  }, [token]);
  // A pick list the API sends: the drop reasons, the issue severities, the
  // supply request types and the urgency. Its labels arrive in English and
  // are drawn through the table, which already carries the English of every
  // choice the screens fall back to, so a label that matches is drawn in
  // the person's language and one that does not is drawn as sent.
  const getOpts = useCallback((slug, placeholder) => { const cat = lookups.find(c => c.slug === slug); if (!cat) return placeholder ? [{ v: "", l: placeholder }] : []; const opts = (cat.values || []).filter(v => v.is_active).sort((a, b) => a.sort_order - b.sort_order).map(v => ({ v: v.value, l: tr(v.label) })); return placeholder ? [{ v: "", l: placeholder }, ...opts] : opts; }, [lookups]);
  const lkMap = useCallback((slug) => { const cat = lookups.find(c => c.slug === slug); if (!cat) return {}; const m = {}; (cat.values || []).forEach(v => { m[v.value] = v.label; }); return m; }, [lookups]);
  const lkColorMap = useCallback((slug) => { const cat = lookups.find(c => c.slug === slug); if (!cat) return {}; const m = {}; (cat.values || []).forEach(v => { if (v.color) m[v.value] = v.color; }); return m; }, [lookups]);
  const lkHasOther = useCallback((slug, val) => { const cat = lookups.find(c => c.slug === slug); if (!cat) return false; const v = (cat.values || []).find(x => x.value === val); return v?.show_other_input || false; }, [lookups]);

  // One bootstrap for the login path, the boot path and the activation
  // path, so the three cannot drift. Only /api/auth/me is awaited before
  // the screen switches, since the main screen reads user.
  const hydrateSession = useCallback(async (tok) => {
    const me = await api("/api/auth/me", { token: tok });
    setUser(me.user); setSites(me.sites);
    if (me.preferences && applyPrefsRef.current) applyPrefsRef.current(me.preferences, tok, me.user);
    api("/api/users/profile/me", { token: tok }).then(p => { if (p?.user?.profilePhotoUrl) setUser(prev => ({ ...prev, profilePhotoUrl: p.user.profilePhotoUrl })); }).catch(() => {});
    try { const seq = nextStatusSeq(); const cs = await api("/api/clock/status", { token: tok }); setClockStatus(cs); hydrateCompleted(cs, seq); if (cs.clockedIn && cs.shift) setSelectedSite(cs.shift.siteId); } catch (e) { console.warn("Clock status:", e.message); }
    loadAssignedTasks(tok);
    loadSessionSites(tok);
    api("/api/lookups", { token: tok }).then(setLookups).catch(e => console.warn("Lookups:", e.message));
    // The forced PIN set fires only when the API says so, strictly true.
    // mustSetPin sits at the top level of the /api/auth/me response,
    // beside user. While it is absent this branch stays dormant.
    setScreen(me.mustSetPin === true ? "setpin" : "main");
    return me.user;
  }, [loadAssignedTasks, loadSessionSites]);

  // Boot from a stored session. An emailed link wins over a stored session.
  const bootRan = useRef(false);
  useEffect(() => {
    if (bootRan.current) return;
    bootRan.current = true;
    if (ENTRY) return;
    const tok = readAuth();
    if (!tok) return;
    setToken(tok);
    hydrateSession(tok)
      .catch(() => { clearAuth(); setToken(null); setUser(null); setScreen("login"); })
      .finally(() => setBooting(false));
  }, [hydrateSession]);

  const handleLogin = async (phone, pin) => {
    setLoading(true);
    try {
      // noAuthEvent, so a refused PIN is not read as an expired session.
      // Nothing is signed in yet, so there is no session to end.
      const data = await api(signedOut("/api/auth/login", language), { method: "POST", body: { phone, pin }, noAuthEvent: true });
      setToken(data.token); saveAuth(data.token);
      const me = await hydrateSession(data.token);
      showToast(tr("Welcome, {name}", { name: me.firstName }));
    } catch (err) {
      const said = err && err.body && err.body.error ? String(err.body.error) : "";
      if (!said && wentNowhere(err)) showToast(tr(ERR_OFFLINE), "error");
      else showToast(said ? tr(said) : tr("That sign-in did not match. Check your badge, phone or email and your PIN."), "error");
    }
    setLoading(false);
  };

  // A successful activation or reset returns the same twelve-hour JWT a
  // login does. Store it the same way and take the same path in.
  const handleAuthSuccess = async (tok, chosenLanguage) => {
    leaveEntryPath();
    // A language picked on the way in is this device's language from
    // here, so a person who activated in Spanish lands in Spanish even
    // if the account has not caught up with the choice yet.
    if (chosenLanguage === "en" || chosenLanguage === "es") { chosenOnEntryRef.current = "language"; setLanguage(chosenLanguage); }
    setToken(tok); saveAuth(tok);
    try { const me = await hydrateSession(tok); showToast(tr("Welcome, {name}", { name: me.firstName })); }
    catch (err) { clearAuth(); setToken(null); setUser(null); setScreen("login"); showToast(tr(err.message), "error"); }
  };

  const handlePinSet = () => { setScreen("main"); showToast(tr("PIN updated")); };
  const goLogin = () => { leaveEntryPath(); setScreen("login"); };

  const handleRegister = async (firstName, lastName, phone, email, pin) => {
    setLoading(true);
    try { await api(signedOut("/api/auth/register", language), { method: "POST", body: { firstName, lastName, phone, email, pin } }); showToast(tr("Registration submitted. Pending supervisor approval.")); setScreen("login"); } catch (err) { showToast(tr(err.message), "error"); }
    setLoading(false);
  };

  const handleLogout = () => forgetPerson();

  // Tapping a site chooses it. No request, no tab change, no toast.
  const handleSelectSite = (siteId) => { if (clockStatus?.clockedIn) return; setPendingSite(siteId); setStartBlock(null); };

  const handleStartSession = async (siteId) => {
    if (!siteId) { showToast(tr("Select a site first"), "error"); return; }
    setLoading(true); setStartBlock(null);
    try {
      // 201 is a new session. 200 is the same site already open, which
      // the API answers with that session, so it takes the same path and
      // creates nothing twice.
      const data = await api("/api/shift-sessions", { method: "POST", body: { siteId }, token });
      await refreshClockStatus();
      setTasks(null); setPendingSite(null);
      showToast(tr(data.message) || tr("Shift started")); setActiveTab("tasks");
    } catch (err) {
      if (err.code === "OPEN_SESSION_ELSEWHERE") {
        // A shift is still open at another site. Say so and show it. It
        // is never ended from here as a side effect of starting another.
        const at = err.body && err.body.openSession ? err.body.openSession.siteName : null;
        setStartBlock(at ? tr("A shift is still open at {site}. End it before starting another.", { site: at }) : tr("A shift is still open. End it before starting another."));
        refreshClockStatus().catch(e => console.warn("Clock status:", e.message));
      } else { showToast(tr(err.message), "error"); }
    }
    setLoading(false);
  };

  const handleEndSession = async () => {
    const shift = clockStatus?.shift;
    // /api/clock/status carries the id as shift.sessionId, with shift.id
    // and session.id holding the same value. Without one, nothing is sent.
    const id = shift?.sessionId || shift?.id || clockStatus?.session?.id;
    if (!id) { showToast(tr("Could not find your open shift. Reload and try again."), "error"); return; }
    if (!window.confirm(tr("End your shift at {site}?", { site: shift.siteName || tr("this site") }))) return;
    setLoading(true);
    try {
      const data = await api("/api/shift-sessions/" + id + "/end", { method: "POST", token });
      setClockStatus({ clockedIn: false, shift: null, session: null });
      setSelectedSite(null); setPendingSite(null); setStartBlock(null); setTasks(null); setCompletedTaskIds(new Set());
      const endedAt = data && data.session ? data.session.endedAt : null;
      showToast(endedAt ? tr("Shift ended at {time}", { time: formatTime(endedAt) }) : tr("Shift ended"));
    } catch (err) {
      if (err.code === "SESSION_ALREADY_ENDED") {
        // Ended somewhere else already. Read the server's view and redraw.
        setPendingSite(null); setStartBlock(null); setTasks(null);
        try { await refreshClockStatus(); } catch (e) { setClockStatus({ clockedIn: false, shift: null, session: null }); setSelectedSite(null); }
        showToast(tr("This shift was already ended"));
      } else { showToast(tr(err.message), "error"); }
    }
    setLoading(false);
  };

  // The site the list in tasks came back for, and the site a fetch is in
  // flight for. A second call for the same site while one is in flight
  // does nothing. A failure clears the in-flight mark and leaves tasks
  // null, so the bar stays hidden and nothing is said to the person.
  const tasksSite = useRef(null);
  const tasksReqSite = useRef(null);
  const loadTasks = async () => { if (!clockStatus?.clockedIn || !clockStatus?.shift?.siteId) return; const siteId = clockStatus.shift.siteId; if (tasksReqSite.current === siteId) return; tasksReqSite.current = siteId; setTasksFailed(false); try { let taskUrl = "/api/sites/" + siteId + "/tasks?user_id=" + user.id; if (clockStatus.shift.buildingName) taskUrl += "&building_name=" + encodeURIComponent(clockStatus.shift.buildingName); if (clockStatus.shift.floorNumber) taskUrl += "&floor_number=" + encodeURIComponent(clockStatus.shift.floorNumber); const tt = await api(taskUrl, { token }); setTasks(tt); tasksSite.current = siteId; const seq = nextStatusSeq(); const cs = await api("/api/clock/status", { token }); setClockStatus(cs); hydrateCompleted(cs, seq); } catch (err) { console.error(err); setTasksFailed(true); } finally { tasksReqSite.current = null; } };
  const toggleTask = async (taskId) => { if (inFlightTaskIds.current.has(taskId)) return; inFlightTaskIds.current.add(taskId); try { if (completedTaskIds.has(taskId)) { await api("/api/clock/tasks/" + taskId + "/complete", { method: "DELETE", token }); setCompletedTaskIds(prev => { const n = new Set(prev); n.delete(taskId); return n; }); showToast(tr("Task unchecked")); } else { await api("/api/clock/tasks/" + taskId + "/complete", { method: "POST", body: {}, token }); setCompletedTaskIds(prev => new Set(prev).add(taskId)); showToast(tr("Task completed")); } const seq = nextStatusSeq(); const cs = await api("/api/clock/status", { token }); setClockStatus(cs); hydrateCompleted(cs, seq); } catch (err) { showToast(tr(err.message), "error"); } finally { inFlightTaskIds.current.delete(taskId); } };
  const loadIssues = async () => { try { const data = await api("/api/issues?limit=20", { token }); setIssues(data); } catch (err) { console.error(err); } };
  const resolveAssignedTask = async (taskId, status, note, photoUrl) => { try { await api("/api/clock/tasks/resolve/" + taskId, { method: "PATCH", body: { resolutionStatus: status, resolutionNote: note || undefined, photoUrl: photoUrl || undefined }, token }); showToast(tr("Task updated to {status}", { status: taskStatusWord(status) })); loadAssignedTasks(); } catch (err) { showToast(tr(err.message), "error"); } };
  const submitIssue = async (title, description, zone, severity, photoUrl, siteId) => { const actualSiteId = siteId || clockStatus?.shift?.siteId; if (!actualSiteId) { showToast(tr("Select a site first"), "error"); return; } try { const data = await api("/api/issues", { method: "POST", body: { siteId: actualSiteId, title, description, zone, severity }, token }); if (photoUrl && data.issue) { await api("/api/issues/" + data.issue.id + "/photos", { method: "POST", body: { photoUrl }, token }); } showToast(tr("Issue reported")); loadIssues(); } catch (err) { showToast(tr(err.message), "error"); } };
  const loadSupplies = async () => { try { const url = clockStatus?.shift?.siteId ? "/api/supplies?site_id=" + clockStatus.shift.siteId : "/api/supplies"; const data = await api(url, { token }); setSupplies(data); } catch (err) { console.error(err); } };
  const logSupplyUsage = async (supplyId, quantity) => { try { const data = await api("/api/supplies/log-usage", { method: "POST", body: { supplyId, quantity, siteId: clockStatus.shift.siteId, scanMethod: "manual" }, token }); showToast(data.message); setSupplyLogs(prev => [{ ...data.log, loggedAt: now().toISOString() }, ...prev]); if (data.lowStockAlert) showToast(tr("Low stock alert!"), "notice"); } catch (err) { showToast(tr(err.message), "error"); } };
  const submitSupplyRequest = async (requestType, itemName, description, urgency, supplyId) => { try { const siteId = clockStatus?.shift?.siteId || null; await api("/api/supplies/requests", { method: "POST", body: { requestType, itemName, description, urgency, supplyId, siteId }, token }); showToast(tr("Request submitted")); } catch (err) { showToast(tr(err.message), "error"); } };
  const loadChannels = async () => { try { const data = await api("/api/chat/channels", { token }); setChannels(data); } catch (err) { console.error(err); } };
  const loadMessages = async (channelId) => { try { const data = await api("/api/chat/channels/" + channelId + "/messages", { token }); setMessages(data); } catch (err) { console.error(err); } };
  const sendMessage = async (channelId, text) => { try { const data = await api("/api/chat/channels/" + channelId + "/messages", { method: "POST", body: { text }, token }); setMessages(prev => [...prev, data.message]); } catch (err) { showToast(tr(err.message), "error"); } };

  // The task list is fetched as soon as a session is seen open, whichever
  // tab the person is standing on, so the Home card has its bar at boot.
  // Once per site: opening Tasks afterwards fires nothing new, and a
  // status refresh at the same site fetches nothing. A session at a
  // different site fetches that site's list. No session, no fetch.
  useEffect(() => { if (activeTab === "clock" && token) loadSessionSites(); if (clockStatus?.clockedIn && clockStatus?.shift?.siteId && (tasks === null || tasksSite.current !== clockStatus.shift.siteId)) loadTasks(); if (activeTab === "issues") loadIssues(); if (activeTab === "issuetasks") loadAssignedTasks(); if (activeTab === "supplies") loadSupplies(); if (activeTab === "chat") loadChannels(); }, [activeTab, clockStatus?.clockedIn, clockStatus?.shift?.siteId]);
  useEffect(() => { if (activeChannel) { loadMessages(activeChannel); setTimeout(() => loadChannels(), 600); } }, [activeChannel]);
  // An admin can end a session from the dashboard, and a second device
  // can end it too. Re-read clock status when the app comes back into
  // view. One listener, no interval.
  useEffect(() => {
    if (!token || screen !== "main") return;
    const h = () => { if (document.visibilityState === "visible") refreshClockStatus().catch(e => console.warn("Clock status:", e.message)); };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, [token, screen, refreshClockStatus]);
  useEffect(() => { if (activeTab !== "chat" || !activeChannel) return; const iv = setInterval(() => loadMessages(activeChannel), 12000); return () => clearInterval(iv); }, [activeTab, activeChannel]);

  const isAdmin = user?.role === "admin" || user?.role === "supervisor";
  const assignedCount = assignedTasks.length;
  const [showMore, setShowMore] = useState(false);

  // The person's own four places between Home and More. Read on the first
  // render after they are known, so the bar never shows the default and
  // then swaps to theirs.
  const destCtx = { isAdmin };
  const shortcutChoices = shortcutChoicesFor(destCtx);
  const allowedShortcutIds = shortcutChoices.map(d => d.id);
  const uid = user && user.id ? user.id : null;
  const [shortcutsState, setShortcutsState] = useState({ userId: null, ids: DEFAULT_SHORTCUTS });
  if (shortcutsState.userId !== uid) {
    setShortcutsState({ userId: uid, ids: uid ? readShortcuts(uid, allowedShortcutIds) : DEFAULT_SHORTCUTS.slice() });
  }
  const shortcuts = shortcutsState.userId === uid ? shortcutsState.ids : DEFAULT_SHORTCUTS;
  const applyShortcuts = (ids) => {
    setShortcutsState({ userId: uid, ids: ids.slice() });
    if (uid) saveShortcuts(uid, ids);
    queuePref({ shortcuts: ids.slice() });
  };
  // What this device would send for each key right now.
  const prefValues = useRef({});
  prefValues.current = { shortcuts, textSize, theme: themeMode, language };
  // True only once /api/auth/me has carried a preferences key. While it is
  // false the portal never touches the preference routes.
  const prefsLive = useRef(false);

  // One PATCH carrying the key that changed and anything an earlier PATCH
  // failed to deliver. Marked pending before it goes, cleared when it
  // answers, so a tab closed mid-request retries on the next change or the
  // next sign in. A refusal is silent and never reverts the screen.
  const sendPrefs = (changed, tok, userId) => {
    if (!prefsLive.current || !userId || !tok) return;
    const keys = Object.keys(changed || {});
    readPendingPrefs(userId).forEach(k => { if (keys.indexOf(k) === -1) keys.push(k); });
    if (keys.length === 0) return;
    const payload = {};
    keys.forEach(k => { payload[k] = (changed && k in changed) ? changed[k] : prefValues.current[k]; });
    savePendingPrefs(userId, keys);
    api("/api/users/me/preferences", { method: "PATCH", body: payload, token: tok })
      .then(() => { savePendingPrefs(userId, readPendingPrefs(userId).filter(k => keys.indexOf(k) === -1)); })
      .catch(() => {});
  };
  queuePrefRef.current = (changed) => sendPrefs(changed, token, uid);

  // A value the account holds wins and replaces this device's. A value the
  // account does not hold, where this device has one, goes up once, so the
  // first device a person set things on becomes their account's settings.
  applyPrefsRef.current = (prefs, tok, u) => {
    prefsLive.current = true;
    const userId = u && u.id ? u.id : null;
    const changed = {};
    const settled = [];
    // What this device is still trying to send. Read before anything is
    // applied, because the account's copy of a key that is still on its
    // way here is the older one.
    const waiting = userId ? readPendingPrefs(userId) : [];
    if (chosenOnEntryRef.current) { if (waiting.indexOf(chosenOnEntryRef.current) === -1) waiting.push(chosenOnEntryRef.current); chosenOnEntryRef.current = null; }

    // One rule for every key. A key this device is still trying to send
    // keeps this device's value and goes up again, so a save that did not
    // reach the account is never quietly replaced by what the account
    // held before it. Otherwise the account's value wins. Where the
    // account holds none, this device's goes up once, so the first phone
    // a person set things on becomes their account's settings.
    const mergePref = (name, fromAccount, mine, apply) => {
      const has = (v) => v !== null && v !== undefined;
      if (waiting.indexOf(name) !== -1 && has(mine)) { changed[name] = mine; return; }
      if (has(fromAccount)) { apply(fromAccount); settled.push(name); return; }
      if (has(mine)) changed[name] = mine;
    };

    mergePref("shortcuts",
      Array.isArray(prefs.shortcuts) ? (validShortcuts(prefs.shortcuts, allowedShortcutIds) || DEFAULT_SHORTCUTS.slice()) : null,
      userId ? storedShortcuts(userId) : null,
      (v) => { setShortcutsState({ userId: userId, ids: v }); if (userId) saveShortcuts(userId, v); });

    mergePref("textSize",
      TEXT_SIZES.some(x => x.id === prefs.textSize) ? prefs.textSize : null,
      storedTextSize(),
      (v) => { setTextSizeState(v); saveTextSize(v); });

    mergePref("theme",
      (prefs.theme === "light" || prefs.theme === "dark") ? prefs.theme : null,
      storedTheme(),
      (v) => { setThemeMode(v); saveTheme(v); });

    mergePref("language",
      (prefs.language === "en" || prefs.language === "es") ? prefs.language : null,
      storedLanguage(),
      (v) => { setLanguageState(v); saveLanguage(v); });

    // Only a key the account actually settled stops waiting. One this
    // device is still delivering stays on the list and rides the
    // sendPrefs call below.
    if (userId && settled.length > 0) savePendingPrefs(userId, readPendingPrefs(userId).filter(k => settled.indexOf(k) === -1));
    sendPrefs(changed, tok, userId);
  };

  // Which draft the Forms screen should open on, when Help sent a
  // person over to fill one in. Held here only long enough to hand
  // it across, and never written anywhere.
  const [formsDraft, setFormsDraft] = useState(null);
  // Which conversation Help is in. Held here rather than inside Help,
  // which is unmounted the moment its tab is left, so choosing a
  // language in Settings no longer throws the conversation away.
  const [agentConversation, setAgentConversation] = useState(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // What the platform has told this person, counted. The routes arrive with
  // Step 61 in the API; until then every poll answers 404, which hides the
  // count and warns once. Nothing here ever toasts, so the bell stays quiet.
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadWarned = useRef(false);

  // Everything the person who was signed in leaves behind, dropped in
  // one place. Signing out and a session that runs out take this same
  // path, so the next person on the same phone starts clean however the
  // last one left. What this phone is set to, the language, the theme
  // and the text size, belongs to the phone and stays.
  const forgetPerson = useCallback(() => {
    clearAuth();
    setToken(null); setUser(null); setSites([]); setScreen("login");
    setClockStatus(null); setSelectedSite(null); setSessionSites(null); setPendingSite(null); setStartBlock(null);
    setTasks(null); setTasksFailed(false); setCompletedTaskIds(new Set());
    setIssues([]); setAssignedTasks([]); setSupplies([]); setSupplyLogs([]);
    setChannels([]); setMessages([]); setActiveChannel(null);
    setAgentConversation(null); setFormsDraft(null);
    setShortcutsState({ userId: null, ids: DEFAULT_SHORTCUTS.slice() });
    setLookups([]); setToast(null); setLoading(false);
    setUnread(0); setNotifOpen(false); setShowMore(false); setShortcutsOpen(false);
    setActiveTab("clock");
    unreadWarned.current = false; prefsLive.current = false; chosenOnEntryRef.current = null;
    tasksSite.current = null; tasksReqSite.current = null; inFlightTaskIds.current = new Set();
  }, []);
  useEffect(() => {
    window.addEventListener("ocsa-session-expired", forgetPerson);
    return () => window.removeEventListener("ocsa-session-expired", forgetPerson);
  }, [forgetPerson]);
  const refreshUnread = useCallback(async (tkn) => {
    const tk = tkn || token;
    if (!tk) return;
    try {
      const d = await api("/api/notifications/unread-count", { token: tk });
      const n = Number(d && d.unread);
      setUnread(Number.isFinite(n) && n > 0 ? n : 0);
    } catch (err) {
      setUnread(0);
      if (!unreadWarned.current) { unreadWarned.current = true; console.warn("Notifications:", err.message); }
    }
  }, [token]);

  // A tick while the tab is hidden is skipped, not queued.
  useEffect(() => {
    if (!token || screen !== "main") return;
    const tick = () => { if (!document.hidden) refreshUnread(); };
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, [token, screen, refreshUnread]);

  // The app keeps itself current. showBar is true only once a reload has
  // been held back, so an idle app updates with nothing shown.
  const { showBar: updateWaiting, updateNow } = useSelfUpdate(activeTab);

  // Written just before a reload for an update, read once, then dropped.
  useEffect(() => {
    const want = sessionGet(UPDATE_TAB_KEY);
    if (!want) return;
    sessionDrop(UPDATE_TAB_KEY);
    if (want === "profile" || DESTINATIONS.some(d => d.id === want)) setActiveTab(want);
  }, []);

  const badgeCounts = { assigned: assignedCount };
  const tabOf = (d) => ({ id: d.id, label: tr(d.label(destCtx)), icon: d.icon, badge: d.badge ? (badgeCounts[d.badge] || 0) : 0 });
  // Home first, then the four, then More. Whatever is not on the bar is
  // under More, so nothing can be hidden from a person entirely.
  const primaryTabs = [DESTINATIONS.find(d => d.home)].concat(shortcuts.map(destById)).filter(Boolean).map(tabOf);
  const moreTabs = shortcutChoices.filter(d => shortcuts.indexOf(d.id) === -1).map(tabOf);
  const moreTabIds = moreTabs.map(t => t.id);
  const isMoreActive = moreTabIds.includes(activeTab);
  // The count on More is what is waiting under More. With Assigned on the
  // bar its badge shows there instead, so the two never double up.
  const totalBadge = moreTabs.reduce((n, tab) => n + (tab.badge || 0), 0);
  // The Home card counts this person's own checklist, the list the Tasks
  // tab renders, and nothing wider. null until that list has come back.
  const homeTasks = Array.isArray(tasks) ? standardTasksOf(tasks) : null;
  const homeDone = homeTasks ? homeTasks.filter(tk => completedTaskIds.has(tk.id)).length : 0;

  return (
    <TextSizeCtx.Provider value={{ textSize, setTextSize }}>
    <LanguageCtx.Provider value={{ language, setLanguage }}>
    <div style={{ width: "100%", minHeight: "var(--ocsa-vh)", background: t.bg, fontFamily: FONT_BODY, color: t.text, position: "relative", display: "flex", flexDirection: "column", zoom: zoom, ...viewportVars(zoom), ...chromeVars(chrome.header, chrome.bar, zoom) }}>

      {/* Only while an update is waiting on someone to finish. It takes
          its own space rather than covering anything, sticks to the top
          while the page scrolls, and sits above every sheet. It has no
          close control and goes on its own when the update goes. */}
      {updateWaiting && (
        <div id={UPDATE_BAR_ID} style={{ position: "sticky", top: 0, zIndex: 3000, background: t.card, borderBottom: "1px solid " + t.goldBorder, boxShadow: t.shadow, display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 10, padding: "7px 12px" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{tr("A new version is ready")}</span>
          <button onClick={updateNow} style={{ minHeight: 30, padding: "0 12px", borderRadius: R.sm, border: "1px solid " + GOLD, background: t.goldBg, color: t.goldText, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Update now")}</button>
        </div>
      )}

      {booting && <BootSplash t={t} themeMode={themeMode} />}
      {!booting && screen === "login" && <LoginScreen onLogin={handleLogin} onGoRegister={() => setScreen("register")} onGoForgot={() => setScreen("forgot")} loading={loading} showToast={showToast} t={t} toggleTheme={toggleTheme} themeMode={themeMode} />}
      {screen === "register" && <RegisterScreen onRegister={handleRegister} onBack={() => setScreen("login")} loading={loading} t={t} />}
      {screen === "activate" && <ActivateScreen token={ENTRY ? ENTRY.token : null} onActivated={handleAuthSuccess} onGoLogin={goLogin} showToast={showToast} t={t} />}
      {screen === "reset" && <ResetScreen token={ENTRY ? ENTRY.token : null} onReset={handleAuthSuccess} onGoLogin={goLogin} onGoForgot={() => setScreen("forgot")} showToast={showToast} t={t} />}
      {screen === "forgot" && <ForgotScreen onGoLogin={goLogin} showToast={showToast} t={t} />}
      {screen === "setpin" && <SetPinScreen token={token} user={user} onDone={handlePinSet} onSignOut={handleLogout} showToast={showToast} t={t} />}
      {!booting && screen === "main" && (
        <>
          <div ref={headerRef} style={{ backgroundImage: (themeMode === "light" ? SWEEP_LIGHT : SWEEP) + ", linear-gradient(135deg, " + t.headerBg + " 0%, " + t.headerBg2 + " 100%)", backgroundSize: "100% 2px, 100% 100%", backgroundPosition: "bottom left, top left", backgroundRepeat: "no-repeat, no-repeat", padding: "14px 16px 10px", borderBottom: "1px solid transparent" }}>
            <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: TAP, flex: "1 1 0" }}>
                <button onClick={() => setActiveTab("profile")} aria-label={tr("Profile")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, minWidth: TAP, minHeight: TAP }}>
                  {user?.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "2px solid " + GOLD }} /> : <div style={{ width: 38, height: 38, borderRadius: "50%", background: themeMode === "light" ? "rgba(255,255,255,0.92)" : "rgba(231,176,23,0.15)", border: "2px solid " + (themeMode === "light" ? PANEL_LIGHT : GOLD), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: themeMode === "light" ? PANEL_LIGHT : GOLD }}>{user?.firstName?.[0]}{user?.lastName?.[0]}</div>}
                </button>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#F8F7F4", fontFamily: FONT_HEAD, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.firstName} {user?.lastName}</div>
                  <div style={{ fontSize: 10, color: themeMode === "light" ? "rgba(255,255,255,0.82)" : GOLD, letterSpacing: "0.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.role ? roleWord(user.role) : ""}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {clockStatus?.clockedIn && (<div style={{ display: "flex", alignItems: "center", gap: 5, background: themeMode === "light" ? GREEN : "rgba(46,204,113,0.15)", padding: "3px 8px", borderRadius: 20, fontSize: 10, color: themeMode === "light" ? NAVY : GREEN, fontWeight: 600 }}><div style={{ width: 5, height: 5, borderRadius: "50%", background: themeMode === "light" ? NAVY : GREEN, animation: "pulse 2s infinite" }} />{tr("ON SITE")}</div>)}
                <button onClick={() => setNotifOpen(true)} aria-label={unread > 0 ? tr("{count} unread notifications", { count: unread }) : tr("Notifications")} aria-expanded={notifOpen} style={{ position: "relative", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, minWidth: 44, minHeight: 44, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                  <BellIco sz={18} c={themeMode === "light" ? "rgba(255,255,255,0.82)" : "#A8B8C8"} />
                  {unread > 0 && <span style={{ position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, background: t.badgeBg, color: badgeInk(t), fontSize: 9, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", fontFamily: FONT_HEAD }}>{unread > 9 ? "9+" : unread}</span>}
                </button>
                <button onClick={() => { setActiveTab("settings"); setShowMore(false); }} aria-label={tr("Settings")} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, minWidth: 44, minHeight: 44, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><GearIco sz={18} c={themeMode === "light" ? "rgba(255,255,255,0.82)" : "#A8B8C8"} /></button>
                <button onClick={handleLogout} aria-label={tr("Sign out")} style={mkTapFrame()}><LogOutIco sz={18} c={themeMode === "light" ? "rgba(255,255,255,0.82)" : "#8899AA"} /></button>
              </div>
            </div>
          </div>

          <div style={{ padding: "0 0 var(--ocsa-bar, 76px) 0", flex: 1, display: "flex", flexDirection: "column" }}>
            <div className="sp-content" style={{ maxWidth: 960, margin: "0 auto", width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
              {activeTab === "clock" && <div><ClockView clockStatus={clockStatus} currentTime={currentTime} selectedSite={selectedSite} pendingSite={pendingSite} startBlock={startBlock} onSelectSite={handleSelectSite} onStartSession={handleStartSession} onEndSession={handleEndSession} siteChoices={sessionSites} loading={loading} completedCount={homeDone} taskCount={homeTasks ? homeTasks.length : 0} taskListLoaded={!!homeTasks} t={t} /><MyScheduleSection token={token} t={t} compact showToast={showToast} getOpts={getOpts} lkHasOther={lkHasOther} /></div>}
              {activeTab === "schedule" && <MyScheduleSection token={token} t={t} showToast={showToast} getOpts={getOpts} lkHasOther={lkHasOther} />}
              {activeTab === "tasks" && <TasksView clockStatus={clockStatus} tasks={tasks} tasksFailed={tasksFailed} onRetryTasks={loadTasks} completedTaskIds={completedTaskIds} toggleTask={toggleTask} t={t} />}
              {activeTab === "issuetasks" && <AssignedTasksView assignedTasks={assignedTasks} resolveTask={resolveAssignedTask} showToast={showToast} t={t} token={token} lkColorMap={lkColorMap} />}
              {activeTab === "chat" && <ChatView channels={channels} messages={messages} activeChannel={activeChannel} setActiveChannel={setActiveChannel} sendMessage={sendMessage} user={user} t={t} token={token} />}
              {activeTab === "agent" && <AgentView token={token} showToast={showToast} t={t} language={language} conversationId={agentConversation} onConversation={setAgentConversation} onFillForm={(id) => { setFormsDraft(String(id)); setActiveTab("forms"); setShowMore(false); }} />}
              {activeTab === "issues" && <IssuesView clockStatus={clockStatus} issues={issues} submitIssue={submitIssue} showToast={showToast} user={user} sites={sites} t={t} token={token} getOpts={getOpts} lkColorMap={lkColorMap} />}
              {activeTab === "supplies" && <SuppliesView clockStatus={clockStatus} supplies={supplies} supplyLogs={supplyLogs} logSupplyUsage={logSupplyUsage} submitRequest={submitSupplyRequest} showToast={showToast} t={t} getOpts={getOpts} lkColorMap={lkColorMap} />}
              {activeTab === "pickup" && <PickupView token={token} user={user} showToast={showToast} t={t} />}
              {activeTab === "inspect" && <InspectView token={token} user={user} showToast={showToast} t={t} />}
              {activeTab === "speakup" && <SpeakUpView token={token} t={t} />}
              {activeTab === "forms" && <FormsView token={token} user={user} showToast={showToast} t={t} language={language} openDraft={formsDraft} onOpenedDraft={() => setFormsDraft(null)} />}
              {activeTab === "settings" && <SettingsView token={token} user={user} showToast={showToast} t={t} themeMode={themeMode} setTheme={setTheme} textSize={textSize} setTextSize={setTextSize} language={language} setLanguage={setLanguage} onEditShortcuts={() => setShortcutsOpen(true)} />}
              {activeTab === "profile" && <MyProfileView token={token} user={user} showToast={showToast} t={t} setUser={setUser} setActiveTab={setActiveTab} />}
            </div>
          </div>

          {/* More menu overlay */}
          {showMore && <div onClick={() => setShowMore(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 150 }}>
            <div onClick={e => e.stopPropagation()} style={{ position: "fixed", bottom: 60, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: 400, background: t.card, borderRadius: R.lg, border: "1px solid " + t.border, padding: "12px 8px", boxShadow: t.popShadow, zIndex: 151 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                {moreTabs.map(tab => { const active = activeTab === tab.id; const TabIco = tab.icon; return (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); setShowMore(false); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", background: active ? t.goldBg : "transparent", border: active ? "1px solid " + t.goldBorder : "1px solid transparent", borderRadius: 12, cursor: "pointer" }}>
                    <div style={{ position: "relative" }}>
                      <TabIco sz={22} c={active ? t.goldText : t.textSec} />
                      {tab.badge > 0 && <div style={{ position: "absolute", top: -4, right: -8, minWidth: 16, height: 16, borderRadius: 8, background: t.badgeBg, color: badgeInk(t), fontSize: 9, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{tab.badge}</div>}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: active ? 600 : 500, color: active ? t.goldText : t.textSec }}>{tab.label}</span>
                  </button>
                ); })}
              </div>
              <button onClick={() => { setShowMore(false); setShortcutsOpen(true); }} style={{ width: "100%", minHeight: 44, marginTop: 8, borderRadius: R.md, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Edit shortcuts")}</button>
            </div>
          </div>}

          {/* Bottom navigation */}
          <div ref={barRef} style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 960, background: t.navBg, borderTop: "1px solid " + t.navBorder, display: "flex", padding: "8px 0 12px", zIndex: 100, boxShadow: themeMode === "light" ? "0 -2px 10px rgba(0,0,0,0.06)" : "0 -2px 10px rgba(0,0,0,0.2)" }}>
            {primaryTabs.map(tab => {
              const active = activeTab === tab.id;
              const TabIco = tab.icon;
              return (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setShowMore(false); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 0", position: "relative" }}>
                  <TabIco sz={22} c={active ? t.goldText : t.textMut} />
                  <span style={{ fontSize: barFontSize(9, zoom), fontWeight: active ? 600 : 500, color: active ? t.goldText : t.textMut, letterSpacing: "0.3px" }}>{tab.label}</span>
                  {active && <div style={{ position: "absolute", top: -1, width: 24, height: 2.5, background: SWEEP_BAR, borderRadius: 2 }} />}
                </button>
              );
            })}
            <button onClick={() => setShowMore(!showMore)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 0", position: "relative" }}>
              <div style={{ position: "relative" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isMoreActive || showMore ? t.goldText : t.textMut} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                {totalBadge > 0 && !isMoreActive && <div style={{ position: "absolute", top: -4, right: -8, minWidth: 16, height: 16, borderRadius: 8, background: t.badgeBg, color: badgeInk(t), fontSize: 9, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{totalBadge}</div>}
              </div>
              <span style={{ fontSize: barFontSize(9, zoom), fontWeight: isMoreActive || showMore ? 600 : 500, color: isMoreActive || showMore ? t.goldText : t.textMut, letterSpacing: "0.3px" }}>{tr("More")}</span>
              {isMoreActive && <div style={{ position: "absolute", top: -1, width: 24, height: 2.5, background: SWEEP_BAR, borderRadius: 2 }} />}
            </button>
          </div>
        </>
      )}

      {notifOpen && (
        <NotificationsSheet
          token={token}
          t={t}
          unread={unread}
          onUnreadChanged={setUnread}
          onOpenTab={(id) => { setActiveTab(id); setShowMore(false); }}
          onClose={() => { setNotifOpen(false); refreshUnread(); }}
        />
      )}

      {shortcutsOpen && (
        <ShortcutsSheet
          t={t}
          choices={shortcutChoices}
          current={shortcuts}
          ctx={destCtx}
          onClose={() => setShortcutsOpen(false)}
          onSave={(ids) => { applyShortcuts(ids); setShortcutsOpen(false); showToast(tr("Shortcuts saved")); }}
        />
      )}

      {toast && (<div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: toast.type === "error" ? RED : toast.type === "notice" ? ORANGE : GREEN, color: toast.type === "notice" ? NAVY : "#F8F7F4", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 1000, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", maxWidth: "90%", textAlign: "center" }}>{toast.msg}</div>)}

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html { -webkit-text-size-adjust: 100%; }
        input::placeholder, textarea::placeholder { color: ${t.textMut}; }
        select { color-scheme: ${themeMode}; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 2px; }
        .sp-content > div { flex: 1; display: flex; flex-direction: column; animation: slideUp 0.2s ease-out; }
        .sp-content { padding: 0 12px; }
        @media (min-width: 640px) { .sp-content { padding: 0 20px; } }
        button:active { opacity: 0.8; }
      `}</style>
    </div>
    </LanguageCtx.Provider>
    </TextSizeCtx.Provider>
  );
}

function LoginScreen({ onLogin, onGoRegister, onGoForgot, loading, showToast, t, toggleTheme, themeMode }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const labelSt = mkLabel(t);
  const inputSt = mkInput(t);
  return (
    <div style={{ width: "100%", minHeight: "var(--ocsa-vh, 100vh)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 24px" }}>
      <div style={{ width: "100%", maxWidth: 420, background: t.card, border: "1px solid " + t.border, borderRadius: R.lg, padding: "28px 24px", boxShadow: t.popShadow }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-block", maxWidth: "100%", boxSizing: "border-box", padding: themeMode === "dark" ? "12px 20px" : "0", background: themeMode === "dark" ? "rgba(255,255,255,0.95)" : "transparent", borderRadius: 12 }}><img src={LOGO_LG} alt={clientConfig.company.shortName} style={{ height: 70, maxWidth: "100%", objectFit: "contain" }} /></div>
          
          <div style={{ fontSize: 11, color: t.textMut, marginTop: 16, letterSpacing: "1px", textTransform: "uppercase", fontFamily: FONT_HEAD, fontWeight: 600 }}>{tr("Staff Operations Portal")}</div>
        </div>
        <div style={{ marginBottom: 16 }}><label style={labelSt}>{tr("Badge Number, Phone or Email")}</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder={tr("9001, 2155550101 or name@email.com")} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} style={inputSt} onKeyDown={e => e.key === "Enter" && onLogin(phone, pin)} /></div>
        <div style={{ marginBottom: 8 }}><label style={labelSt}>{tr("PIN")}</label><input value={pin} onChange={e => setPin(e.target.value)} placeholder={tr("4-digit PIN")} type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={4} style={{ ...inputSt, letterSpacing: "8px", textAlign: "center", fontSize: 20 }} onKeyDown={e => e.key === "Enter" && onLogin(phone, pin)} /></div>
        <div style={{ textAlign: "right", marginBottom: 24 }}><button onClick={onGoForgot} style={{ background: "none", border: "none", minHeight: TAP, padding: "4px 0", color: t.textSec, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>{tr("Forgot your PIN?")}</button></div>
        <button onClick={() => onLogin(phone, pin)} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, " + GOLD + ", " + GOLD_LIGHT + ")", color: NAVY, fontSize: 15, fontWeight: 600, cursor: "pointer", textTransform: "uppercase", letterSpacing: "1px", opacity: loading ? 0.6 : 1, boxShadow: "0 6px 18px rgba(231,176,23,0.30)", fontFamily: FONT_HEAD }}>{loading ? tr("Signing in...") : tr("Sign In")}</button>
        <button onClick={onGoRegister} style={mkGhostBtn(t)}>{tr("New Employee? Register Here")}</button>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 20 }}><button onClick={toggleTheme} style={mkTapFrame()}><span style={mkSmallPill(t)}>{themeMode === "dark" ? <SunIco sz={14} c={t.textMut} /> : <MoonIco sz={14} c={t.textMut} />}{themeMode === "dark" ? tr("Light Mode") : tr("Dark Mode")}</span></button><TextSizeButton t={t} /><LanguageButton t={t} /></div>
      </div>
    </div>
  );
}

function RegisterScreen({ onRegister, onBack, loading, t }) {
  const [fn, setFn] = useState(""); const [ln, setLn] = useState("");
  const [ph, setPh] = useState(""); const [em, setEm] = useState("");
  const [pin, setPin] = useState(""); const [pin2, setPin2] = useState("");
  const [errs, setErrs] = useState({});
  const labelSt = mkLabel(t); const inputSt = mkInput(t); const errSt = mkFieldErr(t);

  // The first empty required field is named, and nothing is sent. Last
  // Name carries no asterisk, so it is not required here either.
  const submit = () => {
    const required = [["firstName", "First Name", fn], ["phone", "Phone Number", ph], ["email", "Email Address", em], ["pin", "PIN", pin], ["pin2", "Confirm PIN", pin2]];
    const empty = required.find(f => !String(f[2]).trim());
    if (empty) { setErrs({ [empty[0]]: tr("Fill in {field}.", { field: tr(empty[1]) }) }); return; }
    if (pin !== pin2) { setErrs({ pin2: tr(ERR_PIN_MISMATCH) }); return; }
    setErrs({});
    onRegister(fn, ln, ph, em, pin);
  };
  return (
    <div style={{ width: "100%", minHeight: "var(--ocsa-vh, 100vh)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 24px" }}>
      <div style={{ width: "100%", maxWidth: 420, background: t.card, border: "1px solid " + t.border, borderRadius: R.lg, padding: "28px 24px", boxShadow: t.popShadow }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-block", maxWidth: "100%", boxSizing: "border-box", padding: "4px 12px", background: "rgba(255,255,255,0.92)", borderRadius: 6 }}><img src={LOGO_SM} alt={clientConfig.company.shortName} style={{ height: 34, maxWidth: "100%", objectFit: "contain" }} /></div>
          <div style={{ fontSize: 12, color: t.textSec, letterSpacing: "2px", textTransform: "uppercase", marginTop: 8, fontFamily: FONT_HEAD, fontWeight: 600 }}>{tr("New Staff Registration")}</div>
        </div>
        <div style={{ marginBottom: 14 }}><label style={labelSt}>{tr("First Name *")}</label><input value={fn} onChange={e => setFn(e.target.value)} placeholder={tr("First name")} style={inputSt} />{errs.firstName && <div style={errSt}>{errs.firstName}</div>}</div>
        <div style={{ marginBottom: 14 }}><label style={labelSt}>{tr("Last Name")}</label><input value={ln} onChange={e => setLn(e.target.value)} placeholder={tr("Last name")} style={inputSt} /></div>
        <div style={{ marginBottom: 14 }}><label style={labelSt}>{tr("Phone Number *")}</label><input value={ph} onChange={e => setPh(e.target.value)} placeholder={tr("2155550000 (no dashes needed)")} style={inputSt} />{errs.phone && <div style={errSt}>{errs.phone}</div>}</div>
        <div style={{ marginBottom: 14 }}><label style={labelSt}>{tr("Email Address *")}</label><input value={em} onChange={e => setEm(e.target.value)} placeholder={tr("name@email.com")} type="email" style={inputSt} />{errs.email && <div style={errSt}>{errs.email}</div>}</div>
        <div style={{ marginBottom: 14 }}><label style={labelSt}>{tr("PIN (4 digits) *")}</label><input value={pin} onChange={e => setPin(e.target.value)} type="password" maxLength={4} style={{ ...inputSt, letterSpacing: "8px", textAlign: "center", fontSize: 20 }} />{errs.pin && <div style={errSt}>{errs.pin}</div>}</div>
        <div style={{ marginBottom: 24 }}><label style={labelSt}>{tr("Confirm PIN *")}</label><input value={pin2} onChange={e => setPin2(e.target.value)} type="password" maxLength={4} style={{ ...inputSt, letterSpacing: "8px", textAlign: "center", fontSize: 20 }} />{errs.pin2 && <div style={errSt}>{errs.pin2}</div>}</div>
        <button onClick={submit} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, " + GOLD + ", " + GOLD_LIGHT + ")", color: NAVY, fontSize: 15, fontWeight: 600, cursor: "pointer", boxShadow: "0 6px 18px rgba(231,176,23,0.30)", fontFamily: FONT_HEAD }}>{loading ? tr("Registering...") : tr("Register")}</button>
        <button onClick={onBack} style={mkGhostBtn(t)}>{tr("Back to Login")}</button>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 20 }}><TextSizeButton t={t} /><LanguageButton t={t} /></div>
      </div>
    </div>
  );
}

function AuthCard({ t, title, children, ownLanguage }) {
  return (
    <div style={{ width: "100%", minHeight: "var(--ocsa-vh, 100vh)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 24px" }}>
      <div style={{ width: "100%", maxWidth: 420, background: t.card, border: "1px solid " + t.border, borderRadius: R.lg, padding: "28px 24px", boxShadow: t.popShadow }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-block", maxWidth: "100%", boxSizing: "border-box", padding: "4px 12px", background: "rgba(255,255,255,0.92)", borderRadius: 6 }}><img src={LOGO_SM} alt={clientConfig.company.shortName} style={{ height: 34, maxWidth: "100%", objectFit: "contain" }} /></div>
          <div style={{ fontSize: 12, color: t.textSec, letterSpacing: "2px", textTransform: "uppercase", marginTop: 8, fontFamily: FONT_HEAD, fontWeight: 600 }}>{title}</div>
        </div>
        {children}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 20 }}><TextSizeButton t={t} />{!ownLanguage && <LanguageButton t={t} />}</div>
      </div>
    </div>
  );
}

function BootSplash({ t, themeMode }) {
  return (
    <div style={{ width: "100%", minHeight: "var(--ocsa-vh, 100vh)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 24px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "inline-block", maxWidth: "100%", boxSizing: "border-box", padding: themeMode === "dark" ? "12px 20px" : "0", background: themeMode === "dark" ? "rgba(255,255,255,0.95)" : "transparent", borderRadius: 12 }}><img src={LOGO_LG} alt={clientConfig.company.shortName} style={{ height: 70, maxWidth: "100%", objectFit: "contain" }} /></div>
        <div style={{ fontSize: 11, color: t.textMut, marginTop: 16, letterSpacing: "1px", textTransform: "uppercase", fontFamily: FONT_HEAD, fontWeight: 600 }}>{tr("Staff Operations Portal")}</div>
        <div style={{ fontSize: 10, color: t.textMut, marginTop: 8, animation: "pulse 2s infinite" }}>{tr("Loading...")}</div>
      </div>
    </div>
  );
}

function LangPicker({ value, onChange, t }) {
  const opts = [["en", "English"], ["es", "Espa\u00f1ol"]];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {opts.map(([v, l]) => <button key={v} type="button" onClick={() => onChange(v)} style={{ flex: 1, minHeight: TAP, padding: "10px", borderRadius: R.sm, fontSize: 12, fontWeight: 600, fontFamily: FONT_HEAD, background: value === v ? t.goldBg : "transparent", color: value === v ? t.goldText : t.textMut, border: "1px solid " + (value === v ? t.goldBorder : t.borderSolid), cursor: "pointer" }}>{l}</button>)}
    </div>
  );
}

// A link's last good moment, in the reader's language like every other
// date and time.
const fmtExpiry = (v) => { try { return new Date(v).toLocaleString(dateLocale(), { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };
const wentNowhere = (err) => !!err && (err.status === undefined || err.status === null);
const ERR_PIN_MISMATCH = "The two PINs do not match. Type the same 4 digits in both fields.";
const MSG_LINK_INVALID = "This link is no longer valid. Links expire, and each one can only be used once.";

function ActivateScreen({ token, onActivated, onGoLogin, showToast, t }) {
  const [phase, setPhase] = useState(token ? "checking" : "incomplete");
  const [info, setInfo] = useState(null);
  const [fail, setFail] = useState({ from: "", msg: "" });
  const [badge, setBadge] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  // The picker on this screen is the portal's own language: choosing one
  // turns the screen at once, and it is the language sent with the
  // activation. The account's saved language, when the link carries one,
  // is where it starts.
  const { language: locale, setLanguage: setLocale } = useContext(LanguageCtx);
  const chooseRef = useRef(setLocale);
  chooseRef.current = setLocale;
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const [errs, setErrs] = useState({});
  const [mismatches, setMismatches] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const labelSt = mkLabel(t); const inputSt = mkInput(t); const pinSt = mkPinInput(t); const errSt = mkFieldErr(t); const helpSt = mkHelp(t); const textSt = mkCardText(t);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setPhase("checking");
    api(signedOut("/api/auth/activate/" + encodeURIComponent(token), localeRef.current), { noAuthEvent: true })
      .then(d => { if (!alive) return; setInfo(d); if (d && (d.preferredLanguage === "en" || d.preferredLanguage === "es")) chooseRef.current(d.preferredLanguage); setPhase("form"); })
      .catch(e => { if (!alive) return; if (e.code === "TOKEN_INVALID") { setPhase("invalid"); } else { setFail({ from: "get", msg: tr(wentNowhere(e) ? ERR_OFFLINE : ERR_GENERIC) }); setPhase("error"); } });
    return () => { alive = false; };
  }, [token, attempt]);

  // The API requires the badge whenever the row carries one. The GET says
  // so through badgeAssigned; treat anything but an explicit false as required.
  const needBadge = !info || info.badgeAssigned !== false;

  const submit = async () => {
    const e = {};
    const b = badge.trim();
    if (needBadge && !b) e.badge = tr("Enter the badge number from your email.");
    // The same rules Set Your PIN applies, so a PIN accepted here is never
    // refused a moment later.
    const why = weakPinReason(pin, b);
    if (why) e.pin = why;
    else if (pin2 !== pin) e.pin2 = tr(ERR_PIN_MISMATCH);
    setErrs(e);
    if (Object.keys(e).length) return;
    setPhase("working");
    try {
      const body = { token, pin, locale };
      if (needBadge) body.badgeNumber = b;
      const d = await api(signedOut("/api/auth/activate", locale), { method: "POST", body, noAuthEvent: true });
      if (d.token) { setPhase("done"); onActivated(d.token, locale); return; }
      setFail({ from: "post", msg: tr(d.message) || tr("Your account is activated but not currently active. Contact your supervisor.") });
      setPhase("inactive");
    } catch (err) {
      if (err.code === "TOKEN_INVALID") { setPhase("invalid"); return; }
      if (err.code === "BADGE_MISMATCH") {
        const n = mismatches + 1; setMismatches(n);
        setErrs({ badge: tr("That badge number does not match our records. Check the number in your email.") + (n >= 3 ? " " + tr("Ask your supervisor to confirm your badge number.") : "") });
        setPhase("form"); return;
      }
      if (err.status === 400) { setErrs({ pin: tr(err.message) }); setPhase("form"); return; }
      setFail({ from: "post", msg: tr(ERR_GENERIC) }); setPhase("error");
    }
  };
  const retry = () => { setErrs({}); if (fail.from === "get") setAttempt(a => a + 1); else setPhase("form"); };
  const working = phase === "working";

  if (phase === "incomplete") return (
    <AuthCard t={t} title={tr("Account Activation")}>
      <div style={textSt}>{tr("This activation link is incomplete. Open the link from your email again.")}</div>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>{tr("Back to Sign In")}</button>
    </AuthCard>
  );
  if (phase === "checking" || phase === "done") return (
    <AuthCard t={t} title={tr("Account Activation")}>
      <div style={{ ...textSt, textAlign: "center", color: t.textMut, animation: "pulse 2s infinite" }}>{phase === "done" ? tr("PIN set. Signing you in...") : tr("Checking your link...")}</div>
    </AuthCard>
  );
  if (phase === "invalid") return (
    <AuthCard t={t} title={tr("Account Activation")}>
      <div style={textSt}>{tr(MSG_LINK_INVALID)}</div>
      <div style={textSt}>{tr(SUPPORT_LINE)}</div>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>{tr("Back to Sign In")}</button>
    </AuthCard>
  );
  if (phase === "inactive") return (
    <AuthCard t={t} title={tr("Account Activation")}>
      <div style={textSt}>{fail.msg}</div>
      <div style={{ ...textSt, color: t.textSec }}>{tr("Your PIN has been saved. Signing in will work once your account is active.")}</div>
    </AuthCard>
  );
  if (phase === "error") return (
    <AuthCard t={t} title={tr("Account Activation")}>
      <div style={textSt}>{fail.msg}</div>
      <button onClick={retry} style={mkPrimaryBtn(t, false)}>{tr("Try Again")}</button>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>{tr("Back to Sign In")}</button>
    </AuthCard>
  );
  return (
    <AuthCard t={t} title={tr("Account Activation")} ownLanguage>
      <div style={textSt}>{info && info.firstName ? tr("Welcome, {name}.", { name: info.firstName }) + " " : ""}{tr("Confirm your badge number and choose your 4-digit PIN.")}</div>
      {info && info.expiresAt && <div style={{ ...helpSt, marginTop: 0, marginBottom: 16 }}>{tr("This link works until")} {fmtExpiry(info.expiresAt)} {tr("and can be used once.")}</div>}
      {needBadge && <div style={{ marginBottom: 14 }}>
        <label style={labelSt}>{tr("Badge Number")}</label>
        <input value={badge} onChange={e => setBadge(e.target.value)} inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder={tr("Badge number")} style={inputSt} />
        <div style={helpSt}>{tr("The number on the email we sent you.")}</div>
        {errs.badge && <div style={errSt}>{errs.badge}</div>}
      </div>}
      <div style={{ marginBottom: 14 }}><label style={labelSt}>{tr("PIN (4 digits)")}</label><input value={pin} onChange={e => setPin(e.target.value)} {...PIN_INPUT_PROPS} style={pinSt} />{errs.pin && <div style={errSt}>{errs.pin}</div>}</div>
      <div style={{ marginBottom: 14 }}><label style={labelSt}>{tr("Confirm PIN")}</label><input value={pin2} onChange={e => setPin2(e.target.value)} {...PIN_INPUT_PROPS} style={pinSt} onKeyDown={e => e.key === "Enter" && !working && submit()} />{errs.pin2 && <div style={errSt}>{errs.pin2}</div>}</div>
      <div style={{ marginBottom: 22 }}><label style={labelSt}>{tr("Language")}</label><LangPicker value={locale} onChange={setLocale} t={t} /></div>
      <button onClick={submit} disabled={working} style={mkPrimaryBtn(t, working)}>{working ? tr("Activating...") : tr("Activate Account")}</button>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>{tr("Back to Sign In")}</button>
    </AuthCard>
  );
}

function ResetScreen({ token, onReset, onGoLogin, onGoForgot, showToast, t }) {
  // The account's saved language, when the link carries one, is where
  // the screen starts. The pill on the card changes it from there.
  const { language, setLanguage } = useContext(LanguageCtx);
  const chooseRef = useRef(setLanguage);
  chooseRef.current = setLanguage;
  const languageRef = useRef(language);
  languageRef.current = language;
  const [phase, setPhase] = useState(token ? "checking" : "incomplete");
  const [info, setInfo] = useState(null);
  const [fail, setFail] = useState({ from: "", msg: "" });
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [errs, setErrs] = useState({});
  const [attempt, setAttempt] = useState(0);
  const labelSt = mkLabel(t); const pinSt = mkPinInput(t); const errSt = mkFieldErr(t); const helpSt = mkHelp(t); const textSt = mkCardText(t);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setPhase("checking");
    api(signedOut("/api/auth/reset/" + encodeURIComponent(token), languageRef.current), { noAuthEvent: true })
      .then(d => { if (!alive) return; setInfo(d); if (d && (d.preferredLanguage === "en" || d.preferredLanguage === "es")) chooseRef.current(d.preferredLanguage); setPhase("form"); })
      .catch(e => { if (!alive) return; if (e.code === "TOKEN_INVALID") { setPhase("invalid"); } else { setFail({ from: "get", msg: tr(ERR_GENERIC) }); setPhase("error"); } });
    return () => { alive = false; };
  }, [token, attempt]);

  const submit = async () => {
    const e = {};
    if (!PIN_RE.test(pin)) e.pin = tr("PIN must be exactly 4 digits.");
    else if (pin2 !== pin) e.pin2 = tr(ERR_PIN_MISMATCH);
    setErrs(e);
    if (Object.keys(e).length) return;
    setPhase("working");
    try {
      const d = await api(signedOut("/api/auth/reset", language), { method: "POST", body: { token, pin }, noAuthEvent: true });
      if (d.token) { setPhase("done"); onReset(d.token); return; }
      setFail({ from: "post", msg: tr(d.message) || tr("Your PIN has been changed. Contact your supervisor about your account status.") });
      setPhase("inactive");
    } catch (err) {
      if (err.code === "TOKEN_INVALID") { setPhase("invalid"); return; }
      if (err.status === 400) { setErrs({ pin: tr(err.message) }); setPhase("form"); return; }
      setFail({ from: "post", msg: tr(wentNowhere(err) ? ERR_OFFLINE : ERR_GENERIC) }); setPhase("error");
    }
  };
  const retry = () => { setErrs({}); if (fail.from === "get") setAttempt(a => a + 1); else setPhase("form"); };
  const working = phase === "working";

  if (phase === "incomplete") return (
    <AuthCard t={t} title={tr("Reset Your PIN")}>
      <div style={textSt}>{tr("This reset link is incomplete. Open the link from your email again.")}</div>
      <button onClick={onGoForgot} style={mkPrimaryBtn(t, false)}>{tr("Request a New Link")}</button>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>{tr("Back to Sign In")}</button>
    </AuthCard>
  );
  if (phase === "checking" || phase === "done") return (
    <AuthCard t={t} title={tr("Reset Your PIN")}>
      <div style={{ ...textSt, textAlign: "center", color: t.textMut, animation: "pulse 2s infinite" }}>{phase === "done" ? tr("PIN saved. Signing you in...") : tr("Checking your link...")}</div>
    </AuthCard>
  );
  if (phase === "invalid") return (
    <AuthCard t={t} title={tr("Reset Your PIN")}>
      <div style={textSt}>{tr(MSG_LINK_INVALID)}</div>
      <button onClick={onGoForgot} style={mkPrimaryBtn(t, false)}>{tr("Request a New Link")}</button>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>{tr("Back to Sign In")}</button>
    </AuthCard>
  );
  if (phase === "inactive") return (
    <AuthCard t={t} title={tr("Reset Your PIN")}>
      <div style={textSt}>{fail.msg}</div>
      <div style={{ ...textSt, color: t.textSec }}>{tr("Signing in will work once your account is active.")}</div>
    </AuthCard>
  );
  if (phase === "error") return (
    <AuthCard t={t} title={tr("Reset Your PIN")}>
      <div style={textSt}>{fail.msg}</div>
      <button onClick={retry} style={mkPrimaryBtn(t, false)}>{tr("Try Again")}</button>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>{tr("Back to Sign In")}</button>
    </AuthCard>
  );
  return (
    <AuthCard t={t} title={tr("Reset Your PIN")}>
      <div style={textSt}>{info && info.firstName ? tr("Welcome back, {name}.", { name: info.firstName }) + " " : ""}{tr("Choose your new 4-digit PIN.")}</div>
      {info && info.expiresAt && <div style={{ ...helpSt, marginTop: 0, marginBottom: 16 }}>{tr("This link works until")} {fmtExpiry(info.expiresAt)} {tr("and can be used once.")}</div>}
      <div style={{ marginBottom: 14 }}><label style={labelSt}>{tr("New PIN (4 digits)")}</label><input value={pin} onChange={e => setPin(e.target.value)} {...PIN_INPUT_PROPS} style={pinSt} />{errs.pin && <div style={errSt}>{errs.pin}</div>}</div>
      <div style={{ marginBottom: 22 }}><label style={labelSt}>{tr("Confirm PIN")}</label><input value={pin2} onChange={e => setPin2(e.target.value)} {...PIN_INPUT_PROPS} style={pinSt} onKeyDown={e => e.key === "Enter" && !working && submit()} />{errs.pin2 && <div style={errSt}>{errs.pin2}</div>}</div>
      <button onClick={submit} disabled={working} style={mkPrimaryBtn(t, working)}>{working ? tr("Saving...") : tr("Save PIN")}</button>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>{tr("Back to Sign In")}</button>
    </AuthCard>
  );
}

function ForgotScreen({ onGoLogin, showToast, t }) {
  const { language } = useContext(LanguageCtx);
  const [ident, setIdent] = useState("");
  const [err, setErr] = useState("");
  const [phase, setPhase] = useState("form");
  const labelSt = mkLabel(t); const inputSt = mkInput(t); const errSt = mkFieldErr(t); const textSt = mkCardText(t);

  const submit = async () => {
    const v = ident.trim();
    if (!v) { setErr(tr("Enter your badge number, phone number or email address.")); return; }
    setErr(""); setPhase("working");
    try {
      await api(signedOut("/api/auth/reset/request", language), { method: "POST", body: { identifier: v }, noAuthEvent: true });
      setPhase("sent");
    } catch (e) {
      setPhase("form");
      setErr(e.status === 400 ? tr(e.message) : tr(ERR_GENERIC));
    }
  };
  const working = phase === "working";

  // The API answers the same neutral 200 for every outcome except an
  // empty identifier, so the confirmation conditions on nothing.
  if (phase === "sent") return (
    <AuthCard t={t} title={tr("Reset Your PIN")}>
      <div style={textSt}>{tr("If that matches an account on file, a reset link is on its way. The link is good for one hour.")}</div>
      <div style={textSt}>{tr("If you do not have an email address on file, no link can reach you. Contact your supervisor to have your PIN reset directly.")}</div>
      <div style={textSt}>{tr("Forgotten your badge number? You can also sign in with your phone number or your email address.")}</div>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>{tr("Back to Sign In")}</button>
    </AuthCard>
  );
  return (
    <AuthCard t={t} title={tr("Reset Your PIN")}>
      <div style={textSt}>{tr("Enter the badge number, phone number or email address on your account and we will email you a link to choose a new PIN.")}</div>
      <div style={{ marginBottom: 22 }}>
        <label style={labelSt}>{tr("Badge Number, Phone or Email")}</label>
        <input value={ident} onChange={e => setIdent(e.target.value)} placeholder={tr("9001, 2155550101 or name@email.com")} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} style={inputSt} onKeyDown={e => e.key === "Enter" && !working && submit()} />
        {err && <div style={errSt}>{err}</div>}
      </div>
      <button onClick={submit} disabled={working} style={mkPrimaryBtn(t, working)}>{working ? tr("Sending...") : tr("Send Reset Link")}</button>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>{tr("Back to Sign In")}</button>
    </AuthCard>
  );
}

// Forced PIN set. Rendered as its own screen value with no tab bar, no
// back affordance and no dismiss. The person typed the assigned PIN to
// get here, so only the new PIN and its confirmation are asked for.
function SetPinScreen({ token, user, onDone, onSignOut, showToast, t }) {
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [errs, setErrs] = useState({});
  const [working, setWorking] = useState(false);
  const labelSt = mkLabel(t); const pinSt = mkPinInput(t); const errSt = mkFieldErr(t); const textSt = mkCardText(t);

  const submit = async () => {
    const e = {};
    const why = weakPinReason(pin, user && user.badgeNumber);
    if (why) e.pin = why;
    else if (pin2 !== pin) e.pin2 = tr(ERR_PIN_MISMATCH);
    setErrs(e);
    if (Object.keys(e).length) return;
    setWorking(true);
    try {
      const d = await api("/api/auth/change-pin", { method: "POST", body: { newPin: pin }, token });
      onDone(d);
    } catch (err) { setErrs({ pin: tr(err.message) }); }
    setWorking(false);
  };

  return (
    <AuthCard t={t} title={tr("Set Your PIN")}>
      <div style={textSt}>{tr("Set your own PIN. The PIN you were given is known to your supervisor. Choose a new one that only you know.")}</div>
      <div style={{ marginBottom: 14 }}><label style={labelSt}>{tr("New PIN (4 digits)")}</label><input value={pin} onChange={e => setPin(e.target.value)} {...PIN_INPUT_PROPS} style={pinSt} />{errs.pin && <div style={errSt}>{errs.pin}</div>}</div>
      <div style={{ marginBottom: 22 }}><label style={labelSt}>{tr("Confirm PIN")}</label><input value={pin2} onChange={e => setPin2(e.target.value)} {...PIN_INPUT_PROPS} style={pinSt} onKeyDown={e => e.key === "Enter" && !working && submit()} />{errs.pin2 && <div style={errSt}>{errs.pin2}</div>}</div>
      <button onClick={submit} disabled={working} style={mkPrimaryBtn(t, working)}>{working ? tr("Saving...") : tr("Save PIN")}</button>
      <div style={{ textAlign: "center", marginTop: 18 }}><button onClick={onSignOut} style={{ background: "none", border: "none", padding: "4px 0", color: t.textMut, fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>{tr("Not you? Sign out")}</button></div>
    </AuthCard>
  );
}

function MyScheduleSection({ token, t, compact, showToast, getOpts, lkHasOther }) {
  const [view, setView] = useState("week");
  const [data, setData] = useState({ scheduled: [], actual: [], pickups: [] });
  const [detail, setDetail] = useState(null);
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const mon = new Date(now);
    mon.setDate(now.getDate() - diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  });
  const [loading, setLoading] = useState(false);

  // Time off, on the Schedule tab only. types stays null until the
  // route answers 200, and null keeps every part of this build off
  // the screen, so before the routes are live the tab reads exactly
  // as it did.
  const [offTypes, setOffTypes] = useState(null);
  const [myOff, setMyOff] = useState([]);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqForm, setReqForm] = useState(null);
  const [reqBusy, setReqBusy] = useState(false);
  const [reqErr, setReqErr] = useState(null);
  const [offDetail, setOffDetail] = useState(null);
  const [offBusy, setOffBusy] = useState(false);
  const [offErr, setOffErr] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const timeOffOn = !compact && Array.isArray(offTypes);

  // Both read straight off the schedule response, so they are empty
  // until Step 79 adds the keys and nothing on the calendar changes
  // before then. A YYYY-MM-DD string compares correctly as text.
  const getTimeOffForDay = (ds) => (Array.isArray(data.timeOff) ? data.timeOff : []).filter(r => r.startsOn && r.startsOn <= ds && ds <= (r.endsOn || r.startsOn));
  const dropRequestedIds = (Array.isArray(data.pendingDrops) ? data.pendingDrops : [])
    .map(d => String(d.scheduledShiftId || d.scheduled_shift_id || ""))
    .filter(Boolean);
  const isDropRequested = (id) => dropRequestedIds.indexOf(String(id)) !== -1;

  const toISO = (d) => d.toISOString().split("T")[0];
  const fmtTm = (v) => { if (!v) return ""; const parts = String(v).split(":"); const h = parseInt(parts[0]); const m = parseInt(parts[1] || "0"); return new Date(2024, 0, 1, h, m).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" }); };
  const fmtClockTm = (d) => new Date(d).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit", hour12: true });

  const getWeekEnd = () => { const e = new Date(weekStart); e.setDate(e.getDate() + 6); return e; };
  const getWeekDays = () => { const days = []; for (let i = 0; i < 7; i++) { const d = new Date(weekStart); d.setDate(d.getDate() + i); days.push(toISO(d)); } return days; };
  // The week strip names its days in the reader's language, from the
  // same source as every other date on this screen.
  const dayNames = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(dateLocale(), { weekday: "short", timeZone: "UTC" }));
  const isToday = (ds) => ds === toISO(new Date());

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const sd = toISO(weekStart);
      let ed;
      if (view === "month") {
        const last = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 0);
        ed = toISO(last);
      } else {
        ed = toISO(getWeekEnd());
      }
      const d = await api("/api/pickups/my-schedule?start_date=" + sd + "&end_date=" + ed, { token });
      setData(d);
    } catch (err) { console.error("Schedule load error:", err); }
    setLoading(false);
  };

  useEffect(() => { loadSchedule(); }, [weekStart, view]);

  // Asked once when the Schedule tab opens. Any answer other than
  // 200 leaves types null and shows nothing, with no toast.
  const loadMyOff = useCallback(async () => {
    try {
      const d = await api("/api/time-off/mine?status=all&limit=" + TIME_OFF_PAGE, { token });
      setMyOff(Array.isArray(d) ? d : (Array.isArray(d && d.requests) ? d.requests : []));
    } catch (err) { setMyOff([]); }
  }, [token]);

  useEffect(() => {
    if (compact) return;
    let gone = false;
    (async () => {
      try {
        const d = await api("/api/time-off/types", { token });
        const list = Array.isArray(d) ? d : (Array.isArray(d && d.types) ? d.types : null);
        if (gone || !Array.isArray(list)) return;
        setOffTypes(list);
        loadMyOff();
      } catch (err) { /* not live yet, nothing shows */ }
    })();
    return () => { gone = true; };
  }, [compact, token, loadMyOff]);

  const prevWeek = () => { if (view === "month") { const n = new Date(weekStart.getFullYear(), weekStart.getMonth() - 1, 1); setWeekStart(n); } else { const n = new Date(weekStart); n.setDate(n.getDate() - 7); setWeekStart(n); } };
  const nextWeek = () => { if (view === "month") { const n = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 1); setWeekStart(n); } else { const n = new Date(weekStart); n.setDate(n.getDate() + 7); setWeekStart(n); } };
  const goToday = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const mon = new Date(now);
    mon.setDate(now.getDate() - diff);
    mon.setHours(0, 0, 0, 0);
    setWeekStart(mon);
  };

  const getSchedForDay = (ds) => data.scheduled.filter(s => {
    const d = typeof s.scheduled_date === "string" ? s.scheduled_date.slice(0, 10) : s.scheduled_date?.toISOString?.()?.split("T")?.[0];
    return d === ds;
  });
  const getActualForDay = (ds) => data.actual.filter(s => {
    const d = typeof s.clock_in_time === "string" ? s.clock_in_time.slice(0, 10) : s.clock_in_time?.toISOString?.()?.split("T")?.[0];
    return d === ds;
  });
  const getPickupsForDay = (ds) => data.pickups.filter(s => {
    const d = typeof s.scheduled_date === "string" ? s.scheduled_date.slice(0, 10) : s.scheduled_date?.toISOString?.()?.split("T")?.[0];
    return d === ds;
  });

  const weekLabel = weekStart.toLocaleDateString(dateLocale(), { month: "short", day: "numeric" }) + " - " + getWeekEnd().toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" });

  const weekDays = getWeekDays();

  // The five controls in the header above the calendar. Each drawing
  // stays the size it was; the button around it carries the tap area.
  const viewChip = (on) => ({ display: "inline-flex", alignItems: "center", padding: "5px 12px", borderRadius: R.sm, fontSize: 10, fontWeight: on ? 600 : 500, fontFamily: FONT_HEAD, textTransform: "uppercase", letterSpacing: "0.5px", background: on ? t.goldBg : "transparent", color: on ? t.goldText : t.textMut, border: on ? "1px solid " + t.goldBorder : "1px solid transparent" });
  const stepChip = { display: "inline-flex", alignItems: "center", background: "transparent", border: "1px solid " + t.borderSolid, borderRadius: R.sm, padding: "6px 12px", color: t.textMut, fontSize: 14 };
  const todayChip = { display: "inline-flex", alignItems: "center", fontSize: 9, padding: "3px 9px", borderRadius: R.sm, border: "1px solid " + BLUE, background: "transparent", color: BLUE, fontWeight: 600, fontFamily: FONT_HEAD };

  const offLabel = { fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 3, fontFamily: FONT_HEAD };
  const offValue = { fontSize: 13, color: t.text, fontWeight: 500, overflowWrap: "anywhere" };
  // Both limits are local calendar days, so the pickers agree with
  // what the API measures against.
  const reqMin = ymdLocal(addDays(todayLocal(), -TIME_OFF_MIN_BACK));
  const reqMax = ymdLocal(addDays(todayLocal(), TIME_OFF_MAX_AHEAD));

  const openRequest = () => {
    const today = ymdLocal(todayLocal());
    setReqForm({ leaveType: "", startsOn: today, endsOn: today, partDay: false, startTime: "", endTime: "", hours: "", reason: "" });
    setReqErr(null);
    setReqOpen(true);
  };
  // The last day never sits before the first, and a part day only
  // makes sense on one day, so widening the range clears it.
  const onFirstDay = (v) => setReqForm(prev => {
    const ends = (prev.endsOn && prev.endsOn >= v) ? prev.endsOn : v;
    const same = ends === v;
    return { ...prev, startsOn: v, endsOn: ends, partDay: same ? prev.partDay : false, startTime: same ? prev.startTime : "", endTime: same ? prev.endTime : "" };
  });
  const onLastDay = (v) => setReqForm(prev => {
    const same = v === prev.startsOn;
    return { ...prev, endsOn: v, partDay: same ? prev.partDay : false, startTime: same ? prev.startTime : "", endTime: same ? prev.endTime : "" };
  });

  const sendRequest = async () => {
    if (reqBusy) return;
    setReqBusy(true); setReqErr(null);
    // leaveType rides along even when empty, so the API's own words
    // answer rather than a second rule written here.
    const body = { leaveType: reqForm.leaveType, startsOn: reqForm.startsOn, endsOn: reqForm.endsOn };
    if (reqForm.partDay) { body.startTime = reqForm.startTime; body.endTime = reqForm.endTime; }
    if (String(reqForm.hours).trim() !== "") body.hours = Number(reqForm.hours);
    if (reqForm.reason.trim() !== "") body.reason = reqForm.reason.trim();
    try {
      await api("/api/time-off", { method: "POST", body, token });
      setReqOpen(false);
      showToast(tr("Time off requested. You get a notice when it is decided."));
      loadSchedule(); loadMyOff();
    } catch (err) { setReqErr(tr(err.message)); }
    setReqBusy(false);
  };

  // A row already carries the whole request; a calendar chip carries
  // only an id, so that one is read back first.
  const openOffById = async (id) => {
    if (!id) return;
    setOffErr(null); setConfirmCancel(false);
    try { const d = await api("/api/time-off/" + encodeURIComponent(id), { token }); setOffDetail((d && d.request) ? d.request : d); }
    catch (err) { showToast(tr(err.message), "error"); }
  };

  const openOffDetail = async (r) => {
    setOffErr(null); setConfirmCancel(false);
    if (r && r.startsOn) { setOffDetail(r); return; }
    const id = r && (r.id || r);
    if (!id) return;
    try { const d = await api("/api/time-off/" + encodeURIComponent(id), { token }); setOffDetail((d && d.request) ? d.request : d); }
    catch (err) { showToast(tr(err.message), "error"); }
  };

  const cancelRequest = async () => {
    if (offBusy || !offDetail) return;
    setOffBusy(true); setOffErr(null);
    try {
      await api("/api/time-off/" + encodeURIComponent(offDetail.id) + "/cancel", { method: "POST", token });
      setOffDetail(null); setConfirmCancel(false);
      showToast(tr("Time off request cancelled."));
      loadSchedule(); loadMyOff();
    } catch (err) { setOffErr(tr(err.message)); setConfirmCancel(false); }
    setOffBusy(false);
  };

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{tr("My Schedule")}</div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setView("week")} style={mkTapFrame()}><span style={viewChip(view === "week")}>{tr("Week")}</span></button>
          <button onClick={() => { setView("month"); const first = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1); setWeekStart(first); }} style={mkTapFrame()}><span style={viewChip(view === "month")}>{tr("Month")}</span></button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={prevWeek} aria-label={tr("Back")} style={mkTapFrame()}><span style={stepChip}>&lt;</span></button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{weekLabel}</span>
          <button onClick={goToday} style={mkTapFrame()}><span style={todayChip}>{tr("Today")}</span></button>
        </div>
        <button onClick={nextWeek} aria-label={tr("Next")} style={mkTapFrame()}><span style={stepChip}>&gt;</span></button>
      </div>

      {loading && <div style={{ textAlign: "center", padding: 20, color: t.textMut, fontSize: 12 }}>{tr("Loading...")}</div>}

      {/* TIME OFF, Schedule tab only, and only once the routes answer */}
      {timeOffOn && (
        <button onClick={openRequest} style={{ width: "100%", minHeight: 44, marginBottom: 14, borderRadius: R.md, border: "1px solid " + t.borderSolid, background: "transparent", color: t.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Request time off")}</button>
      )}

      {/* WEEK VIEW */}
      {!loading && view === "week" && (
        <div style={{ overflowX: "auto", display: "flex", flex: compact ? undefined : 1 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, minWidth: 300, flex: 1 }}>
          {weekDays.map((ds, i) => {
            const sched = getSchedForDay(ds);
            const actual = getActualForDay(ds);
            const pickups = getPickupsForDay(ds);
            const today = isToday(ds);
            const dt = new Date(ds + "T00:00:00");
            const dayOff = getTimeOffForDay(ds);
            const hasAny = sched.length > 0 || actual.length > 0 || pickups.length > 0 || dayOff.length > 0;
            return (
              <div key={ds} style={{ background: today ? t.goldBg : t.card, border: "1px solid " + (today ? t.goldBorder : t.borderSolid), borderRadius: R.md, padding: 6, minHeight: compact ? 80 : 120, flex: compact ? undefined : 1, boxShadow: t.shadow }}>
                <div style={{ textAlign: "center", marginBottom: 4 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: today ? t.goldText : t.textMut, textTransform: "uppercase" }}>{dayNames[i]}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: today ? t.goldText : t.text, fontFamily: FONT_HEAD }}>{dt.getDate()}</div>
                </div>
                {sched.map(s => (
                  <div key={s.id} onClick={() => setDetail({ type: "scheduled", ...s })} style={{ padding: "3px 4px", marginBottom: 2, borderRadius: 4, fontSize: 9, fontWeight: 600, background: GOLD + "18", color: t.goldText, border: "1px solid " + GOLD + "30", cursor: "pointer" }}>
                    {fmtTm(s.start_time)}{s.end_time ? " - " + fmtTm(s.end_time) : ""}{s.site_name && <div style={{ fontSize: 8, opacity: 0.8 }}>{s.site_name}</div>}{isDropRequested(s.id) && <div style={{ fontSize: 7, marginTop: 1, textTransform: "uppercase", letterSpacing: "0.3px", opacity: 0.9 }}>{tr("Drop requested")}</div>}
                  </div>
                ))}
                {actual.map(a => (
                  <div key={a.id} onClick={() => setDetail({ type: "actual", ...a })} style={{ padding: "3px 4px", marginBottom: 2, borderRadius: 4, fontSize: 9, fontWeight: 600, background: GREEN + "15", color: GREEN, border: "1px solid " + GREEN + "30", cursor: "pointer" }}>
                    {fmtClockTm(a.clock_in_time)}{a.duration_minutes ? tr(" ({h}h)", { h: Math.floor(a.duration_minutes / 60) }) : a.shift_status === "active" ? tr(" (live)") : ""}{a.site_name && <div style={{ fontSize: 8, opacity: 0.8 }}>{a.site_name}</div>}
                  </div>
                ))}
                {pickups.map(p => {
                  const pc = p.status === "approved" ? GREEN : BLUE;
                  return (
                    <div key={p.id} onClick={() => setDetail({ type: "pickup", ...p })} style={{ padding: "3px 4px", marginBottom: 2, borderRadius: 4, fontSize: 9, fontWeight: 600, background: pc + "15", color: pc, border: "1px solid " + pc + "30", cursor: "pointer" }}>
                      {fmtTm(p.start_time)} <span style={{ fontSize: 7, textTransform: "uppercase" }}>{p.status === "approved" ? tr("approved") : tr("claimed")}</span>
                      {p.site_name && <div style={{ fontSize: 8, opacity: 0.8 }}>{p.site_name}</div>}
                    </div>
                  );
                })}
                {dayOff.map(r => {
                  const waiting = r.status !== "approved";
                  return (
                    <div key={r.id} onClick={compact ? undefined : () => openOffById(r.id)} style={{ padding: "3px 4px", marginBottom: 2, borderRadius: 4, fontSize: 9, fontWeight: 600, background: TIME_OFF_COLOR + (waiting ? "14" : "22"), color: TIME_OFF_COLOR, border: waiting ? "1px dashed " + TIME_OFF_COLOR : "1px solid " + TIME_OFF_COLOR, cursor: compact ? "default" : "pointer" }}>
                      {tr("Time off")}
                      {r.partDay && r.startTime && <div style={{ fontSize: 8, opacity: 0.9 }}>{fmtTm(r.startTime)}</div>}
                      {waiting && <div style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: "0.3px", opacity: 0.9 }}>{tr("requested")}</div>}
                    </div>
                  );
                })}
                {!hasAny && <div style={{ fontSize: 10, color: t.textMut, opacity: 0.3, textAlign: "center", marginTop: 8 }}>-</div>}
              </div>
            );
          })}
        </div></div>
      )}

      {/* MONTH VIEW */}
      {!loading && view === "month" && (() => {
        const year = weekStart.getFullYear();
        const month = weekStart.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startOff = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        const cells = [];
        for (let i = -startOff; i <= lastDay.getDate() + (6 - (lastDay.getDay() === 0 ? 6 : lastDay.getDay() - 1)); i++) {
          const d = new Date(year, month, i + 1);
          cells.push(toISO(d));
        }
        const monthName = firstDay.toLocaleDateString(dateLocale(), { month: "long", year: "numeric" });
        return (
          <div style={{ display: "flex", flexDirection: "column", flex: compact ? undefined : 1 }}>
            <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 8, fontFamily: FONT_HEAD }}>{monthName}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 2, marginBottom: 4 }}>
              {dayNames.map(d => <div key={d} style={{ textAlign: "center", fontSize: 9, fontWeight: 600, color: t.textMut, padding: "4px 0" }}>{d}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 2, flex: compact ? undefined : 1 }}>
              {cells.map(ds => {
                const dt = new Date(ds + "T00:00:00");
                const inMonth = dt.getMonth() === month;
                const today = isToday(ds);
                const sched = getSchedForDay(ds);
                const actual = getActualForDay(ds);
                const pickups = getPickupsForDay(ds);
                return (
                  <div key={ds} onClick={() => { const day = dt.getDay(); const diff = day === 0 ? 6 : day - 1; const mon = new Date(dt); mon.setDate(dt.getDate() - diff); setWeekStart(mon); setView("week"); }} style={{ padding: 4, minHeight: compact ? 40 : 60, background: today ? t.goldBg : inMonth ? t.card : t.hover, borderRadius: R.sm, border: "1px solid " + (today ? t.goldBorder : t.borderSolid), opacity: inMonth ? 1 : 0.3, cursor: "pointer", textAlign: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: today ? 600 : 500, color: today ? t.goldText : t.text, fontFamily: FONT_HEAD }}>{dt.getDate()}</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 2, flexWrap: "wrap" }}>
                      {sched.length > 0 && <div style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD }} />}
                      {actual.length > 0 && <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN }} />}
                      {pickups.length > 0 && <div style={{ width: 6, height: 6, borderRadius: "50%", background: BLUE }} />}
                      {getTimeOffForDay(ds).length > 0 && <div style={{ width: 6, height: 6, borderRadius: "50%", background: TIME_OFF_COLOR }} />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 8 }}>
              {[{ c: GOLD, l: tr("Scheduled") }, { c: GREEN, l: tr("Worked") }, { c: BLUE, l: tr("Pickup") }]
                // The fourth reads off the same key the dots do, so the
                // legend stays as it is until the API sends timeOff.
                .concat(Array.isArray(data.timeOff) ? [{ c: TIME_OFF_COLOR, l: tr("Time off") }] : []).map(lg => (
                <div key={lg.l} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: lg.c }} />
                  <span style={{ fontSize: 8, color: t.textMut }}>{lg.l}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {timeOffOn && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 8, fontFamily: FONT_HEAD }}>{tr("My time off")}</div>
          {myOff.length === 0 && <div style={{ fontSize: 12, color: t.textMut, padding: "10px 0" }}>{tr("No time off requests yet.")}</div>}
          {myOff.map(r => {
            const hrs = timeOffHours(r.hours);
            return (
              <button key={r.id} onClick={() => openOffDetail(r)} style={{ width: "100%", textAlign: "left", minHeight: 44, marginBottom: 8, padding: "10px 12px", borderRadius: R.md, border: "1px solid " + t.borderSolid, background: t.card, cursor: "pointer", fontFamily: FONT_BODY, display: "block" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 140px", minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, overflowWrap: "anywhere" }}>{tr(r.leaveTypeLabel || r.leaveType || "")}</div>
                    <div style={{ fontSize: 11, color: t.textSec, marginTop: 3, overflowWrap: "anywhere" }}>{timeOffDates(r.startsOn, r.endsOn)}</div>
                    {r.partDay && r.startTime && r.endTime && <div style={{ fontSize: 11, color: t.textMut, marginTop: 2 }}>{fmtTm(r.startTime)} - {fmtTm(r.endTime)}</div>}
                    {hrs && <div style={{ fontSize: 11, color: t.textMut, marginTop: 2 }}>{hrs}</div>}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: timeOffStatusColor(r.status, t), flexShrink: 0, fontFamily: FONT_HEAD }}>{timeOffStatusWord(r.status)}</span>
                </div>
                {r.decisionNote && <div style={{ fontSize: 11, color: t.textSec, marginTop: 6, lineHeight: 1.4, overflowWrap: "anywhere" }}>{tr("Note: {note}", { note: r.decisionNote })}</div>}
              </button>
            );
          })}
          {myOff.length >= TIME_OFF_PAGE && <div style={{ fontSize: 11, color: t.textMut, marginTop: 4 }}>{tr("Showing your latest 50 requests.")}</div>}
        </div>
      )}

      {/* REQUEST TIME OFF SHEET */}
      {reqOpen && reqForm && (
        <div onClick={() => !reqBusy && setReqOpen(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.modalOverlay, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: "16px 16px 0 0", border: "1px solid " + t.borderSolid, width: "100%", maxWidth: 960, padding: "20px 20px 30px", boxShadow: t.popShadow, maxHeight: "calc(var(--ocsa-dvh, 100dvh) - 40px)", overflowY: "auto" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: t.textMut, margin: "0 auto 16px", opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 14, fontFamily: FONT_HEAD }}>{tr("Request time off")}</div>

            {reqErr && <div style={{ padding: "10px 12px", marginBottom: 12, borderRadius: R.md, background: t.redSubtle, border: "1px solid " + t.redBorder, color: t.text, fontSize: 12, lineHeight: 1.5, overflowWrap: "anywhere" }}>{reqErr}</div>}

            <div style={{ marginBottom: 10 }}>
              <label style={mkLabel(t)}>{tr("Type")}</label>
              <select value={reqForm.leaveType} onChange={e => setReqForm({ ...reqForm, leaveType: e.target.value })} style={{ ...mkInput(t), minHeight: 44 }}>
                <option value="">{tr("Choose a type")}</option>
                {offTypes.map(ty => <option key={ty.value} value={ty.value}>{tr(ty.label || ty.value)}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={mkLabel(t)}>{tr("First day")}</label>
              <input type="date" value={reqForm.startsOn} min={reqMin} max={reqMax} onChange={e => onFirstDay(e.target.value)} style={{ ...mkInput(t), minHeight: 44 }} />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={mkLabel(t)}>{tr("Last day")}</label>
              <input type="date" value={reqForm.endsOn} min={reqForm.startsOn} onChange={e => onLastDay(e.target.value)} style={{ ...mkInput(t), minHeight: 44 }} />
            </div>

            {reqForm.startsOn === reqForm.endsOn && (
              <div style={{ marginBottom: 10 }}>
                {/* The box a phone draws for a checkbox cannot be given
                    a bigger tap area without being drawn bigger, so the
                    whole row is the control and the box is the one the
                    checklist already draws. */}
                <button type="button" role="checkbox" aria-checked={reqForm.partDay} onClick={() => setReqForm({ ...reqForm, partDay: !reqForm.partDay, startTime: "", endTime: "" })} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: TAP, padding: 0, background: "none", border: "none", cursor: "pointer", fontSize: 14, color: t.text, fontFamily: FONT_BODY, textAlign: "left" }}>
                  <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: R.sm, border: "2px solid " + (reqForm.partDay ? GOLD : t.borderSolid), background: reqForm.partDay ? GOLD : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{reqForm.partDay && <CheckIco sz={12} c={NAVY} />}</span>
                  {tr("Part of the day")}
                </button>
                {reqForm.partDay && (
                  <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 120px", minWidth: 0 }}>
                      <label style={mkLabel(t)}>{tr("From")}</label>
                      <input type="time" value={reqForm.startTime} onChange={e => setReqForm({ ...reqForm, startTime: e.target.value })} style={{ ...mkInput(t), minHeight: 44 }} />
                    </div>
                    <div style={{ flex: "1 1 120px", minWidth: 0 }}>
                      <label style={mkLabel(t)}>{tr("To")}</label>
                      <input type="time" value={reqForm.endTime} onChange={e => setReqForm({ ...reqForm, endTime: e.target.value })} style={{ ...mkInput(t), minHeight: 44 }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <label style={mkLabel(t)}>{tr("Hours (optional)")}</label>
              <input type="number" min="0" step="0.25" value={reqForm.hours} onChange={e => setReqForm({ ...reqForm, hours: e.target.value })} placeholder={tr("For example, 8")} style={{ ...mkInput(t), minHeight: 44 }} />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={mkLabel(t)}>{tr("Reason (optional)")}</label>
              <textarea rows={3} maxLength={1000} value={reqForm.reason} onChange={e => setReqForm({ ...reqForm, reason: e.target.value })} style={{ ...mkInput(t), minHeight: 72, resize: "vertical", lineHeight: 1.5 }} />
              <div style={{ fontSize: 11, color: t.textMut, marginTop: 6, lineHeight: 1.4 }}>{tr("Only you and the person who approves time off can read this.")}</div>
            </div>

            <div style={{ fontSize: 11, color: t.textMut, marginBottom: 14, lineHeight: 1.4 }}>{tr("You get a notice in the app when your request is decided.")}</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setReqOpen(false)} disabled={reqBusy} style={{ flex: "1 1 120px", minHeight: 44, borderRadius: R.md, border: "1px solid " + t.borderSolid, background: "transparent", color: t.text, fontSize: 14, fontWeight: 600, cursor: reqBusy ? "default" : "pointer", fontFamily: FONT_HEAD }}>{tr("Cancel")}</button>
              <button onClick={sendRequest} disabled={reqBusy} style={{ flex: "1 1 120px", minHeight: 44, borderRadius: R.md, border: "1px solid " + GOLD, background: t.goldBg, color: t.goldText, fontSize: 14, fontWeight: 600, cursor: reqBusy ? "default" : "pointer", opacity: reqBusy ? 0.6 : 1, fontFamily: FONT_HEAD }}>{reqBusy ? tr("Sending...") : tr("Send request")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ONE TIME OFF REQUEST */}
      {offDetail && (
        <div onClick={() => !offBusy && setOffDetail(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.modalOverlay, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: "16px 16px 0 0", border: "1px solid " + t.borderSolid, width: "100%", maxWidth: 960, padding: "20px 20px 30px", boxShadow: t.popShadow, maxHeight: "calc(var(--ocsa-dvh, 100dvh) - 40px)", overflowY: "auto" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: t.textMut, margin: "0 auto 16px", opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 14, fontFamily: FONT_HEAD }}>{tr("Time off request")}</div>

            {offErr && <div style={{ padding: "10px 12px", marginBottom: 12, borderRadius: R.md, background: t.redSubtle, border: "1px solid " + t.redBorder, color: t.text, fontSize: 12, lineHeight: 1.5, overflowWrap: "anywhere" }}>{offErr}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div style={{ minWidth: 0 }}><div style={offLabel}>{tr("Type")}</div><div style={offValue}>{tr(offDetail.leaveTypeLabel || offDetail.leaveType || "")}</div></div>
              <div style={{ minWidth: 0 }}><div style={offLabel}>{tr("Status")}</div><div style={{ ...offValue, color: timeOffStatusColor(offDetail.status, t) }}>{timeOffStatusWord(offDetail.status)}</div></div>
              <div style={{ minWidth: 0 }}><div style={offLabel}>{tr("Dates")}</div><div style={offValue}>{timeOffDates(offDetail.startsOn, offDetail.endsOn)}</div></div>
              {offDetail.partDay && offDetail.startTime && offDetail.endTime && <div style={{ minWidth: 0 }}><div style={offLabel}>{tr("Time")}</div><div style={offValue}>{fmtTm(offDetail.startTime)} - {fmtTm(offDetail.endTime)}</div></div>}
              <div style={{ minWidth: 0 }}><div style={offLabel}>{tr("Hours")}</div><div style={offValue}>{timeOffHours(offDetail.hours) || tr("Not given")}</div></div>
              <div style={{ minWidth: 0 }}><div style={offLabel}>{tr("Asked")}</div><div style={offValue}>{offDetail.createdAt ? new Date(offDetail.createdAt).toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" }) : ""}</div></div>
              {offDetail.decidedAt && <div style={{ minWidth: 0 }}><div style={offLabel}>{tr("Decided")}</div><div style={offValue}>{new Date(offDetail.decidedAt).toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" })}</div></div>}
              {offDetail.cancelledAt && <div style={{ minWidth: 0 }}><div style={offLabel}>{tr("Cancelled")}</div><div style={offValue}>{new Date(offDetail.cancelledAt).toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" })}</div></div>}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={offLabel}>{tr("Reason")}</div>
              <div style={{ ...offValue, lineHeight: 1.5, overflowWrap: "anywhere" }}>{offDetail.reason || tr("No reason given")}</div>
            </div>

            {offDetail.decidedAt && (
              <div style={{ marginBottom: 14 }}>
                <div style={offLabel}>{tr("Note")}</div>
                <div style={{ ...offValue, lineHeight: 1.5, overflowWrap: "anywhere" }}>{offDetail.decisionNote || tr("No note")}</div>
              </div>
            )}

            {Array.isArray(offDetail.shifts) && offDetail.shifts.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={offLabel}>{tr("Shifts on these days")}</div>
                {offDetail.shifts.map(sh => (
                  <div key={sh.id} style={{ fontSize: 12, color: t.text, marginTop: 4, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                    {timeOffDates(sh.date, sh.date)}{sh.startTime ? "  " + fmtTm(sh.startTime) + (sh.endTime ? " - " + fmtTm(sh.endTime) : "") : ""}{sh.siteName ? "  " + sh.siteName : ""}
                  </div>
                ))}
              </div>
            )}

            {offDetail.status === "requested" && !confirmCancel && (
              <button onClick={() => setConfirmCancel(true)} disabled={offBusy} style={{ width: "100%", minHeight: 44, marginBottom: 10, borderRadius: R.md, border: "1px solid " + RED, background: "transparent", color: RED, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Cancel request")}</button>
            )}
            {confirmCancel && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: t.text, lineHeight: 1.5, marginBottom: 10 }}>{tr("Cancel this time off request?")}</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => setConfirmCancel(false)} disabled={offBusy} style={{ flex: "1 1 120px", minHeight: 44, borderRadius: R.md, border: "1px solid " + t.borderSolid, background: "transparent", color: t.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Keep it")}</button>
                  <button onClick={cancelRequest} disabled={offBusy} style={{ flex: "1 1 120px", minHeight: 44, borderRadius: R.md, border: "1px solid " + RED, background: "transparent", color: RED, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: offBusy ? 0.6 : 1, fontFamily: FONT_HEAD }}>{offBusy ? tr("Sending...") : tr("Cancel request")}</button>
                </div>
              </div>
            )}

            <button onClick={() => setOffDetail(null)} style={{ width: "100%", minHeight: 44, borderRadius: R.md, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Close")}</button>
          </div>
        </div>
      )}

      {/* SHIFT DETAIL MODAL */}
      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.modalOverlay, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: "16px 16px 0 0", border: "1px solid " + t.borderSolid, width: "100%", maxWidth: 960, padding: "20px 20px 30px", boxShadow: t.popShadow }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: t.textMut, margin: "0 auto 16px", opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 14, fontFamily: FONT_HEAD }}>
              {detail.type === "scheduled" ? tr("Scheduled Shift") : detail.type === "actual" ? tr("Worked Shift") : tr("Pickup Shift")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 3, fontFamily: FONT_HEAD }}>{tr("Site")}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{detail.site_name || tr("N/A")}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 3, fontFamily: FONT_HEAD }}>{tr("Status")}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: detail.type === "actual" ? GREEN : detail.type === "pickup" ? (detail.status === "approved" ? GREEN : ORANGE) : t.goldText }}>
                  {detail.type === "actual" ? (detail.shift_status === "active" ? tr("On Site") : tr("Completed")) : detail.type === "pickup" ? statusWord(detail.status || "") : statusWord(detail.status || "scheduled")}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              {detail.type === "actual" ? (<>
                <div>
                  <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 3, fontFamily: FONT_HEAD }}>{tr("Shift Start")}</div>
                  <div style={{ fontSize: 13, color: t.text }}>{detail.clock_in_time ? fmtClockTm(detail.clock_in_time) : tr("N/A")}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 3, fontFamily: FONT_HEAD }}>{tr("Shift End")}</div>
                  <div style={{ fontSize: 13, color: detail.clock_out_time ? t.text : ORANGE }}>{detail.clock_out_time ? fmtClockTm(detail.clock_out_time) : tr("Still on site")}</div>
                </div>
              </>) : (<>
                <div>
                  <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 3, fontFamily: FONT_HEAD }}>{tr("Start")}</div>
                  <div style={{ fontSize: 13, color: t.text }}>{fmtTm(detail.start_time)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 3, fontFamily: FONT_HEAD }}>{tr("End")}</div>
                  <div style={{ fontSize: 13, color: t.text }}>{fmtTm(detail.end_time)}</div>
                </div>
              </>)}
            </div>
            {detail.type === "actual" && detail.duration_minutes && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 3, fontFamily: FONT_HEAD }}>{tr("Duration")}</div>
                <div style={{ fontSize: 13, color: t.text }}>{tr("{h}h {m}m", { h: Math.floor(detail.duration_minutes / 60), m: detail.duration_minutes % 60 })}</div>
              </div>
            )}
            {(detail.building_name || detail.floor_number) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                {detail.building_name && <div><div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 3, fontFamily: FONT_HEAD }}>{tr("Building")}</div><div style={{ fontSize: 13, color: t.text }}>{detail.building_name}</div></div>}
                {detail.floor_number && <div><div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 3, fontFamily: FONT_HEAD }}>{tr("Floor")}</div><div style={{ fontSize: 13, color: t.text }}>{detail.floor_number}</div></div>}
              </div>
            )}
            {detail.service_category && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 3, fontFamily: FONT_HEAD }}>{tr("Service")}</div>
                <div style={{ fontSize: 13, color: t.text }}>{detail.service_category}</div>
              </div>
            )}
            {detail.notes && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 3, fontFamily: FONT_HEAD }}>{tr("Notes")}</div>
                <div style={{ fontSize: 12, color: t.textSec, fontStyle: "italic" }}>{detail.notes}</div>
              </div>
            )}
            {detail.type === "pickup" && detail.origin && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 3, fontFamily: FONT_HEAD }}>{tr("Reason")}</div>
                <div style={{ fontSize: 13, color: t.text }}>{ORIGIN_WORDS[detail.origin] ? ORIGIN_WORDS[detail.origin]() : titleCase(detail.origin)}</div>
              </div>
            )}
            {detail.type === "scheduled" && detail.status !== "cancelled" && isDropRequested(detail.id) && (
              <div style={{ fontSize: 12, color: t.textSec, lineHeight: 1.5, marginBottom: 8 }}>{tr("You asked to drop this shift. Waiting for a decision.")}</div>
            )}
            {detail.type === "scheduled" && detail.status !== "cancelled" && !isDropRequested(detail.id) && !detail.dropForm && (
              <button onClick={() => setDetail({ ...detail, dropForm: { reason: "sick", notes: "" } })} style={{ width: "100%", padding: "11px", borderRadius: R.md, border: "1px solid " + RED, background: "transparent", color: RED, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 8 }}>{tr("Request to Drop This Shift")}</button>
            )}
            {detail.dropForm && (
              <div style={{ padding: 12, borderRadius: R.md, background: t.redSubtle, border: "1px solid " + t.redBorder, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: RED, marginBottom: 8 }}>{tr("Drop Request")}</div>
                <div style={{ fontSize: 10, color: t.textSec, marginBottom: 10 }}>{tr("Your supervisor will review this request. If approved, the shift will be opened for pickup or reassigned.")}</div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 4, fontFamily: FONT_HEAD }}>{tr("Reason")}</div>
                  <select value={detail.dropForm.reason} onChange={e => setDetail({ ...detail, dropForm: { ...detail.dropForm, reason: e.target.value } })} style={mkInput(t)}>
                    {(getOpts("drop_reasons").length > 0 ? getOpts("drop_reasons") : [{ v: "sick", l: tr("Sick") }, { v: "personal", l: tr("Personal") }, { v: "scheduling_conflict", l: tr("Scheduling Conflict") }, { v: "emergency", l: tr("Emergency") }, { v: "other", l: tr("Other") }]).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
                {lkHasOther("drop_reasons", detail.dropForm.reason) && <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 4, fontFamily: FONT_HEAD }}>{tr("Specify Reason")}</div>
                  <input value={detail.dropForm.otherText || ""} onChange={e => setDetail({ ...detail, dropForm: { ...detail.dropForm, otherText: e.target.value } })} placeholder={tr("Describe the reason")} style={mkInput(t)} />
                </div>}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 4, fontFamily: FONT_HEAD }}>{tr("Notes (optional)")}</div>
                  <input value={detail.dropForm.notes} onChange={e => setDetail({ ...detail, dropForm: { ...detail.dropForm, notes: e.target.value } })} placeholder={tr("Any additional details...")} style={mkInput(t)} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setDetail({ ...detail, dropForm: null })} style={{ flex: 1, padding: "11px", borderRadius: R.md, border: "1px solid " + t.borderSolid, background: "transparent", color: t.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{tr("Cancel")}</button>
                  <button onClick={async () => {
                    try {
                      // What was typed under Specify Reason is sent, with
                      // the Notes line under it when both were filled.
                      const other = (detail.dropForm.otherText || "").trim();
                      const extra = (detail.dropForm.notes || "").trim();
                      const notes = other && extra ? other + "\n" + extra : (other || extra || detail.dropForm.reason);
                      await api("/api/pickups/request-drop", { method: "POST", body: { scheduled_shift_id: detail.id, reason: detail.dropForm.reason, notes }, token });
                      setDetail(null);
                      showToast(tr("Drop request sent. Your supervisor will review it."));
                      loadSchedule();
                    } catch (e) { showToast(tr(e.message) || tr("Drop request failed"), "error"); }
                  }} style={{ flex: 1, padding: "11px", borderRadius: R.md, border: "none", background: RED, color: "#F8F7F4", fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: FONT_HEAD }}>{tr("Submit Request")}</button>
                </div>
              </div>
            )}
            <button onClick={() => setDetail(null)} style={{ width: "100%", minHeight: TAP, padding: "12px", borderRadius: R.md, border: "1px solid " + t.borderSolid, background: "transparent", color: t.text, fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>{tr("Close")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ClockView({ clockStatus, currentTime, selectedSite, pendingSite, startBlock, onSelectSite, onStartSession, onEndSession, siteChoices, loading, completedCount, taskCount, taskListLoaded, t }) {
  // The timer below is the one number on any screen wide enough to reach
  // the edge of its card, so this screen has to know the text size.
  const { textSize: clockTextSize } = useContext(TextSizeCtx);
  const clockZoom = zoomOf(clockTextSize);
  const ci = clockStatus?.clockedIn;
  const elapsed = ci && clockStatus.shift ? Math.floor((currentTime - new Date(clockStatus.shift.clockInTime)) / 1000) : 0;
  const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60;
  const pad = (n) => String(n).padStart(2, "0");
  // The bar counts the checklist's own list: this person's standard tasks
  // at the site, ticked ones over all of them. It is the list the Tasks
  // tab renders, filtered the same way, so the two never disagree. A
  // person with nothing assigned reads 0/0. Until the list has come back
  // there is nothing of this person's to count, so the bar waits.
  const total = taskCount || 0;
  const done = completedCount || 0;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const labelSt = mkLabel(t);
  const scheduled = siteChoices?.scheduled || [];
  const assigned = siteChoices?.assigned || [];
  const shown = new Set([...scheduled, ...assigned].map(x => x.siteId));
  const others = (siteChoices?.all || []).filter(x => !shown.has(x.siteId));
  const grouped = scheduled.length > 0 || assigned.length > 0;
  const groups = (grouped ? [{ label: tr("Scheduled Today"), items: scheduled }, { label: tr("Your Assigned Sites"), items: assigned }, { label: tr("All Other Sites"), items: others }] : [{ label: null, items: others }]).filter(g => g.items.length > 0);
  const pendingRow = pendingSite ? [...scheduled, ...assigned, ...others].find(x => x.siteId === pendingSite) : null;
  const pendingName = pendingRow ? pendingRow.siteName : "";
  const emptySt = { padding: "28px 20px", textAlign: "center", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, fontSize: 13, color: t.textMut, boxShadow: t.shadow };
  const groupHeadSt = { fontSize: 10, color: t.textMut, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, margin: "6px 0 8px", fontFamily: FONT_HEAD };
  // Two highlights that must read differently. open is the site of the
  // shift in progress: gold fill, filled dot. picked is a choice not yet
  // started: gold outline, hollow gold dot. Rows go inert while a shift
  // is open, since the API refuses a second start until it is ended.
  const renderSite = (site, idx) => {
    const open = ci && selectedSite === site.siteId;
    const picked = !ci && pendingSite === site.siteId;
    const inert = loading || !!ci;
    const place = [site.address, site.city].filter(Boolean).join(", ");
    const detail = [site.buildingName, site.floorNumber ? tr("Floor {n}", { n: site.floorNumber }) : null].filter(Boolean).join(" - ");
    return (
      <button key={site.siteId + "-" + idx} onClick={() => { if (!inert) onSelectSite(site.siteId); }} disabled={inert} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", marginBottom: 10, background: open ? t.goldBg : t.card, border: open || picked ? "1.5px solid " + GOLD : "1px solid " + t.borderSolid, borderRadius: R.md, cursor: inert ? "default" : "pointer", color: t.text, textAlign: "left", opacity: loading || (ci && !open) ? 0.6 : 1, boxShadow: open || picked ? t.popShadow : t.shadow, transition: "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease" }}>
        <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: R.sm, display: "flex", alignItems: "center", justifyContent: "center", background: open ? t.goldSubtle : t.hover, border: "1px solid " + (open || picked ? t.goldBorder : t.borderSolid) }}>
          <MapIco sz={18} c={open || picked ? GOLD : t.textMut} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{site.siteName}</div>
          {place && <div style={{ fontSize: 10, color: t.textSec, marginTop: 2 }}>{place}</div>}
          {detail && <div style={{ fontSize: 10, color: t.goldText, marginTop: 3, fontWeight: 600 }}>{detail}</div>}
        </div>
        <div style={{ width: 18, height: 18, flexShrink: 0, borderRadius: "50%", background: open ? GOLD : "transparent", border: open ? "none" : "2px solid " + (picked ? GOLD : t.borderSolid) }} />
      </button>
    );
  };
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ textAlign: "center", marginBottom: 24, marginTop: 4 }}>
        <div style={{ fontSize: 11, color: t.textMut, marginBottom: 6, letterSpacing: "0.3px", fontFamily: FONT_BODY }}>{formatDate(currentTime)}</div>
        <div style={{ fontSize: 44, fontWeight: 600, color: t.text, letterSpacing: "-0.5px", lineHeight: 1, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{formatTime(currentTime)}</div>
      </div>
      {ci && clockStatus.shift && (
        <div style={{ textAlign: "center", padding: "20px 18px", marginBottom: 16, background: t.card, borderRadius: R.lg, border: "1px solid " + t.goldBorder, boxShadow: t.popShadow }}>
          <div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8, fontWeight: 600, fontFamily: FONT_HEAD }}>{tr("Time on Site")}</div>
          <div style={{ fontSize: timerFontSize(40, clockZoom), fontWeight: 600, letterSpacing: "1px", color: t.text, lineHeight: 1, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{pad(h)}:{pad(m)}:{pad(s)}</div>
          <div style={{ fontSize: 11, color: t.textSec, marginTop: 8 }}>{sameLocalDay(clockStatus.shift.clockInTime, currentTime) ? tr("Started at {time}", { time: formatTime(clockStatus.shift.clockInTime) }) : tr("Started {day} at {time}", { day: formatDayShort(clockStatus.shift.clockInTime), time: formatTime(clockStatus.shift.clockInTime) })}</div>
          <div style={{ fontSize: 12, color: t.text, marginTop: 4, fontWeight: 600 }}>{clockStatus.shift.siteName}</div>
          {(clockStatus.shift.buildingName || clockStatus.shift.floorNumber) && <div style={{ fontSize: 11, color: t.goldText, marginTop: 3 }}>{clockStatus.shift.buildingName}{clockStatus.shift.floorNumber ? " - " + tr("Floor {n}", { n: clockStatus.shift.floorNumber }) : ""}</div>}
          {taskListLoaded && (<div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><div style={{ flex: 1, maxWidth: 180, height: 6, borderRadius: R.pill, background: t.cardAlt, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: R.pill, background: pct === 100 ? GREEN : "linear-gradient(90deg," + GOLD + "," + GOLD_LIGHT + ")", width: pct + "%", transition: "width 0.3s ease" }} /></div><span style={{ fontSize: 11, color: t.goldText, fontWeight: 600, fontFamily: FONT_HEAD }}>{done}/{total}</span></div>)}
          <button onClick={onEndSession} disabled={loading} style={{ ...mkPrimaryBtn(t, loading), marginTop: 16 }}>{loading ? tr("Ending...") : tr("End Shift")}</button>
        </div>
      )}
      {startBlock && <div style={{ padding: "12px 14px", marginBottom: 16, background: t.orangeSubtle, borderRadius: R.md, border: "1px solid " + t.orangeBorder, boxShadow: t.shadow, fontSize: 12, color: ORANGE, lineHeight: 1.5 }}>{startBlock}</div>}
      <div style={{ marginBottom: 16 }}>
        <label style={{ ...labelSt, display: "block", marginBottom: 10 }}>{ci && clockStatus.shift ? tr("Shift Open at {site}", { site: clockStatus.shift.siteName }) : tr("Choose a Site to Start")}</label>
        {!siteChoices && <div style={emptySt}>{tr("Loading sites...")}</div>}
        {siteChoices && groups.length === 0 && <div style={emptySt}>{tr("No sites available yet.")}</div>}
        {siteChoices && groups.map((g, gi) => (<div key={gi}>{g.label && <div style={groupHeadSt}>{g.label}</div>}{g.items.map(renderSite)}</div>))}
        {siteChoices && groups.length > 0 && !ci && (
          <button onClick={() => onStartSession(pendingSite)} disabled={!pendingSite || loading} style={{ ...mkPrimaryBtn(t, loading || !pendingSite), marginTop: 4, cursor: !pendingSite || loading ? "default" : "pointer" }}>{loading ? tr("Starting...") : pendingSite ? tr("Start Shift at {site}", { site: pendingName }) : tr("Start Shift")}</button>
        )}
      </div>
    </div>
  );
}

function groupTasksByFloorZone(taskList) {
  const groups = []; const floorMap = {};
  taskList.forEach(t => { const floor = t.floor_number || null; const zone = t.zone || tr("General"); const key = (floor || "_none_") + "|" + zone; if (!floorMap[key]) { floorMap[key] = { floor, zone, tasks: [] }; groups.push(floorMap[key]); } floorMap[key].tasks.push(t); });
  groups.sort((a, b) => { if (a.floor && !b.floor) return -1; if (!a.floor && b.floor) return 1; if (a.floor && b.floor && a.floor !== b.floor) { const aNum = parseInt(a.floor); const bNum = parseInt(b.floor); if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum; return a.floor.localeCompare(b.floor); } return a.zone.localeCompare(b.zone); });
  return groups;
}
// The checklist and the Home card count the same list through the same
// filter. Both call this, so the two numbers cannot drift apart.
function standardTasksOf(taskList) {
  return (Array.isArray(taskList) ? taskList : []).filter(tk => !tk.task_type || tk.task_type === "standard");
}

function TasksView({ clockStatus, tasks, tasksFailed, onRetryTasks, completedTaskIds, toggleTask, t }) {
  const [detail, setDetail] = useState(null);
  const loaded = Array.isArray(tasks);
  const standardTasks = standardTasksOf(tasks);
  const labelSt = mkLabel(t);
  const floorHeadSt = { fontSize: 11, color: t.text, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8, padding: "7px 11px", background: t.card, borderRadius: R.sm, border: "1px solid " + t.borderSolid, fontFamily: FONT_HEAD };
  const zoneSt = { fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 600, marginBottom: 8, fontFamily: FONT_HEAD };
  const rowBase = { display: "flex", alignItems: "flex-start", flexWrap: "wrap", gap: 11, padding: "11px 13px", marginBottom: 6, borderRadius: R.md, boxShadow: t.shadow };
  const chipPriority = { fontSize: 9, color: ORANGE, background: t.orangeSubtle, border: "1px solid " + t.orangeBorder, padding: "2px 6px", borderRadius: R.sm, fontWeight: 600, letterSpacing: "0.5px" };
  const chipCat = { fontSize: 9, color: t.textMut, background: t.cardAlt, padding: "2px 6px", borderRadius: R.sm, fontWeight: 600 };
  const detailSecLabel = { fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 6, fontFamily: FONT_HEAD };

  if (!clockStatus?.clockedIn) return (
    <div style={{ padding: "16px" }}>
      <div style={{ padding: "12px 14px", marginBottom: 14, background: t.orangeSubtle, borderRadius: R.md, border: "1px solid " + t.orangeBorder, boxShadow: t.shadow }}><div style={{ fontSize: 12, color: ORANGE }}>{tr("Start your shift to see and check off your tasks.")}</div></div>
      {standardTasks.length === 0 ? <EmptyState icon={CheckIco} text={tr("No tasks loaded. Start your shift at a site to see your checklist.")} t={t} /> : (() => {
        const groups = groupTasksByFloorZone(standardTasks); let lastFloor = undefined;
        return groups.map((g, gi) => { const showFloor = g.floor && g.floor !== lastFloor; lastFloor = g.floor; return (<div key={gi} style={{ marginBottom: 16 }}>{showFloor && (<div style={{ ...floorHeadSt, marginTop: gi > 0 ? 10 : 0 }}>{tr("Floor")} {g.floor}</div>)}<div style={{ ...zoneSt, paddingLeft: g.floor ? 8 : 0 }}>{g.zone}</div>{g.tasks.map(task => { const hasInfo = task.has_details || task.description || task.media_url; return (<div key={task.id} onClick={() => hasInfo ? setDetail(task) : null} style={{ ...rowBase, background: t.card, border: "1px solid " + t.borderSolid, cursor: hasInfo ? "pointer" : "default", opacity: 0.6, marginLeft: g.floor ? 8 : 0 }}><div style={{ width: 22, height: 22, borderRadius: R.sm, border: "2px solid " + t.textMut, background: "transparent", flexShrink: 0, marginTop: 1 }} /><div style={{ flex: 1, fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 5, color: t.text }}>{task.label}{hasInfo && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: BLUE, flexShrink: 0 }} />}</div></div>); })}</div>); });
      })()}
    </div>
  );
  if (!loaded && tasksFailed) return (
    <div style={{ padding: "48px 24px", textAlign: "center", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, boxShadow: t.shadow, margin: 16 }}>
      <CheckIco sz={40} c={t.borderSolid} />
      <div style={{ fontSize: 15, color: t.textMut, marginTop: 16, fontFamily: FONT_HEAD }}>{tr("Your tasks did not load.")}</div>
      <button onClick={onRetryTasks} style={{ minHeight: 44, marginTop: 16, padding: "0 20px", borderRadius: R.md, border: "1px solid " + t.goldBorder, background: t.goldBg, color: t.goldText, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Try again")}</button>
    </div>
  );
  if (!loaded) return <EmptyState icon={CheckIco} text={tr("Loading tasks...")} t={t} />;
  if (standardTasks.length === 0) return <EmptyState icon={CheckIco} text={tr("No checklist is set up for this building yet.")} t={t} />;
  const groups = groupTasksByFloorZone(standardTasks);
  const completed = standardTasks.filter(tk => completedTaskIds.has(tk.id)).length;
  const pct = Math.round((completed / standardTasks.length) * 100);

  if (detail) {
    const done = completedTaskIds.has(detail.id);
    return (
      <div style={{ padding: "16px" }}>
        <button onClick={() => setDetail(null)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", marginBottom: 14, background: "transparent", border: "1px solid " + t.borderSolid, borderRadius: R.md, color: t.textSec, fontSize: 12, cursor: "pointer", fontWeight: 600 }}><Ico d="M15 18l-6-6 6-6" sz={14} c={t.textSec} /> {tr("Back to checklist")}</button>
        <div style={{ background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.lg, overflow: "hidden", boxShadow: t.popShadow }}>
          <div style={{ padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}><div style={{ fontSize: 16, fontWeight: 600, flex: 1, color: t.text, fontFamily: FONT_HEAD }}>{detail.label}</div><div style={{ display: "flex", gap: 4, flexShrink: 0 }}>{detail.priority === "high" && <span style={chipPriority}>{tr("PRIORITY")}</span>}<span style={chipCat}>{detail.cims_category}</span></div></div>
            <div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12, fontWeight: 600, fontFamily: FONT_HEAD }}>{detail.floor_number ? tr("Floor {n}", { n: detail.floor_number }) + " - " : ""}{detail.zone}</div>
            {detail.description && (<div style={{ marginBottom: 14 }}><div style={detailSecLabel}>{tr("Instructions")}</div><div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{detail.description}</div></div>)}
            {detail.media_url && detail.media_type === "video" && (<div style={{ marginBottom: 14 }}><div style={detailSecLabel}>{tr("Reference Video")}</div><video src={detail.media_url} controls style={{ width: "100%", borderRadius: R.md, maxHeight: 240 }} /></div>)}
            {detail.media_url && detail.media_type !== "video" && (<div style={{ marginBottom: 14 }}><div style={detailSecLabel}>{tr("Reference Photo")}</div><img src={detail.media_url} alt={tr("Task reference")} style={{ width: "100%", borderRadius: R.md, maxHeight: 240, objectFit: "cover" }} /></div>)}
            {detail.due_date && (<div style={{ display: "flex", gap: 12, marginBottom: 14 }}><div style={{ fontSize: 11, color: t.textMut }}>{tr("Due Date:")} <span style={{ color: t.text, fontWeight: 500 }}>{new Date(detail.due_date).toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" })}</span></div>{detail.due_time && <div style={{ fontSize: 11, color: t.textMut }}>{tr("Time:")} <span style={{ color: t.text, fontWeight: 500 }}>{clockTime(detail.due_time)}</span></div>}</div>)}
          </div>
          <button onClick={() => { toggleTask(detail.id); setDetail(null); }} style={{ width: "100%", padding: "14px", border: "none", background: done ? t.cardAlt : "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")", color: done ? t.textMut : NAVY, fontSize: 14, fontWeight: 600, cursor: "pointer", textTransform: "uppercase", letterSpacing: "1px", fontFamily: FONT_HEAD }}>{done ? tr("Uncheck Task") : tr("Mark Complete")}</button>
        </div>
      </div>
    );
  }

  let lastFloor = undefined;
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ padding: "14px 16px", marginBottom: 16, background: t.goldBg, borderRadius: R.lg, border: "1px solid " + t.goldBorder, boxShadow: t.popShadow }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, fontFamily: FONT_HEAD }}>{tr("Your Assignment")}</div><div style={{ fontSize: 15, fontWeight: 600, marginTop: 3, color: t.text, fontFamily: FONT_HEAD }}>{clockStatus.shift.siteName}</div>{(clockStatus.shift.buildingName || clockStatus.shift.floorNumber) && <div style={{ fontSize: 11, color: t.textSec, marginTop: 2 }}>{clockStatus.shift.buildingName}{clockStatus.shift.floorNumber ? " - " + tr("Floor {n}", { n: clockStatus.shift.floorNumber }) : ""}</div>}</div><div style={{ background: pct === 100 ? t.greenSubtle : t.card, padding: "6px 14px", borderRadius: R.pill, border: "1px solid " + (pct === 100 ? t.greenBorder : t.borderSolid) }}><div style={{ fontSize: 18, fontWeight: 600, color: pct === 100 ? GREEN : t.goldText, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{pct}%</div></div></div>
        <div style={{ height: 5, borderRadius: R.pill, background: t.cardAlt, marginTop: 12, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: R.pill, background: pct === 100 ? GREEN : "linear-gradient(90deg," + GOLD + "," + GOLD_LIGHT + ")", width: pct + "%", transition: "width 0.4s ease" }} /></div>
      </div>
      {groups.map((g, gi) => { const showFloor = g.floor && g.floor !== lastFloor; lastFloor = g.floor; return (<div key={gi} style={{ marginBottom: 16 }}>{showFloor && (<div style={{ ...floorHeadSt, marginTop: gi > 0 ? 10 : 0 }}>{tr("Floor")} {g.floor}</div>)}<div style={{ ...zoneSt, paddingLeft: g.floor ? 8 : 0 }}>{g.zone}</div>{g.tasks.map(task => { const done = completedTaskIds.has(task.id); const hasInfo = task.has_details || task.description || task.media_url; return (<div key={task.id} style={{ ...rowBase, background: done ? t.greenSubtle : t.card, border: done ? "1px solid " + t.greenBorder : "1px solid " + t.borderSolid, marginLeft: g.floor ? 8 : 0 }}><button onClick={() => toggleTask(task.id)} aria-label={tr(done ? "Mark {name} not done" : "Mark {name} done", { name: task.label })} style={mkTapFrame({ flexShrink: 0, marginTop: 1 })}><span style={{ width: 22, height: 22, borderRadius: R.sm, border: "2px solid " + (done ? GREEN : t.textMut), background: done ? GREEN : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{done && <CheckIco sz={12} c="#F8F7F4" />}</span></button><div onClick={() => hasInfo ? setDetail(task) : toggleTask(task.id)} style={{ flex: "1 1 120px", minWidth: 0, cursor: "pointer" }}><div style={{ fontSize: 12, fontWeight: 500, textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1, display: "flex", alignItems: "center", gap: 5, color: t.text }}>{task.label}{hasInfo && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: BLUE, flexShrink: 0 }} />}</div></div><div style={{ display: "flex", gap: 4, flexShrink: 0, marginTop: 2 }}>{task.priority === "high" && <span style={chipPriority}>{tr("PRIORITY")}</span>}<span style={chipCat}>{task.cims_category}</span></div></div>); })}</div>); })}
    </div>
  );
}

function ChatView({ channels, messages, activeChannel, setActiveChannel, sendMessage, user, t, token }) {
  const [text, setText] = useState(""); const endRef = useRef(null);
  useBusy("chat composer", text.trim().length > 0);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  const siteChannels = channels.filter(c => c.type === "site" || c.type === "general");
  const dmChannel = channels.find(c => c.type === "admin_dm");
  const isDm = activeChannel && dmChannel && activeChannel === dmChannel.id;
  const handleSend = () => { if (!text.trim() || !activeChannel) return; sendMessage(activeChannel, text.trim()); setText(""); };
  return (
    // The same ceiling every other full height screen carries. Chat
    // subtracted 128 where Help and Forms subtracted 136, and had no
    // maxHeight, so at the Largest text size the page grew past the
    // viewport, a vertical scrollbar appeared, and the bottom bar,
    // whose width is 100 percent of the initial containing block, came
    // out 10 pixels wider than the screen and scrolled it sideways.
    <div style={{ display: "flex", flexDirection: "column", flex: "0 0 auto", ...fillsTheWindow(), minHeight: 0, overflow: "hidden" }}>
      <div style={{ padding: "10px 12px 0", borderBottom: "1px solid " + t.borderSolid, paddingBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>{siteChannels.map(ch => (<button key={ch.id} onClick={() => setActiveChannel(ch.id)} style={mkTapFrame()}><span style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: R.pill, border: activeChannel === ch.id ? "1px solid " + t.goldBorder : "1px solid transparent", background: activeChannel === ch.id ? t.goldBg : "transparent", color: activeChannel === ch.id ? t.goldText : t.textMut, fontSize: 11, fontWeight: activeChannel === ch.id ? 600 : 500, fontFamily: FONT_HEAD }}>{ch.name || ch.siteName}</span></button>))}</div>
        {dmChannel && (<button onClick={() => setActiveChannel(dmChannel.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: TAP, padding: "8px 12px", borderRadius: R.md, background: isDm ? t.blueSubtle : t.hover, border: isDm ? "1.5px solid " + t.blueBorder : "1px solid " + t.borderSolid, boxShadow: isDm ? t.popShadow : t.shadow, cursor: "pointer", color: t.text, textAlign: "left" }}><LockIco c={isDm ? BLUE : t.textMut} /><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: isDm ? 600 : 500, color: isDm ? BLUE : t.textSec, fontFamily: FONT_HEAD }}>{tr("Admin (Private)")}</div><div style={{ fontSize: 9, color: t.textMut }}>{tr("Only you and management can see these messages")}</div></div>{dmChannel.unreadCount > 0 && <div style={{ background: t.badgeBg, color: badgeInk(t), fontSize: 9, fontWeight: 600, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{dmChannel.unreadCount}</div>}</button>)}
      </div>
      {isDm && (<div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: t.blueSubtle, borderBottom: "1px solid " + t.blueBorder, fontSize: 10, color: BLUE }}><LockIco /> {tr("Private conversation with admin.")}</div>)}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 12px 0" }}>
        {!activeChannel && <div style={{ textAlign: "center", padding: "40px 20px" }}><ChatIco sz={32} c={t.borderSolid} /><div style={{ fontSize: 13, color: t.textMut, marginTop: 12, fontFamily: FONT_HEAD }}>{tr("Select a channel to start chatting.")}</div></div>}
        {activeChannel && messages.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", fontSize: 13, color: t.textMut, fontFamily: FONT_HEAD }}>{tr("No messages yet.")}</div>}
        {messages.map((msg, idx) => { const isMe = msg.senderId === user?.id; const isAdm = msg.senderRole === "admin" || msg.senderRole === "supervisor"; const showName = idx === 0 || messages[idx - 1].senderId !== msg.senderId; return (<div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, marginBottom: showName ? 12 : 4, alignItems: "flex-end" }}>{!isMe && showName && (<div style={{ width: 28, height: 28, borderRadius: "50%", background: isAdm ? (isDm ? "rgba(36,164,244,0.15)" : t.goldBg) : t.cardAlt, border: "1px solid " + (isAdm ? (isDm ? BLUE : GOLD) : t.borderSolid), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: isAdm ? (isDm ? BLUE : t.goldText) : t.textSec, flexShrink: 0, fontFamily: FONT_HEAD }}>{msg.senderName?.split(" ").map(n => n[0]).join("")}</div>)}{!isMe && !showName && <div style={{ width: 28, flexShrink: 0 }} />}<div style={{ maxWidth: "75%" }}>{!isMe && showName && <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3, color: isAdm ? (isDm ? BLUE : t.goldText) : t.textSec, fontFamily: FONT_HEAD }}>{msg.senderName}</div>}<div style={{ padding: "8px 12px", borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: isMe ? (isDm ? BLUE : GOLD) : (isDm && isAdm ? t.blueSubtle : t.card), border: isMe ? "none" : "1px solid " + (isDm && isAdm ? t.blueBorder : t.borderSolid), color: isMe ? (isDm ? "#F8F7F4" : NAVY) : t.text, fontSize: 13, lineHeight: 1.45 }}>{msg.text}</div><div style={{ fontSize: 9, color: t.textMut, marginTop: 2, textAlign: isMe ? "right" : "left", fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{formatTime(msg.sentAt)}</div></div></div>); })}
        <div ref={endRef} />
      </div>
      <div style={{ padding: "10px 12px", borderTop: "1px solid " + (isDm ? t.blueBorder : t.borderSolid), display: "flex", gap: 8, alignItems: "center", background: t.bg }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder={isDm ? tr("Private message to admin...") : tr("Type a message...")} style={{ flex: 1, minHeight: TAP, padding: "10px 14px", borderRadius: R.pill, border: "1px solid " + (isDm ? t.blueBorder : t.borderSolid), background: t.card, color: t.text, fontSize: 13, outline: "none", fontFamily: FONT_BODY }} onKeyDown={e => e.key === "Enter" && handleSend()} />
        <button onClick={handleSend} aria-label={tr("Send")} style={mkTapFrame({ flexShrink: 0, cursor: text.trim() ? "pointer" : "default" })}><span style={{ width: 38, height: 38, borderRadius: "50%", background: text.trim() ? (isDm ? BLUE : GOLD) : t.cardAlt, boxShadow: text.trim() && !isDm ? "0 6px 18px rgba(231,176,23,0.30)" : "none", display: "flex", alignItems: "center", justifyContent: "center" }}><SendIco sz={16} c={text.trim() ? (isDm ? "#F8F7F4" : NAVY) : t.textMut} /></span></button>
      </div>
    </div>
  );
}

// Help tab. Every line of guidance on this screen came back from the API on
// the turn that produced it. Nothing procedural is stored, cached or written
// here, and a reply the API did not return is never shown.
const agentField = (o, keys, fallback) => { for (const k of keys) { if (o && o[k] !== undefined && o[k] !== null) return o[k]; } return fallback; };
const agentList = (d, keys) => { if (Array.isArray(d)) return d; for (const k of keys) { if (d && Array.isArray(d[k])) return d[k]; } return []; };
const agentKeyWords = (k) => String(k).replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/^\w/, c => c.toUpperCase());
// One line of a missing list. The API names the question and, for a
// table or a checklist, the rows still short an answer. A refusal that
// carries only keys reads the way it always has.
const agentMissingLine = (m) => {
  if (m && typeof m === "object") {
    const label = m.label ? String(m.label) : agentKeyWords(m.key || "");
    const rows = Array.isArray(m.rows) ? m.rows.filter(Boolean) : [];
    return rows.length > 0 ? label + ": " + rows.join(", ") : label;
  }
  return agentKeyWords(m);
};
const agentDraftId = (d) => agentField(d, ["id", "formResponseId", "form_response_id"], null);
// No fallback here: the word a missing name falls back to is drawn on
// screen, so it is translated at each call site instead.
const agentName = (d) => agentField(d, ["formName", "formTitle", "form_name", "title", "formCode", "form_code"], null);
const agentCount = (d) => { const a = agentField(d, ["answered", "answeredCount", "answered_count"], null), r = agentField(d, ["remaining", "remainingCount", "remaining_count"], null); return (a !== null && r !== null) ? tr("{answered} of {total} answered", { answered: a, total: Number(a) + Number(r) }) : null; };

// A reply may carry numbered steps and a bold word. These two turn one into
// a list of lines, each holding inline parts, and nothing else. The admin
// dashboard uses the same pair, so the two apps read a reply the same way.
// Pure: no DOM, no React, no HTML. What comes out is rendered as React
// elements, so no markup in a reply ever reaches the page.
function agentInlineParts(line) {
  const s = String(line == null ? "" : line);
  const out = [];
  let i = 0;
  while (i < s.length) {
    const open = s.indexOf("**", i);
    // No opener left, or an opener with no partner: the rest is literal.
    if (open === -1) { out.push({ bold: false, text: s.slice(i) }); break; }
    const close = s.indexOf("**", open + 2);
    if (close === -1) { out.push({ bold: false, text: s.slice(i) }); break; }
    if (open > i) out.push({ bold: false, text: s.slice(i, open) });
    out.push({ bold: true, text: s.slice(open + 2, close) });
    i = close + 2;
  }
  if (out.length === 0) out.push({ bold: false, text: "" });
  return out;
}

function agentReplyParts(text) {
  return String(text == null ? "" : text).split("\n").map(line => {
    // Bold never spans lines, so each line is read on its own.
    const m = /^\s*(\d{1,2})\.\s+(.+)$/.exec(line);
    if (m) return { type: "step", number: m[1], parts: agentInlineParts(m[2]) };
    return { type: "line", parts: agentInlineParts(line) };
  });
}

function AgentInline({ parts }) {
  return <>{parts.map((p, i) => p.bold ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>)}</>;
}

function AgentReply({ text }) {
  const lines = agentReplyParts(text);
  return (
    <>
      {lines.map((ln, i) => {
        if (ln.type === "step") {
          return (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, fontWeight: 600 }}>{ln.number}.</span>
              <span style={{ flex: 1, minWidth: 0 }}><AgentInline parts={ln.parts} /></span>
            </div>
          );
        }
        const empty = ln.parts.length === 1 && ln.parts[0].text === "";
        if (empty) return <div key={i} style={{ height: "0.7em" }} />;
        return <div key={i}><AgentInline parts={ln.parts} /></div>;
      })}
    </>
  );
}

function AgentView({ token, showToast, t, language, onFillForm, conversationId, onConversation }) {
  // The same shape the Forms screen uses, so a Spanish screen never
  // lists English form names.
  const locale = language === "es" ? "es" : "en";
  const [drafts, setDrafts] = useState([]);
  // Held at the root, the way the forms draft is, so switching tabs and
  // coming back continues the same conversation. The thread below stays
  // here and is drawn again from the conversation.
  const setConversationId = onConversation;
  const [thread, setThread] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [formResponse, setFormResponse] = useState(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [missing, setMissing] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const endRef = useRef(null); const taRef = useRef(null); const seqRef = useRef(0);
  const inputSt = mkInput(t);

  // Photos waiting to go with the next message. Each one holds the object
  // URL its thumbnail is drawn from, the prepared bytes, and the storage
  // path once its upload has answered.
  const [photos, setPhotos] = useState([]);
  const [photoProblem, setPhotoProblem] = useState(null);
  const fileRef = useRef(null);
  const photosRef = useRef([]);
  useEffect(() => { photosRef.current = photos; }, [photos]);
  // Every object URL made here, so none outlives the tab. A URL a sent
  // message is still showing is kept until then.
  const objectUrls = useRef([]);
  const newObjectUrl = (blob) => { const u = URL.createObjectURL(blob); objectUrls.current.push(u); return u; };
  useEffect(() => () => { objectUrls.current.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} }); objectUrls.current = []; }, []);

  // One upload at a time, in the order the photos were picked.
  const uploadQueue = useRef([]);
  const uploadRunning = useRef(false);
  const runUploads = useCallback(async () => {
    if (uploadRunning.current) return;
    uploadRunning.current = true;
    while (uploadQueue.current.length > 0) {
      const item = uploadQueue.current.shift();
      try {
        const path = await uploadAgentPhoto(item.blob, token);
        setPhotos(prev => prev.map(p => p.id === item.id ? { ...p, path, status: "done", error: null } : p));
      } catch (err) {
        setPhotos(prev => prev.map(p => p.id === item.id ? { ...p, status: "failed", error: tr(err.message) } : p));
      }
    }
    uploadRunning.current = false;
  }, [token]);

  const queueUpload = useCallback((id, blob) => {
    uploadQueue.current.push({ id, blob });
    runUploads();
  }, [runUploads]);

  // Picked from the file chooser, or pasted into the composer.
  const addPhotoFiles = useCallback(async (fileList) => {
    const incoming = Array.from(fileList || []).filter(f => f && (!f.type || f.type.indexOf("image/") === 0));
    if (incoming.length === 0) return;
    setPhotoProblem(null);
    for (let i = 0; i < incoming.length; i++) {
      if (photosRef.current.length >= AGENT_PHOTO_LIMIT) break;
      const id = "ph" + (++seqRef.current);
      const placeholder = { id, url: null, path: null, status: "preparing", error: null };
      photosRef.current = photosRef.current.concat([placeholder]);
      setPhotos(photosRef.current);
      let blob;
      try { blob = await prepareAgentPhoto(incoming[i]); }
      catch (err) {
        photosRef.current = photosRef.current.filter(p => p.id !== id);
        setPhotos(photosRef.current);
        setPhotoProblem(tr(AGENT_PHOTO_UNREADABLE));
        continue;
      }
      const url = newObjectUrl(blob);
      photosRef.current = photosRef.current.map(p => p.id === id ? { ...p, url, status: "uploading" } : p);
      setPhotos(photosRef.current);
      queueUpload(id, blob);
    }
  }, [queueUpload]);

  const removePhoto = (id) => {
    setPhotoProblem(null);
    setPhotos(prev => {
      const gone = prev.find(p => p.id === id);
      if (gone && gone.url) {
        try { URL.revokeObjectURL(gone.url); } catch (e) {}
        objectUrls.current = objectUrls.current.filter(u => u !== gone.url);
      }
      return prev.filter(p => p.id !== id);
    });
  };

  const retryPhoto = async (id) => {
    const p = photosRef.current.find(x => x.id === id);
    if (!p || !p.url) return;
    setPhotos(prev => prev.map(x => x.id === id ? { ...x, status: "uploading", error: null } : x));
    try {
      const blob = await fetch(p.url).then(r => r.blob());
      queueUpload(id, blob);
    } catch (err) {
      setPhotos(prev => prev.map(x => x.id === id ? { ...x, status: "failed", error: tr(err.message) } : x));
    }
  };

  const loadDrafts = useCallback(async () => { try { const d = await api("/api/agent/drafts?locale=" + locale, { token }); setDrafts(agentList(d, ["drafts", "items", "rows"])); } catch (err) { console.warn("Drafts:", err.message); } }, [token, locale]);
  useEffect(() => { loadDrafts(); }, [loadDrafts]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [thread.length, formResponse]);
  // The composer grows to a few lines and then scrolls.
  const grow = (el) => { if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; };
  useEffect(() => { grow(taRef.current); }, [text]);

  // One request per press. While one is in flight the send button, the
  // composer and every Retry are disabled, so a person on bad signal
  // pressing three times sends once. No automatic retry anywhere.
  const send = async (msgId, msgText, paths) => {
    if (sending) return;
    setSending(true);
    setThread(prev => prev.map(m => m.id === msgId ? { ...m, pending: true, failed: false, error: null } : m));
    try {
      // text is always present, empty when the message is photos alone.
      // app says which app the message came from, so the API can tell one
      // typed in the staff portal from one sent anywhere else. This is the
      // only place a message body is built, so the first send, a message
      // carrying photos and a Retry all say it. The API ignores the key
      // until it reads it.
      const body = { text: msgText, app: "portal" };
      // The chosen language rides along, because the message route takes a
      // locale and otherwise falls back to the language on the account,
      // which nothing in the portal can set until the preference routes are
      // live. With it, the choice in Settings works on the next message.
      if (language === "en" || language === "es") body.locale = language;
      if (paths && paths.length > 0) body.photoPaths = paths;
      if (conversationId) body.conversationId = conversationId;
      const data = await api("/api/agent/message", { method: "POST", body, token });
      if (data.conversationId) setConversationId(data.conversationId);
      // The composer clears only now, and only if it still holds what was sent.
      setText(prev => prev.trim() === msgText ? "" : prev);
      setPhotos(prev => (prev.length > 0 && paths && paths.length > 0) ? [] : prev);
      setThread(prev => [...prev.map(m => m.id === msgId ? { ...m, pending: false } : m), { id: "a" + (++seqRef.current), role: "assistant", text: String(data.reply || ""), citedDocs: Array.isArray(data.citedDocs) ? data.citedDocs : [], degraded: data.degraded === true, noProcedure: data.noProcedure === true }]);
      if (data.formResponse) { setFormResponse(data.formResponse); setMissing([]); setSubmitted(false); }
    } catch (err) {
      setThread(prev => prev.map(m => m.id === msgId ? { ...m, pending: false, failed: true, error: tr(err.message) } : m));
    }
    setSending(false);
  };
  const handleSend = () => {
    if (!canSend) return;
    const v = text.trim();
    const ready = photos.filter(p => p.status === "done" && p.path);
    const paths = ready.map(p => p.path);
    const urls = ready.map(p => p.url);
    const id = "u" + (++seqRef.current);
    setThread(prev => [...prev, { id, role: "user", text: v, photoPaths: paths, photoUrls: urls, pending: true }]);
    send(id, v, paths);
  };

  // Resume reads the draft row. With a conversation id on it the thread is
  // loaded from the API. Without one the composer opens and the API reuses
  // the recent conversation on its own.
  const resume = async (d) => {
    setFormResponse({ id: agentDraftId(d), formCode: agentField(d, ["formCode", "form_code"], ""), formName: agentField(d, ["formName", "formTitle", "form_name", "title"], null), status: agentField(d, ["status"], "draft"), answered: agentField(d, ["answered", "answeredCount", "answered_count"], null), remaining: agentField(d, ["remaining", "remainingCount", "remaining_count"], null), nextQuestion: agentField(d, ["nextQuestion", "next_question"], null) });
    setMissing([]); setSubmitted(false);
    const cid = agentField(d, ["conversationId", "conversation_id"], null);
    if (cid) {
      try {
        const h = await api("/api/agent/conversations/" + cid + "?locale=" + locale, { token });
        const list = agentList(h, ["messages", "turns", "history"]);
        setThread(list.map((m, i) => ({ id: "h" + i, role: String(agentField(m, ["role", "sender"], "assistant")).toLowerCase() === "user" ? "user" : "assistant", text: String(agentField(m, ["text", "content", "reply"], "")), citedDocs: agentList(agentField(m, ["citedDocs", "cited_doc_codes", "citedDocCodes"], []), []), degraded: agentField(m, ["degraded"], false) === true, noProcedure: agentField(m, ["noProcedure", "no_procedure"], false) === true })));
        setConversationId(cid);
      } catch (err) { showToast(tr(err.message), "error"); }
    }
    taRef.current?.focus();
  };

  const submit = async () => {
    if (!formResponse || submitBusy) return;
    setSubmitBusy(true); setMissing([]);
    try { await api("/api/agent/drafts/" + formResponse.id + "/submit?locale=" + locale, { method: "POST", token }); setFormResponse(null); setSubmitted(true); loadDrafts(); }
    catch (err) {
      const b = err.body || {};
      // The named list wins where the API sends one, since it carries the
      // question's own words and the rows it is short.
      const named = agentList(agentField(b, ["missingFields", "missing_fields"], []), []);
      const keys = named.length > 0 ? named : agentList(agentField(b, ["missing", "missingKeys", "missing_keys"], []), []);
      setMissing(keys.length > 0 ? keys.map(agentMissingLine) : [tr(err.message)]);
    }
    setSubmitBusy(false);
  };

  const remaining = formResponse ? Number(formResponse.remaining) : 0;
  // A count the API sends as a word reads as NaN, and "not greater than
  // zero" let that through with answers still missing.
  const canSubmit = !!formResponse && !submitBusy && Number.isFinite(remaining) && remaining <= 0;
  const openDrafts = drafts.filter(d => !formResponse || String(agentDraftId(d)) !== String(formResponse.id));
  const photosBusy = photos.some(p => p.status === "preparing" || p.status === "uploading");
  // Typed text, a picked photo, or a photo still going up. An update
  // waits for all three.
  useBusy("help composer", text.trim().length > 0 || photos.length > 0 || sending);
  // A photo whose upload was refused holds the send until it is removed or
  // retried, so nobody sends a message believing that photo went with it.
  const photosBlocked = photos.some(p => p.status === "failed");
  const readyPhotoCount = photos.filter(p => p.status === "done" && p.path).length;
  const canSend = !sending && !photosBusy && !photosBlocked && (!!text.trim() || readyPhotoCount > 0);
  const photoLimitReached = photos.length >= AGENT_PHOTO_LIMIT;
  const smallBtn = { padding: "8px 14px", minHeight: TAP, borderRadius: R.sm, border: "1px solid " + t.goldBorder, background: t.goldBg, color: t.goldText, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD, flexShrink: 0 };
  // Pinned to the space between the header and the bottom navigation, so the
  // thread scrolls inside it and the form card and composer stay in view.
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: "0 0 auto", ...fillsTheWindow(), minHeight: 0, overflow: "hidden" }}>
      {openDrafts.length > 0 && (<div style={{ padding: "10px 12px", borderBottom: "1px solid " + t.borderSolid, flexShrink: 0, maxHeight: 180, overflowY: "auto" }}>
        <div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 6, fontFamily: FONT_HEAD }}>{tr("Unfinished reports")}</div>
        {openDrafts.map((d, i) => (<div key={agentDraftId(d) || i} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "8px 12px", marginBottom: 6, background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.md }}><div style={{ flex: "1 1 140px", minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agentName(d) || tr(FORMS_UNTITLED)}</div>{agentCount(d) && <div style={{ fontSize: 11, color: t.textMut, marginTop: 2 }}>{agentCount(d)}</div>}</div><button onClick={() => onFillForm(agentDraftId(d))} style={{ ...smallBtn, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec }}>{tr("Fill in form")}</button><button onClick={() => resume(d)} style={smallBtn}>{tr("Resume")}</button></div>))}
      </div>)}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 12px 0" }}>
        {thread.length === 0 && (<div style={{ textAlign: "center", padding: "40px 20px" }}><HelpIco sz={32} c={t.borderSolid} /><div style={{ fontSize: 13, color: t.textMut, marginTop: 12, fontFamily: FONT_HEAD }}>{tr("Tell me what happened and I will tell you what to do.")}</div></div>)}
        {thread.map(m => { const isMe = m.role === "user"; return (<div key={m.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", marginBottom: 12 }}><div style={{ maxWidth: "85%" }}>
          <div style={{ padding: "8px 12px", borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: isMe ? GOLD : (m.noProcedure ? t.goldSubtle : t.card), border: isMe ? "none" : "1px solid " + (m.noProcedure ? t.goldBorder : t.borderSolid), color: isMe ? NAVY : t.text, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", opacity: m.pending ? 0.6 : 1 }}>
            {isMe && m.photoUrls && m.photoUrls.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: m.text ? 8 : 0 }}>
                {m.photoUrls.map((u, i) => <img key={i} src={u} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: R.sm, border: "1px solid rgba(10,22,40,0.25)" }} />)}
              </div>
            )}
            {isMe ? m.text : <AgentReply text={m.text} />}
          </div>
          {!isMe && m.citedDocs.length > 0 && <div style={{ fontSize: 10, color: t.textMut, marginTop: 3, fontFamily: FONT_HEAD }}>{tr("Based on")} {m.citedDocs.join(", ")}</div>}
          {!isMe && m.degraded && <div style={{ fontSize: 10, color: t.textMut, marginTop: 3 }}>{tr("Working from the written procedure only right now.")}</div>}
          {isMe && m.failed && <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 4 }}><span style={{ fontSize: 10, color: t.textMut }}>{tr("Not sent.")}{m.error ? " " + m.error : ""}</span><button onClick={() => send(m.id, m.text, m.photoPaths)} disabled={sending} style={{ ...smallBtn, padding: "6px 12px", fontSize: 11, opacity: sending ? 0.6 : 1 }}>{tr("Retry")}</button></div>}
        </div></div>); })}
        <div ref={endRef} />
      </div>
      {submitted && <div style={{ padding: "8px 12px", fontSize: 12, color: GREEN, fontWeight: 600, textAlign: "center", fontFamily: FONT_HEAD }}>{tr("Report submitted.")}</div>}
      {formResponse && (<div style={{ margin: "0 12px 8px", padding: "10px 12px", background: t.card, border: "1px solid " + t.goldBorder, borderRadius: R.md, boxShadow: t.shadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, fontFamily: FONT_HEAD }}>{tr("Report in progress")}</div><div style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, marginTop: 2 }}>{agentName(formResponse) || tr(FORMS_UNTITLED)}</div>{agentCount(formResponse) && <div style={{ fontSize: 11, color: t.textMut, marginTop: 2 }}>{agentCount(formResponse)}</div>}</div>
        <button onClick={submit} disabled={!canSubmit} style={{ padding: "10px 14px", minHeight: 40, flexShrink: 0, borderRadius: R.sm, border: "none", background: canSubmit ? "linear-gradient(135deg, " + GOLD + ", " + GOLD_LIGHT + ")" : t.cardAlt, color: canSubmit ? NAVY : t.textMut, fontSize: 12, fontWeight: 600, cursor: canSubmit ? "pointer" : "default", fontFamily: FONT_HEAD, boxShadow: canSubmit ? "0 6px 18px rgba(231,176,23,0.30)" : "none" }}>{submitBusy ? tr("Submitting...") : tr("Submit report")}</button></div>
        {missing.length > 0 && <div style={{ marginTop: 8, fontSize: 11, color: t.textSec, lineHeight: 1.5 }}><div style={{ fontWeight: 600 }}>{tr("Still needed before you can submit:")}</div>{missing.map((k, i) => <div key={i}>{k}</div>)}</div>}
      </div>)}
      {photos.length > 0 && (
        <div style={{ padding: "8px 12px 0", display: "flex", flexWrap: "wrap", gap: 10, flexShrink: 0 }}>
          {photos.map(p => (
            <div key={p.id} style={{ width: 96 }}>
              <div style={{ position: "relative", width: 72, height: 72 }}>
                {p.url
                  ? <img src={p.url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: R.sm, border: "1px solid " + t.borderSolid, opacity: p.status === "done" ? 1 : 0.6 }} />
                  : <div style={{ width: 72, height: 72, borderRadius: R.sm, border: "1px solid " + t.borderSolid, background: t.cardAlt }} />}
                <button onClick={() => removePhoto(p.id)} aria-label={tr("Remove photo")} style={{ position: "absolute", top: -10, right: -10, width: 44, height: 44, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: NAVY, color: "#F8F7F4", fontSize: 13, fontWeight: 600, lineHeight: "20px", textAlign: "center", border: "1px solid " + t.borderSolid }}>{tr("x")}</span>
                </button>
              </div>
              {p.status !== "done" && p.status !== "failed" && <div style={{ fontSize: 10, color: t.textMut, marginTop: 4 }}>{tr("Uploading...")}</div>}
              {p.status === "failed" && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: RED, lineHeight: 1.35 }}>{p.error}</div>
                  <button onClick={() => retryPhoto(p.id)} style={{ ...smallBtn, padding: "6px 10px", fontSize: 11, marginTop: 4 }}>{tr("Try again")}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: "10px 12px", borderTop: "1px solid " + t.borderSolid, display: "flex", gap: 8, alignItems: "flex-end", background: t.bg }}>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => { addPhotoFiles(e.target.files); e.target.value = ""; }} />
        <button onClick={() => fileRef.current && fileRef.current.click()} disabled={photoLimitReached || sending} aria-label={tr("Add a photo")} title={photoLimitReached ? tr(AGENT_PHOTO_LIMIT_TITLE) : tr("Add a photo")} style={{ width: 44, height: 44, flexShrink: 0, borderRadius: "50%", background: t.cardAlt, border: "1px solid " + t.borderSolid, cursor: photoLimitReached || sending ? "default" : "pointer", opacity: photoLimitReached || sending ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><CamIco sz={18} c={t.textSec} /></button>
        <textarea ref={taRef} value={text} onChange={e => setText(e.target.value)} onPaste={e => { const items = e.clipboardData && e.clipboardData.items ? Array.from(e.clipboardData.items) : []; const files = items.filter(i => i.kind === "file" && i.type.indexOf("image/") === 0).map(i => i.getAsFile()).filter(Boolean); if (files.length > 0) { e.preventDefault(); addPhotoFiles(files); } }} disabled={sending} rows={1} placeholder={tr("Describe what happened")} aria-label={tr("Describe what happened")} style={{ ...inputSt, flex: 1, width: "auto", minWidth: 0, minHeight: 44, maxHeight: 120, overflowY: "auto", resize: "none", borderRadius: R.lg, lineHeight: 1.45, opacity: sending ? 0.6 : 1 }} />
        <button onClick={handleSend} disabled={!canSend} aria-label={tr("Send")} style={{ width: 44, height: 44, flexShrink: 0, borderRadius: "50%", background: canSend ? GOLD : t.cardAlt, border: "none", cursor: canSend ? "pointer" : "default", boxShadow: canSend ? "0 6px 18px rgba(231,176,23,0.30)" : "none", display: "flex", alignItems: "center", justifyContent: "center" }}><SendIco sz={16} c={canSend ? NAVY : t.textMut} /></button>
      </div>
      {photoProblem && <div style={{ padding: "0 12px 10px", fontSize: 11, color: RED, lineHeight: 1.4, flexShrink: 0 }}>{photoProblem}</div>}
    </div>
  );
}

function AssignedTasksView({ assignedTasks, resolveTask, showToast, t, token, lkColorMap }) {
  const [detail, setDetail] = useState(null); const [activePanel, setActivePanel] = useState(null);
  const [note, setNote] = useState(""); const [photo, setPhoto] = useState(null); const [photoPreview, setPhotoPreview] = useState(null); const [uploading, setUploading] = useState(false);
  useBusy("assigned task resolution", note.trim().length > 0 || !!photo || uploading);
  const fileRef = useRef(null);
  const lkPriColors = lkColorMap("task_priorities"); const lkSevColors = lkColorMap("issue_severities");
  const priC = Object.keys(lkPriColors).length > 0 ? lkPriColors : { critical: RED, high: ORANGE, standard: GOLD }; const sevC = Object.keys(lkSevColors).length > 0 ? lkSevColors : { low: GREEN, medium: ORANGE, high: RED };
  const inputSt = mkInput(t);
  const handlePhoto = (e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) { showToast(tr("Photo must be under 10MB"), "error"); return; } setPhoto(file); const reader = new FileReader(); reader.onload = (ev) => setPhotoPreview(ev.target.result); reader.readAsDataURL(file); };
  const clearForm = () => { setActivePanel(null); setNote(""); setPhoto(null); setPhotoPreview(null); if (fileRef.current) fileRef.current.value = ""; };
  const handleResolve = async (taskId) => { if (!note.trim()) { showToast(tr("Describe what you did to complete this task"), "error"); return; } if (!photo) { showToast(tr("A photo of the completed task is required"), "error"); return; } setUploading(true); try { const photoUrl = await uploadPhoto(photo, token); await resolveTask(taskId, "resolved", note.trim(), photoUrl); clearForm(); setDetail(null); } catch (err) { showToast(tr(err.message), "error"); } setUploading(false); };
  const handleCantResolve = async (taskId) => { if (!note.trim()) { showToast(tr("Please provide a reason"), "error"); return; } await resolveTask(taskId, "unable_to_resolve", note.trim(), null); clearForm(); setDetail(null); };
  const getTaskInfo = (task) => { const isIssueLinked = !!task.source_issue_id; const title = isIssueLinked ? (task.issue_title || task.label) : task.label; const desc = isIssueLinked ? task.issue_description : task.description; const borderColor = isIssueLinked ? (sevC[task.severity] || ORANGE) : (priC[task.priority] || GOLD); const photoUrl = isIssueLinked ? task.issue_photo_url : (task.media_url || null); const mediaType = isIssueLinked ? "image" : (task.media_type || "image"); const assignedBy = isIssueLinked ? task.reported_by_name : task.created_by_name; const assignedByLabel = isIssueLinked ? tr("Reported by") : tr("Assigned by"); const locationParts = [task.site_name]; if (task.building_name) locationParts.push(task.building_name); if (task.floor_number) locationParts.push(tr("Floor {n}", { n: task.floor_number })); locationParts.push(task.zone || (isIssueLinked ? task.issue_zone : null) || tr("General")); const locationStr = locationParts.filter(Boolean).join(" > "); return { isIssueLinked, title, desc, borderColor, photoUrl, mediaType, assignedBy, assignedByLabel, locationStr }; };

  if (assignedTasks.length === 0) return (<div style={{ padding: "16px" }}><div style={{ padding: "48px 24px", textAlign: "center", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, boxShadow: t.shadow }}><AlertIco sz={40} c={t.borderSolid} /><div style={{ fontSize: 15, color: t.textMut, marginTop: 16, fontFamily: FONT_HEAD }}>{tr("No assigned tasks right now.")}</div><div style={{ fontSize: 12, color: t.textMut, marginTop: 4 }}>{tr("When a supervisor assigns a task to you, it will appear here.")}</div></div></div>);

  if (detail) {
    const info = getTaskInfo(detail); const isResolving = activePanel === "resolve"; const isCantResolve = activePanel === "cantresolve";
    return (
      <div style={{ padding: "16px" }}>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
        <button onClick={() => { setDetail(null); clearForm(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", marginBottom: 14, background: "none", border: "1px solid " + t.borderSolid, borderRadius: R.sm, color: t.textSec, fontSize: 12, cursor: "pointer", fontFamily: FONT_HEAD }}><Ico d="M15 18l-6-6 6-6" sz={14} c={t.textSec} /> {tr("Back to assigned tasks")}</button>
        <div style={{ background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.lg, borderLeft: "3px solid " + info.borderColor, overflow: "hidden", boxShadow: t.popShadow }}>
          <div style={{ padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}><div style={{ fontSize: 16, fontWeight: 600, flex: 1, color: t.text, fontFamily: FONT_HEAD }}>{info.title}</div><div style={{ display: "flex", gap: 4, flexShrink: 0 }}>{info.isIssueLinked && detail.severity && <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", padding: "2px 7px", borderRadius: R.sm, background: (sevC[detail.severity] || ORANGE) + "18", color: sevC[detail.severity] || ORANGE, fontFamily: FONT_HEAD }}>{levelWord(detail.severity)}</span>}{!info.isIssueLinked && detail.priority && detail.priority !== "standard" && <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", padding: "2px 7px", borderRadius: R.sm, background: (priC[detail.priority] || GOLD) + "18", color: priC[detail.priority] || t.goldText, fontFamily: FONT_HEAD }}>{levelWord(detail.priority)}</span>}{info.isIssueLinked && <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: R.sm, background: "rgba(231,76,60,0.1)", color: RED, fontFamily: FONT_HEAD }}>{tr("ISSUE")}</span>}</div></div>
            <div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12, fontFamily: FONT_HEAD, fontWeight: 600 }}>{info.locationStr}</div>
            {detail.resolution_status && (<div style={{ marginBottom: 12 }}><span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", padding: "3px 8px", borderRadius: R.sm, background: detail.resolution_status === "in_progress" ? ORANGE + "18" : GOLD + "18", color: detail.resolution_status === "in_progress" ? ORANGE : t.goldText, fontFamily: FONT_HEAD }}>{statusWord(detail.resolution_status)}</span></div>)}
            {info.desc && (<div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 6, fontFamily: FONT_HEAD }}>{tr("Description")}</div><div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{info.desc}</div></div>)}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}><div><div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, fontFamily: FONT_HEAD, marginBottom: 3 }}>{info.assignedByLabel}</div><div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{info.assignedBy}</div></div><div><div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, fontFamily: FONT_HEAD, marginBottom: 3 }}>{tr("Site")}</div><div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{detail.site_name}</div></div>{detail.due_date && <div><div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, fontFamily: FONT_HEAD, marginBottom: 3 }}>{tr("Due Date")}</div><div style={{ fontSize: 13, color: ORANGE, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{new Date(detail.due_date).toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" })}{detail.due_time ? " " + tr("at {time}", { time: clockTime(detail.due_time) }) : ""}</div></div>}{detail.task_created_at && <div><div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, fontFamily: FONT_HEAD, marginBottom: 3 }}>{tr("Assigned")}</div><div style={{ fontSize: 13, color: t.text, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{new Date(detail.task_created_at).toLocaleDateString(dateLocale(), { month: "short", day: "numeric" })}</div></div>}</div>
            {info.photoUrl && (<div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 6, fontFamily: FONT_HEAD }}>{info.mediaType === "video" ? tr("Attached Video") : tr("Attached Photo")}</div>{info.mediaType === "video" ? (<video src={info.photoUrl} controls style={{ width: "100%", borderRadius: R.md, maxHeight: 240 }} />) : (<img src={info.photoUrl} alt={tr("Task")} style={{ width: "100%", borderRadius: R.md, maxHeight: 200, objectFit: "cover", border: "1px solid " + t.borderSolid }} />)}</div>)}
            {!isResolving && !isCantResolve && (<div style={{ display: "flex", gap: 6, marginTop: 10 }}>{detail.resolution_status !== "in_progress" && (<button onClick={() => { resolveTask(detail.task_id, "in_progress", null, null); setDetail(null); }} style={{ flex: 1, padding: "10px", borderRadius: R.sm, border: "1px solid " + ORANGE, background: "transparent", color: ORANGE, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("In Progress")}</button>)}<button onClick={() => { clearForm(); setActivePanel("resolve"); }} style={{ flex: 1, padding: "10px", borderRadius: R.sm, border: "1px solid " + GREEN, background: "transparent", color: GREEN, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Resolved")}</button><button onClick={() => { clearForm(); setActivePanel("cantresolve"); }} style={{ flex: 1, padding: "10px", borderRadius: R.sm, border: "1px solid " + RED, background: "transparent", color: RED, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Cannot Resolve")}</button></div>)}
          </div>
          {isResolving && (<div style={{ padding: "12px 14px", borderTop: "1px solid " + t.borderSolid, background: t.greenSubtle }}>
            <div style={{ fontSize: 10, color: GREEN, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8, fontFamily: FONT_HEAD }}>{tr("Mark as Resolved")}</div>
            <div style={{ marginBottom: 8 }}><div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 4, fontFamily: FONT_HEAD }}>{tr("What did you do to complete this? *")}</div><textarea value={note} onChange={e => setNote(e.target.value)} placeholder={tr("Describe the steps you took...")} rows={3} style={{ ...inputSt, resize: "vertical" }} /></div>
            <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 4, fontFamily: FONT_HEAD }}>{tr("Photo of completed task *")}</div>{!photoPreview ? (<button onClick={() => fileRef.current?.click()} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px", background: t.hover, border: "1px dashed " + GREEN, borderRadius: R.md, cursor: "pointer", color: GREEN, fontSize: 12, fontWeight: 600 }}><CamIco sz={18} c={GREEN} /><div style={{ textAlign: "left" }}><div>{tr("Take Photo of Completed Task")}</div><div style={{ fontSize: 10, color: t.textMut, fontWeight: 400, marginTop: 2 }}>{tr("Required to verify completion")}</div></div></button>) : (<div style={{ position: "relative" }}><img src={photoPreview} alt={tr("Preview")} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: R.md, border: "1px solid " + t.borderSolid }} /><button onClick={() => { setPhoto(null); setPhotoPreview(null); if (fileRef.current) fileRef.current.value = ""; }} aria-label={tr("Remove photo")} style={mkTapFrame({ position: "absolute", top: -2, right: -2 })}><span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.7)", color: "#F8F7F4", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{tr("x")}</span></button></div>)}</div>
            <div style={{ display: "flex", gap: 8 }}><button onClick={() => setActivePanel(null)} style={{ flex: 1, padding: "10px", borderRadius: R.sm, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec, fontSize: 12, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Cancel")}</button><button onClick={() => handleResolve(detail.task_id)} disabled={uploading} style={{ flex: 1, padding: "10px", borderRadius: R.md, border: "none", background: GREEN, color: "#F8F7F4", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD, opacity: uploading ? 0.6 : 1 }}>{uploading ? tr("Uploading...") : tr("Submit Resolution")}</button></div>
          </div>)}
          {isCantResolve && (<div style={{ padding: "12px 14px", borderTop: "1px solid " + t.borderSolid, background: t.redSubtle }}>
            <div style={{ fontSize: 10, color: RED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8, fontFamily: FONT_HEAD }}>{tr("Explain why this cannot be completed *")}</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={tr("Describe the issue preventing completion...")} rows={3} style={{ ...inputSt, resize: "vertical", marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8 }}><button onClick={() => setActivePanel(null)} style={{ flex: 1, padding: "10px", borderRadius: R.sm, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec, fontSize: 12, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Cancel")}</button><button onClick={() => handleCantResolve(detail.task_id)} style={{ flex: 1, padding: "10px", borderRadius: R.md, border: "none", background: RED, color: "#F8F7F4", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Submit")}</button></div>
          </div>)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px" }}>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
      <div style={{ marginBottom: 14 }}><div style={{ fontSize: 16, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{tr("Assigned Tasks")}</div><div style={{ fontSize: 11, color: t.textSec }}>{assignedTasks.length === 1 ? tr("{n} task assigned to you", { n: assignedTasks.length }) : tr("{n} tasks assigned to you", { n: assignedTasks.length })}</div></div>
      {assignedTasks.map(task => { const info = getTaskInfo(task); return (<div key={task.task_id} onClick={() => setDetail(task)} style={{ marginBottom: 10, background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.md, borderLeft: "3px solid " + info.borderColor, overflow: "hidden", cursor: "pointer", boxShadow: t.shadow }}><div style={{ padding: "12px 14px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{info.title}</div>{info.desc && <div style={{ fontSize: 11, color: t.textSec, marginTop: 4, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{info.desc}</div>}</div><div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8, alignItems: "center" }}>{info.isIssueLinked && <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: R.sm, background: "rgba(231,76,60,0.1)", color: RED, fontFamily: FONT_HEAD }}>{tr("ISSUE")}</span>}{!info.isIssueLinked && task.priority && task.priority !== "standard" && <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", padding: "2px 7px", borderRadius: R.sm, background: (priC[task.priority] || GOLD) + "18", color: priC[task.priority] || t.goldText, fontFamily: FONT_HEAD }}>{levelWord(task.priority)}</span>}<Ico d="M9 18l6-6-6-6" sz={14} c={t.textMut} /></div></div><div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 10, color: t.textMut, flexWrap: "wrap", alignItems: "center" }}><span>{info.locationStr}</span><span>{info.assignedByLabel} {info.assignedBy}</span>{task.resolution_status === "in_progress" && <span style={{ fontSize: 9, fontWeight: 600, color: ORANGE, textTransform: "uppercase" }}>{tr("In Progress")}</span>}</div>{task.due_date && (<div style={{ marginTop: 6, fontSize: 10, color: ORANGE, fontVariantNumeric: "tabular-nums" }}>{tr("Due:")} {new Date(task.due_date).toLocaleDateString(dateLocale(), { month: "short", day: "numeric" })}{task.due_time ? " " + tr("at {time}", { time: clockTime(task.due_time) }) : ""}</div>)}</div></div>); })}
    </div>
  );
}

function IssuesView({ clockStatus, issues, submitIssue, showToast, user, sites, t, token, getOpts, lkColorMap }) {
  const [showForm, setShowForm] = useState(false); const [title, setTitle] = useState(""); const [desc, setDesc] = useState("");
  const [sev, setSev] = useState("medium"); const [zone, setZone] = useState(""); const [selSite, setSelSite] = useState("");
  const [photo, setPhoto] = useState(null); const [photoPreview, setPhotoPreview] = useState(null); const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  useBusy("issue form", title.trim().length > 0 || desc.trim().length > 0 || zone.trim().length > 0 || !!photo || uploading);
  const labelSt = mkLabel(t); const inputSt = mkInput(t);
  const sevOpts = getOpts("issue_severities");
  const sevColors = lkColorMap("issue_severities");
  const sevs = sevOpts.length > 0 ? sevOpts.map(o => ({ v: o.v, l: o.l, c: sevColors[o.v] || ORANGE })) : [{ v: "low", l: tr("Low"), c: GREEN }, { v: "medium", l: tr("Med"), c: ORANGE }, { v: "high", l: tr("High"), c: RED }];
  const isAdmin = user?.role === "admin" || user?.role === "supervisor";
  const visibleIssues = isAdmin ? issues : issues.filter(i => i.reported_by === user?.id);
  const sevC = Object.keys(sevColors).length > 0 ? sevColors : { low: GREEN, medium: ORANGE, high: RED };
  const handlePhoto = (e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) { showToast(tr("Photo must be under 10MB"), "error"); return; } setPhoto(file); const reader = new FileReader(); reader.onload = (ev) => setPhotoPreview(ev.target.result); reader.readAsDataURL(file); };
  const removePhoto = () => { setPhoto(null); setPhotoPreview(null); if (fileRef.current) fileRef.current.value = ""; };
  const handleSubmit = async () => { if (!title.trim()) { showToast(tr("Enter issue title"), "error"); return; } const siteId = clockStatus?.clockedIn ? clockStatus.shift.siteId : selSite; if (!siteId) { showToast(tr("Select a site"), "error"); return; } setUploading(true); try { let photoUrl = null; if (photo) { photoUrl = await uploadPhoto(photo, token); } await submitIssue(title.trim(), desc.trim(), zone.trim(), sev, photoUrl, siteId); setTitle(""); setDesc(""); setZone(""); setSev("medium"); setPhoto(null); setPhotoPreview(null); setShowForm(false); } catch (err) { showToast(tr(err.message), "error"); } setUploading(false); };
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div style={{ fontSize: 16, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{isAdmin ? tr("Issues") : tr("Report an Issue")}</div>{isAdmin && <button onClick={() => setShowForm(!showForm)} style={mkTapFrame()}><span style={{ display: "inline-flex", alignItems: "center", padding: "7px 13px", borderRadius: R.sm, border: showForm ? "1px solid " + t.borderSolid : "none", background: showForm ? t.cardAlt : GOLD, color: showForm ? t.text : NAVY, fontSize: 12, fontWeight: 600, fontFamily: FONT_HEAD }}>{showForm ? tr("Cancel") : tr("+ Report")}</span></button>}</div>
      {(showForm || !isAdmin) && (<div style={{ padding: 14, marginBottom: 14, background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.lg, animation: "fadeIn 0.3s ease", boxShadow: t.popShadow }}>
        {!clockStatus?.clockedIn && sites && sites.length > 0 && (<div style={{ marginBottom: 10 }}><label style={labelSt}>{tr("Site")}</label><select value={selSite} onChange={e => setSelSite(e.target.value)} style={inputSt}><option value="">{tr("Select site...")}</option>{sites.map(s => <option key={s.siteId} value={s.siteId}>{s.siteName}</option>)}</select></div>)}
        <div style={{ marginBottom: 10 }}><label style={labelSt}>{tr("Title")}</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder={tr("Brief description")} style={inputSt} /></div>
        <div style={{ marginBottom: 10 }}><label style={labelSt}>{tr("Details")}</label><textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder={tr("Additional details...")} rows={3} style={{ ...inputSt, resize: "vertical", fontFamily: "inherit" }} /></div>
        <div style={{ marginBottom: 10 }}><label style={labelSt}>{tr("Zone")}</label><input value={zone} onChange={e => setZone(e.target.value)} placeholder={tr("e.g. Restroom, Lobby")} style={inputSt} /></div>
        <div style={{ marginBottom: 14 }}><label style={labelSt}>{tr("Severity")}</label><div style={{ display: "flex", gap: 6 }}>{sevs.map(s => (<button key={s.v} onClick={() => setSev(s.v)} style={{ flex: 1, minHeight: TAP, padding: "9px", borderRadius: R.sm, border: sev === s.v ? "2px solid " + s.c : "1px solid " + t.borderSolid, background: sev === s.v ? s.c + "1A" : "transparent", cursor: "pointer", color: s.c, fontSize: 12, fontWeight: 600, textAlign: "center", fontFamily: FONT_HEAD, letterSpacing: "0.3px" }}>{s.l}</button>))}</div></div>
        <div style={{ marginBottom: 14 }}><label style={labelSt}>{tr("Photo")}</label><input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />{!photoPreview ? (<button onClick={() => fileRef.current?.click()} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px", background: t.hover, border: "1px dashed " + GOLD, borderRadius: R.sm, cursor: "pointer", color: t.goldText, fontSize: 12, fontWeight: 600 }}><CamIco sz={18} c={t.goldText} /><div style={{ textAlign: "left" }}><div>{tr("Take Photo or Choose from Gallery")}</div><div style={{ fontSize: 10, color: t.textMut, fontWeight: 400, marginTop: 2 }}>{tr("JPG, PNG up to 10MB")}</div></div></button>) : (<div style={{ position: "relative" }}><img src={photoPreview} alt={tr("Preview")} style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: R.sm, border: "1px solid " + t.borderSolid }} /><button onClick={removePhoto} aria-label={tr("Remove photo")} style={mkTapFrame({ position: "absolute", top: -2, right: -2 })}><span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.7)", color: "#F8F7F4", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{tr("x")}</span></button><div style={{ fontSize: 10, color: GREEN, marginTop: 4 }}>{tr("Photo attached:")} {photo?.name}</div></div>)}</div>
        <button onClick={handleSubmit} disabled={uploading} style={{ width: "100%", minHeight: TAP, padding: "13px", borderRadius: R.md, border: "none", background: "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")", color: NAVY, fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "uppercase", letterSpacing: "1px", fontFamily: FONT_HEAD, boxShadow: "0 6px 18px rgba(231,176,23,0.30)", opacity: uploading ? 0.6 : 1 }}>{uploading ? tr("Uploading...") : tr("Submit Issue")}</button>
      </div>)}
      {isAdmin && visibleIssues.length === 0 && !showForm && <div style={{ padding: "32px 20px", textAlign: "center", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, fontSize: 13, color: t.textMut, boxShadow: t.shadow }}>{tr("No issues reported yet.")}</div>}
      {isAdmin && visibleIssues.map(issue => { const sc = sevC[issue.severity] || ORANGE; return (<div key={issue.id} style={{ padding: "12px", marginBottom: 8, background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.md, borderLeft: "3px solid " + sc, boxShadow: t.shadow }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}><div style={{ fontSize: 13, fontWeight: 600, flex: 1, color: t.text, fontFamily: FONT_HEAD }}>{issue.title}</div><span style={{ fontSize: 9, color: sc, background: sc + "20", padding: "3px 7px", borderRadius: R.sm, fontWeight: 600, textTransform: "uppercase", fontFamily: FONT_HEAD, letterSpacing: "0.5px", flexShrink: 0 }}>{levelWord(issue.severity)}</span></div><div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 9, color: t.textMut }}><span>{issue.zone}</span><span>{issue.site_name}</span><span style={{ color: issue.status === "open" ? ORANGE : GREEN, fontWeight: 600, textTransform: "uppercase", fontFamily: FONT_HEAD, letterSpacing: "0.5px" }}>{statusWord(issue.status)}</span></div></div>); })}
    </div>
  );
}

function SuppliesView({ clockStatus, supplies, supplyLogs, logSupplyUsage, submitRequest, showToast, t, getOpts, lkColorMap }) {
  const [scanning, setScanning] = useState(null); const [qty, setQty] = useState(1); const [reqForm, setReqForm] = useState(null);
  useBusy("supply request form", !!reqForm || scanning !== null);
  const labelSt = mkLabel(t); const inputSt = mkInput(t); const qtyBtn = mkQtyBtn(t);
  const handleSubmitReq = () => { if (!reqForm.type) { showToast(tr("Select a request type"), "error"); return; } if ((reqForm.type === "new_gear" || reqForm.type === "new_supply") && !reqForm.itemName) { showToast(tr("Enter the item name"), "error"); return; } submitRequest(reqForm.type, reqForm.itemName, reqForm.description, reqForm.urgency, reqForm.supplyId); setReqForm(null); };

  const reqFormUI = reqForm && (
    <div style={{ padding: 14, marginBottom: 14, background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.lg, boxShadow: t.popShadow }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: t.text, fontFamily: FONT_HEAD }}>{tr("Supply/Gear Request")}</div>
      <div style={{ marginBottom: 10 }}><label style={labelSt}>{tr("Request Type")}</label><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(getOpts("request_types").length > 0 ? getOpts("request_types") : [{ v: "refill", l: tr("Refill") }, { v: "damage_report", l: tr("Damage Report") }, { v: "new_gear", l: tr("New Gear") }, { v: "new_supply", l: tr("New Supply") }]).map(tp => (<button key={tp.v} onClick={() => setReqForm({ ...reqForm, type: tp.v })} style={{ padding: "7px 11px", borderRadius: R.sm, border: reqForm.type === tp.v ? "2px solid " + GOLD : "1px solid " + t.borderSolid, background: reqForm.type === tp.v ? t.goldBg : "transparent", color: reqForm.type === tp.v ? t.goldText : t.textSec, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tp.l}</button>))}</div></div>
      {(reqForm.type === "refill" || reqForm.type === "damage_report") && supplies.length > 0 && (<div style={{ marginBottom: 10 }}><label style={labelSt}>{tr("Supply Item")}</label><select value={reqForm.supplyId || ""} onChange={e => setReqForm({ ...reqForm, supplyId: e.target.value || null, itemName: supplies.find(s => s.id === e.target.value)?.name || "" })} style={inputSt}><option value="">{tr("Select supply...")}</option>{supplies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>)}
      {(reqForm.type === "new_gear" || reqForm.type === "new_supply") && (<div style={{ marginBottom: 10 }}><label style={labelSt}>{tr("Item Name")}</label><input value={reqForm.itemName} onChange={e => setReqForm({ ...reqForm, itemName: e.target.value })} placeholder={tr("What do you need?")} style={inputSt} /></div>)}
      <div style={{ marginBottom: 10 }}><label style={labelSt}>{tr("Details")}</label><textarea value={reqForm.description} onChange={e => setReqForm({ ...reqForm, description: e.target.value })} placeholder={tr("Describe the request...")} rows={2} style={{ ...inputSt, resize: "vertical", fontFamily: "inherit" }} /></div>
      <div style={{ marginBottom: 12 }}><label style={labelSt}>{tr("Urgency")}</label><div style={{ display: "flex", gap: 6 }}>{(() => { const urgOpts = getOpts("urgency_levels"); const urgColors = lkColorMap("urgency_levels"); const items = urgOpts.length > 0 ? urgOpts.map(o => ({ v: o.v, l: o.l, c: urgColors[o.v] || t.textSec })) : [{ v: "low", l: tr("Low"), c: GREEN }, { v: "normal", l: tr("Normal"), c: t.textSec }, { v: "high", l: tr("High"), c: ORANGE }, { v: "urgent", l: tr("Urgent"), c: RED }]; return items.map(u => (<button key={u.v} onClick={() => setReqForm({ ...reqForm, urgency: u.v })} style={{ flex: 1, padding: "7px", borderRadius: R.sm, border: reqForm.urgency === u.v ? "2px solid " + u.c : "1px solid " + t.borderSolid, background: reqForm.urgency === u.v ? u.c + "1A" : "transparent", color: u.c, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{u.l}</button>)); })()}</div></div>
      <div style={{ display: "flex", gap: 8 }}><button onClick={() => setReqForm(null)} style={{ flex: 1, padding: "11px", borderRadius: R.sm, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Cancel")}</button><button onClick={handleSubmitReq} style={{ flex: 1, padding: "11px", borderRadius: R.sm, border: "none", background: "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")", color: NAVY, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD, boxShadow: "0 6px 18px rgba(231,176,23,0.30)" }}>{tr("Submit Request")}</button></div>
    </div>
  );

  if (!clockStatus?.clockedIn) return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div><div style={{ fontSize: 16, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{tr("Supplies")}</div><div style={{ fontSize: 11, color: t.textSec }}>{tr("Start your shift to log usage. Requests can be submitted anytime.")}</div></div><button onClick={() => setReqForm({ type: "", itemName: "", description: "", urgency: "normal", supplyId: null })} style={mkTapFrame()}><span style={{ display: "inline-flex", alignItems: "center", padding: "7px 13px", borderRadius: R.sm, background: GOLD, color: NAVY, fontSize: 12, fontWeight: 600, fontFamily: FONT_HEAD }}>{tr("+ Request")}</span></button></div>
      {reqFormUI}
    </div>
  );

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div><div style={{ fontSize: 16, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{tr("Supply Tracking")}</div><div style={{ fontSize: 11, color: t.textSec }}>{tr("Log usage or submit a request")}</div></div><button onClick={() => setReqForm({ type: "", itemName: "", description: "", urgency: "normal", supplyId: null })} style={mkTapFrame()}><span style={{ display: "inline-flex", alignItems: "center", padding: "7px 13px", borderRadius: R.sm, background: GOLD, color: NAVY, fontSize: 12, fontWeight: 600, fontFamily: FONT_HEAD }}>{tr("+ Request")}</span></button></div>
      {reqFormUI}
      {supplies.map(sup => { const isOpen = scanning === sup.id; const isLow = sup.is_low || (sup.site_stock !== undefined && sup.site_stock <= sup.site_threshold); return (<div key={sup.id} style={{ marginBottom: 6 }}><button onClick={() => { setScanning(isOpen ? null : sup.id); setQty(1); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: isOpen ? t.goldBg : t.hover, border: isOpen ? "1.5px solid " + GOLD : "1px solid " + t.borderSolid, borderRadius: isOpen ? (R.md + "px " + R.md + "px 0 0") : R.md, cursor: "pointer", color: t.text, textAlign: "left", boxShadow: t.shadow }}><div style={{ width: 34, height: 34, borderRadius: R.sm, background: t.cardAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 600, color: t.textMut, fontFamily: "monospace" }}>{tr("QR")}</div><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT_HEAD }}>{sup.name}</div><div style={{ display: "flex", gap: 6, marginTop: 2, fontSize: 9 }}><span style={{ color: t.textMut }}>{sup.qr_code}</span>{isLow && <span style={{ color: ORANGE, fontWeight: 600 }}>{tr("LOW")}</span>}</div></div><ChevIco sz={14} c={t.textMut} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "0.2s" }} /></button>{isOpen && (<div style={{ padding: "12px", background: t.card, border: "1.5px solid " + GOLD, borderTop: "none", borderRadius: "0 0 " + R.md + "px " + R.md + "px" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 12 }}><button onClick={() => setQty(Math.max(1, qty - 1))} aria-label={tr("One less")} style={mkTapFrame()}><span style={qtyBtn}><MinusIco sz={14} /></span></button><div style={{ textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 600, color: t.goldText, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{qty}</div><div style={{ fontSize: 10, color: t.textMut }}>{sup.unit}</div></div><button onClick={() => setQty(qty + 1)} aria-label={tr("One more")} style={mkTapFrame()}><span style={qtyBtn}><PlusIco sz={14} /></span></button></div><button onClick={() => { logSupplyUsage(sup.id, qty); setScanning(null); setQty(1); }} style={{ width: "100%", padding: "11px", borderRadius: R.md, border: "none", background: "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")", color: NAVY, fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: FONT_HEAD, boxShadow: "0 6px 18px rgba(231,176,23,0.30)" }}>{tr("Log Usage")}</button></div>)}</div>); })}
      {supplyLogs.length > 0 && (<div style={{ marginTop: 18 }}><label style={{ ...labelSt, display: "block", marginBottom: 8 }}>{tr("This Shift's Log")}</label>{supplyLogs.map((log, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", marginBottom: 3, background: t.hover, borderRadius: R.sm, fontSize: 11 }}><span style={{ fontWeight: 600, color: t.text }}>{log.supply_name || tr("Item")} <span style={{ color: t.textMut, fontWeight: 400 }}>{log.quantity} {log.unit}</span></span><span style={{ color: t.textMut, fontSize: 9 }}>{formatTime(log.loggedAt || log.scanned_at)}</span></div>))}</div>)}
    </div>
  );
}

// ============================================================
// SPEAK UP
// A report about a person. Three things: what happened, who it is
// about, Send. What is typed lives only in this component's state,
// which is gone the moment the person leaves the tab, so a half
// written report cannot be found on a shared phone by the next
// person to pick it up. Nothing on this screen reaches the console.
// The subjects list is the API's, never a name typed here.
// ============================================================
const CASE_MAX = 4000;
// Built when the counter is drawn rather than once at import,
// because the language is not known at import time.
const caseMaxText = () => CASE_MAX.toLocaleString(dateLocale());
function SpeakUpView({ token, t }) {
  const [text, setText] = useState("");
  // The management question. null until it is answered, then true or
  // false. Send waits for an answer either way, and a Yes waits for at
  // least one person as well.
  const [aboutManagement, setAboutManagement] = useState(null);
  // The people this report is about, as ids, in the order they were
  // picked. Their names are read off the list below.
  const [picked, setPicked] = useState([]);
  const [search, setSearch] = useState("");
  // Three states. null is loading: the names are not drawn yet. An
  // array is loaded, and an empty one is a correct state. listFailed is
  // the third: the request did not come back, nobody can be picked, and
  // the screen says so where the names would be, with a way to try
  // again. A failure is never read as an empty list, because a report
  // about a manager sent with nobody picked goes to that manager.
  const [people, setPeople] = useState(null);
  const [listFailed, setListFailed] = useState(false);
  // Bumped by Try again, which re-runs the same request. The activation
  // screen's pattern.
  const [attempt, setAttempt] = useState(0);
  // sending disables Send and the fields for the length of one request.
  // inFlight is the same fact held in a ref, so a second tap that lands
  // before the render with the disabled button files nothing.
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  // The id of the case just filed. Once set, the form is gone and the
  // confirmation is all there is; the only way back is to leave the tab.
  const [sent, setSent] = useState(null);
  // One plain sentence when a send did not go through. What was typed
  // stays on screen underneath it.
  const [problem, setProblem] = useState(null);
  useBusy("speak up composer", text.trim().length > 0 || sending);
  useEffect(() => { let live = true; setPeople(null); setListFailed(false); api("/api/hr-cases/people", { token }).then(d => { if (live) setPeople(Array.isArray(d?.people) ? d.people : []); }).catch(() => { if (live) setListFailed(true); }); return () => { live = false; }; }, [token, attempt]);
  const labelSt = mkLabel(t);
  const inputSt = mkInput(t);
  const helpSt = mkHelp(t);
  const nearLimit = text.length >= CASE_MAX - 200;
  const aboutBosses = aboutManagement === true;
  const canSend = text.trim().length > 0 && aboutManagement !== null && (!aboutBosses || picked.length > 0) && !sending;
  const send = async () => {
    if (!canSend || inFlight.current) return;
    inFlight.current = true; setSending(true); setProblem(null);
    const body = { summary: text.trim(), aboutManagement: aboutBosses, subjectUserIds: picked.slice() };
    try {
      const data = await api("/api/hr-cases", { method: "POST", body, token });
      setText(""); setAboutManagement(null); setPicked([]); setSearch("");
      setSent({ id: data && data.id ? String(data.id) : "" });
    } catch (err) {
      // A refusal carries the API's own sentence, which names nobody.
      // It is drawn word for word, so the person is told what to change
      // rather than to try the same thing again. A request that never
      // reached OCSA carries no sentence of its own, and the browser's
      // words are never read as one. Never the raw body, never a code.
      const gone = wentNowhere(err);
      const own = !gone && err && typeof err.message === "string" && err.message.trim() ? tr(err.message.trim()) : null;
      setProblem(tr("Your report was not sent.") + " " + (own || tr(gone ? ERR_OFFLINE : "Please try again.")));
    } finally { inFlight.current = false; setSending(false); }
  };
  // The API sends a first and a last name. The screen draws them the way
  // a person says them, and searches the whole of it, so either half of
  // a name finds the person.
  const whole = (p) => String(p && p.firstName ? p.firstName : "") + " " + String(p && p.lastName ? p.lastName : "");
  // Everyone the list still offers: whoever is not picked already,
  // narrowed by what has been typed in the search box.
  const staff = Array.isArray(people) ? people : [];
  const needle = search.trim().toLowerCase();
  const offered = staff.filter(p => picked.indexOf(p.id) === -1 && (needle === "" || whole(p).toLowerCase().indexOf(needle) !== -1));
  const chosen = picked.map(id => staff.find(p => p.id === id)).filter(Boolean);
  // The question's two buttons and the names under the search box are
  // the app's own pick one row, so the two states read the same here as
  // they do on a form.
  const askSt = { fontSize: 14, fontWeight: 600, color: t.text, lineHeight: 1.45, fontFamily: FONT_HEAD, overflowWrap: "anywhere" };
  const optSt = { fontSize: 11, fontWeight: 600, color: t.textMut, marginLeft: 6, whiteSpace: "nowrap" };
  const optRow = (on) => ({
    width: "100%", minHeight: TAP, marginTop: 8, padding: "10px 12px", borderRadius: R.md, cursor: sending ? "default" : "pointer",
    display: "flex", alignItems: "center", gap: 10, textAlign: "left", fontSize: 14, fontFamily: FONT_BODY, lineHeight: 1.4,
    background: on ? t.goldBg : t.card, border: on ? "1.5px solid " + GOLD : "1px solid " + t.borderSolid, color: t.text,
  });
  const mark = (on) => ({ width: 16, height: 16, flexShrink: 0, borderRadius: "50%", background: on ? GOLD : "transparent", border: on ? "none" : "2px solid " + t.borderSolid });
  const chipSt = {
    display: "inline-flex", alignItems: "center", gap: 8, maxWidth: "100%", minWidth: TAP, minHeight: TAP,
    padding: "8px 12px", borderRadius: R.pill, cursor: sending ? "default" : "pointer",
    background: t.goldBg, border: "1px solid " + t.goldBorder, color: t.text,
    fontSize: 13, fontWeight: 600, fontFamily: FONT_HEAD, textAlign: "left", lineHeight: 1.35,
  };
  if (sent) return (
    <div style={{ padding: "16px" }}>
      <div style={{ padding: "28px 20px", textAlign: "center", background: t.card, border: "1px solid " + t.goldBorder, borderRadius: R.lg, boxShadow: t.popShadow }}>
        <CheckIco sz={40} c={GREEN} />
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginTop: 14, fontFamily: FONT_HEAD }}>{tr("We got your report.")}</div>
        <div style={{ fontSize: 13, color: t.textSec, marginTop: 8, lineHeight: 1.6 }}>{tr("Someone will be in touch with you within 72 hours.")}</div>
        {sent.id && (<div style={{ marginTop: 20 }}><div style={labelSt}>{tr("Your reference")}</div><div style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, wordBreak: "break-all" }}>{sent.id}</div><div style={helpSt}>{tr("Quote this if you follow up.")}</div></div>)}
      </div>
    </div>
  );
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{tr("Report a problem with someone")}</div>
        <div style={{ fontSize: 12, color: t.textSec, marginTop: 4, lineHeight: 1.5 }}>{tr("Nothing you write here is kept. If you leave this screen before you send, it is gone.")}</div>
      </div>
      <div style={{ padding: 14, background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.lg, boxShadow: t.popShadow }}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>{tr("What happened")}</label>
          <textarea value={text} onChange={e => setText(e.target.value.slice(0, CASE_MAX))} maxLength={CASE_MAX} disabled={sending} placeholder={tr("Write what happened in your own words. One sentence is enough.")} rows={6} style={{ ...inputSt, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
          <div style={{ ...helpSt, color: nearLimit ? ORANGE : t.textMut }}>{nearLimit ? tr("{used} of {max} characters used.", { used: text.length.toLocaleString(dateLocale()), max: caseMaxText() }) : tr("You can write up to {max} characters.", { max: caseMaxText() })}</div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={askSt}>{tr("Is this about someone in management?")}</div>
          <div style={{ ...helpSt, marginTop: 4 }}>{tr("Anyone you pick below will not be able to see this report.")}</div>
          {[true, false].map(answer => { const on = aboutManagement === answer; return (
            <button key={answer ? "yes" : "no"} type="button" onClick={() => setAboutManagement(answer)} disabled={sending} aria-pressed={on} style={optRow(on)}>
              <span style={mark(on)} /><span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{tr(answer ? "Yes" : "No")}</span>
            </button>
          ); })}
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={askSt}>
            {tr(aboutBosses ? "Who is it about? Pick at least one person." : "Who is involved?")}
            {!aboutBosses && <span style={optSt}>{tr("Optional")}</span>}
          </div>
          {listFailed ? (
            <>
              <div style={{ marginTop: 8, padding: "10px 12px", background: t.orangeSubtle, border: "1px solid " + t.orangeBorder, borderRadius: R.sm, fontSize: 12, color: ORANGE, lineHeight: 1.5 }}>{tr("The staff list did not load. Try again in a minute.")}</div>
              <button onClick={() => setAttempt(a => a + 1)} disabled={sending} style={{ ...mkGhostBtn(t), marginTop: 8 }}>{tr("Try again")}</button>
            </>
          ) : (
            <>
              {chosen.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {chosen.map(p => (
                    <button key={p.id} type="button" onClick={() => setPicked(ids => ids.filter(id => id !== p.id))} disabled={sending} aria-label={tr("Remove {name}", { name: whole(p).trim() })} style={chipSt}>
                      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{whole(p).trim()}</span>
                      <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 14, lineHeight: 1, color: t.textSec }}>{tr("x")}</span>
                    </button>
                  ))}
                </div>
              )}
              <input type="text" value={search} onChange={e => setSearch(e.target.value.slice(0, 80))} disabled={sending || people === null} placeholder={tr("Search by name")} aria-label={tr("Search by name")} style={{ ...inputSt, marginTop: 10 }} />
              {/* The names scroll in their own box, so a staff list of any
                  length leaves Send where a thumb can reach it. */}
              {offered.length > 0 && (
                <div style={{ maxHeight: 264, overflowY: "auto", marginTop: 2 }}>
                  {offered.map(p => (
                    <button key={p.id} type="button" onClick={() => setPicked(ids => ids.indexOf(p.id) === -1 ? ids.concat([p.id]) : ids)} disabled={sending} style={optRow(false)}>
                      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{whole(p).trim()}</span>
                    </button>
                  ))}
                </div>
              )}
              {people !== null && offered.length === 0 && needle !== "" && (<div style={{ ...helpSt, marginTop: 10 }}>{tr("No one matches that name.")}</div>)}
            </>
          )}
        </div>
        {problem && <div style={{ padding: "10px 12px", marginBottom: 12, background: t.redSubtle, border: "1px solid " + t.redBorder, borderRadius: R.sm, fontSize: 12, color: RED, lineHeight: 1.5 }}>{problem}</div>}
        <button onClick={send} disabled={!canSend} style={{ ...mkPrimaryBtn(t, !canSend), cursor: canSend ? "pointer" : "default" }}>{sending ? tr("Sending...") : tr("Send")}</button>
      </div>
    </div>
  );
}

// The shortcuts editor. Home and More are shown in their places and cannot
// be moved. The four between them are the person's, and every destination
// not on the bar is listed under More, so nothing can be lost here. The
// draft lives in this component, so closing without Done changes nothing.
function ShortcutsSheet({ t, choices, current, ctx, onSave, onClose }) {
  // The preview draws the bar, so its labels stop growing where the
  // bar's do.
  const { textSize } = useContext(TextSizeCtx);
  const zoom = zoomOf(textSize);
  const [draft, setDraft] = useState(() => {
    const ids = (current || []).slice(0, SHORTCUT_SLOTS);
    while (ids.length < SHORTCUT_SLOTS) ids.push(null);
    return ids;
  });
  // The id waiting to go on a full bar, until the person says which of the
  // four it replaces.
  const [replacing, setReplacing] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const nameOf = (id) => { const d = destById(id); return d ? tr(d.label(ctx)) : ""; };
  const iconOf = (id) => { const d = destById(id); return d ? d.icon : null; };
  const filled = draft.filter(Boolean);
  const complete = filled.length === SHORTCUT_SLOTS;
  const under = choices.filter(d => draft.indexOf(d.id) === -1);

  const move = (i, step) => setDraft(prev => {
    const j = i + step;
    if (j < 0 || j >= SHORTCUT_SLOTS) return prev;
    const next = prev.slice();
    const a = next[i]; next[i] = next[j]; next[j] = a;
    return next;
  });
  const removeAt = (i) => setDraft(prev => { const next = prev.slice(); next[i] = null; return next; });
  const addToBar = (id) => {
    const empty = draft.indexOf(null);
    if (empty === -1) { setReplacing(id); return; }
    setDraft(prev => { const next = prev.slice(); next[empty] = id; return next; });
  };
  const replaceAt = (i) => {
    setDraft(prev => { const next = prev.slice(); next[i] = replacing; return next; });
    setReplacing(null);
  };

  const rowBtn = { minHeight: 44, minWidth: 44, padding: "0 10px", borderRadius: R.sm, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD, flexShrink: 0 };
  const wideBtn = { width: "100%", minHeight: 44, borderRadius: R.md, border: "1px solid " + t.borderSolid, background: "transparent", color: t.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD };
  const sectionSt = { fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, margin: "16px 0 8px", fontFamily: FONT_HEAD };
  const rowSt = { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "8px 10px", marginBottom: 6, background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.md };
  const nameSt = { flex: "1 1 120px", minWidth: 0, fontSize: 14, color: t.text, fontFamily: FONT_HEAD, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const fixedSt = { ...rowSt, background: t.hover, border: "1px dashed " + t.borderSolid };

  // The bar as it would be, so the result is visible before it is saved.
  const preview = [DESTINATIONS.find(d => d.home).id].concat(draft);
  const PreviewBar = (
    <div style={{ display: "flex", background: t.navBg, border: "1px solid " + t.navBorder, borderRadius: R.md, padding: "6px 0" }}>
      {preview.map((id, i) => {
        const Ic = id ? iconOf(id) : null;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 0, padding: "0 2px" }}>
            {Ic ? <Ic sz={18} c={t.textMut} /> : <div style={{ width: 18, height: 18, borderRadius: 4, border: "1px dashed " + t.textMut }} />}
            <span style={{ fontSize: barFontSize(8, zoom), color: t.textMut, letterSpacing: "0.3px", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{id ? nameOf(id) : "-"}</span>
          </div>
        );
      })}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 0, padding: "0 2px" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.textMut} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
        <span style={{ fontSize: barFontSize(8, zoom), color: t.textMut, letterSpacing: "0.3px" }}>{tr("More")}</span>
      </div>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.modalOverlay, zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.bg, width: "100%", maxWidth: 560, height: "var(--ocsa-vh, 100vh)", maxHeight: "var(--ocsa-dvh, 100dvh)", display: "flex", flexDirection: "column", borderTop: "1px solid " + t.borderSolid }}>
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid " + t.borderSolid, flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, marginBottom: 10 }}>{tr("Shortcuts")}</div>
          {PreviewBar}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 16px 16px" }}>
          <div style={sectionSt}>{tr("On your bar")}</div>
          <div style={fixedSt}>
            <HomeIco sz={18} c={t.textMut} />
            <span style={nameSt}>{tr("Home")}</span>
            <span style={{ fontSize: 10, color: t.textMut, flexShrink: 0 }}>{tr("Always first")}</span>
          </div>
          {draft.map((id, i) => {
            if (!id) {
              return (
                <div key={"empty" + i} style={{ ...rowSt, border: "1px dashed " + ORANGE }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: "1px dashed " + ORANGE, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: ORANGE }}>{tr(SHORTCUTS_EMPTY_SLOT)}</span>
                </div>
              );
            }
            const Ic = iconOf(id);
            const name = nameOf(id);
            return (
              <div key={id} style={{ ...rowSt, display: "block" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {Ic && <Ic sz={18} c={t.textSec} />}
                  <span style={nameSt}>{name}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={tr("Move up {name}", { name })} style={{ ...rowBtn, flex: 1, opacity: i === 0 ? 0.4 : 1 }}>{tr("Move up")}</button>
                  <button onClick={() => move(i, 1)} disabled={i === SHORTCUT_SLOTS - 1} aria-label={tr("Move down {name}", { name })} style={{ ...rowBtn, flex: 1, opacity: i === SHORTCUT_SLOTS - 1 ? 0.4 : 1 }}>{tr("Move down")}</button>
                  <button onClick={() => removeAt(i)} aria-label={tr("Remove {name} from the bar", { name })} style={{ ...rowBtn, flex: 1, color: RED, borderColor: RED }}>{tr("Remove")}</button>
                </div>
              </div>
            );
          })}
          <div style={fixedSt}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.textMut} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
            <span style={nameSt}>{tr("More")}</span>
            <span style={{ fontSize: 10, color: t.textMut, flexShrink: 0 }}>{tr("Always last")}</span>
          </div>

          <div style={sectionSt}>{tr("Under More")}</div>
          {under.length === 0 && <div style={{ fontSize: 12, color: t.textMut, padding: "4px 2px" }}>{tr("Everything is on your bar.")}</div>}
          {under.map(d => {
            const Ic = d.icon;
            const name = tr(d.label(ctx));
            return (
              <div key={d.id} style={rowSt}>
                <Ic sz={18} c={t.textSec} />
                <span style={nameSt}>{name}</span>
                <button onClick={() => addToBar(d.id)} aria-label={tr("Add to bar {name}", { name })} style={{ ...rowBtn, color: t.goldText, borderColor: t.goldBorder, background: t.goldBg }}>{tr("Add to bar")}</button>
              </div>
            );
          })}

          <button onClick={() => setConfirmReset(true)} style={{ ...wideBtn, marginTop: 18 }}>{tr("Reset to default")}</button>
        </div>

        <div style={{ padding: "10px 16px calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid " + t.borderSolid, display: "flex", gap: 10, flexShrink: 0, background: t.bg }}>
          <button onClick={onClose} style={{ ...wideBtn, flex: 1 }}>{tr("Close")}</button>
          <button onClick={() => onSave(draft)} disabled={!complete} style={{ flex: 1, minHeight: 44, borderRadius: R.md, border: "none", background: complete ? "linear-gradient(135deg, " + GOLD + ", " + GOLD_LIGHT + ")" : t.cardAlt, color: complete ? NAVY : t.textMut, fontSize: 14, fontWeight: 600, cursor: complete ? "pointer" : "default", fontFamily: FONT_HEAD }}>{tr("Done")}</button>
        </div>

        {replacing && (
          <div onClick={() => setReplacing(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.modalOverlay, zIndex: 410, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: "16px 16px 0 0", border: "1px solid " + t.borderSolid, width: "100%", maxWidth: 560, padding: "18px 16px 26px", boxShadow: t.popShadow }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, marginBottom: 4 }}>{tr("Replace which one?")}</div>
              <div style={{ fontSize: 12, color: t.textSec, marginBottom: 12 }}>{tr("Your bar is full.")} {nameOf(replacing)} {tr("will take the place of the one you pick.")}</div>
              {draft.map((id, i) => (
                <button key={i} onClick={() => replaceAt(i)} style={{ ...wideBtn, marginBottom: 8, textAlign: "left", padding: "0 14px" }}>{id ? nameOf(id) : tr(SHORTCUTS_EMPTY_SLOT)}</button>
              ))}
              <button onClick={() => setReplacing(null)} style={{ ...wideBtn, marginTop: 4 }}>{tr("Cancel")}</button>
            </div>
          </div>
        )}

        {confirmReset && (
          <div onClick={() => setConfirmReset(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.modalOverlay, zIndex: 410, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: "16px 16px 0 0", border: "1px solid " + t.borderSolid, width: "100%", maxWidth: 560, padding: "18px 16px 26px", boxShadow: t.popShadow }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, marginBottom: 14 }}>{tr("Put the bar back the way it came?")}</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmReset(false)} style={{ ...wideBtn, flex: 1 }}>{tr("Cancel")}</button>
                <button onClick={() => { setDraft(DEFAULT_SHORTCUTS.slice()); setConfirmReset(false); }} style={{ flex: 1, minHeight: 44, borderRadius: R.md, border: "1px solid " + RED, background: "transparent", color: RED, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Reset")}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// What a notice opens. Read from subjectType and never from link, because
// a link may point at the admin dashboard, which a person on a phone
// cannot use. A type that is not here only gets marked read.
const NOTIF_TAB = {
  supply_request: "supplies",
  time_off: "schedule",
  shift_drop: "pickup",
  shift_claim: "pickup",
  issue: "issues",
  issue_escalated: "issues",
};
const NOTIF_PAGE = 30;

// "5m", "3h", "2d", and a date once it is older than seven days.
function notifAgo(iso, nowMs) {
  const at = new Date(iso).getTime();
  if (!isFinite(at)) return "";
  const secs = Math.floor((nowMs - at) / 1000);
  if (secs < 60) return tr("now");
  const mins = Math.floor(secs / 60);
  if (mins < 60) return tr("{n}m", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tr("{n}h", { n: hours });
  const days = Math.floor(hours / 24);
  if (days <= 7) return tr("{n}d", { n: days });
  return new Date(at).toLocaleDateString(dateLocale(), { month: "short", day: "numeric" });
}

// True when the link leaves this app, so the row can offer to open it in
// a new tab instead of pretending the portal can show it.
function notifOffOrigin(link) {
  try {
    if (!link) return false;
    return new URL(link, window.location.href).origin !== window.location.origin;
  } catch (e) { return false; }
}

function NotificationsSheet({ token, t, unread, onClose, onOpenTab, onUnreadChanged }) {
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [allBusy, setAllBusy] = useState(false);
  const nowMs = Date.now();

  const load = useCallback(async (before) => {
    setBusy(true); setFailed(false);
    try {
      const d = await api("/api/notifications?limit=" + NOTIF_PAGE + (before ? "&before=" + encodeURIComponent(before) : ""), { token });
      const list = Array.isArray(d && d.notifications) ? d.notifications : [];
      setRows(prev => (before && Array.isArray(prev)) ? prev.concat(list) : list);
      setMore(list.length === NOTIF_PAGE);
      if (d && typeof d.unread === "number") onUnreadChanged(d.unread);
    } catch (err) {
      setFailed(true);
      if (!before) setRows(null);
    }
    setBusy(false);
  }, [token, onUnreadChanged]);

  useEffect(() => { load(null); }, [load]);

  const markRead = async (row) => {
    if (row.readAt) return;
    setRows(prev => (prev || []).map(r => r.id === row.id ? { ...r, readAt: new Date().toISOString() } : r));
    onUnreadChanged(Math.max(0, unread - 1));
    // The count is read again when the sheet closes, so a refusal here
    // corrects itself rather than leaving a wrong number on the bell.
    try { await api("/api/notifications/" + row.id + "/read", { method: "POST", token }); } catch (e) {}
  };

  const markAll = async () => {
    setAllBusy(true);
    try {
      await api("/api/notifications/read-all", { method: "POST", token });
      const at = new Date().toISOString();
      setRows(prev => (prev || []).map(r => ({ ...r, readAt: r.readAt || at })));
      onUnreadChanged(0);
    } catch (e) {}
    setAllBusy(false);
  };

  const openRow = async (row) => {
    await markRead(row);
    const tab = NOTIF_TAB[row.subjectType];
    if (tab) { onClose(); onOpenTab(tab); }
  };

  const wideBtn = { minHeight: 44, padding: "0 16px", borderRadius: R.md, border: "1px solid " + t.borderSolid, background: "transparent", color: t.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD };
  const canMarkAll = unread > 0 && !allBusy;

  return (
    <div onClick={onClose} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.modalOverlay, zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.bg, width: "100%", maxWidth: 560, height: "var(--ocsa-vh, 100vh)", maxHeight: "var(--ocsa-dvh, 100dvh)", display: "flex", flexDirection: "column", borderTop: "1px solid " + t.borderSolid }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid " + t.borderSolid, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{tr("Notifications")}</div>
          <button onClick={markAll} disabled={!canMarkAll} style={{ ...wideBtn, padding: "0 12px", fontSize: 12, opacity: canMarkAll ? 1 : 0.5, cursor: canMarkAll ? "pointer" : "default" }}>{allBusy ? tr("Marking...") : tr("Mark all read")}</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 16px 16px" }}>
          {rows === null && !failed && <div style={{ padding: "28px 4px", textAlign: "center", fontSize: 13, color: t.textMut }}>{tr("Loading...")}</div>}
          {rows === null && failed && (
            <div style={{ padding: "28px 4px", textAlign: "center" }}>
              <div style={{ fontSize: 14, color: t.textMut, fontFamily: FONT_HEAD }}>{tr("Notifications did not load.")}</div>
              <button onClick={() => load(null)} style={{ ...wideBtn, marginTop: 14, borderColor: t.goldBorder, background: t.goldBg, color: t.goldText, fontWeight: 600 }}>{tr("Try again")}</button>
            </div>
          )}
          {rows !== null && rows.length === 0 && <div style={{ padding: "28px 4px", textAlign: "center", fontSize: 14, color: t.textMut, fontFamily: FONT_HEAD }}>{tr("Nothing yet.")}</div>}

          {(rows || []).map(row => {
            const isUnread = !row.readAt;
            const hasTab = !!NOTIF_TAB[row.subjectType];
            const showDashboard = !hasTab && notifOffOrigin(row.link);
            return (
              <div key={row.id} style={{ marginBottom: 6, background: t.card, border: "1px solid " + (isUnread ? t.goldBorder : t.borderSolid), borderRadius: R.md }}>
                <button onClick={() => openRow(row)} style={{ width: "100%", minHeight: 56, display: "flex", alignItems: "flex-start", gap: 10, padding: "12px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: isUnread ? GOLD : "transparent", flexShrink: 0, marginTop: 5 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: isUnread ? 600 : 500, color: t.text, fontFamily: FONT_HEAD, lineHeight: 1.35 }}>{row.title}</span>
                    {row.body && <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 12, color: t.textSec, marginTop: 3, lineHeight: 1.4 }}>{row.body}</span>}
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 10, color: t.textMut, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{notifAgo(row.createdAt, nowMs)}</span>
                </button>
                {showDashboard && (
                  <div style={{ padding: "0 12px 12px" }}>
                    <button onClick={() => { try { window.open(row.link, "_blank", "noopener,noreferrer"); } catch (e) {} }} style={{ ...wideBtn, width: "100%", fontSize: 12, borderColor: t.blueBorder, color: BLUE }}>{tr("Open in the dashboard")}</button>
                  </div>
                )}
              </div>
            );
          })}

          {rows !== null && rows.length > 0 && failed && (
            <div style={{ padding: "10px 4px", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: t.textMut }}>{tr("Notifications did not load.")}</div>
              <button onClick={() => load(rows[rows.length - 1].createdAt)} style={{ ...wideBtn, marginTop: 8 }}>{tr("Try again")}</button>
            </div>
          )}
          {rows !== null && rows.length > 0 && more && !failed && (
            <button onClick={() => load(rows[rows.length - 1].createdAt)} disabled={busy} style={{ ...wideBtn, width: "100%", marginTop: 8, opacity: busy ? 0.6 : 1 }}>{busy ? tr("Loading...") : tr("Load more")}</button>
          )}
        </div>

        <div style={{ padding: "10px 16px calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid " + t.borderSolid, flexShrink: 0, background: t.bg }}>
          <button onClick={onClose} style={{ ...wideBtn, width: "100%" }}>{tr("Close")}</button>
        </div>
      </div>
    </div>
  );
}

// Change PIN, lifted out of Profile unchanged so Settings can hold it.
// The current PIN is required here. The threat on this screen is a handset
// left unlocked, so the change has to prove it is the owner.
function ChangePinCard({ token, user, showToast, t, cardSt }) {
  const [pinForm, setPinForm] = useState({ current: "", next: "", confirm: "" });
  const [pinErrs, setPinErrs] = useState({});
  const [pinSaving, setPinSaving] = useState(false);
  const labelSt = mkLabel(t);
  const inputSt = mkInput(t);

  const changePin = async () => {
    const e = {};
    if (!PIN_RE.test(pinForm.current)) e.current = tr("Enter your current 4-digit PIN.");
    const why = weakPinReason(pinForm.next, user && user.badgeNumber);
    if (why) e.next = why;
    else if (pinForm.confirm !== pinForm.next) e.confirm = tr(ERR_PIN_MISMATCH);
    else if (pinForm.next === pinForm.current) e.next = tr("Your new PIN must be different from your current PIN.");
    setPinErrs(e);
    if (Object.keys(e).length) return;
    setPinSaving(true);
    try {
      await api("/api/auth/change-pin", { method: "POST", body: { currentPin: pinForm.current, newPin: pinForm.next }, token });
      showToast(tr("PIN updated"));
      setPinForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      // The API's own sentence says which PIN it means; it is read in
      // English, and drawn in the person's language.
      const said = err.message || "Could not update your PIN.";
      const msg = tr(said);
      setPinErrs(/new/i.test(said) ? { next: msg } : { current: msg });
    }
    setPinSaving(false);
  };

  return (
    <div style={cardSt}>
      <div style={{ ...labelSt, marginBottom: 6 }}>{tr("Change PIN")}</div>
      <div style={{ fontSize: 11, color: t.textMut, marginBottom: 12, lineHeight: 1.4 }}>{tr("Your PIN is 4 digits. Choose one that only you know.")}</div>
      <div style={{ marginBottom: 10 }}><label style={labelSt}>{tr("Current PIN")}</label><input value={pinForm.current} onChange={e => setPinForm({ ...pinForm, current: e.target.value })} {...PIN_INPUT_PROPS} style={{ ...inputSt, letterSpacing: "8px", textAlign: "center", fontSize: 20 }} />{pinErrs.current && <div style={mkFieldErr(t)}>{pinErrs.current}</div>}</div>
      <div style={{ marginBottom: 10 }}><label style={labelSt}>{tr("New PIN")}</label><input value={pinForm.next} onChange={e => setPinForm({ ...pinForm, next: e.target.value })} {...PIN_INPUT_PROPS} style={{ ...inputSt, letterSpacing: "8px", textAlign: "center", fontSize: 20 }} />{pinErrs.next && <div style={mkFieldErr(t)}>{pinErrs.next}</div>}</div>
      <div style={{ marginBottom: 10 }}><label style={labelSt}>{tr("Confirm New PIN")}</label><input value={pinForm.confirm} onChange={e => setPinForm({ ...pinForm, confirm: e.target.value })} {...PIN_INPUT_PROPS} style={{ ...inputSt, letterSpacing: "8px", textAlign: "center", fontSize: 20 }} onKeyDown={e => e.key === "Enter" && !pinSaving && changePin()} />{pinErrs.confirm && <div style={mkFieldErr(t)}>{pinErrs.confirm}</div>}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <button onClick={changePin} disabled={pinSaving} style={{ minHeight: 44, padding: "0 18px", borderRadius: R.md, border: "none", background: "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")", color: NAVY, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: pinSaving ? 0.6 : 1, textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: FONT_HEAD, boxShadow: "0 6px 18px rgba(231,176,23,0.30)" }}>{pinSaving ? tr("Saving...") : tr("Update PIN")}</button>
      </div>
    </div>
  );
}

// Settings, separate from Profile. Profile is who a person is; this is how
// the app behaves for them. Every card here follows the account once the
// API carries preferences.
function SettingsView({ token, user, showToast, t, themeMode, setTheme, textSize, setTextSize, language, setLanguage, onEditShortcuts }) {
  const cardSt = { background: t.card, border: "1px solid " + t.border, borderRadius: R.md, padding: 16, marginBottom: 12 };
  const labelSt = mkLabel(t);
  const lineSt = { fontSize: 11, color: t.textMut, marginBottom: 12, lineHeight: 1.4 };
  const pickBtn = (picked) => ({
    flex: 1, minHeight: 44, borderRadius: R.md, cursor: "pointer", fontSize: 14, fontWeight: picked ? 600 : 500, fontFamily: FONT_HEAD,
    background: picked ? t.goldBg : t.card, border: picked ? "1.5px solid " + GOLD : "1px solid " + t.borderSolid, color: t.text,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  });
  const dot = (picked) => ({ width: 14, height: 14, flexShrink: 0, borderRadius: "50%", background: picked ? GOLD : "transparent", border: picked ? "none" : "2px solid " + t.borderSolid });

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 14, fontFamily: FONT_HEAD }}>{tr("Settings")}</div>

      <div style={cardSt}>
        <div style={{ ...labelSt, marginBottom: 6 }}>{tr("Appearance")}</div>
        <div style={lineSt}>{tr("Choose how the app looks.")}</div>
        <div style={{ display: "flex", gap: 10 }}>
          {[["light", tr("Light")], ["dark", tr("Dark")]].map(([id, label]) => {
            const picked = themeMode === id;
            return <button key={id} onClick={() => setTheme(id)} aria-label={label} style={pickBtn(picked)}><span style={dot(picked)} />{label}</button>;
          })}
        </div>
      </div>

      <div style={cardSt}>
        <div style={{ ...labelSt, marginBottom: 6 }}>{tr("Text size")}</div>
        <div style={lineSt}>{tr("Makes everything in the app bigger.")}</div>
        <TextSizeChoices value={textSize} onChange={setTextSize} t={t} />
      </div>

      <div style={cardSt}>
        <div style={{ ...labelSt, marginBottom: 6 }}>{tr("Shortcuts")}</div>
        <div style={lineSt}>{tr(SHORTCUTS_CARD_LINE)}</div>
        <button onClick={onEditShortcuts} style={{ width: "100%", minHeight: 44, borderRadius: R.md, border: "1px solid " + GOLD, background: "transparent", color: t.goldText, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Edit shortcuts")}</button>
      </div>

      <div style={cardSt}>
        <div style={{ ...labelSt, marginBottom: 6 }}>{tr("Language")}</div>
        <div style={lineSt}>{tr("The app, Help and report forms use this language.")}</div>
        <div style={{ display: "flex", gap: 10 }}>
          {LANGUAGES.map(l => {
            const picked = language === l.id;
            return <button key={l.id} onClick={() => setLanguage(l.id)} aria-label={l.label} style={pickBtn(picked)}><span style={dot(picked)} />{l.label}</button>;
          })}
        </div>
      </div>

      <ChangePinCard token={token} user={user} showToast={showToast} t={t} cardSt={cardSt} />
    </div>
  );
}

// ------------------------------------------------------------
// Forms
// The same report the Help chat fills, filled as a form instead.
// The catalog says which questions a person is asked and when
// each conditional one applies; the draft holds the answers. One
// open draft per person per form, whichever way it was opened, so
// a report started in Help finishes here and the other way round.
//
// A report can carry an account of an injury, so no answer, no
// label value and no draft id is written to storage, the URL, the
// title or the console. Everything below lives in memory for as
// long as the screen is open.
// ------------------------------------------------------------
const FORMS_LOAD_FAILED = "Forms could not load. Check your signal and try again.";
const FORMS_NOT_SAVED = "Not saved yet. Check your signal and tap Next again.";
const FORMS_NOT_SENT = "Not sent yet. Check your signal and tap Submit report again.";
const FORMS_NOT_SIGNED = "Not signed yet. Check your signal and tap Sign again.";
const FORMS_SEND_LINE = "Send this report? You cannot change it after it is sent.";
const FORMS_SENT_LINE = "Report sent. The people who handle these reports have been told.";
const FORMS_ALREADY_LINE = "This report was already sent.";
// What the API clips a stored answer to, so a long answer is
// stopped in the box rather than truncated after it is sent.
const FORM_VALUE_MAX = 4000;
const FORMS_LEAVE_LINE = "Leave this report? Your saved answers stay, and you can continue from Forms or Help.";

// The data twin of the rule the API evaluates, read exactly the
// way the API reads it. A shape this cannot recognize counts as
// holding, so a rule the portal does not understand shows the
// question rather than hiding it.
function formRuleHolds(rule, answers) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) return true;
  const a = answers || {};
  if (Array.isArray(rule.any)) return rule.any.some(r => formRuleHolds(r, a));
  if (Array.isArray(rule.all)) return rule.all.every(r => formRuleHolds(r, a));
  if (typeof rule.key !== "string" || !Array.isArray(rule.anyOf)) return true;
  const v = a[rule.key];
  if (Array.isArray(v)) return v.some(x => rule.anyOf.indexOf(x) !== -1);
  return rule.anyOf.indexOf(v) !== -1;
}

const formHasAnswer = (v) => {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

// Every question this person is asked for the answers so far. A
// prefilled question is already on the draft and is never shown.
const formFieldsInPlay = (form, answers) =>
  (form && Array.isArray(form.fields) ? form.fields : []).filter(f => !f.prefilled && formRuleHolds(f.appliesWhen, answers));

const formSectionOf = (f) => (f.section === null || f.section === undefined ? "" : String(f.section));
// The sections in play, in the order they first appear. A section
// with no question in play is not one of them.
function formSectionsOf(fields) {
  const out = [];
  for (const f of fields) { const k = formSectionOf(f); if (out.indexOf(k) === -1) out.push(k); }
  return out;
}

const formOptionLabel = (f, v) => {
  const s = String(v);
  const o = (f.options || []).find(x => String(x.value) === s);
  return o ? o.label : s;
};
// An answer as a person reads it: an option's label rather than the
// value behind it, a multiselect joined, and null when nothing was
// answered. An answer of a shape this page cannot read yet says
// Answered rather than showing the object behind it.
const formPlainValue = (v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean";
function formReadAnswer(f, v) {
  if (!formHasAnswer(v)) return null;
  if (Array.isArray(v)) {
    if (!v.every(formPlainValue)) return tr(FORMS_ANSWERED);
    const parts = v.map(x => formOptionLabel(f, x)).filter(x => x !== "");
    return parts.length ? parts.join(", ") : null;
  }
  if (!formPlainValue(v)) return tr(FORMS_ANSWERED);
  return formOptionLabel(f, v);
}

// One cell as a person reads it: an option's label rather than the value
// behind it, and an empty string where nothing was answered.
const formCellRead = (col, v) => {
  if (v === undefined || v === null || v === "") return "";
  if (col.type === "select" || col.type === "multiselect") return formReadAnswer(col, v) || "";
  return String(v);
};
// A row is finished when every column that asks for an answer has one.
const formRowDone = (columns, row) => (columns || []).every(c => !c.required || formHasAnswer((row || {})[c.key]));
// A grid whose rows the form names is a checklist; one with no rows of
// its own is a table a person adds rows to.
const formIsChecklist = (f) => Array.isArray(f.rows);
// A sign-off belongs either to the person filing the report or to the
// supervisor half, which the portal has never drawn. The report keeps
// whatever it already carries for one it does not draw.
const formDrawnOnPortal = (f) => formTypeOf(f) !== "signoff" || String(f.signer || "") === "filer";
// One sign-off as a person reads it, in the phone's own time.
const formStampLine = (v) => (v && typeof v === "object" && v.at
  ? tr("Signed by {name} on {date} at {time}", { name: v.name || "", date: formatDate(v.at), time: formatTime(v.at) })
  : null);

// What a draft with no name of its own is called. Report on its own is
// the tab, which is a different thing.
const FORMS_UNTITLED = "Untitled report";
// A question of a type this screen does not draw yet, and an answer of a
// shape it cannot read.
const FORMS_UNKNOWN_TYPE = "This question cannot be answered here yet. Your supervisor will finish it.";
const FORMS_ANSWERED = "Answered";
// The types this screen draws. Anything else says the line above and
// asks for nothing, so a type the forms engine adds later cannot quietly
// become a text box. A question with no type at all is text, which is
// what it has always been.
const FORM_TYPES_DRAWN = ["", "text", "textarea", "select", "multiselect", "date", "time", "grid", "signoff"];
const formTypeOf = (f) => (f && f.type ? String(f.type) : "");

const formDraftOf = (r) => (r && r.draft ? r.draft : r);

// The list of forms, and the one button on each card.
function FormsView({ token, user, showToast, t, language, openDraft, onOpenedDraft }) {
  const [forms, setForms] = useState(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [starting, setStarting] = useState(null);
  const [open, setOpen] = useState(null);

  const locale = language === "es" ? "es" : "en";

  // Once per visit. The catalog decides the screen, so a failure
  // here is the whole screen's failure; the draft list only
  // decides a label, so a failure there leaves the cards saying
  // Start report and the API resumes the open draft anyway.
  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      const c = await api("/api/forms?locale=" + locale, { token });
      setForms(agentList(c, ["forms"]));
    } catch (err) { setFailed(true); setLoading(false); return; }
    try {
      const d = agentList(await api("/api/agent/drafts?locale=" + locale, { token }), ["drafts", "items", "rows"]);
      // Whoever may read reports is served everyone's drafts on
      // this route, so the rows are narrowed to this person's
      // before a card can say Continue on somebody else's report.
      const mine = user && user.id;
      setRows(d.filter(r => r.userId === undefined || r.userId === null || !mine || String(r.userId) === String(mine)));
    } catch (err) { setRows([]); }
    setLoading(false);
  }, [token, locale, user]);
  useEffect(() => { load(); }, [load]);

  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const openOn = useCallback((draft) => {
    if (!draft || !draft.id || !alive.current) return;
    setOpen(draft);
  }, []);

  // Help hands over a draft id. The catalog has to be in hand
  // first, because the form is what says which questions it has,
  // so the id is held until the catalog arrives and is handed back
  // only once the report is open. The ref is what keeps that from
  // running twice.
  const handedOver = useRef(null);
  useEffect(() => {
    if (!openDraft || !forms) return;
    if (handedOver.current === openDraft) return;
    handedOver.current = openDraft;
    (async () => {
      try {
        const r = await api("/api/forms/drafts/" + encodeURIComponent(openDraft) + "?locale=" + locale, { token });
        openOn(formDraftOf(r));
      } catch (err) { if (alive.current) showToast(tr(err.message), "error"); }
      onOpenedDraft();
    })();
  }, [openDraft, forms, locale, token, openOn, onOpenedDraft, showToast]);

  const startOn = async (code) => {
    setStarting(code);
    try {
      const r = await api("/api/forms/" + encodeURIComponent(code) + "/drafts?locale=" + locale, { method: "POST", token });
      openOn(formDraftOf(r));
    } catch (err) { showToast(tr(err.message), "error"); }
    setStarting(null);
  };

  const cardSt = { background: t.card, border: "1px solid " + t.border, borderRadius: R.md, padding: 16, marginBottom: 12 };
  const titleSt = { fontSize: 15, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, lineHeight: 1.35 };
  const lineSt = { fontSize: 11, color: t.textMut, marginTop: 6, lineHeight: 1.4 };
  const goBtn = (busy) => ({ width: "100%", minHeight: 44, marginTop: 12, borderRadius: R.md, border: "1px solid " + GOLD, background: busy ? "transparent" : t.goldBg, color: t.goldText, fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: FONT_HEAD });

  const draftFor = (code) => rows.find(r => String(agentField(r, ["formCode", "form_code"], "")) === String(code)) || null;

  if (open) {
    const form = (forms || []).find(f => String(f.code) === String(open.formCode)) || null;
    return <FormFiller token={token} t={t} locale={locale} form={form} draft={open} onLeave={() => { setOpen(null); load(); }} />;
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 14, fontFamily: FONT_HEAD }}>{tr("Forms")}</div>

      {loading && <div style={{ ...cardSt, fontSize: 13, color: t.textMut }}>{tr("Loading forms")}</div>}

      {!loading && failed && (
        <div style={cardSt}>
          <div style={{ fontSize: 13, color: t.text, lineHeight: 1.5 }}>{tr(FORMS_LOAD_FAILED)}</div>
          <button onClick={load} style={goBtn(false)}>{tr("Try again")}</button>
        </div>
      )}

      {!loading && !failed && (forms || []).length === 0 && <EmptyState icon={DocIco} text={tr("No forms to fill right now.")} t={t} />}

      {!loading && !failed && (forms || []).map(f => {
        const d = draftFor(f.code);
        const busy = starting === f.code;
        const answered = d ? agentField(d, ["answered", "answeredCount", "answered_count"], null) : null;
        const remaining = d ? agentField(d, ["remaining", "remainingCount", "remaining_count"], null) : null;
        return (
          <div key={f.code} style={cardSt}>
            <div style={titleSt}>{f.title}</div>
            {d && answered !== null && remaining !== null && <div style={lineSt}>{tr("{answered} answered, {remaining} to go", { answered, remaining })}</div>}
            <button onClick={() => startOn(f.code)} disabled={busy} style={goBtn(busy)}>{busy ? tr("Opening") : (d ? tr("Continue") : tr("Start report"))}</button>
          </div>
        );
      })}
    </div>
  );
}

// One report, open, a section at a time. Which questions are in
// play is read from the answers on screen rather than the answers
// on the server, so a question appears or disappears the moment
// the answer that opens it does.
function FormFiller({ token, t, locale, form, draft, onLeave }) {
  const [current, setCurrent] = useState(draft);
  const [values, setValues] = useState(() => Object.assign({}, draft.answers || {}));
  const [dirty, setDirty] = useState({});
  const [sectionKey, setSectionKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  const [badKeys, setBadKeys] = useState([]);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Which cards of a table a person has opened again after they folded.
  const [openRows, setOpenRows] = useState({});
  // The sign-off on its way to the API, and what it said if it refused.
  const [signing, setSigning] = useState(null);
  const [signErr, setSignErr] = useState({});
  const [review, setReview] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState(null);
  const [sent, setSent] = useState(null);
  const bodyRef = useRef(null);
  // An answer typed and not yet saved, or a save or a send on its way.
  useBusy("report form", Object.keys(dirty).length > 0 || saving || sending);

  // Every question in play, which is what a save is judged against, and
  // the ones this screen draws, which is what a person walks through.
  const fields = formFieldsInPlay(form, values);
  const shown = fields.filter(formDrawnOnPortal);
  const sections = formSectionsOf(shown);
  // A section cannot empty from an answer given inside it, because
  // the answer that governs it is somewhere else. If one ever did,
  // the first section is where this lands rather than nowhere.
  const here = sections.indexOf(sectionKey) !== -1 ? sectionKey : (sections.length > 0 ? sections[0] : null);
  const at = sections.indexOf(here);
  const pageFields = shown.filter(f => formSectionOf(f) === here);

  // What is still unanswered is the server's judgement, never this
  // screen's: it already reads the same rules over the same answers.
  const missing = Array.isArray(current.missing) ? current.missing : [];
  const fieldByKey = (k) => (form && Array.isArray(form.fields) ? form.fields : []).find(f => f.key === k) || null;
  // What is still short an answer, in the words the API uses: the
  // question's own label, and for a table or a checklist the rows it is
  // short. Where the API names only keys, the form's own labels stand in,
  // which is what this screen has always shown.
  const missingNamed = () => {
    const named = Array.isArray(current.missingFields) ? current.missingFields : null;
    if (named) return named.map(m => ({ key: m.key, label: m.label ? String(m.label) : String(m.key || ""), rows: Array.isArray(m.rows) ? m.rows.filter(Boolean) : [] }));
    return missing.map(k => { const f = fieldByKey(k); return { key: k, label: f ? f.label : k, rows: [] }; });
  };

  const answered = Number(current.answered || 0);
  const remaining = Number(current.remaining || 0);
  const total = answered + remaining;
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  const setVal = (key, v) => {
    setValues(prev => {
      const next = Object.assign({}, prev);
      if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) delete next[key];
      else next[key] = v;
      return next;
    });
    setDirty(prev => Object.assign({}, prev, { [key]: true }));
    setBadKeys(prev => prev.filter(k => k !== key));
  };

  // What one save sends: every answer on this page that changed,
  // and any answer anywhere that those changes have closed. A
  // question that is no longer asked must not keep an answer on
  // the report, because the copy a supervisor reads carries every
  // field of the form whether it was asked or not.
  const changedAnswers = () => {
    const out = {};
    const inPlay = fields.map(f => f.key);
    Object.keys(dirty).forEach(k => {
      if (inPlay.indexOf(k) === -1) return;
      out[k] = formHasAnswer(values[k]) ? values[k] : null;
    });
    (form && Array.isArray(form.fields) ? form.fields : []).forEach(f => {
      if (f.prefilled || inPlay.indexOf(f.key) !== -1) return;
      if (formHasAnswer(values[f.key]) || formHasAnswer((current.answers || {})[f.key])) out[f.key] = null;
    });
    return out;
  };

  // One PATCH. It answers with the whole draft, so the counts, the
  // missing list and the answers on screen all come back from the
  // server rather than being guessed at here. Returns the answers
  // afterwards, or null when nothing was written.
  const save = async () => {
    const body = changedAnswers();
    if (Object.keys(body).length === 0) { setSaveErr(null); setBadKeys([]); return values; }
    setSaving(true); setSaveErr(null); setBadKeys([]);
    try {
      const r = await api("/api/forms/drafts/" + encodeURIComponent(current.id) + "?locale=" + locale, { method: "PATCH", token, body: { answers: body } });
      const d = formDraftOf(r);
      const after = Object.assign({}, d.answers || {});
      setCurrent(d); setValues(after); setDirty({});
      setSaving(false);
      return after;
    } catch (err) {
      // A request that never reached the server carries no status.
      if (err.status === undefined || err.status === null) setSaveErr(tr(FORMS_NOT_SAVED));
      else { setSaveErr(tr(err.message)); setBadKeys(Array.isArray(err.body && err.body.keys) ? err.body.keys : []); }
      setSaving(false);
      return null;
    }
  };

  // A sign-off is made with its own request, never written as an answer,
  // and nothing is drawn until the API has answered with the stamp it
  // made. One press sends one request.
  const sign = async (f) => {
    if (signing) return;
    setSigning(f.key);
    setSignErr(prev => Object.assign({}, prev, { [f.key]: null }));
    try {
      const r = await api("/api/forms/responses/" + encodeURIComponent(current.id) + "/signoff?locale=" + locale, { method: "POST", token, body: { key: f.key } });
      const d = formDraftOf(r && r.response ? r.response : r);
      setCurrent(d);
      // The answers come back from the server, and anything typed on
      // this page and not saved yet stays where the person left it.
      setValues(prev => {
        const next = Object.assign({}, d.answers || {});
        Object.keys(dirty).forEach(k => { if (formHasAnswer(prev[k])) next[k] = prev[k]; else delete next[k]; });
        return next;
      });
    } catch (err) {
      const said = (err.status === undefined || err.status === null) ? tr(FORMS_NOT_SIGNED) : tr(err.message);
      setSignErr(prev => Object.assign({}, prev, { [f.key]: said }));
    }
    setSigning(null);
  };

  const toTop = () => { if (bodyRef.current) bodyRef.current.scrollTop = 0; };

  const goNext = async () => {
    if (saving) return;
    const after = await save();
    if (!after) return;
    const list = formSectionsOf(formFieldsInPlay(form, after).filter(formDrawnOnPortal));
    const i = list.indexOf(here);
    if (i === -1 || i + 1 >= list.length) { setSendErr(null); setReview(true); toTop(); return; }
    setSectionKey(list[i + 1]); toTop();
  };

  const goBack = async () => {
    if (saving) return;
    if (review) { setReview(false); setSectionKey(sections[sections.length - 1] || null); toTop(); return; }
    const after = await save();
    if (!after) return;
    const list = formSectionsOf(formFieldsInPlay(form, after).filter(formDrawnOnPortal));
    const i = list.indexOf(here);
    if (i <= 0) return;
    setSectionKey(list[i - 1]); toTop();
  };

  const editSection = (sk) => { setReview(false); setSendErr(null); setSectionKey(sk); toTop(); };

  const submit = async () => {
    setConfirmSend(false);
    if (sending) return;
    setSending(true); setSendErr(null);
    try {
      await api("/api/forms/drafts/" + encodeURIComponent(current.id) + "/submit?locale=" + locale, { method: "POST", token });
      setSent("sent");
    } catch (err) {
      if (err.status === 409) setSent("already");
      // The server decides what is still unanswered, so a refusal
      // naming keys replaces the list rather than arguing with it.
      else if (err.status === 400 && Array.isArray(err.body && err.body.missing)) {
        setCurrent(prev => Object.assign({}, prev, {
          missing: err.body.missing,
          missingFields: Array.isArray(err.body.missingFields) ? err.body.missingFields : null,
        }));
        setSendErr(tr(err.message)); toTop();
      }
      else if (err.status === undefined || err.status === null) setSendErr(tr(FORMS_NOT_SENT));
      else setSendErr(tr(err.message));
    }
    setSending(false);
  };

  // Whatever is not saved yet is sent first, and the person leaves
  // either way: a refusal here would strand them on a report they
  // asked to close.
  const leave = async () => { setConfirmLeave(false); await save(); onLeave(); };

  const qSt = { marginBottom: 20 };
  const labelSt = { fontSize: 14, fontWeight: 600, color: t.text, lineHeight: 1.45, fontFamily: FONT_HEAD, overflowWrap: "anywhere" };
  const reqSt = { fontSize: 11, fontWeight: 600, color: t.textMut, marginLeft: 6, whiteSpace: "nowrap" };
  const inputSt = { ...mkInput(t), minHeight: 44, marginTop: 8 };
  const optRow = (picked) => ({
    width: "100%", minHeight: 44, marginTop: 8, padding: "10px 12px", borderRadius: R.md, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 10, textAlign: "left", fontSize: 14, fontFamily: FONT_BODY, lineHeight: 1.4,
    background: picked ? t.goldBg : t.card, border: picked ? "1.5px solid " + GOLD : "1px solid " + t.borderSolid, color: t.text,
  });
  const mark = (picked, round) => ({ width: 16, height: 16, flexShrink: 0, borderRadius: round ? "50%" : 4, background: picked ? GOLD : "transparent", border: picked ? "none" : "2px solid " + t.borderSolid });
  const footBtn = (primary, off) => ({
    flex: 1, minHeight: 44, borderRadius: R.md, fontSize: 14, fontWeight: 600, fontFamily: FONT_HEAD, cursor: off ? "default" : "pointer", opacity: off ? 0.6 : 1,
    border: primary ? "1px solid " + GOLD : "1px solid " + t.borderSolid, background: primary ? t.goldBg : "transparent", color: primary ? t.goldText : t.textSec,
  });

  // A block inside a grid: one item of a checklist, or one row of a
  // table. Drawn as a card rather than as a cell in a row, because at
  // the Largest text size the body is about 218 pixels across, which
  // holds one field and nothing beside it.
  const gridCard = { marginTop: 10, padding: 12, borderRadius: R.md, background: t.card, border: "1px solid " + t.borderSolid };
  const gridName = { fontSize: 13, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, lineHeight: 1.4, overflowWrap: "anywhere" };
  const cellLabelSt = { fontSize: 12, color: t.textSec, marginTop: 10, lineHeight: 1.45, overflowWrap: "anywhere" };
  const gridBtn = {
    width: "100%", minHeight: TAP, marginTop: 10, padding: "10px 12px", borderRadius: R.md, cursor: "pointer",
    border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec,
    fontSize: 13, fontWeight: 600, fontFamily: FONT_HEAD, textAlign: "center",
  };
  const foldedBtn = { ...gridBtn, background: t.card, color: t.text, textAlign: "left", fontWeight: 400, fontFamily: FONT_BODY, lineHeight: 1.45, overflowWrap: "anywhere" };

  // One control, for a question or for one cell inside a grid. A cell
  // gets the same input its type gets as a question, the date and the
  // time pickers included.
  const renderControl = (spec, v, onChange, at) => {
    if (spec.type === "select" || spec.type === "multiselect") {
      const many = spec.type === "multiselect";
      const chosen = many ? (Array.isArray(v) ? v : []) : v;
      return (spec.options || []).map(o => {
        const picked = many ? chosen.indexOf(o.value) !== -1 : chosen === o.value;
        const toggle = () => {
          if (!many) { onChange(picked ? null : o.value); return; }
          onChange(picked ? chosen.filter(x => x !== o.value) : chosen.concat([o.value]));
        };
        return <button key={at + o.value} type="button" onClick={toggle} aria-pressed={picked} style={optRow(picked)}><span style={mark(picked, !many)} /><span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{o.label}</span></button>;
      });
    }
    if (spec.type === "textarea") return <textarea rows={4} maxLength={FORM_VALUE_MAX} value={v === undefined || v === null ? "" : v} onChange={e => onChange(e.target.value)} style={{ ...inputSt, minHeight: 104, resize: "vertical", lineHeight: 1.5 }} />;
    const kind = spec.type === "date" ? "date" : (spec.type === "time" ? "time" : "text");
    return <input type={kind} maxLength={kind === "text" ? FORM_VALUE_MAX : undefined} value={v === undefined || v === null ? "" : v} onChange={e => onChange(e.target.value)} style={inputSt} />;
  };

  // Every column of one block. The pick one column is the row of
  // buttons pick one already draws, and its name is left to the block's
  // own heading above it.
  const renderCells = (f, row, at, write) => (f.columns || []).map(c => (
    <div key={c.key}>
      {c.type !== "select" && <div style={cellLabelSt}>{c.label}{c.required && <span style={reqSt}>{tr("Required")}</span>}</div>}
      {renderControl(c, (row || {})[c.key], v => write(c.key, v), f.key + ":" + at + ":" + c.key + ":")}
    </div>
  ));

  // A checklist: one block per item the form names, keyed by row.
  const renderChecklist = (f) => {
    const all = (values[f.key] && typeof values[f.key] === "object" && !Array.isArray(values[f.key])) ? values[f.key] : {};
    const write = (rowKey, colKey, v) => {
      const next = Object.assign({}, all);
      const row = Object.assign({}, next[rowKey] || {});
      if (!formHasAnswer(v)) delete row[colKey]; else row[colKey] = v;
      if (Object.keys(row).length === 0) delete next[rowKey]; else next[rowKey] = row;
      setVal(f.key, Object.keys(next).length === 0 ? null : next);
    };
    return (f.rows || []).map(r => (
      <div key={r.key} style={gridCard}>
        <div style={gridName}>{r.label}</div>
        {renderCells(f, all[r.key], r.key, (colKey, v) => write(r.key, colKey, v))}
      </div>
    ));
  };

  // A table a person adds rows to: one card per row, folded to a line
  // once every column that asks for an answer has one, and opened again
  // on a tap.
  const renderRowTable = (f) => {
    const list = Array.isArray(values[f.key]) ? values[f.key] : [];
    const put = (next) => setVal(f.key, next.length === 0 ? null : next);
    const write = (i, colKey, v) => {
      const next = list.map((row, j) => (j === i ? Object.assign({}, row) : row));
      if (!formHasAnswer(v)) delete next[i][colKey]; else next[i][colKey] = v;
      put(next);
    };
    const open = (i, yes) => setOpenRows(prev => Object.assign({}, prev, { [f.key + ":" + i]: yes }));
    const remove = (i) => { setOpenRows({}); put(list.filter((row, j) => j !== i)); };
    const full = Number(f.maxRows) > 0 && list.length >= Number(f.maxRows);
    const first = (f.columns || [])[0];
    return (
      <>
        {list.map((row, i) => {
          if (formRowDone(f.columns, row) && !openRows[f.key + ":" + i]) {
            return (
              <button key={i} type="button" onClick={() => open(i, true)} style={foldedBtn}>
                {tr("Row {n}", { n: i + 1 })}: {first ? formCellRead(first, row[first.key]) : ""}
              </button>
            );
          }
          return (
            <div key={i} style={gridCard}>
              <div style={gridName}>{tr("Row {n}", { n: i + 1 })}</div>
              {renderCells(f, row, i, (colKey, v) => write(i, colKey, v))}
              <button type="button" onClick={() => remove(i)} style={gridBtn}>{tr("Remove row")}</button>
            </div>
          );
        })}
        {full
          ? <div style={{ ...mkHelp(t), marginTop: 10 }}>{tr("This table is full.")}</div>
          : <button type="button" onClick={() => { open(list.length, true); put(list.concat([{}])); }} style={gridBtn}>{tr("Add row")}</button>}
      </>
    );
  };

  // One sign-off: the stamp the API made, or the button that asks for it.
  const renderSignoff = (f) => {
    const line = formStampLine(values[f.key]);
    if (line) return <div style={{ fontSize: 14, color: t.text, marginTop: 8, lineHeight: 1.5, overflowWrap: "anywhere" }}>{line}</div>;
    const busy = signing === f.key;
    return (
      <>
        <button type="button" onClick={() => sign(f)} disabled={busy} style={{ ...gridBtn, border: "1px solid " + GOLD, background: busy ? "transparent" : t.goldBg, color: t.goldText, opacity: busy ? 0.6 : 1 }}>{busy ? tr("Sending") : tr("Sign")}</button>
        {signErr[f.key] && <div style={{ ...mkFieldErr(t), marginTop: 8 }}>{signErr[f.key]}</div>}
      </>
    );
  };

  const renderInput = (f) => {
    const v = values[f.key];
    if (FORM_TYPES_DRAWN.indexOf(formTypeOf(f)) === -1) return <div style={mkHelp(t)}>{tr(FORMS_UNKNOWN_TYPE)}</div>;
    if (formTypeOf(f) === "grid") return formIsChecklist(f) ? renderChecklist(f) : renderRowTable(f);
    if (formTypeOf(f) === "signoff") return renderSignoff(f);
    return renderControl(f, v, (next) => setVal(f.key, next), f.key + ":");
  };

  // Leaving unmounts this component, which is what clears the draft
  // and every answer from memory.
  if (sent) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ background: t.card, border: "1px solid " + t.border, borderRadius: R.md, padding: 18 }}>
          <div style={{ fontSize: 14, color: t.text, lineHeight: 1.55, marginBottom: 16 }}>{sent === "already" ? tr(FORMS_ALREADY_LINE) : tr(FORMS_SENT_LINE)}</div>
          <button onClick={onLeave} style={footBtn(true, false)}>{tr("Done")}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", ...fillsTheWindow(), minHeight: 0 }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + t.borderSolid, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, lineHeight: 1.35, overflowWrap: "anywhere" }}>{current.formName || (form && form.title) || tr(FORMS_UNTITLED)}</div>
            {sections.length > 0 && <div style={{ fontSize: 11, color: t.textMut, marginTop: 4 }}>{review ? tr("Review") : tr("Section {n} of {total}", { n: at + 1, total: sections.length })}</div>}
          </div>
          <button onClick={() => setConfirmLeave(true)} style={{ minHeight: 44, padding: "0 14px", borderRadius: R.sm, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD, flexShrink: 0 }}>{tr("Close")}</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 120px", minWidth: 80, height: 6, borderRadius: 3, background: t.borderSolid, overflow: "hidden" }}>
            <div style={{ height: "100%", width: pct + "%", background: GOLD, borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 11, color: t.textMut, flexShrink: 0 }}>{tr("{answered} answered", { answered })}</div>
        </div>
      </div>

      <div ref={bodyRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16 }}>
        {(review ? sendErr : saveErr) && <div style={{ padding: "10px 12px", marginBottom: 16, borderRadius: R.md, background: t.redSubtle, border: "1px solid " + t.redBorder, color: t.text, fontSize: 13, lineHeight: 1.5 }}>{review ? sendErr : saveErr}</div>}
        {!form && <div style={{ fontSize: 13, color: t.textMut, lineHeight: 1.5 }}>{tr(FORMS_LOAD_FAILED)}</div>}

        {review && missing.length > 0 && (
          <div style={{ padding: 14, marginBottom: 18, borderRadius: R.md, background: t.goldSubtle, border: "1px solid " + t.goldBorder }}>
            <div style={{ ...mkLabel(t), marginBottom: 10 }}>{tr("These still need an answer")}</div>
            {missingNamed().map(m => {
              const f = fieldByKey(m.key);
              return <button key={m.key} onClick={() => editSection(f ? formSectionOf(f) : null)} style={{ width: "100%", minHeight: 44, marginBottom: 8, padding: "10px 12px", textAlign: "left", borderRadius: R.sm, border: "1px solid " + t.borderSolid, background: t.card, color: t.text, fontSize: 13, lineHeight: 1.4, cursor: "pointer", fontFamily: FONT_BODY, overflowWrap: "anywhere" }}>{m.rows.length > 0 ? m.label + ": " + m.rows.join(", ") : m.label}</button>;
            })}
          </div>
        )}

        {review && sections.map((sk, i) => (
          <div key={sk} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ ...mkLabel(t), marginBottom: 0, flex: "1 1 auto", minWidth: 0 }}>{tr("Section {n}", { n: i + 1 })}</div>
              <button onClick={() => editSection(sk)} style={{ minHeight: 44, padding: "0 16px", borderRadius: R.sm, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD, flexShrink: 0 }}>{tr("Edit")}</button>
            </div>
            {shown.filter(f => formSectionOf(f) === sk).map(f => {
              const signoff = formTypeOf(f) === "signoff";
              const read = signoff ? formStampLine(values[f.key]) : formReadAnswer(f, values[f.key]);
              return (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: t.textSec, lineHeight: 1.45, overflowWrap: "anywhere" }}>{f.label}</div>
                  <div style={{ fontSize: 14, color: read ? t.text : t.textMut, fontWeight: read ? 600 : 400, marginTop: 4, lineHeight: 1.5, overflowWrap: "anywhere" }}>{read || tr(signoff ? "Not signed" : "Not answered")}</div>
                </div>
              );
            })}
          </div>
        ))}

        {!review && pageFields.map(f => (
          <div key={f.key} style={qSt}>
            <div style={labelSt}>{f.label}{f.required && <span style={reqSt}>{tr("Required")}</span>}</div>
            {f.help && <div style={mkHelp(t)}>{f.help}</div>}
            {renderInput(f)}
            {badKeys.indexOf(f.key) !== -1 && <div style={mkFieldErr(t)}>{tr("Check this answer")}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid " + t.borderSolid, flexShrink: 0 }}>
        {(review || at > 0) && <button onClick={goBack} disabled={saving || sending} style={footBtn(false, saving || sending)}>{saving ? tr("Saving") : tr("Back")}</button>}
        {review
          ? <button onClick={() => setConfirmSend(true)} disabled={sending || missing.length > 0} style={footBtn(true, sending || missing.length > 0)}>{sending ? tr("Sending") : tr("Submit report")}</button>
          : <button onClick={goNext} disabled={saving} style={footBtn(true, saving)}>{saving ? tr("Saving") : tr("Next")}</button>}
      </div>

      {confirmSend && (
        <div onClick={() => setConfirmSend(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, background: t.card, border: "1px solid " + t.border, borderRadius: R.lg, padding: 18, boxShadow: t.popShadow }}>
            <div style={{ fontSize: 14, color: t.text, lineHeight: 1.5, marginBottom: 16 }}>{tr(FORMS_SEND_LINE)}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setConfirmSend(false)} style={{ ...footBtn(false, false), flex: "1 1 120px" }}>{tr("Not yet")}</button>
              <button onClick={submit} style={{ ...footBtn(true, false), flex: "1 1 120px" }}>{tr("Send it")}</button>
            </div>
          </div>
        </div>
      )}

      {confirmLeave && (
        <div onClick={() => setConfirmLeave(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, background: t.card, border: "1px solid " + t.border, borderRadius: R.lg, padding: 18, boxShadow: t.popShadow }}>
            <div style={{ fontSize: 14, color: t.text, lineHeight: 1.5, marginBottom: 16 }}>{tr(FORMS_LEAVE_LINE)}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setConfirmLeave(false)} style={{ ...footBtn(false, false), flex: "1 1 120px" }}>{tr("Keep filling")}</button>
              <button onClick={leave} style={{ ...footBtn(true, false), flex: "1 1 120px" }}>{tr("Leave")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, text, t }) {
  return (<div style={{ padding: "48px 24px", textAlign: "center", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, boxShadow: t.shadow }}><Icon sz={40} c={t.borderSolid} /><div style={{ fontSize: 15, color: t.textMut, marginTop: 16, fontFamily: FONT_HEAD }}>{text}</div></div>);
}

function PickupView({ token, user, showToast, t }) {
  const [tab, setTab] = useState("available");
  const [available, setAvailable] = useState([]);
  const [myPickups, setMyPickups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(null);

  const fmtDate = (d) => { const s = String(d).slice(0, 10); return new Date(s + "T00:00:00").toLocaleDateString(dateLocale(), { weekday: "short", month: "short", day: "numeric" }); };
  const fmtTm = (t) => { const [h, m] = String(t).split(":").map(Number); return new Date(2024, 0, 1, h, m || 0).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" }); };
  const originColor = { callout: RED, no_show: RED, extra_coverage: ORANGE, voluntary_drop: BLUE, new_shift: GOLD };

  const loadAvailable = async () => {
    setLoading(true);
    try {
      const data = await api("/api/pickups/available", { token });
      setAvailable(data);
    } catch (err) { showToast(tr(err.message), "error"); }
    setLoading(false);
  };

  const loadMyPickups = async () => {
    setLoading(true);
    try {
      const data = await api("/api/pickups/my-pickups", { token });
      setMyPickups(data);
    } catch (err) { showToast(tr(err.message), "error"); }
    setLoading(false);
  };

  useEffect(() => { loadAvailable(); loadMyPickups(); }, []);
  useEffect(() => { if (tab === "available") loadAvailable(); else loadMyPickups(); }, [tab]);

  const claimShift = async (id) => {
    setClaiming(id);
    try {
      const result = await api("/api/pickups/" + id + "/claim", { method: "POST", token });
      if (result.ot_warning) {
        showToast(tr("Shift claimed (overtime warning: {hours}h this week)", { hours: Math.round(result.weekly_minutes / 60) }), "notice");
      } else {
        showToast(tr("Shift claimed successfully!"));
      }
      loadAvailable();
      loadMyPickups();
    } catch (err) { showToast(tr(err.message), "error"); }
    setClaiming(null);
  };

  const releaseShift = async (id) => {
    if (!window.confirm(tr("Release this shift? It will go back to the open pool for someone else to claim."))) return;
    try {
      await api("/api/pickups/" + id + "/release", { method: "POST", token });
      showToast(tr("Shift released"));
      loadAvailable();
      loadMyPickups();
    } catch (err) { showToast(tr(err.message), "error"); }
  };

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 12, fontFamily: FONT_HEAD }}>{tr("Shift Pickup Board")}</div>

      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {[{ id: "available", l: tr("Available"), count: available.length }, { id: "mine", l: tr("My Pickups"), count: myPickups.length }].map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{
            flex: 1, minHeight: TAP, padding: "10px 0", borderRadius: R.sm,
            border: tab === tb.id ? "1px solid " + t.goldBorder : "1px solid transparent",
            background: tab === tb.id ? t.goldBg : "transparent",
            color: tab === tb.id ? t.goldText : t.textMut,
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD, textTransform: "uppercase", letterSpacing: "0.5px"
          }}>
            {tb.l} {tb.count > 0 && <span style={{ marginLeft: 4, fontSize: 10, padding: "1px 6px", borderRadius: R.pill, background: GOLD + "26", color: t.goldText, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{tb.count}</span>}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 40, color: t.textMut, fontFamily: FONT_HEAD }}>{tr("Loading...")}</div>}

      {/* AVAILABLE SHIFTS */}
      {!loading && tab === "available" && (
        <div>
          {available.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 24px", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, boxShadow: t.shadow }}>
              <SwapIco sz={32} c={t.textMut} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: t.textSec, fontFamily: FONT_HEAD }}>{tr("No open shifts right now")}</div>
              <div style={{ fontSize: 11, color: t.textMut, marginTop: 4 }}>{tr("Check back later for available pickup shifts at your assigned sites.")}</div>
            </div>
          )}
          {available.map(s => (
            <div key={s.id} style={{ background: t.card, borderRadius: R.md, padding: 14, marginBottom: 10, border: "1px solid " + (s.urgency === "urgent" ? RED + "40" : t.border), boxShadow: t.shadow }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{s.site_name}</span>
                    {s.urgency === "urgent" && <span style={{ fontSize: 8, fontWeight: 600, padding: "2px 6px", borderRadius: R.sm, background: RED + "18", color: RED, fontFamily: FONT_HEAD }}>{tr("URGENT")}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: t.textSec, fontVariantNumeric: "tabular-nums" }}>{fmtDate(s.scheduled_date)}</div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: R.sm, background: (originColor[s.origin] || GOLD) + "18", color: originColor[s.origin] || t.goldText, fontFamily: FONT_HEAD }}>{ORIGIN_WORDS[s.origin] ? ORIGIN_WORDS[s.origin]() : s.origin}</span>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, padding: "8px 10px", borderRadius: R.md, background: t.cardAlt }}>
                <ClockIco sz={14} c={t.goldText} />
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{tr("{start} to {end}", { start: fmtTm(s.start_time), end: fmtTm(s.end_time) })}</span>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {s.building_name && <span style={{ fontSize: 10, color: t.textMut, padding: "2px 6px", borderRadius: R.sm, background: t.cardAlt, fontFamily: FONT_HEAD }}>{tr("Bldg:")} {s.building_name}</span>}
                {s.floor_number && <span style={{ fontSize: 10, color: t.textMut, padding: "2px 6px", borderRadius: R.sm, background: t.cardAlt, fontFamily: FONT_HEAD }}>{tr("Floor:")} {s.floor_number}</span>}
                {s.service_category && <span style={{ fontSize: 10, color: t.textMut, padding: "2px 6px", borderRadius: R.sm, background: t.cardAlt, fontFamily: FONT_HEAD }}>{s.service_category}</span>}
              </div>

              {s.notes && <div style={{ fontSize: 11, color: t.textSec, marginBottom: 10, fontStyle: "italic" }}>{s.notes}</div>}

              <button
                onClick={() => claimShift(s.id)}
                disabled={claiming === s.id}
                style={{
                  width: "100%", minHeight: TAP, padding: "12px", borderRadius: R.md, border: "none",
                  background: claiming === s.id ? t.cardAlt : "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")",
                  color: claiming === s.id ? t.textMut : NAVY,
                  fontSize: 14, fontWeight: 600, cursor: claiming === s.id ? "default" : "pointer",
                  fontFamily: FONT_HEAD, textTransform: "uppercase", letterSpacing: "1px",
                  boxShadow: claiming === s.id ? "none" : "0 6px 18px rgba(231,176,23,0.30)"
                }}
              >
                {claiming === s.id ? tr("Claiming...") : tr("Claim This Shift")}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MY PICKUPS */}
      {!loading && tab === "mine" && (
        <div>
          {myPickups.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 24px", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, boxShadow: t.shadow }}>
              <CheckIco sz={32} c={t.textMut} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: t.textSec, fontFamily: FONT_HEAD }}>{tr("No claimed shifts")}</div>
              <div style={{ fontSize: 11, color: t.textMut, marginTop: 4 }}>{tr("Shifts you claim will appear here.")}</div>
            </div>
          )}
          {myPickups.map(s => {
            const sColor = s.status === "approved" ? GREEN : s.status === "filled" ? GREEN : BLUE;
            return (
              <div key={s.id} style={{ background: t.card, borderRadius: R.md, padding: 14, marginBottom: 10, border: "1px solid " + sColor + "30", boxShadow: t.shadow }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{s.site_name}</div>
                    <div style={{ fontSize: 12, color: t.textSec, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{fmtDate(s.scheduled_date)}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: R.sm, background: sColor + "18", color: sColor, textTransform: "uppercase", fontFamily: FONT_HEAD }}>{statusWord(s.status)}</span>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, padding: "8px 10px", borderRadius: R.md, background: t.cardAlt }}>
                  <ClockIco sz={14} c={sColor} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{tr("{start} to {end}", { start: fmtTm(s.start_time), end: fmtTm(s.end_time) })}</span>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  {s.building_name && <span style={{ fontSize: 10, color: t.textMut, padding: "2px 6px", borderRadius: R.sm, background: t.cardAlt, fontFamily: FONT_HEAD }}>{tr("Bldg:")} {s.building_name}</span>}
                  {s.floor_number && <span style={{ fontSize: 10, color: t.textMut, padding: "2px 6px", borderRadius: R.sm, background: t.cardAlt, fontFamily: FONT_HEAD }}>{tr("Floor:")} {s.floor_number}</span>}
                </div>

                {s.status === "claimed" && (
                  <div>
                    <div style={{ padding: "6px 10px", borderRadius: R.sm, background: t.orangeSubtle, border: "1px solid " + t.orangeBorder, fontSize: 10, color: ORANGE, marginBottom: 8, fontFamily: FONT_HEAD }}>{tr("Waiting for manager approval")}</div>
                    <button onClick={() => releaseShift(s.id)} style={{ width: "100%", padding: "10px", borderRadius: R.sm, border: "1px solid " + RED, background: "transparent", color: RED, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Release Shift")}</button>
                  </div>
                )}
                {s.status === "approved" && (
                  <div style={{ padding: "8px 12px", borderRadius: R.md, background: t.greenSubtle, border: "1px solid " + t.greenBorder }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: GREEN, fontFamily: FONT_HEAD }}>{tr("Approved. You are scheduled for this shift.")}</div>
                    <div style={{ fontSize: 10, color: t.textMut, marginTop: 2 }}>{tr("Start your shift at the normal time and your daily tasks will load automatically.")}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InspectView({ token, user, showToast, t }) {
  const CIMS_C = { SD: "#24A4F4", HSE: "#F39C12", GB: "#2ECC71", QS: GOLD, HR: "#9B59B6", MC: "#2C3E50" };
  const STATUS_C = { scheduled: "#24A4F4", in_progress: "#F39C12", completed: "#2ECC71" };
  const fmtDate = (d) => d ? new Date(d.slice(0, 10) + "T00:00:00").toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" }) : "--";

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(null);
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState({});
  const [overallNotes, setOverallNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploaded, setUploaded] = useState({});
  const [uploadingId, setUploadingId] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [sites, setSites] = useState([]);
  const [schedForm, setSchedForm] = useState({ template_id: "", site_id: "", scheduled_date: "" });
  const [scheduling, setScheduling] = useState(false);
  useBusy("inspection in progress", !!active || uploadingId !== null || submitting || scheduling);

  const loadList = async () => {
    setLoading(true);
    try {
      const d = await api("/api/inspections/scheduled?status=scheduled", { token });
      setList(d);
    } catch (e) { showToast(tr(e.message), "error"); }
    setLoading(false);
  };

  useEffect(() => { loadList(); }, []);

  const openScheduleModal = async () => {
    try {
      const [tmpl, st] = await Promise.all([
        api("/api/inspections/templates", { token }),
        api("/api/sites", { token }),
      ]);
      setTemplates(tmpl);
      setSites(st);
      setSchedForm({ template_id: "", site_id: "", scheduled_date: "" });
      setScheduleModal(true);
    } catch (e) { showToast(tr(e.message), "error"); }
  };

  const submitSchedule = async () => {
    if (!schedForm.template_id || !schedForm.site_id || !schedForm.scheduled_date) {
      showToast(tr("Template, site, and date are required"), "error"); return;
    }
    setScheduling(true);
    try {
      await api("/api/inspections/scheduled", { method: "POST", token, body: { ...schedForm, assigned_to: user.id } });
      showToast(tr("Inspection scheduled")); setScheduleModal(false); loadList();
    } catch (e) { showToast(tr(e.message), "error"); }
    setScheduling(false);
  };

  const openInspection = async (id) => {
    try {
      const d = await api("/api/inspections/scheduled/" + id, { token });
      setActive(d);
      const initScores = {};
      const initNotes = {};
      (d.items || []).forEach(item => {
        initScores[item.id] = 0;
        initNotes[item.id] = "";
      });
      setScores(initScores);
      setNotes(initNotes);
      setOverallNotes("");
      setUploaded({});
    } catch (e) { showToast(tr(e.message), "error"); }
  };

  const handlePhotoUpload = async (itemId, file) => {
    setUploadingId(itemId);
    try {
      const result = await uploadTaskMedia(file, token);
      setUploaded(prev => ({ ...prev, [itemId]: result.url }));
      showToast(tr("Photo attached"));
    } catch (e) { showToast(tr(e.message), "error"); }
    setUploadingId(null);
  };

  const submit = async () => {
    if (!active) return;
    setSubmitting(true);
    try {
      const payload = (active.items || []).map(item => ({
        template_item_id: item.id,
        score: parseInt(scores[item.id]) || 0,
        notes: notes[item.id] || null,
        photo_url: uploaded[item.id] || null,
      }));
      await api("/api/inspections/scheduled/" + active.id + "/complete", {
        method: "POST", token,
        body: { scores: payload, overall_notes: overallNotes || null },
      });
      showToast(tr("Inspection submitted"));
      setActive(null);
      loadList();
    } catch (e) { showToast(tr(e.message), "error"); }
    setSubmitting(false);
  };

  const labelSt = mkLabel(t);
  const inputSt = mkInput(t);
  const isManager = user?.role === "admin" || user?.role === "supervisor" || user?.role === "custodial_lead";

  // SCORING VIEW
  if (active) {
    const totalMax = (active.items || []).reduce((sum, i) => sum + i.max_score, 0);
    const totalScored = (active.items || []).reduce((sum, i) => sum + (parseInt(scores[i.id]) || 0), 0);
    const pct = totalMax > 0 ? Math.round((totalScored / totalMax) * 100) : 0;
    const scoreColor = pct >= 80 ? GREEN : pct >= 60 ? ORANGE : RED;

    return (
      <div style={{ padding: "14px 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={() => setActive(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: t.textSec, fontSize: 20, lineHeight: 1 }}>{"<"}</button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{active.template_name}</div>
            <div style={{ fontSize: 11, color: t.textSec, fontFamily: FONT_BODY }}>{active.site_name} - {fmtDate(active.scheduled_date)}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: R.lg, background: t.card, marginBottom: 16, border: "1px solid " + t.goldBorder, boxShadow: t.popShadow }}>
          <div style={{ fontSize: 11, color: t.textSec, fontFamily: FONT_HEAD, textTransform: "uppercase", letterSpacing: "0.5px" }}>{tr("Running total")}</div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 22, fontWeight: 600, color: scoreColor, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
            <span style={{ fontSize: 11, color: t.textMut, marginLeft: 6, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{totalScored}/{totalMax} {tr("pts")}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {(active.items || []).map(item => {
            const sc = parseInt(scores[item.id]) || 0;
            const iPct = item.max_score > 0 ? Math.round((sc / item.max_score) * 100) : 0;
            const iColor = iPct >= 80 ? GREEN : iPct >= 60 ? ORANGE : RED;
            return (
              <div key={item.id} style={{ background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.md, padding: "14px 14px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: R.sm, background: (CIMS_C[item.cims_category] || BLUE) + "1A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: CIMS_C[item.cims_category] || BLUE, flexShrink: 0, fontFamily: FONT_HEAD }}>{item.cims_category}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, lineHeight: 1.3, fontFamily: FONT_HEAD }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: t.textMut }}>{item.zone}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: iColor, minWidth: 36, textAlign: "right", fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{sc}<span style={{ fontSize: 10, color: t.textMut, fontWeight: 400 }}>/{item.max_score}</span></div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <input type="range" min={0} max={item.max_score} value={sc} onChange={e => setScores(prev => ({ ...prev, [item.id]: parseInt(e.target.value) }))} style={{ width: "100%", accentColor: iColor }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: t.textMut, marginTop: 2 }}><span>0</span><span>{item.max_score}</span></div>
                </div>
                <input value={notes[item.id] || ""} onChange={e => setNotes(prev => ({ ...prev, [item.id]: e.target.value }))} placeholder={tr("Notes for this item (optional)")} style={{ ...inputSt, fontSize: 12, marginBottom: 8 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: R.sm, border: "1px solid " + t.borderSolid, background: "transparent", cursor: "pointer", fontSize: 11, color: t.textSec }}>
                    <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => e.target.files[0] && handlePhotoUpload(item.id, e.target.files[0])} />
                    {uploadingId === item.id ? tr("Uploading...") : tr("Attach Photo")}
                  </label>
                  {uploaded[item.id] && <span style={{ fontSize: 10, color: GREEN, fontWeight: 600 }}>{tr("Photo attached")}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>{tr("Overall Notes")}</label>
          <textarea value={overallNotes} onChange={e => setOverallNotes(e.target.value)} placeholder={tr("General observations, follow-ups needed, etc.")} rows={3} style={{ ...inputSt, resize: "vertical" }} />
        </div>

        <button onClick={submit} disabled={submitting} style={{ width: "100%", padding: "14px", borderRadius: R.md, border: "none", background: "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")", color: NAVY, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: submitting ? 0.6 : 1, textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: FONT_HEAD, boxShadow: "0 6px 18px rgba(231,176,23,0.30)" }}>
          {submitting ? tr("Submitting...") : tr("Submit Inspection")}
        </button>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 2, fontFamily: FONT_HEAD }}>{tr("My Inspections")}</div>
          <div style={{ fontSize: 11, color: t.textSec }}>{tr("Tap an inspection to begin scoring.")}</div>
        </div>
        {isManager && (
          <button onClick={openScheduleModal} style={{ padding: "8px 14px", borderRadius: R.sm, border: "none", background: GOLD, color: NAVY, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, fontFamily: FONT_HEAD }}>
            {tr("+ Schedule")}
          </button>
        )}
      </div>

      {loading && <div style={{ padding: "30px 0", textAlign: "center", fontSize: 12, color: t.textMut }}>{tr("Loading...")}</div>}

      {!loading && list.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 24px", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, boxShadow: t.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.textSec, fontFamily: FONT_HEAD }}>{tr("No inspections pending")}</div>
          <div style={{ fontSize: 11, color: t.textMut, marginTop: 4 }}>{tr("Inspections assigned to you will appear here.")}</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {list.map(si => (
          <button key={si.id} onClick={() => openInspection(si.id)} style={{ width: "100%", display: "block", padding: "14px", borderRadius: R.md, border: "1.5px solid " + t.borderSolid, background: t.card, cursor: "pointer", textAlign: "left", boxShadow: t.shadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text, flex: 1, marginRight: 8, fontFamily: FONT_HEAD }}>{si.template_name}</div>
              <span style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: R.sm, background: (STATUS_C[si.status] || BLUE) + "18", color: STATUS_C[si.status] || BLUE, textTransform: "uppercase", flexShrink: 0, fontFamily: FONT_HEAD, letterSpacing: "0.5px" }}>{statusWord(si.status)}</span>
            </div>
            <div style={{ fontSize: 12, color: t.textSec }}>{si.site_name}</div>
            <div style={{ fontSize: 11, color: t.textMut, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{tr("Scheduled")} {fmtDate(si.scheduled_date)}</div>
            <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: R.sm, background: t.cardAlt, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: t.textSec }}>{tr("Tap to start scoring")}</span>
              <span style={{ fontSize: 16, color: t.goldText }}>{">"}</span>
            </div>
          </button>
        ))}
      </div>

      {scheduleModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.modalOverlay, zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setScheduleModal(false)}>
          <div style={{ background: t.card, borderRadius: "16px 16px 0 0", border: "1px solid " + t.borderSolid, width: "100%", maxWidth: 960, padding: "24px 20px 40px", maxHeight: "85vh", overflowY: "auto", boxShadow: t.popShadow }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{tr("Schedule Inspection")}</div>
              <button onClick={() => setScheduleModal(false)} aria-label={tr("Close")} style={mkTapFrame({ fontSize: 20, color: t.textMut, lineHeight: 1 })}>{tr("x")}</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>{tr("Template *")}</label>
              <select value={schedForm.template_id} onChange={e => setSchedForm({ ...schedForm, template_id: e.target.value })} style={{ ...inputSt }}>
                <option value="">{tr("Select template...")}</option>
                {templates.map(tp => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>{tr("Site *")}</label>
              <select value={schedForm.site_id} onChange={e => setSchedForm({ ...schedForm, site_id: e.target.value })} style={{ ...inputSt }}>
                <option value="">{tr("Select site...")}</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelSt}>{tr("Scheduled Date *")}</label>
              <input type="date" value={schedForm.scheduled_date} onChange={e => setSchedForm({ ...schedForm, scheduled_date: e.target.value })} style={inputSt} />
            </div>
            <button onClick={submitSchedule} disabled={scheduling} style={{ width: "100%", padding: "14px", borderRadius: R.md, border: "none", background: "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")", color: NAVY, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: scheduling ? 0.6 : 1, textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: FONT_HEAD, boxShadow: "0 6px 18px rgba(231,176,23,0.30)" }}>
              {scheduling ? tr("Scheduling...") : tr("Schedule Inspection")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MyProfileView({ token, user, showToast, t, setUser, setActiveTab }) {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  useBusy("profile edit", editing || uploading || saving);
  const loadProfile = async () => {
    try {
      const d = await api("/api/users/profile/me", { token });
      setProfile(d);
    } catch (e) { showToast(tr(e.message), "error"); }
  };
  useEffect(() => { loadProfile(); }, []);

  const fmtDate = d => { if (!d) return tr("Not set"); const dt = typeof d === "string" ? d.split("T")[0] : new Date(d).toISOString().split("T")[0]; const day = localDay(dt); return day ? day.toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" }) : dt; };

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { showToast(tr("Photo must be under 20MB"), "error"); return; }
    setUploading(true);
    try {
      // Compress to 512x512 max, JPEG quality 80%
      const compressed = await compressImage(file, 800, 0.85);
      const res = await reach(API + "/api/uploads?bucket=profile-photos&ext=jpg", {
        method: "POST", headers: { "Authorization": "Bearer " + token, "Content-Type": "image/jpeg" }, body: compressed
      });
      if (res.status === 401) { window.dispatchEvent(new Event("ocsa-session-expired")); throw new Error("Session expired"); }
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || UPLOAD_FAILED); }
      const r = await readJson(res);
      await api("/api/users/profile/photo", { method: "POST", body: { photoUrl: r.url }, token });
      showToast(tr("Photo updated"));
      setUser(prev => ({ ...prev, profilePhotoUrl: r.url }));
      loadProfile();
    } catch (e) { showToast(tr(e.message), "error"); }
    setUploading(false);
  };

  const startEditing = () => {
    if (!profile) return;
    const u = profile.user;
    setForm({
      birthday: u.birthday ? (typeof u.birthday === "string" ? u.birthday.split("T")[0] : "") : "",
      addressLine1: u.addressLine1 || "", addressLine2: u.addressLine2 || "",
      city: u.city || "", state: u.state || "", zipCode: u.zipCode || "",
      emergencyContactName: u.emergencyContactName || "", emergencyContactPhone: u.emergencyContactPhone || "",
      personalNotes: u.personalNotes || ""
    });
    setEditing(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api("/api/users/profile/me", { method: "PATCH", body: form, token });
      showToast(tr("Profile updated"));
      setEditing(false);
      loadProfile();
    } catch (e) { showToast(tr(e.message), "error"); }
    setSaving(false);
  };

  if (!profile) return <div style={{ padding: 20, textAlign: "center", color: t.textMut }}>{tr("Loading profile...")}</div>;

  const u = profile.user;
  const cardSt = { background: t.card, border: "1px solid " + t.border, borderRadius: R.md, padding: 16, marginBottom: 12 };
  const labelSt = mkLabel(t);
  const inputSt = mkInput(t);
  const valSt = { color: t.text, fontWeight: 500, marginTop: 2, fontSize: 13 };

  return (
    <div style={{ padding: "16px" }}>
      <button onClick={() => setActiveTab("clock")} style={{ display: "flex", alignItems: "center", gap: 6, minHeight: TAP, padding: "6px 0", background: "none", border: "none", color: t.goldText, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.goldText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg> {tr("Back")}
      </button>

      {/* Photo and Name Header */}
      <div style={{ ...cardSt, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative" }}>
          {u.profilePhotoUrl
            ? <img src={u.profilePhotoUrl} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid " + GOLD }} />
            : <div style={{ width: 72, height: 72, borderRadius: "50%", background: t.goldSubtle, border: "2px solid " + GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 600, color: t.goldText, fontFamily: FONT_HEAD }}>{u.firstName?.[0]}{u.lastName?.[0]}</div>
          }
          <label style={{ position: "absolute", bottom: -2, right: -2, width: 26, height: 26, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "2px solid " + t.card }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }} />
          </label>
          {uploading && <div style={{ position: "absolute", top: 0, left: 0, width: 72, height: 72, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#F8F7F4" }}>...</div>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{u.firstName} {u.lastName}</div>
          <div style={{ fontSize: 12, color: t.goldText, marginTop: 2 }}>{u.role ? roleWord(u.role) : ""}</div>
          <div style={{ fontSize: 10, color: t.textMut, marginTop: 4, overflowWrap: "anywhere" }}>{u.phone} | {u.email}</div>
          {u.employeeId
            ? <div style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", maxWidth: "100%", boxSizing: "border-box", gap: 6, marginTop: 8, padding: "3px 10px", borderRadius: R.sm, background: t.goldSubtle, border: "1px solid " + GOLD }}>
                <span style={{ fontSize: 8, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, fontFamily: FONT_HEAD }}>{tr("Employee ID")}</span>
                <span style={{ fontSize: 12, color: t.text, fontWeight: 600, letterSpacing: "0.5px", fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{u.employeeId}</span>
              </div>
            : <div style={{ marginTop: 8, fontSize: 10, color: t.textMut, fontStyle: "italic" }}>{tr("Employee ID not assigned. Ask your supervisor.")}</div>
          }
          {u.badgeNumber && <div style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", maxWidth: "100%", boxSizing: "border-box", gap: 6, marginTop: 6, padding: "3px 10px", borderRadius: R.sm, background: t.goldSubtle, border: "1px solid " + GOLD }}>
            <span style={{ fontSize: 8, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, fontFamily: FONT_HEAD }}>{tr("Badge Number")}</span>
            <span style={{ fontSize: 12, color: t.text, fontWeight: 600, letterSpacing: "0.5px", fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{u.badgeNumber}</span>
          </div>}
        </div>
      </div>

      {/* Personal Info */}
      <div style={cardSt}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={labelSt}>{tr("Personal Information")}</div>
          {!editing && <button onClick={startEditing} style={mkTapFrame()}><span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: R.sm, border: "1px solid " + GOLD, color: t.goldText, fontSize: 10, fontWeight: 600, fontFamily: FONT_HEAD }}>{tr("Edit")}</span></button>}
        </div>
        {!editing ? <div>
          <div style={{ fontSize: 11, color: t.textMut }}>{tr("Birthday")}<div style={valSt}>{u.birthday ? fmtDate(u.birthday) : tr("Not set")}</div></div>
          <div style={{ marginTop: 12, fontSize: 11, color: t.textMut }}>{tr("Address")}<div style={valSt}>{u.addressLine1 ? (u.addressLine1 + (u.addressLine2 ? ", " + u.addressLine2 : "") + (u.city ? ", " + u.city : "") + (u.state ? ", " + u.state : "") + (u.zipCode ? " " + u.zipCode : "")) : tr("Not set")}</div></div>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ fontSize: 11, color: t.textMut }}>{tr("Emergency Contact")}<div style={valSt}>{u.emergencyContactName || tr("Not set")}</div></div>
            <div style={{ fontSize: 11, color: t.textMut }}>{tr("Emergency Phone")}<div style={valSt}>{u.emergencyContactPhone || tr("Not set")}</div></div>
          </div>
        </div> : <div>
          <div style={{ marginBottom: 10 }}><label style={labelSt}>{tr("Birthday")}</label><input type="date" value={form.birthday || ""} onChange={e => setForm({ ...form, birthday: e.target.value })} style={inputSt} /></div>
          <div style={{ marginBottom: 10 }}><label style={labelSt}>{tr("Address Line 1")}</label><input value={form.addressLine1 || ""} onChange={e => setForm({ ...form, addressLine1: e.target.value })} style={inputSt} placeholder={tr("Street address")} /></div>
          <div style={{ marginBottom: 10 }}><label style={labelSt}>{tr("Address Line 2")}</label><input value={form.addressLine2 || ""} onChange={e => setForm({ ...form, addressLine2: e.target.value })} style={inputSt} placeholder={tr("Apt, suite, etc.")} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div><label style={labelSt}>{tr("City")}</label><input value={form.city || ""} onChange={e => setForm({ ...form, city: e.target.value })} style={inputSt} /></div>
            <div><label style={labelSt}>{tr("State")}</label><input value={form.state || ""} onChange={e => setForm({ ...form, state: e.target.value })} style={inputSt} /></div>
            <div><label style={labelSt}>{tr("Zip")}</label><input value={form.zipCode || ""} onChange={e => setForm({ ...form, zipCode: e.target.value })} style={inputSt} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div><label style={labelSt}>{tr("Emergency Contact")}</label><input value={form.emergencyContactName || ""} onChange={e => setForm({ ...form, emergencyContactName: e.target.value })} style={inputSt} placeholder={tr("Full name")} /></div>
            <div><label style={labelSt}>{tr("Emergency Phone")}</label><input value={form.emergencyContactPhone || ""} onChange={e => setForm({ ...form, emergencyContactPhone: e.target.value })} style={inputSt} placeholder={tr("Phone number")} /></div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setEditing(false)} style={{ padding: "10px 18px", borderRadius: R.sm, border: "none", background: t.btnGhost || t.card, color: t.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>{tr("Cancel")}</button>
            <button onClick={saveProfile} disabled={saving} style={{ padding: "10px 18px", borderRadius: R.md, border: "none", background: "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")", color: NAVY, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1, textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: FONT_HEAD, boxShadow: "0 6px 18px rgba(231,176,23,0.30)" }}>{saving ? tr("Saving...") : tr("Save")}</button>
          </div>
        </div>}
      </div>

      {/* Assignments */}
      {profile.assignments?.length > 0 && <div style={cardSt}>
        <div style={{ ...labelSt, marginBottom: 10 }}>{tr("Site Assignments")}</div>
        {profile.assignments.map((a, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: t.hover, borderRadius: R.sm, marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{a.site_name}</div>
            <div style={{ fontSize: 10, color: t.textMut, marginTop: 2 }}>{a.role_at_site || tr("Staff")} | {a.shift_name || tr("No shift")}{a.shift_start ? " | " + clockTime(a.shift_start) + " - " + clockTime(a.shift_end) : ""}</div>
          </div>
        </div>)}
      </div>}
    </div>
  );
}
