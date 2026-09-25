/* Einmaliger Test (Runde 3). Keine Schluessel. */
const UA = { "user-agent": "Mozilla/5.0 (Fahrplan-Board probe)" };
const get = async (u) => { const r = await fetch(u, { headers: UA }); return { s: r.status, ct: r.headers.get("content-type"), t: await r.text() }; };
const d = await get("https://docs.api.eventfrog.net/");
console.log("##### DOCS SCRIPTS");
console.log(d.t.slice(d.t.indexOf("<body")).replace(/\s+/g, " ").slice(0, 2500));
const urls = [...new Set(d.t.match(/https?:\/\/[^"'\s<>)]+/g) || [])];
console.log("URLS:", urls.join("\n"));
for (const u of urls.filter(u => /json|yaml|spec|openapi/i.test(u))) {
  const r = await get(u);
  console.log(`\n##### SPEC ${u} ${r.s} ${r.ct} len=${r.t.length}`);
  try {
    const spec = JSON.parse(r.t);
    console.log("servers:", JSON.stringify(spec.servers));
    console.log("security:", JSON.stringify(spec.components?.securitySchemes));
    for (const [p, ops] of Object.entries(spec.paths || {})) {
      for (const [m, op] of Object.entries(ops)) {
        const params = (op.parameters || []).map(x => x.$ref ? x.$ref.split("/").pop() : `${x.name}(${x.in}${x.schema?.type ? ":" + x.schema.type : ""})`);
        console.log(`${m.toUpperCase()} ${p}: ${params.join(", ")}`);
      }
    }
    const P = spec.components?.parameters || {};
    for (const [k, v] of Object.entries(P)) console.log("PARAM", k, v.name, v.in, v.schema?.type, (v.description || "").slice(0, 100));
    const S = spec.components?.schemas || {};
    for (const [k, v] of Object.entries(S)) if (/event|location|rubric|page/i.test(k)) console.log("SCHEMA", k, Object.keys(v.properties || {}).join(","));
  } catch (e) { console.log(r.t.slice(0, 1500)); }
}
const ff = await get("https://www.fleafind.ch/de/schweiz/basel");
let i = 0, n = 0;
while ((i = ff.t.indexOf("ld+json", i + 1)) > 0 && n++ < 3) console.log("\n##### FF", ff.t.slice(i - 50, i + 900).replace(/\s+/g, " "));
