self.addEventListener("install", function (e) {
    console.log("Service Worker instalado con éxito");
});

self.addEventListener("fetch", function (e) {
    e.respondWith(
        fetch(e.request).catch(function () {
            return caches.match(e.request);
        })
    );
});