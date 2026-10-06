import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { individualSummary, individualSummaryHtml } from "./individual.js";
import { KIT_FIELDS, normalizeKit } from "./kit.js";
const sample = [
 {event_type:"Trénink",sport:"Florbal",training_type:"Lokotka",duration_minutes:90,is_individual:true},
 {event_type:"Trénink",sport:"Florbal",training_type:"Lokotka",duration_minutes:30,is_individual:true},
 {event_type:"Zápas",sport:"Fotbal",minutes_played:45,duration_minutes:100,is_individual:true},
 {event_type:"Trénink",duration_minutes:999}, {is_individual:false,duration_minutes:999}
];
assert.equal(individualSummary(sample).count,3);
assert.equal(individualSummary(sample).minutes,165);
assert.equal(individualSummary(sample).groups[0].count,2);
assert.deepEqual(individualSummary([]),{count:0,minutes:0,groups:[]});
assert.equal(individualSummary([{is_individual:true,duration_minutes:null}]).minutes,0);
assert.equal(individualSummary([{is_individual:"false",duration_minutes:90}]).count,0);
assert.ok(individualSummaryHtml(sample,x=>x).includes("2,75 h"));
const fields=new Map();
const get=s=>{
 if(!fields.has(s)) fields.set(s,{value:"",checked:false,classList:{toggle(){},add(){},remove(){}}});
 return fields.get(s);
};
const context={KIT_FIELDS,normalizeKit,SUPABASE_URL:"",SUPABASE_PUBLISHABLE_KEY:"",document:{querySelector:get},crypto:globalThis.crypto};
vm.createContext(context);
const source=fs.readFileSync(new URL("./app.js",import.meta.url),"utf8").replace(/^import .*;\r?\n/gm,"").replace(/init\(\);\s*$/,"");
vm.runInContext(source,context);
for(const [id,val]of Object.entries({"event-type":"Trénink",sport:"Florbal",season:"2026/2027","event-date":"2026-10-06","training-type":"Lokotka","duration-minutes":"90",intensity:"5"}))get("#"+id).value=val;
get("#is-individual").checked=true;
assert.equal(context.buildEntryPayload().is_individual,true);
get("#is-individual").checked=false;
assert.equal(context.buildEntryPayload().is_individual,false);
assert.equal(context.entryFromCsv({typ_udalosti:"Trénink",datum:"06.10.2026"}).is_individual,false);
for(const individual of ["true","1","ano"]) assert.equal(context.entryFromCsv({typ_udalosti:"Trénink",datum:"06.10.2026",individual}).is_individual,true);
assert.equal(context.entryFromCsv({typ_udalosti:"Trénink",datum:"06.10.2026",individual:"false"}).is_individual,false);
console.log("PASS: individual totals, match time, legacy entries, checkbox payload and CSV compatibility");

