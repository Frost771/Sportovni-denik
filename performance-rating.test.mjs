import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {isPlayedMatch} from "./match-participation.js";
import {KIT_FIELDS, kitFields, kitColorOptions} from "./kit.js";

const output={};
const average=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const context={
  isPlayedMatch,KIT_FIELDS,kitFields,kitColorOptions,average,
  $stats:id=>id==="#stats-kit"?output:{value:id==="#stats-sport"?"Florbal":"2026/2027"},
  statsState:{entries:[]},individualSummaryHtml:()=>"",safeText:v=>v,
  averageSeasonReport:average,formatSeasonReportNumber:v=>v.toFixed(2).replace(".",","),
  escapeSeasonReportHtml:v=>v,matchResultCounts:()=>({wins:0}),
  renderSeasonReportStatLines:rows=>rows.map(row=>row.join(": ")).join(" | "),
};
vm.createContext(context);
const stats=fs.readFileSync(new URL("./stats.js",import.meta.url),"utf8");
vm.runInContext(stats.slice(stats.indexOf("function renderKitStats("),stats.indexOf("function comparisonSummary(")),context);
const report=fs.readFileSync(new URL("./season-report.js",import.meta.url),"utf8");
const start=report.indexOf("function buildSeasonReportKit(");
vm.runInContext(report.slice(start,report.indexOf("\nfunction ",start+1)),context);
const match={event_type:"Zápas",sport:"Florbal",role:"Brankář",jersey_color:"blue",minutes_played:60,rating:8};
const sample=[match,{...match,rating:6},{...match,rating:null},{...match,minutes_played:0,rating:null},{...match,minutes_played:0,rating:1}];
context.renderKitStats(sample);
assert.match(output.innerHTML,/Průměrné hodnocení výkonu: 7,00\/10 · hodnoceno 2 z 3/);
const seasonHtml=context.buildSeasonReportKit(sample,"Florbal");
assert.match(seasonHtml,/Průměrné hodnocení výkonu: 7,00\/10/);
assert.match(seasonHtml,/hodnocení výkonu: 2 z 3/);
context.renderKitStats([{...match,minutes_played:0,rating:null}]);
assert.match(output.innerHTML,/Průměrné hodnocení výkonu: — · hodnoceno 0 z 0/);
console.log("PASS: performance averages and denominators exclude bench matches in kit statistics and season report");