const surfaceState = {
  client: null,
  clientPromise: null,
  editingId: null,
  schemaReady: null,
  surfacesById: new Map(),
  annotateTimer: null,
};

const $surface = (selector) => document.querySelector(selector);

const SURFACES = {
  Fotbal: ["Přírodní tráva", "Umělá tráva", "Hala", "Jiné"],
  Florbal: ["Parkety", "Sportovní PVC / taraflex", "Jiné"],
};

function showSurfaceToast(message, type = "ok") {
  const toast = $surface("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type === "error" ? "error" : ""}`;
  clearTimeout(showSurfaceToast.timer);
  showSurfaceToast.timer = setTimeout(() => {
    toast.className = "toast";
  }, 4000);
}

function currentSurface() {
  return $surface("#surface")?.value?.trim() || null;
}

function updateSurfaceOptions(preferredValue = null) {
  const select = $surface("#surface");
  if (!select) return;

  const sport = $surface("#sport")?.value || "Florbal";
  const options = SURFACES[sport] || ["Jiné"];
  const current = preferredValue ?? select.value;

  select.innerHTML =
    `<option value="">Nevybráno</option>` +
    options.map((surface) => `<option value="${surface}">${surface}</option>`).join("");

  select.value = options.includes(current) ? current : "";
}

function clearSurface() {
  updateSurfaceOptions("");
}

function installFetchPatch() {
  if (window.__surfaceFetchPatched) return;
  window.__surfaceFetchPatched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    let nextInit = init;

    try {
      const url = typeof input === "string" ? input : input?.url || "";
      const method = String(init?.method || input?.method || "GET").toUpperCase();
      const isEntryWrite =
        url.includes("/rest/v1/sport_entries") &&
        (method === "POST" || method === "PATCH");

      if (isEntryWrite && typeof init?.body === "string") {
        const parsedBody = JSON.parse(init.body);
        const addSurface = (row) => ({ ...row, surface: currentSurface() });

        nextInit = {
          ...init,
          body: JSON.stringify(
            Array.isArray(parsedBody)
              ? parsedBody.map(addSurface)
              : addSurface(parsedBody)
          ),
        };
      }
    } catch (error) {
      console.warn("Povrch nebylo možné přidat k požadavku.", error);
    }

    return originalFetch(input, nextInit);
  };
}

function injectUi() {
  if ($surface("#surface-label")) return;

  const seasonLabel = $surface("#season")?.closest("label");
  if (!seasonLabel) return;

  const label = document.createElement("label");
  label.id = "surface-label";
  label.innerHTML = `
    Povrch
    <select id="surface">
      <option value="">Nevybráno</option>
    </select>
    <span id="surface-schema-warning" class="surface-schema-warning hidden">
      Databáze zatím nemá sloupec pro povrch.
    </span>
  `;

  seasonLabel.insertAdjacentElement("afterend", label);
  updateSurfaceOptions();

  $surface("#sport")?.addEventListener("change", () => updateSurfaceOptions());
}

function injectStyles() {
  if ($surface("#surface-styles")) return;

  const style = document.createElement("style");
  style.id = "surface-styles";
  style.textContent = `
    .surface-schema-warning {
      display: block;
      margin-top: 7px;
      padding: 8px 10px;
      border-radius: 10px;
      background: #fff7df;
      border: 1px solid #ead28c;
      color: #6b5410;
      font-size: .76rem;
      line-height: 1.35;
    }
  `;

  document.head.appendChild(style);
}

async function getClient() {
  if (surfaceState.client) return surfaceState.client;

  if (!surfaceState.clientPromise) {
    surfaceState.clientPromise = (async () => {
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

  surfaceState.client = await surfaceState.clientPromise;
  return surfaceState.client;
}

async function checkSchema() {
  try {
    const client = await getClient();
    const { error } = await client
      .from("sport_entries")
      .select("surface")
      .limit(1);

    surfaceState.schemaReady = !error;
  } catch (error) {
    console.warn("Kontrola sloupce surface selhala.", error);
    surfaceState.schemaReady = false;
  }

  $surface("#surface-schema-warning")?.classList.toggle(
    "hidden",
    surfaceState.schemaReady !== false
  );
}

async function loadSurfaceForEdit(id) {
  try {
    const client = await getClient();
    const { data, error } = await client
      .from("sport_entries")
      .select("id, sport, surface")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    updateSurfaceOptions(data?.surface || "");
  } catch (error) {
    console.warn("Povrch záznamu se nepodařilo načíst.", error);
    clearSurface();
  }
}

async function loadSurfaceForRepeatedEntry() {
  try {
    const client = await getClient();
    const { data, error } = await client
      .from("sport_entries")
      .select("surface")
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    setTimeout(() => updateSurfaceOptions(data?.surface || ""), 120);
  } catch (error) {
    console.warn("Povrch posledního záznamu se nepodařilo načíst.", error);
  }
}

function annotateRecords() {
  document.querySelectorAll("#records-list .record-card").forEach((card) => {
    const id = card.querySelector("[data-edit-entry]")?.dataset.editEntry;
    if (!id) return;

    card.querySelector('[data-surface-badge="true"]')?.remove();

    const surface = surfaceState.surfacesById.get(id);
    if (!surface) return;

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.dataset.surfaceBadge = "true";
    badge.textContent = surface;
    card.querySelector(".badges")?.appendChild(badge);
  });
}

function scheduleAnnotate(delay = 120) {
  clearTimeout(surfaceState.annotateTimer);
  surfaceState.annotateTimer = setTimeout(annotateRecords, delay);
}

async function refreshSurfaceMap() {
  if (surfaceState.schemaReady === false) return;

  try {
    const client = await getClient();
    const { data, error } = await client
      .from("sport_entries")
      .select("id, surface");

    if (error) throw error;

    surfaceState.surfacesById = new Map(
      (data || []).map((row) => [row.id, row.surface])
    );

    scheduleAnnotate(0);
  } catch (error) {
    console.warn("Povrchy záznamů se nepodařilo načíst.", error);
  }
}

function waitForSuccessfulSave() {
  let attempts = 0;

  const timer = setInterval(() => {
    attempts += 1;

    if ($surface("#page-records")?.classList.contains("active")) {
      clearInterval(timer);
      surfaceState.editingId = null;
      clearSurface();
      refreshSurfaceMap();
      return;
    }

    if (attempts >= 20) clearInterval(timer);
  }, 300);
}

function bindEvents() {
  $surface("#entry-form")?.addEventListener(
    "submit",
    (event) => {
      if (currentSurface() && surfaceState.schemaReady === false) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showSurfaceToast(
          "Nejdřív spusť SQL migraci pro sloupec surface.",
          "error"
        );
        return;
      }

      waitForSuccessfulSave();
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      const editButton = event.target.closest("[data-edit-entry]");
      if (editButton) {
        surfaceState.editingId = editButton.dataset.editEntry;
        setTimeout(() => loadSurfaceForEdit(surfaceState.editingId), 80);
        return;
      }

      if (
        event.target.closest(
          '#cancel-edit-btn, #entry-form button[type="reset"], [data-quick-template]'
        )
      ) {
        surfaceState.editingId = null;
        setTimeout(clearSurface, 0);
        return;
      }

      if (event.target.closest("#repeat-last-entry-btn")) {
        surfaceState.editingId = null;
        loadSurfaceForRepeatedEntry();
        return;
      }

      if (event.target.closest('.nav-tabs button[data-page="records"]')) {
        setTimeout(refreshSurfaceMap, 220);
      }
    },
    true
  );

  ["#records-sport", "#records-season", "#records-type"].forEach((selector) => {
    $surface(selector)?.addEventListener("change", () => scheduleAnnotate(160));
  });
}

installFetchPatch();
injectStyles();
injectUi();
bindEvents();

setTimeout(async () => {
  await checkSchema();
  if (surfaceState.schemaReady) await refreshSurfaceMap();
}, 250);
