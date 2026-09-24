/* ============================================================
   INHALTE FUER DIE LINKE SEITE
   Wort des Tages, 10-Minuten-Znacht und die Event-Auswahl.
   Alles hier ist reine Logik ohne Netz und ohne Rendern, damit
   es sich mit `npm run check` pruefen laesst.
   ============================================================ */

// Zeichenlimits. Das Layout ist darauf ausgelegt, das
// Pruefskript (scripts/check-data.mjs) haelt sie beim Bauen ein.
export const LIMITS = {
  word: 20,        // de, en, fr
  hint: 14,        // Wortart, Aussprache, Genus
  example: 40,     // Beispielsatz
  dish: 30,        // Name des Gerichts, max. zwei Zeilen
  eventTitle: 40,
  eventPlace: 30,
  eventCity: 14,   // Badge-Text, z.B. LUZERN
};

// Eventzeit: "10:00" oder "ab 10"
export const TIME_RE = /^(\d{2}:\d{2}|ab \d{1,2})$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// --- Datum in Schweizer Ortszeit ------------------------------
export function zurichNow(ms = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

// Tage seit 1970, fuer die Rotation. Mittag statt Mitternacht,
// damit keine Zeitzone je ein Datum auf den Vortag schiebt.
export function dayNumber(iso) {
  return Math.floor(Date.parse(iso + "T12:00:00Z") / 86400000);
}

export function weekday(iso) {
  return new Date(iso + "T12:00:00Z").getUTCDay(); // 0 = Sonntag
}

export function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// --- Wort und Znacht ------------------------------------------
// Feste Rotation nach Datum: jeder Aufruf am selben Tag zeigt
// dasselbe, und die Liste laeuft ohne Wiederholung durch.
export function pickWord(words, iso) {
  return words[dayNumber(iso) % words.length];
}

// Versetzt um 7, damit Wort und Gericht nicht im Gleichschritt
// laufen, falls die Listen einmal gleich lang sind.
export function pickDinner(dinners, iso) {
  return dinners[(dayNumber(iso) + 7) % dinners.length];
}

// --- Events ---------------------------------------------------
const WD_LONG  = ["SONNTAG", "MONTAG", "DIENSTAG", "MITTWOCH",
                  "DONNERSTAG", "FREITAG", "SAMSTAG"];
const WD_SHORT = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];

// Platzbudget in Pixeln, passend zu Board.jsx:
// 480 - Kopf 44 - Wort/Znacht 152 - Linie 2 - Innenabstand 2
export const EVENT_BUDGET = 280;
export const DAY_HEAD_H = 30;
export const EVENT_H = 32;

function startMinutes(time) {
  const m = /^(\d{2}):(\d{2})$/.exec(time || "");
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

/* Waehlt aus, was auf die Tafel kommt.
   - Zeitraum: heute bis Sonntag. Am Sonntag nur heute, aber
     wenn das zu duenn ist, kommt die naechste Woche dazu.
   - Heute Vergangenes faellt weg (eine Stunde Kulanz).
   - Unter der Woche hoechstens ein Event pro Tag, heute zwei.
     Das Wochenende bekommt den Rest.
   - Passt es nicht, fliegen zuerst Werktage raus (von hinten),
     dann wird der vollste Wochenendtag gekuerzt. */
export function selectEvents(events, today, nowTime, budget = EVENT_BUDGET, holidays = []) {
  // Schulferien zaehlen wie Wochenende: mehr Platz pro Tag
  const isHoliday = (iso) => (holidays || []).some(h => h && iso >= h.from && iso <= h.to);
  const wd = weekday(today);
  const toSunday = wd === 0 ? 0 : 7 - wd;
  let end = addDays(today, toSunday);
  const nowMin = startMinutes(nowTime) ?? 0;

  const valid = (events || []).filter(e =>
    e && DATE_RE.test(e.date) && e.date >= today && e.title);

  const inRange = (last) => valid.filter(e => e.date <= last);
  if (inRange(end).length < 3) end = addDays(end, 7);

  const byDay = new Map();
  for (const e of inRange(end)) {
    if (e.date === today) {
      const s = startMinutes(e.time);
      if (s !== null && s + 60 < nowMin) continue;
    }
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date).push(e);
  }

  const sortKey = (e) => {
    const m = /(\d{1,2})(?::(\d{2}))?/.exec(e.time || "");
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2] || "0", 10) : 9999;
  };

  let days = [...byDay.keys()].sort().map(date => {
    const w = weekday(date);
    const weekend = w === 0 || w === 6 || isHoliday(date);
    const cap = weekend ? 5 : date === today ? 2 : 1;
    const list = byDay.get(date).sort((a, b) => sortKey(a) - sortKey(b)).slice(0, cap);
    return { date, weekend, list };
  });

  const height = () => days.reduce((h, d) => h + DAY_HEAD_H + d.list.length * EVENT_H, 0);

  while (height() > budget && days.length) {
    const wk = days.filter(d => !d.weekend && d.date !== today);
    if (wk.length) {
      const drop = wk[wk.length - 1];
      days = days.filter(d => d !== drop);
      continue;
    }
    const fullest = [...days].sort((a, b) => b.list.length - a.list.length)[0];
    if (fullest.list.length > 1) fullest.list.pop();
    else days.pop();
  }

  const tomorrow = addDays(today, 1);
  return days.map(d => {
    const w = weekday(d.date);
    const [, mm, dd] = d.date.split("-");
    return {
      label: d.date === today ? "HEUTE" : d.date === tomorrow ? "MORGEN" : WD_LONG[w],
      dateText: `${WD_SHORT[w]} ${parseInt(dd, 10)}.${parseInt(mm, 10)}.`,
      list: d.list,
    };
  });
}

// Events gelten als veraltet, wenn die Routine laenger als
// 8 Tage nichts geschrieben hat. Dann springt der Scraper ein.
export function isStale(updated, today) {
  if (!updated || !DATE_RE.test(updated)) return true;
  return dayNumber(today) - dayNumber(updated) > 8;
}

/* ============================================================
   Backup-Scraper: liest schema.org-Events (JSON-LD) aus einer
   Eventseite. Die meisten Kalender liefern das fuer Google mit.
   Ohne Gewaehr: Seiten aendern sich, deshalb nur Rueckfall.
   ============================================================ */
export function parseJsonLdEvents(html) {
  const out = [];
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const stack = [data];
    while (stack.length) {
      const n = stack.pop();
      if (!n || typeof n !== "object") continue;
      if (Array.isArray(n)) { stack.push(...n); continue; }
      if (n["@graph"]) stack.push(n["@graph"]);
      if (n.itemListElement) stack.push(n.itemListElement);
      if (n.item) stack.push(n.item);
      const type = [].concat(n["@type"] || []).join(" ");
      if (/Event/.test(type) && n.name && n.startDate) {
        const sd = String(n.startDate);
        const loc = n.location || {};
        out.push({
          date: sd.slice(0, 10),
          time: /T\d{2}:\d{2}/.test(sd) ? sd.slice(11, 16) : "",
          title: String(n.name).trim(),
          place: String(loc.name || "").trim(),
          city: null,
        });
      }
    }
  }
  return out;
}
