export const KIT_COLORS = Object.freeze({ white: "Bílá", black: "Černá", yellow: "Žlutá", red: "Červená", blue: "Modrá" });
export const KIT_FIELDS = ["jersey_color", "shorts_color", "socks_color"];
export function kitFields(entry) {
  if (entry.event_type !== "Zápas") return [];
  if (entry.sport === "Florbal") return ["jersey_color"];
  return entry.sport === "Fotbal" && (entry.role || "Brankář") === "Brankář" ? KIT_FIELDS : [];
}
export function kitColorOptions(sport, field) {
  const codes = sport === "Florbal" ? ["white", "black", "blue"] : field === "shorts_color" ? ["black", "yellow", "red"] : ["black", "yellow", "red", "blue"];
  return codes.map(code => [code, KIT_COLORS[code]]);
}
export function normalizeKit(entry) {
  const allowed = kitFields(entry);
  return Object.fromEntries(KIT_FIELDS.map(field => {
    const color = entry[field] || null;
    if (!allowed.includes(field)) return [field, null];
    if (color !== null && !Object.hasOwn(KIT_COLORS, color)) throw new Error("Neplatná barva výstroje.");
    if (field === "shorts_color" && color === "blue") throw new Error("Modré trenky nejsou v nabídce.");
    return [field, color];
  }));
}
export function kitSummary(entry) {
  const labels = { jersey_color: "Dres", shorts_color: "Trenky", socks_color: "Štulpny" };
  return kitFields(entry).filter(field => Object.hasOwn(KIT_COLORS, entry[field]))
    .map(field => labels[field] + ": " + KIT_COLORS[entry[field]]).join(" · ");
}
export function populateKitOptions(root = document) {
  for (const field of KIT_FIELDS) {
    const select = root.querySelector("#" + field.replaceAll("_", "-"));
    if (!select) continue;
    const previous = select.value;
    select.innerHTML = '<option value="">Neuvedeno</option>' + kitColorOptions(root.querySelector("#sport")?.value, field)
      .map(([code, label]) => '<option value="' + code + '">' + label + '</option>').join("");
    select.value = previous;
  }
}
