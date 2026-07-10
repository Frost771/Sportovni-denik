import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import Papa from "https://cdn.jsdelivr.net/npm/papaparse@5.4.1/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const configured =
  SUPABASE_URL &&
  SUPABASE_PUBLISHABLE_KEY &&
  !SUPABASE_URL.startsWith("VLOZ_") &&
  !SUPABASE_PUBLISHABLE_KEY.startsWith("VLOZ_");

const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

const state = {
  user: null,
  entries: [],
  seasons: [],
  editingId: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const value = (selector) => $(selector).value;
const setValue = (selector, newValue) => { $(selector).value = newValue ?? ""; };

const ENTRY_CSV_HEADERS = [
  "id", "typ_udalosti", "datum", "sport", "sezona", "typ_treninku",
  "typ_zapasu", "role", "delka_minuty", "narocnost", "souper", "misto",
  "nase_goly", "goly_soupere", "odehrane_minuty", "inkasovane",
  "hodnoceni", "rozhodnuti", "vysledek", "body", "poznamka",
];

const SEASON_CSV_HEADERS = [
  "id", "sport", "sezona", "stav", "datum_zalozeni", "datum_uzavreni",
];

function showToast(message, type = "ok") {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast show ${type === "error" ? "error" : ""}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.className = "toast"; }, 3500);
}

function setBusy(button, busy, originalText = null) {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Pracuji…";
  } else {
    button.disabled = false;
    button.textContent = originalText || button.dataset.originalText || button.textContent;
  }
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function dateToCz(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

function czToIso(cz) {
  if (!cz) return null;
  const [day, month, year] = cz.trim().split(".");
  if (!day || !month || !year) return null;
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function nullableInt(input) {
  const trimmed = String(input ?? "").trim();
  if (trimmed === "") return null;
  const number = Number.parseInt(trimmed, 10);
  return Number.isFinite(number) ? number : null;
}

function safeText(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function average(values) {
  const numbers = values.filter((number) => Number.isFinite(number));
  return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
}

function resultBase(goalsFor, goalsAgainst) {
  if (goalsFor > goalsAgainst) return "Výhra";
  if (goalsFor < goalsAgainst) return "Prohra";
  return "Remíza";
}

function calculateMatch({ sport, matchType, goalsFor, goalsAgainst, decision, shootoutWinner }) {
  let base = resultBase(goalsFor, goalsAgainst);
  let result = base;
  let points = null;

  if (sport === "Fotbal") {
    if (matchType === "Soutěžní") {
      points = base === "Výhra" ? 3 : base === "Remíza" ? 1 : 0;
    }
    return { decision: "Základní doba", result, points };
  }

  if (decision !== "Základní doba" && base === "Remíza") {
    base = shootoutWinner === "Náš tým" ? "Výhra" : "Prohra";
  }

  if (decision === "Prodloužení") result = `${base} po prodloužení`;
  else if (decision === "Nájezdy") result = `${base} po nájezdech`;
  else result = base;

  if (matchType === "Soutěžní") {
    if (base === "Remíza") points = 1;
    else if (decision === "Základní doba") points = base === "Výhra" ? 3 : 0;
    else points = base === "Výhra" ? 2 : 1;
  }

  return { decision, result, points };
}

function showPage(name) {
  $$(".nav-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.page === name));
  $$(".page").forEach((page) => page.classList.toggle("active", page.id === `page-${name}`));
  if (name === "dashboard") renderDashboard();
  if (name === "records") renderRecords();
  if (name === "seasons") renderSeasons();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateAuthView(session) {
  state.user = session?.user ?? null;
  $("#auth-view").classList.toggle("hidden", !!state.user);
  $("#app-view").classList.toggle("hidden", !state.user);
  $("#user-email").textContent = state.user?.email ?? "";
}

async function loadAll() {
  if (!state.user) return;
  const [{ data: entries, error: entriesError }, { data: seasons, error: seasonsError }] = await Promise.all([
    supabase.from("sport_entries").select("*").order("event_date", { ascending: true }),
    supabase.from("sport_seasons").select("*").order("season", { ascending: true }),
  ]);

  if (entriesError || seasonsError) {
    showToast(entriesError?.message || seasonsError?.message || "Data se nepodařilo načíst.", "error");
    return;
  }

  state.entries = entries ?? [];
  state.seasons = seasons ?? [];
  refreshSeasonSelectors();
  renderDashboard();
  renderRecords();
  renderSeasons();
}

function activeSeason(sport) {
  return state.seasons.find((season) => season.sport === sport && season.status === "Aktivní");
}

function seasonsForSport(sport) {
  return state.seasons
    .filter((season) => season.sport === sport)
    .sort((a, b) => b.season.localeCompare(a.season, "cs"));
}

function refreshSeasonSelectors() {
  const sport = value("#sport");
  const entrySelect = $("#season");
  const currentEntryValue = entrySelect.value;
  const available = seasonsForSport(sport);

  entrySelect.innerHTML = available.length
    ? available.map((season) => `<option value="${safeText(season.season)}">${safeText(season.season)}${season.status === "Aktivní" ? " – aktivní" : ""}</option>`).join("")
    : `<option value="">Nejdřív založ sezónu</option>`;

  const active = activeSeason(sport);
  if (state.editingId && available.some((season) => season.season === currentEntryValue)) entrySelect.value = currentEntryValue;
  else if (active) entrySelect.value = active.season;

  ["#dashboard-season", "#records-season"].forEach((selector) => {
    const select = $(selector);
    const old = select.value;
    const names = [...new Set(state.seasons.map((season) => season.season))].sort((a, b) => b.localeCompare(a, "cs"));
    select.innerHTML = `<option value="Vše">Všechny sezóny</option>` +
      names.map((name) => `<option value="${safeText(name)}">${safeText(name)}</option>`).join("");
    if (names.includes(old)) select.value = old;
  });
}

function updateEntryFormVisibility() {
  const eventType = value("#event-type");
  const sport = value("#sport");
  const role = value("#role");
  const decision = value("#decision");
  const goalsFor = nullableInt(value("#goals-for"));
  const goalsAgainst = nullableInt(value("#goals-against"));

  $("#training-fields").classList.toggle("hidden", eventType !== "Trénink");
  $("#match-fields").classList.toggle("hidden", eventType !== "Zápas");
  $("#role-label").classList.toggle("hidden", sport !== "Fotbal");
  $("#decision-label").classList.toggle("hidden", sport !== "Florbal");
  $("#conceded-label").classList.toggle("hidden", sport === "Fotbal" && role === "Hráč v poli");

  const needsWinner =
    eventType === "Zápas" &&
    sport === "Florbal" &&
    decision !== "Základní doba" &&
    goalsFor !== null &&
    goalsAgainst !== null &&
    goalsFor === goalsAgainst;

  $("#shootout-winner-label").classList.toggle("hidden", !needsWinner);

  if (sport === "Florbal") setValue("#role", "Brankář");
  refreshSeasonSelectors();
}

function resetEntryForm() {
  state.editingId = null;
  $("#entry-form").reset();
  setValue("#event-type", "Trénink");
  setValue("#sport", "Florbal");
  setValue("#event-date", isoToday());
  setValue("#match-type", "Soutěžní");
  setValue("#decision", "Základní doba");
  setValue("#role", "Brankář");
  $("#entry-heading").textContent = "Přidat trénink nebo zápas";
  $("#save-entry-btn").textContent = "Uložit záznam";
  $("#cancel-edit-btn").classList.add("hidden");
  updateEntryFormVisibility();
}

function buildEntryPayload() {
  const eventType = value("#event-type");
  const sport = value("#sport");
  const season = value("#season");

  if (!season) throw new Error(`Pro sport ${sport} není založená žádná sezóna.`);

  const payload = {
    event_type: eventType,
    event_date: value("#event-date"),
    sport,
    season,
    training_type: null,
    match_type: null,
    role: null,
    duration_minutes: null,
    intensity: null,
    opponent: null,
    venue: null,
    goals_for: null,
    goals_against: null,
    minutes_played: null,
    goals_conceded: null,
    rating: null,
    decision: null,
    result: null,
    points: null,
    notes: value("#notes").trim() || null,
  };

  if (eventType === "Trénink") {
    payload.training_type = value("#training-type").trim();
    payload.duration_minutes = nullableInt(value("#duration-minutes"));
    payload.intensity = nullableInt(value("#intensity"));

    if (!payload.training_type || payload.duration_minutes === null || payload.intensity === null) {
      throw new Error("U tréninku vyplň typ, délku a náročnost.");
    }
    return payload;
  }

  payload.match_type = value("#match-type");
  payload.role = sport === "Fotbal" ? value("#role") : "Brankář";
  payload.opponent = value("#opponent").trim();
  payload.venue = value("#venue");
  payload.goals_for = nullableInt(value("#goals-for"));
  payload.goals_against = nullableInt(value("#goals-against"));
  payload.minutes_played = nullableInt(value("#minutes-played"));
  payload.rating = nullableInt(value("#rating"));

  if (
    !payload.opponent ||
    payload.goals_for === null ||
    payload.goals_against === null ||
    payload.minutes_played === null ||
    payload.rating === null
  ) {
    throw new Error("U zápasu vyplň soupeře, skóre, minuty a hodnocení.");
  }

  if (!(sport === "Fotbal" && payload.role === "Hráč v poli")) {
    payload.goals_conceded = nullableInt(value("#goals-conceded"));
    if (payload.goals_conceded === null) throw new Error("Vyplň počet inkasovaných gólů.");
  }

  const calculated = calculateMatch({
    sport,
    matchType: payload.match_type,
    goalsFor: payload.goals_for,
    goalsAgainst: payload.goals_against,
    decision: sport === "Florbal" ? value("#decision") : "Základní doba",
    shootoutWinner: value("#shootout-winner"),
  });

  payload.decision = calculated.decision;
  payload.result = calculated.result;
  payload.points = calculated.points;
  return payload;
}

async function saveEntry(event) {
  event.preventDefault();
  const button = $("#save-entry-btn");
  setBusy(button, true);

  try {
    const payload = buildEntryPayload();
    let error;

    if (state.editingId) {
      ({ error } = await supabase.from("sport_entries").update(payload).eq("id", state.editingId));
    } else {
      ({ error } = await supabase.from("sport_entries").insert(payload));
    }

    if (error) throw error;
    showToast(state.editingId ? "Záznam byl upraven." : "Záznam byl uložen.");
    resetEntryForm();
    await loadAll();
    showPage("records");
  } catch (error) {
    showToast(error.message || "Záznam se nepodařilo uložit.", "error");
  } finally {
    setBusy(button, false, "Uložit záznam");
  }
}

function editEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  state.editingId = id;
  setValue("#event-type", entry.event_type);
  setValue("#sport", entry.sport);
  setValue("#event-date", entry.event_date);
  refreshSeasonSelectors();
  setValue("#season", entry.season);
  setValue("#training-type", entry.training_type);
  setValue("#duration-minutes", entry.duration_minutes);
  setValue("#intensity", entry.intensity);
  setValue("#match-type", entry.match_type || "Soutěžní");
  setValue("#role", entry.role || "Brankář");
  setValue("#opponent", entry.opponent);
  setValue("#venue", entry.venue || "Doma");
  setValue("#goals-for", entry.goals_for);
  setValue("#goals-against", entry.goals_against);
  setValue("#decision", entry.decision || "Základní doba");
  setValue("#minutes-played", entry.minutes_played);
  setValue("#goals-conceded", entry.goals_conceded);
  setValue("#rating", entry.rating);
  setValue("#notes", entry.notes);
  $("#entry-heading").textContent = "Upravit záznam";
  $("#save-entry-btn").textContent = "Uložit změny";
  $("#cancel-edit-btn").classList.remove("hidden");
  updateEntryFormVisibility();
  showPage("entry");
}

async function deleteEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  const label = entry.event_type === "Trénink" ? entry.training_type : `zápas proti ${entry.opponent}`;
  if (!confirm(`Opravdu smazat ${label}?`)) return;

  const { error } = await supabase.from("sport_entries").delete().eq("id", id);
  if (error) return showToast(error.message, "error");
  showToast("Záznam byl smazán.");
  await loadAll();
}

function filteredEntries(sport, season, type) {
  return state.entries.filter((entry) =>
    (sport === "Vše" || entry.sport === sport) &&
    (season === "Vše" || entry.season === season) &&
    (type === "Vše" || entry.event_type === type)
  );
}

function renderDashboard() {
  if (!state.user) return;
  const sport = value("#dashboard-sport");
  const season = value("#dashboard-season");
  const entries = filteredEntries(sport, season, "Vše");
  const trainings = entries.filter((entry) => entry.event_type === "Trénink");
  const matches = entries.filter((entry) => entry.event_type === "Zápas");

  $("#active-seasons").innerHTML = ["Fotbal", "Florbal"].map((item) => {
    const active = activeSeason(item);
    return `<div class="season-pill"><span>Aktuální ${item.toLowerCase()}ová sezóna</span><strong>${safeText(active?.season || "není založena")}</strong></div>`;
  }).join("");

  const trainingMinutes = trainings.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
  const ratings = matches.map((entry) => entry.rating).filter(Number.isFinite);
  $("#summary-cards").innerHTML = [
    ["Záznamy", entries.length],
    ["Tréninky", trainings.length],
    ["Zápasy", matches.length],
    ["Tréninkový čas", `${(trainingMinutes / 60).toFixed(1)} h`],
  ].map(([label, number]) => `<div class="stat-card"><span>${label}</span><strong>${number}</strong></div>`).join("");

  const cards = [];
  for (const currentSport of ["Fotbal", "Florbal"]) {
    const sportEntries = entries.filter((entry) => entry.sport === currentSport);
    if (!sportEntries.length) continue;
    const sportTrainings = sportEntries.filter((entry) => entry.event_type === "Trénink");
    const sportMatches = sportEntries.filter((entry) => entry.event_type === "Zápas");

    const lines = [];
    if (sportTrainings.length) {
      const minutes = sportTrainings.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
      lines.push(["Tréninky", sportTrainings.length]);
      lines.push(["Čas tréninků", `${(minutes / 60).toFixed(1)} h`]);
      lines.push(["Průměrná náročnost", `${average(sportTrainings.map((entry) => entry.intensity)).toFixed(2)}/10`]);
    }

    if (sportMatches.length) {
      const wins = sportMatches.filter((entry) => entry.result?.startsWith("Výhra")).length;
      const draws = sportMatches.filter((entry) => entry.result === "Remíza").length;
      const losses = sportMatches.filter((entry) => entry.result?.startsWith("Prohra")).length;
      const competitive = sportMatches.filter((entry) => (entry.match_type || "Soutěžní") === "Soutěžní");
      const points = competitive.reduce((sum, entry) => sum + (entry.points || 0), 0);
      lines.push(["Zápasy", sportMatches.length]);
      lines.push(["Bilance", `${wins} V · ${draws} R · ${losses} P`]);
      lines.push(["Soutěžní body", points]);

      const goalkeeperMatches = sportMatches.filter((entry) => (entry.role || "Brankář") === "Brankář");
      if (goalkeeperMatches.length) {
        const conceded = goalkeeperMatches.reduce((sum, entry) => sum + (entry.goals_conceded || 0), 0);
        const cleanSheets = goalkeeperMatches.filter((entry) => entry.goals_conceded === 0).length;
        lines.push(["Brankářské zápasy", goalkeeperMatches.length]);
        lines.push(["Průměr inkasovaných", (conceded / goalkeeperMatches.length).toFixed(2)]);
        lines.push(["Čistá konta", cleanSheets]);
      }

      if (currentSport === "Fotbal") {
        const fieldMatches = sportMatches.filter((entry) => entry.role === "Hráč v poli");
        if (fieldMatches.length) lines.push(["Zápasy v poli", fieldMatches.length]);
      }

      lines.push(["Průměrné hodnocení", `${average(sportMatches.map((entry) => entry.rating)).toFixed(2)}/10`]);
    }

    cards.push(`<div class="detail-card"><h3>${currentSport}</h3>${lines.map(([label, number]) => `<div class="stat-line"><span>${label}</span><strong>${number}</strong></div>`).join("")}</div>`);
  }

  $("#detailed-stats").innerHTML = cards.length ? cards.join("") : `<div class="empty">Pro tento výběr zatím nejsou žádná data.</div>`;
}

function renderRecords() {
  if (!state.user) return;
  const entries = filteredEntries(value("#records-sport"), value("#records-season"), value("#records-type"))
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  if (!entries.length) {
    $("#records-list").innerHTML = `<div class="empty">Pro tento výběr nejsou žádné záznamy.</div>`;
    return;
  }

  $("#records-list").innerHTML = entries.map((entry) => {
    const isTraining = entry.event_type === "Trénink";
    const title = isTraining
      ? entry.training_type
      : `${entry.opponent} · ${entry.goals_for}:${entry.goals_against}`;
    const description = isTraining
      ? `${entry.duration_minutes} min · náročnost ${entry.intensity}/10`
      : `${entry.match_type || "Soutěžní"} · ${entry.result} · ${entry.points ?? "bez"} bodů · hodnocení ${entry.rating}/10`;

    const badges = [
      entry.sport,
      entry.season,
      entry.event_type,
      !isTraining && entry.sport === "Fotbal" ? entry.role : null,
    ].filter(Boolean);

    return `<article class="record-card">
      <div class="record-date">${dateToCz(entry.event_date)}</div>
      <div class="record-main">
        <h3>${safeText(title)}</h3>
        <p>${safeText(description)}</p>
        ${entry.notes ? `<p>${safeText(entry.notes)}</p>` : ""}
        <div class="badges">${badges.map((badge) => `<span class="badge">${safeText(badge)}</span>`).join("")}</div>
      </div>
      <div class="record-actions">
        <button class="secondary" data-edit-entry="${entry.id}">Upravit</button>
        <button class="danger" data-delete-entry="${entry.id}">Smazat</button>
      </div>
    </article>`;
  }).join("");
}

async function createSeason(event) {
  event.preventDefault();
  const sport = value("#season-sport");
  const season = value("#season-name").trim();
  if (!season) return;

  if (activeSeason(sport)) {
    showToast(`${sport} už má aktivní sezónu. Nejdřív ji uzavři.`, "error");
    return;
  }

  const { error } = await supabase.from("sport_seasons").insert({
    sport,
    season,
    status: "Aktivní",
    created_date: isoToday(),
  });

  if (error) return showToast(error.message, "error");
  $("#season-form").reset();
  showToast("Sezóna byla založena.");
  await loadAll();
}

async function closeSeason(id) {
  const season = state.seasons.find((item) => item.id === id);
  if (!season || !confirm(`Uzavřít ${season.sport} ${season.season}?`)) return;

  const { error } = await supabase.from("sport_seasons").update({
    status: "Uzavřená",
    closed_date: isoToday(),
  }).eq("id", id);

  if (error) return showToast(error.message, "error");
  showToast("Sezóna byla uzavřena.");
  await loadAll();
}

async function reopenSeason(id) {
  const season = state.seasons.find((item) => item.id === id);
  if (!season) return;
  if (activeSeason(season.sport)) {
    showToast(`${season.sport} už má jinou aktivní sezónu.`, "error");
    return;
  }

  const { error } = await supabase.from("sport_seasons").update({
    status: "Aktivní",
    closed_date: null,
  }).eq("id", id);

  if (error) return showToast(error.message, "error");
  showToast("Sezóna je znovu aktivní.");
  await loadAll();
}

function renderSeasons() {
  const seasons = [...state.seasons].sort((a, b) =>
    a.sport.localeCompare(b.sport, "cs") || b.season.localeCompare(a.season, "cs")
  );

  if (!seasons.length) {
    $("#seasons-list").innerHTML = `<div class="empty">Zatím nejsou založené žádné sezóny.</div>`;
    return;
  }

  $("#seasons-list").innerHTML = seasons.map((season) => `
    <article class="record-card">
      <div class="record-date">${safeText(season.sport)}</div>
      <div class="record-main">
        <h3>${safeText(season.season)}</h3>
        <p>Založena ${dateToCz(season.created_date)}${season.closed_date ? ` · uzavřena ${dateToCz(season.closed_date)}` : ""}</p>
        <div class="badges"><span class="badge ${season.status === "Aktivní" ? "green" : "gray"}">${safeText(season.status)}</span></div>
      </div>
      <div class="record-actions">
        ${season.status === "Aktivní"
          ? `<button class="secondary" data-close-season="${season.id}">Uzavřít</button>`
          : `<button class="secondary" data-reopen-season="${season.id}">Znovu otevřít</button>`}
      </div>
    </article>
  `).join("");
}

function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
      transformHeader: (header) => header.replace(/^\ufeff/, "").trim(),
      complete: (result) => {
        if (result.errors?.length) reject(new Error(result.errors[0].message));
        else resolve(result.data);
      },
      error: reject,
    });
  });
}

function entryFromCsv(row) {
  const eventType = row.typ_udalosti;
  return {
    id: row.id || crypto.randomUUID(),
    event_type: eventType,
    event_date: czToIso(row.datum),
    sport: row.sport,
    season: row.sezona,
    training_type: row.typ_treninku || null,
    match_type: row.typ_zapasu || null,
    role: row.role || null,
    duration_minutes: nullableInt(row.delka_minuty),
    intensity: nullableInt(row.narocnost),
    opponent: row.souper || null,
    venue: row.misto || null,
    goals_for: nullableInt(row.nase_goly),
    goals_against: nullableInt(row.goly_soupere),
    minutes_played: nullableInt(row.odehrane_minuty),
    goals_conceded: nullableInt(row.inkasovane),
    rating: nullableInt(row.hodnoceni),
    decision: row.rozhodnuti || null,
    result: row.vysledek || null,
    points: nullableInt(row.body),
    notes: row.poznamka || null,
  };
}

function seasonFromCsv(row) {
  return {
    id: row.id || crypto.randomUUID(),
    sport: row.sport,
    season: row.sezona,
    status: row.stav,
    created_date: czToIso(row.datum_zalozeni) || isoToday(),
    closed_date: czToIso(row.datum_uzavreni),
  };
}

async function insertInChunks(table, rows, size = 100) {
  for (let index = 0; index < rows.length; index += size) {
    const chunk = rows.slice(index, index + size);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
  }
}

async function importCsv() {
  const entriesFile = $("#entries-file").files[0];
  const seasonsFile = $("#seasons-file").files[0];
  if (!entriesFile || !seasonsFile) return showToast("Vyber oba CSV soubory.", "error");

  const button = $("#import-btn");
  setBusy(button, true);
  $("#import-result").textContent = "";

  try {
    const [entryRows, seasonRows] = await Promise.all([parseCsvFile(entriesFile), parseCsvFile(seasonsFile)]);
    const seasons = seasonRows.map(seasonFromCsv).filter((row) => row.sport && row.season);
    const entries = entryRows.map(entryFromCsv).filter((row) => row.event_type && row.event_date && row.sport && row.season);

    await insertInChunks("sport_seasons", seasons);
    await insertInChunks("sport_entries", entries);
    $("#import-result").textContent = `Importováno / zkontrolováno: ${entries.length} záznamů a ${seasons.length} sezóny.`;
    showToast("CSV import byl dokončen.");
    await loadAll();
  } catch (error) {
    $("#import-result").textContent = error.message;
    showToast(error.message || "Import se nepodařil.", "error");
  } finally {
    setBusy(button, false, "Importovat CSV");
  }
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const content = "\ufeff" + [
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(";")),
  ].join("\r\n");

  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportEntries() {
  const rows = state.entries
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .map((entry) => ({
      id: entry.id,
      typ_udalosti: entry.event_type,
      datum: dateToCz(entry.event_date),
      sport: entry.sport,
      sezona: entry.season,
      typ_treninku: entry.training_type || "",
      typ_zapasu: entry.match_type || "",
      role: entry.role || "",
      delka_minuty: entry.duration_minutes ?? "",
      narocnost: entry.intensity ?? "",
      souper: entry.opponent || "",
      misto: entry.venue || "",
      nase_goly: entry.goals_for ?? "",
      goly_soupere: entry.goals_against ?? "",
      odehrane_minuty: entry.minutes_played ?? "",
      inkasovane: entry.goals_conceded ?? "",
      hodnoceni: entry.rating ?? "",
      rozhodnuti: entry.decision || "",
      vysledek: entry.result || "",
      body: entry.points ?? "",
      poznamka: entry.notes || "",
    }));

  downloadCsv("sportovni_denik.csv", ENTRY_CSV_HEADERS, rows);
}

function exportSeasons() {
  const rows = state.seasons.map((season) => ({
    id: season.id,
    sport: season.sport,
    sezona: season.season,
    stav: season.status,
    datum_zalozeni: dateToCz(season.created_date),
    datum_uzavreni: dateToCz(season.closed_date),
  }));

  downloadCsv("sportovni_sezony.csv", SEASON_CSV_HEADERS, rows);
}

function bindEvents() {
  $("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    setBusy(button, true);
    const { error } = await supabase.auth.signInWithPassword({
      email: value("#auth-email").trim(),
      password: value("#auth-password"),
    });
    setBusy(button, false, "Přihlásit");
    if (error) showToast(error.message, "error");
  });

  $("#signup-btn").addEventListener("click", async () => {
    const button = $("#signup-btn");
    setBusy(button, true);
    const { error } = await supabase.auth.signUp({
      email: value("#auth-email").trim(),
      password: value("#auth-password"),
    });
    setBusy(button, false, "Vytvořit účet");
    if (error) showToast(error.message, "error");
    else showToast("Účet byl založen. Zkontroluj případný potvrzovací e-mail.");
  });

  $("#logout-btn").addEventListener("click", () => supabase.auth.signOut());
  $$(".nav-tabs button").forEach((button) => button.addEventListener("click", () => showPage(button.dataset.page)));

  ["#event-type", "#sport", "#role", "#decision", "#goals-for", "#goals-against"].forEach((selector) =>
    $(selector).addEventListener("change", updateEntryFormVisibility)
  );

  $("#entry-form").addEventListener("submit", saveEntry);
  $("#entry-form").addEventListener("reset", () => setTimeout(resetEntryForm));
  $("#cancel-edit-btn").addEventListener("click", resetEntryForm);
  $("#season-form").addEventListener("submit", createSeason);

  ["#dashboard-sport", "#dashboard-season"].forEach((selector) => $(selector).addEventListener("change", renderDashboard));
  ["#records-sport", "#records-season", "#records-type"].forEach((selector) => $(selector).addEventListener("change", renderRecords));

  $("#records-list").addEventListener("click", (event) => {
    const editId = event.target.dataset.editEntry;
    const deleteId = event.target.dataset.deleteEntry;
    if (editId) editEntry(editId);
    if (deleteId) deleteEntry(deleteId);
  });

  $("#seasons-list").addEventListener("click", (event) => {
    if (event.target.dataset.closeSeason) closeSeason(event.target.dataset.closeSeason);
    if (event.target.dataset.reopenSeason) reopenSeason(event.target.dataset.reopenSeason);
  });

  $("#import-btn").addEventListener("click", importCsv);
  $("#export-entries-btn").addEventListener("click", exportEntries);
  $("#export-seasons-btn").addEventListener("click", exportSeasons);
}

async function init() {
  if (!configured) {
    $("#setup-warning").classList.remove("hidden");
    $("#auth-view").classList.add("hidden");
    return;
  }

  bindEvents();
  resetEntryForm();

  const { data: { session } } = await supabase.auth.getSession();
  updateAuthView(session);
  if (session) await loadAll();

  supabase.auth.onAuthStateChange(async (_event, newSession) => {
    updateAuthView(newSession);
    if (newSession) await loadAll();
    else {
      state.entries = [];
      state.seasons = [];
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
  }
}

init();
