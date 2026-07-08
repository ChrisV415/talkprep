const SHELL_CACHE = "talkprep-shell-v1";
const ASSET_CACHE = "talkprep-assets-v1";

const SHELL_URLS = ["/", "/manifest.json", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response('{"error":"offline"}', {
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    return;
  }

  if (
    /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico|json)$/.test(
      url.pathname,
    )
  ) {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request)
            .then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            })
            .catch(() => cached || new Response("", { status: 404 }));
        }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches
          .match("/")
          .then((cached) => cached || new Response("Offline", { status: 503 })),
      ),
  );
});
