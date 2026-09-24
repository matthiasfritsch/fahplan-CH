/* ============================================================
   DAS LAYOUT
   Das ist die Datei, die du anfasst, wenn dir etwas nicht
   gefaellt. Alles darunter ist Technik.

   Aufbau (800 x 480):
   +--------------------------------------------------------+
   | Kopf: Datum                                     Wetter |
   +-------------------------------------+------------------+
   | Events, nach Tag gruppiert          | Tram  AB     AN  |
   |                                     | ...              |
   +------------------+------------------+ Bus   AB     AN  |
   | Wort des Tages   | Znacht      [QR] | ...              |
   +------------------+------------------+------------------+

   Wichtig: Satori (der Renderer hinter ImageResponse) versteht
   nur einen Teil von CSS. Erlaubt ist Flexbox. Nicht erlaubt
   sind Grid, Float und position:absolute im ueblichen Sinn.
   Jedes Element mit mehreren Kindern braucht display:"flex".
   ============================================================ */

export const W = 800;
export const H = 480;

// --- Tokens -------------------------------------------------
let INK   = "#000000";
let PAPER = "#ffffff";
let MID   = "#555555";   // Nebenangaben: Ort, Ankunft, Datum
let HAIR  = "#9a9a9a";   // Zeilentrenner im Fahrplan

/* Serverseitig invertieren.
   Manche Panels stellen ein PNG genau andersherum dar, als
   ESPHome es meint. Statt am Geraet herumzuraten drehen wir
   das Bild hier um, dann stimmt es dort ohne Zutun. */
export function setInvert(on) {
  INK   = on ? "#ffffff" : "#000000";
  PAPER = on ? "#000000" : "#ffffff";
  MID   = on ? "#b0b0b0" : "#555555";
  HAIR  = on ? "#707070" : "#9a9a9a";
}

const H_TOP  = 44;   // Kopfleiste inkl. Trennlinie
const H_BAND = 28;   // Tram/Bus-Balken
const H_FOOT = 128;  // Wort + Znacht
const W_LEFT = 560;  // 70 Prozent fuer Events, Rest Fahrplan
const RULE   = 2;    // Staerke der Zonen-Linien

const SANS = "Board Sans";  // Inter
const NUMS = "Board Nums";  // JetBrains Mono, alle Ziffern

// Fahrplan-Spalten (rechte Seite, 240 px breit)
const C_LINE  = 38;
const C_TIME  = 64;
const C_DELAY = 34;
const C_ARR   = 58;

function clip(s, n) {
  const t = String(s || "").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}

const flex = (extra) => ({ display: "flex", ...extra });

// Kleine Ueberschrift in Versalien, z.B. WORT DES TAGES
function Label({ children, style }) {
  return (
    <div style={flex({
      fontFamily: SANS, fontWeight: 700, fontSize: 11, letterSpacing: 1,
      color: INK, ...style,
    })}>{children}</div>
  );
}

/* ============================================================
   RECHTS: Fahrplan
   Nur Linie, Abfahrt, Verspaetung und Ankunft. Das Ziel faellt
   weg, weil es nur eine Fahrtrichtung gibt.
   ============================================================ */
function Band({ label }) {
  return (
    <div style={flex({
      alignItems: "center", height: H_BAND, flexShrink: 0,
      backgroundColor: INK, color: PAPER,
      paddingLeft: 12, paddingRight: 14,
      fontFamily: SANS, fontWeight: 700,
    })}>
      <div style={flex({ flexGrow: 1, fontSize: 15 })}>{clip(label, 12)}</div>
      <div style={flex({ width: C_TIME, justifyContent: "flex-end", fontSize: 12, letterSpacing: 0.8 })}>AB</div>
      <div style={flex({ width: C_DELAY })} />
      <div style={flex({ width: C_ARR, justifyContent: "flex-end", fontSize: 12, letterSpacing: 0.8 })}>AN</div>
    </div>
  );
}

function Row({ d, h, last }) {
  const base = {
    display: "flex", alignItems: "center", height: h, flexShrink: 0,
    marginLeft: 12, marginRight: 14,
    borderBottomWidth: last ? 0 : 1, borderBottomStyle: "solid", borderBottomColor: HAIR,
  };
  // Leere Platzhalterzeile, damit das Raster nachts nicht
  // zusammenklappt wenn weniger Kurse kommen.
  if (!d) return <div style={base} />;

  return (
    <div style={base}>
      <div style={flex({
        width: C_LINE, fontFamily: NUMS, fontWeight: 800, fontSize: 24, color: INK,
      })}>{d.line}</div>
      <div style={flex({
        flexGrow: 1, justifyContent: "flex-end",
        fontFamily: NUMS, fontWeight: 800, fontSize: 21, color: INK,
      })}>{d.timeText}</div>
      <div style={flex({ width: C_DELAY, justifyContent: "center" })}>
        {d.delay > 0 ? (
          <div style={flex({
            backgroundColor: INK, color: PAPER,
            fontFamily: NUMS, fontWeight: 800, fontSize: 12,
            paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1,
          })}>{"+" + d.delay}</div>
        ) : null}
      </div>
      <div style={flex({
        width: C_ARR, justifyContent: "flex-end",
        fontFamily: NUMS, fontWeight: 700, fontSize: 18, color: MID,
      })}>{d.arrText || ""}</div>
    </div>
  );
}

function Transit({ a, b }) {
  const rowsTotal = a.rows + b.rows;
  const space = H - H_TOP - H_BAND * 2;
  const rowH = Math.floor(space / rowsTotal);
  // Rest gleichmaessig auf die ersten Zeilen verteilen
  const rest = space - rowH * rowsTotal;
  const extra = (i) => (i < rest ? 1 : 0);
  const fill = (list, n) => Array.from({ length: n }, (_, i) => list[i] || null);

  return (
    <div style={flex({ flexDirection: "column", width: W - W_LEFT - RULE })}>
      <Band label={a.label} />
      {fill(a.list, a.rows).map((d, i) => (
        <Row key={"a" + i} d={d} h={rowH + extra(i)} last={i === a.rows - 1} />
      ))}
      <Band label={b.label} />
      {fill(b.list, b.rows).map((d, i) => (
        <Row key={"b" + i} d={d} h={rowH + extra(a.rows + i)} last={i === b.rows - 1} />
      ))}
    </div>
  );
}

/* ============================================================
   LINKS OBEN: Events
   Nach Tag gruppiert, ohne Trennlinien. Auswaerts bekommt ein
   Badge mit Ort und Fahrzeit, Basel ist der Normalfall.
   ============================================================ */
function Event({ e }) {
  const away = !!e.city;
  // Grobe Zeichenrechnung, Satori kann Text nicht vermessen.
  // Mit Badge ist weniger Platz, der Ort faellt dann zuerst weg.
  const budget = away ? 34 : 50;
  const title = clip(e.title, budget);
  const place = e.place && title.length + e.place.length + 1 <= budget ? e.place : "";

  return (
    <div style={flex({ alignItems: "center", height: 26 })}>
      {e.time ? (
        <div style={flex({
          width: 56, flexShrink: 0, fontFamily: NUMS, fontWeight: 700, fontSize: 15, color: INK,
        })}>{e.time}</div>
      ) : null}
      <div style={flex({
        flexGrow: 1, alignItems: "baseline", overflow: "hidden", whiteSpace: "nowrap",
      })}>
        <div style={flex({ fontFamily: SANS, fontWeight: 700, fontSize: 16, color: INK })}>{title}</div>
        {place ? (
          <div style={flex({
            marginLeft: 6, fontFamily: SANS, fontWeight: 600, fontSize: 14, color: MID,
          })}>{place}</div>
        ) : null}
      </div>
      {away ? (
        <div style={flex({
          flexShrink: 0, marginLeft: 8,
          borderWidth: 1.5, borderStyle: "solid", borderColor: INK,
          paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1,
          fontFamily: SANS, fontWeight: 700, fontSize: 11, letterSpacing: 0.5, color: INK,
        })}>{(e.city + " · " + (e.travel || "")).toUpperCase().replace(/ MIN$/, " MIN")}</div>
      ) : null}
    </div>
  );
}

function Events({ days, ideas }) {
  return (
    <div style={flex({
      flexDirection: "column", flexGrow: 1, overflow: "hidden",
      paddingLeft: 16, paddingRight: 14, paddingTop: 2,
    })}>
      {days.length ? days.map(d => (
        <div key={d.label + d.dateText} style={flex({ flexDirection: "column" })}>
          <div style={flex({ alignItems: "baseline", height: 24, paddingTop: 9 })}>
            <Label>{d.label}</Label>
            <div style={flex({
              marginLeft: 8, fontFamily: NUMS, fontWeight: 700, fontSize: 12, color: MID,
            })}>{d.dateText}</div>
          </div>
          {d.list.map((e, i) => <Event key={i} e={e} />)}
        </div>
      )) : (
        /* Rueckfall, wenn weder Routine noch Scraper etwas haben */
        <div style={flex({ flexDirection: "column" })}>
          <div style={flex({ height: 24, paddingTop: 9 })}>
            <Label>IDEEN, WENN NICHTS ANSTEHT</Label>
          </div>
          {ideas.map((e, i) => <Event key={i} e={{ ...e, time: "" }} />)}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   LINKS UNTEN: Wort des Tages und 10-Minuten-Znacht
   Die Listen halten Zeichenlimits ein (npm run check), deshalb
   darf hier fest gesetzt werden.
   ============================================================ */
function WordLine({ lang, word, hint, small }) {
  return (
    <div style={flex({ alignItems: "baseline", height: small ? 21 : 23 })}>
      <div style={flex({ width: 26, fontFamily: NUMS, fontWeight: 700, fontSize: 11, color: MID })}>{lang}</div>
      <div style={flex({ fontFamily: SANS, fontWeight: 700, fontSize: small ? 16 : 18, color: INK })}>{word}</div>
      <div style={flex({ marginLeft: 7, fontFamily: SANS, fontWeight: 600, fontSize: 12, color: MID })}>{hint}</div>
    </div>
  );
}

function Word({ w }) {
  // Lange Woerter eine Stufe kleiner, statt umzubrechen
  const small = Math.max(w.de.length, w.en.length, w.fr.length) > 14;
  return (
    <div style={flex({ flexDirection: "column", width: W_WORD, paddingLeft: 16, paddingRight: 12, paddingTop: 8 })}>
      <Label style={{ marginBottom: 3 }}>WORT DES TAGES</Label>
      <WordLine lang="DE" word={w.de} hint={w.deHint} small={small} />
      <WordLine lang="EN" word={w.en} hint={"sprich: " + w.enSay} small={small} />
      <WordLine lang="FR" word={w.fr} hint={w.frHint} small={small} />
      <div style={flex({
        marginTop: 2, fontFamily: SANS, fontWeight: 600, fontSize: 12, color: MID,
      })}>{"«" + w.example + "»"}</div>
    </div>
  );
}

const W_WORD = 290;

function Dinner({ d, qr }) {
  const small = d.name.length > 24;
  // Feste Textbreite, sonst bricht Satori nicht um und der
  // Name schiebt den QR-Code in den Fahrplan.
  const textW = W_LEFT - W_WORD - 6 - 16 - (qr ? qr.size + 8 : 0);
  return (
    <div style={flex({ flexGrow: 1, paddingLeft: 6, paddingRight: 16, paddingTop: 8 })}>
      <div style={flex({ flexDirection: "column", width: textW, marginRight: qr ? 8 : 0 })}>
        <Label style={{ marginBottom: 3 }}>10-MIN-ZNACHT</Label>
        <div style={flex({
          fontFamily: SANS, fontWeight: 700, fontSize: small ? 15 : 16,
          lineHeight: small ? "19px" : "20px", color: INK,
        })}>{d.name}</div>
        <div style={flex({
          marginTop: 3, fontFamily: NUMS, fontWeight: 700, fontSize: 13, color: INK,
        })}>{d.mins + " MIN"}</div>
      </div>
      {qr ? (
        <div style={flex({ paddingTop: 4 })}>
          <img src={qr.src} width={qr.size} height={qr.size} />
        </div>
      ) : null}
    </div>
  );
}

// --- Das ganze Board ----------------------------------------
export default function Board({ a, b, weather, stamp, stale, days, ideas, word, dinner, qr }) {
  return (
    <div style={flex({
      flexDirection: "column", width: W, height: H,
      backgroundColor: PAPER, color: INK,
    })}>

      {/* Kopf: Datum links, Wetter rechts */}
      <div style={flex({
        alignItems: "center", justifyContent: "space-between",
        height: H_TOP, flexShrink: 0, paddingLeft: 16, paddingRight: 16,
        borderBottomWidth: RULE, borderBottomStyle: "solid", borderBottomColor: INK,
      })}>
        <div style={flex({
          alignItems: "baseline", fontFamily: NUMS, fontWeight: 800, fontSize: 20, color: INK,
        })}>
          {stamp}
          {stale ? (
            <div style={flex({
              marginLeft: 10, fontFamily: SANS, fontWeight: 700, fontSize: 15, color: MID,
            })}>alte Daten</div>
          ) : null}
        </div>

        {weather ? (
          <div style={flex({ alignItems: "baseline" })}>
            <div style={flex({ fontFamily: NUMS, fontWeight: 800, fontSize: 23 })}>{weather.temp + "°"}</div>
            <div style={flex({ marginLeft: 9, fontFamily: SANS, fontWeight: 600, fontSize: 19, color: INK })}>{weather.cond}</div>
            <div style={flex({ marginLeft: 9, fontFamily: NUMS, fontWeight: 700, fontSize: 17, color: MID })}>{weather.min + "/" + weather.max}</div>
          </div>
        ) : <div style={flex({})} />}
      </div>

      <div style={flex({ flexGrow: 1 })}>
        {/* Links: Events oben, Wort und Znacht unten */}
        <div style={flex({
          flexDirection: "column", width: W_LEFT,
          borderRightWidth: RULE, borderRightStyle: "solid", borderRightColor: INK,
        })}>
          <Events days={days} ideas={ideas} />
          <div style={flex({
            height: H_FOOT, flexShrink: 0,
            borderTopWidth: RULE, borderTopStyle: "solid", borderTopColor: INK,
          })}>
            <Word w={word} />
            <Dinner d={dinner} qr={qr} />
          </div>
        </div>

        {/* Rechts: Fahrplan */}
        <Transit a={a} b={b} />
      </div>
    </div>
  );
}
