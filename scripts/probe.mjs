/* Temporaer: Live-Diagnose + weitere Kandidaten-Quellen. Keine Schluessel. */
const UA = { "user-agent": "Mozilla/5.0 (Fahrplan-Board probe)" };
const txt = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, "\n").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").split("\n").map(s => s.trim()).filter(Boolean);
const d = await (await fetch("https://fahplan-ch.vercel.app/api/board?debug=1&x=" + Date.now())).json();
console.log("LIVE REPORT", JSON.stringify(d.sourceReport));
const cands = [
  ["nmbs", "https://www.nmbs.ch/de/events/agenda.html"],
  ["zoo", "https://www.zoobasel.ch/de/aktuelles/veranstaltungen/"],
  ["ggg511", "https://www.stadtbibliothekbasel.ch/de/kinderveranstaltungen-511-jahre-_content---1--1133.html"],
  ["museenbasel", "https://www.museenbasel.ch/de/agenda?zielgruppe=kinder"],
  ["museenbasel2", "https://www.museenbasel.ch/de/agenda"],
  ["theaterbasel", "https://www.theater-basel.ch/de/fuerfamilien"],
  ["arlecchino", "https://theater-arlecchino.ch/programm-und-produktionen/"],
  ["beyeler", "https://www.fondationbeyeler.ch/besuch/familien"],
  ["kindermuseum", "https://www.spielzeug-welten-museum-basel.ch/"],
  ["ferienpass", "https://www.ferienpass-basel.ch/"],
  ["baselcom", "https://www.basel.com/de/veranstaltungen"],
  ["kulturbasel", "https://www.kultur-basel.ch/"],
];
for (const [n, u] of cands) {
  try {
    const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(10000) });
    const h = await r.text();
    const ld = (h.match(/"@type"\s*:\s*"(Event|[A-Za-z]*Event)"/g) || []).length;
    const ical = [...new Set(h.match(/href="[^"]*(ical|\.ics|webcal)[^"]*"/gi) || [])].slice(0, 3);
    const t = txt(h);
    const hits = t.filter(s => /(\b\d{1,2}\.\s?\d{1,2}\.(\d{2,4})?|\b(Sa|So|Mo|Di|Mi|Do|Fr)[a-z]*,?\s+\d{1,2}\.|\d{1,2}:\d{2}|September|Oktober)/.test(s)).slice(0, 18);
    console.log(`\n##### ${n} ${r.status} len=${h.length} ldEvents=${ld} ical=${ical.join(" ")}`);
    console.log(hits.map(s => "  " + s.slice(0, 140)).join("\n"));
  } catch (e) { console.log(`\n##### ${n} FEHLER ${e.message}`); }
}
