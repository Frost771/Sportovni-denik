const CACHE = "sportovni-denik-v2-mobile-fix";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./config.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// iOS Safari může u kombinace sticky navigace, backdrop-filteru a
// horizontálního overflow vytvořit neviditelnou dotykovou vrstvu přes formulář.
// Tato mobilní oprava navigaci na úzké obrazovce odlepí a výslovně povolí
// dotykové ovládání formulářových prvků.
const MOBILE_FORM_FIX = `
@media (max-width: 650px) {
  .nav-tabs {
    position: static !important;
    top: auto !important;
    z-index: auto !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }

  #page-entry,
  #entry-form,
  #entry-form label,
  #entry-form input,
  #entry-form select,
  #entry-form textarea,
  #entry-form button {
    position: relative;
    pointer-events: auto !important;
    touch-action: manipulation;
  }

  #entry-form input,
  #entry-form select,
  #entry-form textarea {
    z-index: 2;
    min-height: 46px;
    font-size: 16px;
    -webkit-user-select: text;
    user-select: text;
  }
}
`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

async function fetchPatchedStyles(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    const originalCss = await response.text();
    const patchedResponse = new Response(`${originalCss}\n${MOBILE_FORM_FIX}`, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type": "text/css; charset=utf-8",
        "Cache-Control": "no-cache"
      }
    });

    const cache = await caches.open(CACHE);
    await cache.put(request, patchedResponse.clone());
    return patchedResponse;
  } catch (_error) {
    return (await caches.match(request)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.pathname.endsWith("/styles.css")) {
    event.respondWith(fetchPatchedStyles(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
