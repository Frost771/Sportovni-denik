import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { KIT_FIELDS, kitFields, normalizeKit, kitSummary } from "./kit.js";
const football = {event_type:"Zápas",sport:"Fotbal",role:"Brankář",jersey_color:"blue",shorts_color:"black",socks_color:"blue"};
assert.equal(kitFields(football).length,3);
assert.deepEqual(normalizeKit(football),{jersey_color:"blue",shorts_color:"black",socks_color:"blue"});
assert.deepEqual(normalizeKit({...football,sport:"Florbal"}),{jersey_color:"blue",shorts_color:null,socks_color:null});
for(const entry of [{...football,event_type:"Trénink"},{...football,role:"Hráč v poli"}]) {
 assert.deepEqual(normalizeKit(entry),{jersey_color:null,shorts_color:null,socks_color:null});
}
assert.throws(()=>normalizeKit({...football,jersey_color:"invalid"}));
assert.throws(()=>normalizeKit({...football,shorts_color:"blue"}));
assert.equal(kitSummary({...football,sport:"Florbal"}),"Dres: Modrá");
const fields=new Map();
const get=selector=>{
 if(!fields.has(selector))fields.set(selector,{value:"",classList:{toggle(){},add(){},remove(){}},closest(){return {classList:{toggle(){}}}}});
 return fields.get(selector);
};
const context={KIT_FIELDS,kitFields,normalizeKit,kitSummary,populateKitOptions(){},SUPABASE_URL:"",SUPABASE_PUBLISHABLE_KEY:"",document:{querySelector:get,querySelectorAll:()=>[]},crypto:globalThis.crypto,console};
vm.createContext(context);
const source=fs.readFileSync(new URL("./app.js",import.meta.url),"utf8").replace(/^import .*;\r?\n/gm,"").replace(/init\(\);\s*$/,"");
vm.runInContext(source,context);
for(const [id,val]of Object.entries({"event-type":"Zápas",sport:"Fotbal",season:"2026/2027",role:"Brankář","event-date":"2026-09-08",opponent:"Test",venue:"Doma","goals-for":"2","goals-against":"0","minutes-played":"90",rating:"8","goals-conceded":"0","jersey-color":"blue","shorts-color":"black","socks-color":"blue"}))get("#"+id).value=val;
assert.equal(context.buildEntryPayload().shorts_color,"black");
get("#sport").value="Florbal";
assert.equal(context.buildEntryPayload().jersey_color,"blue");
assert.equal(context.buildEntryPayload().shorts_color,null);
get("#sport").value="Fotbal";get("#role").value="Hráč v poli";
assert.equal(context.buildEntryPayload().jersey_color,null);
const imported=context.entryFromCsv({typ_udalosti:"Zápas",sport:"Fotbal",role:"Brankář",datum:"08.09.2026",dres_barva:"blue",trenky_barva:"black",stulpny_barva:"blue"});
assert.equal(imported.shorts_color,"black");
assert.equal(context.entryFromCsv({typ_udalosti:"Zápas",sport:"Florbal",datum:"08.09.2026"}).jersey_color,null);
console.log("PASS: kit eligibility, validation, match payloads, CSV compatibility");
