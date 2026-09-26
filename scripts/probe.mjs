/* Temporaer: Welche Basler Quellen sind sauber maschinenlesbar? */
const UA = { "user-agent": "Mozilla/5.0 (compatible; Fahrplan-Board/1.0)" };
const sites = {
  "agendabasel-kinder": "https://www.agendabasel.ch/db/veranstaltungen/?kategorie=kinder-familie",
  "agendabasel": "https://www.agendabasel.ch/",
  "mybasel-kinder": "https://www.mybasel.ch/veranstaltungen/kinder",
  "lolabrause-basel": "https://lolabrause.ch/veranstaltungen/?region=basel",
  "lolabrause": "https://lolabrause.ch/",
  "stskb": "https://stskb.ch/kleinbasel/quartierflohmaerkte",
  "quartierflohmi": "https://www.quartierflohmibasel.ch/de/",
  "fleafind": "https://www.fleafind.ch/de/schweiz/basel",
  "flohmarkttermine": "https://flohmarkttermine.ch/",
  "vorstadttheater": "https://www.vorstadttheater.ch/",
  "marionetten": "https://www.bmtheater.ch/",
  "jungestheater": "https://www.jungestheaterbasel.ch/",
  "haebse": "https://www.haebse-theater.ch/",
  "kultkino": "https://www.kultkino.ch/",
  "stadtkino": "https://www.stadtkinobasel.ch/",
  "hek": "https://hek.ch/programm/",
  "vitra": "https://www.design-museum.de/de/veranstaltungen.html",
  "tinguely": "https://www.tinguely.ch/de/programm.html",
  "kunstmuseum": "https://kunstmuseumbasel.ch/de/programm",
  "robi": "https://www.robi-spiel-aktionen.ch/",
  "pronatura": "https://www.pronatura-bs.ch/de/veranstaltungen",
  "kaserne": "https://www.kaserne-basel.ch/de/programm",
  "ggg": "https://www.stadtbibliothekbasel.ch/de/veranstaltungen.html",
  "kinderuni": "https://kinder-uni.unibas.ch/",
  "hinto": "https://hinto.ch/",
  "kinderkalender": "https://kinderkalender-basel.ch/",
  "zirkus": "https://www.circus-basilisk.ch/",
  "muks": "https://muks.ch/",
};
const probeUrl = async (u) => { try { const r = await fetch(u, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(12000) }); return { s: r.status, ct: r.headers.get("content-type") || "", t: await r.text() }; } catch (e) { return { s: "ERR " + e.message.slice(0, 40), ct: "", t: "" }; } };
for (const [n, u] of Object.entries(sites)) {
  const r = await probeUrl(u);
  const t = r.t;
  const ldEv = (t.match(/\\?"@type\\?"\s*:\s*\\?"[A-Za-z]*Event\\?"/g) || []).length;
  const ical = [...new Set(t.match(/(href|src)="[^"]*(\?ical=|\.ics|webcal:)[^"]*"/gi) || [])].slice(0, 2);
  const rss = [...new Set(t.match(/type="application\/(rss|atom)\+xml"[^>]*href="[^"]+"|href="[^"]+"[^>]*type="application\/(rss|atom)\+xml"/gi) || [])].slice(0, 2);
  const wp = /wp-content|wp-json/.test(t), tribe = /tribe-events|the-events-calendar/i.test(t);
  const next = /__NEXT_DATA__|self\.__next_f/.test(t), nuxt = /__NUXT__|nuxt/i.test(t);
  const api = [...new Set(t.match(/["'](\/api\/[a-z0-9\/_-]{3,60}|https?:\/\/[a-z0-9.-]+\/api\/[a-z0-9\/_-]{3,60})["']/gi) || [])].slice(0, 3);
  const dates = (t.replace(/<[^>]+>/g, " ").match(/\b(\d{1,2}\.\s?\d{1,2}\.(20)?26|\d{1,2}\.\s(Sept|Okt|Nov)[a-z]*)/g) || []).length;
  console.log(`${n.padEnd(20)} ${String(r.s).padEnd(4)} len=${String(t.length).padEnd(7)} ldEvent=${ldEv} dates=${dates} wp=${wp} tribe=${tribe} next=${next} nuxt=${nuxt} ical=${ical.join(" ")} rss=${rss.join(" ")} api=${api.join(" ")}`);
  // WordPress Events Calendar: iCal direkt testen
  if (wp || tribe) {
    const base = new URL(u).origin;
    for (const p of ["/events/?ical=1", "/veranstaltungen/?ical=1", "/wp-json/tribe/events/v1/events?per_page=3"]) {
      const x = await probeUrl(base + p);
      const vev = (x.t.match(/BEGIN:VEVENT/g) || []).length;
      const js = /tribe/.test(p) && /"events"/.test(x.t);
      if (vev || js) console.log(`   -> ${p} ${x.s} vevent=${vev} json=${js}`);
    }
  }
}
