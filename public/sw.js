// Minimal service worker. It exists so browsers that require one before
// offering "Install app" will offer it, to show phone alerts, and to keep
// one public page for a phone with no signal: the safety data sheet page
// at /sds, which the QR poster in each janitor closet opens, often in a
// basement. What it keeps is that page and the files it loads (the app's
// scripts and styles, the manifest, the icons and the logo), in one cache,
// ocsa-sds-shell-v1. Nothing personal is ever kept: no other page, no API
// answer, nothing signed in. The sheets themselves are kept by the page
// in localStorage.
//
// Every request is still asked of the network first, so a deploy is never
// hidden behind an old copy: a good answer to the page replaces what is
// kept, and the cache answers only when the network cannot. Every other
// request goes to the network as if no service worker were installed.
var SDS_CACHE = "ocsa-sds-shell-v1";
var SDS_PAGE = "/sds";
// /sds and /sds/<code>, the way src/App.js reads them. Both are the same
// page, kept once.
var SDS_PATH = /^\/sds(?:\/[A-Za-z0-9_.-]+)?\/?$/i;
// A file the page loads.
function isShellFile(path) {
  return /^\/static\/(js|css)\//.test(path) || /^\/icons\//.test(path) || path === "/manifest.json" || path === "/ocsa-logo-sm.png";
}
// Asked for by the /sds page itself, told by the page's own address.
function fromSdsPage(request) {
  try { var r = new URL(request.referrer); return r.origin === self.location.origin && SDS_PATH.test(r.pathname); } catch (e) { return false; }
}
// The files a page names in its HTML, and the logo it draws.
function filesIn(html) {
  var out = ["/manifest.json", "/ocsa-logo-sm.png"];
  var re = /(?:src|href)="([^"]+)"/g, m;
  while ((m = re.exec(html))) {
    try {
      var u = new URL(m[1], self.location.origin);
      if (u.origin === self.location.origin && isShellFile(u.pathname) && out.indexOf(u.pathname) === -1) out.push(u.pathname);
    } catch (e) {}
  }
  return out;
}
// Keeping the page never takes longer than this; whatever is still on its
// way after it is let go, and the next visit with signal tries again.
var KEEP_MS = 30000;
function withinTime(work) {
  return Promise.race([work, new Promise(function (done) { setTimeout(done, KEEP_MS); })]);
}
// A good answer to the page replaces everything kept: the page, and every
// file it names. The files carry their build in their names, so the
// browser's own cache may answer for them. Kept only when every one of
// them came, so a half-fetched deploy never takes the place of a whole one.
function keepShell(page) {
  var stored = page.clone();
  return withinTime(page.text().then(function (html) {
    var files = filesIn(html);
    return Promise.all(files.map(function (f) {
      return fetch(f).then(function (r) { return r && r.ok ? r : null; }).catch(function () { return null; });
    })).then(function (got) {
      if (got.some(function (r) { return !r; })) return null;
      return caches.delete(SDS_CACHE).then(function () { return caches.open(SDS_CACHE); }).then(function (cache) {
        return Promise.all([cache.put(SDS_PAGE, stored)].concat(got.map(function (r, i) { return cache.put(files[i], r); })));
      });
    });
  })).catch(function () {});
}
function kept(path) {
  return caches.open(SDS_CACHE).then(function (c) { return c.match(path); }).then(function (hit) { return hit || Response.error(); });
}

self.addEventListener("install", function () {
  self.skipWaiting();
});
// Any cache under another name is left from something older and goes.
// Once the worker is in charge it keeps the page, so a phone that has
// opened the app with signal has it the first time it has none. That runs
// apart from installing and activating, so phone alerts never wait on it.
self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (names) {
    return Promise.all(names.filter(function (n) { return n !== SDS_CACHE; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
  fetch(SDS_PAGE, { cache: "no-cache" }).then(function (res) { return res && res.ok ? keepShell(res) : null; }).catch(function () {});
});
// The /sds page, and the files it loads, network first and kept. Every
// other request is left alone: no respondWith, so the browser handles it
// itself, straight from the network.
self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    if (!SDS_PATH.test(url.pathname)) return;
    event.respondWith(fetch(req).then(function (res) {
      if (res && res.ok) event.waitUntil(keepShell(res.clone()));
      return res;
    }).catch(function () { return kept(SDS_PAGE); }));
    return;
  }
  if (!isShellFile(url.pathname) || !fromSdsPage(req)) return;
  event.respondWith(fetch(req).catch(function () { return kept(url.pathname); }));
});

// Phone alerts. The API pushes a small JSON payload, in the person's
// language: title, body, tag, subjectType, subjectId, locale. The worker
// shows it as the portal's own notification, one per tag, buzzing again
// when the same tag arrives, and keeps the subject in the notification's
// data for the tap. A payload with no title shows nothing. The icon is
// the app's 192 pixel mark; the badge is a white-on-clear 96 pixel mark,
// which Android draws in the status bar in place of a blank shape.
var ICON = "/icons/icon-192.png";
var BADGE = "/icons/badge-96.png";
self.addEventListener("push", function (event) {
  var data = null;
  try { data = event.data ? event.data.json() : null; } catch (e) { data = null; }
  if (!data || typeof data !== "object" || typeof data.title !== "string" || !data.title) return;
  var tag = typeof data.tag === "string" && data.tag ? data.tag : null;
  var options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: ICON,
    badge: BADGE,
    lang: data.locale === "es" ? "es" : "en",
    data: { subjectType: data.subjectType || null, subjectId: data.subjectId || null },
  };
  // renotify is refused without a tag, so both go together.
  if (tag) { options.tag = tag; options.renotify = true; }
  event.waitUntil(self.registration.showNotification(data.title, options));
});

// A tap on an alert focuses an open portal window and tells it where to
// go, or opens one with the place in the address. The app opens the same
// place the bell would.
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var d = event.notification.data || {};
  var subjectType = d.subjectType ? String(d.subjectType) : null;
  var subjectId = d.subjectId ? String(d.subjectId) : null;
  var message = { type: "ocsa-open", subjectType: subjectType, subjectId: subjectId };
  var address = "/" + (subjectType ? "?open=" + encodeURIComponent(subjectType + (subjectId ? ":" + subjectId : "")) : "");
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    var win = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].url && list[i].url.indexOf(self.location.origin) === 0) { win = list[i]; break; }
    }
    if (win) {
      try { win.postMessage(message); } catch (e) {}
      return win.focus ? win.focus().catch(function () {}) : undefined;
    }
    return self.clients.openWindow(address);
  }));
});
