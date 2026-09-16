import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import clientConfig from './clientConfig';

const API = process.env.REACT_APP_API_URL || "https://ocsa-api-production.up.railway.app";

async function uploadPhoto(file, token) {
  const ext = file.name.split(".").pop().toLowerCase();
  const res = await fetch(API + "/api/uploads?bucket=issue-photos&ext=" + encodeURIComponent(ext), {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": file.type },
    body: file,
  });
  if (res.status === 401) { window.dispatchEvent(new Event("ocsa-session-expired")); throw new Error("Session expired"); }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Photo upload failed"); }
  const data = await res.json();
  return data.url;
}

async function uploadTaskMedia(file, token) {
  const ext = file.name.split(".").pop().toLowerCase();
  const res = await fetch(API + "/api/uploads?bucket=task-media&ext=" + encodeURIComponent(ext), {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": file.type },
    body: file,
  });
  if (res.status === 401) { window.dispatchEvent(new Event("ocsa-session-expired")); throw new Error("Session expired"); }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Upload failed"); }
  return res.json();
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
  const res = await fetch(API + "/api/uploads?bucket=agent-photos&ext=jpg", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/octet-stream" },
    body: blob,
  });
  if (res.status === 401) { window.dispatchEvent(new Event("ocsa-session-expired")); throw new Error("Session expired"); }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Photo upload failed"); }
  const data = await res.json().catch(() => null);
  if (!data || !data.path) throw new Error("Photo upload failed");
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

const FONT_HEAD = "'Montserrat',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const FONT_BODY = "'Inter',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
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
};

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (opts.token) headers["Authorization"] = "Bearer " + opts.token;
  const res = await fetch(API + path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (res.status === 401 && !opts.noAuthEvent) { window.dispatchEvent(new Event("ocsa-session-expired")); throw new Error("Session expired"); }
  if (!res.ok) { const err = await res.json().catch(() => ({ error: "Request failed" })); const e = new Error(err.error || "Request failed"); e.status = res.status; e.code = err.code || null; e.body = err; throw e; }
  return res.json();
}

const formatTime = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const formatDayShort = (d) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
// Same calendar day on the person's own clock, never UTC. A shift that
// started at 11 PM last night has to say so at 1 AM.
const sameLocalDay = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };
const now = () => new Date();

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
const PersonIco = (p) => <Ico d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" {...p} />;
const BellIco = (p) => <Ico d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" {...p} />;
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

const mkLabel = (t) => ({ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 700, marginBottom: 6, display: "block", fontFamily: FONT_HEAD });
const mkInput = (t) => ({ width: "100%", padding: "11px 14px", borderRadius: R.md, border: "1px solid " + t.inputBorder, background: t.inputBg, color: t.text, fontSize: 14, outline: "none", fontFamily: FONT_BODY });
const mkQtyBtn = (t) => ({ width: 36, height: 36, borderRadius: "50%", border: "1px solid " + t.borderSolid, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.text });

const SUPPORT_LINE = "Contact your supervisor to have a new link sent.";
const PIN_RE = /^[0-9]{4}$/;
const PIN_INPUT_PROPS = { type: "password", inputMode: "numeric", pattern: "[0-9]*", maxLength: 4, autoComplete: "off" };
const mkPinInput = (t) => ({ ...mkInput(t), letterSpacing: "8px", textAlign: "center", fontSize: 20 });
const mkFieldErr = (t) => ({ fontSize: 11, color: RED, marginTop: 6, lineHeight: 1.4 });
const mkHelp = (t) => ({ fontSize: 11, color: t.textMut, marginTop: 6, lineHeight: 1.4 });
const mkPrimaryBtn = (t, busy) => ({ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, " + GOLD + ", " + GOLD_LIGHT + ")", color: NAVY, fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1, boxShadow: "0 6px 18px rgba(231,176,23,0.30)", fontFamily: FONT_HEAD });
const mkGhostBtn = (t) => ({ width: "100%", padding: "12px", marginTop: 12, borderRadius: 10, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec, fontSize: 13, cursor: "pointer" });
const mkCardText = (t) => ({ fontSize: 14, color: t.text, lineHeight: 1.55, marginBottom: 14 });

// Weak PIN rules, client side. The API checks shape only. Returns a
// message naming what is wrong, or null when the PIN is acceptable.
function weakPinReason(pin, badgeNumber) {
  if (!PIN_RE.test(pin)) return "PIN must be exactly 4 digits.";
  if (/^([0-9])\1{3}$/.test(pin)) return "Four of the same digit is too easy to guess. Use a mix of digits.";
  var d = pin.split("").map(Number);
  var up = true, down = true;
  for (var i = 1; i < 4; i++) {
    if ((d[i] - d[i - 1] + 10) % 10 !== 1) up = false;
    if ((d[i - 1] - d[i] + 10) % 10 !== 1) down = false;
  }
  if (up || down) return "Digits in a row, like 1234 or 4321, are too easy to guess. Use a different order.";
  var badge = badgeNumber ? String(badgeNumber).trim() : "";
  if (badge && (pin === badge || pin === badge.slice(-4))) return "Your PIN cannot be your badge number or its last four digits.";
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

// The language the Help agent answers in. The portal's own screens are
// English, which the Settings card says plainly.
const LANGUAGE_KEY = "ocsa-staff-language";
const LANGUAGES = [{ id: "en", label: "English" }, { id: "es", label: "Espa\u00f1ol" }];
function readLanguage() {
  try { var v = window.localStorage.getItem(LANGUAGE_KEY); return (v === "en" || v === "es") ? v : "en"; } catch (e) { return "en"; }
}
function storedLanguage() {
  try { var v = window.localStorage.getItem(LANGUAGE_KEY); return (v === "en" || v === "es") ? v : null; } catch (e) { return null; }
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
// zoom scales lengths, so a height written against the viewport has to be
// divided by it or the screen grows past the bottom of the phone. These
// two are set on the scaled root and read by the screens that fill the
// window. At Standard they are exactly 100vh and 100dvh.
function viewportVars(z) {
  return { "--ocsa-vh": "calc(100vh / " + z + ")", "--ocsa-dvh": "calc(100dvh / " + z + ")" };
}

// The setting reaches the sign-in screens and Profile through context, so
// no screen has to thread it down.
const TextSizeCtx = createContext({ textSize: "standard", setTextSize: () => {} });

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
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: picked ? 700 : 500, fontFamily: FONT_HEAD }}>{s.label}</span>
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
      <button type="button" onClick={() => setOpen(true)} style={{ background: "none", border: "1px solid " + t.border, borderRadius: 8, padding: "6px 14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, color: t.textMut, fontSize: 11 }}>
        <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>A</span>Text size
      </button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.modalOverlay, zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: "16px 16px 0 0", border: "1px solid " + t.borderSolid, width: "100%", maxWidth: 560, padding: "18px 18px 26px", boxShadow: t.popShadow, textAlign: "left" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: t.textMut, margin: "0 auto 14px", opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4, fontFamily: FONT_HEAD }}>Text size</div>
            <div style={{ fontSize: 12, color: t.textSec, marginBottom: 14, lineHeight: 1.4 }}>Makes everything in the app bigger on this phone.</div>
            <TextSizeChoices value={value} onChange={onChange} t={t} />
            <button type="button" onClick={() => setOpen(false)} style={{ width: "100%", minHeight: 44, marginTop: 14, borderRadius: R.md, border: "1px solid " + t.borderSolid, background: "transparent", color: t.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>Done</button>
          </div>
        </div>
      )}
    </>
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
  const [themeMode, setThemeMode] = useState(() => { try { return localStorage.getItem(THEME_KEY) || "dark"; } catch { return "dark"; } });
  const t = themeMode === "light" ? LIGHT : DARK;
  const setTheme = (next) => { setThemeMode(next); saveTheme(next); queuePref({ theme: next }); };
  // The sign in screen keeps its own toggle, which now goes through the same
  // path, so a choice made before signing in is sent up afterwards.
  const toggleTheme = () => setTheme(themeMode === "dark" ? "light" : "dark");
  const [language, setLanguageState] = useState(readLanguage);
  const setLanguage = (v) => { setLanguageState(v); saveLanguage(v); queuePref({ language: v }); };
  const [textSize, setTextSizeState] = useState(readTextSize);
  const setTextSize = (id) => { setTextSizeState(id); saveTextSize(id); queuePref({ textSize: id }); };
  const zoom = zoomOf(textSize);

  useEffect(() => { const i = setInterval(() => setCurrentTime(now()), 1000); return () => clearInterval(i); }, []);
  useEffect(() => { const h = () => { clearAuth(); setToken(null); setUser(null); setSites([]); setScreen("login"); setClockStatus(null); setSelectedSite(null); setSessionSites(null); setPendingSite(null); setStartBlock(null); setTasks(null); setCompletedTaskIds(new Set()); setActiveTab("clock"); setUnread(0); }; window.addEventListener("ocsa-session-expired", h); return () => window.removeEventListener("ocsa-session-expired", h); }, []);
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
  const getOpts = useCallback((slug, placeholder) => { const cat = lookups.find(c => c.slug === slug); if (!cat) return placeholder ? [{ v: "", l: placeholder }] : []; const opts = (cat.values || []).filter(v => v.is_active).sort((a, b) => a.sort_order - b.sort_order).map(v => ({ v: v.value, l: v.label })); return placeholder ? [{ v: "", l: placeholder }, ...opts] : opts; }, [lookups]);
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
      const data = await api("/api/auth/login", { method: "POST", body: { phone, pin }, noAuthEvent: true });
      setToken(data.token); saveAuth(data.token);
      const me = await hydrateSession(data.token);
      showToast("Welcome, " + me.firstName);
    } catch (err) {
      const said = err && err.body && err.body.error ? String(err.body.error) : "";
      showToast(said || "That sign-in did not match. Check your badge, phone or email and your PIN.", "error");
    }
    setLoading(false);
  };

  // A successful activation or reset returns the same twelve-hour JWT a
  // login does. Store it the same way and take the same path in.
  const handleAuthSuccess = async (tok) => {
    leaveEntryPath();
    setToken(tok); saveAuth(tok);
    try { const me = await hydrateSession(tok); showToast("Welcome, " + me.firstName); }
    catch (err) { clearAuth(); setToken(null); setUser(null); setScreen("login"); showToast(err.message, "error"); }
  };

  const handlePinSet = () => { setScreen("main"); showToast("PIN updated"); };
  const goLogin = () => { leaveEntryPath(); setScreen("login"); };

  const handleRegister = async (firstName, lastName, phone, email, pin) => {
    setLoading(true);
    try { await api("/api/auth/register", { method: "POST", body: { firstName, lastName, phone, email, pin } }); showToast("Registration submitted. Pending supervisor approval."); setScreen("login"); } catch (err) { showToast(err.message, "error"); }
    setLoading(false);
  };

  const handleLogout = () => { clearAuth(); setToken(null); setUser(null); setSites([]); setScreen("login"); setClockStatus(null); setSelectedSite(null); setSessionSites(null); setPendingSite(null); setStartBlock(null); setTasks(null); setCompletedTaskIds(new Set()); setActiveTab("clock"); setUnread(0); };

  // Tapping a site chooses it. No request, no tab change, no toast.
  const handleSelectSite = (siteId) => { if (clockStatus?.clockedIn) return; setPendingSite(siteId); setStartBlock(null); };

  const handleStartSession = async (siteId) => {
    if (!siteId) { showToast("Select a site first", "error"); return; }
    setLoading(true); setStartBlock(null);
    try {
      // 201 is a new session. 200 is the same site already open, which
      // the API answers with that session, so it takes the same path and
      // creates nothing twice.
      const data = await api("/api/shift-sessions", { method: "POST", body: { siteId }, token });
      await refreshClockStatus();
      setTasks(null); setPendingSite(null);
      showToast(data.message || "Shift started"); setActiveTab("tasks");
    } catch (err) {
      if (err.code === "OPEN_SESSION_ELSEWHERE") {
        // A shift is still open at another site. Say so and show it. It
        // is never ended from here as a side effect of starting another.
        const at = err.body && err.body.openSession ? err.body.openSession.siteName : null;
        setStartBlock("A shift is still open" + (at ? " at " + at : "") + ". End it before starting another.");
        refreshClockStatus().catch(e => console.warn("Clock status:", e.message));
      } else { showToast(err.message, "error"); }
    }
    setLoading(false);
  };

  const handleEndSession = async () => {
    const shift = clockStatus?.shift;
    // /api/clock/status carries the id as shift.sessionId, with shift.id
    // and session.id holding the same value. Without one, nothing is sent.
    const id = shift?.sessionId || shift?.id || clockStatus?.session?.id;
    if (!id) { showToast("Could not find your open shift. Reload and try again.", "error"); return; }
    if (!window.confirm("End your shift at " + (shift.siteName || "this site") + "?")) return;
    setLoading(true);
    try {
      const data = await api("/api/shift-sessions/" + id + "/end", { method: "POST", token });
      setClockStatus({ clockedIn: false, shift: null, session: null });
      setSelectedSite(null); setPendingSite(null); setStartBlock(null); setTasks(null); setCompletedTaskIds(new Set());
      const endedAt = data && data.session ? data.session.endedAt : null;
      showToast(endedAt ? "Shift ended at " + formatTime(endedAt) : "Shift ended");
    } catch (err) {
      if (err.code === "SESSION_ALREADY_ENDED") {
        // Ended somewhere else already. Read the server's view and redraw.
        setPendingSite(null); setStartBlock(null); setTasks(null);
        try { await refreshClockStatus(); } catch (e) { setClockStatus({ clockedIn: false, shift: null, session: null }); setSelectedSite(null); }
        showToast("This shift was already ended");
      } else { showToast(err.message, "error"); }
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
  const toggleTask = async (taskId) => { if (inFlightTaskIds.current.has(taskId)) return; inFlightTaskIds.current.add(taskId); try { if (completedTaskIds.has(taskId)) { await api("/api/clock/tasks/" + taskId + "/complete", { method: "DELETE", token }); setCompletedTaskIds(prev => { const n = new Set(prev); n.delete(taskId); return n; }); showToast("Task unchecked"); } else { await api("/api/clock/tasks/" + taskId + "/complete", { method: "POST", body: {}, token }); setCompletedTaskIds(prev => new Set(prev).add(taskId)); showToast("Task completed"); } const seq = nextStatusSeq(); const cs = await api("/api/clock/status", { token }); setClockStatus(cs); hydrateCompleted(cs, seq); } catch (err) { showToast(err.message, "error"); } finally { inFlightTaskIds.current.delete(taskId); } };
  const loadIssues = async () => { try { const data = await api("/api/issues?limit=20", { token }); setIssues(data); } catch (err) { console.error(err); } };
  const resolveAssignedTask = async (taskId, status, note, photoUrl) => { try { await api("/api/clock/tasks/resolve/" + taskId, { method: "PATCH", body: { resolutionStatus: status, resolutionNote: note || undefined, photoUrl: photoUrl || undefined }, token }); showToast("Task updated to " + status.replace(/_/g, " ")); loadAssignedTasks(); } catch (err) { showToast(err.message, "error"); } };
  const submitIssue = async (title, description, zone, severity, photoUrl, siteId) => { const actualSiteId = siteId || clockStatus?.shift?.siteId; if (!actualSiteId) { showToast("Select a site first", "error"); return; } try { const data = await api("/api/issues", { method: "POST", body: { siteId: actualSiteId, title, description, zone, severity }, token }); if (photoUrl && data.issue) { await api("/api/issues/" + data.issue.id + "/photos", { method: "POST", body: { photoUrl }, token }); } showToast("Issue reported"); loadIssues(); } catch (err) { showToast(err.message, "error"); } };
  const loadSupplies = async () => { try { const url = clockStatus?.shift?.siteId ? "/api/supplies?site_id=" + clockStatus.shift.siteId : "/api/supplies"; const data = await api(url, { token }); setSupplies(data); } catch (err) { console.error(err); } };
  const logSupplyUsage = async (supplyId, quantity) => { try { const data = await api("/api/supplies/log-usage", { method: "POST", body: { supplyId, quantity, siteId: clockStatus.shift.siteId, scanMethod: "manual" }, token }); showToast(data.message); setSupplyLogs(prev => [{ ...data.log, loggedAt: now().toISOString() }, ...prev]); if (data.lowStockAlert) showToast("Low stock alert!", "notice"); } catch (err) { showToast(err.message, "error"); } };
  const submitSupplyRequest = async (requestType, itemName, description, urgency, supplyId) => { try { const siteId = clockStatus?.shift?.siteId || null; await api("/api/supplies/requests", { method: "POST", body: { requestType, itemName, description, urgency, supplyId, siteId }, token }); showToast("Request submitted"); } catch (err) { showToast(err.message, "error"); } };
  const loadChannels = async () => { try { const data = await api("/api/chat/channels", { token }); setChannels(data); } catch (err) { console.error(err); } };
  const loadMessages = async (channelId) => { try { const data = await api("/api/chat/channels/" + channelId + "/messages", { token }); setMessages(data); } catch (err) { console.error(err); } };
  const sendMessage = async (channelId, text) => { try { const data = await api("/api/chat/channels/" + channelId + "/messages", { method: "POST", body: { text }, token }); setMessages(prev => [...prev, data.message]); } catch (err) { showToast(err.message, "error"); } };

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

    if (Array.isArray(prefs.shortcuts)) {
      const ok = validShortcuts(prefs.shortcuts, allowedShortcutIds) || DEFAULT_SHORTCUTS.slice();
      setShortcutsState({ userId: userId, ids: ok });
      if (userId) saveShortcuts(userId, ok);
      settled.push("shortcuts");
    } else {
      const mine = userId ? storedShortcuts(userId) : null;
      if (mine) changed.shortcuts = mine;
    }

    if (TEXT_SIZES.some(x => x.id === prefs.textSize)) {
      setTextSizeState(prefs.textSize); saveTextSize(prefs.textSize); settled.push("textSize");
    } else {
      const mine = storedTextSize();
      if (mine) changed.textSize = mine;
    }

    if (prefs.theme === "light" || prefs.theme === "dark") {
      setThemeMode(prefs.theme); saveTheme(prefs.theme); settled.push("theme");
    } else {
      const mine = storedTheme();
      if (mine) changed.theme = mine;
    }

    if (prefs.language === "en" || prefs.language === "es") {
      setLanguageState(prefs.language); saveLanguage(prefs.language); settled.push("language");
    } else {
      const mine = storedLanguage();
      if (mine) changed.language = mine;
    }

    // A key the account just supplied is no longer waiting to be sent.
    if (userId && settled.length > 0) savePendingPrefs(userId, readPendingPrefs(userId).filter(k => settled.indexOf(k) === -1));
    sendPrefs(changed, tok, userId);
  };

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // What the platform has told this person, counted. The routes arrive with
  // Step 61 in the API; until then every poll answers 404, which hides the
  // count and warns once. Nothing here ever toasts, so the bell stays quiet.
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadWarned = useRef(false);
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

  const badgeCounts = { assigned: assignedCount };
  const tabOf = (d) => ({ id: d.id, label: d.label(destCtx), icon: d.icon, badge: d.badge ? (badgeCounts[d.badge] || 0) : 0 });
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
    <div style={{ width: "100%", minHeight: "var(--ocsa-vh)", background: t.bg, fontFamily: FONT_BODY, color: t.text, position: "relative", display: "flex", flexDirection: "column", zoom: zoom, ...viewportVars(zoom) }}>

      {booting && <BootSplash t={t} themeMode={themeMode} />}
      {!booting && screen === "login" && <LoginScreen onLogin={handleLogin} onGoRegister={() => setScreen("register")} onGoForgot={() => setScreen("forgot")} loading={loading} showToast={showToast} t={t} toggleTheme={toggleTheme} themeMode={themeMode} />}
      {screen === "register" && <RegisterScreen onRegister={handleRegister} onBack={() => setScreen("login")} loading={loading} t={t} />}
      {screen === "activate" && <ActivateScreen token={ENTRY ? ENTRY.token : null} onActivated={handleAuthSuccess} onGoLogin={goLogin} showToast={showToast} t={t} />}
      {screen === "reset" && <ResetScreen token={ENTRY ? ENTRY.token : null} onReset={handleAuthSuccess} onGoLogin={goLogin} onGoForgot={() => setScreen("forgot")} showToast={showToast} t={t} />}
      {screen === "forgot" && <ForgotScreen onGoLogin={goLogin} showToast={showToast} t={t} />}
      {screen === "setpin" && <SetPinScreen token={token} user={user} onDone={handlePinSet} onSignOut={handleLogout} showToast={showToast} t={t} />}
      {!booting && screen === "main" && (
        <>
          <div style={{ backgroundImage: (themeMode === "light" ? SWEEP_LIGHT : SWEEP) + ", linear-gradient(135deg, " + t.headerBg + " 0%, " + t.headerBg2 + " 100%)", backgroundSize: "100% 2px, 100% 100%", backgroundPosition: "bottom left, top left", backgroundRepeat: "no-repeat, no-repeat", padding: "14px 16px 10px", borderBottom: "1px solid transparent" }}>
            <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 auto" }}>
                <button onClick={() => setActiveTab("profile")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 44, minHeight: 44 }}>
                  {user?.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "2px solid " + GOLD }} /> : <div style={{ width: 38, height: 38, borderRadius: "50%", background: themeMode === "light" ? "rgba(255,255,255,0.92)" : "rgba(231,176,23,0.15)", border: "2px solid " + (themeMode === "light" ? PANEL_LIGHT : GOLD), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: themeMode === "light" ? PANEL_LIGHT : GOLD }}>{user?.firstName?.[0]}{user?.lastName?.[0]}</div>}
                </button>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F8F7F4", fontFamily: FONT_HEAD, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.firstName} {user?.lastName}</div>
                  <div style={{ fontSize: 10, color: themeMode === "light" ? "rgba(255,255,255,0.82)" : GOLD, letterSpacing: "0.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.role?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {clockStatus?.clockedIn && (<div style={{ display: "flex", alignItems: "center", gap: 5, background: themeMode === "light" ? GREEN : "rgba(46,204,113,0.15)", padding: "3px 8px", borderRadius: 20, fontSize: 10, color: themeMode === "light" ? NAVY : GREEN, fontWeight: 600 }}><div style={{ width: 5, height: 5, borderRadius: "50%", background: themeMode === "light" ? NAVY : GREEN, animation: "pulse 2s infinite" }} />ON SITE</div>)}
                <button onClick={() => setNotifOpen(true)} aria-label={unread > 0 ? unread + " unread notifications" : "Notifications"} aria-expanded={notifOpen} style={{ position: "relative", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, minWidth: 44, minHeight: 44, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                  <BellIco sz={18} c={themeMode === "light" ? "rgba(255,255,255,0.82)" : "#A8B8C8"} />
                  {unread > 0 && <span style={{ position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, background: RED, color: "#F8F7F4", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", fontFamily: FONT_HEAD }}>{unread > 9 ? "9+" : unread}</span>}
                </button>
                <button onClick={toggleTheme} title={themeMode === "dark" ? "Light mode" : "Dark mode"} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{themeMode === "dark" ? <SunIco sz={15} c="#A8B8C8" /> : <MoonIco sz={15} c="rgba(255,255,255,0.82)" />}</button>
                <button onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><LogOutIco sz={18} c={themeMode === "light" ? "rgba(255,255,255,0.82)" : "#8899AA"} /></button>
              </div>
            </div>
          </div>

          <div style={{ padding: "0 0 76px 0", flex: 1, display: "flex", flexDirection: "column" }}>
            <div className="sp-content" style={{ maxWidth: 960, margin: "0 auto", width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
              {activeTab === "clock" && <div><ClockView clockStatus={clockStatus} currentTime={currentTime} selectedSite={selectedSite} pendingSite={pendingSite} startBlock={startBlock} onSelectSite={handleSelectSite} onStartSession={handleStartSession} onEndSession={handleEndSession} siteChoices={sessionSites} loading={loading} completedCount={homeDone} taskCount={homeTasks ? homeTasks.length : 0} taskListLoaded={!!homeTasks} t={t} /><MyScheduleSection token={token} t={t} compact showToast={showToast} getOpts={getOpts} lkHasOther={lkHasOther} /></div>}
              {activeTab === "schedule" && <MyScheduleSection token={token} t={t} showToast={showToast} getOpts={getOpts} lkHasOther={lkHasOther} />}
              {activeTab === "tasks" && <TasksView clockStatus={clockStatus} tasks={tasks} tasksFailed={tasksFailed} onRetryTasks={loadTasks} completedTaskIds={completedTaskIds} toggleTask={toggleTask} t={t} />}
              {activeTab === "issuetasks" && <AssignedTasksView assignedTasks={assignedTasks} resolveTask={resolveAssignedTask} showToast={showToast} t={t} token={token} lkColorMap={lkColorMap} />}
              {activeTab === "chat" && <ChatView channels={channels} messages={messages} activeChannel={activeChannel} setActiveChannel={setActiveChannel} sendMessage={sendMessage} user={user} t={t} token={token} />}
              {activeTab === "agent" && <AgentView token={token} showToast={showToast} t={t} />}
              {activeTab === "issues" && <IssuesView clockStatus={clockStatus} issues={issues} submitIssue={submitIssue} showToast={showToast} user={user} sites={sites} t={t} token={token} getOpts={getOpts} lkColorMap={lkColorMap} />}
              {activeTab === "supplies" && <SuppliesView clockStatus={clockStatus} supplies={supplies} supplyLogs={supplyLogs} logSupplyUsage={logSupplyUsage} submitRequest={submitSupplyRequest} showToast={showToast} t={t} getOpts={getOpts} lkColorMap={lkColorMap} />}
              {activeTab === "pickup" && <PickupView token={token} user={user} showToast={showToast} t={t} />}
              {activeTab === "inspect" && <InspectView token={token} user={user} showToast={showToast} t={t} />}
              {activeTab === "speakup" && <SpeakUpView token={token} t={t} />}
              {activeTab === "profile" && <MyProfileView token={token} user={user} showToast={showToast} t={t} setUser={setUser} setActiveTab={setActiveTab} onEditShortcuts={() => setShortcutsOpen(true)} />}
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
                      {tab.badge > 0 && <div style={{ position: "absolute", top: -4, right: -8, minWidth: 16, height: 16, borderRadius: 8, background: RED, color: "#F8F7F4", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{tab.badge}</div>}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? t.goldText : t.textSec }}>{tab.label}</span>
                  </button>
                ); })}
              </div>
              <button onClick={() => { setShowMore(false); setShortcutsOpen(true); }} style={{ width: "100%", minHeight: 44, marginTop: 8, borderRadius: R.md, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>Edit shortcuts</button>
            </div>
          </div>}

          {/* Bottom navigation */}
          <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 960, background: t.navBg, borderTop: "1px solid " + t.navBorder, display: "flex", padding: "8px 0 12px", zIndex: 100, boxShadow: themeMode === "light" ? "0 -2px 10px rgba(0,0,0,0.06)" : "0 -2px 10px rgba(0,0,0,0.2)" }}>
            {primaryTabs.map(tab => {
              const active = activeTab === tab.id;
              const TabIco = tab.icon;
              return (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setShowMore(false); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 0", position: "relative" }}>
                  <TabIco sz={22} c={active ? t.goldText : t.textMut} />
                  <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, color: active ? t.goldText : t.textMut, letterSpacing: "0.3px" }}>{tab.label}</span>
                  {active && <div style={{ position: "absolute", top: -1, width: 24, height: 2.5, background: SWEEP_BAR, borderRadius: 2 }} />}
                </button>
              );
            })}
            <button onClick={() => setShowMore(!showMore)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 0", position: "relative" }}>
              <div style={{ position: "relative" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isMoreActive || showMore ? t.goldText : t.textMut} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                {totalBadge > 0 && !isMoreActive && <div style={{ position: "absolute", top: -4, right: -8, minWidth: 16, height: 16, borderRadius: 8, background: RED, color: "#F8F7F4", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{totalBadge}</div>}
              </div>
              <span style={{ fontSize: 9, fontWeight: isMoreActive || showMore ? 700 : 500, color: isMoreActive || showMore ? t.goldText : t.textMut, letterSpacing: "0.3px" }}>More</span>
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
          onSave={(ids) => { applyShortcuts(ids); setShortcutsOpen(false); showToast("Shortcuts saved"); }}
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
          
          <div style={{ fontSize: 11, color: t.textMut, marginTop: 16, letterSpacing: "1px", textTransform: "uppercase", fontFamily: FONT_HEAD, fontWeight: 700 }}>Staff Operations Portal</div>
        </div>
        <div style={{ marginBottom: 16 }}><label style={labelSt}>Badge Number, Phone or Email</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="9001, 2155550101 or name@email.com" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} style={inputSt} onKeyDown={e => e.key === "Enter" && onLogin(phone, pin)} /></div>
        <div style={{ marginBottom: 8 }}><label style={labelSt}>PIN</label><input value={pin} onChange={e => setPin(e.target.value)} placeholder="4-digit PIN" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={4} style={{ ...inputSt, letterSpacing: "8px", textAlign: "center", fontSize: 20 }} onKeyDown={e => e.key === "Enter" && onLogin(phone, pin)} /></div>
        <div style={{ textAlign: "right", marginBottom: 24 }}><button onClick={onGoForgot} style={{ background: "none", border: "none", padding: "4px 0", color: t.textSec, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Forgot your PIN?</button></div>
        <button onClick={() => onLogin(phone, pin)} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, " + GOLD + ", " + GOLD_LIGHT + ")", color: NAVY, fontSize: 15, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "1px", opacity: loading ? 0.6 : 1, boxShadow: "0 6px 18px rgba(231,176,23,0.30)", fontFamily: FONT_HEAD }}>{loading ? "Signing in..." : "Sign In"}</button>
        <button onClick={onGoRegister} style={{ width: "100%", padding: "12px", marginTop: 12, borderRadius: 10, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec, fontSize: 13, cursor: "pointer" }}>New Employee? Register Here</button>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 20 }}><button onClick={toggleTheme} style={{ background: "none", border: "1px solid " + t.border, borderRadius: 8, padding: "6px 14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, color: t.textMut, fontSize: 11 }}>{themeMode === "dark" ? <SunIco sz={14} c={t.textMut} /> : <MoonIco sz={14} c={t.textMut} />}{themeMode === "dark" ? "Light Mode" : "Dark Mode"}</button><TextSizeButton t={t} /></div>
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
    if (empty) { setErrs({ [empty[0]]: "Fill in " + empty[1] + "." }); return; }
    if (pin !== pin2) { setErrs({ pin2: ERR_PIN_MISMATCH }); return; }
    setErrs({});
    onRegister(fn, ln, ph, em, pin);
  };
  return (
    <div style={{ width: "100%", minHeight: "var(--ocsa-vh, 100vh)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 24px" }}>
      <div style={{ width: "100%", maxWidth: 420, background: t.card, border: "1px solid " + t.border, borderRadius: R.lg, padding: "28px 24px", boxShadow: t.popShadow }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-block", maxWidth: "100%", boxSizing: "border-box", padding: "4px 12px", background: "rgba(255,255,255,0.92)", borderRadius: 6 }}><img src={LOGO_SM} alt={clientConfig.company.shortName} style={{ height: 34, maxWidth: "100%", objectFit: "contain" }} /></div>
          <div style={{ fontSize: 12, color: t.textSec, letterSpacing: "2px", textTransform: "uppercase", marginTop: 8, fontFamily: FONT_HEAD, fontWeight: 700 }}>New Staff Registration</div>
        </div>
        <div style={{ marginBottom: 14 }}><label style={labelSt}>First Name *</label><input value={fn} onChange={e => setFn(e.target.value)} placeholder="First name" style={inputSt} />{errs.firstName && <div style={errSt}>{errs.firstName}</div>}</div>
        <div style={{ marginBottom: 14 }}><label style={labelSt}>Last Name</label><input value={ln} onChange={e => setLn(e.target.value)} placeholder="Last name" style={inputSt} /></div>
        <div style={{ marginBottom: 14 }}><label style={labelSt}>Phone Number *</label><input value={ph} onChange={e => setPh(e.target.value)} placeholder="2155550000 (no dashes needed)" style={inputSt} />{errs.phone && <div style={errSt}>{errs.phone}</div>}</div>
        <div style={{ marginBottom: 14 }}><label style={labelSt}>Email Address *</label><input value={em} onChange={e => setEm(e.target.value)} placeholder="name@email.com" type="email" style={inputSt} />{errs.email && <div style={errSt}>{errs.email}</div>}</div>
        <div style={{ marginBottom: 14 }}><label style={labelSt}>PIN (4 digits) *</label><input value={pin} onChange={e => setPin(e.target.value)} type="password" maxLength={4} style={{ ...inputSt, letterSpacing: "8px", textAlign: "center", fontSize: 20 }} />{errs.pin && <div style={errSt}>{errs.pin}</div>}</div>
        <div style={{ marginBottom: 24 }}><label style={labelSt}>Confirm PIN *</label><input value={pin2} onChange={e => setPin2(e.target.value)} type="password" maxLength={4} style={{ ...inputSt, letterSpacing: "8px", textAlign: "center", fontSize: 20 }} />{errs.pin2 && <div style={errSt}>{errs.pin2}</div>}</div>
        <button onClick={submit} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, " + GOLD + ", " + GOLD_LIGHT + ")", color: NAVY, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 18px rgba(231,176,23,0.30)", fontFamily: FONT_HEAD }}>{loading ? "Registering..." : "Register"}</button>
        <button onClick={onBack} style={{ width: "100%", padding: "12px", marginTop: 12, borderRadius: 10, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec, fontSize: 13, cursor: "pointer" }}>Back to Login</button>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}><TextSizeButton t={t} /></div>
      </div>
    </div>
  );
}

function AuthCard({ t, title, children }) {
  return (
    <div style={{ width: "100%", minHeight: "var(--ocsa-vh, 100vh)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 24px" }}>
      <div style={{ width: "100%", maxWidth: 420, background: t.card, border: "1px solid " + t.border, borderRadius: R.lg, padding: "28px 24px", boxShadow: t.popShadow }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-block", maxWidth: "100%", boxSizing: "border-box", padding: "4px 12px", background: "rgba(255,255,255,0.92)", borderRadius: 6 }}><img src={LOGO_SM} alt={clientConfig.company.shortName} style={{ height: 34, maxWidth: "100%", objectFit: "contain" }} /></div>
          <div style={{ fontSize: 12, color: t.textSec, letterSpacing: "2px", textTransform: "uppercase", marginTop: 8, fontFamily: FONT_HEAD, fontWeight: 700 }}>{title}</div>
        </div>
        {children}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}><TextSizeButton t={t} /></div>
      </div>
    </div>
  );
}

function BootSplash({ t, themeMode }) {
  return (
    <div style={{ width: "100%", minHeight: "var(--ocsa-vh, 100vh)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 24px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "inline-block", maxWidth: "100%", boxSizing: "border-box", padding: themeMode === "dark" ? "12px 20px" : "0", background: themeMode === "dark" ? "rgba(255,255,255,0.95)" : "transparent", borderRadius: 12 }}><img src={LOGO_LG} alt={clientConfig.company.shortName} style={{ height: 70, maxWidth: "100%", objectFit: "contain" }} /></div>
        <div style={{ fontSize: 11, color: t.textMut, marginTop: 16, letterSpacing: "1px", textTransform: "uppercase", fontFamily: FONT_HEAD, fontWeight: 700 }}>Staff Operations Portal</div>
        <div style={{ fontSize: 10, color: t.textMut, marginTop: 8, animation: "pulse 2s infinite" }}>Loading...</div>
      </div>
    </div>
  );
}

function LangPicker({ value, onChange, t }) {
  const opts = [["en", "English"], ["es", "Espa\u00f1ol"]];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {opts.map(([v, l]) => <button key={v} type="button" onClick={() => onChange(v)} style={{ flex: 1, padding: "10px", borderRadius: R.sm, fontSize: 12, fontWeight: 700, fontFamily: FONT_HEAD, background: value === v ? t.goldBg : "transparent", color: value === v ? t.goldText : t.textMut, border: "1px solid " + (value === v ? t.goldBorder : t.borderSolid), cursor: "pointer" }}>{l}</button>)}
    </div>
  );
}

const fmtExpiry = (v) => { try { return new Date(v).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };
const ERR_GENERIC = "Something went wrong on our end. Try again in a minute.";
const ERR_PIN_MISMATCH = "The two PINs do not match. Type the same 4 digits in both fields.";
const MSG_LINK_INVALID = "This link is no longer valid. Links expire, and each one can only be used once.";

function ActivateScreen({ token, onActivated, onGoLogin, showToast, t }) {
  const [phase, setPhase] = useState(token ? "checking" : "incomplete");
  const [info, setInfo] = useState(null);
  const [fail, setFail] = useState({ from: "", msg: "" });
  const [badge, setBadge] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [locale, setLocale] = useState("en");
  const [errs, setErrs] = useState({});
  const [mismatches, setMismatches] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const labelSt = mkLabel(t); const inputSt = mkInput(t); const pinSt = mkPinInput(t); const errSt = mkFieldErr(t); const helpSt = mkHelp(t); const textSt = mkCardText(t);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setPhase("checking");
    api("/api/auth/activate/" + encodeURIComponent(token), { noAuthEvent: true })
      .then(d => { if (!alive) return; setInfo(d); setLocale(d.preferredLanguage === "es" ? "es" : "en"); setPhase("form"); })
      .catch(e => { if (!alive) return; if (e.code === "TOKEN_INVALID") { setPhase("invalid"); } else { setFail({ from: "get", msg: ERR_GENERIC }); setPhase("error"); } });
    return () => { alive = false; };
  }, [token, attempt]);

  // The API requires the badge whenever the row carries one. The GET says
  // so through badgeAssigned; treat anything but an explicit false as required.
  const needBadge = !info || info.badgeAssigned !== false;

  const submit = async () => {
    const e = {};
    const b = badge.trim();
    if (needBadge && !b) e.badge = "Enter the badge number from your email.";
    // The same rules Set Your PIN applies, so a PIN accepted here is never
    // refused a moment later.
    const why = weakPinReason(pin, b);
    if (why) e.pin = why;
    else if (pin2 !== pin) e.pin2 = ERR_PIN_MISMATCH;
    setErrs(e);
    if (Object.keys(e).length) return;
    setPhase("working");
    try {
      const body = { token, pin, locale };
      if (needBadge) body.badgeNumber = b;
      const d = await api("/api/auth/activate", { method: "POST", body, noAuthEvent: true });
      if (d.token) { setPhase("done"); onActivated(d.token); return; }
      setFail({ from: "post", msg: d.message || "Your account is activated but not currently active. Contact your supervisor." });
      setPhase("inactive");
    } catch (err) {
      if (err.code === "TOKEN_INVALID") { setPhase("invalid"); return; }
      if (err.code === "BADGE_MISMATCH") {
        const n = mismatches + 1; setMismatches(n);
        setErrs({ badge: "That badge number does not match our records. Check the number in your email." + (n >= 3 ? " Ask your supervisor to confirm your badge number." : "") });
        setPhase("form"); return;
      }
      if (err.status === 400) { setErrs({ pin: err.message }); setPhase("form"); return; }
      setFail({ from: "post", msg: ERR_GENERIC }); setPhase("error");
    }
  };
  const retry = () => { setErrs({}); if (fail.from === "get") setAttempt(a => a + 1); else setPhase("form"); };
  const working = phase === "working";

  if (phase === "incomplete") return (
    <AuthCard t={t} title="Account Activation">
      <div style={textSt}>This activation link is incomplete. Open the link from your email again.</div>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>Back to Sign In</button>
    </AuthCard>
  );
  if (phase === "checking" || phase === "done") return (
    <AuthCard t={t} title="Account Activation">
      <div style={{ ...textSt, textAlign: "center", color: t.textMut, animation: "pulse 2s infinite" }}>{phase === "done" ? "PIN set. Signing you in..." : "Checking your link..."}</div>
    </AuthCard>
  );
  if (phase === "invalid") return (
    <AuthCard t={t} title="Account Activation">
      <div style={textSt}>{MSG_LINK_INVALID}</div>
      <div style={textSt}>{SUPPORT_LINE}</div>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>Back to Sign In</button>
    </AuthCard>
  );
  if (phase === "inactive") return (
    <AuthCard t={t} title="Account Activation">
      <div style={textSt}>{fail.msg}</div>
      <div style={{ ...textSt, color: t.textSec }}>Your PIN has been saved. Signing in will work once your account is active.</div>
    </AuthCard>
  );
  if (phase === "error") return (
    <AuthCard t={t} title="Account Activation">
      <div style={textSt}>{fail.msg}</div>
      <button onClick={retry} style={mkPrimaryBtn(t, false)}>Try Again</button>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>Back to Sign In</button>
    </AuthCard>
  );
  return (
    <AuthCard t={t} title="Account Activation">
      <div style={textSt}>{info && info.firstName ? "Welcome, " + info.firstName + ". " : ""}Confirm your badge number and choose your 4-digit PIN.</div>
      {info && info.expiresAt && <div style={{ ...helpSt, marginTop: 0, marginBottom: 16 }}>This link works until {fmtExpiry(info.expiresAt)} and can be used once.</div>}
      {needBadge && <div style={{ marginBottom: 14 }}>
        <label style={labelSt}>Badge Number</label>
        <input value={badge} onChange={e => setBadge(e.target.value)} inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="Badge number" style={inputSt} />
        <div style={helpSt}>The number on the email we sent you.</div>
        {errs.badge && <div style={errSt}>{errs.badge}</div>}
      </div>}
      <div style={{ marginBottom: 14 }}><label style={labelSt}>PIN (4 digits)</label><input value={pin} onChange={e => setPin(e.target.value)} {...PIN_INPUT_PROPS} style={pinSt} />{errs.pin && <div style={errSt}>{errs.pin}</div>}</div>
      <div style={{ marginBottom: 14 }}><label style={labelSt}>Confirm PIN</label><input value={pin2} onChange={e => setPin2(e.target.value)} {...PIN_INPUT_PROPS} style={pinSt} onKeyDown={e => e.key === "Enter" && !working && submit()} />{errs.pin2 && <div style={errSt}>{errs.pin2}</div>}</div>
      <div style={{ marginBottom: 22 }}><label style={labelSt}>Language</label><LangPicker value={locale} onChange={setLocale} t={t} /></div>
      <button onClick={submit} disabled={working} style={mkPrimaryBtn(t, working)}>{working ? "Activating..." : "Activate Account"}</button>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>Back to Sign In</button>
    </AuthCard>
  );
}

function ResetScreen({ token, onReset, onGoLogin, onGoForgot, showToast, t }) {
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
    api("/api/auth/reset/" + encodeURIComponent(token), { noAuthEvent: true })
      .then(d => { if (!alive) return; setInfo(d); setPhase("form"); })
      .catch(e => { if (!alive) return; if (e.code === "TOKEN_INVALID") { setPhase("invalid"); } else { setFail({ from: "get", msg: ERR_GENERIC }); setPhase("error"); } });
    return () => { alive = false; };
  }, [token, attempt]);

  const submit = async () => {
    const e = {};
    if (!PIN_RE.test(pin)) e.pin = "PIN must be exactly 4 digits.";
    else if (pin2 !== pin) e.pin2 = ERR_PIN_MISMATCH;
    setErrs(e);
    if (Object.keys(e).length) return;
    setPhase("working");
    try {
      const d = await api("/api/auth/reset", { method: "POST", body: { token, pin }, noAuthEvent: true });
      if (d.token) { setPhase("done"); onReset(d.token); return; }
      setFail({ from: "post", msg: d.message || "Your PIN has been changed. Contact your supervisor about your account status." });
      setPhase("inactive");
    } catch (err) {
      if (err.code === "TOKEN_INVALID") { setPhase("invalid"); return; }
      if (err.status === 400) { setErrs({ pin: err.message }); setPhase("form"); return; }
      setFail({ from: "post", msg: ERR_GENERIC }); setPhase("error");
    }
  };
  const retry = () => { setErrs({}); if (fail.from === "get") setAttempt(a => a + 1); else setPhase("form"); };
  const working = phase === "working";

  if (phase === "incomplete") return (
    <AuthCard t={t} title="Reset Your PIN">
      <div style={textSt}>This reset link is incomplete. Open the link from your email again.</div>
      <button onClick={onGoForgot} style={mkPrimaryBtn(t, false)}>Request a New Link</button>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>Back to Sign In</button>
    </AuthCard>
  );
  if (phase === "checking" || phase === "done") return (
    <AuthCard t={t} title="Reset Your PIN">
      <div style={{ ...textSt, textAlign: "center", color: t.textMut, animation: "pulse 2s infinite" }}>{phase === "done" ? "PIN saved. Signing you in..." : "Checking your link..."}</div>
    </AuthCard>
  );
  if (phase === "invalid") return (
    <AuthCard t={t} title="Reset Your PIN">
      <div style={textSt}>{MSG_LINK_INVALID}</div>
      <button onClick={onGoForgot} style={mkPrimaryBtn(t, false)}>Request a New Link</button>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>Back to Sign In</button>
    </AuthCard>
  );
  if (phase === "inactive") return (
    <AuthCard t={t} title="Reset Your PIN">
      <div style={textSt}>{fail.msg}</div>
      <div style={{ ...textSt, color: t.textSec }}>Signing in will work once your account is active.</div>
    </AuthCard>
  );
  if (phase === "error") return (
    <AuthCard t={t} title="Reset Your PIN">
      <div style={textSt}>{fail.msg}</div>
      <button onClick={retry} style={mkPrimaryBtn(t, false)}>Try Again</button>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>Back to Sign In</button>
    </AuthCard>
  );
  return (
    <AuthCard t={t} title="Reset Your PIN">
      <div style={textSt}>{info && info.firstName ? "Welcome back, " + info.firstName + ". " : ""}Choose your new 4-digit PIN.</div>
      {info && info.expiresAt && <div style={{ ...helpSt, marginTop: 0, marginBottom: 16 }}>This link works until {fmtExpiry(info.expiresAt)} and can be used once.</div>}
      <div style={{ marginBottom: 14 }}><label style={labelSt}>New PIN (4 digits)</label><input value={pin} onChange={e => setPin(e.target.value)} {...PIN_INPUT_PROPS} style={pinSt} />{errs.pin && <div style={errSt}>{errs.pin}</div>}</div>
      <div style={{ marginBottom: 22 }}><label style={labelSt}>Confirm PIN</label><input value={pin2} onChange={e => setPin2(e.target.value)} {...PIN_INPUT_PROPS} style={pinSt} onKeyDown={e => e.key === "Enter" && !working && submit()} />{errs.pin2 && <div style={errSt}>{errs.pin2}</div>}</div>
      <button onClick={submit} disabled={working} style={mkPrimaryBtn(t, working)}>{working ? "Saving..." : "Save PIN"}</button>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>Back to Sign In</button>
    </AuthCard>
  );
}

function ForgotScreen({ onGoLogin, showToast, t }) {
  const [ident, setIdent] = useState("");
  const [err, setErr] = useState("");
  const [phase, setPhase] = useState("form");
  const labelSt = mkLabel(t); const inputSt = mkInput(t); const errSt = mkFieldErr(t); const textSt = mkCardText(t);

  const submit = async () => {
    const v = ident.trim();
    if (!v) { setErr("Enter your badge number, phone number or email address."); return; }
    setErr(""); setPhase("working");
    try {
      await api("/api/auth/reset/request", { method: "POST", body: { identifier: v }, noAuthEvent: true });
      setPhase("sent");
    } catch (e) {
      setPhase("form");
      setErr(e.status === 400 ? e.message : ERR_GENERIC);
    }
  };
  const working = phase === "working";

  // The API answers the same neutral 200 for every outcome except an
  // empty identifier, so the confirmation conditions on nothing.
  if (phase === "sent") return (
    <AuthCard t={t} title="Reset Your PIN">
      <div style={textSt}>If that matches an account on file, a reset link is on its way. The link is good for one hour.</div>
      <div style={textSt}>If you do not have an email address on file, no link can reach you. Contact your supervisor to have your PIN reset directly.</div>
      <div style={textSt}>Forgotten your badge number? You can also sign in with your phone number or your email address.</div>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>Back to Sign In</button>
    </AuthCard>
  );
  return (
    <AuthCard t={t} title="Reset Your PIN">
      <div style={textSt}>Enter the badge number, phone number or email address on your account and we will email you a link to choose a new PIN.</div>
      <div style={{ marginBottom: 22 }}>
        <label style={labelSt}>Badge Number, Phone or Email</label>
        <input value={ident} onChange={e => setIdent(e.target.value)} placeholder="9001, 2155550101 or name@email.com" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} style={inputSt} onKeyDown={e => e.key === "Enter" && !working && submit()} />
        {err && <div style={errSt}>{err}</div>}
      </div>
      <button onClick={submit} disabled={working} style={mkPrimaryBtn(t, working)}>{working ? "Sending..." : "Send Reset Link"}</button>
      <button onClick={onGoLogin} style={mkGhostBtn(t)}>Back to Sign In</button>
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
    else if (pin2 !== pin) e.pin2 = ERR_PIN_MISMATCH;
    setErrs(e);
    if (Object.keys(e).length) return;
    setWorking(true);
    try {
      const d = await api("/api/auth/change-pin", { method: "POST", body: { newPin: pin }, token });
      onDone(d);
    } catch (err) { setErrs({ pin: err.message }); }
    setWorking(false);
  };

  return (
    <AuthCard t={t} title="Set Your PIN">
      <div style={textSt}>Set your own PIN. The PIN you were given is known to your supervisor. Choose a new one that only you know.</div>
      <div style={{ marginBottom: 14 }}><label style={labelSt}>New PIN (4 digits)</label><input value={pin} onChange={e => setPin(e.target.value)} {...PIN_INPUT_PROPS} style={pinSt} />{errs.pin && <div style={errSt}>{errs.pin}</div>}</div>
      <div style={{ marginBottom: 22 }}><label style={labelSt}>Confirm PIN</label><input value={pin2} onChange={e => setPin2(e.target.value)} {...PIN_INPUT_PROPS} style={pinSt} onKeyDown={e => e.key === "Enter" && !working && submit()} />{errs.pin2 && <div style={errSt}>{errs.pin2}</div>}</div>
      <button onClick={submit} disabled={working} style={mkPrimaryBtn(t, working)}>{working ? "Saving..." : "Save PIN"}</button>
      <div style={{ textAlign: "center", marginTop: 18 }}><button onClick={onSignOut} style={{ background: "none", border: "none", padding: "4px 0", color: t.textMut, fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>Not you? Sign out</button></div>
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

  const toISO = (d) => d.toISOString().split("T")[0];
  const fmtTm = (v) => { if (!v) return ""; const parts = String(v).split(":"); const h = parseInt(parts[0]); const m = parts[1] || "00"; const ap = h >= 12 ? "PM" : "AM"; return ((h % 12) || 12) + ":" + m + " " + ap; };
  const fmtClockTm = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  const getWeekEnd = () => { const e = new Date(weekStart); e.setDate(e.getDate() + 6); return e; };
  const getWeekDays = () => { const days = []; for (let i = 0; i < 7; i++) { const d = new Date(weekStart); d.setDate(d.getDate() + i); days.push(toISO(d)); } return days; };
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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

  const weekLabel = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " - " + getWeekEnd().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const weekDays = getWeekDays();

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: FONT_HEAD }}>My Schedule</div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setView("week")} style={{ padding: "5px 12px", borderRadius: R.sm, fontSize: 10, fontWeight: view === "week" ? 700 : 600, fontFamily: FONT_HEAD, textTransform: "uppercase", letterSpacing: "0.5px", background: view === "week" ? t.goldBg : "transparent", color: view === "week" ? t.goldText : t.textMut, border: view === "week" ? "1px solid " + t.goldBorder : "1px solid transparent", cursor: "pointer" }}>Week</button>
          <button onClick={() => { setView("month"); const first = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1); setWeekStart(first); }} style={{ padding: "5px 12px", borderRadius: R.sm, fontSize: 10, fontWeight: view === "month" ? 700 : 600, fontFamily: FONT_HEAD, textTransform: "uppercase", letterSpacing: "0.5px", background: view === "month" ? t.goldBg : "transparent", color: view === "month" ? t.goldText : t.textMut, border: view === "month" ? "1px solid " + t.goldBorder : "1px solid transparent", cursor: "pointer" }}>Month</button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={prevWeek} style={{ background: "transparent", border: "1px solid " + t.borderSolid, borderRadius: R.sm, padding: "6px 12px", cursor: "pointer", color: t.textMut, fontSize: 14 }}>&lt;</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{weekLabel}</span>
          <button onClick={goToday} style={{ fontSize: 9, padding: "3px 9px", borderRadius: R.sm, border: "1px solid " + BLUE, background: "transparent", color: BLUE, cursor: "pointer", fontWeight: 700, fontFamily: FONT_HEAD }}>Today</button>
        </div>
        <button onClick={nextWeek} style={{ background: "transparent", border: "1px solid " + t.borderSolid, borderRadius: R.sm, padding: "6px 12px", cursor: "pointer", color: t.textMut, fontSize: 14 }}>&gt;</button>
      </div>

      {loading && <div style={{ textAlign: "center", padding: 20, color: t.textMut, fontSize: 12 }}>Loading...</div>}

      {/* WEEK VIEW */}
      {!loading && view === "week" && (
        <div style={{ overflowX: "auto", display: "flex", flex: compact ? undefined : 1 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, minWidth: 300, flex: 1 }}>
          {weekDays.map((ds, i) => {
            const sched = getSchedForDay(ds);
            const actual = getActualForDay(ds);
            const pickups = getPickupsForDay(ds);
            const today = isToday(ds);
            const dt = new Date(ds + "T00:00:00");
            const hasAny = sched.length > 0 || actual.length > 0 || pickups.length > 0;
            return (
              <div key={ds} style={{ background: today ? t.goldBg : t.card, border: "1px solid " + (today ? t.goldBorder : t.borderSolid), borderRadius: R.md, padding: 6, minHeight: compact ? 80 : 120, flex: compact ? undefined : 1, boxShadow: t.shadow }}>
                <div style={{ textAlign: "center", marginBottom: 4 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: today ? t.goldText : t.textMut, textTransform: "uppercase" }}>{dayNames[i]}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: today ? t.goldText : t.text, fontFamily: FONT_HEAD }}>{dt.getDate()}</div>
                </div>
                {sched.map(s => (
                  <div key={s.id} onClick={() => setDetail({ type: "scheduled", ...s })} style={{ padding: "3px 4px", marginBottom: 2, borderRadius: 4, fontSize: 9, fontWeight: 600, background: GOLD + "18", color: t.goldText, border: "1px solid " + GOLD + "30", cursor: "pointer" }}>
                    {fmtTm(s.start_time)}{s.end_time ? " - " + fmtTm(s.end_time) : ""}{s.site_name && <div style={{ fontSize: 8, opacity: 0.8 }}>{s.site_name}</div>}
                  </div>
                ))}
                {actual.map(a => (
                  <div key={a.id} onClick={() => setDetail({ type: "actual", ...a })} style={{ padding: "3px 4px", marginBottom: 2, borderRadius: 4, fontSize: 9, fontWeight: 600, background: GREEN + "15", color: GREEN, border: "1px solid " + GREEN + "30", cursor: "pointer" }}>
                    {fmtClockTm(a.clock_in_time)}{a.duration_minutes ? " (" + Math.floor(a.duration_minutes / 60) + "h)" : a.shift_status === "active" ? " (live)" : ""}{a.site_name && <div style={{ fontSize: 8, opacity: 0.8 }}>{a.site_name}</div>}
                  </div>
                ))}
                {pickups.map(p => {
                  const pc = p.status === "approved" ? GREEN : BLUE;
                  return (
                    <div key={p.id} onClick={() => setDetail({ type: "pickup", ...p })} style={{ padding: "3px 4px", marginBottom: 2, borderRadius: 4, fontSize: 9, fontWeight: 600, background: pc + "15", color: pc, border: "1px solid " + pc + "30", cursor: "pointer" }}>
                      {fmtTm(p.start_time)} <span style={{ fontSize: 7, textTransform: "uppercase" }}>{p.status === "approved" ? "approved" : "claimed"}</span>
                      {p.site_name && <div style={{ fontSize: 8, opacity: 0.8 }}>{p.site_name}</div>}
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
        const monthName = firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        return (
          <div style={{ display: "flex", flexDirection: "column", flex: compact ? undefined : 1 }}>
            <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8, fontFamily: FONT_HEAD }}>{monthName}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 2, marginBottom: 4 }}>
              {dayNames.map(d => <div key={d} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: t.textMut, padding: "4px 0" }}>{d}</div>)}
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
                    <div style={{ fontSize: 11, fontWeight: today ? 700 : 500, color: today ? t.goldText : t.text, fontFamily: FONT_HEAD }}>{dt.getDate()}</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 2, flexWrap: "wrap" }}>
                      {sched.length > 0 && <div style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD }} />}
                      {actual.length > 0 && <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN }} />}
                      {pickups.length > 0 && <div style={{ width: 6, height: 6, borderRadius: "50%", background: BLUE }} />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 8 }}>
              {[{ c: GOLD, l: "Scheduled" }, { c: GREEN, l: "Worked" }, { c: BLUE, l: "Pickup" }].map(lg => (
                <div key={lg.l} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: lg.c }} />
                  <span style={{ fontSize: 8, color: t.textMut }}>{lg.l}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* SHIFT DETAIL MODAL */}
      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.modalOverlay, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: "16px 16px 0 0", border: "1px solid " + t.borderSolid, width: "100%", maxWidth: 960, padding: "20px 20px 30px", boxShadow: t.popShadow }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: t.textMut, margin: "0 auto 16px", opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 14, fontFamily: FONT_HEAD }}>
              {detail.type === "scheduled" ? "Scheduled Shift" : detail.type === "actual" ? "Worked Shift" : "Pickup Shift"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 3, fontFamily: FONT_HEAD }}>Site</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{detail.site_name || "N/A"}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 3, fontFamily: FONT_HEAD }}>Status</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: detail.type === "actual" ? GREEN : detail.type === "pickup" ? (detail.status === "approved" ? GREEN : ORANGE) : t.goldText }}>
                  {detail.type === "actual" ? (detail.shift_status === "active" ? "On Site" : "Completed") : detail.type === "pickup" ? (detail.status || "").charAt(0).toUpperCase() + (detail.status || "").slice(1) : (detail.status || "scheduled").charAt(0).toUpperCase() + (detail.status || "scheduled").slice(1)}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              {detail.type === "actual" ? (<>
                <div>
                  <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 3, fontFamily: FONT_HEAD }}>Shift Start</div>
                  <div style={{ fontSize: 13, color: t.text }}>{detail.clock_in_time ? fmtClockTm(detail.clock_in_time) : "N/A"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 3, fontFamily: FONT_HEAD }}>Shift End</div>
                  <div style={{ fontSize: 13, color: detail.clock_out_time ? t.text : ORANGE }}>{detail.clock_out_time ? fmtClockTm(detail.clock_out_time) : "Still on site"}</div>
                </div>
              </>) : (<>
                <div>
                  <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 3, fontFamily: FONT_HEAD }}>Start</div>
                  <div style={{ fontSize: 13, color: t.text }}>{fmtTm(detail.start_time)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 3, fontFamily: FONT_HEAD }}>End</div>
                  <div style={{ fontSize: 13, color: t.text }}>{fmtTm(detail.end_time)}</div>
                </div>
              </>)}
            </div>
            {detail.type === "actual" && detail.duration_minutes && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 3, fontFamily: FONT_HEAD }}>Duration</div>
                <div style={{ fontSize: 13, color: t.text }}>{Math.floor(detail.duration_minutes / 60)}h {detail.duration_minutes % 60}m</div>
              </div>
            )}
            {(detail.building_name || detail.floor_number) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                {detail.building_name && <div><div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 3, fontFamily: FONT_HEAD }}>Building</div><div style={{ fontSize: 13, color: t.text }}>{detail.building_name}</div></div>}
                {detail.floor_number && <div><div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 3, fontFamily: FONT_HEAD }}>Floor</div><div style={{ fontSize: 13, color: t.text }}>{detail.floor_number}</div></div>}
              </div>
            )}
            {detail.service_category && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 3, fontFamily: FONT_HEAD }}>Service</div>
                <div style={{ fontSize: 13, color: t.text }}>{detail.service_category}</div>
              </div>
            )}
            {detail.notes && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 3, fontFamily: FONT_HEAD }}>Notes</div>
                <div style={{ fontSize: 12, color: t.textSec, fontStyle: "italic" }}>{detail.notes}</div>
              </div>
            )}
            {detail.type === "pickup" && detail.origin && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 3, fontFamily: FONT_HEAD }}>Reason</div>
                <div style={{ fontSize: 13, color: t.text }}>{detail.origin.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</div>
              </div>
            )}
            {detail.type === "scheduled" && detail.status !== "cancelled" && !detail.dropForm && (
              <button onClick={() => setDetail({ ...detail, dropForm: { reason: "sick", notes: "" } })} style={{ width: "100%", padding: "11px", borderRadius: R.md, border: "1px solid " + RED, background: "transparent", color: RED, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 8 }}>Request to Drop This Shift</button>
            )}
            {detail.dropForm && (
              <div style={{ padding: 12, borderRadius: R.md, background: t.redSubtle, border: "1px solid " + t.redBorder, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: RED, marginBottom: 8 }}>Drop Request</div>
                <div style={{ fontSize: 10, color: t.textSec, marginBottom: 10 }}>Your supervisor will review this request. If approved, the shift will be opened for pickup or reassigned.</div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 4, fontFamily: FONT_HEAD }}>Reason</div>
                  <select value={detail.dropForm.reason} onChange={e => setDetail({ ...detail, dropForm: { ...detail.dropForm, reason: e.target.value } })} style={mkInput(t)}>
                    {(getOpts("drop_reasons").length > 0 ? getOpts("drop_reasons") : [{ v: "sick", l: "Sick" }, { v: "personal", l: "Personal" }, { v: "scheduling_conflict", l: "Scheduling Conflict" }, { v: "emergency", l: "Emergency" }, { v: "other", l: "Other" }]).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
                {lkHasOther("drop_reasons", detail.dropForm.reason) && <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 4, fontFamily: FONT_HEAD }}>Specify Reason</div>
                  <input value={detail.dropForm.otherText || ""} onChange={e => setDetail({ ...detail, dropForm: { ...detail.dropForm, otherText: e.target.value } })} placeholder="Describe the reason" style={mkInput(t)} />
                </div>}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 4, fontFamily: FONT_HEAD }}>Notes (optional)</div>
                  <input value={detail.dropForm.notes} onChange={e => setDetail({ ...detail, dropForm: { ...detail.dropForm, notes: e.target.value } })} placeholder="Any additional details..." style={mkInput(t)} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setDetail({ ...detail, dropForm: null })} style={{ flex: 1, padding: "11px", borderRadius: R.md, border: "1px solid " + t.borderSolid, background: "transparent", color: t.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button onClick={async () => {
                    try {
                      // What was typed under Specify Reason is sent, with
                      // the Notes line under it when both were filled.
                      const other = (detail.dropForm.otherText || "").trim();
                      const extra = (detail.dropForm.notes || "").trim();
                      const notes = other && extra ? other + "\n" + extra : (other || extra || detail.dropForm.reason);
                      await api("/api/pickups/request-drop", { method: "POST", body: { scheduled_shift_id: detail.id, reason: detail.dropForm.reason, notes }, token });
                      setDetail(null);
                      showToast("Drop request sent. Your supervisor will review it.");
                      loadSchedule();
                    } catch (e) { showToast(e.message || "Drop request failed", "error"); }
                  }} style={{ flex: 1, padding: "11px", borderRadius: R.md, border: "none", background: RED, color: "#F8F7F4", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: FONT_HEAD }}>Submit Request</button>
                </div>
              </div>
            )}
            <button onClick={() => setDetail(null)} style={{ width: "100%", padding: "12px", borderRadius: R.md, border: "1px solid " + t.borderSolid, background: "transparent", color: t.text, fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ClockView({ clockStatus, currentTime, selectedSite, pendingSite, startBlock, onSelectSite, onStartSession, onEndSession, siteChoices, loading, completedCount, taskCount, taskListLoaded, t }) {
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
  const groups = (grouped ? [{ label: "Scheduled Today", items: scheduled }, { label: "Your Assigned Sites", items: assigned }, { label: "All Other Sites", items: others }] : [{ label: null, items: others }]).filter(g => g.items.length > 0);
  const pendingRow = pendingSite ? [...scheduled, ...assigned, ...others].find(x => x.siteId === pendingSite) : null;
  const pendingName = pendingRow ? pendingRow.siteName : "";
  const emptySt = { padding: "28px 20px", textAlign: "center", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, fontSize: 13, color: t.textMut, boxShadow: t.shadow };
  const groupHeadSt = { fontSize: 10, color: t.textMut, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, margin: "6px 0 8px", fontFamily: FONT_HEAD };
  // Two highlights that must read differently. open is the site of the
  // shift in progress: gold fill, filled dot. picked is a choice not yet
  // started: gold outline, hollow gold dot. Rows go inert while a shift
  // is open, since the API refuses a second start until it is ended.
  const renderSite = (site, idx) => {
    const open = ci && selectedSite === site.siteId;
    const picked = !ci && pendingSite === site.siteId;
    const inert = loading || !!ci;
    const place = [site.address, site.city].filter(Boolean).join(", ");
    const detail = [site.buildingName, site.floorNumber ? "Floor " + site.floorNumber : null].filter(Boolean).join(" - ");
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
        <div style={{ fontSize: 44, fontWeight: 700, color: t.text, letterSpacing: "-0.5px", lineHeight: 1, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{formatTime(currentTime)}</div>
      </div>
      {ci && clockStatus.shift && (
        <div style={{ textAlign: "center", padding: "20px 18px", marginBottom: 16, background: t.card, borderRadius: R.lg, border: "1px solid " + t.goldBorder, boxShadow: t.popShadow }}>
          <div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8, fontWeight: 700, fontFamily: FONT_HEAD }}>Time on Site</div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "1px", color: t.text, lineHeight: 1, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{pad(h)}:{pad(m)}:{pad(s)}</div>
          <div style={{ fontSize: 11, color: t.textSec, marginTop: 8 }}>{sameLocalDay(clockStatus.shift.clockInTime, currentTime) ? "Started at " + formatTime(clockStatus.shift.clockInTime) : "Started " + formatDayShort(clockStatus.shift.clockInTime) + " at " + formatTime(clockStatus.shift.clockInTime)}</div>
          <div style={{ fontSize: 12, color: t.text, marginTop: 4, fontWeight: 600 }}>{clockStatus.shift.siteName}</div>
          {(clockStatus.shift.buildingName || clockStatus.shift.floorNumber) && <div style={{ fontSize: 11, color: t.goldText, marginTop: 3 }}>{clockStatus.shift.buildingName}{clockStatus.shift.floorNumber ? " - Floor " + clockStatus.shift.floorNumber : ""}</div>}
          {taskListLoaded && (<div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><div style={{ flex: 1, maxWidth: 180, height: 6, borderRadius: R.pill, background: t.cardAlt, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: R.pill, background: pct === 100 ? GREEN : "linear-gradient(90deg," + GOLD + "," + GOLD_LIGHT + ")", width: pct + "%", transition: "width 0.3s ease" }} /></div><span style={{ fontSize: 11, color: t.goldText, fontWeight: 700, fontFamily: FONT_HEAD }}>{done}/{total}</span></div>)}
          <button onClick={onEndSession} disabled={loading} style={{ ...mkPrimaryBtn(t, loading), marginTop: 16 }}>{loading ? "Ending..." : "End Shift"}</button>
        </div>
      )}
      {startBlock && <div style={{ padding: "12px 14px", marginBottom: 16, background: t.orangeSubtle, borderRadius: R.md, border: "1px solid " + t.orangeBorder, boxShadow: t.shadow, fontSize: 12, color: ORANGE, lineHeight: 1.5 }}>{startBlock}</div>}
      <div style={{ marginBottom: 16 }}>
        <label style={{ ...labelSt, display: "block", marginBottom: 10 }}>{ci && clockStatus.shift ? "Shift Open at " + clockStatus.shift.siteName : "Choose a Site to Start"}</label>
        {!siteChoices && <div style={emptySt}>Loading sites...</div>}
        {siteChoices && groups.length === 0 && <div style={emptySt}>No sites available yet.</div>}
        {siteChoices && groups.map((g, gi) => (<div key={gi}>{g.label && <div style={groupHeadSt}>{g.label}</div>}{g.items.map(renderSite)}</div>))}
        {siteChoices && groups.length > 0 && !ci && (
          <button onClick={() => onStartSession(pendingSite)} disabled={!pendingSite || loading} style={{ ...mkPrimaryBtn(t, loading || !pendingSite), marginTop: 4, cursor: !pendingSite || loading ? "default" : "pointer" }}>{loading ? "Starting..." : pendingSite ? "Start Shift at " + pendingName : "Start Shift"}</button>
        )}
      </div>
    </div>
  );
}

function groupTasksByFloorZone(taskList) {
  const groups = []; const floorMap = {};
  taskList.forEach(t => { const floor = t.floor_number || null; const zone = t.zone || "General"; const key = (floor || "_none_") + "|" + zone; if (!floorMap[key]) { floorMap[key] = { floor, zone, tasks: [] }; groups.push(floorMap[key]); } floorMap[key].tasks.push(t); });
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
  const floorHeadSt = { fontSize: 11, color: t.text, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8, padding: "7px 11px", background: t.card, borderRadius: R.sm, border: "1px solid " + t.borderSolid, fontFamily: FONT_HEAD };
  const zoneSt = { fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 700, marginBottom: 8, fontFamily: FONT_HEAD };
  const rowBase = { display: "flex", alignItems: "flex-start", gap: 11, padding: "11px 13px", marginBottom: 6, borderRadius: R.md, boxShadow: t.shadow };
  const chipPriority = { fontSize: 9, color: ORANGE, background: t.orangeSubtle, border: "1px solid " + t.orangeBorder, padding: "2px 6px", borderRadius: R.sm, fontWeight: 700, letterSpacing: "0.5px" };
  const chipCat = { fontSize: 9, color: t.textMut, background: t.cardAlt, padding: "2px 6px", borderRadius: R.sm, fontWeight: 600 };
  const detailSecLabel = { fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 6, fontFamily: FONT_HEAD };

  if (!clockStatus?.clockedIn) return (
    <div style={{ padding: "16px" }}>
      <div style={{ padding: "12px 14px", marginBottom: 14, background: t.orangeSubtle, borderRadius: R.md, border: "1px solid " + t.orangeBorder, boxShadow: t.shadow }}><div style={{ fontSize: 12, color: ORANGE }}>Start your shift to see and check off your tasks.</div></div>
      {standardTasks.length === 0 ? <EmptyState icon={CheckIco} text="No tasks loaded. Start your shift at a site to see your checklist." t={t} /> : (() => {
        const groups = groupTasksByFloorZone(standardTasks); let lastFloor = undefined;
        return groups.map((g, gi) => { const showFloor = g.floor && g.floor !== lastFloor; lastFloor = g.floor; return (<div key={gi} style={{ marginBottom: 16 }}>{showFloor && (<div style={{ ...floorHeadSt, marginTop: gi > 0 ? 10 : 0 }}>Floor {g.floor}</div>)}<div style={{ ...zoneSt, paddingLeft: g.floor ? 8 : 0 }}>{g.zone}</div>{g.tasks.map(task => { const hasInfo = task.has_details || task.description || task.media_url; return (<div key={task.id} onClick={() => hasInfo ? setDetail(task) : null} style={{ ...rowBase, background: t.card, border: "1px solid " + t.borderSolid, cursor: hasInfo ? "pointer" : "default", opacity: 0.6, marginLeft: g.floor ? 8 : 0 }}><div style={{ width: 22, height: 22, borderRadius: R.sm, border: "2px solid " + t.textMut, background: "transparent", flexShrink: 0, marginTop: 1 }} /><div style={{ flex: 1, fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 5, color: t.text }}>{task.label}{hasInfo && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: BLUE, flexShrink: 0 }} />}</div></div>); })}</div>); });
      })()}
    </div>
  );
  if (!loaded && tasksFailed) return (
    <div style={{ padding: "48px 24px", textAlign: "center", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, boxShadow: t.shadow, margin: 16 }}>
      <CheckIco sz={40} c={t.borderSolid} />
      <div style={{ fontSize: 15, color: t.textMut, marginTop: 16, fontFamily: FONT_HEAD }}>Your tasks did not load.</div>
      <button onClick={onRetryTasks} style={{ minHeight: 44, marginTop: 16, padding: "0 20px", borderRadius: R.md, border: "1px solid " + t.goldBorder, background: t.goldBg, color: t.goldText, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT_HEAD }}>Try again</button>
    </div>
  );
  if (!loaded) return <EmptyState icon={CheckIco} text="Loading tasks..." t={t} />;
  if (standardTasks.length === 0) return <EmptyState icon={CheckIco} text="No checklist is set up for this building yet." t={t} />;
  const groups = groupTasksByFloorZone(standardTasks);
  const completed = standardTasks.filter(tk => completedTaskIds.has(tk.id)).length;
  const pct = Math.round((completed / standardTasks.length) * 100);

  if (detail) {
    const done = completedTaskIds.has(detail.id);
    return (
      <div style={{ padding: "16px" }}>
        <button onClick={() => setDetail(null)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", marginBottom: 14, background: "transparent", border: "1px solid " + t.borderSolid, borderRadius: R.md, color: t.textSec, fontSize: 12, cursor: "pointer", fontWeight: 600 }}><Ico d="M15 18l-6-6 6-6" sz={14} c={t.textSec} /> Back to checklist</button>
        <div style={{ background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.lg, overflow: "hidden", boxShadow: t.popShadow }}>
          <div style={{ padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}><div style={{ fontSize: 16, fontWeight: 700, flex: 1, color: t.text, fontFamily: FONT_HEAD }}>{detail.label}</div><div style={{ display: "flex", gap: 4, flexShrink: 0 }}>{detail.priority === "high" && <span style={chipPriority}>PRIORITY</span>}<span style={chipCat}>{detail.cims_category}</span></div></div>
            <div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12, fontWeight: 700, fontFamily: FONT_HEAD }}>{detail.floor_number ? "Floor " + detail.floor_number + " - " : ""}{detail.zone}</div>
            {detail.description && (<div style={{ marginBottom: 14 }}><div style={detailSecLabel}>Instructions</div><div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{detail.description}</div></div>)}
            {detail.media_url && detail.media_type === "video" && (<div style={{ marginBottom: 14 }}><div style={detailSecLabel}>Reference Video</div><video src={detail.media_url} controls style={{ width: "100%", borderRadius: R.md, maxHeight: 240 }} /></div>)}
            {detail.media_url && detail.media_type !== "video" && (<div style={{ marginBottom: 14 }}><div style={detailSecLabel}>Reference Photo</div><img src={detail.media_url} alt="Task reference" style={{ width: "100%", borderRadius: R.md, maxHeight: 240, objectFit: "cover" }} /></div>)}
            {detail.due_date && (<div style={{ display: "flex", gap: 12, marginBottom: 14 }}><div style={{ fontSize: 11, color: t.textMut }}>Due Date: <span style={{ color: t.text, fontWeight: 500 }}>{new Date(detail.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></div>{detail.due_time && <div style={{ fontSize: 11, color: t.textMut }}>Time: <span style={{ color: t.text, fontWeight: 500 }}>{detail.due_time}</span></div>}</div>)}
          </div>
          <button onClick={() => { toggleTask(detail.id); setDetail(null); }} style={{ width: "100%", padding: "14px", border: "none", background: done ? t.cardAlt : "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")", color: done ? t.textMut : NAVY, fontSize: 14, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "1px", fontFamily: FONT_HEAD }}>{done ? "Uncheck Task" : "Mark Complete"}</button>
        </div>
      </div>
    );
  }

  let lastFloor = undefined;
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ padding: "14px 16px", marginBottom: 16, background: t.goldBg, borderRadius: R.lg, border: "1px solid " + t.goldBorder, boxShadow: t.popShadow }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, fontFamily: FONT_HEAD }}>Your Assignment</div><div style={{ fontSize: 15, fontWeight: 700, marginTop: 3, color: t.text, fontFamily: FONT_HEAD }}>{clockStatus.shift.siteName}</div>{(clockStatus.shift.buildingName || clockStatus.shift.floorNumber) && <div style={{ fontSize: 11, color: t.textSec, marginTop: 2 }}>{clockStatus.shift.buildingName}{clockStatus.shift.floorNumber ? " - Floor " + clockStatus.shift.floorNumber : ""}</div>}</div><div style={{ background: pct === 100 ? t.greenSubtle : t.card, padding: "6px 14px", borderRadius: R.pill, border: "1px solid " + (pct === 100 ? t.greenBorder : t.borderSolid) }}><div style={{ fontSize: 18, fontWeight: 700, color: pct === 100 ? GREEN : t.goldText, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{pct}%</div></div></div>
        <div style={{ height: 5, borderRadius: R.pill, background: t.cardAlt, marginTop: 12, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: R.pill, background: pct === 100 ? GREEN : "linear-gradient(90deg," + GOLD + "," + GOLD_LIGHT + ")", width: pct + "%", transition: "width 0.4s ease" }} /></div>
      </div>
      {groups.map((g, gi) => { const showFloor = g.floor && g.floor !== lastFloor; lastFloor = g.floor; return (<div key={gi} style={{ marginBottom: 16 }}>{showFloor && (<div style={{ ...floorHeadSt, marginTop: gi > 0 ? 10 : 0 }}>Floor {g.floor}</div>)}<div style={{ ...zoneSt, paddingLeft: g.floor ? 8 : 0 }}>{g.zone}</div>{g.tasks.map(task => { const done = completedTaskIds.has(task.id); const hasInfo = task.has_details || task.description || task.media_url; return (<div key={task.id} style={{ ...rowBase, background: done ? t.greenSubtle : t.card, border: done ? "1px solid " + t.greenBorder : "1px solid " + t.borderSolid, marginLeft: g.floor ? 8 : 0 }}><button onClick={() => toggleTask(task.id)} style={{ width: 22, height: 22, borderRadius: R.sm, border: "2px solid " + (done ? GREEN : t.textMut), background: done ? GREEN : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, cursor: "pointer", padding: 0 }}>{done && <CheckIco sz={12} c="#F8F7F4" />}</button><div onClick={() => hasInfo ? setDetail(task) : toggleTask(task.id)} style={{ flex: 1, cursor: "pointer" }}><div style={{ fontSize: 12, fontWeight: 500, textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1, display: "flex", alignItems: "center", gap: 5, color: t.text }}>{task.label}{hasInfo && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: BLUE, flexShrink: 0 }} />}</div></div><div style={{ display: "flex", gap: 4, flexShrink: 0, marginTop: 2 }}>{task.priority === "high" && <span style={chipPriority}>PRIORITY</span>}<span style={chipCat}>{task.cims_category}</span></div></div>); })}</div>); })}
    </div>
  );
}

function ChatView({ channels, messages, activeChannel, setActiveChannel, sendMessage, user, t, token }) {
  const [text, setText] = useState(""); const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  const siteChannels = channels.filter(c => c.type === "site" || c.type === "general");
  const dmChannel = channels.find(c => c.type === "admin_dm");
  const isDm = activeChannel && dmChannel && activeChannel === dmChannel.id;
  const handleSend = () => { if (!text.trim() || !activeChannel) return; sendMessage(activeChannel, text.trim()); setText(""); };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(var(--ocsa-vh, 100vh) - 128px)" }}>
      <div style={{ padding: "10px 12px 0", borderBottom: "1px solid " + t.borderSolid, paddingBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>{siteChannels.map(ch => (<button key={ch.id} onClick={() => setActiveChannel(ch.id)} style={{ padding: "6px 12px", borderRadius: R.pill, border: activeChannel === ch.id ? "1px solid " + t.goldBorder : "1px solid transparent", background: activeChannel === ch.id ? t.goldBg : "transparent", color: activeChannel === ch.id ? t.goldText : t.textMut, fontSize: 11, fontWeight: activeChannel === ch.id ? 700 : 500, fontFamily: FONT_HEAD, cursor: "pointer" }}>{ch.name || ch.siteName}</button>))}</div>
        {dmChannel && (<button onClick={() => setActiveChannel(dmChannel.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", borderRadius: R.md, background: isDm ? t.blueSubtle : t.hover, border: isDm ? "1.5px solid " + t.blueBorder : "1px solid " + t.borderSolid, boxShadow: isDm ? t.popShadow : t.shadow, cursor: "pointer", color: t.text, textAlign: "left" }}><LockIco c={isDm ? BLUE : t.textMut} /><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: isDm ? 700 : 600, color: isDm ? BLUE : t.textSec, fontFamily: FONT_HEAD }}>Admin (Private)</div><div style={{ fontSize: 9, color: t.textMut }}>Only you and management can see these messages</div></div>{dmChannel.unreadCount > 0 && <div style={{ background: RED, color: "#F8F7F4", fontSize: 9, fontWeight: 700, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{dmChannel.unreadCount}</div>}</button>)}
      </div>
      {isDm && (<div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: t.blueSubtle, borderBottom: "1px solid " + t.blueBorder, fontSize: 10, color: BLUE }}><LockIco /> Private conversation with admin.</div>)}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 0" }}>
        {!activeChannel && <div style={{ textAlign: "center", padding: "40px 20px" }}><ChatIco sz={32} c={t.borderSolid} /><div style={{ fontSize: 13, color: t.textMut, marginTop: 12, fontFamily: FONT_HEAD }}>Select a channel to start chatting.</div></div>}
        {activeChannel && messages.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", fontSize: 13, color: t.textMut, fontFamily: FONT_HEAD }}>No messages yet.</div>}
        {messages.map((msg, idx) => { const isMe = msg.senderId === user?.id; const isAdm = msg.senderRole === "admin" || msg.senderRole === "supervisor"; const showName = idx === 0 || messages[idx - 1].senderId !== msg.senderId; return (<div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, marginBottom: showName ? 12 : 4, alignItems: "flex-end" }}>{!isMe && showName && (<div style={{ width: 28, height: 28, borderRadius: "50%", background: isAdm ? (isDm ? "rgba(36,164,244,0.15)" : t.goldBg) : t.cardAlt, border: "1px solid " + (isAdm ? (isDm ? BLUE : GOLD) : t.borderSolid), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: isAdm ? (isDm ? BLUE : t.goldText) : t.textSec, flexShrink: 0, fontFamily: FONT_HEAD }}>{msg.senderName?.split(" ").map(n => n[0]).join("")}</div>)}{!isMe && !showName && <div style={{ width: 28, flexShrink: 0 }} />}<div style={{ maxWidth: "75%" }}>{!isMe && showName && <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3, color: isAdm ? (isDm ? BLUE : t.goldText) : t.textSec, fontFamily: FONT_HEAD }}>{msg.senderName}</div>}<div style={{ padding: "8px 12px", borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: isMe ? (isDm ? BLUE : GOLD) : (isDm && isAdm ? t.blueSubtle : t.card), border: isMe ? "none" : "1px solid " + (isDm && isAdm ? t.blueBorder : t.borderSolid), color: isMe ? (isDm ? "#F8F7F4" : NAVY) : t.text, fontSize: 13, lineHeight: 1.45 }}>{msg.text}</div><div style={{ fontSize: 9, color: t.textMut, marginTop: 2, textAlign: isMe ? "right" : "left", fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{formatTime(msg.sentAt)}</div></div></div>); })}
        <div ref={endRef} />
      </div>
      <div style={{ padding: "10px 12px", borderTop: "1px solid " + (isDm ? t.blueBorder : t.borderSolid), display: "flex", gap: 8, alignItems: "center", background: t.bg }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder={isDm ? "Private message to admin..." : "Type a message..."} style={{ flex: 1, padding: "10px 14px", borderRadius: R.pill, border: "1px solid " + (isDm ? t.blueBorder : t.borderSolid), background: t.card, color: t.text, fontSize: 13, outline: "none", fontFamily: FONT_BODY }} onKeyDown={e => e.key === "Enter" && handleSend()} />
        <button onClick={handleSend} style={{ width: 38, height: 38, borderRadius: "50%", background: text.trim() ? (isDm ? BLUE : GOLD) : t.cardAlt, border: "none", cursor: text.trim() ? "pointer" : "default", boxShadow: text.trim() && !isDm ? "0 6px 18px rgba(231,176,23,0.30)" : "none", display: "flex", alignItems: "center", justifyContent: "center" }}><SendIco sz={16} c={text.trim() ? (isDm ? "#F8F7F4" : NAVY) : t.textMut} /></button>
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
const agentDraftId = (d) => agentField(d, ["id", "formResponseId", "form_response_id"], null);
const agentName = (d) => agentField(d, ["formName", "formTitle", "form_name", "title", "formCode", "form_code"], "Report");
const agentCount = (d) => { const a = agentField(d, ["answered", "answeredCount", "answered_count"], null), r = agentField(d, ["remaining", "remainingCount", "remaining_count"], null); return (a !== null && r !== null) ? a + " of " + (Number(a) + Number(r)) + " answered" : null; };

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
              <span style={{ flexShrink: 0, fontWeight: 700 }}>{ln.number}.</span>
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

function AgentView({ token, showToast, t }) {
  const [drafts, setDrafts] = useState([]);
  const [conversationId, setConversationId] = useState(null);
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
        setPhotos(prev => prev.map(p => p.id === item.id ? { ...p, status: "failed", error: err.message } : p));
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
        setPhotoProblem(AGENT_PHOTO_UNREADABLE);
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
      setPhotos(prev => prev.map(x => x.id === id ? { ...x, status: "failed", error: err.message } : x));
    }
  };

  const loadDrafts = useCallback(async () => { try { const d = await api("/api/agent/drafts", { token }); setDrafts(agentList(d, ["drafts", "items", "rows"])); } catch (err) { console.warn("Drafts:", err.message); } }, [token]);
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
      const body = { text: msgText };
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
      setThread(prev => prev.map(m => m.id === msgId ? { ...m, pending: false, failed: true, error: err.message } : m));
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
        const h = await api("/api/agent/conversations/" + cid, { token });
        const list = agentList(h, ["messages", "turns", "history"]);
        setThread(list.map((m, i) => ({ id: "h" + i, role: String(agentField(m, ["role", "sender"], "assistant")).toLowerCase() === "user" ? "user" : "assistant", text: String(agentField(m, ["text", "content", "reply"], "")), citedDocs: agentList(agentField(m, ["citedDocs", "cited_doc_codes", "citedDocCodes"], []), []), degraded: agentField(m, ["degraded"], false) === true, noProcedure: agentField(m, ["noProcedure", "no_procedure"], false) === true })));
        setConversationId(cid);
      } catch (err) { showToast(err.message, "error"); }
    }
    taRef.current?.focus();
  };

  const submit = async () => {
    if (!formResponse || submitBusy) return;
    setSubmitBusy(true); setMissing([]);
    try { await api("/api/agent/drafts/" + formResponse.id + "/submit", { method: "POST", token }); setFormResponse(null); setSubmitted(true); loadDrafts(); }
    catch (err) { const b = err.body || {}; const keys = agentList(agentField(b, ["missing", "missingKeys", "missingFields", "missing_keys", "missing_fields"], []), []); setMissing(keys.length > 0 ? keys.map(agentKeyWords) : [err.message]); }
    setSubmitBusy(false);
  };

  const remaining = formResponse ? Number(formResponse.remaining) : 0;
  const canSubmit = !!formResponse && !submitBusy && !(remaining > 0);
  const openDrafts = drafts.filter(d => !formResponse || String(agentDraftId(d)) !== String(formResponse.id));
  const photosBusy = photos.some(p => p.status === "preparing" || p.status === "uploading");
  // A photo whose upload was refused holds the send until it is removed or
  // retried, so nobody sends a message believing that photo went with it.
  const photosBlocked = photos.some(p => p.status === "failed");
  const readyPhotoCount = photos.filter(p => p.status === "done" && p.path).length;
  const canSend = !sending && !photosBusy && !photosBlocked && (!!text.trim() || readyPhotoCount > 0);
  const photoLimitReached = photos.length >= AGENT_PHOTO_LIMIT;
  const smallBtn = { padding: "8px 14px", minHeight: 36, borderRadius: R.sm, border: "1px solid " + t.goldBorder, background: t.goldBg, color: t.goldText, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT_HEAD, flexShrink: 0 };
  // Pinned to the space between the header and the bottom navigation, so the
  // thread scrolls inside it and the form card and composer stay in view.
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: "0 0 auto", height: "calc(var(--ocsa-vh, 100vh) - 136px)", maxHeight: "calc(var(--ocsa-dvh, 100dvh) - 136px)", minHeight: 0, overflow: "hidden" }}>
      {openDrafts.length > 0 && (<div style={{ padding: "10px 12px", borderBottom: "1px solid " + t.borderSolid, flexShrink: 0, maxHeight: 180, overflowY: "auto" }}>
        <div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 6, fontFamily: FONT_HEAD }}>Unfinished reports</div>
        {openDrafts.map((d, i) => (<div key={agentDraftId(d) || i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 6, background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.md }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agentName(d)}</div>{agentCount(d) && <div style={{ fontSize: 11, color: t.textMut, marginTop: 2 }}>{agentCount(d)}</div>}</div><button onClick={() => resume(d)} style={smallBtn}>Resume</button></div>))}
      </div>)}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 12px 0" }}>
        {thread.length === 0 && (<div style={{ textAlign: "center", padding: "40px 20px" }}><HelpIco sz={32} c={t.borderSolid} /><div style={{ fontSize: 13, color: t.textMut, marginTop: 12, fontFamily: FONT_HEAD }}>Tell me what happened and I will tell you what to do.</div></div>)}
        {thread.map(m => { const isMe = m.role === "user"; return (<div key={m.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", marginBottom: 12 }}><div style={{ maxWidth: "85%" }}>
          <div style={{ padding: "8px 12px", borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: isMe ? GOLD : (m.noProcedure ? t.goldSubtle : t.card), border: isMe ? "none" : "1px solid " + (m.noProcedure ? t.goldBorder : t.borderSolid), color: isMe ? NAVY : t.text, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", opacity: m.pending ? 0.6 : 1 }}>
            {isMe && m.photoUrls && m.photoUrls.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: m.text ? 8 : 0 }}>
                {m.photoUrls.map((u, i) => <img key={i} src={u} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: R.sm, border: "1px solid rgba(10,22,40,0.25)" }} />)}
              </div>
            )}
            {isMe ? m.text : <AgentReply text={m.text} />}
          </div>
          {!isMe && m.citedDocs.length > 0 && <div style={{ fontSize: 10, color: t.textMut, marginTop: 3, fontFamily: FONT_HEAD }}>Based on {m.citedDocs.join(", ")}</div>}
          {!isMe && m.degraded && <div style={{ fontSize: 10, color: t.textMut, marginTop: 3 }}>Working from the written procedure only right now.</div>}
          {isMe && m.failed && <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 4 }}><span style={{ fontSize: 10, color: t.textMut }}>Not sent.{m.error ? " " + m.error : ""}</span><button onClick={() => send(m.id, m.text, m.photoPaths)} disabled={sending} style={{ ...smallBtn, padding: "6px 12px", minHeight: 32, fontSize: 11, opacity: sending ? 0.6 : 1 }}>Retry</button></div>}
        </div></div>); })}
        <div ref={endRef} />
      </div>
      {submitted && <div style={{ padding: "8px 12px", fontSize: 12, color: GREEN, fontWeight: 600, textAlign: "center", fontFamily: FONT_HEAD }}>Report submitted.</div>}
      {formResponse && (<div style={{ margin: "0 12px 8px", padding: "10px 12px", background: t.card, border: "1px solid " + t.goldBorder, borderRadius: R.md, boxShadow: t.shadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, fontFamily: FONT_HEAD }}>Report in progress</div><div style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, marginTop: 2 }}>{agentName(formResponse)}</div>{agentCount(formResponse) && <div style={{ fontSize: 11, color: t.textMut, marginTop: 2 }}>{agentCount(formResponse)}</div>}</div>
        <button onClick={submit} disabled={!canSubmit} style={{ padding: "10px 14px", minHeight: 40, flexShrink: 0, borderRadius: R.sm, border: "none", background: canSubmit ? "linear-gradient(135deg, " + GOLD + ", " + GOLD_LIGHT + ")" : t.cardAlt, color: canSubmit ? NAVY : t.textMut, fontSize: 12, fontWeight: 700, cursor: canSubmit ? "pointer" : "default", fontFamily: FONT_HEAD, boxShadow: canSubmit ? "0 6px 18px rgba(231,176,23,0.30)" : "none" }}>{submitBusy ? "Submitting..." : "Submit report"}</button></div>
        {missing.length > 0 && <div style={{ marginTop: 8, fontSize: 11, color: t.textSec, lineHeight: 1.5 }}><div style={{ fontWeight: 600 }}>Still needed before you can submit:</div>{missing.map((k, i) => <div key={i}>{k}</div>)}</div>}
      </div>)}
      {photos.length > 0 && (
        <div style={{ padding: "8px 12px 0", display: "flex", flexWrap: "wrap", gap: 10, flexShrink: 0 }}>
          {photos.map(p => (
            <div key={p.id} style={{ width: 96 }}>
              <div style={{ position: "relative", width: 72, height: 72 }}>
                {p.url
                  ? <img src={p.url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: R.sm, border: "1px solid " + t.borderSolid, opacity: p.status === "done" ? 1 : 0.6 }} />
                  : <div style={{ width: 72, height: 72, borderRadius: R.sm, border: "1px solid " + t.borderSolid, background: t.cardAlt }} />}
                <button onClick={() => removePhoto(p.id)} aria-label="Remove photo" style={{ position: "absolute", top: -10, right: -10, width: 44, height: 44, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: NAVY, color: "#F8F7F4", fontSize: 13, fontWeight: 700, lineHeight: "20px", textAlign: "center", border: "1px solid " + t.borderSolid }}>x</span>
                </button>
              </div>
              {p.status !== "done" && p.status !== "failed" && <div style={{ fontSize: 10, color: t.textMut, marginTop: 4 }}>Uploading...</div>}
              {p.status === "failed" && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: RED, lineHeight: 1.35 }}>{p.error}</div>
                  <button onClick={() => retryPhoto(p.id)} style={{ ...smallBtn, padding: "6px 10px", minHeight: 32, fontSize: 11, marginTop: 4 }}>Try again</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: "10px 12px", borderTop: "1px solid " + t.borderSolid, display: "flex", gap: 8, alignItems: "flex-end", background: t.bg }}>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => { addPhotoFiles(e.target.files); e.target.value = ""; }} />
        <button onClick={() => fileRef.current && fileRef.current.click()} disabled={photoLimitReached || sending} aria-label="Add a photo" title={photoLimitReached ? AGENT_PHOTO_LIMIT_TITLE : "Add a photo"} style={{ width: 44, height: 44, flexShrink: 0, borderRadius: "50%", background: t.cardAlt, border: "1px solid " + t.borderSolid, cursor: photoLimitReached || sending ? "default" : "pointer", opacity: photoLimitReached || sending ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><CamIco sz={18} c={t.textSec} /></button>
        <textarea ref={taRef} value={text} onChange={e => setText(e.target.value)} onPaste={e => { const items = e.clipboardData && e.clipboardData.items ? Array.from(e.clipboardData.items) : []; const files = items.filter(i => i.kind === "file" && i.type.indexOf("image/") === 0).map(i => i.getAsFile()).filter(Boolean); if (files.length > 0) { e.preventDefault(); addPhotoFiles(files); } }} disabled={sending} rows={1} placeholder="Describe what happened" aria-label="Describe what happened" style={{ ...inputSt, flex: 1, width: "auto", minWidth: 0, minHeight: 44, maxHeight: 120, overflowY: "auto", resize: "none", borderRadius: R.lg, lineHeight: 1.45, opacity: sending ? 0.6 : 1 }} />
        <button onClick={handleSend} disabled={!canSend} aria-label="Send" style={{ width: 44, height: 44, flexShrink: 0, borderRadius: "50%", background: canSend ? GOLD : t.cardAlt, border: "none", cursor: canSend ? "pointer" : "default", boxShadow: canSend ? "0 6px 18px rgba(231,176,23,0.30)" : "none", display: "flex", alignItems: "center", justifyContent: "center" }}><SendIco sz={16} c={canSend ? NAVY : t.textMut} /></button>
      </div>
      {photoProblem && <div style={{ padding: "0 12px 10px", fontSize: 11, color: RED, lineHeight: 1.4, flexShrink: 0 }}>{photoProblem}</div>}
    </div>
  );
}

function AssignedTasksView({ assignedTasks, resolveTask, showToast, t, token, lkColorMap }) {
  const [detail, setDetail] = useState(null); const [activePanel, setActivePanel] = useState(null);
  const [note, setNote] = useState(""); const [photo, setPhoto] = useState(null); const [photoPreview, setPhotoPreview] = useState(null); const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const lkPriColors = lkColorMap("task_priorities"); const lkSevColors = lkColorMap("issue_severities");
  const priC = Object.keys(lkPriColors).length > 0 ? lkPriColors : { critical: RED, high: ORANGE, standard: GOLD }; const sevC = Object.keys(lkSevColors).length > 0 ? lkSevColors : { low: GREEN, medium: ORANGE, high: RED };
  const inputSt = mkInput(t);
  const handlePhoto = (e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) { showToast("Photo must be under 10MB", "error"); return; } setPhoto(file); const reader = new FileReader(); reader.onload = (ev) => setPhotoPreview(ev.target.result); reader.readAsDataURL(file); };
  const clearForm = () => { setActivePanel(null); setNote(""); setPhoto(null); setPhotoPreview(null); if (fileRef.current) fileRef.current.value = ""; };
  const handleResolve = async (taskId) => { if (!note.trim()) { showToast("Describe what you did to complete this task", "error"); return; } if (!photo) { showToast("A photo of the completed task is required", "error"); return; } setUploading(true); try { const photoUrl = await uploadPhoto(photo, token); await resolveTask(taskId, "resolved", note.trim(), photoUrl); clearForm(); setDetail(null); } catch (err) { showToast(err.message, "error"); } setUploading(false); };
  const handleCantResolve = async (taskId) => { if (!note.trim()) { showToast("Please provide a reason", "error"); return; } await resolveTask(taskId, "unable_to_resolve", note.trim(), null); clearForm(); setDetail(null); };
  const getTaskInfo = (task) => { const isIssueLinked = !!task.source_issue_id; const title = isIssueLinked ? (task.issue_title || task.label) : task.label; const desc = isIssueLinked ? task.issue_description : task.description; const borderColor = isIssueLinked ? (sevC[task.severity] || ORANGE) : (priC[task.priority] || GOLD); const photoUrl = isIssueLinked ? task.issue_photo_url : (task.media_url || null); const mediaType = isIssueLinked ? "image" : (task.media_type || "image"); const assignedBy = isIssueLinked ? task.reported_by_name : task.created_by_name; const assignedByLabel = isIssueLinked ? "Reported by" : "Assigned by"; const locationParts = [task.site_name]; if (task.building_name) locationParts.push(task.building_name); if (task.floor_number) locationParts.push("Floor " + task.floor_number); locationParts.push(task.zone || (isIssueLinked ? task.issue_zone : null) || "General"); const locationStr = locationParts.filter(Boolean).join(" > "); return { isIssueLinked, title, desc, borderColor, photoUrl, mediaType, assignedBy, assignedByLabel, locationStr }; };

  if (assignedTasks.length === 0) return (<div style={{ padding: "16px" }}><div style={{ padding: "48px 24px", textAlign: "center", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, boxShadow: t.shadow }}><AlertIco sz={40} c={t.borderSolid} /><div style={{ fontSize: 15, color: t.textMut, marginTop: 16, fontFamily: FONT_HEAD }}>No assigned tasks right now.</div><div style={{ fontSize: 12, color: t.textMut, marginTop: 4 }}>When a supervisor assigns a task to you, it will appear here.</div></div></div>);

  if (detail) {
    const info = getTaskInfo(detail); const isResolving = activePanel === "resolve"; const isCantResolve = activePanel === "cantresolve";
    return (
      <div style={{ padding: "16px" }}>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
        <button onClick={() => { setDetail(null); clearForm(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", marginBottom: 14, background: "none", border: "1px solid " + t.borderSolid, borderRadius: R.sm, color: t.textSec, fontSize: 12, cursor: "pointer", fontFamily: FONT_HEAD }}><Ico d="M15 18l-6-6 6-6" sz={14} c={t.textSec} /> Back to assigned tasks</button>
        <div style={{ background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.lg, borderLeft: "3px solid " + info.borderColor, overflow: "hidden", boxShadow: t.popShadow }}>
          <div style={{ padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}><div style={{ fontSize: 16, fontWeight: 700, flex: 1, color: t.text, fontFamily: FONT_HEAD }}>{info.title}</div><div style={{ display: "flex", gap: 4, flexShrink: 0 }}>{info.isIssueLinked && detail.severity && <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "2px 7px", borderRadius: R.sm, background: (sevC[detail.severity] || ORANGE) + "18", color: sevC[detail.severity] || ORANGE, fontFamily: FONT_HEAD }}>{detail.severity}</span>}{!info.isIssueLinked && detail.priority && detail.priority !== "standard" && <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "2px 7px", borderRadius: R.sm, background: (priC[detail.priority] || GOLD) + "18", color: priC[detail.priority] || t.goldText, fontFamily: FONT_HEAD }}>{detail.priority}</span>}{info.isIssueLinked && <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: R.sm, background: "rgba(231,76,60,0.1)", color: RED, fontFamily: FONT_HEAD }}>ISSUE</span>}</div></div>
            <div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12, fontFamily: FONT_HEAD, fontWeight: 700 }}>{info.locationStr}</div>
            {detail.resolution_status && (<div style={{ marginBottom: 12 }}><span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "3px 8px", borderRadius: R.sm, background: detail.resolution_status === "in_progress" ? ORANGE + "18" : GOLD + "18", color: detail.resolution_status === "in_progress" ? ORANGE : t.goldText, fontFamily: FONT_HEAD }}>{detail.resolution_status.replace(/_/g, " ")}</span></div>)}
            {info.desc && (<div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 6, fontFamily: FONT_HEAD }}>Description</div><div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{info.desc}</div></div>)}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}><div><div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, fontFamily: FONT_HEAD, marginBottom: 3 }}>{info.assignedByLabel}</div><div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{info.assignedBy}</div></div><div><div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, fontFamily: FONT_HEAD, marginBottom: 3 }}>Site</div><div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{detail.site_name}</div></div>{detail.due_date && <div><div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, fontFamily: FONT_HEAD, marginBottom: 3 }}>Due Date</div><div style={{ fontSize: 13, color: ORANGE, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{new Date(detail.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{detail.due_time ? " at " + detail.due_time : ""}</div></div>}{detail.task_created_at && <div><div style={{ fontSize: 9, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, fontFamily: FONT_HEAD, marginBottom: 3 }}>Assigned</div><div style={{ fontSize: 13, color: t.text, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{new Date(detail.task_created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div></div>}</div>
            {info.photoUrl && (<div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 6, fontFamily: FONT_HEAD }}>{info.mediaType === "video" ? "Attached Video" : "Attached Photo"}</div>{info.mediaType === "video" ? (<video src={info.photoUrl} controls style={{ width: "100%", borderRadius: R.md, maxHeight: 240 }} />) : (<img src={info.photoUrl} alt="Task" style={{ width: "100%", borderRadius: R.md, maxHeight: 200, objectFit: "cover", border: "1px solid " + t.borderSolid }} />)}</div>)}
            {!isResolving && !isCantResolve && (<div style={{ display: "flex", gap: 6, marginTop: 10 }}>{detail.resolution_status !== "in_progress" && (<button onClick={() => { resolveTask(detail.task_id, "in_progress", null, null); setDetail(null); }} style={{ flex: 1, padding: "10px", borderRadius: R.sm, border: "1px solid " + ORANGE, background: "transparent", color: ORANGE, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>In Progress</button>)}<button onClick={() => { clearForm(); setActivePanel("resolve"); }} style={{ flex: 1, padding: "10px", borderRadius: R.sm, border: "1px solid " + GREEN, background: "transparent", color: GREEN, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>Resolved</button><button onClick={() => { clearForm(); setActivePanel("cantresolve"); }} style={{ flex: 1, padding: "10px", borderRadius: R.sm, border: "1px solid " + RED, background: "transparent", color: RED, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>Cannot Resolve</button></div>)}
          </div>
          {isResolving && (<div style={{ padding: "12px 14px", borderTop: "1px solid " + t.borderSolid, background: t.greenSubtle }}>
            <div style={{ fontSize: 10, color: GREEN, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8, fontFamily: FONT_HEAD }}>Mark as Resolved</div>
            <div style={{ marginBottom: 8 }}><div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 4, fontFamily: FONT_HEAD }}>What did you do to complete this? *</div><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Describe the steps you took..." rows={3} style={{ ...inputSt, resize: "vertical" }} /></div>
            <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 4, fontFamily: FONT_HEAD }}>Photo of completed task *</div>{!photoPreview ? (<button onClick={() => fileRef.current?.click()} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px", background: t.hover, border: "1px dashed " + GREEN, borderRadius: R.md, cursor: "pointer", color: GREEN, fontSize: 12, fontWeight: 600 }}><CamIco sz={18} c={GREEN} /><div style={{ textAlign: "left" }}><div>Take Photo of Completed Task</div><div style={{ fontSize: 10, color: t.textMut, fontWeight: 400, marginTop: 2 }}>Required to verify completion</div></div></button>) : (<div style={{ position: "relative" }}><img src={photoPreview} alt="Preview" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: R.md, border: "1px solid " + t.borderSolid }} /><button onClick={() => { setPhoto(null); setPhotoPreview(null); if (fileRef.current) fileRef.current.value = ""; }} style={{ position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", color: "#F8F7F4", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>x</button></div>)}</div>
            <div style={{ display: "flex", gap: 8 }}><button onClick={() => setActivePanel(null)} style={{ flex: 1, padding: "10px", borderRadius: R.sm, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec, fontSize: 12, cursor: "pointer", fontFamily: FONT_HEAD }}>Cancel</button><button onClick={() => handleResolve(detail.task_id)} disabled={uploading} style={{ flex: 1, padding: "10px", borderRadius: R.md, border: "none", background: GREEN, color: "#F8F7F4", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT_HEAD, opacity: uploading ? 0.6 : 1 }}>{uploading ? "Uploading..." : "Submit Resolution"}</button></div>
          </div>)}
          {isCantResolve && (<div style={{ padding: "12px 14px", borderTop: "1px solid " + t.borderSolid, background: t.redSubtle }}>
            <div style={{ fontSize: 10, color: RED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8, fontFamily: FONT_HEAD }}>Explain why this cannot be completed *</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Describe the issue preventing completion..." rows={3} style={{ ...inputSt, resize: "vertical", marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8 }}><button onClick={() => setActivePanel(null)} style={{ flex: 1, padding: "10px", borderRadius: R.sm, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec, fontSize: 12, cursor: "pointer", fontFamily: FONT_HEAD }}>Cancel</button><button onClick={() => handleCantResolve(detail.task_id)} style={{ flex: 1, padding: "10px", borderRadius: R.md, border: "none", background: RED, color: "#F8F7F4", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT_HEAD }}>Submit</button></div>
          </div>)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px" }}>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
      <div style={{ marginBottom: 14 }}><div style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: FONT_HEAD }}>Assigned Tasks</div><div style={{ fontSize: 11, color: t.textSec }}>{assignedTasks.length} task{assignedTasks.length !== 1 ? "s" : ""} assigned to you</div></div>
      {assignedTasks.map(task => { const info = getTaskInfo(task); return (<div key={task.task_id} onClick={() => setDetail(task)} style={{ marginBottom: 10, background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.md, borderLeft: "3px solid " + info.borderColor, overflow: "hidden", cursor: "pointer", boxShadow: t.shadow }}><div style={{ padding: "12px 14px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{info.title}</div>{info.desc && <div style={{ fontSize: 11, color: t.textSec, marginTop: 4, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{info.desc}</div>}</div><div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8, alignItems: "center" }}>{info.isIssueLinked && <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: R.sm, background: "rgba(231,76,60,0.1)", color: RED, fontFamily: FONT_HEAD }}>ISSUE</span>}{!info.isIssueLinked && task.priority && task.priority !== "standard" && <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "2px 7px", borderRadius: R.sm, background: (priC[task.priority] || GOLD) + "18", color: priC[task.priority] || t.goldText, fontFamily: FONT_HEAD }}>{task.priority}</span>}<Ico d="M9 18l6-6-6-6" sz={14} c={t.textMut} /></div></div><div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 10, color: t.textMut, flexWrap: "wrap", alignItems: "center" }}><span>{info.locationStr}</span><span>{info.assignedByLabel} {info.assignedBy}</span>{task.resolution_status === "in_progress" && <span style={{ fontSize: 9, fontWeight: 600, color: ORANGE, textTransform: "uppercase" }}>In Progress</span>}</div>{task.due_date && (<div style={{ marginTop: 6, fontSize: 10, color: ORANGE, fontVariantNumeric: "tabular-nums" }}>Due: {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{task.due_time ? " at " + task.due_time : ""}</div>)}</div></div>); })}
    </div>
  );
}

function IssuesView({ clockStatus, issues, submitIssue, showToast, user, sites, t, token, getOpts, lkColorMap }) {
  const [showForm, setShowForm] = useState(false); const [title, setTitle] = useState(""); const [desc, setDesc] = useState("");
  const [sev, setSev] = useState("medium"); const [zone, setZone] = useState(""); const [selSite, setSelSite] = useState("");
  const [photo, setPhoto] = useState(null); const [photoPreview, setPhotoPreview] = useState(null); const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const labelSt = mkLabel(t); const inputSt = mkInput(t);
  const sevOpts = getOpts("issue_severities");
  const sevColors = lkColorMap("issue_severities");
  const sevs = sevOpts.length > 0 ? sevOpts.map(o => ({ v: o.v, l: o.l, c: sevColors[o.v] || ORANGE })) : [{ v: "low", l: "Low", c: GREEN }, { v: "medium", l: "Med", c: ORANGE }, { v: "high", l: "High", c: RED }];
  const isAdmin = user?.role === "admin" || user?.role === "supervisor";
  const visibleIssues = isAdmin ? issues : issues.filter(i => i.reported_by === user?.id);
  const sevC = Object.keys(sevColors).length > 0 ? sevColors : { low: GREEN, medium: ORANGE, high: RED };
  const handlePhoto = (e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) { showToast("Photo must be under 10MB", "error"); return; } setPhoto(file); const reader = new FileReader(); reader.onload = (ev) => setPhotoPreview(ev.target.result); reader.readAsDataURL(file); };
  const removePhoto = () => { setPhoto(null); setPhotoPreview(null); if (fileRef.current) fileRef.current.value = ""; };
  const handleSubmit = async () => { if (!title.trim()) { showToast("Enter issue title", "error"); return; } const siteId = clockStatus?.clockedIn ? clockStatus.shift.siteId : selSite; if (!siteId) { showToast("Select a site", "error"); return; } setUploading(true); try { let photoUrl = null; if (photo) { photoUrl = await uploadPhoto(photo, token); } await submitIssue(title.trim(), desc.trim(), zone.trim(), sev, photoUrl, siteId); setTitle(""); setDesc(""); setZone(""); setSev("medium"); setPhoto(null); setPhotoPreview(null); setShowForm(false); } catch (err) { showToast(err.message, "error"); } setUploading(false); };
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: FONT_HEAD }}>{isAdmin ? "Issues" : "Report an Issue"}</div>{isAdmin && <button onClick={() => setShowForm(!showForm)} style={{ padding: "7px 13px", borderRadius: R.sm, border: showForm ? "1px solid " + t.borderSolid : "none", background: showForm ? t.cardAlt : GOLD, color: showForm ? t.text : NAVY, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT_HEAD }}>{showForm ? "Cancel" : "+ Report"}</button>}</div>
      {(showForm || !isAdmin) && (<div style={{ padding: 14, marginBottom: 14, background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.lg, animation: "fadeIn 0.3s ease", boxShadow: t.popShadow }}>
        {!clockStatus?.clockedIn && sites && sites.length > 0 && (<div style={{ marginBottom: 10 }}><label style={labelSt}>Site</label><select value={selSite} onChange={e => setSelSite(e.target.value)} style={inputSt}><option value="">Select site...</option>{sites.map(s => <option key={s.siteId} value={s.siteId}>{s.siteName}</option>)}</select></div>)}
        <div style={{ marginBottom: 10 }}><label style={labelSt}>Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief description" style={inputSt} /></div>
        <div style={{ marginBottom: 10 }}><label style={labelSt}>Details</label><textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Additional details..." rows={3} style={{ ...inputSt, resize: "vertical", fontFamily: "inherit" }} /></div>
        <div style={{ marginBottom: 10 }}><label style={labelSt}>Zone</label><input value={zone} onChange={e => setZone(e.target.value)} placeholder="e.g. Restroom, Lobby" style={inputSt} /></div>
        <div style={{ marginBottom: 14 }}><label style={labelSt}>Severity</label><div style={{ display: "flex", gap: 6 }}>{sevs.map(s => (<button key={s.v} onClick={() => setSev(s.v)} style={{ flex: 1, padding: "9px", borderRadius: R.sm, border: sev === s.v ? "2px solid " + s.c : "1px solid " + t.borderSolid, background: sev === s.v ? s.c + "1A" : "transparent", cursor: "pointer", color: s.c, fontSize: 12, fontWeight: 700, textAlign: "center", fontFamily: FONT_HEAD, letterSpacing: "0.3px" }}>{s.l}</button>))}</div></div>
        <div style={{ marginBottom: 14 }}><label style={labelSt}>Photo</label><input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />{!photoPreview ? (<button onClick={() => fileRef.current?.click()} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px", background: t.hover, border: "1px dashed " + GOLD, borderRadius: R.sm, cursor: "pointer", color: t.goldText, fontSize: 12, fontWeight: 600 }}><CamIco sz={18} c={t.goldText} /><div style={{ textAlign: "left" }}><div>Take Photo or Choose from Gallery</div><div style={{ fontSize: 10, color: t.textMut, fontWeight: 400, marginTop: 2 }}>JPG, PNG up to 10MB</div></div></button>) : (<div style={{ position: "relative" }}><img src={photoPreview} alt="Preview" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: R.sm, border: "1px solid " + t.borderSolid }} /><button onClick={removePhoto} style={{ position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", color: "#F8F7F4", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>x</button><div style={{ fontSize: 10, color: GREEN, marginTop: 4 }}>Photo attached: {photo?.name}</div></div>)}</div>
        <button onClick={handleSubmit} disabled={uploading} style={{ width: "100%", padding: "13px", borderRadius: R.md, border: "none", background: "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")", color: NAVY, fontSize: 13, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "1px", fontFamily: FONT_HEAD, boxShadow: "0 6px 18px rgba(231,176,23,0.30)", opacity: uploading ? 0.6 : 1 }}>{uploading ? "Uploading..." : "Submit Issue"}</button>
      </div>)}
      {isAdmin && visibleIssues.length === 0 && !showForm && <div style={{ padding: "32px 20px", textAlign: "center", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, fontSize: 13, color: t.textMut, boxShadow: t.shadow }}>No issues reported yet.</div>}
      {isAdmin && visibleIssues.map(issue => { const sc = sevC[issue.severity] || ORANGE; return (<div key={issue.id} style={{ padding: "12px", marginBottom: 8, background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.md, borderLeft: "3px solid " + sc, boxShadow: t.shadow }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}><div style={{ fontSize: 13, fontWeight: 600, flex: 1, color: t.text, fontFamily: FONT_HEAD }}>{issue.title}</div><span style={{ fontSize: 9, color: sc, background: sc + "20", padding: "3px 7px", borderRadius: R.sm, fontWeight: 700, textTransform: "uppercase", fontFamily: FONT_HEAD, letterSpacing: "0.5px", flexShrink: 0 }}>{issue.severity}</span></div><div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 9, color: t.textMut }}><span>{issue.zone}</span><span>{issue.site_name}</span><span style={{ color: issue.status === "open" ? ORANGE : GREEN, fontWeight: 700, textTransform: "uppercase", fontFamily: FONT_HEAD, letterSpacing: "0.5px" }}>{issue.status}</span></div></div>); })}
    </div>
  );
}

function SuppliesView({ clockStatus, supplies, supplyLogs, logSupplyUsage, submitRequest, showToast, t, getOpts, lkColorMap }) {
  const [scanning, setScanning] = useState(null); const [qty, setQty] = useState(1); const [reqForm, setReqForm] = useState(null);
  const labelSt = mkLabel(t); const inputSt = mkInput(t); const qtyBtn = mkQtyBtn(t);
  const handleSubmitReq = () => { if (!reqForm.type) { showToast("Select a request type", "error"); return; } if ((reqForm.type === "new_gear" || reqForm.type === "new_supply") && !reqForm.itemName) { showToast("Enter the item name", "error"); return; } submitRequest(reqForm.type, reqForm.itemName, reqForm.description, reqForm.urgency, reqForm.supplyId); setReqForm(null); };

  const reqFormUI = reqForm && (
    <div style={{ padding: 14, marginBottom: 14, background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.lg, boxShadow: t.popShadow }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: t.text, fontFamily: FONT_HEAD }}>Supply/Gear Request</div>
      <div style={{ marginBottom: 10 }}><label style={labelSt}>Request Type</label><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(getOpts("request_types").length > 0 ? getOpts("request_types") : [{ v: "refill", l: "Refill" }, { v: "damage_report", l: "Damage Report" }, { v: "new_gear", l: "New Gear" }, { v: "new_supply", l: "New Supply" }]).map(tp => (<button key={tp.v} onClick={() => setReqForm({ ...reqForm, type: tp.v })} style={{ padding: "7px 11px", borderRadius: R.sm, border: reqForm.type === tp.v ? "2px solid " + GOLD : "1px solid " + t.borderSolid, background: reqForm.type === tp.v ? t.goldBg : "transparent", color: reqForm.type === tp.v ? t.goldText : t.textSec, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT_HEAD }}>{tp.l}</button>))}</div></div>
      {(reqForm.type === "refill" || reqForm.type === "damage_report") && supplies.length > 0 && (<div style={{ marginBottom: 10 }}><label style={labelSt}>Supply Item</label><select value={reqForm.supplyId || ""} onChange={e => setReqForm({ ...reqForm, supplyId: e.target.value || null, itemName: supplies.find(s => s.id === e.target.value)?.name || "" })} style={inputSt}><option value="">Select supply...</option>{supplies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>)}
      {(reqForm.type === "new_gear" || reqForm.type === "new_supply") && (<div style={{ marginBottom: 10 }}><label style={labelSt}>Item Name</label><input value={reqForm.itemName} onChange={e => setReqForm({ ...reqForm, itemName: e.target.value })} placeholder="What do you need?" style={inputSt} /></div>)}
      <div style={{ marginBottom: 10 }}><label style={labelSt}>Details</label><textarea value={reqForm.description} onChange={e => setReqForm({ ...reqForm, description: e.target.value })} placeholder="Describe the request..." rows={2} style={{ ...inputSt, resize: "vertical", fontFamily: "inherit" }} /></div>
      <div style={{ marginBottom: 12 }}><label style={labelSt}>Urgency</label><div style={{ display: "flex", gap: 6 }}>{(() => { const urgOpts = getOpts("urgency_levels"); const urgColors = lkColorMap("urgency_levels"); const items = urgOpts.length > 0 ? urgOpts.map(o => ({ v: o.v, l: o.l, c: urgColors[o.v] || t.textSec })) : [{ v: "low", l: "Low", c: GREEN }, { v: "normal", l: "Normal", c: t.textSec }, { v: "high", l: "High", c: ORANGE }, { v: "urgent", l: "Urgent", c: RED }]; return items.map(u => (<button key={u.v} onClick={() => setReqForm({ ...reqForm, urgency: u.v })} style={{ flex: 1, padding: "7px", borderRadius: R.sm, border: reqForm.urgency === u.v ? "2px solid " + u.c : "1px solid " + t.borderSolid, background: reqForm.urgency === u.v ? u.c + "1A" : "transparent", color: u.c, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: FONT_HEAD }}>{u.l}</button>)); })()}</div></div>
      <div style={{ display: "flex", gap: 8 }}><button onClick={() => setReqForm(null)} style={{ flex: 1, padding: "11px", borderRadius: R.sm, border: "1px solid " + t.borderSolid, background: "transparent", color: t.textSec, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>Cancel</button><button onClick={handleSubmitReq} style={{ flex: 1, padding: "11px", borderRadius: R.sm, border: "none", background: "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")", color: NAVY, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT_HEAD, boxShadow: "0 6px 18px rgba(231,176,23,0.30)" }}>Submit Request</button></div>
    </div>
  );

  if (!clockStatus?.clockedIn) return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div><div style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: FONT_HEAD }}>Supplies</div><div style={{ fontSize: 11, color: t.textSec }}>Start your shift to log usage. Requests can be submitted anytime.</div></div><button onClick={() => setReqForm({ type: "", itemName: "", description: "", urgency: "normal", supplyId: null })} style={{ padding: "7px 13px", borderRadius: R.sm, border: "none", background: GOLD, color: NAVY, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT_HEAD }}>+ Request</button></div>
      {reqFormUI}
    </div>
  );

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div><div style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: FONT_HEAD }}>Supply Tracking</div><div style={{ fontSize: 11, color: t.textSec }}>Log usage or submit a request</div></div><button onClick={() => setReqForm({ type: "", itemName: "", description: "", urgency: "normal", supplyId: null })} style={{ padding: "7px 13px", borderRadius: R.sm, border: "none", background: GOLD, color: NAVY, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT_HEAD }}>+ Request</button></div>
      {reqFormUI}
      {supplies.map(sup => { const isOpen = scanning === sup.id; const isLow = sup.is_low || (sup.site_stock !== undefined && sup.site_stock <= sup.site_threshold); return (<div key={sup.id} style={{ marginBottom: 6 }}><button onClick={() => { setScanning(isOpen ? null : sup.id); setQty(1); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: isOpen ? t.goldBg : t.hover, border: isOpen ? "1.5px solid " + GOLD : "1px solid " + t.borderSolid, borderRadius: isOpen ? (R.md + "px " + R.md + "px 0 0") : R.md, cursor: "pointer", color: t.text, textAlign: "left", boxShadow: t.shadow }}><div style={{ width: 34, height: 34, borderRadius: R.sm, background: t.cardAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: t.textMut, fontFamily: "monospace" }}>QR</div><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT_HEAD }}>{sup.name}</div><div style={{ display: "flex", gap: 6, marginTop: 2, fontSize: 9 }}><span style={{ color: t.textMut }}>{sup.qr_code}</span>{isLow && <span style={{ color: ORANGE, fontWeight: 600 }}>LOW</span>}</div></div><ChevIco sz={14} c={t.textMut} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "0.2s" }} /></button>{isOpen && (<div style={{ padding: "12px", background: t.card, border: "1.5px solid " + GOLD, borderTop: "none", borderRadius: "0 0 " + R.md + "px " + R.md + "px" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 12 }}><button onClick={() => setQty(Math.max(1, qty - 1))} style={qtyBtn}><MinusIco sz={14} /></button><div style={{ textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 700, color: t.goldText, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{qty}</div><div style={{ fontSize: 10, color: t.textMut }}>{sup.unit}</div></div><button onClick={() => setQty(qty + 1)} style={qtyBtn}><PlusIco sz={14} /></button></div><button onClick={() => { logSupplyUsage(sup.id, qty); setScanning(null); setQty(1); }} style={{ width: "100%", padding: "11px", borderRadius: R.md, border: "none", background: "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")", color: NAVY, fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: FONT_HEAD, boxShadow: "0 6px 18px rgba(231,176,23,0.30)" }}>Log Usage</button></div>)}</div>); })}
      {supplyLogs.length > 0 && (<div style={{ marginTop: 18 }}><label style={{ ...labelSt, display: "block", marginBottom: 8 }}>This Shift's Log</label>{supplyLogs.map((log, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", marginBottom: 3, background: t.hover, borderRadius: R.sm, fontSize: 11 }}><span style={{ fontWeight: 600, color: t.text }}>{log.supply_name || "Item"} <span style={{ color: t.textMut, fontWeight: 400 }}>{log.quantity} {log.unit}</span></span><span style={{ color: t.textMut, fontSize: 9 }}>{formatTime(log.loggedAt || log.scanned_at)}</span></div>))}</div>)}
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
const CASE_MAX_TEXT = CASE_MAX.toLocaleString("en-US");
function SpeakUpView({ token, t }) {
  const [text, setText] = useState("");
  // "" is nobody in particular and sends no subject_user_id.
  const [subjectId, setSubjectId] = useState("");
  // Three states. null is loading: the choice is not drawn yet. An
  // array is loaded: an empty one hides the choice and the form still
  // sends, which is a correct state. listFailed is the third: the
  // request did not come back, the choice cannot be offered, and the
  // screen says so where the choice would be, with a way to try again.
  // A failure is never read as an empty list, because a report about
  // a manager sent with no name goes to that manager.
  const [subjects, setSubjects] = useState(null);
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
  useEffect(() => { let live = true; setSubjects(null); setListFailed(false); api("/api/contacts/case-subjects", { token }).then(d => { if (live) setSubjects(Array.isArray(d?.subjects) ? d.subjects : []); }).catch(() => { if (live) setListFailed(true); }); return () => { live = false; }; }, [token, attempt]);
  const labelSt = mkLabel(t);
  const inputSt = mkInput(t);
  const helpSt = mkHelp(t);
  const nearLimit = text.length >= CASE_MAX - 200;
  const canSend = text.trim().length > 0 && !sending;
  const send = async () => {
    if (!canSend || inFlight.current) return;
    inFlight.current = true; setSending(true); setProblem(null);
    const body = { summary: text.trim() };
    if (subjectId) body.subject_user_id = subjectId;
    try {
      const data = await api("/api/hr-cases", { method: "POST", body, token });
      setText(""); setSubjectId("");
      setSent({ id: data && data.id ? String(data.id) : "" });
    } catch (err) {
      // 503 carries the API's own sentence, which names nobody. Every
      // other failure gets plain words. Never the raw body, never a code.
      const own = err && err.status === 503 && typeof err.message === "string" && err.message.trim() ? err.message.trim() : null;
      setProblem("Your report was not sent. " + (own || "Please try again."));
    } finally { inFlight.current = false; setSending(false); }
  };
  const choices = subjects && subjects.length > 0 ? [{ id: "", name: "A co-worker, or no one in particular", title: null }, ...subjects] : [];
  if (sent) return (
    <div style={{ padding: "16px" }}>
      <div style={{ padding: "28px 20px", textAlign: "center", background: t.card, border: "1px solid " + t.goldBorder, borderRadius: R.lg, boxShadow: t.popShadow }}>
        <CheckIco sz={40} c={GREEN} />
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginTop: 14, fontFamily: FONT_HEAD }}>We got your report.</div>
        <div style={{ fontSize: 13, color: t.textSec, marginTop: 8, lineHeight: 1.6 }}>Someone will be in touch with you within 72 hours.</div>
        {sent.id && (<div style={{ marginTop: 20 }}><div style={labelSt}>Your reference</div><div style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, wordBreak: "break-all" }}>{sent.id}</div><div style={helpSt}>Quote this if you follow up.</div></div>)}
      </div>
    </div>
  );
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: FONT_HEAD }}>Report a problem with someone</div>
        <div style={{ fontSize: 12, color: t.textSec, marginTop: 4, lineHeight: 1.5 }}>Nothing you write here is kept. If you leave this screen before you send, it is gone.</div>
      </div>
      <div style={{ padding: 14, background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.lg, boxShadow: t.popShadow }}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>What happened</label>
          <textarea value={text} onChange={e => setText(e.target.value.slice(0, CASE_MAX))} maxLength={CASE_MAX} disabled={sending} placeholder="Write what happened in your own words. One sentence is enough." rows={6} style={{ ...inputSt, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
          <div style={{ ...helpSt, color: nearLimit ? ORANGE : t.textMut }}>{nearLimit ? text.length.toLocaleString("en-US") + " of " + CASE_MAX_TEXT + " characters used." : "You can write up to " + CASE_MAX_TEXT + " characters."}</div>
        </div>
        {listFailed && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Who is it about</label>
            <div style={{ padding: "10px 12px", background: t.orangeSubtle, border: "1px solid " + t.orangeBorder, borderRadius: R.sm, fontSize: 12, color: ORANGE, lineHeight: 1.5 }}>The list of names did not load. If your report is about a manager, try again before you send, so it does not go to them.</div>
            <button onClick={() => setAttempt(a => a + 1)} disabled={sending} style={{ ...mkGhostBtn(t), marginTop: 8 }}>Try again</button>
          </div>
        )}
        {choices.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Who is it about</label>
            <div style={{ ...helpSt, marginTop: 0, marginBottom: 8 }}>If it is about one of the people named here, pick their name so your report does not go to them.</div>
            {choices.map(p => { const picked = subjectId === p.id; return (
              <button key={p.id || "nobody"} onClick={() => setSubjectId(p.id)} disabled={sending} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 8, background: picked ? t.goldBg : t.card, border: picked ? "1.5px solid " + GOLD : "1px solid " + t.borderSolid, borderRadius: R.md, cursor: "pointer", color: t.text, textAlign: "left" }}>
                <div style={{ width: 18, height: 18, flexShrink: 0, borderRadius: "50%", background: picked ? GOLD : "transparent", border: picked ? "none" : "2px solid " + t.borderSolid }} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>{p.title && <div style={{ fontSize: 10, color: t.textSec, marginTop: 2 }}>{p.title}</div>}</div>
              </button>
            ); })}
          </div>
        )}
        {problem && <div style={{ padding: "10px 12px", marginBottom: 12, background: t.redSubtle, border: "1px solid " + t.redBorder, borderRadius: R.sm, fontSize: 12, color: RED, lineHeight: 1.5 }}>{problem}</div>}
        <button onClick={send} disabled={!canSend} style={{ ...mkPrimaryBtn(t, !canSend), cursor: canSend ? "pointer" : "default" }}>{sending ? "Sending..." : "Send"}</button>
      </div>
    </div>
  );
}

// The shortcuts editor. Home and More are shown in their places and cannot
// be moved. The four between them are the person's, and every destination
// not on the bar is listed under More, so nothing can be lost here. The
// draft lives in this component, so closing without Done changes nothing.
function ShortcutsSheet({ t, choices, current, ctx, onSave, onClose }) {
  const [draft, setDraft] = useState(() => {
    const ids = (current || []).slice(0, SHORTCUT_SLOTS);
    while (ids.length < SHORTCUT_SLOTS) ids.push(null);
    return ids;
  });
  // The id waiting to go on a full bar, until the person says which of the
  // four it replaces.
  const [replacing, setReplacing] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const nameOf = (id) => { const d = destById(id); return d ? d.label(ctx) : ""; };
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
  const sectionSt = { fontSize: 10, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, margin: "16px 0 8px", fontFamily: FONT_HEAD };
  const rowSt = { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", marginBottom: 6, background: t.card, border: "1px solid " + t.borderSolid, borderRadius: R.md };
  const nameSt = { flex: 1, minWidth: 0, fontSize: 14, color: t.text, fontFamily: FONT_HEAD, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
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
            <span style={{ fontSize: 8, color: t.textMut, letterSpacing: "0.3px", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{id ? nameOf(id) : "-"}</span>
          </div>
        );
      })}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 0, padding: "0 2px" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.textMut} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
        <span style={{ fontSize: 8, color: t.textMut, letterSpacing: "0.3px" }}>More</span>
      </div>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.modalOverlay, zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.bg, width: "100%", maxWidth: 560, height: "var(--ocsa-vh, 100vh)", maxHeight: "var(--ocsa-dvh, 100dvh)", display: "flex", flexDirection: "column", borderTop: "1px solid " + t.borderSolid }}>
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid " + t.borderSolid, flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: FONT_HEAD, marginBottom: 10 }}>Shortcuts</div>
          {PreviewBar}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 16px 16px" }}>
          <div style={sectionSt}>On your bar</div>
          <div style={fixedSt}>
            <HomeIco sz={18} c={t.textMut} />
            <span style={nameSt}>Home</span>
            <span style={{ fontSize: 10, color: t.textMut, flexShrink: 0 }}>Always first</span>
          </div>
          {draft.map((id, i) => {
            if (!id) {
              return (
                <div key={"empty" + i} style={{ ...rowSt, border: "1px dashed " + ORANGE }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: "1px dashed " + ORANGE, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: ORANGE }}>{SHORTCUTS_EMPTY_SLOT}</span>
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
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={"Move up " + name} style={{ ...rowBtn, flex: 1, opacity: i === 0 ? 0.4 : 1 }}>Move up</button>
                  <button onClick={() => move(i, 1)} disabled={i === SHORTCUT_SLOTS - 1} aria-label={"Move down " + name} style={{ ...rowBtn, flex: 1, opacity: i === SHORTCUT_SLOTS - 1 ? 0.4 : 1 }}>Move down</button>
                  <button onClick={() => removeAt(i)} aria-label={"Remove " + name} style={{ ...rowBtn, flex: 1, color: RED, borderColor: RED }}>Remove</button>
                </div>
              </div>
            );
          })}
          <div style={fixedSt}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.textMut} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
            <span style={nameSt}>More</span>
            <span style={{ fontSize: 10, color: t.textMut, flexShrink: 0 }}>Always last</span>
          </div>

          <div style={sectionSt}>Under More</div>
          {under.length === 0 && <div style={{ fontSize: 12, color: t.textMut, padding: "4px 2px" }}>Everything is on your bar.</div>}
          {under.map(d => {
            const Ic = d.icon;
            const name = d.label(ctx);
            return (
              <div key={d.id} style={rowSt}>
                <Ic sz={18} c={t.textSec} />
                <span style={nameSt}>{name}</span>
                <button onClick={() => addToBar(d.id)} aria-label={"Add to bar " + name} style={{ ...rowBtn, color: t.goldText, borderColor: t.goldBorder, background: t.goldBg }}>Add to bar</button>
              </div>
            );
          })}

          <button onClick={() => setConfirmReset(true)} style={{ ...wideBtn, marginTop: 18 }}>Reset to default</button>
        </div>

        <div style={{ padding: "10px 16px calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid " + t.borderSolid, display: "flex", gap: 10, flexShrink: 0, background: t.bg }}>
          <button onClick={onClose} style={{ ...wideBtn, flex: 1 }}>Close</button>
          <button onClick={() => onSave(draft)} disabled={!complete} style={{ flex: 1, minHeight: 44, borderRadius: R.md, border: "none", background: complete ? "linear-gradient(135deg, " + GOLD + ", " + GOLD_LIGHT + ")" : t.cardAlt, color: complete ? NAVY : t.textMut, fontSize: 14, fontWeight: 700, cursor: complete ? "pointer" : "default", fontFamily: FONT_HEAD }}>Done</button>
        </div>

        {replacing && (
          <div onClick={() => setReplacing(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.modalOverlay, zIndex: 410, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: "16px 16px 0 0", border: "1px solid " + t.borderSolid, width: "100%", maxWidth: 560, padding: "18px 16px 26px", boxShadow: t.popShadow }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: FONT_HEAD, marginBottom: 4 }}>Replace which one?</div>
              <div style={{ fontSize: 12, color: t.textSec, marginBottom: 12 }}>Your bar is full. {nameOf(replacing)} will take the place of the one you pick.</div>
              {draft.map((id, i) => (
                <button key={i} onClick={() => replaceAt(i)} style={{ ...wideBtn, marginBottom: 8, textAlign: "left", padding: "0 14px" }}>{id ? nameOf(id) : SHORTCUTS_EMPTY_SLOT}</button>
              ))}
              <button onClick={() => setReplacing(null)} style={{ ...wideBtn, marginTop: 4 }}>Cancel</button>
            </div>
          </div>
        )}

        {confirmReset && (
          <div onClick={() => setConfirmReset(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.modalOverlay, zIndex: 410, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: "16px 16px 0 0", border: "1px solid " + t.borderSolid, width: "100%", maxWidth: 560, padding: "18px 16px 26px", boxShadow: t.popShadow }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: FONT_HEAD, marginBottom: 14 }}>Put the bar back the way it came?</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmReset(false)} style={{ ...wideBtn, flex: 1 }}>Cancel</button>
                <button onClick={() => { setDraft(DEFAULT_SHORTCUTS.slice()); setConfirmReset(false); }} style={{ flex: 1, minHeight: 44, borderRadius: R.md, border: "1px solid " + RED, background: "transparent", color: RED, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT_HEAD }}>Reset</button>
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
  if (secs < 60) return "now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + "m";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h";
  const days = Math.floor(hours / 24);
  if (days <= 7) return days + "d";
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
          <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, color: t.text, fontFamily: FONT_HEAD }}>Notifications</div>
          <button onClick={markAll} disabled={!canMarkAll} style={{ ...wideBtn, padding: "0 12px", fontSize: 12, opacity: canMarkAll ? 1 : 0.5, cursor: canMarkAll ? "pointer" : "default" }}>{allBusy ? "Marking..." : "Mark all read"}</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 16px 16px" }}>
          {rows === null && !failed && <div style={{ padding: "28px 4px", textAlign: "center", fontSize: 13, color: t.textMut }}>Loading...</div>}
          {rows === null && failed && (
            <div style={{ padding: "28px 4px", textAlign: "center" }}>
              <div style={{ fontSize: 14, color: t.textMut, fontFamily: FONT_HEAD }}>Notifications did not load.</div>
              <button onClick={() => load(null)} style={{ ...wideBtn, marginTop: 14, borderColor: t.goldBorder, background: t.goldBg, color: t.goldText, fontWeight: 700 }}>Try again</button>
            </div>
          )}
          {rows !== null && rows.length === 0 && <div style={{ padding: "28px 4px", textAlign: "center", fontSize: 14, color: t.textMut, fontFamily: FONT_HEAD }}>Nothing yet.</div>}

          {(rows || []).map(row => {
            const isUnread = !row.readAt;
            const hasTab = !!NOTIF_TAB[row.subjectType];
            const showDashboard = !hasTab && notifOffOrigin(row.link);
            return (
              <div key={row.id} style={{ marginBottom: 6, background: t.card, border: "1px solid " + (isUnread ? t.goldBorder : t.borderSolid), borderRadius: R.md }}>
                <button onClick={() => openRow(row)} style={{ width: "100%", minHeight: 56, display: "flex", alignItems: "flex-start", gap: 10, padding: "12px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: isUnread ? GOLD : "transparent", flexShrink: 0, marginTop: 5 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: isUnread ? 700 : 500, color: t.text, fontFamily: FONT_HEAD, lineHeight: 1.35 }}>{row.title}</span>
                    {row.body && <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 12, color: t.textSec, marginTop: 3, lineHeight: 1.4 }}>{row.body}</span>}
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 10, color: t.textMut, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{notifAgo(row.createdAt, nowMs)}</span>
                </button>
                {showDashboard && (
                  <div style={{ padding: "0 12px 12px" }}>
                    <button onClick={() => { try { window.open(row.link, "_blank", "noopener,noreferrer"); } catch (e) {} }} style={{ ...wideBtn, width: "100%", fontSize: 12, borderColor: t.blueBorder, color: BLUE }}>Open in the dashboard</button>
                  </div>
                )}
              </div>
            );
          })}

          {rows !== null && rows.length > 0 && failed && (
            <div style={{ padding: "10px 4px", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: t.textMut }}>Notifications did not load.</div>
              <button onClick={() => load(rows[rows.length - 1].createdAt)} style={{ ...wideBtn, marginTop: 8 }}>Try again</button>
            </div>
          )}
          {rows !== null && rows.length > 0 && more && !failed && (
            <button onClick={() => load(rows[rows.length - 1].createdAt)} disabled={busy} style={{ ...wideBtn, width: "100%", marginTop: 8, opacity: busy ? 0.6 : 1 }}>{busy ? "Loading..." : "Load more"}</button>
          )}
        </div>

        <div style={{ padding: "10px 16px calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid " + t.borderSolid, flexShrink: 0, background: t.bg }}>
          <button onClick={onClose} style={{ ...wideBtn, width: "100%" }}>Close</button>
        </div>
      </div>
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

  const fmtDate = (d) => { const s = String(d).slice(0, 10); return new Date(s + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); };
  const fmtTm = (t) => { const [h, m] = String(t).split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; return ((h % 12) || 12) + ":" + String(m).padStart(2, "0") + " " + ap; };
  const originLabel = { callout: "Callout", no_show: "No-Show", extra_coverage: "Extra Coverage", voluntary_drop: "Voluntary Drop", new_shift: "New Shift" };
  const originColor = { callout: RED, no_show: RED, extra_coverage: ORANGE, voluntary_drop: BLUE, new_shift: GOLD };

  const loadAvailable = async () => {
    setLoading(true);
    try {
      const data = await api("/api/pickups/available", { token });
      setAvailable(data);
    } catch (err) { showToast(err.message, "error"); }
    setLoading(false);
  };

  const loadMyPickups = async () => {
    setLoading(true);
    try {
      const data = await api("/api/pickups/my-pickups", { token });
      setMyPickups(data);
    } catch (err) { showToast(err.message, "error"); }
    setLoading(false);
  };

  useEffect(() => { loadAvailable(); loadMyPickups(); }, []);
  useEffect(() => { if (tab === "available") loadAvailable(); else loadMyPickups(); }, [tab]);

  const claimShift = async (id) => {
    setClaiming(id);
    try {
      const result = await api("/api/pickups/" + id + "/claim", { method: "POST", token });
      if (result.ot_warning) {
        showToast("Shift claimed (overtime warning: " + Math.round(result.weekly_minutes / 60) + "h this week)", "notice");
      } else {
        showToast("Shift claimed successfully!");
      }
      loadAvailable();
      loadMyPickups();
    } catch (err) { showToast(err.message, "error"); }
    setClaiming(null);
  };

  const releaseShift = async (id) => {
    if (!window.confirm("Release this shift? It will go back to the open pool for someone else to claim.")) return;
    try {
      await api("/api/pickups/" + id + "/release", { method: "POST", token });
      showToast("Shift released");
      loadAvailable();
      loadMyPickups();
    } catch (err) { showToast(err.message, "error"); }
  };

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 12, fontFamily: FONT_HEAD }}>Shift Pickup Board</div>

      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {[{ id: "available", l: "Available", count: available.length }, { id: "mine", l: "My Pickups", count: myPickups.length }].map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{
            flex: 1, padding: "10px 0", borderRadius: R.sm,
            border: tab === tb.id ? "1px solid " + t.goldBorder : "1px solid transparent",
            background: tab === tb.id ? t.goldBg : "transparent",
            color: tab === tb.id ? t.goldText : t.textMut,
            fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT_HEAD, textTransform: "uppercase", letterSpacing: "0.5px"
          }}>
            {tb.l} {tb.count > 0 && <span style={{ marginLeft: 4, fontSize: 10, padding: "1px 6px", borderRadius: R.pill, background: GOLD + "26", color: t.goldText, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{tb.count}</span>}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 40, color: t.textMut, fontFamily: FONT_HEAD }}>Loading...</div>}

      {/* AVAILABLE SHIFTS */}
      {!loading && tab === "available" && (
        <div>
          {available.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 24px", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, boxShadow: t.shadow }}>
              <SwapIco sz={32} c={t.textMut} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: t.textSec, fontFamily: FONT_HEAD }}>No open shifts right now</div>
              <div style={{ fontSize: 11, color: t.textMut, marginTop: 4 }}>Check back later for available pickup shifts at your assigned sites.</div>
            </div>
          )}
          {available.map(s => (
            <div key={s.id} style={{ background: t.card, borderRadius: R.md, padding: 14, marginBottom: 10, border: "1px solid " + (s.urgency === "urgent" ? RED + "40" : t.border), boxShadow: t.shadow }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.text, fontFamily: FONT_HEAD }}>{s.site_name}</span>
                    {s.urgency === "urgent" && <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: R.sm, background: RED + "18", color: RED, fontFamily: FONT_HEAD }}>URGENT</span>}
                  </div>
                  <div style={{ fontSize: 12, color: t.textSec, fontVariantNumeric: "tabular-nums" }}>{fmtDate(s.scheduled_date)}</div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: R.sm, background: (originColor[s.origin] || GOLD) + "18", color: originColor[s.origin] || t.goldText, fontFamily: FONT_HEAD }}>{originLabel[s.origin] || s.origin}</span>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, padding: "8px 10px", borderRadius: R.md, background: t.cardAlt }}>
                <ClockIco sz={14} c={t.goldText} />
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{fmtTm(s.start_time)} to {fmtTm(s.end_time)}</span>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {s.building_name && <span style={{ fontSize: 10, color: t.textMut, padding: "2px 6px", borderRadius: R.sm, background: t.cardAlt, fontFamily: FONT_HEAD }}>Bldg: {s.building_name}</span>}
                {s.floor_number && <span style={{ fontSize: 10, color: t.textMut, padding: "2px 6px", borderRadius: R.sm, background: t.cardAlt, fontFamily: FONT_HEAD }}>Floor: {s.floor_number}</span>}
                {s.service_category && <span style={{ fontSize: 10, color: t.textMut, padding: "2px 6px", borderRadius: R.sm, background: t.cardAlt, fontFamily: FONT_HEAD }}>{s.service_category}</span>}
              </div>

              {s.notes && <div style={{ fontSize: 11, color: t.textSec, marginBottom: 10, fontStyle: "italic" }}>{s.notes}</div>}

              <button
                onClick={() => claimShift(s.id)}
                disabled={claiming === s.id}
                style={{
                  width: "100%", padding: "12px", borderRadius: R.md, border: "none",
                  background: claiming === s.id ? t.cardAlt : "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")",
                  color: claiming === s.id ? t.textMut : NAVY,
                  fontSize: 14, fontWeight: 700, cursor: claiming === s.id ? "default" : "pointer",
                  fontFamily: FONT_HEAD, textTransform: "uppercase", letterSpacing: "1px",
                  boxShadow: claiming === s.id ? "none" : "0 6px 18px rgba(231,176,23,0.30)"
                }}
              >
                {claiming === s.id ? "Claiming..." : "Claim This Shift"}
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
              <div style={{ fontSize: 14, fontWeight: 600, color: t.textSec, fontFamily: FONT_HEAD }}>No claimed shifts</div>
              <div style={{ fontSize: 11, color: t.textMut, marginTop: 4 }}>Shifts you claim will appear here.</div>
            </div>
          )}
          {myPickups.map(s => {
            const sColor = s.status === "approved" ? GREEN : s.status === "filled" ? GREEN : BLUE;
            return (
              <div key={s.id} style={{ background: t.card, borderRadius: R.md, padding: 14, marginBottom: 10, border: "1px solid " + sColor + "30", boxShadow: t.shadow }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text, fontFamily: FONT_HEAD }}>{s.site_name}</div>
                    <div style={{ fontSize: 12, color: t.textSec, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{fmtDate(s.scheduled_date)}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: R.sm, background: sColor + "18", color: sColor, textTransform: "uppercase", fontFamily: FONT_HEAD }}>{s.status}</span>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, padding: "8px 10px", borderRadius: R.md, background: t.cardAlt }}>
                  <ClockIco sz={14} c={sColor} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{fmtTm(s.start_time)} to {fmtTm(s.end_time)}</span>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  {s.building_name && <span style={{ fontSize: 10, color: t.textMut, padding: "2px 6px", borderRadius: R.sm, background: t.cardAlt, fontFamily: FONT_HEAD }}>Bldg: {s.building_name}</span>}
                  {s.floor_number && <span style={{ fontSize: 10, color: t.textMut, padding: "2px 6px", borderRadius: R.sm, background: t.cardAlt, fontFamily: FONT_HEAD }}>Floor: {s.floor_number}</span>}
                </div>

                {s.status === "claimed" && (
                  <div>
                    <div style={{ padding: "6px 10px", borderRadius: R.sm, background: t.orangeSubtle, border: "1px solid " + t.orangeBorder, fontSize: 10, color: ORANGE, marginBottom: 8, fontFamily: FONT_HEAD }}>Waiting for manager approval</div>
                    <button onClick={() => releaseShift(s.id)} style={{ width: "100%", padding: "10px", borderRadius: R.sm, border: "1px solid " + RED, background: "transparent", color: RED, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT_HEAD }}>Release Shift</button>
                  </div>
                )}
                {s.status === "approved" && (
                  <div style={{ padding: "8px 12px", borderRadius: R.md, background: t.greenSubtle, border: "1px solid " + t.greenBorder }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: GREEN, fontFamily: FONT_HEAD }}>Approved. You are scheduled for this shift.</div>
                    <div style={{ fontSize: 10, color: t.textMut, marginTop: 2 }}>Start your shift at the normal time and your daily tasks will load automatically.</div>
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
  const fmtDate = (d) => d ? new Date(d.slice(0, 10) + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "--";

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

  const loadList = async () => {
    setLoading(true);
    try {
      const d = await api("/api/inspections/scheduled?status=scheduled", { token });
      setList(d);
    } catch (e) { showToast(e.message, "error"); }
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
    } catch (e) { showToast(e.message, "error"); }
  };

  const submitSchedule = async () => {
    if (!schedForm.template_id || !schedForm.site_id || !schedForm.scheduled_date) {
      showToast("Template, site, and date are required", "error"); return;
    }
    setScheduling(true);
    try {
      await api("/api/inspections/scheduled", { method: "POST", token, body: { ...schedForm, assigned_to: user.id } });
      showToast("Inspection scheduled"); setScheduleModal(false); loadList();
    } catch (e) { showToast(e.message, "error"); }
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
    } catch (e) { showToast(e.message, "error"); }
  };

  const handlePhotoUpload = async (itemId, file) => {
    setUploadingId(itemId);
    try {
      const result = await uploadTaskMedia(file, token);
      setUploaded(prev => ({ ...prev, [itemId]: result.url }));
      showToast("Photo attached");
    } catch (e) { showToast(e.message, "error"); }
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
      showToast("Inspection submitted");
      setActive(null);
      loadList();
    } catch (e) { showToast(e.message, "error"); }
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
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: FONT_HEAD }}>{active.template_name}</div>
            <div style={{ fontSize: 11, color: t.textSec, fontFamily: FONT_BODY }}>{active.site_name} - {fmtDate(active.scheduled_date)}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: R.lg, background: t.card, marginBottom: 16, border: "1px solid " + t.goldBorder, boxShadow: t.popShadow }}>
          <div style={{ fontSize: 11, color: t.textSec, fontFamily: FONT_HEAD, textTransform: "uppercase", letterSpacing: "0.5px" }}>Running total</div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: scoreColor, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
            <span style={{ fontSize: 11, color: t.textMut, marginLeft: 6, fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{totalScored}/{totalMax} pts</span>
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
                  <div style={{ width: 26, height: 26, borderRadius: R.sm, background: (CIMS_C[item.cims_category] || BLUE) + "1A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: CIMS_C[item.cims_category] || BLUE, flexShrink: 0, fontFamily: FONT_HEAD }}>{item.cims_category}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, lineHeight: 1.3, fontFamily: FONT_HEAD }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: t.textMut }}>{item.zone}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: iColor, minWidth: 36, textAlign: "right", fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{sc}<span style={{ fontSize: 10, color: t.textMut, fontWeight: 400 }}>/{item.max_score}</span></div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <input type="range" min={0} max={item.max_score} value={sc} onChange={e => setScores(prev => ({ ...prev, [item.id]: parseInt(e.target.value) }))} style={{ width: "100%", accentColor: iColor }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: t.textMut, marginTop: 2 }}><span>0</span><span>{item.max_score}</span></div>
                </div>
                <input value={notes[item.id] || ""} onChange={e => setNotes(prev => ({ ...prev, [item.id]: e.target.value }))} placeholder="Notes for this item (optional)" style={{ ...inputSt, fontSize: 12, marginBottom: 8 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: R.sm, border: "1px solid " + t.borderSolid, background: "transparent", cursor: "pointer", fontSize: 11, color: t.textSec }}>
                    <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => e.target.files[0] && handlePhotoUpload(item.id, e.target.files[0])} />
                    {uploadingId === item.id ? "Uploading..." : "Attach Photo"}
                  </label>
                  {uploaded[item.id] && <span style={{ fontSize: 10, color: GREEN, fontWeight: 600 }}>Photo attached</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Overall Notes</label>
          <textarea value={overallNotes} onChange={e => setOverallNotes(e.target.value)} placeholder="General observations, follow-ups needed, etc." rows={3} style={{ ...inputSt, resize: "vertical" }} />
        </div>

        <button onClick={submit} disabled={submitting} style={{ width: "100%", padding: "14px", borderRadius: R.md, border: "none", background: "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")", color: NAVY, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: submitting ? 0.6 : 1, textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: FONT_HEAD, boxShadow: "0 6px 18px rgba(231,176,23,0.30)" }}>
          {submitting ? "Submitting..." : "Submit Inspection"}
        </button>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 2, fontFamily: FONT_HEAD }}>My Inspections</div>
          <div style={{ fontSize: 11, color: t.textSec }}>Tap an inspection to begin scoring.</div>
        </div>
        {isManager && (
          <button onClick={openScheduleModal} style={{ padding: "8px 14px", borderRadius: R.sm, border: "none", background: GOLD, color: NAVY, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0, fontFamily: FONT_HEAD }}>
            + Schedule
          </button>
        )}
      </div>

      {loading && <div style={{ padding: "30px 0", textAlign: "center", fontSize: 12, color: t.textMut }}>Loading...</div>}

      {!loading && list.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 24px", background: t.card, borderRadius: R.md, border: "1px solid " + t.border, boxShadow: t.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.textSec, fontFamily: FONT_HEAD }}>No inspections pending</div>
          <div style={{ fontSize: 11, color: t.textMut, marginTop: 4 }}>Inspections assigned to you will appear here.</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {list.map(si => (
          <button key={si.id} onClick={() => openInspection(si.id)} style={{ width: "100%", display: "block", padding: "14px", borderRadius: R.md, border: "1.5px solid " + t.borderSolid, background: t.card, cursor: "pointer", textAlign: "left", boxShadow: t.shadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, flex: 1, marginRight: 8, fontFamily: FONT_HEAD }}>{si.template_name}</div>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: R.sm, background: (STATUS_C[si.status] || BLUE) + "18", color: STATUS_C[si.status] || BLUE, textTransform: "uppercase", flexShrink: 0, fontFamily: FONT_HEAD, letterSpacing: "0.5px" }}>{si.status.replace("_", " ")}</span>
            </div>
            <div style={{ fontSize: 12, color: t.textSec }}>{si.site_name}</div>
            <div style={{ fontSize: 11, color: t.textMut, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>Scheduled {fmtDate(si.scheduled_date)}</div>
            <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: R.sm, background: t.cardAlt, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: t.textSec }}>Tap to start scoring</span>
              <span style={{ fontSize: 16, color: t.goldText }}>{">"}</span>
            </div>
          </button>
        ))}
      </div>

      {scheduleModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.modalOverlay, zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setScheduleModal(false)}>
          <div style={{ background: t.card, borderRadius: "16px 16px 0 0", border: "1px solid " + t.borderSolid, width: "100%", maxWidth: 960, padding: "24px 20px 40px", maxHeight: "85vh", overflowY: "auto", boxShadow: t.popShadow }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: FONT_HEAD }}>Schedule Inspection</div>
              <button onClick={() => setScheduleModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: t.textMut, lineHeight: 1 }}>x</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Template *</label>
              <select value={schedForm.template_id} onChange={e => setSchedForm({ ...schedForm, template_id: e.target.value })} style={{ ...inputSt }}>
                <option value="">Select template...</option>
                {templates.map(tp => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Site *</label>
              <select value={schedForm.site_id} onChange={e => setSchedForm({ ...schedForm, site_id: e.target.value })} style={{ ...inputSt }}>
                <option value="">Select site...</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelSt}>Scheduled Date *</label>
              <input type="date" value={schedForm.scheduled_date} onChange={e => setSchedForm({ ...schedForm, scheduled_date: e.target.value })} style={inputSt} />
            </div>
            <button onClick={submitSchedule} disabled={scheduling} style={{ width: "100%", padding: "14px", borderRadius: R.md, border: "none", background: "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")", color: NAVY, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: scheduling ? 0.6 : 1, textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: FONT_HEAD, boxShadow: "0 6px 18px rgba(231,176,23,0.30)" }}>
              {scheduling ? "Scheduling..." : "Schedule Inspection"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MyProfileView({ token, user, showToast, t, setUser, setActiveTab, onEditShortcuts }) {
  const { textSize, setTextSize } = useContext(TextSizeCtx);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pinForm, setPinForm] = useState({ current: "", next: "", confirm: "" });
  const [pinErrs, setPinErrs] = useState({});
  const [pinSaving, setPinSaving] = useState(false);

  // The current PIN is required here. The threat on this screen is a
  // handset left unlocked, so the change has to prove it is the owner.
  const changePin = async () => {
    const e = {};
    if (!PIN_RE.test(pinForm.current)) e.current = "Enter your current 4-digit PIN.";
    const why = weakPinReason(pinForm.next, (profile && profile.user && profile.user.badgeNumber) || (user && user.badgeNumber));
    if (why) e.next = why;
    else if (pinForm.confirm !== pinForm.next) e.confirm = ERR_PIN_MISMATCH;
    else if (pinForm.next === pinForm.current) e.next = "Your new PIN must be different from your current PIN.";
    setPinErrs(e);
    if (Object.keys(e).length) return;
    setPinSaving(true);
    try {
      await api("/api/auth/change-pin", { method: "POST", body: { currentPin: pinForm.current, newPin: pinForm.next }, token });
      showToast("PIN updated");
      setPinForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      const msg = err.message || "Could not update your PIN.";
      setPinErrs(/new/i.test(msg) ? { next: msg } : { current: msg });
    }
    setPinSaving(false);
  };

  const loadProfile = async () => {
    try {
      const d = await api("/api/users/profile/me", { token });
      setProfile(d);
    } catch (e) { showToast(e.message, "error"); }
  };
  useEffect(() => { loadProfile(); }, []);

  const fmtDate = d => { if (!d) return "Not set"; const dt = typeof d === "string" ? d.split("T")[0] : new Date(d).toISOString().split("T")[0]; const [y, m, dy] = dt.split("-"); const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return months[parseInt(m) - 1] + " " + parseInt(dy) + ", " + y; };

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { showToast("Photo must be under 20MB", "error"); return; }
    setUploading(true);
    try {
      // Compress to 512x512 max, JPEG quality 80%
      const compressed = await compressImage(file, 800, 0.85);
      const res = await fetch(API + "/api/uploads?bucket=profile-photos&ext=jpg", {
        method: "POST", headers: { "Authorization": "Bearer " + token, "Content-Type": "image/jpeg" }, body: compressed
      });
      if (res.status === 401) { window.dispatchEvent(new Event("ocsa-session-expired")); throw new Error("Session expired"); }
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Upload failed"); }
      const r = await res.json();
      await api("/api/users/profile/photo", { method: "POST", body: { photoUrl: r.url }, token });
      showToast("Photo updated");
      setUser(prev => ({ ...prev, profilePhotoUrl: r.url }));
      loadProfile();
    } catch (e) { showToast(e.message, "error"); }
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
      preferredLanguage: u.preferredLanguage || "English", personalNotes: u.personalNotes || ""
    });
    setEditing(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api("/api/users/profile/me", { method: "PATCH", body: form, token });
      showToast("Profile updated");
      setEditing(false);
      loadProfile();
    } catch (e) { showToast(e.message, "error"); }
    setSaving(false);
  };

  if (!profile) return <div style={{ padding: 20, textAlign: "center", color: t.textMut }}>Loading profile...</div>;

  const u = profile.user;
  const cardSt = { background: t.card, border: "1px solid " + t.border, borderRadius: R.md, padding: 16, marginBottom: 12 };
  const labelSt = mkLabel(t);
  const inputSt = mkInput(t);
  const valSt = { color: t.text, fontWeight: 500, marginTop: 2, fontSize: 13 };

  return (
    <div style={{ padding: "16px" }}>
      <button onClick={() => setActiveTab("clock")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", background: "none", border: "none", color: t.goldText, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.goldText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg> Back
      </button>

      {/* Photo and Name Header */}
      <div style={{ ...cardSt, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative" }}>
          {u.profilePhotoUrl
            ? <img src={u.profilePhotoUrl} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid " + GOLD }} />
            : <div style={{ width: 72, height: 72, borderRadius: "50%", background: t.goldSubtle, border: "2px solid " + GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, color: t.goldText, fontFamily: FONT_HEAD }}>{u.firstName?.[0]}{u.lastName?.[0]}</div>
          }
          <label style={{ position: "absolute", bottom: -2, right: -2, width: 26, height: 26, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "2px solid " + t.card }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }} />
          </label>
          {uploading && <div style={{ position: "absolute", top: 0, left: 0, width: 72, height: 72, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#F8F7F4" }}>...</div>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: t.text, fontFamily: FONT_HEAD }}>{u.firstName} {u.lastName}</div>
          <div style={{ fontSize: 12, color: t.goldText, marginTop: 2 }}>{u.role?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</div>
          <div style={{ fontSize: 10, color: t.textMut, marginTop: 4, overflowWrap: "anywhere" }}>{u.phone} | {u.email}</div>
          {u.employeeId
            ? <div style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", maxWidth: "100%", boxSizing: "border-box", gap: 6, marginTop: 8, padding: "3px 10px", borderRadius: R.sm, background: t.goldSubtle, border: "1px solid " + GOLD }}>
                <span style={{ fontSize: 8, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, fontFamily: FONT_HEAD }}>Employee ID</span>
                <span style={{ fontSize: 12, color: t.text, fontWeight: 700, letterSpacing: "0.5px", fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{u.employeeId}</span>
              </div>
            : <div style={{ marginTop: 8, fontSize: 10, color: t.textMut, fontStyle: "italic" }}>Employee ID not assigned. Ask your supervisor.</div>
          }
          {u.badgeNumber && <div style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", maxWidth: "100%", boxSizing: "border-box", gap: 6, marginTop: 6, padding: "3px 10px", borderRadius: R.sm, background: t.goldSubtle, border: "1px solid " + GOLD }}>
            <span style={{ fontSize: 8, color: t.goldText, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, fontFamily: FONT_HEAD }}>Badge Number</span>
            <span style={{ fontSize: 12, color: t.text, fontWeight: 700, letterSpacing: "0.5px", fontFamily: FONT_HEAD, fontVariantNumeric: "tabular-nums" }}>{u.badgeNumber}</span>
          </div>}
        </div>
      </div>

      {/* Personal Info */}
      <div style={cardSt}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={labelSt}>Personal Information</div>
          {!editing && <button onClick={startEditing} style={{ padding: "4px 10px", borderRadius: R.sm, border: "1px solid " + GOLD, background: "transparent", color: t.goldText, fontSize: 10, cursor: "pointer", fontWeight: 600, fontFamily: FONT_HEAD }}>Edit</button>}
        </div>
        {!editing ? <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ fontSize: 11, color: t.textMut }}>Birthday<div style={valSt}>{u.birthday ? fmtDate(u.birthday) : "Not set"}</div></div>
            <div style={{ fontSize: 11, color: t.textMut }}>Language<div style={valSt}>{u.preferredLanguage || "English"}</div></div>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: t.textMut }}>Address<div style={valSt}>{u.addressLine1 ? (u.addressLine1 + (u.addressLine2 ? ", " + u.addressLine2 : "") + (u.city ? ", " + u.city : "") + (u.state ? ", " + u.state : "") + (u.zipCode ? " " + u.zipCode : "")) : "Not set"}</div></div>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ fontSize: 11, color: t.textMut }}>Emergency Contact<div style={valSt}>{u.emergencyContactName || "Not set"}</div></div>
            <div style={{ fontSize: 11, color: t.textMut }}>Emergency Phone<div style={valSt}>{u.emergencyContactPhone || "Not set"}</div></div>
          </div>
        </div> : <div>
          <div style={{ marginBottom: 10 }}><label style={labelSt}>Birthday</label><input type="date" value={form.birthday || ""} onChange={e => setForm({ ...form, birthday: e.target.value })} style={inputSt} /></div>
          <div style={{ marginBottom: 10 }}><label style={labelSt}>Address Line 1</label><input value={form.addressLine1 || ""} onChange={e => setForm({ ...form, addressLine1: e.target.value })} style={inputSt} placeholder="Street address" /></div>
          <div style={{ marginBottom: 10 }}><label style={labelSt}>Address Line 2</label><input value={form.addressLine2 || ""} onChange={e => setForm({ ...form, addressLine2: e.target.value })} style={inputSt} placeholder="Apt, suite, etc." /></div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div><label style={labelSt}>City</label><input value={form.city || ""} onChange={e => setForm({ ...form, city: e.target.value })} style={inputSt} /></div>
            <div><label style={labelSt}>State</label><input value={form.state || ""} onChange={e => setForm({ ...form, state: e.target.value })} style={inputSt} /></div>
            <div><label style={labelSt}>Zip</label><input value={form.zipCode || ""} onChange={e => setForm({ ...form, zipCode: e.target.value })} style={inputSt} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div><label style={labelSt}>Emergency Contact</label><input value={form.emergencyContactName || ""} onChange={e => setForm({ ...form, emergencyContactName: e.target.value })} style={inputSt} placeholder="Full name" /></div>
            <div><label style={labelSt}>Emergency Phone</label><input value={form.emergencyContactPhone || ""} onChange={e => setForm({ ...form, emergencyContactPhone: e.target.value })} style={inputSt} placeholder="Phone number" /></div>
          </div>
          <div style={{ marginBottom: 10 }}><label style={labelSt}>Preferred Language</label><input value={form.preferredLanguage || ""} onChange={e => setForm({ ...form, preferredLanguage: e.target.value })} style={inputSt} /></div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setEditing(false)} style={{ padding: "10px 18px", borderRadius: R.sm, border: "none", background: t.btnGhost || t.card, color: t.text, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT_HEAD }}>Cancel</button>
            <button onClick={saveProfile} disabled={saving} style={{ padding: "10px 18px", borderRadius: R.md, border: "none", background: "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")", color: NAVY, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1, textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: FONT_HEAD, boxShadow: "0 6px 18px rgba(231,176,23,0.30)" }}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>}
      </div>

      {/* Text size */}
      <div style={cardSt}>
        <div style={{ ...labelSt, marginBottom: 6 }}>Text size</div>
        <div style={{ fontSize: 11, color: t.textMut, marginBottom: 12, lineHeight: 1.4 }}>Makes everything in the app bigger on this phone.</div>
        <TextSizeChoices value={textSize} onChange={setTextSize} t={t} />
      </div>

      {/* Shortcuts */}
      <div style={cardSt}>
        <div style={{ ...labelSt, marginBottom: 6 }}>Shortcuts</div>
        <div style={{ fontSize: 11, color: t.textMut, marginBottom: 12, lineHeight: 1.4 }}>{SHORTCUTS_CARD_LINE}</div>
        <button onClick={onEditShortcuts} style={{ width: "100%", minHeight: 44, borderRadius: R.md, border: "1px solid " + GOLD, background: "transparent", color: t.goldText, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT_HEAD }}>Edit shortcuts</button>
      </div>

      {/* Change PIN */}
      <div style={cardSt}>
        <div style={{ ...labelSt, marginBottom: 6 }}>Change PIN</div>
        <div style={{ fontSize: 11, color: t.textMut, marginBottom: 12, lineHeight: 1.4 }}>Your PIN is 4 digits. Choose one that only you know.</div>
        <div style={{ marginBottom: 10 }}><label style={labelSt}>Current PIN</label><input value={pinForm.current} onChange={e => setPinForm({ ...pinForm, current: e.target.value })} {...PIN_INPUT_PROPS} style={{ ...inputSt, letterSpacing: "8px", textAlign: "center", fontSize: 20 }} />{pinErrs.current && <div style={mkFieldErr(t)}>{pinErrs.current}</div>}</div>
        <div style={{ marginBottom: 10 }}><label style={labelSt}>New PIN</label><input value={pinForm.next} onChange={e => setPinForm({ ...pinForm, next: e.target.value })} {...PIN_INPUT_PROPS} style={{ ...inputSt, letterSpacing: "8px", textAlign: "center", fontSize: 20 }} />{pinErrs.next && <div style={mkFieldErr(t)}>{pinErrs.next}</div>}</div>
        <div style={{ marginBottom: 10 }}><label style={labelSt}>Confirm New PIN</label><input value={pinForm.confirm} onChange={e => setPinForm({ ...pinForm, confirm: e.target.value })} {...PIN_INPUT_PROPS} style={{ ...inputSt, letterSpacing: "8px", textAlign: "center", fontSize: 20 }} onKeyDown={e => e.key === "Enter" && !pinSaving && changePin()} />{pinErrs.confirm && <div style={mkFieldErr(t)}>{pinErrs.confirm}</div>}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={changePin} disabled={pinSaving} style={{ padding: "10px 18px", borderRadius: R.md, border: "none", background: "linear-gradient(135deg," + GOLD + "," + GOLD_LIGHT + ")", color: NAVY, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: pinSaving ? 0.6 : 1, textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: FONT_HEAD, boxShadow: "0 6px 18px rgba(231,176,23,0.30)" }}>{pinSaving ? "Saving..." : "Update PIN"}</button>
        </div>
      </div>

      {/* Assignments */}
      {profile.assignments?.length > 0 && <div style={cardSt}>
        <div style={{ ...labelSt, marginBottom: 10 }}>Site Assignments</div>
        {profile.assignments.map((a, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: t.hover, borderRadius: R.sm, marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.text, fontFamily: FONT_HEAD }}>{a.site_name}</div>
            <div style={{ fontSize: 10, color: t.textMut, marginTop: 2 }}>{a.role_at_site || "Staff"} | {a.shift_name || "No shift"}{a.shift_start ? " | " + a.shift_start + " - " + a.shift_end : ""}</div>
          </div>
        </div>)}
      </div>}
    </div>
  );
}
