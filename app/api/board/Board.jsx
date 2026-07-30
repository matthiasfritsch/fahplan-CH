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
const MID   = "#6f6f6f";   // Sollzeit, Nebenangaben
const HAIR  = "#c4c4c4";   // Zeilentrenner

const PAD    = 22;         // Seitenrand
const H_TOP  = 46;         // Kopfleiste inkl. Trennlinie
const H_BAND = 28;         // Haltestellenbalken

const SANS = "Plex Cond";  // Liniennummern, Ziele, Haltestellen
const MONO = "Plex Mono";  // alle Ziffern, garantiert gleich breit

// Spaltenbreiten in Pixeln. Summe plus Abstaende muss unter
// 800 minus 2x PAD bleiben, der Rest geht ans Ziel.
const C_LINE  = 72;
const C_SCHED = 58;
const C_DELAY = 56;
const C_TIME  = 76;
const C_ETA   = 78;
const GAP     = 14;

// Lange Ziele hart kuerzen. Satori kann text-overflow nur
// eingeschraenkt, abschneiden ist verlaesslicher als tricksen.
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
        fontFamily: SANS, fontWeight: 700, fontSize: Math.round(h * 0.60),
        color: INK, letterSpacing: -0.5,
      }}>{d.line}</div>

      <div style={{
        display: "flex", flexGrow: 1, marginRight: GAP,
        fontFamily: SANS, fontWeight: 500, fontSize: Math.round(h * 0.44),
        color: INK,
      }}>{clip(d.dest, 26)}</div>

      <div style={{
        display: "flex", width: C_SCHED, marginRight: GAP,
        justifyContent: "flex-end",
        fontFamily: MONO, fontWeight: 500, fontSize: Math.round(h * 0.29),
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
            fontFamily: MONO, fontWeight: 600, fontSize: Math.round(h * 0.28),
            paddingTop: 2, paddingBottom: 2, paddingLeft: 6, paddingRight: 6,
          }}>{"+" + d.delay}</div>
        ) : null}
      </div>

      <div style={{
        display: "flex", width: C_TIME, marginRight: GAP,
        justifyContent: "flex-end",
        fontFamily: MONO, fontWeight: 600, fontSize: Math.round(h * 0.46),
        color: INK,
      }}>{d.timeText}</div>

      <div style={{
        display: "flex", width: C_ETA,
        justifyContent: "flex-end", alignItems: "baseline",
        fontFamily: MONO, fontWeight: d.eta <= 0 ? 600 : 500,
        fontSize: Math.round(h * 0.38), color: INK,
      }}>{d.etaText}</div>
    </div>
  );
}

// --- Haltestellenbalken -------------------------------------
// Schwarz invertiert. Mit zwei Haltestellen ist das der
// klarste Trenner den 1 Bit hergibt.
function Band({ stop, kind }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: H_BAND, backgroundColor: INK, color: PAPER,
      paddingLeft: PAD, paddingRight: PAD,
      marginLeft: -PAD, marginRight: -PAD,
    }}>
      <div style={{
        display: "flex", fontFamily: SANS, fontWeight: 600, fontSize: 17,
      }}>{clip(stop, 46)}</div>
      <div style={{
        display: "flex", fontFamily: SANS, fontWeight: 500, fontSize: 14,
        letterSpacing: 1.4,
      }}>{String(kind || "").toUpperCase()}</div>
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
        borderBottomWidth: 2, borderBottomStyle: "solid", borderBottomColor: INK,
      }}>
        <div style={{
          display: "flex", alignItems: "baseline",
          fontFamily: MONO, fontWeight: 600, fontSize: 22, color: INK,
        }}>
          {stamp}
          {stale ? (
            <div style={{
              display: "flex", marginLeft: 10,
              fontFamily: SANS, fontWeight: 600, fontSize: 15, color: MID,
            }}>alte Daten</div>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "baseline" }}>
          {weather ? (
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <div style={{
                display: "flex", fontFamily: MONO, fontWeight: 600, fontSize: 24,
              }}>{weather.temp + "\u00b0"}</div>
              <div style={{
                display: "flex", marginLeft: 9,
                fontFamily: SANS, fontWeight: 500, fontSize: 19, color: INK,
              }}>{weather.cond}</div>
              <div style={{
                display: "flex", marginLeft: 9,
                fontFamily: MONO, fontWeight: 500, fontSize: 17, color: MID,
              }}>{weather.min + "/" + weather.max}</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Block A */}
      <Band stop={a.stop} kind={a.label} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {fill(a.list, a.rows).map((d, i) => (
          <Row key={"a" + i} d={d} h={rowH} last={i === a.rows - 1} />
        ))}
      </div>

      {/* Block B */}
      <Band stop={b.stop} kind={b.label} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {fill(b.list, b.rows).map((d, i) => (
          <Row key={"b" + i} d={d} h={rowH + (i === b.rows - 1 ? slack : 0)} last={i === b.rows - 1} />
        ))}
      </div>
    </div>
  );
}
