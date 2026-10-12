/* ============================================================
   DAS LAYOUT
   Das ist die Datei, die du anfasst, wenn dir etwas nicht
   gefaellt. Alles darunter ist Technik.

   Aufbau (800 x 480):
   +--------------------------------------------------------+
   |#Kopf: Datum, Uhrzeit (invertiert)               Wetter#|
   +--------------------------------------------------------+
   | DE Wort          | EN word          | FR mot           |
   | Beispielsatz     | [Aussprache]     | [Aussprache]     |
   +-------------------------------------+==================+
   | Events, nach Tag gruppiert          # Tram  AB     AN  #
   |                                     # ...  (invertiert)#
   |                              [QR]   # Bus   AB     AN  #
   |                         alle Events # ...              #
   +-------------------------------------+==================+

   Wichtig: Satori (der Renderer hinter ImageResponse) versteht
   nur einen Teil von CSS. Erlaubt ist Flexbox. Nicht erlaubt
   sind Grid und Float. position:absolute geht, nutzen wir nur
   fuer den QR-Code.
   Jedes Element mit mehreren Kindern braucht display:"flex".
   ============================================================ */

import { isFleaMarket } from "../../../lib/content.mjs";

export const W = 800;
export const H = 480;

// --- Tokens -------------------------------------------------
let INK   = "#000000";
let PAPER = "#ffffff";
let MID   = "#555555";   // Nebenangaben: Ort, Ankunft, Datum
// Auf dem schwarzen Fahrplan: hell genug, dass es auf 1-Bit
// weiss bleibt, aber zurueckhaltender als reines Weiss
let LINE_DARK = "#b4b4b4";  // Zeilentrenner im Fahrplan
let MID_DARK  = "#c8c8c8";  // Ankunft im Fahrplan

/* Serverseitig invertieren.
   Manche Panels stellen ein PNG genau andersherum dar, als
   ESPHome es meint. Statt am Geraet herumzuraten drehen wir
   das Bild hier um, dann stimmt es dort ohne Zutun. */
export function setInvert(on) {
  INK   = on ? "#ffffff" : "#000000";
  PAPER = on ? "#000000" : "#ffffff";
  MID   = on ? "#b0b0b0" : "#555555";
  LINE_DARK = on ? "#4c4c4c" : "#b4b4b4";
  MID_DARK  = on ? "#383838" : "#c8c8c8";
}

const H_TOP  = 40;   // Kopfleiste inkl. Trennlinie
const H_WORD = 88;   // Wortband inkl. Trennlinie
const H_BAND = 28;   // Tram/Bus-Kopf
const W_LEFT = 560;  // 70 Prozent fuer Events, Rest Fahrplan
const RULE   = 2;    // Staerke der Zonen-Linien
const W_QR   = 118;  // Platz fuer den QR-Block unten rechts in den Events
const H_BODY = H - H_TOP - H_WORD;   // Hoehe unter dem Wortband
const W_ROW_FULL   = W_LEFT - 16 - 16;          // Eventzeile volle Breite
const W_ROW_NARROW = W_LEFT - 16 - W_QR - 4;    // Zeile neben dem QR-Code
const W_TIME = 66;                               // Spalte fuer die Uhrzeit

const SANS = "Board Sans";  // Inter
const NUMS = "Board Nums";  // JetBrains Mono, alle Ziffern

// Fahrplan-Spalten (rechte Seite, 240 px breit)
const C_LINE  = 40;
const C_TIME  = 62;
const C_DELAY = 36;
const C_ARR   = 56;

function clip(s, n) {
  const t = String(s || "").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}

const flex = (extra) => ({ display: "flex", ...extra });

// Kleine Ueberschrift in Versalien, z.B. WORT DES TAGES
function Label({ children, style }) {
  return (
    <div style={flex({
      fontFamily: SANS, fontWeight: 700, fontSize: 13, letterSpacing: 1,
      color: INK, ...style,
    })}>{children}</div>
  );
}

/* ============================================================
   RECHTS: Fahrplan, invertiert (weiss auf schwarz)
   Bewusst etwas leiser als frueher: kleinere Ziffern, duenne
   Linien. Nur Linie, Abfahrt, Verspaetung und Ankunft, das Ziel
   faellt weg, weil es nur eine Fahrtrichtung gibt.
   ============================================================ */
function Band({ label }) {
  return (
    <div style={flex({
      alignItems: "flex-end", height: H_BAND, flexShrink: 0,
      marginLeft: 12, marginRight: 14, paddingBottom: 4,
      borderBottomWidth: 2, borderBottomStyle: "solid", borderBottomColor: PAPER,
      color: PAPER, fontFamily: SANS, fontWeight: 700,
    })}>
      <div style={flex({ flexGrow: 1, fontSize: 15, letterSpacing: 0.5 })}>{clip(label, 12).toUpperCase()}</div>
      <div style={flex({ width: C_TIME, justifyContent: "flex-end", fontSize: 13, letterSpacing: 0.8 })}>AB</div>
      <div style={flex({ width: C_DELAY })} />
      <div style={flex({ width: C_ARR, justifyContent: "flex-end", fontSize: 13, letterSpacing: 0.8 })}>AN</div>
    </div>
  );
}

function Row({ d, h, last }) {
  const base = {
    display: "flex", alignItems: "center", height: h, flexShrink: 0,
    marginLeft: 12, marginRight: 14,
    borderBottomWidth: last ? 0 : 1, borderBottomStyle: "solid", borderBottomColor: LINE_DARK,
  };
  // Leere Platzhalterzeile, damit das Raster nachts nicht
  // zusammenklappt wenn weniger Kurse kommen.
  if (!d) return <div style={base} />;

  return (
    <div style={base}>
      <div style={flex({
        width: C_LINE, fontFamily: NUMS, fontWeight: 800, fontSize: 21, color: PAPER,
      })}>{d.line}</div>
      <div style={flex({
        flexGrow: 1, justifyContent: "flex-end",
        fontFamily: NUMS, fontWeight: 800, fontSize: 19, color: PAPER,
      })}>{d.timeText}</div>
      <div style={flex({ width: C_DELAY, justifyContent: "center" })}>
        {d.delay > 0 ? (
          <div style={flex({
            backgroundColor: PAPER, color: INK,
            fontFamily: NUMS, fontWeight: 800, fontSize: 13,
            paddingLeft: 4, paddingRight: 4,
          })}>{"+" + d.delay}</div>
        ) : null}
      </div>
      <div style={flex({
        width: C_ARR, justifyContent: "flex-end",
        fontFamily: NUMS, fontWeight: 700, fontSize: 16, color: MID_DARK,
      })}>{d.arrText || ""}</div>
    </div>
  );
}

function Transit({ a, b }) {
  const rowsTotal = a.rows + b.rows;
  const space = H - H_TOP - H_WORD - H_BAND * 2 - 8;   // 8 px Luft unten
  const rowH = Math.floor(space / rowsTotal);
  // Rest gleichmaessig auf die ersten Zeilen verteilen
  const rest = space - rowH * rowsTotal;
  const extra = (i) => (i < rest ? 1 : 0);
  const fill = (list, n) => Array.from({ length: n }, (_, i) => list[i] || null);

  return (
    <div style={flex({ flexDirection: "column", width: W - W_LEFT, backgroundColor: INK })}>
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
   LINKS: Events
   Nach Tag gruppiert, ohne Trennlinien. Auswaerts bekommt ein
   Badge mit Ort und Fahrzeit, Basel ist der Normalfall.
   ============================================================ */
function Event({ e, width }) {
  const away = !!e.city;
  const school = !!e.school;
  const flea = !school && isFleaMarket(e);
  // Grobe Zeichenrechnung, Satori kann Text nicht vermessen.
  // Das Badge nimmt seine Breite dem Titel weg (13 px Versalien,
  // ~8.6 px pro Zeichen plus Rand), der Ort faellt zuerst weg.
  const badge = school ? "SCHULE" : flea ? "FLOHMARKT" : away ? (e.travel ? e.city + " \u00b7 " + e.travel : e.city) : "";
  const badgePx = badge ? [...badge].length * 8.6 + 20 : 0;
  const budget = Math.floor((width - W_TIME - badgePx) / 10.8);
  const title = clip(e.title, budget);
  const place = e.place && title.length + e.place.length + 1 <= budget ? e.place : "";

  return (
    <div style={flex({ alignItems: "center", height: 30, width })}>
      {/* Zeitspalte immer zeichnen, damit Titel auch bei ganztaegigen
          Anlaessen ohne Uhrzeit sauber untereinander stehen */}
      <div style={flex({
        width: W_TIME, flexShrink: 0, fontFamily: NUMS, fontWeight: 800, fontSize: 18, color: INK,
      })}>{e.time || ""}</div>
      <div style={flex({
        flexGrow: 1, alignItems: "baseline", overflow: "hidden", whiteSpace: "nowrap",
      })}>
        <div style={flex({ fontFamily: SANS, fontWeight: 700, fontSize: 19, color: INK })}>{title}</div>
        {place ? (
          <div style={flex({
            marginLeft: 8, fontFamily: SANS, fontWeight: 700, fontSize: 16, color: MID,
          })}>{place}</div>
        ) : null}
      </div>
      {flea ? (
        /* Flohmarkt: eigene Kategorie, ebenfalls gefuellt */
        <div style={flex({
          flexShrink: 0, marginLeft: 8,
          backgroundColor: INK, color: PAPER,
          paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
          fontFamily: SANS, fontWeight: 700, fontSize: 13, letterSpacing: 0.5,
        })}>FLOHMARKT</div>
      ) : null}
      {school ? (
        /* Yunas Schule: schwarz gefuellt, damit es sofort auffaellt */
        <div style={flex({
          flexShrink: 0, marginLeft: 8,
          backgroundColor: INK, color: PAPER,
          paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
          fontFamily: SANS, fontWeight: 700, fontSize: 13, letterSpacing: 0.5,
        })}>SCHULE</div>
      ) : null}
      {away ? (
        <div style={flex({
          flexShrink: 0, marginLeft: 8,
          borderWidth: 1.5, borderStyle: "solid", borderColor: INK,
          paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1,
          fontFamily: SANS, fontWeight: 700, fontSize: 13, letterSpacing: 0.5, color: INK,
        })}>{(e.travel ? e.city + " \u00b7 " + e.travel : e.city).toUpperCase()}</div>
      ) : null}
    </div>
  );
}

/* Der QR-Code sitzt frei unten rechts. Zeilen darueber nutzen die
   volle Breite, nur Zeilen auf Hoehe des QR-Codes werden schmaler.
   Satori kann nicht messen, deshalb rechnen wir die Hoehen selbst:
   Tageskopf 30 px, Eventzeile 30 px (wie in lib/content.mjs). */
function Events({ days, qr }) {
  const qrBlockH = 12 + (qr ? qr.size : 0) + 6 + 32;   // Rand + QR + Abstand + 2 Zeilen Text
  const qrTop = H_BODY - qrBlockH;
  let y = 2;
  const rows = days.map(d => {
    y += 30;
    const list = d.list.map(e => {
      const top = y;
      y += 30;
      return { e, width: top + 30 > qrTop - 4 ? W_ROW_NARROW : W_ROW_FULL };
    });
    return { d, list };
  });

  return (
    <div style={flex({ position: "relative", width: W_LEFT, height: H_BODY, flexShrink: 0, overflow: "hidden" })}>
      <div style={flex({
        flexDirection: "column", width: W_LEFT, paddingLeft: 16, paddingTop: 2,
      })}>
        {days.length ? rows.map(({ d, list }) => (
          <div key={d.label + d.dateText} style={flex({ flexDirection: "column" })}>
            <div style={flex({ alignItems: "baseline", height: 30, paddingTop: 12 })}>
              <Label style={{ fontSize: 15 }}>{d.label}</Label>
              <div style={flex({
                marginLeft: 10, fontFamily: NUMS, fontWeight: 800, fontSize: 15, color: MID,
              })}>{d.dateText}</div>
              {d.total ? (
                <div style={flex({
                  marginLeft: 10, fontFamily: SANS, fontWeight: 700, fontSize: 14, color: MID,
                })}>{d.total === 1 ? "1 Event" : d.total + " Events"}</div>
              ) : null}
            </div>
            {list.map(({ e, width }, i) => <Event key={i} e={e} width={width} />)}
          </div>
        )) : (
          /* Rueckfall, wenn keine Quelle etwas liefert: ehrlich leer */
          <div style={flex({ height: 30, paddingTop: 12 })}>
            <Label style={{ fontSize: 15 }}>NICHTS BESONDERES GEFUNDEN</Label>
          </div>
        )}
      </div>

      {/* QR unten rechts: fuehrt zur Liste aller Events mit Links */}
      <div style={flex({
        position: "absolute", right: 12, bottom: 12,
        flexDirection: "column", alignItems: "center", width: W_QR - 16,
      })}>
        {qr ? <img src={qr.src} width={qr.size} height={qr.size} /> : null}
        <div style={flex({
          flexDirection: "column", alignItems: "center", marginTop: 6,
          fontFamily: SANS, fontWeight: 700, fontSize: 13, lineHeight: "16px", color: INK,
        })}>
          <div style={flex({})}>Alle Events</div>
          <div style={flex({})}>mit Links</div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   OBEN: Wort des Tages, ueber die ganze Breite
   Drei Spalten DE, EN, FR, das Wort so gross wie es passt.
   Unter DE der Beispielsatz, unter EN und FR die Aussprache in
   deutscher Schreibweise.

   Auf 1-Bit-E-Ink verschwimmt alles unter etwa 13 px, und Grau
   wird hart zu Schwarz oder Weiss. Deshalb hier nichts kleiner
   als 13 px und alles in Schwarz.
   ============================================================ */
const COLS = [300, 250, 250];   // DE bekommt mehr Platz fuer den Satz
const TAG_W = 28;               // Breite fuer "DE", "EN", "FR"

// Satori kann Text nicht vermessen, deshalb grob schaetzen:
// Inter Bold braucht etwa 0,6 x Schriftgroesse pro Zeichen.
const textW = (str, size, k = 0.6) => [...String(str || "")].length * size * k;

// Groesste Stufe, bei der der Text in die Breite passt
function fitSize(str, width, steps, k) {
  return steps.find(sz => textW(str, sz, k) <= width) || steps[steps.length - 1];
}

function WordCol({ width, lang, word, sub, first }) {
  const padL = first ? 16 : 12;
  const size = fitSize(word, width - padL - TAG_W - 8, [36, 33, 30, 27, 24, 22, 20]);
  const subW = width - padL - 8;
  const subSize = fitSize(sub, subW, [16, 15, 14, 13], 0.56);
  return (
    <div style={flex({ flexDirection: "column", width, paddingLeft: padL, paddingTop: 10 })}>
      <div style={flex({ alignItems: "baseline", height: 44, whiteSpace: "nowrap" })}>
        <div style={flex({
          width: TAG_W, flexShrink: 0, fontFamily: NUMS, fontWeight: 800, fontSize: 14, color: INK,
        })}>{lang}</div>
        <div style={flex({ fontFamily: SANS, fontWeight: 700, fontSize: size, color: INK })}>{word}</div>
      </div>
      <div style={flex({
        whiteSpace: "nowrap", overflow: "hidden",
        fontFamily: SANS, fontWeight: 700, fontSize: subSize, color: INK,
      })}>{textW(sub, subSize, 0.56) <= subW ? sub : clip(sub, Math.floor(subW / (subSize * 0.56)))}</div>
    </div>
  );
}

function Word({ w }) {
  return (
    <div style={flex({
      height: H_WORD, flexShrink: 0,
      borderBottomWidth: RULE, borderBottomStyle: "solid", borderBottomColor: INK,
    })}>
      <WordCol first width={COLS[0]} lang="DE" word={w.de} sub={"\u00ab" + w.example + "\u00bb"} />
      <WordCol width={COLS[1]} lang="EN" word={w.en} sub={"[" + w.enSay + "]"} />
      <WordCol width={COLS[2]} lang="FR" word={w.fr} sub={"[" + w.frSay + "]"} />
    </div>
  );
}

// --- Das ganze Board ----------------------------------------
export default function Board({ a, b, weather, stamp, stale, days, word, qr }) {
  return (
    <div style={flex({
      flexDirection: "column", width: W, height: H,
      backgroundColor: PAPER, color: INK,
    })}>

      {/* Kopf: Datum links, Wetter rechts. Invertiert wie der
          Fahplan, damit Kopf und rechte Spalte zusammengehoeren */}
      <div style={flex({
        alignItems: "center", justifyContent: "space-between",
        height: H_TOP, flexShrink: 0, paddingLeft: 16, paddingRight: 16,
        backgroundColor: INK, color: PAPER,
      })}>
        <div style={flex({
          alignItems: "baseline", fontFamily: NUMS, fontWeight: 800, fontSize: 20, color: PAPER,
        })}>
          {stamp}
          {stale ? (
            <div style={flex({
              marginLeft: 10, fontFamily: SANS, fontWeight: 700, fontSize: 15, color: MID_DARK,
            })}>alte Daten</div>
          ) : null}
        </div>

        {weather ? (
          <div style={flex({ alignItems: "baseline" })}>
            <div style={flex({ fontFamily: NUMS, fontWeight: 800, fontSize: 22 })}>{weather.temp + "°"}</div>
            <div style={flex({ marginLeft: 9, fontFamily: SANS, fontWeight: 600, fontSize: 18, color: PAPER })}>{weather.cond}</div>
            <div style={flex({ marginLeft: 9, fontFamily: NUMS, fontWeight: 700, fontSize: 16, color: MID_DARK })}>{weather.min + "/" + weather.max}</div>
          </div>
        ) : <div style={flex({})} />}
      </div>

      <Word w={word} />

      <div style={flex({ flexGrow: 1 })}>
        <Events days={days} qr={qr} />
        <Transit a={a} b={b} />
      </div>
    </div>
  );
}
