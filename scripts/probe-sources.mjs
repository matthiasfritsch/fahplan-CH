/* Einmaliger Test: Was liefern die Eventquellen? Laeuft in GitHub
   Actions (freies Internet). Gibt nur Struktur und Stichproben aus,
   keine Schluessel. */
const UA = { "user-agent": "Mozilla/5.0 (Fahrplan-Board probe)" };
const urls = [
  ["schule-ical", "https://www.steinerschule-basel.ch/events/?ical=1"],
  ["schule-rest", "https://www.steinerschule-basel.ch/wp-json/tribe/events/v1/events?per_page=5"],
  ["schule-html", "https://www.steinerschule-basel.ch/events/"],
  ["stsbw-ical", "https://stsbw.ch/events/?ical=1"],
  ["fleafind-we", "https://www.fleafind.ch/de/schweiz/basel/dieses-wochenende"],
  ["fleafind-basel", "https://www.fleafind.ch/de/schweiz/basel"],
  ["quartierflohmi", "https://www.quartierflohmibasel.ch/"],
  ["ggg-5-11", "https://www.stadtbibliothekbasel.ch/de/kinderveranstaltungen-511-jahre-_content---1--1133.html"],
  ["kinderkalender", "https://kinderkalender-basel.ch/"],
  ["eventfrog-rubrics-nokey", "https://api.eventfrog.net/api/v1/rubrics.json"],
  ["robots-fleafind", "https://www.fleafind.ch/robots.txt"],
  ["robots-ggg", "https://www.stadtbibliothekbasel.ch/robots.txt"],
];
for (const [name, url] of urls) {
  try {
    const r = await fetch(url, { headers: UA, redirect: "follow" });
    const t = await r.text();
    const ct = r.headers.get("content-type");
    const ld = (t.match(/application\/ld\+json/g) || []).length;
    const ev = (t.match(/BEGIN:VEVENT/g) || []).length;
    console.log(`\n##### ${name} ${r.status} ${ct} len=${t.length} jsonld=${ld} vevent=${ev}`);
    if (ev) {
      const blocks = t.split("BEGIN:VEVENT").slice(1, 6).map(b => b.split("\n").filter(l => /^(DTSTART|SUMMARY|LOCATION|CATEGORIES)/.test(l)).join(" | "));
      console.log(blocks.join("\n"));
    } else if (/json/.test(ct || "")) {
      console.log(t.slice(0, 1500));
    } else if (name.startsWith("robots")) {
      console.log(t.slice(0, 800));
    } else {
      const txt = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, "\n").replace(/&nbsp;/g, " ").split("\n").map(s => s.trim()).filter(Boolean);
      const hits = txt.filter(s => /(\d{1,2}\.\s?\d{1,2}\.|Sept|Okt|2026|\d{1,2}:\d{2})/.test(s)).slice(0, 40);
      console.log(hits.join("\n"));
      const ldm = t.match(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/);
      if (ldm) console.log("JSONLD:", ldm[1].slice(0, 800));
      const icals = [...new Set((t.match(/href="[^"]*(ical|\.ics|webcal)[^"]*"/gi) || []))].slice(0, 5);
      if (icals.length) console.log("ICAL-LINKS:", icals.join(" "));
    }
  } catch (e) { console.log(`\n##### ${name} FEHLER ${e.message}`); }
}
