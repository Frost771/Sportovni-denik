// Match attendance and time on the pitch are independent facts.
export const MATCH_ROLES = ["Jednička", "Dvojka", "Trojka", "Kustod"];

export function isPlayedMatch(entry) {
  return entry.event_type === "Zápas" && entry.match_role !== "Kustod" && Number.isFinite(entry.minutes_played) && entry.minutes_played > 0;
}

export function isGoalkeeperStart(entry) {
  return isPlayedMatch(entry) && (entry.role || "Brankář") === "Brankář";
}

export function participationSummary(entries) {
  const matches = entries.filter(e => e.event_type === "Zápas");
  return {
    attendance: matches.length,
    played: matches.filter(isPlayedMatch).length,
    goalkeeperStarts: matches.filter(isGoalkeeperStart).length,
    bench: matches.filter(e => e.match_role !== "Kustod" && e.minutes_played === 0).length,
    staff: matches.filter(e => e.match_role === "Kustod").length,
    unknownMinutes: matches.filter(e => e.match_role !== "Kustod" && !Number.isFinite(e.minutes_played)).length,
    minutes: matches.filter(isPlayedMatch).reduce((sum, e) => sum + e.minutes_played, 0),
  };
}

export function matchMetadataFromCsv(row) {
  const role = String(row.role_na_utkani || "").trim();
  if (role && !MATCH_ROLES.includes(role)) throw new Error("Neplatná role na utkání v CSV.");
  return { match_role: role || null, team: row.tym || null, competition: row.soutez || null };
}

export function matchMetadataToCsv(entry) {
  return { role_na_utkani: entry.match_role || "", tym: entry.team || "", soutez: entry.competition || "" };
}
