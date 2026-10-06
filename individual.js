export function individualSummary(entries) {
  const selected = entries.filter(entry => entry.is_individual === true);
  const groups = new Map();
  let minutes = 0;
  for (const entry of selected) {
    // Matches already store played minutes; never count both duration fields.
    const raw = entry.event_type === "Zápas" ? entry.minutes_played : entry.duration_minutes;
    const time = Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : 0;
    const type = entry.event_type === "Trénink" ? (entry.training_type || "Trénink") : (entry.match_type || "Zápas");
    const label = [entry.sport, type].filter(Boolean).join(" · ");
    const group = groups.get(label) || { label, count: 0, minutes: 0 };
    group.count++; group.minutes += time; groups.set(label, group);
    minutes += time;
  }
  return { count: selected.length, minutes, groups: [...groups.values()].sort((a,b) => a.label.localeCompare(b.label, "cs")) };
}

export function individualSummaryHtml(entries, escape) {
  const summary = individualSummary(entries);
  const time = minutes => minutes + " min";
  return '<article class="detail-card individual-summary"><h3>Florbalové individuály</h3>' +
    '<div class="stat-line"><span>Počet aktivit</span><strong>' + summary.count + '</strong></div>' +
    '<div class="stat-line"><span>Celkový čas</span><strong>' + time(summary.minutes) + '</strong></div>' +
    '<p class="muted small">Označené aktivity ze všech sportů v dané sezóně. U zápasů se počítají odehrané minuty.</p>' +
    summary.groups.map(group => '<div class="stat-line"><span>' + escape(group.label) +
      '</span><strong>' + group.count + '× · ' + time(group.minutes) + '</strong></div>').join("") + '</article>';
}
