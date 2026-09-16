// One address. When the build carries a canonical origin and the host
// to move away from, and the page is served from exactly that host, the
// browser is sent to the same path and query on the canonical origin
// before the app renders. Any other host, including preview deployments
// and localhost, is left alone. With either value missing nothing happens.

// Pure. Returns the URL to go to, or null to stay put.
export function canonicalRedirectTarget(location, canonicalOrigin, redirectFromHost) {
  var origin = String(canonicalOrigin || "").trim().replace(/\/+$/, "");
  var fromHost = String(redirectFromHost || "").trim().toLowerCase();
  if (!origin || !fromHost || !location) return null;
  var host = String(location.host || "").toLowerCase();
  if (host !== fromHost) return null;
  var target;
  try { target = new URL(origin); } catch (e) { return null; }
  if (target.protocol !== "https:" && target.protocol !== "http:") return null;
  if (target.host.toLowerCase() === host) return null;
  return target.origin + (location.pathname || "/") + (location.search || "") + (location.hash || "");
}

export function applyCanonicalRedirect() {
  try {
    var to = canonicalRedirectTarget(window.location, process.env.REACT_APP_CANONICAL_ORIGIN, process.env.REACT_APP_REDIRECT_FROM_HOST);
    if (to) { window.location.replace(to); return true; }
  } catch (e) {}
  return false;
}
