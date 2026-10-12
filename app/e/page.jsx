import { loadEvents, pageEvents } from "../../lib/events.mjs";
import { zurichNow, weekday, isFleaMarket } from "../../lib/content.mjs";

/* Eventseite hinter dem QR-Code auf dem Board.
   Oben die Familie: alles, was die Quellen fuer die naechsten zwei
   Wochen liefern, auch was aufs Board nicht mehr passt (gleiche
   Liste, gleiche Zahl pro Tag wie auf dem Board). Darunter ein
   Abschnitt fuer Lisa und Matthias: Jazz, Streetart, Gaming, Anime,
   Hip-Hop. Jeder Titel fuehrt zur Seite des Veranstalters, ohne
   Link sucht er das Event im Web. */

export const dynamic = "force-dynamic";
export const metadata = { title: "Events · Fahrplan-Board" };

const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const SOURCE = {
  gugubasel: "Gugu Basel", mybasel: "myBasel", eventfrog: "Eventfrog",
  "steinerschule-basel.ch": "Steinerschule", "stsbw.ch": "Basel-West",
};

const wrap = { maxWidth: 560, margin: "0 auto", padding: "24px 18px 48px", color: "#111", lineHeight: 1.45 };
const kicker = { fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#666" };
const badge = (filled) => ({
  display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: ".05em",
  padding: "1px 6px", marginLeft: 6, verticalAlign: "2px", borderRadius: 3,
  border: "1.5px solid #111", background: filled ? "#111" : "transparent", color: filled ? "#fff" : "#111",
});

function linkFor(e) {
  if (e.url) return e.url;
  const q = [e.long || e.title, e.place, e.city || "Basel"].filter(Boolean).join(" ");
  return "https://www.google.com/search?q=" + encodeURIComponent(q);
}

function byDay(list) {
  const m = new Map();
  for (const e of list) {
    if (!m.has(e.date)) m.set(e.date, []);
    m.get(e.date).push(e);
  }
  return [...m.keys()].sort().map(date => [date, m.get(date).sort((a, b) => String(a.time).localeCompare(String(b.time)))]);
}

function Event({ e }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "9px 0", borderBottom: "1px solid #e2e2e0" }}>
      <div style={{ width: 46, flexShrink: 0, fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: e.time ? 16 : 12 }}>{e.time || "ganztags"}</div>
      <div style={{ minWidth: 0 }}>
        <a href={linkFor(e)} target="_blank" rel="noopener" style={{ color: "#111", fontWeight: 700, fontSize: 17 }}>
          {e.long || e.title}
        </a>
        {e.school ? <span style={badge(true)}>SCHULE</span> : null}
        {!e.school && !e.topic && isFleaMarket(e) ? <span style={badge(true)}>FLOHMARKT</span> : null}
        {e.topic ? <span style={badge(true)}>{e.topic}</span> : null}
        {e.city ? <span style={badge(false)}>{e.city.toUpperCase()}{e.travel ? " · " + e.travel : ""}</span> : null}
        <div style={{ fontSize: 14, color: "#555" }}>
          {[e.place, e.info].filter(Boolean).join(" · ")}
          {SOURCE[e.source] ? <span style={{ color: "#999" }}>{" · " + SOURCE[e.source]}</span> : null}
        </div>
      </div>
    </div>
  );
}

function Days({ days }) {
  return days.map(([date, list]) => {
    const [, mm, dd] = date.split("-");
    return (
      <section key={date} style={{ marginBottom: 26 }}>
        <h2 style={{ ...kicker, color: "#111", fontSize: 13, margin: "0 0 8px", paddingBottom: 6, borderBottom: "2px solid #111" }}>
          {DAYS[weekday(date)]} {parseInt(dd, 10)}.{parseInt(mm, 10)}.
          <span style={{ color: "#666", marginLeft: 8 }}>{list.length} {list.length === 1 ? "Event" : "Events"}</span>
        </h2>
        {list.map((e, i) => <Event key={i} e={e} />)}
      </section>
    );
  });
}

export default async function EventsPage() {
  const today = zurichNow().date;
  const { events, adults } = await loadEvents(today);

  // Dieselbe Auswahl, aus der das Board die Zahl pro Tag zaehlt
  const family = byDay(pageEvents(events, today));
  const grown = byDay(pageEvents(adults || [], today));

  return (
    <main style={wrap}>
      <p style={{ ...kicker, margin: "0 0 4px" }}>Fahrplan-Board</p>
      <h1 style={{ fontSize: 28, lineHeight: 1.15, margin: "0 0 20px" }}>Events für Familien</h1>
      {family.length === 0 ? <p>Gerade nichts gefunden.</p> : null}
      <Days days={family} />

      <h1 style={{ fontSize: 28, lineHeight: 1.15, margin: "44px 0 4px" }}>Für Lisa &amp; Matthias</h1>
      <p style={{ fontSize: 14, color: "#666", margin: "0 0 20px" }}>Jazz, Streetart, Gaming, Anime, Hip-Hop/Rap</p>
      {grown.length === 0 ? <p>Gerade nichts gefunden.</p> : null}
      <Days days={grown} />

      <p style={{ fontSize: 12, color: "#888", marginTop: 32 }}>
        Angaben ohne Gewähr, bitte vor dem Losgehen beim Veranstalter prüfen.
      </p>
    </main>
  );
}
