import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {MATCH_TYPES} from "./match-type-stats-data.js";
import {ensureMatchTypeSection,renderTypeCard} from "./match-type-stats-ui.js";
const $=s=>document.querySelector(s);let c,t;
async function render(){ensureMatchTypeSection();const grid=$("#match-type-stats-grid");if(!grid)return;const cfg=await import("./config.js");c||=createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);const{data,error}=await c.from("sport_entries").select("sport,season,match_type,role,result,points,goals_conceded,rating").eq("event_type","Zápas");if(error)return;const sport=$("#dashboard-sport")?.value||"Vše",season=$("#dashboard-season")?.value||"Vše",sports=sport==