import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { MATCH_TYPES } from "./match-type-stats-data.js";
import { ensureMatchTypeSection, renderTypeCard } from "./match-type-stats-ui.js";

let client;
let timer;
const $ = (selector) => document.querySelector(selector);

async function getClient() {
  if (client) return client;
  const config = await import("./config.js");
  client = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

async function renderMatchTypeStats() {
  ensureMatchTypeSection