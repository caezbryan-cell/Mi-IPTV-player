self.addEventListener("install", function (e) {
    console.log("Service Worker instalado");
    self.skipWaiting();
});

self.addEventListener("activate", function (e) {
    console.log("Service Worker activo");
});

self.addEventListener("fetch", function (e) {
    e.respondWith(
        fetch(e.request).catch(function () {
            return caches.match(e.request);
        })
    );
});
