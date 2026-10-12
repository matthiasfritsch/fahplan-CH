/* ============================================================
   EVENTS LADEN
   Gemeinsam fuer das Board (/api/board) und die Eventseite
   hinter dem QR-Code (/e). Beide sehen so dieselben Daten.
   ============================================================ */
import eventsFile from "../data/events.json";
import { parseJsonLdEvents, addDays, DATE_RE } from "./content.mjs";
import { liveEvents } from "./sources.mjs";
import { familyFilter } from "./curate.mjs";

export const holidays = eventsFile.holidays || [];
export const eventsUpdated = eventsFile.updated;

/* Live-Quellen (lib/sources.mjs) plus optionale Eintraege aus
   data/events.json. Liefert keine Quelle etwas, versucht der
   Scraper eine Eventseite (BOARD_EVENTS_FALLBACK_URL). */
export async function loadEvents(today, fallbackUrl = process.env.BOARD_EVENTS_FALLBACK_URL) {
  // Handgepflegte Eintraege gelten, solange sie nicht vorbei sind
  const manual = (eventsFile.events || []).filter(e => e.date >= today);
  // Key nur aus der Umgebung, nie aus der URL und nie in ein Log
  // In Vercel heisst die Variable "Events" (Name laesst sich dort
  // nicht aendern), EVENTFROG_API_KEY gilt weiterhin auch
  const eventfrogKey = process.env.EVENTFROG_API_KEY || process.env.Events;
  const live = await liveEvents(manual, { eventfrogKey, today });
  const { report, adults } = live;
  // Doppelte sind schon zusammengelegt (sources.mjs), hier fliegt
  // raus, was fuer Yuna nicht passt, und Dauerangebote
  const events = familyFilter(live.events);
  if (events.length) return { events, adults, source: "live", report };

  if (fallbackUrl) {
    try {
      const res = await fetch(fallbackUrl, {
        headers: { "user-agent": "Mozilla/5.0 (Fahrplan-Board)" },
        next: { revalidate: 86400 },
      });
      if (res.ok) {
        const found = parseJsonLdEvents(await res.text());
        if (found.length) return { events: found, adults, source: "scraper", report };
      }
    } catch { /* dann eben leer */ }
  }
  return { events: [], adults, source: "leer", report };
}

/* Was die Eventseite (/e) zeigt: heute plus 13 Tage. Das Board
   zaehlt pro Tag aus genau dieser Liste, damit "17 Events" im
   Tageskopf dieselbe Zahl ist wie auf der Seite hinter dem QR. */
export const PAGE_DAYS = 14;
export function pageEvents(events, today) {
  const until = addDays(today, PAGE_DAYS - 1);
  return (events || []).filter(e => e && e.title && DATE_RE.test(e.date || "") && e.date >= today && e.date <= until);
}
export function countByDay(events, today) {
  const n = {};
  for (const e of pageEvents(events, today)) n[e.date] = (n[e.date] || 0) + 1;
  return n;
}
