import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const fields = new Map();
const get = selector => {
  if (!fields.has(selector)) fields.set(selector, {
    value: "", classList: {toggle(){}, add(){}, remove(){}},
    // Rebuilding a browser select resets its value to the first option.
    set innerHTML(html) { this.html = html; if (selector.endsWith("season")) this.value = html.match(/value="([^"]*)"/)?.[1] || ""; },
    get innerHTML() { return this.html; },
    reset() { for (const field of fields.values()) field.value = ""; },
  });
  return fields.get(selector);
};
const seasons = [
  {sport:"Florbal",season:"2025/2026",status:"Uzavřená"},
  {sport:"Florbal",season:"2026/2027",status:"Aktivní"},
  {sport:"Fotbal",season:"2025/2026",status:"Aktivní"},
  {sport:"Fotbal",season:"2026/2027",status:"Uzavřená"},
];
const client = { from: table => ({ select: () => ({order: async () => ({data:table === "sport_seasons" ? seasons : [],error:null})}) }) };
const context = {
  SUPABASE_URL:"https://example.test", SUPABASE_PUBLISHABLE_KEY:"test", createClient:()=>client,
  document: {querySelector:get,querySelectorAll:()=>[],createElement:()=>({set textContent(v){this.innerHTML=String(v??"");}})},
  KIT_FIELDS:[],kitFields:()=>[],populateKitOptions(){},
};
vm.createContext(context);
const source=fs.readFileSync(new URL("./app.js",import.meta.url),"utf8").replace(/^import .*;\r?\n/gm,"").replace(/init\(\);\s*$/,"");
vm.runInContext(source,context);
context.sampleSeasons=seasons;
vm.runInContext('state.seasons=sampleSeasons; state.user={id:"test"};',context);
get("#sport").value="Florbal";
context.refreshSeasonSelectors();
assert.equal(get("#season").value,"2026/2027");
get("#season").value="2025/2026";
get("#event-type").value="Zápas";
for (const field of ["#role", "#match-type", "#goals-for", "#goals-against", "#minutes-played", "#event-date"]) {
  get(field).value="1";
  context.updateEntryFormVisibility();
  assert.equal(get("#season").value,"2025/2026",field);
}
// Auth session refresh after changing browser tabs calls loadAll.
vm.runInContext('renderDashboard=()=>{}; renderRecords=()=>{}; renderSeasons=()=>{};',context);
await context.loadAll();
assert.equal(get("#season").value,"2025/2026","refresh after returning to browser tab");
get("#sport").value="Fotbal";
context.updateEntryFormVisibility();
assert.equal(get("#season").value,"2025/2026","new sport uses its active season");
get("#season").value="2026/2027";
context.updateEntryFormVisibility();
assert.equal(get("#season").value,"2026/2027","closed season preserved in new entry");
vm.runInContext('state.editingId="test-entry";',context);
context.refreshSeasonSelectors();
assert.equal(get("#season").value,"2026/2027","editing keeps selected season");
context.resetEntryForm();
assert.equal(get("#season").value,"2026/2027","reset chooses active floorball season");
get("#season").value="2025/2026";
context.resetEntryForm();
assert.equal(get("#season").value,"2026/2027","reset discards previous closed season");
vm.runInContext('state.seasons=state.seasons.filter(s=>s.sport!=="Fotbal");',context);
get("#sport").value="Fotbal";
context.refreshSeasonSelectors();
assert.equal(get("#season").value,"","sport without seasons");
console.log("PASS: closed season preserved across field changes and reloads; sport changes, editing and reset select correctly");