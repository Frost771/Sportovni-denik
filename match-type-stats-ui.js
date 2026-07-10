import { summarize } from "./match-type-stats-data.js";

const line = (label, value) => `<div class="stat-line"><span>${label}</span><strong>${value}</strong></div>`;

export function ensureMatchTypeSection() {
  if (document.querySelector("#match-type-breakdown")) return;
  const anchor = document.querySelector("#detailed-stats");
  if (!anchor) return;
  const section = document.createElement("section");
  section.id = "match-type-breakdown";
  section.innerHTML = `
    <div class="section-heading"><div>
      <p class="eyebrow">Rozdělení zápasů</p>
      <h2>Statistiky podle typu zápasu</h2>
    </div></div>
    <div id="match-type-stats-grid" class="detail-grid"></div>`;
  anchor.insertAdjacentElement("afterend", section);
}

export function renderTypeCard(sport, type, matches) {
  if (!matches.length) {
    return `<div class="detail-card"><h3>${sport} · ${type}</h3><div class="empty">Zatím žádný zápas.</div></div>`;
  }
  const stats = summarize(matches, type);
  const rows = [line("Zápasy", stats.matches), line("Bilance", stats.balance)];
  if (stats.points !== null) rows.push(line("Body", stats.points));
  if (stats.goalkeeperMatches) {
    rows.push(line("Brankářské zápasy", stats.goalkeeperMatches));
    rows.push(line("Průměr inkasovaných", stats.concededAverage));
    rows.push(line("Čistá konta", stats.cleanSheets));
  }
  rows.push(line("Průměrné hodnocení", stats.rating));
  return `<div class="detail-card"><h3>${sport} · ${type}</h3>${rows.join("")}</div>`;
}