/* ============================================================
   DAS LAYOUT
   Das ist die Datei, die du anfasst, wenn dir etwas nicht
   gefaellt. Alles darunter ist Technik.

   Wichtig: Satori (der Renderer hinter ImageResponse) versteht
   nur einen Teil von CSS. Erlaubt ist Flexbox. Nicht erlaubt
   sind Grid, Float und position:absolute im uebliche Sinn.
   Jedes Element mit mehreren Kindern braucht display:"flex".
   ============================================================ */

export const W = 800;
export const H = 480;

// --- Tokens -------------------------------------------------
const INK   = "#000000";
const PAPER = "#ffffff";
const MID   = "#555555";   // dunkler: helles Grau dithert auf 1 Bit
const HAIR  = "#9a9a9a";   // Zeilentrenner, ebenfalls kraeftiger

const PAD    = 16;         // Seitenrand
const H_TOP  = 44;         // Kopfleiste inkl. Trennlinie
const H_BAND = 30;         // Haltestellenbalken

const SANS = "Board Sans";  // Inter, Ziele und Haltestellen
const NUMS = "Board Nums";  // JetBrains Mono, alle Ziffern

// Spaltenbreiten in Pixeln. Summe plus Abstaende muss unter
// 800 minus 2x PAD bleiben, der Rest geht ans Ziel.
const C_LINE  = 50;   // Liniennummer
const C_SCHED = 62;   // durchgestrichene Sollzeit
const C_DELAY = 46;   // Verspaetungs-Chip
const C_TIME  = 100;  // AB, Abfahrt bei dir
const C_ARR   = 100;  // AN, Ankunft am Ziel
const C_ETA   = 100;  // IN, Countdown
const GAP     = 12;

// Lange Ziele hart kuerzen. Satori kann text-overflow nur
// eingeschraenkt, abschneiden ist verlaesslicher als tricksen.
// "Bottmingen, Batteriestrasse" -> "Batteriestrasse".
// Der Ort ist bei beiden Bloecken derselbe und kostet nur Platz.
function kurz(s) {
  const t = String(s || "").trim();
  const i = t.indexOf(", ");
  return i > 0 ? t.slice(i + 2) : t;
}

function clip(s, n) {
  const t = String(s || "").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "\u2026" : t;
}

// --- Eine Abfahrtszeile -------------------------------------
function Row({ d, h, last }) {
  const base = {
    display: "flex",
    alignItems: "center",
    height: h,
    borderBottomWidth: last ? 0 : 1,
    borderBottomStyle: "solid",
    borderBottomColor: HAIR,
  };

  // Leere Platzhalterzeile, damit das Raster abends nicht
  // zusammenklappt wenn weniger Kurse kommen.
  if (!d) return <div style={base} />;

  const late = d.delay > 0;

  return (
    <div style={base}>
      <div style={{
        display: "flex", width: C_LINE, marginRight: GAP,
        justifyContent: "flex-end",
        fontFamily: NUMS, fontWeight: 800, fontSize: Math.round(h * 0.58),
        color: INK, letterSpacing: -0.5,
      }}>{d.line}</div>

      {/* Endstation der Fahrt. Zeigt die Fahrtrichtung, das
          eigentliche Ziel steht im Balken darueber. */}
      <div style={{
        display: "flex", flexGrow: 1, marginRight: GAP,
        overflow: "hidden", whiteSpace: "nowrap",
        fontFamily: SANS, fontWeight: 600, fontSize: Math.round(h * 0.40),
        color: INK,
      }}>{clip(d.dest, 17)}</div>

      <div style={{
        display: "flex", width: C_SCHED, marginRight: GAP,
        justifyContent: "flex-end",
        fontFamily: NUMS, fontWeight: 700, fontSize: Math.round(h * 0.28),
        color: MID, textDecoration: late ? "line-through" : "none",
      }}>{late ? d.schedText : ""}</div>

      <div style={{
        display: "flex", width: C_DELAY, marginRight: GAP,
        justifyContent: "flex-end",
      }}>
        {late ? (
          <div style={{
            display: "flex",
            backgroundColor: INK, color: PAPER,
            fontFamily: NUMS, fontWeight: 800, fontSize: Math.round(h * 0.28),
            paddingTop: 2, paddingBottom: 2, paddingLeft: 6, paddingRight: 6,
          }}>{"+" + d.delay}</div>
        ) : null}
      </div>

      {/* Abfahrt bei dir */}
      <div style={{
        display: "flex", width: C_TIME, marginRight: GAP,
        justifyContent: "flex-end", flexShrink: 0, whiteSpace: "nowrap",
        fontFamily: NUMS, fontWeight: 800, fontSize: Math.round(h * 0.46),
        color: INK,
      }}>{d.timeText}</div>

      {/* Ankunft am Ziel, leichter gesetzt damit die Abfahrt fuehrt */}
      <div style={{
        display: "flex", width: C_ARR, marginRight: GAP,
        justifyContent: "flex-end", flexShrink: 0, whiteSpace: "nowrap",
        fontFamily: NUMS, fontWeight: 700, fontSize: Math.round(h * 0.40),
        color: MID,
      }}>{d.arrText || ""}</div>

      <div style={{
        display: "flex", width: C_ETA,
        justifyContent: "flex-end", flexShrink: 0, whiteSpace: "nowrap", alignItems: "baseline",
        fontFamily: NUMS, fontWeight: d.eta <= 0 ? 800 : 700,
        fontSize: Math.round(h * 0.40), color: INK,
      }}>{d.etaText}</div>
    </div>
  );
}

// --- Haltestellenbalken -------------------------------------
// Schwarz invertiert. Mit zwei Haltestellen ist das der
// klarste Trenner den 1 Bit hergibt.
function Band({ stop, kind, to }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: H_BAND, backgroundColor: INK, color: PAPER,
      paddingLeft: PAD, paddingRight: PAD,
      marginLeft: -PAD, marginRight: -PAD,
    }}>
      <div style={{
        display: "flex", alignItems: "center",
        fontFamily: SANS, fontWeight: 700, fontSize: 18,
      }}>
        <div style={{ display: "flex" }}>{clip(kurz(stop), 24)}</div>
        {to ? (
          <div style={{ display: "flex", marginLeft: 8, fontWeight: 600 }}>
            {"- " + clip(to, 22)}
          </div>
        ) : null}
      </div>
      {/* Spaltenkoepfe, damit klar ist welche Zeit welche ist */}
      <div style={{
        display: "flex", alignItems: "center",
        fontFamily: SANS, fontWeight: 700, fontSize: 15, letterSpacing: 0.8,
      }}>
        <div style={{ display: "flex", width: C_TIME, marginRight: GAP, justifyContent: "flex-end" }}>AB</div>
        <div style={{ display: "flex", width: C_ARR, marginRight: GAP, justifyContent: "flex-end" }}>AN</div>
        <div style={{ display: "flex", width: C_ETA, justifyContent: "flex-end" }}>IN</div>
      </div>
    </div>
  );
}

// --- Das ganze Board ----------------------------------------
export default function Board({ a, b, weather, stamp, stale }) {
  const rowsTotal = a.rows + b.rows;
  const space = H - H_TOP - H_BAND * 2;
  const rowH = Math.floor(space / rowsTotal);
  const slack = space - rowH * rowsTotal;   // Rest unten auffangen

  const fill = (list, n) =>
    Array.from({ length: n }, (_, i) => list[i] || null);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      width: W, height: H,
      backgroundColor: PAPER, color: INK,
      paddingLeft: PAD, paddingRight: PAD,
    }}>

      {/* Kopf: Datum links, Wetter rechts */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: H_TOP,
      }}>
        <div style={{
          display: "flex", alignItems: "baseline",
          fontFamily: NUMS, fontWeight: 800, fontSize: 20, color: INK,
        }}>
          {stamp}
          {stale ? (
            <div style={{
              display: "flex", marginLeft: 10,
              fontFamily: SANS, fontWeight: 700, fontSize: 15, color: MID,
            }}>alte Daten</div>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "baseline" }}>
          {weather ? (
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <div style={{
                display: "flex", fontFamily: NUMS, fontWeight: 800, fontSize: 23,
              }}>{weather.temp + "\u00b0"}</div>
              <div style={{
                display: "flex", marginLeft: 9,
                fontFamily: SANS, fontWeight: 600, fontSize: 19, color: INK,
              }}>{weather.cond}</div>
              <div style={{
                display: "flex", marginLeft: 9,
                fontFamily: NUMS, fontWeight: 700, fontSize: 17, color: MID,
              }}>{weather.min + "/" + weather.max}</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Block A */}
      <Band stop={a.stop} kind={a.label} to={a.to} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {fill(a.list, a.rows).map((d, i) => (
          <Row key={"a" + i} d={d} h={rowH} last={i === a.rows - 1} />
        ))}
      </div>

      {/* Block B */}
      <Band stop={b.stop} kind={b.label} to={b.to} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {fill(b.list, b.rows).map((d, i) => (
          <Row key={"b" + i} d={d} h={rowH + (i === b.rows - 1 ? slack : 0)} last={i === b.rows - 1} />
        ))}
      </div>
    </div>
  );
}
