import { useEffect, useRef, useState } from "react";
import { detectInstallMode, readPromptState, writePromptState, shouldShowPrompt } from "./homeScreenPromptRules";
import { storedZoom } from "./App";
import { tr } from "./words";

// A bottom sheet that shows how to save the app to the home screen, with
// steps for the phone and browser in use. Mounted once, beside the app,
// so it appears on every screen including sign in. It waits for the page
// to settle, shows only on a phone or tablet that is not already running
// from the home screen, and honors "Not now" for seven days and "Don't
// show again" for good. A tap outside counts as "Not now", so the sheet a
// person waved away does not come back on the next load. It renders
// beside the app rather than inside it, so it puts the text size setting
// on its own root and grows with everything else. At the largest size in
// Spanish it is taller than a small phone, so it stops at the height of
// the screen and scrolls inside itself rather than running off the top.

const SETTLE_MS = 2500;
const FONT = "-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const NAVY = "#0A1628";
const BLUE = "#15558F";
const ICON = process.env.PUBLIC_URL + "/icons/icon-192.png";
// The one place this name is written. It rides into the title as a
// placeholder so the Spanish line carries no client name of its own.
const APP_NAME = "OCSA Staff";

function isStandalone() {
  try {
    if (window.navigator && window.navigator.standalone === true) return true;
    return !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  } catch (e) { return false; }
}

// A square with an arrow pointing up. Drawn here, original.
function ShareGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: "-3px", margin: "0 3px" }}>
      <path d="M5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
    </svg>
  );
}

// A step line, with the share glyph dropped in wherever {share} sits.
// A line without the placeholder comes back unchanged.
function StepLine({ text }) {
  const parts = String(text).split("{share}");
  return <>{parts.map((piece, i) => <span key={i}>{i > 0 && <ShareGlyph />}{piece}</span>)}</>;
}

export default function HomeScreenPrompt() {
  const [mode, setMode] = useState("none");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const deferred = useRef(null);
  const fired = useRef(false);

  useEffect(() => {
    if (isStandalone()) return;
    const onBefore = (e) => {
      e.preventDefault();
      deferred.current = e;
      fired.current = true;
      // The sheet may already be up with the manual steps. Upgrade it.
      setMode(prev => prev === "android_manual" ? "android_prompt" : prev);
    };
    const onInstalled = () => {
      writePromptState(window.localStorage, { installed: true });
      setOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    const timer = setTimeout(() => {
      const m = detectInstallMode({
        ua: window.navigator.userAgent,
        maxTouchPoints: window.navigator.maxTouchPoints,
        standalone: isStandalone(),
        installPromptFired: fired.current,
      });
      if (m === "none") return;
      if (!shouldShowPrompt(readPromptState(window.localStorage), Date.now())) return;
      setMode(m);
      setZoom(storedZoom());
      setOpen(true);
    }, SETTLE_MS);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!open) return null;

  const notNow = () => { writePromptState(window.localStorage, { notNowAt: Date.now() }); setOpen(false); };
  const never = () => { writePromptState(window.localStorage, { never: true }); setOpen(false); };
  const install = async () => {
    const p = deferred.current;
    if (!p) { setMode("android_manual"); return; }
    try {
      p.prompt();
      const choice = await p.userChoice;
      if (choice && choice.outcome === "accepted") writePromptState(window.localStorage, { installed: true });
    } catch (e) {}
    deferred.current = null;
    setOpen(false);
  };
  const address = (() => { try { return window.location.href; } catch (e) { return ""; } })();
  const copy = () => {
    try {
      if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
        window.navigator.clipboard.writeText(address).then(() => setCopied(true)).catch(() => {});
      }
    } catch (e) {}
  };

  const stepsFor = {
    android_prompt: [tr("Tap Install below."), tr("Confirm on the next screen.")],
    android_manual: [tr("Open the browser menu. It is usually three dots at the top right."), tr("Tap Add to Home screen or Install app."), tr("Tap Add or Install.")],
    ios_safari: [tr("Tap the Share button {share} at the bottom of the screen."), tr("Scroll down and tap Add to Home Screen."), tr("Tap Add.")],
    ios_other_browser: [tr("Tap the Share button {share} in the address bar."), tr("Tap Add to Home Screen."), tr("Tap Add.")],
    in_app_browser: [],
  };
  const steps = stepsFor[mode] || [];

  const btn = { minHeight: 44, padding: "0 16px", borderRadius: 10, fontSize: 15, fontWeight: 600, fontFamily: FONT, cursor: "pointer", flex: 1 };
  const primary = { ...btn, border: "none", background: BLUE, color: "#FFFFFF" };
  const ghost = { ...btn, border: "1px solid #C9D3DF", background: "#FFFFFF", color: NAVY };

  return (
    <div onClick={notNow} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: FONT }}>
      <div role="dialog" aria-modal="true" aria-labelledby="ocsa-a2hs-title" onClick={e => e.stopPropagation()} style={{ zoom: zoom, width: "100%", maxWidth: 560, maxHeight: "calc(100vh / " + zoom + ")", overflowY: "auto", background: "#FFFFFF", color: NAVY, borderRadius: "18px 18px 0 0", padding: "18px 20px calc(20px + env(safe-area-inset-bottom, 0px))", boxShadow: "0 -8px 30px rgba(0,0,0,0.25)" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "#C9D3DF", margin: "0 auto 14px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <img src={ICON} alt="" width="56" height="56" style={{ width: 56, height: 56, borderRadius: 12, border: "1px solid #E4EAF2", flexShrink: 0 }} />
          <div>
            <div id="ocsa-a2hs-title" style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.25 }}>{tr("Add {app} to your home screen", { app: APP_NAME })}</div>
            <div style={{ fontSize: 14, color: "#4A5C70", marginTop: 4, lineHeight: 1.4 }}>{tr("It opens like an app, one tap from your home screen.")}</div>
          </div>
        </div>

        {mode === "in_app_browser" ? (
          <div style={{ margin: "12px 0 16px" }}>
            <div style={{ fontSize: 15, lineHeight: 1.5 }}>{tr("This page is open inside another app. Open it in Safari or Chrome first, then add it to your home screen.")}</div>
            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#F4F7FB", border: "1px solid #E4EAF2", fontSize: 13, wordBreak: "break-all", userSelect: "all", WebkitUserSelect: "all" }}>{address}</div>
            <button type="button" onClick={copy} style={{ ...ghost, flex: "none", width: "100%", marginTop: 8 }}>{copied ? tr("Copied") : tr("Copy address")}</button>
          </div>
        ) : (
          <ol style={{ margin: "12px 0 16px", paddingLeft: 22, fontSize: 15, lineHeight: 1.5 }}>
            {steps.map((line, i) => <li key={i} style={{ marginBottom: 6 }}><StepLine text={line} /></li>)}
          </ol>
        )}

        {mode === "android_prompt" && (
          <button type="button" onClick={install} style={{ ...primary, flex: "none", width: "100%", marginBottom: 10 }}>{tr("Install")}</button>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={notNow} style={ghost}>{tr("Not now")}</button>
          <button type="button" onClick={never} style={ghost}>{tr("Don't show again")}</button>
        </div>
      </div>
    </div>
  );
}
