const gkState = {
  client: null,
  clientPromise: null,
  editingId: null,
  schemaReady: null,
  statsById: new Map(),
  annotateTimer: null,
};

const $gk = (selector) => document.querySelector(selector);

const FIELDS = [
  ["shots_on_goal", "Střely na bránu", 0, null],
  ["saves", "Zákroky", 0, null],
  ["goals_from_cross", "Góly po přihrávce přes brankoviště", 0, null],
  ["goals_from_rebound", "Góly z dorážek", 0, null],
  ["goals_from_breakaway", "Góly z přečíslení / samostatného úniku", 0, null],
  ["goals_from_distance", "Góly ze střely z dálky", 0, null],
  ["communication_rating", "Komunikace 1–10", 1, 10],
  ["movement_rating", "Pohyb 1–10", 1, 10],
  ["positioning_rating", "Poziční hra 1–10", 1, 10],
];

function showGkToast(message, type = "ok") {
  const toast = $gk("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type === "error" ? "error" : ""}`;
  clearTimeout(showGkToast.timer);
  showGkToast.timer = setTimeout(() => {
    toast.className = "toast";
  }, 4000);
}

function numberOrNull(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number.parseInt(text, 10);
  return Number.isFinite(number) ? number : null;
}

function selectorForField(key) {
  return `#gk-${key.replaceAll("_", "-")}`;
}

function isGoalkeeperMatch() {
  const eventType = $gk("#event-type")?.value;
  const sport = $gk("#sport")?.value;
  const role = $gk("#role")?.value;
  return eventType === "Zápas" && (sport === "Florbal" || role === "Brankář");
}

function collectStats() {
  if (!$gk("#gk-stats-enabled")?.checked || !isGoalkeeperMatch()) return null;

  const stats = { version: 2 };
  let hasValue = false;

  FIELDS.forEach(([key]) => {
    const value = numberOrNull($gk(selectorForField(key))?.value);
    if (value !== null) {
      stats[key] = value;
      hasValue = true;
    }
  });

  return hasValue ? stats : null;
}

function validateStats(stats) {
  if (!stats) return null;

  for (const [key, label, min, max] of FIELDS) {
    const value = stats[key];
    if (value === undefined) continue;

    if (!Number.isInteger(value) || value < min || (max !== null && value > max)) {
      return `${label} musí být celé číslo${max === null ? ` od ${min}` : ` v rozsahu ${min}–${max}`}.`;
    }
  }

  if (
    stats.shots_on_goal !== undefined &&
    stats.saves !== undefined &&
    stats.saves > stats.shots_on_goal
  ) {
    return "Počet zákroků nemůže být vyšší než počet střel na bránu.";
  }

  return null;
}

function updateSavePercentage() {
  const shots = numberOrNull($gk("#gk-shots-on-goal")?.value);
  const saves = numberOrNull($gk("#gk-saves")?.value);
  const output = $gk("#gk-save-percentage");
  if (!output) return;

  if (shots === null || saves === null || shots <= 0 || saves > shots) {
    output.textContent = "Úspěšnost zákroků se vypočítá po zadání střel a zákroků.";
    return;
  }

  output.textContent = `Vypočtená úspěšnost zákroků: ${((saves / shots) * 100)
    .toFixed(1)
    .replace(".", ",")} %`;
}

function updateVisibility() {
  const wrapper = $gk("#gk-stats-wrapper");
  const fields = $gk("#gk-stats-fields");
  const checkbox = $gk("#gk-stats-enabled");
  if (!wrapper || !fields || !checkbox) return;

  const relevant = isGoalkeeperMatch();
  wrapper.classList.toggle("hidden", !relevant);
  fields.classList.toggle("hidden", !relevant || !checkbox.checked);
}

function clearStats() {
  const checkbox = $gk("#gk-stats-enabled");
  if (checkbox) checkbox.checked = false;

  FIELDS.forEach(([key]) => {
    const field = $gk(selectorForField(key));
    if (field) field.value = "";
  });

  updateVisibility();
  updateSavePercentage();
}

function fillStats(stats) {
  const checkbox = $gk("#gk-stats-enabled");
  if (!checkbox) return;

  const hasData = Boolean(
    stats &&
      typeof stats === "object" &&
      Object.keys(stats).some((key) => key !== "version")
  );

  checkbox.checked = hasData;

  FIELDS.forEach(([key]) => {
    const field = $gk(selectorForField(key));
    if (field) field.value = stats?.[key] ?? "";
  });

  updateVisibility();
  updateSavePercentage();
}

function installFetchPatch() {
  if (window.__goalkeeperStatsFetchPatched) return;
  window.__goalkeeperStatsFetchPatched = true;

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
        const stats = collectStats();
        const shouldClearExisting = Boolean(gkState.editingId) && !stats;

        if (stats || shouldClearExisting) {
          const parsedBody = JSON.parse(init.body);
          const addStats = (row) => ({ ...row, goalkeeper_stats: stats });

          nextInit = {
            ...init,
            body: JSON.stringify(
              Array.isArray(parsedBody)
                ? parsedBody.map(addStats)
                : addStats(parsedBody)
            ),
          };
        }
      }
    } catch (error) {
      console.warn(
        "Rozšířené brankářské statistiky nebylo možné přidat k požadavku.",
        error
      );
    }

    return originalFetch(input, nextInit);
  };
}

function injectStyles() {
  if ($gk("#gk-stats-v2-styles")) return;

  const style = document.createElement("style");
  style.id = "gk-stats-v2-styles";
  style.textContent = `
    .gk-stats-wrapper {
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 15px;
      background: #f8fbff;
    }
    .gk-stats-toggle {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      cursor: pointer;
    }
    .gk-stats-toggle input {
      width: 20px;
      height: 20px;
      margin: 0;
      flex: 0 0 auto;
    }
    .gk-stats-description {
      margin: 7px 0 0 30px;
    }
    .gk-stats-fields {
      margin-top: 15px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 13px;
    }
    .gk-stats-fields label {
      min-width: 0;
    }
    .gk-stats-percentage {
      grid-column: 1 / -1;
      margin: 0;
      padding: 10px 12px;
      border-radius: 11px;
      background: white;
      border: 1px solid var(--line);
    }
    .gk-schema-warning {
      margin: 12px 0 0;
      padding: 10px 12px;
      border-radius: 11px;
      background: #fff7df;
      border: 1px solid #ead28c;
      color: #6b5410;
    }
    .gk-record-summary {
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: #f3f7fd;
      border: 1px solid var(--line);
      font-size: .84rem;
      line-height: 1.55;
    }
    .gk-record-summary strong {
      color: var(--blue-dark);
    }
    @media (max-width: 820px) {
      .gk-stats-fields {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 520px) {
      .gk-stats-fields {
        grid-template-columns: 1fr;
      }
      .gk-stats-description {
        margin-left: 0;
      }
    }
  `;

  document.head.appendChild(style);
}

function injectUi() {
  if ($gk("#gk-stats-wrapper")) return;

  const matchFields = $gk("#match-fields");
  if (!matchFields) return;

  const wrapper = document.createElement("div");
  wrapper.id = "gk-stats-wrapper";
  wrapper.className = "gk-stats-wrapper span-all hidden";
  wrapper.innerHTML = `
    <label class="gk-stats-toggle">
      <input id="gk-stats-enabled" type="checkbox">
      <span>Rozšířené brankářské statistiky</span>
    </label>
    <p class="muted small gk-stats-description">
      Volitelné údaje. Nevyplněná pole se do statistik nepočítají jako nula.
    </p>
    <p id="gk-schema-warning" class="gk-schema-warning hidden">
      Databáze zatím nemá sloupec pro rozšířené statistiky.
    </p>
    <div id="gk-stats-fields" class="gk-stats-fields hidden">
      ${FIELDS.map(
        ([key, label, min, max]) => `
          <label>
            ${label}
            <input
              id="gk-${key.replaceAll("_", "-")}"
              type="number"
              min="${min}"
              ${max === null ? "" : `max="${max}"`}
              inputmode="numeric"
            >
          </label>
        `
      ).join("")}
      <p id="gk-save-percentage" class="muted small gk-stats-percentage"></p>
    </div>
  `;

  matchFields.insertAdjacentElement("afterend", wrapper);

  $gk("#gk-stats-enabled")?.addEventListener("change", updateVisibility);
  $gk("#gk-shots-on-goal")?.addEventListener("input", updateSavePercentage);
  $gk("#gk-saves")?.addEventListener("input", updateSavePercentage);

  ["#event-type", "#sport", "#role"].forEach((selector) => {
    $gk(selector)?.addEventListener("change", updateVisibility);
  });

  updateVisibility();
  updateSavePercentage();
}

async function getClient() {
  if (gkState.client) return gkState.client;

  if (!gkState.clientPromise) {
    gkState.clientPromise = (async () => {
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

  gkState.client = await gkState.clientPromise;
  return gkState.client;
}

async function checkSchema() {
  try {
    const client = await getClient();
    const { error } = await client
      .from("sport_entries")
      .select("goalkeeper_stats")
      .limit(1);

    gkState.schemaReady = !error;
  } catch (error) {
    console.warn("Kontrola sloupce goalkeeper_stats selhala.", error);
    gkState.schemaReady = false;
  }

  $gk("#gk-schema-warning")?.classList.toggle(
    "hidden",
    gkState.schemaReady !== false
  );
}

async function loadStatsForEdit(id) {
  try {
    const client = await getClient();
    const { data, error } = await client
      .from("sport_entries")
      .select("id, goalkeeper_stats")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    fillStats(data?.goalkeeper_stats || null);
  } catch (error) {
    console.warn("Rozšířené statistiky záznamu se nepodařilo načíst.", error);
    fillStats(null);
  }
}

function statsSummary(stats) {
  if (!stats || typeof stats !== "object") return "";

  const firstLine = [];
  const secondLine = [];

  if (Number.isFinite(stats.shots_on_goal)) {
    firstLine.push(`${stats.shots_on_goal} střel`);
  }
  if (Number.isFinite(stats.saves)) {
    firstLine.push(`${stats.saves} zákroků`);
  }
  if (
    Number.isFinite(stats.shots_on_goal) &&
    stats.shots_on_goal > 0 &&
    Number.isFinite(stats.saves)
  ) {
    firstLine.push(
      `úspěšnost ${((stats.saves / stats.shots_on_goal) * 100)
        .toFixed(1)
        .replace(".", ",")} %`
    );
  }

  if (Number.isFinite(stats.goals_from_cross)) {
    secondLine.push(`cross ${stats.goals_from_cross}`);
  }
  if (Number.isFinite(stats.goals_from_rebound)) {
    secondLine.push(`dorážky ${stats.goals_from_rebound}`);
  }
  if (Number.isFinite(stats.goals_from_breakaway)) {
    secondLine.push(`přečíslení/úniky ${stats.goals_from_breakaway}`);
  }
  if (Number.isFinite(stats.goals_from_distance)) {
    secondLine.push(`z dálky ${stats.goals_from_distance}`);
  }
  if (Number.isFinite(stats.communication_rating)) {
    secondLine.push(`komunikace ${stats.communication_rating}/10`);
  }
  if (Number.isFinite(stats.movement_rating)) {
    secondLine.push(`pohyb ${stats.movement_rating}/10`);
  }
  if (Number.isFinite(stats.positioning_rating)) {
    secondLine.push(`pozice ${stats.positioning_rating}/10`);
  }

  return [firstLine.join(" · "), secondLine.join(" · ")]
    .filter(Boolean)
    .join("<br>");
}

function annotateRecords() {
  document.querySelectorAll("#records-list .record-card").forEach((card) => {
    const id = card.querySelector("[data-edit-entry]")?.dataset.editEntry;
    if (!id) return;

    card.querySelector(".gk-record-summary")?.remove();

    const summary = statsSummary(gkState.statsById.get(id));
    if (!summary) return;

    const box = document.createElement("div");
    box.className = "gk-record-summary";
    box.innerHTML = `<strong>Rozšířené brankářské statistiky</strong><br>${summary}`;
    card.querySelector(".record-main")?.appendChild(box);
  });
}

function scheduleAnnotate(delay = 120) {
  clearTimeout(gkState.annotateTimer);
  gkState.annotateTimer = setTimeout(annotateRecords, delay);
}

async function refreshStatsMap() {
  if (gkState.schemaReady === false) return;

  try {
    const client = await getClient();
    const { data, error } = await client
      .from("sport_entries")
      .select("id, goalkeeper_stats");

    if (error) throw error;

    gkState.statsById = new Map(
      (data || []).map((row) => [row.id, row.goalkeeper_stats])
    );

    scheduleAnnotate(0);
  } catch (error) {
    console.warn("Rozšířené statistiky se nepodařilo načíst.", error);
  }
}

function waitForSuccessfulSave() {
  let attempts = 0;

  const timer = setInterval(() => {
    attempts += 1;

    const recordsActive = $gk("#page-records")?.classList.contains("active");
    if (recordsActive) {
      clearInterval(timer);
      gkState.editingId = null;
      clearStats();
      refreshStatsMap();
      return;
    }

    if (attempts >= 20) clearInterval(timer);
  }, 300);
}

function bindEvents() {
  const form = $gk("#entry-form");

  form?.addEventListener(
    "submit",
    (event) => {
      const stats = collectStats();
      const validationError = validateStats(stats);

      if (validationError) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showGkToast(validationError, "error");
        return;
      }

      if (stats && gkState.schemaReady === false) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showGkToast(
          "Databáze nemá připravený sloupec goalkeeper_stats.",
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
        gkState.editingId = editButton.dataset.editEntry;
        setTimeout(() => loadStatsForEdit(gkState.editingId), 80);
        return;
      }

      if (event.target.closest("#cancel-edit-btn")) {
        gkState.editingId = null;
        setTimeout(clearStats, 0);
        return;
      }

      if (event.target.closest('#entry-form button[type="reset"]')) {
        gkState.editingId = null;
        setTimeout(clearStats, 0);
        return;
      }

      if (event.target.closest("[data-quick-template], #repeat-last-entry-btn")) {
        gkState.editingId = null;
        setTimeout(clearStats, 0);
        return;
      }

      if (event.target.closest('.nav-tabs button[data-page="records"]')) {
        setTimeout(refreshStatsMap, 220);
      }
    },
    true
  );

  ["#records-sport", "#records-season", "#records-type"].forEach(
    (selector) => {
      $gk(selector)?.addEventListener("change", () => scheduleAnnotate(160));
    }
  );
}

installFetchPatch();
injectStyles();
injectUi();
bindEvents();

setTimeout(async () => {
  await checkSchema();
  if (gkState.schemaReady) await refreshStatsMap();
}, 250);
