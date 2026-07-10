const CACHE = "sportovni-denik-v4-reset-fix";

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

const FORM_FIX = `
.nav-tabs {
  position: static !important;
  top: auto !important;
  z-index: auto !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

#app-view,
.page.active,
#page-entry,
#entry-form {
  position: relative;
}

#page-entry,
#entry-form {
  z-index: 50 !important;
  pointer-events: auto !important;
  isolation: isolate;
}

#entry-form label,
#entry-form input,
#entry-form select,
#entry-form textarea,
#entry-form button {
  position: relative;
  z-index: 51 !important;
  pointer-events: auto !important;
  touch-action: manipulation;
}

#entry-form input,
#entry-form select,
#entry-form textarea {
  -webkit-user-select: text !important;
  user-select: text !important;
}

@media (max-width: 650px) {
  #entry-form input,
  #entry-form select,
  #entry-form textarea {
    min-height: 46px;
    font-size: 16px;
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
    const patchedResponse = new Response(`${originalCss}\n${FORM_FIX}`, {
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

async function fetchPatchedApp(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    const originalJs = await response.text();
    const brokenLine = '  $("#entry-form").addEventListener("reset", () => setTimeout(resetEntryForm));';
    const fixedLine = '  $("#entry-form").addEventListener("reset", () => {\n    setTimeout(() => {\n      if (!state.editingId) {\n        setValue("#event-type", "Trénink");\n        setValue("#sport", "Florbal");\n        setValue("#event-date", isoToday());\n        setValue("#match-type", "Soutěžní");\n        setValue("#decision", "Základní doba");\n        setValue("#role", "Brankář");\n        updateEntryFormVisibility();\n      }\n    }, 0);\n  });';
    const patchedJs = originalJs.replace(brokenLine, fixedLine);

    const patchedResponse = new Response(patchedJs, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
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

  if (url.pathname.endsWith("/app.js")) {
    event.respondWith(fetchPatchedApp(event.request));
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
