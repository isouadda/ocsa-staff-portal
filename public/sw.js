// Minimal service worker. It exists so browsers that require one before
// offering "Install app" will offer it. It caches nothing: no page, no
// asset, no API response. Every request goes to the network as if no
// service worker were installed, so a deploy is never hidden behind an
// old copy and nothing personal is ever stored on the phone.
self.addEventListener("install", function () {
  self.skipWaiting();
});
self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});
// A fetch listener that never calls respondWith. The browser handles
// the request itself, straight from the network.
self.addEventListener("fetch", function () {});
