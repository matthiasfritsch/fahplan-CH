import { loadEvents } from "../../lib/events.mjs";
import { zurichNow, addDays, weekday, isFleaMarket } from "../../lib/content.mjs";

/* Eventseite hinter dem QR-Code auf dem Board.
   Zeigt alles, was die Quellen fuer die naechsten zwei Wochen
   liefern, auch was aufs Board nicht mehr passt. Jeder Titel
   fuehrt zur Seite des Veranstalters. Gibt es keinen Link, sucht
   der Titel das Event im Web. */

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

export default async function EventsPage() {
  const today = zurichNow().date;
  const until = addDays(today, 13);
  const { events } = await loadEvents(today);

  const byDay = new Map();
  for (const e of events) {
    if (!e || !e.date || !e.title || e.date < today || e.date > until) continue;
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date).push(e);
  }
  const days = [...byDay.keys()].sort();

  return (
    <main style={wrap}>
      <p style={{ ...kicker, margin: "0 0 4px" }}>Fahrplan-Board</p>
      <h1 style={{ fontSize: 28, lineHeight: 1.15, margin: "0 0 20px" }}>Events für Familien</h1>

      {days.length === 0 ? <p>Gerade nichts gefunden.</p> : null}

      {days.map(date => {
        const [, mm, dd] = date.split("-");
        const list = byDay.get(date).sort((a, b) => String(a.time).localeCompare(String(b.time)));
        return (
          <section key={date} style={{ marginBottom: 26 }}>
            <h2 style={{ ...kicker, color: "#111", fontSize: 13, margin: "0 0 8px", paddingBottom: 6, borderBottom: "2px solid #111" }}>
              {DAYS[weekday(date)]} {parseInt(dd, 10)}.{parseInt(mm, 10)}.
              <span style={{ color: "#666", marginLeft: 8 }}>{list.length} {list.length === 1 ? "Event" : "Events"}</span>
            </h2>
            {list.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "9px 0", borderBottom: "1px solid #e2e2e0" }}>
                <div style={{ width: 46, flexShrink: 0, fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: e.time ? 16 : 12 }}>{e.time || "ganztags"}</div>
                <div style={{ minWidth: 0 }}>
                  <a href={linkFor(e)} target="_blank" rel="noopener" style={{ color: "#111", fontWeight: 700, fontSize: 17 }}>
                    {e.long || e.title}
                  </a>
                  {e.school ? <span style={badge(true)}>SCHULE</span> : null}
                  {!e.school && isFleaMarket(e) ? <span style={badge(true)}>FLOHMARKT</span> : null}
                  {e.city ? <span style={badge(false)}>{e.city.toUpperCase()}{e.travel ? " · " + e.travel : ""}</span> : null}
                  <div style={{ fontSize: 14, color: "#555" }}>
                    {[e.place, e.info].filter(Boolean).join(" · ")}
                    {SOURCE[e.source] ? <span style={{ color: "#999" }}>{" · " + SOURCE[e.source]}</span> : null}
                  </div>
                </div>
              </div>
            ))}
          </section>
        );
      })}

      <p style={{ fontSize: 12, color: "#888", marginTop: 32 }}>
        Angaben ohne Gewähr, bitte vor dem Losgehen beim Veranstalter prüfen.
      </p>
    </main>
  );
}
