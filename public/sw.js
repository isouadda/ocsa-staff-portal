// Minimal service worker. It exists so browsers that require one before
// offering "Install app" will offer it, and to show phone alerts. It
// caches nothing: no page, no asset, no API response. Every request goes
// to the network as if no service worker were installed, so a deploy is
// never hidden behind an old copy and nothing personal is ever stored on
// the phone.
self.addEventListener("install", function () {
  self.skipWaiting();
});
self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});
// A fetch listener that never calls respondWith. The browser handles
// the request itself, straight from the network.
self.addEventListener("fetch", function () {});

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
