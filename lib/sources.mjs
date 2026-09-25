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
   Alle Quellen zusammen. Jede Quelle einzeln abgesichert, damit
   ein Ausfall die anderen nicht mitreisst. Doppelte Eintraege
   (gleiches Datum, gleicher Titel) werden zusammengelegt.
   ============================================================ */
export const SOURCES = [
  ["schule", () => schoolEvents()],
  ["stsbw", () => stsbwEvents()],
];

export async function liveEvents(extra = []) {
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
