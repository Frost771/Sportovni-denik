// Veřejné údaje z: Supabase → Project Settings → API.
// Vlož pouze publishable/anon klíč. Nikdy sem nedávej service_role key.
// Oprava formuláře se musí načíst dřív než app.js zaregistruje reset listener.
import "./form-fix.js";
// Rychlé šablony a zopakování posledního záznamu.
import "./quick-entry.js";

export const SUPABASE_URL = "https://hekqktfhtvkzxjyslnde.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_6KGafi-gkmj3KCkdBLM97Q_g1-WZjg3";