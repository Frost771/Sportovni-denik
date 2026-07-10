import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const MATCH_TYPES = ["Soutěžní", "Neregistrovaná liga", "Přátelský/přípravný"];
const SPORTS = ["Fotbal", "Florbal"];
const $matchType = (selector) => document.querySelector(selector);

let matchTypeClient = null;
let renderTimer = null;
let renderSequence = 0;

function ensureMatchTypes() {
  const select = $matchType("#match-type");
  if (!select || select.querySelector('option[value="Neregistrovaná liga"]')) return;

  const option = document.createElement("option");
  option.value = "Neregistrovaná liga";
  option.textContent = "Neregistrovaná liga";

  const friendly = select.querySelector('option[value="Přátelský/přípravný"]');
  select.insertBefore(option, friendly || null);
}

function ensureBreakdownSection() {
  let section = $matchType("#match-type-breakdown");
  if (section) return section;

  const anchor = $matchType("#detailed-stats");
  if (!anchor) return null;

  section = document.createElement("section");
  section.id = "match-type-breakdown";
  section.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Rozdělení zápasů</p>
        <h2>Statistiky podle typu zápasu</h2>
      </div>
    </div>
    <div id="match-type-stats-grid" class="detail-grid"></div>
  `;
  anchor.insertAdjacentElement("afterend", section);
  return section;
}

function average(values) {
  const numbers = values.filter(Number.isFinite);
  if (!numbers.length) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function statLine(label, value) {
  return `<div class="stat-line"><span>${label}</span><strong>${value}</strong></div>`;
}

function buildCard(sport, type, matches) {
  const wins = matches.filter((entry) => entry.result?.startsWith("Výhra")).length;
  const draws = matches.filter((entry) => entry.result === "Remíza").length;
  const losses = matches.filter((entry) => entry.result?.startsWith("Prohra")).length;
  const goalkeeperMatches = matches.filter((entry) => (entry.role || "Brankář") === "Brankář");
  const conceded = goalkeeperMatches.reduce(
    (sum, entry) => sum + (entry.goals_conceded || 0),
    0,
  );

  const rows = [
    statLine("Zápasy", matches.length),
    statLine("Bilance", `${wins} V · ${draws} R · ${losses} P`),
  ];

  if (type === "Soutěžní") {
    const points = matches.reduce((sum, entry) => sum + (entry.points || 0), 0);
    rows.push(statLine("Body", points));
  }

  if (goalkeeperMatches.length) {
    rows.push(statLine("Brankářské zápasy", goalkeeperMatches.length));
    rows.push(statLine("Průměr inkasovaných", (conceded / goalkeeperMatches.length).toFixed(2)));
    rows.push(statLine("Čistá konta", goalkeeperMatches.filter((entry) => entry.goals_conceded === 0).length));
  }

  rows.push(statLine("Průměrné hodnocení", `${average(matches.map((entry) => entry.rating)).toFixed(2)}/10`));

  return `<div class="detail-card"><h3>${sport} · ${type}</h3>${rows.join("")}</div>`;
}

async function getMatchTypeClient() {
  if (matchTypeClient) return matchTypeClient;

  const config = await import("./config.js");
  matchTypeClient = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return matchTypeClient;
}

async function renderMatchTypeBreakdown() {
  const sequence = ++renderSequence;
  ensureMatchTypes();
  const section = ensureBreakdownSection();
  const grid = $matchType("#match-type-stats-grid");
  if (!section || !grid) return;

  const client = await getMatchTypeClient();
  const { data, error } = await client
    .from("sport_entries")
    .select("sport, season, match_type, role, result, points, goals_conceded, rating")
    .eq("event_type", "Zápas");

  if (sequence !== renderSequence) return;

  if (error) {
    section.classList.add("hidden");
    console.warn("Statistiky podle typu zápasu se nepodařilo načíst.", error);
    return;
  }

  const selectedSport = $matchType("#dashboard-sport")?.value || "Vše";
  const selectedSeason = $matchType("#dashboard-season")?.value || "Vše";
  const sports = selectedSport === "Vše" ? SPORTS : [selectedSport];
  const entries = (data || []).filter(
    (entry) => selectedSeason === "Vše" || entry.season === selectedSeason,
  );

  const cards = [];
  for (const sport of sports) {
    for (const type of MATCH_TYPES) {
      const matches = entries.filter(
        (entry) => entry.sport === sport && (entry.match_type || "Soutěžní") === type,
      );
      if (matches.length) cards.push(buildCard(sport, type, matches));
    }
  }

  if (!cards.length) {
    section.classList.add("hidden");
    grid.innerHTML = "";
    return;
  }

  grid.innerHTML = cards.join("");
  section.classList.remove("hidden");
}

function scheduleMatchTypeRender(delay = 120) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderMatchTypeBreakdown().catch((error) => {
      console.warn("Rozdělení statistik se nepodařilo vykreslit.", error);
    });
  }, delay);
}

function bindMatchTypeStats() {
  ensureMatchTypes();
  ensureBreakdownSection();

  $matchType("#dashboard-sport")?.addEventListener("change", () => scheduleMatchTypeRender(20));
  $matchType("#dashboard-season")?.addEventListener("change", () => scheduleMatchTypeRender(20));

  document.addEventListener("click", (event) => {
    if (event.target.closest('.nav-tabs button[data-page="dashboard"]')) {
      scheduleMatchTypeRender(180);
    }
  });

  const details = $matchType("#detailed-stats");
  if (details) {
    const observer = new MutationObserver(() => scheduleMatchTypeRender());
    observer.observe(details, { childList: true });
  }

  scheduleMatchTypeRender(350);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindMatchTypeStats, { once: true });
} else {
  bindMatchTypeStats();
}
