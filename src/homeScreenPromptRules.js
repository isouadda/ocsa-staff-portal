// The rules behind the home screen prompt. No React, no window, so
// they can be run against a table of user agents outside the build.

export const PROMPT_KEY = "ocsa-home-screen-prompt";
export const NOT_NOW_DAYS = 7;
export const NOT_NOW_MS = NOT_NOW_DAYS * 24 * 60 * 60 * 1000;

// env: { ua, maxTouchPoints, standalone, installPromptFired }
// Returns exactly one of: android_prompt, android_manual, ios_safari,
// ios_other_browser, in_app_browser, none.
export function detectInstallMode(env) {
  var e = env || {};
  if (e.standalone) return "none";
  var ua = String(e.ua || "");
  var touch = Number(e.maxTouchPoints || 0) > 1;
  // iPad on a recent iOS reports a desktop Mac user agent. Touch tells it apart.
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh|Mac OS X/.test(ua) && touch);
  var isAndroid = /Android/i.test(ua);
  if (!isIOS && !isAndroid) return "none";
  var inApp = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|Twitter|TikTok|musical_ly|BytedanceWebview|Snapchat|; wv\)/i.test(ua);
  if (inApp) return "in_app_browser";
  if (isIOS) return /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\//.test(ua) ? "ios_other_browser" : "ios_safari";
  return e.installPromptFired ? "android_prompt" : "android_manual";
}

// Reads the stored choice. Returns null when nothing is stored or the
// storage cannot be read, and null means the prompt shows.
export function readPromptState(storage) {
  try {
    var raw = storage.getItem(PROMPT_KEY);
    if (!raw) return null;
    var p = JSON.parse(raw);
    return p && typeof p === "object" ? p : null;
  } catch (e) { return null; }
}

export function writePromptState(storage, patch) {
  try {
    var cur = readPromptState(storage) || {};
    storage.setItem(PROMPT_KEY, JSON.stringify(Object.assign({}, cur, patch)));
  } catch (e) {}
}

// state: the stored object or null. now: milliseconds.
export function shouldShowPrompt(state, now) {
  if (!state) return true;
  if (state.installed === true) return false;
  if (state.never === true) return false;
  if (typeof state.notNowAt === "number" && (now - state.notNowAt) < NOT_NOW_MS) return false;
  return true;
}
