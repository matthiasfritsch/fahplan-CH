/* Temporaer: echte Auswahl mit allen Quellen (ohne Eventfrog-Key). */
import { liveEvents } from "../lib/sources.mjs";
import { selectEvents } from "../lib/content.mjs";
const r = await fetch("https://www.mybasel.ch/robots.txt"); console.log("ROBOTS mybasel", r.status, (await r.text()).slice(0, 400));
const { events, report } = await liveEvents([], { today: "2026-09-26" });
console.log("REPORT", JSON.stringify(report));
for (const e of events.filter(e => e.source === "mybasel")) console.log(" MB", e.date, e.time, "|", e.title, "|", e.place, "|", e.city || "", "|", e.tag);
const H = [{ from: "2026-09-26", to: "2026-10-11" }];
for (const d of ["2026-09-26", "2026-09-28", "2026-10-01"]) {
  console.log(`\nBOARD ${d} 08:00`);
  for (const day of selectEvents(events, d, "08:00", undefined, H))
    console.log(" ", day.label, day.dateText, "->", day.list.map(e => `${e.time} ${e.title}${e.city ? " [" + e.city + "]" : ""}${e.school ? " [SCHULE]" : ""}${e.category ? " [FLOH]" : ""}`).join(" | "));
}
