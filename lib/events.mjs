/* ============================================================
   EVENTS LADEN
   Gemeinsam fuer das Board (/api/board) und die Eventseite
   hinter dem QR-Code (/e). Beide sehen so dieselben Daten.
   ============================================================ */
import eventsFile from "../data/events.json";
import { parseJsonLdEvents } from "./content.mjs";
import { liveEvents } from "./sources.mjs";

export const holidays = eventsFile.holidays || [];
export const eventsUpdated = eventsFile.updated;

/* Live-Quellen (lib/sources.mjs) plus optionale Eintraege aus
   data/events.json. Liefert keine Quelle etwas, versucht der
   Scraper eine Eventseite (BOARD_EVENTS_FALLBACK_URL). */
export async function loadEvents(today, fallbackUrl = process.env.BOARD_EVENTS_FALLBACK_URL) {
  // Handgepflegte Eintraege gelten, solange sie nicht vorbei sind
  const manual = (eventsFile.events || []).filter(e => e.date >= today);
  // Key nur aus der Umgebung, nie aus der URL und nie in ein Log
  const { events, report } = await liveEvents(manual, { eventfrogKey: process.env.EVENTFROG_API_KEY, today });
  if (events.length) return { events, source: "live", report };

  if (fallbackUrl) {
    try {
      const res = await fetch(fallbackUrl, {
        headers: { "user-agent": "Mozilla/5.0 (Fahrplan-Board)" },
        next: { revalidate: 86400 },
      });
      if (res.ok) {
        const found = parseJsonLdEvents(await res.text());
        if (found.length) return { events: found, source: "scraper", report };
      }
    } catch { /* dann eben leer */ }
  }
  return { events: [], source: "leer", report };
}
