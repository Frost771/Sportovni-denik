const seasonReportState = {
  client: null,
  clientPromise: null,
  currentSeasonId: null,
  observer: null,
  bodyObserver: null,
};

const $seasonReport = (selector) => document.querySelector(selector);

function escapeSeasonReportHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function averageSeasonReport(values) {
  const numbers = values
    .map(numberOrNull)
    .filter((value) => value !== null);

  return numbers.length
    ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length
    : null;
}

function formatSeasonReportNumber(value, decimals = 0) {
  const number = numberOrNull(value);
  return number === null
    ? "—"
    : number.toFixed(decimals).replace(".", ",");
}

function formatSeasonReportDate(iso) {
  if (!iso) return "—";
  const [year, month, day] = String(iso).split("-");
  return year && month && day ? `${day}.${month}.${year}` : String(iso);
}

function shortSeasonReportDate(iso) {
  if (!iso) return "";
  const [, month, day] = String(iso).split("-");
  return `${day}.${month}.`;
}

function seasonReportMonthLabel(key) {
  const [year, month] = key.split("-").map(Number);

  return new Intl.DateTimeFormat("cs-CZ", {
    month: "short",
    year: "2-digit",
  }).format(new Date(year, month - 1, 1));
}

function injectSeasonReportStyles() {
  if ($seasonReport("#season-report-styles")) return;

  const style = document.createElement("style");
  style.id = "season-report-styles";
  style.textContent = `
    .season-report-button {
      white-space: nowrap;
    }

    .season-report-heading-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 9px;
    }

    .season-report-hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 18px;
      align-items: start;
      margin-bottom: 18px;
      padding: 20px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: white;
      box-shadow: var(--shadow);
    }

    .season-report-hero h3 {
      margin: 4px 0 6px;
      font-size: 1.45rem;
    }

    .season-report-hero p {
      margin: 0;
    }

    .season-report-status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 92px;
      padding: 7px 11px;
      border-radius: 999px;
      font-size: .78rem;
      font-weight: 800;
    }

    .season-report-status.active {
      background: #e6f7ed;
      color: #176b3a;
    }

    .season-report-status.closed {
      background: #eef1f5;
      color: #586273;
    }

    .season-report-summary {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-bottom: 18px;
    }

    .season-report-section-title {
      margin: 24px 0 12px;
    }

    .season-report-section-title h3 {
      margin: 0 0 4px;
    }

    .season-report-section-title p {
      margin: 0;
    }

    .season-report-detail-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .season-report-card {
      min-width: 0;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: white;
      box-shadow: var(--shadow);
    }

    .season-report-card h4 {
      margin: 0 0 13px;
      color: var(--blue-dark);
      font-size: 1rem;
    }

    .season-report-stat-line {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 8px 0;
      border-bottom: 1px solid var(--line);
    }

    .season-report-stat-line:last-child {
      border-bottom: 0;
    }

    .season-report-stat-line span {
      color: var(--muted);
    }

    .season-report-stat-line strong {
      text-align: right;
    }

    .season-report-type-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .season-report-chart-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .season-report-chart-card {
      min-width: 0;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: white;
      box-shadow: var(--shadow);
    }

    .season-report-chart-heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }

    .season-report-chart-heading h4 {
      margin: 0;
      font-size: 1rem;
    }

    .season-report-chart-heading span {
      color: var(--muted);
      font-size: .78rem;
      text-align: right;
    }

    .season-report-chart-scroll {
      overflow-x: auto;
      padding: 4px 2px 6px;
    }

    .season-report-chart-columns {
      display: flex;
      align-items: flex-end;
      gap: 9px;
      min-width: 100%;
      height: 230px;
    }

    .season-report-chart-column {
      display: grid;
      flex: 1 0 48px;
      grid-template-rows: 25px 1fr 28px;
      gap: 6px;
      min-width: 48px;
      height: 100%;
      text-align: center;
    }

    .season-report-chart-column strong {
      align-self: end;
      font-size: .72rem;
    }

    .season-report-chart-column > span {
      overflow-wrap: anywhere;
      color: var(--muted);
      font-size: .68rem;
      line-height: 1.15;
    }

    .season-report-chart-track {
      position: relative;
      align-self: stretch;
      overflow: hidden;
      border-radius: 9px 9px 5px 5px;
      background: #eef3fb;
    }

    .season-report-chart-fill {
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
      border-radius: 9px 9px 5px 5px;
      background: linear-gradient(180deg, var(--blue), var(--blue-dark));
    }

    .season-report-chart-empty {
      display: grid;
      min-height: 180px;
      place-items: center;
      padding: 20px;
      border: 1px dashed #bdc7d8;
      border-radius: 14px;
      color: var(--muted);
      text-align: center;
    }

    .season-report-result-chart {
      display: grid;
      gap: 17px;
      padding: 24px 2px;
    }

    .season-report-result-row {
      display: grid;
      grid-template-columns: 72px 1fr 28px;
      align-items: center;
      gap: 10px;
    }

    .season-report-result-row span {
      color: var(--muted);
      font-size: .86rem;
    }

    .season-report-result-row strong {
      text-align: right;
    }

    .season-report-result-track {
      overflow: hidden;
      height: 18px;
      border-radius: 999px;
      background: #eef3fb;
    }

    .season-report-result-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--blue-dark), var(--blue));
    }

    .season-report-review {
      padding: 20px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: white;
      box-shadow: var(--shadow);
    }

    .season-report-review h4 {
      margin: 0 0 10px;
      color: var(--blue-dark);
    }

    .season-report-review p {
      margin: 0;
      white-space: pre-wrap;
      line-height: 1.65;
    }

    .season-report-surface-list,
    .season-report-training-types {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .season-report-list-badge {
      padding: 7px 10px;
      border-radius: 999px;
      background: #eef3fb;
      font-size: .8rem;
      font-weight: 700;
    }

    .season-report-loading {
      min-height: 280px;
    }

    @media (max-width: 980px) {
      .season-report-type-grid {
        grid-template-columns: 1fr;
      }

      .season-report-summary {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 820px) {
      .season-report-detail-grid,
      .season-report-chart-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 620px) {
      .season-report-hero {
        grid-template-columns: 1fr;
      }

      .season-report-status {
        justify-self: start;
      }

      .season-report-summary {
        grid-template-columns: 1fr;
      }

      .season-report-heading-actions {
        display: grid;
        grid-template-columns: 1fr;
        width: 100%;
      }

      .season-report-heading-actions button {
        width: 100%;
      }

      .season-report-chart-card,
      .season-report-card,
      .season-report-hero,
      .season-report-review {
        padding: 15px;
      }

      .season-report-chart-columns {
        height: 205px;
      }
    }
  `;

  document.head.appendChild(style);
}

function injectSeasonReportPage() {
  if ($seasonReport("#page-season-report")) return;

  const seasonsPage = $seasonReport("#page-seasons");
  if (!seasonsPage) return;

  const page = document.createElement("section");
  page.id = "page-season-report";
  page.className = "page";
  page.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Souhrn sezóny</p>
        <h2>Report sezóny</h2>
      </div>
      <div class="season-report-heading-actions">
        <button id="season-report-refresh" type="button" class="secondary">
          Obnovit report
        </button>
        <button id="season-report-back" type="button" class="ghost">
          Zpět na sezóny
        </button>
      </div>
    </div>
    <div id="season-report-content">
      <div class="empty season-report-loading">
        Otevři report u některé sezóny.
      </div>
    </div>
  `;

  seasonsPage.insertAdjacentElement("afterend", page);
}

async function getSeasonReportClient() {
  if (seasonReportState.client) return seasonReportState.client;

  if (!seasonReportState.clientPromise) {
    seasonReportState.clientPromise = (async () => {
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

  seasonReportState.client = await seasonReportState.clientPromise;
  return seasonReportState.client;
}

function seasonIdFromSeasonCard(card) {
  const control =
    card.querySelector("[data-close-season]") ||
    card.querySelector("[data-reopen-season]");

  return (
    control?.dataset.closeSeason ||
    control?.dataset.reopenSeason ||
    null
  );
}

function addSeasonReportButton(card) {
  if (!(card instanceof Element)) return;

  const seasonId = seasonIdFromSeasonCard(card);
  const actions = card.querySelector(".record-actions");

  if (!seasonId || !actions) return;
  if (actions.querySelector("[data-season-report]")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary season-report-button";
  button.dataset.seasonReport = String(seasonId);
  button.textContent = "Report sezóny";

  actions.prepend(button);
}

function annotateSeasonReportNode(node) {
  if (!(node instanceof Element)) return;

  if (node.matches?.(".record-card")) addSeasonReportButton(node);
  node.querySelectorAll?.(".record-card").forEach(addSeasonReportButton);
}

function annotateAllSeasonReportButtons() {
  $seasonReport("#seasons-list")
    ?.querySelectorAll(".record-card")
    .forEach(addSeasonReportButton);
}

function installSeasonReportObserver() {
  const seasonsList = $seasonReport("#seasons-list");
  if (!seasonsList || seasonReportState.observer) return;

  seasonReportState.observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(annotateSeasonReportNode);
    });

    annotateAllSeasonReportButtons();
  });

  seasonReportState.observer.observe(seasonsList, {
    childList: true,
    subtree: true,
  });

  annotateAllSeasonReportButtons();
}

function waitForSeasonReportElements() {
  injectSeasonReportPage();
  installSeasonReportObserver();

  if (
    ($seasonReport("#page-season-report") && seasonReportState.observer) ||
    seasonReportState.bodyObserver
  ) {
    return;
  }

  seasonReportState.bodyObserver = new MutationObserver(() => {
    injectSeasonReportPage();
    installSeasonReportObserver();

    if (
      $seasonReport("#page-season-report") &&
      seasonReportState.observer
    ) {
      seasonReportState.bodyObserver.disconnect();
      seasonReportState.bodyObserver = null;
    }
  });

  seasonReportState.bodyObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function activateSeasonReportPage() {
  document
    .querySelectorAll(".page")
    .forEach((page) => page.classList.remove("active"));

  $seasonReport("#page-season-report")?.classList.add("active");

  document
    .querySelectorAll(".nav-tabs button")
    .forEach((button) => {
      button.classList.toggle("active", button.dataset.page === "seasons");
    });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function returnToSeasonsPage() {
  const seasonsButton = $seasonReport(
    '.nav-tabs button[data-page="seasons"]'
  );

  if (seasonsButton) {
    seasonsButton.click();
    return;
  }

  document
    .querySelectorAll(".page")
    .forEach((page) => page.classList.remove("active"));

  $seasonReport("#page-seasons")?.classList.add("active");
}

function renderSeasonReportColumnChart(containerId, rows, options = {}) {
  const container = $seasonReport(containerId);
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `
      <div class="season-report-chart-empty">
        ${escapeSeasonReportHtml(
          options.emptyText || "Pro tuto sezónu nejsou data."
        )}
      </div>
    `;
    return;
  }

  const naturalMax = Math.max(
    ...rows.map((row) => Number(row.value) || 0),
    1
  );

  const maximum = Math.max(options.maxValue || 0, naturalMax);
  const decimals = options.decimals ?? 0;
  const suffix = options.suffix || "";

  container.innerHTML = `
    <div class="season-report-chart-scroll">
      <div class="season-report-chart-columns">
        ${rows
          .map((row) => {
            const numeric = Number(row.value) || 0;
            const height = Math.max(
              numeric > 0 ? 4 : 0,
              Math.min(100, (numeric / maximum) * 100)
            );

            const shown = numeric
              .toFixed(decimals)
              .replace(".", ",");

            return `
              <div class="season-report-chart-column">
                <strong>${shown}${escapeSeasonReportHtml(suffix)}</strong>
                <div class="season-report-chart-track">
                  <div
                    class="season-report-chart-fill"
                    style="height:${height}%"
                  ></div>
                </div>
                <span>${escapeSeasonReportHtml(row.label)}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderSeasonReportResults(matches) {
  const container = $seasonReport("#season-report-results");
  if (!container) return;

  if (!matches.length) {
    container.innerHTML = `
      <div class="season-report-chart-empty">
        V této sezóně zatím nejsou zápasy.
      </div>
    `;
    return;
  }

  const rows = [
    [
      "Výhry",
      matches.filter((entry) =>
        String(entry.result || "").startsWith("Výhra")
      ).length,
    ],
    [
      "Remízy",
      matches.filter((entry) => entry.result === "Remíza").length,
    ],
    [
      "Prohry",
      matches.filter((entry) =>
        String(entry.result || "").startsWith("Prohra")
      ).length,
    ],
  ];

  const maximum = Math.max(...rows.map(([, count]) => count), 1);

  container.innerHTML = rows
    .map(
      ([label, count]) => `
        <div class="season-report-result-row">
          <span>${label}</span>
          <div class="season-report-result-track">
            <div
              class="season-report-result-fill"
              style="width:${(count / maximum) * 100}%"
            ></div>
          </div>
          <strong>${count}</strong>
        </div>
      `
    )
    .join("");
}

function renderSeasonReportStatLines(lines) {
  return lines
    .map(
      ([label, value]) => `
        <div class="season-report-stat-line">
          <span>${escapeSeasonReportHtml(label)}</span>
          <strong>${escapeSeasonReportHtml(value)}</strong>
        </div>
      `
    )
    .join("");
}

function countSeasonReportValues(values) {
  const counts = new Map();

  values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .forEach((value) => {
      counts.set(value, (counts.get(value) || 0) + 1);
    });

  return [...counts.entries()].sort(
    ([labelA, countA], [labelB, countB]) =>
      countB - countA || labelA.localeCompare(labelB, "cs")
  );
}

function matchResultCounts(matches) {
  return {
    wins: matches.filter((entry) =>
      String(entry.result || "").startsWith("Výhra")
    ).length,
    draws: matches.filter((entry) => entry.result === "Remíza").length,
    losses: matches.filter((entry) =>
      String(entry.result || "").startsWith("Prohra")
    ).length,
  };
}

function goalkeeperSeasonMatches(matches, sport) {
  return matches.filter((entry) => {
    const isGoalkeeper =
      sport === "Florbal" ||
      (entry.role || "Brankář") === "Brankář";

    return isGoalkeeper;
  });
}

function advancedGoalkeeperValue(stats, key) {
  if (!stats || typeof stats !== "object") return null;
  return numberOrNull(stats[key]);
}

function buildAdvancedGoalkeeperLines(goalkeeperMatches) {
  const statsRows = goalkeeperMatches
    .map((entry) => entry.goalkeeper_stats)
    .filter(
      (stats) =>
        stats &&
        typeof stats === "object" &&
        !Array.isArray(stats)
    );

  if (!statsRows.length) return [];

  const sumField = (key) => {
    const values = statsRows
      .map((stats) => advancedGoalkeeperValue(stats, key))
      .filter((value) => value !== null);

    return values.length
      ? values.reduce((sum, value) => sum + value, 0)
      : null;
  };

  const averageField = (key) =>
    averageSeasonReport(
      statsRows.map((stats) => advancedGoalkeeperValue(stats, key))
    );

  const shots = sumField("shots_on_goal");
  const saves = sumField("saves");
  const savePercentage =
    shots !== null && shots > 0 && saves !== null
      ? (saves / shots) * 100
      : null;

  const lines = [];

  if (shots !== null) lines.push(["Střely na bránu", String(shots)]);
  if (saves !== null) lines.push(["Zákroky", String(saves)]);
  if (savePercentage !== null) {
    lines.push([
      "Úspěšnost zákroků",
      `${formatSeasonReportNumber(savePercentage, 1)} %`,
    ]);
  }

  const goalCategories = [
    ["goals_from_cross", "Góly po přihrávce přes brankoviště"],
    ["goals_from_rebound", "Góly z dorážek"],
    ["goals_from_breakaway", "Góly z přečíslení / úniků"],
    ["goals_from_distance", "Góly ze střel z dálky"],
  ];

  goalCategories.forEach(([key, label]) => {
    const value = sumField(key);
    if (value !== null) lines.push([label, String(value)]);
  });

  const ratings = [
    ["communication_rating", "Průměr komunikace"],
    ["movement_rating", "Průměr pohybu"],
    ["positioning_rating", "Průměr poziční hry"],
  ];

  ratings.forEach(([key, label]) => {
    const value = averageField(key);
    if (value !== null) {
      lines.push([
        label,
        `${formatSeasonReportNumber(value, 2)}/10`,
      ]);
    }
  });

  return lines;
}

function buildMatchTypeCards(matches, sport) {
  if (!matches.length) {
    return `
      <div class="empty span-all">
        V této sezóně zatím nejsou žádné zápasy.
      </div>
    `;
  }

  const preferredOrder = [
    "Soutěžní",
    "Neregistrovaná liga",
    "Přátelský/přípravný",
  ];

  const grouped = new Map();

  matches.forEach((entry) => {
    const type = entry.match_type || "Soutěžní";

    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type).push(entry);
  });

  const orderedTypes = [
    ...preferredOrder.filter((type) => grouped.has(type)),
    ...[...grouped.keys()]
      .filter((type) => !preferredOrder.includes(type))
      .sort((a, b) => a.localeCompare(b, "cs")),
  ];

  return orderedTypes
    .map((type) => {
      const typeMatches = grouped.get(type) || [];
      const result = matchResultCounts(typeMatches);
      const ratings = averageSeasonReport(
        typeMatches.map((entry) => entry.rating)
      );

      const goalkeeperMatches = goalkeeperSeasonMatches(
        typeMatches,
        sport
      );

      const concededAverage = averageSeasonReport(
        goalkeeperMatches.map((entry) => entry.goals_conceded)
      );

      const points =
        type === "Soutěžní"
          ? typeMatches.reduce(
              (sum, entry) => sum + (numberOrNull(entry.points) || 0),
              0
            )
          : null;

      const lines = [
        ["Zápasy", String(typeMatches.length)],
        [
          "Bilance",
          `${result.wins} V · ${result.draws} R · ${result.losses} P`,
        ],
      ];

      if (points !== null) {
        lines.push(["Body", String(points)]);
      }

      lines.push([
        "Průměrné hodnocení",
        ratings === null
          ? "—"
          : `${formatSeasonReportNumber(ratings, 2)}/10`,
      ]);

      if (goalkeeperMatches.length) {
        lines.push([
          "Průměr inkasovaných",
          concededAverage === null
            ? "—"
            : formatSeasonReportNumber(concededAverage, 2),
        ]);
      }

      return `
        <article class="season-report-card">
          <h4>${escapeSeasonReportHtml(type)}</h4>
          ${renderSeasonReportStatLines(lines)}
        </article>
      `;
    })
    .join("");
}

function buildSeasonReportHtml(season, entries) {
  const sortedEntries = [...entries].sort((a, b) =>
    String(a.event_date).localeCompare(String(b.event_date))
  );

  const trainings = sortedEntries.filter(
    (entry) => entry.event_type === "Trénink"
  );

  const matches = sortedEntries.filter(
    (entry) => entry.event_type === "Zápas"
  );

  const goalkeeperMatches = goalkeeperSeasonMatches(
    matches,
    season.sport
  );

  const trainingMinutes = trainings.reduce(
    (sum, entry) =>
      sum + (numberOrNull(entry.duration_minutes) || 0),
    0
  );

  const averageTrainingDuration = averageSeasonReport(
    trainings.map((entry) => entry.duration_minutes)
  );

  const averageIntensity = averageSeasonReport(
    trainings.map((entry) => entry.intensity)
  );

  const averageRating = averageSeasonReport(
    matches.map((entry) => entry.rating)
  );

  const averageConceded = averageSeasonReport(
    goalkeeperMatches.map((entry) => entry.goals_conceded)
  );

  const totalConceded = goalkeeperMatches.reduce(
    (sum, entry) =>
      sum + (numberOrNull(entry.goals_conceded) || 0),
    0
  );

  const cleanSheets = goalkeeperMatches.filter(
    (entry) => numberOrNull(entry.goals_conceded) === 0
  ).length;

  const trainingTypes = countSeasonReportValues(
    trainings.map((entry) => entry.training_type)
  );

  const surfaces = countSeasonReportValues(
    sortedEntries.map((entry) => entry.surface)
  );

  const advancedGoalkeeperLines =
    buildAdvancedGoalkeeperLines(goalkeeperMatches);

  const goalkeeperLines = [
    ["Brankářské zápasy", String(goalkeeperMatches.length)],
    ["Celkem inkasovaných", String(totalConceded)],
    [
      "Průměr inkasovaných",
      averageConceded === null
        ? "—"
        : formatSeasonReportNumber(averageConceded, 2),
    ],
    ["Čistá konta", String(cleanSheets)],
    ...advancedGoalkeeperLines,
  ];

  return `
    <article class="season-report-hero">
      <div>
        <p class="eyebrow">${escapeSeasonReportHtml(season.sport)}</p>
        <h3>Sezóna ${escapeSeasonReportHtml(season.season)}</h3>
        <p class="muted">
          Založena ${escapeSeasonReportHtml(
            formatSeasonReportDate(season.created_date)
          )}
          ${
            season.closed_date
              ? ` · uzavřena ${escapeSeasonReportHtml(
                  formatSeasonReportDate(season.closed_date)
                )}`
              : " · report se průběžně aktualizuje"
          }
        </p>
      </div>
      <span class="season-report-status ${
        season.status === "Aktivní" ? "active" : "closed"
      }">
        ${escapeSeasonReportHtml(season.status)}
      </span>
    </article>

    <div class="stats-grid season-report-summary">
      ${[
        ["Záznamy", sortedEntries.length],
        ["Tréninky", trainings.length],
        [
          "Tréninkový čas",
          `${formatSeasonReportNumber(trainingMinutes / 60, 1)} h`,
        ],
        ["Zápasy", matches.length],
        [
          "Průměrné hodnocení",
          averageRating === null
            ? "—"
            : `${formatSeasonReportNumber(averageRating, 2)}/10`,
        ],
        [
          "Průměr inkasovaných",
          averageConceded === null
            ? "—"
            : formatSeasonReportNumber(averageConceded, 2),
        ],
      ]
        .map(
          ([label, value]) => `
            <div class="stat-card">
              <span>${escapeSeasonReportHtml(label)}</span>
              <strong>${escapeSeasonReportHtml(value)}</strong>
            </div>
          `
        )
        .join("")}
    </div>

    <div class="season-report-section-title">
      <h3>Tréninky</h3>
      <p class="muted small">Objem, náročnost a nejčastější typy tréninků.</p>
    </div>

    <div class="season-report-detail-grid">
      <article class="season-report-card">
        <h4>Souhrn tréninků</h4>
        ${renderSeasonReportStatLines([
          ["Počet tréninků", String(trainings.length)],
          [
            "Celkový čas",
            `${formatSeasonReportNumber(trainingMinutes / 60, 1)} h`,
          ],
          [
            "Průměrná délka",
            averageTrainingDuration === null
              ? "—"
              : `${formatSeasonReportNumber(
                  averageTrainingDuration,
                  0
                )} min`,
          ],
          [
            "Průměrná náročnost",
            averageIntensity === null
              ? "—"
              : `${formatSeasonReportNumber(
                  averageIntensity,
                  2
                )}/10`,
          ],
        ])}
      </article>

      <article class="season-report-card">
        <h4>Typy tréninků</h4>
        ${
          trainingTypes.length
            ? `
              <div class="season-report-training-types">
                ${trainingTypes
                  .map(
                    ([label, count]) => `
                      <span class="season-report-list-badge">
                        ${escapeSeasonReportHtml(label)} · ${count}×
                      </span>
                    `
                  )
                  .join("")}
              </div>
            `
            : '<p class="muted">V této sezóně zatím nejsou tréninky.</p>'
        }
      </article>
    </div>

    <div class="season-report-section-title">
      <h3>Zápasy podle typu</h3>
      <p class="muted small">
        Soutěžní, neregistrované a přátelské zápasy jsou vyhodnocené odděleně.
      </p>
    </div>

    <div class="season-report-type-grid">
      ${buildMatchTypeCards(matches, season.sport)}
    </div>

    ${
      goalkeeperMatches.length
        ? `
          <div class="season-report-section-title">
            <h3>Brankářské statistiky</h3>
            <p class="muted small">
              Základní i rozšířené statistiky ze zápasů, ve kterých jsi chytal.
            </p>
          </div>

          <div class="season-report-detail-grid">
            <article class="season-report-card">
              <h4>Brankářský souhrn</h4>
              ${renderSeasonReportStatLines(goalkeeperLines)}
            </article>

            <article class="season-report-card">
              <h4>Povrchy během sezóny</h4>
              ${
                surfaces.length
                  ? `
                    <div class="season-report-surface-list">
                      ${surfaces
                        .map(
                          ([label, count]) => `
                            <span class="season-report-list-badge">
                              ${escapeSeasonReportHtml(label)} · ${count}×
                            </span>
                          `
                        )
                        .join("")}
                    </div>
                  `
                  : '<p class="muted">U záznamů zatím nejsou vyplněné povrchy.</p>'
              }
            </article>
          </div>
        `
        : surfaces.length
          ? `
            <div class="season-report-section-title">
              <h3>Povrchy během sezóny</h3>
            </div>
            <article class="season-report-card">
              <div class="season-report-surface-list">
                ${surfaces
                  .map(
                    ([label, count]) => `
                      <span class="season-report-list-badge">
                        ${escapeSeasonReportHtml(label)} · ${count}×
                      </span>
                    `
                  )
                  .join("")}
              </div>
            </article>
          `
          : ""
    }

    <div class="season-report-section-title">
      <h3>Vývoj v sezóně</h3>
      <p class="muted small">Grafy se počítají pouze z této konkrétní sezóny.</p>
    </div>

    <div class="season-report-chart-grid">
      <article class="season-report-chart-card">
        <div class="season-report-chart-heading">
          <h4>Tréninkový čas po měsících</h4>
          <span>hodiny</span>
        </div>
        <div id="season-report-training-time"></div>
      </article>

      <article class="season-report-chart-card">
        <div class="season-report-chart-heading">
          <h4>Hodnocení zápasů</h4>
          <span>1–10</span>
        </div>
        <div id="season-report-match-ratings"></div>
      </article>

      <article class="season-report-chart-card">
        <div class="season-report-chart-heading">
          <h4>Inkasované góly</h4>
          <span>brankářské zápasy</span>
        </div>
        <div id="season-report-goals-conceded"></div>
      </article>

      <article class="season-report-chart-card">
        <div class="season-report-chart-heading">
          <h4>Bilance zápasů</h4>
          <span>výhry · remízy · prohry</span>
        </div>
        <div
          id="season-report-results"
          class="season-report-result-chart"
        ></div>
      </article>
    </div>

    <div class="season-report-section-title">
      <h3>Celkové zhodnocení</h3>
    </div>

    <article class="season-report-review">
      <h4>Tvoje zhodnocení sezóny</h4>
      <p>${
        season.season_review
          ? escapeSeasonReportHtml(season.season_review)
          : '<span class="muted">Zhodnocení této sezóny zatím není vyplněné.</span>'
      }</p>
    </article>
  `;
}

function renderSeasonReportCharts(season, entries) {
  const sortedEntries = [...entries].sort((a, b) =>
    String(a.event_date).localeCompare(String(b.event_date))
  );

  const trainings = sortedEntries.filter(
    (entry) => entry.event_type === "Trénink"
  );

  const matches = sortedEntries.filter(
    (entry) => entry.event_type === "Zápas"
  );

  const goalkeeperMatches = goalkeeperSeasonMatches(
    matches,
    season.sport
  ).filter(
    (entry) => numberOrNull(entry.goals_conceded) !== null
  );

  const monthly = new Map();

  trainings.forEach((entry) => {
    if (!entry.event_date) return;

    const key = String(entry.event_date).slice(0, 7);
    monthly.set(
      key,
      (monthly.get(key) || 0) +
        (numberOrNull(entry.duration_minutes) || 0)
    );
  });

  renderSeasonReportColumnChart(
    "#season-report-training-time",
    [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, minutes]) => ({
        label: seasonReportMonthLabel(key),
        value: minutes / 60,
      })),
    {
      decimals: 1,
      suffix: " h",
      emptyText: "V této sezóně zatím nejsou tréninky.",
    }
  );

  renderSeasonReportColumnChart(
    "#season-report-match-ratings",
    matches
      .filter((entry) => numberOrNull(entry.rating) !== null)
      .map((entry) => ({
        label: shortSeasonReportDate(entry.event_date),
        value: numberOrNull(entry.rating),
      })),
    {
      maxValue: 10,
      emptyText:
        "V této sezóně zatím nejsou hodnocené zápasy.",
    }
  );

  renderSeasonReportColumnChart(
    "#season-report-goals-conceded",
    goalkeeperMatches.map((entry) => ({
      label: shortSeasonReportDate(entry.event_date),
      value: numberOrNull(entry.goals_conceded),
    })),
    {
      emptyText:
        "V této sezóně zatím nejsou brankářské zápasy.",
    }
  );

  renderSeasonReportResults(matches);
}

async function openSeasonReport(seasonId) {
  const content = $seasonReport("#season-report-content");
  if (!content) return;

  seasonReportState.currentSeasonId = String(seasonId);
  activateSeasonReportPage();

  content.innerHTML = `
    <div class="empty season-report-loading">
      Načítám report sezóny…
    </div>
  `;

  try {
    const client = await getSeasonReportClient();

    const { data: season, error: seasonError } = await client
      .from("sport_seasons")
      .select("*")
      .eq("id", seasonId)
      .maybeSingle();

    if (seasonError) throw seasonError;
    if (!season) throw new Error("Sezóna nebyla nalezena.");

    const { data: entries, error: entriesError } = await client
      .from("sport_entries")
      .select("*")
      .eq("sport", season.sport)
      .eq("season", season.season)
      .order("event_date", { ascending: true });

    if (entriesError) throw entriesError;

    content.innerHTML = buildSeasonReportHtml(
      season,
      entries || []
    );

    renderSeasonReportCharts(season, entries || []);
  } catch (error) {
    console.warn("Report sezóny se nepodařilo načíst.", error);

    content.innerHTML = `
      <div class="empty season-report-loading">
        ${escapeSeasonReportHtml(
          error.message || "Report sezóny se nepodařilo načíst."
        )}
      </div>
    `;
  }
}

function bindSeasonReportEvents() {
  document.addEventListener(
    "click",
    (event) => {
      const reportButton = event.target.closest(
        "[data-season-report]"
      );

      if (reportButton) {
        openSeasonReport(reportButton.dataset.seasonReport);
        return;
      }

      if (event.target.closest("#season-report-back")) {
        returnToSeasonsPage();
        return;
      }

      if (event.target.closest("#season-report-refresh")) {
        if (seasonReportState.currentSeasonId) {
          openSeasonReport(seasonReportState.currentSeasonId);
        }
        return;
      }

      if (
        event.target.closest(
          '.nav-tabs button[data-page="seasons"]'
        )
      ) {
        requestAnimationFrame(annotateAllSeasonReportButtons);
      }
    },
    true
  );
}

injectSeasonReportStyles();
waitForSeasonReportElements();
bindSeasonReportEvents();
annotateAllSeasonReportButtons();
