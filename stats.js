import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const statsState = {
  client: null,
  entries: [],
  seasons: [],
  selectionReady: false,
};

const $stats = (selector) => document.querySelector(selector);

function safeText(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function average(values) {
  const numbers = values.filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
}

function shortDate(iso) {
  if (!iso) return "";
  const [, month, day] = iso.split("-");
  return `${day}.${month}.`;
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("cs-CZ", { month: "short", year: "2-digit" })
    .format(new Date(year, month - 1, 1));
}

function injectStyles() {
  if ($stats("#stats-module-styles")) return;
  const style = document.createElement("style");
  style.id = "stats-module-styles";
  style.textContent = `
    .nav-tabs { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; }
    .stats-filter-label { min-width: 170px; color: var(--muted); font-size: .78rem; gap: 5px; }
    .stats-filter-label select { color: var(--ink); font-size: .93rem; }
    .stats-selection-note { margin: -6px 0 16px; }
    .stats-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .stats-chart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .stats-chart-card { min-width: 0; background: white; border: 1px solid var(--line); border-radius: 20px; padding: 18px; box-shadow: var(--shadow); }
    .stats-chart-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
    .stats-chart-heading h3 { margin: 0; font-size: 1rem; }
    .stats-chart-heading span { color: var(--muted); font-size: .78rem; text-align: right; }
    .stats-chart-scroll { overflow-x: auto; padding: 4px 2px 6px; }
    .stats-chart-columns { display: flex; align-items: flex-end; gap: 9px; min-width: 100%; height: 230px; }
    .stats-chart-column { flex: 1 0 48px; min-width: 48px; height: 100%; display: grid; grid-template-rows: 25px 1fr 28px; gap: 6px; text-align: center; }
    .stats-chart-column strong { font-size: .72rem; align-self: end; }
    .stats-chart-column > span { color: var(--muted); font-size: .68rem; line-height: 1.15; overflow-wrap: anywhere; }
    .stats-chart-track { position: relative; align-self: stretch; border-radius: 9px 9px 5px 5px; background: #eef3fb; overflow: hidden; }
    .stats-chart-fill { position: absolute; left: 0; right: 0; bottom: 0; border-radius: 9px 9px 5px 5px; background: linear-gradient(180deg, var(--blue), var(--blue-dark)); }
    .stats-chart-empty { min-height: 180px; display: grid; place-items: center; padding: 20px; color: var(--muted); text-align: center; border: 1px dashed #bdc7d8; border-radius: 14px; }
    .stats-result-chart { display: grid; gap: 17px; padding: 24px 2px; }
    .stats-result-row { display: grid; grid-template-columns: 72px 1fr 28px; align-items: center; gap: 10px; }
    .stats-result-row span { color: var(--muted); font-size: .86rem; }
    .stats-result-row strong { text-align: right; }
    .stats-result-track { height: 18px; border-radius: 999px; background: #eef3fb; overflow: hidden; }
    .stats-result-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--blue-dark), var(--blue)); }
    @media (max-width: 900px) {
      .stats-chart-grid { grid-template-columns: 1fr; }
      .stats-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 650px) {
      .nav-tabs { grid-template-columns: repeat(6, minmax(78px, 1fr)) !important; }
      .stats-filter-label { min-width: 0; flex: 1 1 145px; }
      .stats-chart-card { padding: 15px; }
      .stats-chart-columns { height: 205px; }
    }
    @media (max-width: 390px) {
      .stats-summary { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}

function injectUi() {
  if ($stats("#page-stats")) return;

  const dashboardButton = $stats('.nav-tabs button[data-page="dashboard"]');
  const nav = $stats(".nav-tabs");
  const dashboardPage = $stats("#page-dashboard");
  if (!dashboardButton || !nav || !dashboardPage) return;

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.page = "stats";
  button.textContent = "Statistiky";
  dashboardButton.insertAdjacentElement("afterend", button);

  const section = document.createElement("section");
  section.id = "page-stats";
  section.className = "page";
  section.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Vývoj v sezóně</p>
        <h2>Statistiky a grafy</h2>
      </div>
      <div class="inline-filters">
        <label class="stats-filter-label">
          Sport
          <select id="stats-sport">
            <option value="Florbal">Florbal</option>
            <option value="Fotbal">Fotbal</option>
          </select>
        </label>
        <label class="stats-filter-label">
          Sezóna
          <select id="stats-season"><option value="">Načítám…</option></select>
        </label>
      </div>
    </div>
    <p id="stats-selection-note" class="muted small stats-selection-note"></p>
    <div id="stats-summary" class="stats-grid stats-summary"></div>
    <div class="stats-chart-grid">
      <article class="stats-chart-card">
        <div class="stats-chart-heading"><h3>Tréninkový čas po měsících</h3><span>hodiny</span></div>
        <div id="stats-training-time"></div>
      </article>
      <article class="stats-chart-card">
        <div class="stats-chart-heading"><h3>Hodnocení zápasů</h3><span>1–10</span></div>
        <div id="stats-match-ratings"></div>
      </article>
      <article class="stats-chart-card">
        <div class="stats-chart-heading"><h3>Inkasované góly</h3><span>brankářské zápasy</span></div>
        <div id="stats-goals-conceded"></div>
      </article>
      <article class="stats-chart-card">
        <div class="stats-chart-heading"><h3>Bilance zápasů</h3><span>výhry · remízy · prohry</span></div>
        <div id="stats-results" class="stats-result-chart"></div>
      </article>
    </div>
  `;
  dashboardPage.insertAdjacentElement("afterend", section);

  button.addEventListener("click", loadAndRenderStats);
  $stats("#stats-sport").addEventListener("change", () => {
    refreshSeasonSelector(true);
    renderStats();
  });
  $stats("#stats-season").addEventListener("change", renderStats);
}

function activeSeason(sport) {
  return statsState.seasons.find((season) => season.sport === sport && season.status === "Aktivní");
}

function seasonsForSport(sport) {
  return statsState.seasons
    .filter((season) => season.sport === sport)
    .sort((a, b) => b.season.localeCompare(a.season, "cs"));
}

function refreshSeasonSelector(forceActive = false) {
  const sportSelect = $stats("#stats-sport");
  const seasonSelect = $stats("#stats-season");
  if (!sportSelect || !seasonSelect) return;

  const available = seasonsForSport(sportSelect.value);
  const previous = seasonSelect.value;
  const active = activeSeason(sportSelect.value);

  seasonSelect.innerHTML = available.length
    ? available.map((season) => `<option value="${safeText(season.season)}">${safeText(season.season)}${season.status === "Aktivní" ? " – aktivní" : ""}</option>`).join("")
    : '<option value="">Žádná sezóna</option>';

  if (!forceActive && available.some((season) => season.season === previous)) {
    seasonSelect.value = previous;
  } else if (active) {
    seasonSelect.value = active.season;
  } else if (available.length) {
    seasonSelect.value = available[0].season;
  }
}

function renderColumnChart(selector, rows, options = {}) {
  const container = $stats(selector);
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `<div class="stats-chart-empty">${safeText(options.emptyText || "Pro tento výběr nejsou data.")}</div>`;
    return;
  }

  const naturalMax = Math.max(...rows.map((row) => Number(row.value) || 0), 1);
  const maximum = Math.max(options.maxValue || 0, naturalMax);
  const decimals = options.decimals ?? 0;
  const suffix = options.suffix || "";

  container.innerHTML = `<div class="stats-chart-scroll"><div class="stats-chart-columns">${rows.map((row) => {
    const numeric = Number(row.value) || 0;
    const height = Math.max(numeric > 0 ? 4 : 0, Math.min(100, (numeric / maximum) * 100));
    const shown = numeric.toFixed(decimals).replace(".", ",");
    return `<div class="stats-chart-column">
      <strong>${shown}${safeText(suffix)}</strong>
      <div class="stats-chart-track"><div class="stats-chart-fill" style="height:${height}%"></div></div>
      <span>${safeText(row.label)}</span>
    </div>`;
  }).join("")}</div></div>`;
}

function renderResults(matches) {
  const container = $stats("#stats-results");
  if (!container) return;
  if (!matches.length) {
    container.innerHTML = '<div class="stats-chart-empty">V této sezóně zatím nejsou zápasy.</div>';
    return;
  }

  const rows = [
    ["Výhry", matches.filter((entry) => entry.result?.startsWith("Výhra")).length],
    ["Remízy", matches.filter((entry) => entry.result === "Remíza").length],
    ["Prohry", matches.filter((entry) => entry.result?.startsWith("Prohra")).length],
  ];
  const maximum = Math.max(...rows.map(([, count]) => count), 1);
  container.innerHTML = rows.map(([label, count]) => `
    <div class="stats-result-row">
      <span>${label}</span>
      <div class="stats-result-track"><div class="stats-result-fill" style="width:${(count / maximum) * 100}%"></div></div>
      <strong>${count}</strong>
    </div>
  `).join("");
}

function renderStats() {
  const sport = $stats("#stats-sport")?.value;
  const season = $stats("#stats-season")?.value;
  if (!sport || !season) {
    $stats("#stats-selection-note").textContent = "Pro tento sport zatím není založená sezóna.";
    $stats("#stats-summary").innerHTML = '<div class="empty span-all">Nejsou dostupná žádná data.</div>';
    ["#stats-training-time", "#stats-match-ratings", "#stats-goals-conceded", "#stats-results"].forEach((selector) => {
      $stats(selector).innerHTML = '<div class="stats-chart-empty">Nejsou dostupná žádná data.</div>';
    });
    return;
  }

  $stats("#stats-selection-note").textContent = `Zobrazen je pouze ${sport.toLowerCase()} v sezóně ${season}.`;
  const entries = statsState.entries
    .filter((entry) => entry.sport === sport && entry.season === season)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
  const trainings = entries.filter((entry) => entry.event_type === "Trénink");
  const matches = entries.filter((entry) => entry.event_type === "Zápas");
  const goalkeeperMatches = matches.filter((entry) =>
    (entry.role || "Brankář") === "Brankář" && Number.isFinite(entry.goals_conceded)
  );
  const trainingMinutes = trainings.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
  const ratings = matches.map((entry) => entry.rating).filter(Number.isFinite);
  const conceded = goalkeeperMatches.map((entry) => entry.goals_conceded).filter(Number.isFinite);
  const averageRating = average(ratings);
  const averageConceded = average(conceded);

  $stats("#stats-summary").innerHTML = [
    ["Záznamy", entries.length],
    ["Tréninky", trainings.length],
    ["Tréninkový čas", `${(trainingMinutes / 60).toFixed(1).replace(".", ",")} h`],
    ["Zápasy", matches.length],
    ["Průměrné hodnocení", averageRating === null ? "—" : `${averageRating.toFixed(2).replace(".", ",")}/10`],
    ["Průměr inkasovaných", averageConceded === null ? "—" : averageConceded.toFixed(2).replace(".", ",")],
  ].map(([label, number]) => `<div class="stat-card"><span>${label}</span><strong>${number}</strong></div>`).join("");

  const monthly = new Map();
  trainings.forEach((entry) => {
    const key = entry.event_date.slice(0, 7);
    monthly.set(key, (monthly.get(key) || 0) + (entry.duration_minutes || 0));
  });
  renderColumnChart("#stats-training-time", [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, minutes]) => ({ label: monthLabel(key), value: minutes / 60 })), {
      decimals: 1,
      suffix: " h",
      emptyText: "V této sezóně zatím nejsou tréninky.",
    });

  renderColumnChart("#stats-match-ratings", matches
    .filter((entry) => Number.isFinite(entry.rating))
    .map((entry) => ({ label: shortDate(entry.event_date), value: entry.rating })), {
      maxValue: 10,
      emptyText: "V této sezóně zatím nejsou hodnocené zápasy.",
    });

  renderColumnChart("#stats-goals-conceded", goalkeeperMatches
    .map((entry) => ({ label: shortDate(entry.event_date), value: entry.goals_conceded })), {
      emptyText: "V této sezóně zatím nejsou brankářské zápasy.",
    });

  renderResults(matches);
}

async function loadAndRenderStats() {
  if (!statsState.client) return;
  const note = $stats("#stats-selection-note");
  if (note) note.textContent = "Načítám statistiky…";

  const [{ data: entries, error: entriesError }, { data: seasons, error: seasonsError }] = await Promise.all([
    statsState.client.from("sport_entries").select("*").order("event_date", { ascending: true }),
    statsState.client.from("sport_seasons").select("*").order("season", { ascending: true }),
  ]);

  if (entriesError || seasonsError) {
    if (note) note.textContent = entriesError?.message || seasonsError?.message || "Statistiky se nepodařilo načíst.";
    return;
  }

  statsState.entries = entries ?? [];
  statsState.seasons = seasons ?? [];
  refreshSeasonSelector(!statsState.selectionReady);
  statsState.selectionReady = true;
  renderStats();
}

async function initializeStats() {
  try {
    const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = await import("./config.js");
    statsState.client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const { data: { session } } = await statsState.client.auth.getSession();
    if (session) await loadAndRenderStats();
    statsState.client.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession) await loadAndRenderStats();
      else {
        statsState.entries = [];
        statsState.seasons = [];
        statsState.selectionReady = false;
      }
    });
  } catch (error) {
    const note = $stats("#stats-selection-note");
    if (note) note.textContent = error.message || "Statistiky se nepodařilo spustit.";
  }
}

injectStyles();
injectUi();
setTimeout(initializeStats, 0);
