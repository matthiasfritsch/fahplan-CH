/* ============================================================
   INHALTE FUER DIE LINKE SEITE
   Wort des Tages und die Event-Auswahl.
   Alles hier ist reine Logik ohne Netz und ohne Rendern, damit
   es sich mit `npm run check` pruefen laesst.
   ============================================================ */

// Zeichenlimits. Das Layout ist darauf ausgelegt, das
// Pruefskript (scripts/check-data.mjs) haelt sie beim Bauen ein.
export const LIMITS = {
  word: 20,        // de, en, fr
  hint: 14,        // Wortart, Aussprache, Genus
  example: 40,     // Beispielsatz
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

// --- Wort des Tages -------------------------------------------
// Feste Rotation nach Datum: jeder Aufruf am selben Tag zeigt
// dasselbe, und die Liste laeuft ohne Wiederholung durch.
export function pickWord(words, iso) {
  return words[dayNumber(iso) % words.length];
}

// --- Events ---------------------------------------------------
const WD_LONG  = ["SONNTAG", "MONTAG", "DIENSTAG", "MITTWOCH",
                  "DONNERSTAG", "FREITAG", "SAMSTAG"];
const WD_SHORT = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];

// Platzbudget in Pixeln, passend zu Board.jsx:
// 480 - Kopf 40 - Wortband 88 - Innenabstand 6
export const EVENT_BUDGET = 346;
export const DAY_HEAD_H = 30;
export const EVENT_H = 30;

/* Flohmarkt als eigene Kategorie: "category": "flohmarkt" in der
   Liste, oder am Titel erkannt (Flohmi, Flohmarkt, Brocante, Troedel). */
export function isFleaMarket(e) {
  return e.category === "flohmarkt" ||
    /floh|brocante|troedel|tr\u00f6del/i.test(e.title || "");
}

/* Prioritaet: Termine von Yunas Schule vor Flohmaerkten vor dem
   Rest. "prio": true hebt ein beliebiges Event auf Flohmarkt-Stufe. */
export function weight(e) {
  if (e.school) return 3;
  if (e.prio || isFleaMarket(e)) return 2;
  return 1 + Math.max(-0.9, Math.min(0.9, e.score || 0));
}

function startMinutes(time) {
  const m = /^(\d{2}):(\d{2})$/.exec(time || "");
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

/* Vorrang: Yunas Schule, dann Flohmaerkte ("prio": true zaehlt
   wie ein Flohmarkt). */
export const isPriority = (e) => !!(e.school || e.prio || isFleaMarket(e));
const prioRank = (e) => e.school ? 0 : 1;

/* Waehlt aus, was auf die Tafel kommt.
   - Zeitraum: heute bis Sonntag. Am Sonntag nur heute, aber
     wenn das zu duenn ist, kommt die naechste Woche dazu.
   - Schultermine und Flohmaerkte der naechsten zwei Wochen kommen
     auch dann aufs Board, wenn sie nach Sonntag liegen.
   - Heute Vergangenes faellt weg (eine Stunde Kulanz).
   - Pro Tag stehen Schule und Flohmarkt immer oben, danach der
     Rest nach Uhrzeit. Fuer den Rest gilt: unter der Woche ein
     Platz pro Tag (heute zwei), am Wochenende und in den Ferien
     fuenf, abzueglich der Vorrang-Termine.
   - Passt es nicht, fliegt in dieser Reihenfolge raus: normale
     Werktags-Events, normale Wochenend-Events bis auf zwei pro Tag,
     Vorrang-Termine nach Sonntag, weitere normale Events, zuletzt
     Vorrang-Termine von hinten. */
export function selectEvents(events, today, nowTime, budget = EVENT_BUDGET, holidays = []) {
  // Schulferien zaehlen wie Wochenende: mehr Platz pro Tag
  const isHoliday = (iso) => (holidays || []).some(h => h && iso >= h.from && iso <= h.to);
  const wd = weekday(today);
  const toSunday = wd === 0 ? 0 : 7 - wd;
  let end = addDays(today, toSunday);
  const farEnd = addDays(today, 13);
  const nowMin = startMinutes(nowTime) ?? 0;

  const valid = (events || []).filter(e =>
    e && DATE_RE.test(e.date) && e.date >= today && e.title);

  const inRange = (last) => valid.filter(e => e.date <= last);
  if (inRange(end).length < 3) end = addDays(end, 7);

  const byDay = new Map();
  for (const e of valid) {
    if (e.date > farEnd) continue;
    // Nach Sonntag nur noch Schule und Flohmarkt
    if (e.date > end && !isPriority(e)) continue;
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
  // Anzeige: Vorrang oben (Schule vor Flohmarkt), sonst nach Zeit
  const showOrder = (a, b) =>
    (isPriority(b) - isPriority(a)) ||
    (isPriority(a) && isPriority(b) ? prioRank(a) - prioRank(b) : 0) ||
    sortKey(a) - sortKey(b);

  let days = [...byDay.keys()].sort().map(date => {
    const w = weekday(date);
    const weekend = w === 0 || w === 6 || isHoliday(date);
    const far = date > end;
    const all = byDay.get(date);
    const prio = all.filter(isPriority).sort(showOrder).slice(0, 3);
    const cap = far ? 0 : weekend ? 5 : date === today ? 2 : 1;
    const rest = all.filter(e => !isPriority(e))
      .sort((a, b) => weight(b) - weight(a) || sortKey(a) - sortKey(b))
      .slice(0, Math.max(0, cap - prio.length));
    return { date, weekend, far, list: [...prio, ...rest].sort(showOrder) };
  }).filter(d => d.list.length);

  const height = () => days.reduce((h, d) => h + DAY_HEAD_H + d.list.length * EVENT_H, 0);
  const dropFrom = (day, e) => {
    day.list = day.list.filter(x => x !== e);
    days = days.filter(d => d.list.length);
  };
  const lowest = (list) => [...list].sort((a, b) => weight(a) - weight(b) || sortKey(b) - sortKey(a))[0];

  while (height() > budget && days.length) {
    // 1. normale Events unter der Woche, von hinten
    const wk = days.filter(d => !d.weekend && !d.far && d.date !== today && d.list.some(e => !isPriority(e)));
    if (wk.length) { const d = wk[wk.length - 1]; dropFrom(d, lowest(d.list.filter(e => !isPriority(e)))); continue; }
    // 2. Wochenende auf zwei normale Events pro Tag kuerzen, damit
    //    Schule und Flohmarkt der Folgewoche noch Platz haben
    const rich = days.filter(d => d.list.filter(e => !isPriority(e)).length > 2)
      .sort((a, b) => b.list.length - a.list.length);
    if (rich.length && days.some(d => d.far)) { const d = rich[0]; dropFrom(d, lowest(d.list.filter(e => !isPriority(e)))); continue; }
    // 3. Vorrang-Termine nach Sonntag, der spaeteste Tag zuerst
    const far = days.filter(d => d.far);
    if (far.length) { days = days.filter(d => d !== far[far.length - 1]); continue; }
    // 4. normale Events am vollsten Tag
    const withRest = days.filter(d => d.list.some(e => !isPriority(e)))
      .sort((a, b) => b.list.length - a.list.length);
    if (withRest.length) { const d = withRest[0]; dropFrom(d, lowest(d.list.filter(e => !isPriority(e)))); continue; }
    // 5. zuletzt Vorrang-Termine, vom letzten Tag
    const last = days[days.length - 1];
    dropFrom(last, last.list[last.list.length - 1]);
  }

  const tomorrow = addDays(today, 1);
  return days.map(d => {
    const w = weekday(d.date);
    const [, mm, dd] = d.date.split("-");
    return {
      date: d.date,
      label: d.date === today ? "HEUTE" : d.date === tomorrow ? "MORGEN" : WD_LONG[w],
      dateText: `${WD_SHORT[w]} ${parseInt(dd, 10)}.${parseInt(mm, 10)}.`,
      list: d.list,
    };
  });
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
