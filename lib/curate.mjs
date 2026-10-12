/* ============================================================
   KURATIEREN
   Reine Logik ohne Netz, damit sie sich lokal testen laesst:
   - doppelte Events aus verschiedenen Quellen zusammenlegen
   - fuer Yuna (10) Unpassendes aussortieren
   - Interessen von Lisa und Matthias erkennen
   ============================================================ */
import { isPriority } from "./content.mjs";

// Fuellwoerter, die zwei Quellen gern unterschiedlich setzen:
// "Malworkshop für Kinder" und "Malworkshop for Kids" sind dasselbe
const FILLER = new Set(["fur", "for", "kids", "kinder", "children", "the", "die", "der", "das",
  "und", "and", "eine", "ein", "einen", "mit", "with", "in", "im", "am", "an", "auf", "zum", "zur"]);

/* Titel auf einen Vergleichsschluessel eindampfen: klein, ohne
   Akzente, ohne Satzzeichen und Fuellwoerter.
   "KinderGleisKreis – eine Kinderbaustelle" -> "kindergleiskreiskinderbaustelle" */
export function normTitle(t) {
  return String(t || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().split(" ")
    .filter(w => w && !FILLER.has(w)).join("");
}

function sameEvent(a, b) {
  if (a.date !== b.date) return false;
  const x = normTitle(a.long || a.title), y = normTitle(b.long || b.title);
  if (!x || !y) return false;
  if (x === y) return true;
  // "KinderGleisKreis" und "KinderGleisKreis – eine Kinderbaustelle"
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  return s.length >= 8 && l.startsWith(s);
}

/* Doppelte zusammenlegen. Die Reihenfolge der Liste entscheidet,
   welcher Eintrag bleibt (Schule, Basel-West, Gugu, myBasel,
   Eventfrog). Fehlendes wie Link oder Info wird vom Duplikat
   uebernommen, eine Flohmarkt-Markierung auch. */
export function dedupe(events) {
  const out = [];
  for (const e of events || []) {
    if (!e || !e.title) continue;
    const hit = out.find(o => sameEvent(o, e));
    if (!hit) { out.push({ ...e }); continue; }
    for (const k of ["url", "info", "place", "long", "time"]) if (!hit[k] && e[k]) hit[k] = e[k];
    if (!hit.category && e.category) hit.category = e.category;
    if (e.school) hit.school = true;
  }
  return out;
}

/* Nichts fuer eine Zehnjaehrige: Kleinkind-Angebote, Lesehund,
   Geburtstagspakete, und "Events" ohne festen Ort oder Termin
   (Raetselspiele mit frei waehlbarem Startpunkt). */
export const NOT_FOR_YUNA = new RegExp([
  "baby", "krabbel", "kleinkind", "värsli", "versli", "buchstart", "lirum", "spielgruppe",
  "eltern-?kind", "\\bmuki\\b", "\\bvaki\\b", "purzel", "zwerg", "vorschul", "\\bkita\\b",
  "lesehund", "kindergeburtstag", "geburtstagsparty",
  "\\b0-3\\b", "\\b1-4\\b", "\\b2-5\\b", "ab 2 j", "ab 3 j", "ab 2\\b", "ab 3\\b",
  "frei wählbar", "jederzeit", "ganzjährig",
].join("|"), "i");

const text = (e) => [e.title, e.long, e.info, e.place].filter(Boolean).join(" ");

/* Familienliste fuer Board und Eventseite. Schule und Flohmarkt
   bleiben immer. Alles, was an vier oder mehr Tagen mit demselben
   Titel auftaucht, ist ein Dauerangebot und kein Termin. */
export function familyFilter(events) {
  const days = new Map();
  for (const e of events) {
    const k = normTitle(e.long || e.title);
    if (!days.has(k)) days.set(k, new Set());
    days.get(k).add(e.date);
  }
  return events.filter(e => {
    if (isPriority(e)) return true;
    if (NOT_FOR_YUNA.test(text(e))) return false;
    return (days.get(normTitle(e.long || e.title))?.size || 0) < 4;
  });
}

/* Lisa und Matthias: Jazz, Streetart, Gaming, Anime, Hip-Hop/Rap.
   Das Etikett erscheint auf der Eventseite als Badge. */
export const ADULT_TOPICS = [
  ["JAZZ", /\bjazz|\bswing\b|bebop|big ?band/i],
  ["STREETART", /street ?art|graffiti|urban art|mural/i],
  ["GAMING", /\bgaming|\bgamer|video ?games?|game ?night|games? ?nacht|\be-?sports?|lan[- ]?party|retro ?games?|\bnintendo|playstation|pixel ?art/i],
  ["ANIME", /\banime|\bmanga|cosplay|j-?pop|japan ?(con|expo)|ghibli/i],
  ["HIP-HOP", /hip ?-?hop|\brap\b|\brapper|\btrap\b|beatbox|breakdanc|\bcypher|boom ?bap/i],
];

export function adultTopic(e) {
  const t = [e.title, e.long, e.tag, e.rubric].filter(Boolean).join(" ");
  const hit = ADULT_TOPICS.find(([, re]) => re.test(t));
  return hit ? hit[0] : null;
}

// Nicht fuer den Familienabend: was klar fuer Kinder gedacht ist
const KIDS_ONLY = /kinder|kids|familie|family|schul|jugend/i;

export function adultFilter(events) {
  return (events || [])
    .map(e => ({ ...e, topic: e.topic || adultTopic(e) }))
    .filter(e => e.topic && !KIDS_ONLY.test(text(e)));
}
