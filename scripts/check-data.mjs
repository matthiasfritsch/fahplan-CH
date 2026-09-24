/* Prueft die Datenlisten gegen die Zeichenlimits des Layouts.
   Laeuft automatisch vor jedem Build (prebuild). Ein Eintrag,
   der nicht passt, bricht den Build ab, statt auf dem Geraet
   abgeschnitten zu werden. */
import { readFileSync } from "node:fs";
import { LIMITS, TIME_RE, DATE_RE } from "../lib/content.mjs";

const load = (f) => JSON.parse(readFileSync(new URL("../data/" + f, import.meta.url), "utf8"));
const errors = [];
const len = (s) => [...String(s ?? "")].length;
const check = (where, field, value, max) => {
  if (!value) errors.push(`${where}: ${field} fehlt`);
  else if (len(value) > max) errors.push(`${where}: ${field} "${value}" hat ${len(value)} Zeichen, erlaubt ${max}`);
};

load("words.json").forEach((w, i) => {
  const at = `words[${i}] ${w.de}`;
  for (const k of ["de", "en", "fr"]) check(at, k, w[k], LIMITS.word);
  for (const k of ["deHint", "enSay", "frHint"]) check(at, k, w[k], LIMITS.hint);
  check(at, "example", w.example, LIMITS.example);
});

const ids = new Set();
load("dinners.json").forEach((d, i) => {
  const at = `dinners[${i}] ${d.id}`;
  check(at, "name", d.name, LIMITS.dish);
  if (!/^[a-z0-9-]+$/.test(d.id || "")) errors.push(`${at}: id nur a-z, 0-9, -`);
  if (ids.has(d.id)) errors.push(`${at}: id doppelt`);
  ids.add(d.id);
  if (!(d.mins > 0 && d.mins <= 12)) errors.push(`${at}: mins ${d.mins} ist kein Schnellgericht`);
  if (!d.ingredients?.length || !d.steps?.length) errors.push(`${at}: Zutaten oder Schritte fehlen`);
});

const ev = load("events.json");
if (ev.updated !== null && !DATE_RE.test(ev.updated)) errors.push(`events.updated "${ev.updated}" ist kein Datum`);
(ev.events || []).forEach((e, i) => {
  const at = `events[${i}] ${e.title}`;
  if (!DATE_RE.test(e.date || "")) errors.push(`${at}: date "${e.date}" nicht JJJJ-MM-TT`);
  if (!TIME_RE.test(e.time || "")) errors.push(`${at}: time "${e.time}" nicht "HH:MM" oder "ab H"`);
  check(at, "title", e.title, LIMITS.eventTitle);
  if (e.place && len(e.place) > LIMITS.eventPlace) errors.push(`${at}: place zu lang`);
  if (e.city && len(e.city) > LIMITS.eventCity) errors.push(`${at}: city zu lang`);
  if (e.city && !e.travel) errors.push(`${at}: auswaerts ohne travel`);
});

if (errors.length) {
  console.error("Datencheck fehlgeschlagen:\n  " + errors.join("\n  "));
  process.exit(1);
}
console.log("Datencheck ok");
