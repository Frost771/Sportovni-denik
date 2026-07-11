const otherSurfaceState = {
  client: null,
  clientPromise: null,
};

const $otherSurface = (selector) => document.querySelector(selector);

const PRESETS = {
  Fotbal: ["Přírodní tráva", "Umělá tráva", "Hala"],
  Florbal: ["Parkety", "Sportovní PVC / taraflex"],
};

function showOtherSurfaceToast(message) {
  const toast = $otherSurface("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = "toast show error";
  clearTimeout(showOtherSurfaceToast.timer);
  showOtherSurfaceToast.timer = setTimeout(() => {
    toast.className = "toast";
  }, 4000);
}

function injectOtherSurfaceField() {
  if ($otherSurface("#surface-other-label")) return;

  const surfaceLabel = $otherSurface("#surface-label");
  if (!surfaceLabel) return;

  const label = document.createElement("label");
  label.id = "surface-other-label";
  label.className = "hidden";
  label.innerHTML = `
    Upřesnit povrch
    <input
      id="surface-other"
      type="text"
      maxlength="80"
      placeholder="Napiš typ povrchu"
      autocomplete="off"
    >
  `;

  surfaceLabel.insertAdjacentElement("afterend", label);
}

function updateOtherSurfaceVisibility({ clearWhenHidden = true } = {}) {
  const select = $otherSurface("#surface");
  const label = $otherSurface("#surface-other-label");
  const input = $otherSurface("#surface-other");
  if (!select || !label || !input) return;

  const isOther = select.value === "Jiné";
  label.classList.toggle("hidden", !isOther);
  input.required = isOther;

  if (!isOther && clearWhenHidden) input.value = "";
}

function selectedSurface() {
  const selected = $otherSurface("#surface")?.value?.trim() || "";
  if (selected !== "Jiné") return selected || null;
  return $otherSurface("#surface-other")?.value?.trim() || null;
}

function applyStoredSurface(surface, sport = null) {
  const select = $otherSurface("#surface");
  const input = $otherSurface("#surface-other");
  if (!select || !input) return;

  const currentSport = sport || $otherSurface("#sport")?.value || "Florbal";
  const presets = PRESETS[currentSport] || [];

  if (!surface) {
    select.value = "";
    input.value = "";
  } else if (presets.includes(surface)) {
    select.value = surface;
    input.value = "";
  } else {
    select.value = "Jiné";
    input.value = surface === "Jiné" ? "" : surface;
  }

  updateOtherSurfaceVisibility({ clearWhenHidden: false });
}

async function getOtherSurfaceClient() {
  if (otherSurfaceState.client) return otherSurfaceState.client;

  if (!otherSurfaceState.clientPromise) {
    otherSurfaceState.clientPromise = (async () => {
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

  otherSurfaceState.client = await otherSurfaceState.clientPromise;
  return otherSurfaceState.client;
}

async function loadStoredSurface(id) {
  try {
    const client = await getOtherSurfaceClient();
    const { data, error } = await client
      .from("sport_entries")
      .select("sport, surface")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    applyStoredSurface(data?.surface || null, data?.sport || null);
  } catch (error) {
    console.warn("Vlastní povrch se nepodařilo načíst.", error);
  }
}

async function loadLastStoredSurface() {
  try {
    const client = await getOtherSurfaceClient();
    const { data, error } = await client
      .from("sport_entries")
      .select("sport, surface")
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    setTimeout(
      () => applyStoredSurface(data?.surface || null, data?.sport || null),
      180
    );
  } catch (error) {
    console.warn("Vlastní povrch posledního záznamu se nepodařilo načíst.", error);
  }
}

function installOtherSurfaceFetchPatch() {
  if (window.__otherSurfaceFetchPatched) return;
  window.__otherSurfaceFetchPatched = true;

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
        const addSurface = (row) => ({ ...row, surface: selectedSurface() });

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
      console.warn("Vlastní povrch nebylo možné přidat k požadavku.", error);
    }

    return originalFetch(input, nextInit);
  };
}

function bindOtherSurfaceEvents() {
  $otherSurface("#surface")?.addEventListener("change", () => {
    updateOtherSurfaceVisibility();
    if ($otherSurface("#surface")?.value === "Jiné") {
      $otherSurface("#surface-other")?.focus();
    }
  });

  $otherSurface("#sport")?.addEventListener("change", () => {
    setTimeout(() => updateOtherSurfaceVisibility(), 0);
  });

  $otherSurface("#entry-form")?.addEventListener(
    "submit",
    (event) => {
      if (
        $otherSurface("#surface")?.value === "Jiné" &&
        !$otherSurface("#surface-other")?.value?.trim()
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showOtherSurfaceToast("Doplň vlastní typ povrchu.");
        $otherSurface("#surface-other")?.focus();
      }
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      const editButton = event.target.closest("[data-edit-entry]");
      if (editButton) {
        setTimeout(() => loadStoredSurface(editButton.dataset.editEntry), 120);
        return;
      }

      if (event.target.closest("#repeat-last-entry-btn")) {
        loadLastStoredSurface();
        return;
      }

      if (
        event.target.closest(
          '#cancel-edit-btn, #entry-form button[type="reset"], [data-quick-template]'
        )
      ) {
        setTimeout(() => applyStoredSurface(null), 0);
      }
    },
    true
  );
}

injectOtherSurfaceField();
installOtherSurfaceFetchPatch();
bindOtherSurfaceEvents();
updateOtherSurfaceVisibility();
