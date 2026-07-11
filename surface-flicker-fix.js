const surfaceFlickerState = {
  client: null,
  clientPromise: null,
  surfacesById: new Map(),
  observer: null,
  bodyObserver: null,
  refreshPromise: null,
};

const $surfaceFlicker = (selector) => document.querySelector(selector);
const CACHE_KEY = "sportovni-denik-surface-cache-v1";

function loadSurfaceCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
    surfaceFlickerState.surfacesById = new Map(
      Array.isArray(cached)
        ? cached.filter(
            (item) =>
              Array.isArray(item) &&
              item.length === 2 &&
              item[0] &&
              typeof item[1] === "string"
          )
        : []
    );
  } catch (error) {
    console.warn("Mezipaměť povrchů se nepodařilo načíst.", error);
  }
}

function saveSurfaceCache() {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify([...surfaceFlickerState.surfacesById.entries()])
    );
  } catch (error) {
    console.warn("Mezipaměť povrchů se nepodařilo uložit.", error);
  }
}

function entryIdFromCard(card) {
  return card.querySelector("[data-edit-entry]")?.dataset.editEntry || null;
}

function addSurfaceBadge(card) {
  if (!(card instanceof Element)) return;

  const entryId = entryIdFromCard(card);
  if (!entryId) return;

  const surface = surfaceFlickerState.surfacesById.get(String(entryId));
  const existing = card.querySelector('[data-surface-badge="true"]');

  if (!surface) {
    existing?.remove();
    return;
  }

  if (existing) {
    if (existing.textContent !== surface) existing.textContent = surface;
    return;
  }

  const badges = card.querySelector(".badges");
  if (!badges) return;

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.dataset.surfaceBadge = "true";
  badge.textContent = surface;
  badges.appendChild(badge);
}

function annotateSurfaceNode(node) {
  if (!(node instanceof Element)) return;

  if (node.matches?.(".record-card")) addSurfaceBadge(node);
  node.querySelectorAll?.(".record-card").forEach(addSurfaceBadge);
}

function annotateAllSurfaceCards() {
  $surfaceFlicker("#records-list")
    ?.querySelectorAll(".record-card")
    .forEach(addSurfaceBadge);
}

async function getSurfaceFlickerClient() {
  if (surfaceFlickerState.client) return surfaceFlickerState.client;

  if (!surfaceFlickerState.clientPromise) {
    surfaceFlickerState.clientPromise = (async () => {
      const [{ createClient }, config] = await Promise.all([
        import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"),
        import("./config.js"),
      ]);

      return createClient(
        config.SUPABASE_URL,
        config.SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        }
      );
    })();
  }

  surfaceFlickerState.client = await surfaceFlickerState.clientPromise;
  return surfaceFlickerState.client;
}

async function refreshSurfaceFlickerMap() {
  if (surfaceFlickerState.refreshPromise) {
    return surfaceFlickerState.refreshPromise;
  }

  surfaceFlickerState.refreshPromise = (async () => {
    try {
      const client = await getSurfaceFlickerClient();
      const { data, error } = await client
        .from("sport_entries")
        .select("id, surface");

      if (error) throw error;

      surfaceFlickerState.surfacesById = new Map(
        (data || [])
          .filter((row) => row.id && row.surface)
          .map((row) => [String(row.id), row.surface])
      );

      saveSurfaceCache();
      annotateAllSurfaceCards();
    } catch (error) {
      console.warn("Povrchy pro okamžité vykreslení se nepodařilo načíst.", error);
    } finally {
      surfaceFlickerState.refreshPromise = null;
    }
  })();

  return surfaceFlickerState.refreshPromise;
}

function installSurfaceRecordsObserver() {
  const recordsList = $surfaceFlicker("#records-list");
  if (!recordsList || surfaceFlickerState.observer) return;

  surfaceFlickerState.observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(annotateSurfaceNode);
    });

    // MutationObserver proběhne před vykreslením dalšího snímku.
    annotateAllSurfaceCards();
  });

  surfaceFlickerState.observer.observe(recordsList, {
    childList: true,
    subtree: true,
  });

  annotateAllSurfaceCards();
}

function waitForRecordsList() {
  installSurfaceRecordsObserver();

  if (surfaceFlickerState.observer || surfaceFlickerState.bodyObserver) return;

  surfaceFlickerState.bodyObserver = new MutationObserver(() => {
    installSurfaceRecordsObserver();

    if (surfaceFlickerState.observer) {
      surfaceFlickerState.bodyObserver.disconnect();
      surfaceFlickerState.bodyObserver = null;
    }
  });

  surfaceFlickerState.bodyObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function refreshAfterEntrySave() {
  let attempts = 0;

  const timer = setInterval(() => {
    attempts += 1;

    if ($surfaceFlicker("#page-records")?.classList.contains("active")) {
      clearInterval(timer);
      refreshSurfaceFlickerMap();
      return;
    }

    if (attempts >= 25) clearInterval(timer);
  }, 200);
}

function bindSurfaceFlickerEvents() {
  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest('.nav-tabs button[data-page="records"]')) {
        // Staré hodnoty jsou vložené synchronně z mezipaměti.
        annotateAllSurfaceCards();
        refreshSurfaceFlickerMap();
        requestAnimationFrame(annotateAllSurfaceCards);
        return;
      }

      if (
        event.target.closest(
          "[data-edit-entry], [data-delete-entry], " +
            "#records-sport, #records-season, #records-type"
        )
      ) {
        requestAnimationFrame(annotateAllSurfaceCards);
      }
    },
    true
  );

  $surfaceFlicker("#entry-form")?.addEventListener(
    "submit",
    refreshAfterEntrySave,
    true
  );

  ["#records-sport", "#records-season", "#records-type"].forEach((selector) => {
    $surfaceFlicker(selector)?.addEventListener("change", () => {
      queueMicrotask(annotateAllSurfaceCards);
      requestAnimationFrame(annotateAllSurfaceCards);
    });
  });
}

loadSurfaceCache();
waitForRecordsList();
bindSurfaceFlickerEvents();
annotateAllSurfaceCards();

setTimeout(refreshSurfaceFlickerMap, 150);
