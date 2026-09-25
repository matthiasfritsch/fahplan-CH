/* Einmaliger Test (Runde 2): Eventfrog-Doku und FleaFind-Struktur.
   Laeuft in GitHub Actions, gibt keine Schluessel aus. */
const UA = { "user-agent": "Mozilla/5.0 (Fahrplan-Board probe)" };
async function get(url) {
  const r = await fetch(url, { headers: UA, redirect: "follow" });
  return { status: r.status, ct: r.headers.get("content-type") || "", text: await r.text() };
}
// 1) Eventfrog Doku: Links auf OpenAPI-Spezifikation suchen
for (const u of ["https://docs.api.eventfrog.net/", "https://api.eventfrog.net/public/v1/openapi.json",
                 "https://api.eventfrog.net/openapi.json", "https://api.eventfrog.net/public/openapi.json",
                 "https://api.eventfrog.net/v3/api-docs", "https://api.eventfrog.net/public/v1/v3/api-docs"]) {
  try {
    const r = await get(u);
    console.log(`\n##### ${u} ${r.status} ${r.ct} len=${r.text.length}`);
    if (/json|yaml/.test(r.ct) && r.status === 200) {
      const spec = JSON.parse(r.text);
      for (const [p, ops] of Object.entries(spec.paths || {})) {
        if (!/event|rubric|location/i.test(p)) continue;
        for (const [m, op] of Object.entries(ops)) {
          console.log(`${m.toUpperCase()} ${p}: ` + (op.parameters || []).map(x => `${x.name}(${x.in})`).join(", "));
        }
      }
      const schemas = spec.components?.schemas || {};
      for (const [k, v] of Object.entries(schemas)) if (/event/i.test(k)) console.log("SCHEMA", k, Object.keys(v.properties || {}).join(","));
    } else {
      const links = [...new Set((r.text.match(/(href|src|url)=["']?[^"' >]+/gi) || []))].filter(l => /json|yaml|spec|api/i.test(l)).slice(0, 30);
      console.log(links.join("\n"));
      console.log(r.text.slice(0, 600));
    }
  } catch (e) { console.log(`##### ${u} FEHLER ${e.message}`); }
}
// 2) FleaFind Basel: JSON-LD Bloecke zusammenfassen
const ff = await get("https://www.fleafind.ch/de/schweiz/basel");
const blocks = [...ff.text.matchAll(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
console.log(`\n##### fleafind jsonld blocks=${blocks.length}`);
for (const b of blocks) {
  try {
    const d = JSON.parse(b);
    const list = [].concat(d["@graph"] || d);
    for (const n of list) {
      const t = [].concat(n["@type"]).join();
      if (/Event/.test(t)) console.log("EVENT", n.name, "|", n.startDate, "|", n.endDate, "|", n.location?.name, "|", n.location?.address?.addressLocality || n.location?.address);
      else if (/ItemList/.test(t)) for (const it of (n.itemListElement || []).slice(0, 25)) { const x = it.item || it; console.log("ITEM", [].concat(x["@type"]).join(), x.name, "|", x.startDate, "|", x.location?.name, "|", x.url); }
      else console.log("TYPE", t);
    }
  } catch (e) { console.log("parse error", e.message); }
}
