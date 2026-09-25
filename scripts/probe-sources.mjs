/* Einmaliger Test (Runde 5): echte Auswahl wie auf dem Board,
   mit den Live-Quellen ohne Schluessel (Schule, Basel-West). */
import { liveEvents } from "../lib/sources.mjs";
import { selectEvents, zurichNow } from "../lib/content.mjs";
const now = zurichNow();
const { events, report } = await liveEvents([], { today: now.date });
console.log("REPORT", JSON.stringify(report));
console.log("ALLE (naechste 14 Tage):");
for (const e of events.filter(e => e.date <= "2026-10-09").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)))
  console.log(" ", e.date, e.time, "|", e.title, "|", e.place, e.school ? "[SCHULE]" : "", e.category ? "[FLOH]" : "");
for (const d of ["2026-09-25", "2026-09-26", "2026-10-01"]) {
  console.log(`\nBOARD ${d} 08:00:`);
  for (const day of selectEvents(events, d, "08:00", undefined, [{ from: "2026-09-26", to: "2026-10-11" }]))
    console.log(" ", day.label, day.dateText, "->", day.list.map(e => `${e.time} ${e.title}${e.school ? " [SCHULE]" : ""}${e.category ? " [FLOH]" : ""}`).join(" | "));
}
