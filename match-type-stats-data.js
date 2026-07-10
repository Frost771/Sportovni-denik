export const MATCH_TYPES = ["Soutěžní", "Neregistrovaná liga", "Přátelský/přípravný"];

export function average(values) {
  const numbers = values.filter(Number.isFinite);
  return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
}

export function summarize(matches, type) {
  const wins = matches.filter((entry) => entry.result?.startsWith("Výhra")).length;
  const draws = matches.filter((entry) => entry.result === "Remíza").length;
  const losses = matches.filter((entry) => entry.result?.startsWith("Prohra")).length;
  const goalkeepers = matches.filter((entry) => (entry.role || "Brankář") === "Brankář");
  const conceded = goalkeepers.reduce((sum, entry) => sum + (entry.goals_conceded || 0), 0);

  return {
    matches: matches.length,
    balance: `${wins} V · ${draws} R · ${losses} P`,
    points: type === "Soutěžní" ? matches.reduce((sum, entry) => sum + (entry.points || 0), 0) : null,
    goalkeeperMatches: goalkeepers.length,
    concededAverage: goalkeepers.length ? (conceded / goalkeepers.length).toFixed(2) : null,
    cleanSheets: goalkeepers.filter((entry) => entry.goals_conceded === 0).length,
    rating: `${average(matches.map((entry) => entry.rating)).toFixed(2)}/10`,
  };
}