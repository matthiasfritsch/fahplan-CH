/* ============================================================
   EVENTQUELLEN
   Holt Events direkt aus strukturierten Quellen, auf Vercel mit
   freiem Internet. Jede Quelle liefert Eintraege im Format von
   data/events.json:
     { date, time, title, place, city?, travel?, school?, category? }
   Faellt eine Quelle aus, liefert sie einfach nichts. Das Board
   zeichnet trotzdem.
   ============================================================ */

const UA = { "user-agent": "Mozilla/5.0 (Fahrplan-Board; Familienkalender)" };

// Eine Stunde zwischenspeichern: aktuell genug, und die Quellen
// werden hoechstens 24x am Tag gefragt, nicht bei jedem Refresh.
const CACHE = { next: { revalidate: 3600 } };

async function fetchText(url, headers = {}) {
  const res = await fetch(url, {
    headers: { ...UA, ...headers },
    signal: AbortSignal.timeout(6000),
    ...CACHE,
  });
  if (!res.ok) throw new Error(url + " -> HTTP " + res.status);
  return res.text();
}

// --- Datum/Zeit in Schweizer Ortszeit -------------------------
function zurichParts(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

// Kurze Titel fuers Board: Zeichenlimit aus lib/content.mjs
function short(s, n) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}

/* ============================================================
   iCal (RFC 5545), gerade genug fuer WordPress "The Events
   Calendar": DTSTART mit TZID, als Datum oder in UTC.
   ============================================================ */
export function parseIcal(text) {
  // Zeilenfortsetzungen (Zeile beginnt mit Leerzeichen) aufloesen
  const lines = String(text).replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const out = [];
  let cur = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") { if (cur) out.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const head = line.slice(0, i), value = line.slice(i + 1);
    const [name, ...params] = head.split(";");
    const unesc = (v) => v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1");
    if (name === "DTSTART") {
      const allDay = params.includes("VALUE=DATE") || /^\d{8}$/.test(value);
      const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(value);
      if (!m) continue;
      if (allDay) {
        cur.date = `${m[1]}-${m[2]}-${m[3]}`; cur.time = ""; cur.allDay = true;
      } else if (value.endsWith("Z")) {
        const z = zurichParts(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])));
        cur.date = z.date; cur.time = z.time;
      } else {
        // TZID=Europe/Zurich oder Europe/Berlin: gleiche Ortszeit
        cur.date = `${m[1]}-${m[2]}-${m[3]}`; cur.time = `${m[4]}:${m[5]}`;
      }
    } else if (name === "SUMMARY") cur.summary = unesc(value);
    else if (name === "LOCATION") cur.location = unesc(value);
    else if (name === "CATEGORIES") cur.categories = unesc(value);
    else if (name === "URL") cur.url = value;
  }
  return out;
}

/* ============================================================
   Quelle 1: Rudolf Steiner Schule Basel (Yunas Schule)
   Oeffentliche Termine ja, interne Anlaesse und Infoabende fuer
   neue Eltern nein.
   ============================================================ */
const SCHOOL_ICAL = "https://www.steinerschule-basel.ch/events/?ical=1";
const SCHOOL_SKIP = /infoabend|generalversammlung|ferien|elternabend|konferenz|sammeltag|büro|anmeldung|offenen tür|kindergarten|matur|schulverein/i;

export async function schoolEvents() {
  const items = parseIcal(await fetchText(SCHOOL_ICAL));
  return items
    .filter(e => e.date && e.time && e.summary && !SCHOOL_SKIP.test(e.summary))
    .map(e => ({
      date: e.date, time: e.time,
      title: short(e.summary, 40),
      place: "Steinerschule",
      school: true,
      source: "steinerschule-basel.ch",
    }));
}

/* ============================================================
   Quelle 2: Stadtteilsekretariat Basel-West
   Der Kalender hat Maerkte, Feste und Quartieranlaesse. Wir
   nehmen Flohmaerkte und klar familientaugliche Anlaesse.
   ============================================================ */
const STSBW_ICAL = "https://stsbw.ch/events/?ical=1";
const FAMILY_WORDS = /kinder|familie|spiel|fest|zirkus|theater|basteln|robi|werkstatt/i;
const FLEA_WORDS = /floh|brocante|tr(ö|oe)del|börse/i;

function placeFrom(location) {
  // "Vogesenplatz, Vogesenplatz, Basel, 4056" -> "Vogesenplatz"
  return short(String(location || "").split(",")[0], 30);
}

export async function stsbwEvents() {
  const items = parseIcal(await fetchText(STSBW_ICAL));
  return items
    .filter(e => e.date && e.time && e.summary)
    .filter(e => FLEA_WORDS.test(e.summary) || FAMILY_WORDS.test(e.summary))
    .map(e => ({
      date: e.date, time: e.time,
      title: short(e.summary, 40),
      place: placeFrom(e.location),
      ...(FLEA_WORDS.test(e.summary) ? { category: "flohmarkt" } : {}),
      source: "stsbw.ch",
    }));
}

/* ============================================================
   Quelle 3: myBasel, Rubrik Kinder (Basel Tourismus)
   Die Seite ist serverseitig gerendert. Jeder Eintrag steht als
   Folge: Kategorie, Titel, "Ort, Gemeinde", "TT.MM.JJJJ, HH:MM".
   Bezahlte Eintraege tragen davor "EMPFEHLUNG" und fliegen raus.
   ============================================================ */
const MYBASEL_KIDS = "https://www.mybasel.ch/veranstaltungen/kinder";
const NEAR_TOWNS = /^(basel|riehen|bettingen|binningen|bottmingen|allschwil|m\u00fcnchenstein|muttenz|birsfelden|reinach|arlesheim|oberwil|dornach)$/i;

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "\u00ab", raquo: "\u00bb",
  ndash: "\u2013", mdash: "\u2014", auml: "\u00e4", ouml: "\u00f6", uuml: "\u00fc", Auml: "\u00c4",
  Ouml: "\u00d6", Uuml: "\u00dc", szlig: "\u00df", eacute: "\u00e9", egrave: "\u00e8", agrave: "\u00e0",
  ccedil: "\u00e7", ecirc: "\u00ea", rsquo: "\u2019", lsquo: "\u2018", hellip: "\u2026" };
function decode(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n] ?? m);
}

/* Lange Titel lesbar kuerzen: Klammern weg, bei "A: B: C" den Kern
   (vor einem Gedankenstrich) mit dem letzten Teil verbinden.
   "Teddy – von Legende bis Lifestyle: Bastel-Werkstatt"
     -> "Teddy: Bastel-Werkstatt" */
export function tidyTitle(t, max = 34) {
  let s = String(t).replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (s.length <= max || !s.includes(":")) return s;
  const parts = s.split(/:\s*/).filter(Boolean);
  const head = parts[0].split(/\s[\u2013\u2014-]\s/)[0].trim();
  const last = parts[parts.length - 1];
  const combo = head + ": " + last;
  return combo.length <= 40 ? combo : last;
}

export function parseMyBasel(html) {
  const lines = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, "\n").split("\n").map(x => decode(x).replace(/\s+/g, " ").trim()).filter(Boolean);
  const out = [];
  for (let i = 3; i < lines.length; i++) {
    const m = /^(\d{2})\.(\d{2})\.(\d{4}),\s*(\d{2}:\d{2})/.exec(lines[i]);
    if (!m) continue;
    const where = lines[i - 1], title = lines[i - 2], category = lines[i - 3];
    if (/^EMPFEHLUNG$/i.test(lines[i - 4] || "") || /^EMPFEHLUNG$/i.test(category)) continue;
    const [placeName, town] = where.split(/,\s*(?=[^,]+$)/);
    const away = town && !NEAR_TOWNS.test(town.trim());
    out.push({
      date: `${m[3]}-${m[2]}-${m[1]}`, time: m[4],
      title: short(tidyTitle(title), 40),
      place: short(String(placeName || where).replace(/\s*\([^)]*\)/g, ""), 30),
      ...(away ? { city: short(town.trim(), 14) } : {}),
      ...(/floh|brocante|tr(\u00f6|oe)del/i.test(title) ? { category: "flohmarkt" } : {}),
      tag: category,
      source: "mybasel",
    });
  }
  return out;
}

export async function mybaselEvents() {
  return parseMyBasel(await fetchText(MYBASEL_KIDS));
}

/* ============================================================
   Quelle 4: Eventfrog Public API (Kinder & Familie)
   Doku: https://docs.api.eventfrog.net/ (Public API V1)
   Der Key kommt aus der Umgebungsvariable EVENTFROG_API_KEY und
   geht als Bearer-Header mit, nie in eine URL oder ein Log.
   ============================================================ */
const EF = "https://api.eventfrog.net/public/v1";
const HOME = { lat: 47.5205, lng: 7.5720 };   // Bottmingen
const RADIUS_KM = 30;
const NEAR_KM = 9;                             // darunter gilt es als "Basel"

async function efGet(path, params, key, revalidate = 3600) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    for (const x of [].concat(v)) if (x !== undefined && x !== null && x !== "") q.append(k, String(x));
  }
  const res = await fetch(`${EF}${path}?${q}`, {
    headers: { ...UA, authorization: "Bearer " + key, accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate },
  });
  if (!res.ok) throw new Error("Eventfrog " + path + " -> HTTP " + res.status);
  return res.json();
}

const de = (o) => (o && typeof o === "object") ? (o.de || o.en || Object.values(o)[0] || "") : String(o || "");

function km(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const ddmmyyyy = (iso) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };
const addDaysIso = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Was fuer eine 10-Jaehrige spannend klingt, rutscht nach vorne
const GOOD = /workshop|zirkus|theater|zoo|zolli|museum|werk|bastel|forsch|experiment|kino|film|konzert|tanz|klettern|spiel|abenteuer|natur|tiere|roboter|lego|zaubern|magie/i;
const TODDLER = /baby|krabbel|kleinkind|0-3|1-4|2-5|ab 2 |ab 3 |vorschul|kita/i;

export async function eventfrogEvents(key, today) {
  if (!key) return [];
  // Rubriken einmal am Tag holen, "Kinder" und "Familie" samt Unterrubriken
  const rub = await efGet("/rubrics", {}, key, 86400);
  const rubrics = rub.rubrics || [];
  const top = rubrics.filter(r => /kinder|famil/i.test(de(r.title))).map(r => r.id);
  const ids = [...new Set([...top, ...rubrics.filter(r => top.includes(r.parentId)).map(r => r.id)])];
  if (!ids.length) throw new Error("Eventfrog: keine Rubrik Kinder/Familie gefunden");

  const data = await efGet("/events", {
    lat: HOME.lat, lng: HOME.lng, r: RADIUS_KM,
    from: ddmmyyyy(today), to: ddmmyyyy(addDaysIso(today, 10)),
    rubId: ids, perPage: 150, country: "ALL",
  }, key);
  const events = (data.events || []).filter(e => !e.cancelled && e.visible !== false && e.published !== false);

  // Orte nachladen (Name, Stadt, Koordinaten)
  const locIds = [...new Set(events.flatMap(e => e.locationIds || []))];
  const locs = new Map();
  for (let i = 0; i < locIds.length; i += 50) {
    const l = await efGet("/locations", { id: locIds.slice(i, i + 50), perPage: 50 }, key, 86400);
    for (const x of l.locations || []) locs.set(x.id, x);
  }

  return events.map(e => {
    const when = zurichParts(new Date(e.begin));
    const loc = locs.get((e.locationIds || [])[0]) || {};
    const dist = (loc.lat && loc.lng) ? km(HOME, loc) : 0;
    const title = de(e.title);
    const place = de(e.locationAlias) || de(loc.title);
    const away = dist > NEAR_KM && loc.city;
    return {
      date: when.date, time: when.time,
      title: short(title, 40),
      place: short(place, 30),
      ...(away ? { city: short(loc.city, 14), travel: Math.round(dist) + " km" } : {}),
      // Feinsortierung innerhalb "normaler" Events: spannend vor
      // Kleinkind, nah vor fern
      score: (GOOD.test(title) ? 0.3 : 0) - (TODDLER.test(title) ? 0.5 : 0) - dist / 200,
      source: "eventfrog",
    };
  }).filter(e => e.date >= today);
}

/* ============================================================
   Alle Quellen zusammen. Jede Quelle einzeln abgesichert, damit
   ein Ausfall die anderen nicht mitreisst. Doppelte Eintraege
   (gleiches Datum, gleicher Titel) werden zusammengelegt.
   ============================================================ */
export async function liveEvents(extra = [], { eventfrogKey, today } = {}) {
  const SOURCES = [
    ["schule", () => schoolEvents()],
    ["stsbw", () => stsbwEvents()],
    ["mybasel", () => mybaselEvents()],
    ["eventfrog", () => eventfrogKey ? eventfrogEvents(eventfrogKey, today)
                                     : Promise.reject(new Error("kein EVENTFROG_API_KEY in der Umgebung"))],
  ];
  const settled = await Promise.allSettled(SOURCES.map(([, fn]) => fn()));
  const report = {};
  const all = [...extra];
  settled.forEach((r, i) => {
    const name = SOURCES[i][0];
    if (r.status === "fulfilled") { report[name] = r.value.length; all.push(...r.value); }
    else report[name] = "Fehler: " + String(r.reason && r.reason.message || r.reason).slice(0, 120);
  });
  const seen = new Set();
  const events = all.filter(e => {
    const k = e.date + "|" + String(e.title).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { events, report };
}
