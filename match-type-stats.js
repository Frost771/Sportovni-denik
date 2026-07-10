import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const TYPES = ["Soutěžní", "Neregistrovaná liga", "Přátelský/přípravný"];
const $ = (s) => document.querySelector(s);
let client;
let timer;

const average = (values) => {
  const numbers = values.filter(Number.isFinite);
  return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
};

async function getClient() {
  if (client) return client;
  const config = await import("./config.js");
  client = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

function ensureSection() {
  if ($("#match-type-breakdown")) return;
  const anchor = $("#detailed-stats");
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

function line(label, value) {
  return `<div class="stat-line"><span>${label}</span><strong>${value}</strong></div>`;
}

function card(sport, type, matches) {
  if (!matches.length) {
    return `<div class="detail-card"><h3