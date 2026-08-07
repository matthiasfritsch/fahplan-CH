import Board, { W, H, setInvert } from "./Board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================
   Konfiguration
   Reihenfolge: URL-Parameter schlaegt Umgebungsvariable
   schlaegt Voreinstellung.

   Achtung: process.env muss statisch geschrieben stehen, also
   process.env.BOARD_STOP_A und nicht process.env[name]. Beim
   Bauen werden diese Stellen durch die Werte ersetzt, ein
   berechneter Schluessel findet nichts mehr.
   ============================================================ */
const ENV = {
  stopA:  process.env.BOARD_STOP_A,
  linesA: process.env.BOARD_LINES_A,
  toA:    process.env.BOARD_TO_A,
  destA:  process.env.BOARD_DEST_A,
  notDestA: process.env.BOARD_NOTDEST_A,
  labelA: process.env.BOARD_LABEL_A,
  rowsA:  process.env.BOARD_ROWS_A,
  stopB:  process.env.BOARD_STOP_B,
  linesB: process.env.BOARD_LINES_B,
  toB:    process.env.BOARD_TO_B,
  destB:  process.env.BOARD_DEST_B,
  notDestB: process.env.BOARD_NOTDEST_B,
  labelB: process.env.BOARD_LABEL_B,
  rowsB:  process.env.BOARD_ROWS_B,
  invert: process.env.BOARD_INVERT,
  eta:    process.env.BOARD_ETA,
  lat:    process.env.BOARD_LAT,
  lon:    process.env.BOARD_LON,
};

function conf(url) {
  const q = url.searchParams;
  const pick = (key, fallback) => {
    const fromUrl = q.get(key);
    if (fromUrl !== null && fromUrl !== "") return fromUrl;
    const fromEnv = ENV[key];
    if (fromEnv !== undefined && fromEnv !== "") return fromEnv;
    return fallback;
  };

  return {
    a: {
      stop:  pick("stopA",  "Bottmingen"),
      lines: pick("linesA", ""),
      to:    pick("toA", ""),
      dest:  pick("destA", ""),
      notDest: pick("notDestA", ""),
      label: pick("labelA", "Tram"),
      rows:  parseInt(pick("rowsA", "4"), 10) || 4,
    },
    b: {
      stop:  pick("stopB",  "Bottmingen"),
      lines: pick("linesB", ""),
      to:    pick("toB", ""),
      dest:  pick("destB", ""),
      notDest: pick("notDestB", ""),
      label: pick("labelB", "Bus"),
      rows:  parseInt(pick("rowsB", "3"), 10) || 3,
    },
    invert: pick("invert", "0") === "1",
    eta: pick("eta", "auto"),
    lat: parseFloat(pick("lat", "47.52")),
    lon: parseFloat(pick("lon", "7.57")),
  };
}

/* ============================================================
   Schriften
   Inter fuer Text, JetBrains Mono fuer alle Ziffern. Beide haben
   eine grosse x-Hoehe und kraeftige Stamme, was auf 1 Bit ohne
   Graustufen entscheidend ist. Die Dateien liegen in
   public/fonts, es wird nichts von fremden Servern geholt.

   Satori kann TTF, OTF und WOFF, aber kein WOFF2.
   Das Ergebnis bleibt im Modul-Cache.
   ============================================================ */
const FONT_FILES = [
  { name: "Board Sans", weight: 600, file: "Inter-600.woff" },
  { name: "Board Sans", weight: 700, file: "Inter-700.woff" },
  { name: "Board Nums", weight: 700, file: "JetBrainsMono-700.woff" },
  { name: "Board Nums", weight: 800, file: "JetBrainsMono-800.woff" },
];

let FONT_CACHE = null;

async function loadFont(spec, origin) {
  const res = await fetch(origin + "/fonts/" + spec.file);
  if (!res.ok) throw new Error("Schrift " + spec.file + " -> HTTP " + res.status);
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 1000) throw new Error("Schrift " + spec.file + " zu klein");
  return { name: spec.name, data: buf, weight: spec.weight, style: "normal" };
}

async function fonts(origin) {
  if (FONT_CACHE) return FONT_CACHE;
  FONT_CACHE = await Promise.all(FONT_FILES.map(f => loadFont(f, origin)));
  return FONT_CACHE;
}

/* ============================================================
   Zeit ohne Zeitzonen-Akrobatik
   Die Transport-API liefert ISO-Strings mit Offset, zum
   Beispiel 2026-07-30T07:17:00+0200. Die Stunden und Minuten
   darin sind bereits Schweizer Ortszeit. Wir schneiden sie
   einfach heraus, statt umzurechnen. Den Offset merken wir
   uns fuer die Uhr im Kopf, damit die Sommerzeit von selbst
   stimmt.
   ============================================================ */
function hhmm(iso) {
  return typeof iso === "string" && iso.length >= 16 ? iso.slice(11, 16) : "";
}

function offsetMinutes(iso) {
  const m = typeof iso === "string" ? iso.match(/([+-])(\d{2}):?(\d{2})$/) : null;
  if (!m) return 120;                       // Sommerzeit als Notnagel
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

/* Stosszeit: werktags 7 bis 9 Uhr. Nur dann laeuft das Geraet im
   Minutentakt, also nur dann ist ein Countdown ehrlich. */
function istStosszeit(offsetMin) {
  const d = new Date(Date.now() + offsetMin * 60000);
  const wt = d.getUTCDay();                    // 0 = Sonntag
  const werktag = wt >= 1 && wt <= 5;
  const std = d.getUTCHours();
  return werktag && std >= 7 && std < 9;
}

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch",
                  "Donnerstag", "Freitag", "Samstag"];

function stampFrom(offsetMin) {
  const d = new Date(Date.now() + offsetMin * 60000);
  const p = n => String(n).padStart(2, "0");
  return WEEKDAYS[d.getUTCDay()]
       + "  |  " + p(d.getUTCDate()) + "." + p(d.getUTCMonth() + 1) + "." + d.getUTCFullYear()
       + "  |  " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
}

/* ============================================================
   Abfahrten
   ============================================================ */
/* ============================================================
   Variante mit Ziel: /v1/connections
   Liefert Abfahrt UND Ankunft in einem Aufruf und filtert die
   Fahrtrichtung automatisch, weil nur Fahrten zurueckkommen,
   die das Ziel wirklich erreichen. Deshalb braucht es hier
   keine Ausschlusslisten mehr.
   ============================================================ */
async function connections(block) {
  const url = "https://transport.opendata.ch/v1/connections"
            + "?from=" + encodeURIComponent(block.stop)
            + "&to=" + encodeURIComponent(block.to)
            + "&direct=1&limit=12";

  const res = await fetch(url);
  if (!res.ok) throw new Error("Connections-API " + res.status);
  const json = await res.json();

  // Nur Ziffern vergleichen. Die API liefert je nach Kurs mal
  // "10", mal "T 10", mal gar keine Nummer im Journey-Objekt.
  const nur = (v) => String(v || "").replace(/[^0-9]/g, "");
  const wanted = block.lines.split(",").map(x => nur(x)).filter(Boolean);

  const now = Date.now();
  let offset = null;
  const roh = [];

  const list = (json.connections || []).map(c => {
    const f = c.from || {}, t = c.to || {};
    const sched = f.departure || null;
    if (!sched) return null;
    if (offset === null) offset = offsetMinutes(sched);

    // direct=1 wird von der API nicht zuverlaessig beachtet,
    // deshalb Umstiege hier selbst aussortieren.
    const umstiege = typeof c.transfers === "number" ? c.transfers : 0;

    // Ersten Abschnitt nehmen, der wirklich eine Fahrt ist.
    // Fussweg-Abschnitte haben kein journey-Objekt.
    const sec = (c.sections || []).find(x => x && x.journey) || {};
    const jr  = sec.journey || {};

    const linieRoh = jr.number || jr.name || (c.products || [])[0] || "";
    const line = nur(linieRoh);

    const prog = (f.prognosis && f.prognosis.departure) || null;
    const real = prog || sched;
    const realMs  = f.departureTimestamp ? f.departureTimestamp * 1000 : Date.parse(real);
    const schedMs = Date.parse(sched);
    const delay = prog ? Math.round((Date.parse(prog) - schedMs) / 60000)
                       : (typeof f.delay === "number" ? f.delay : 0);

    const arrProg = (t.prognosis && t.prognosis.arrival) || null;
    const arrival = arrProg || t.arrival || null;

    const eta = Math.round((realMs - now) / 60000);

    roh.push({ linieRoh: String(linieRoh), line, umstiege, eta, ziel: jr.to || "" });

    return {
      line,
      dest: (jr.to || "").trim(),
      delay: delay > 0 ? delay : 0,
      schedText: hhmm(sched),
      timeText: hhmm(real),
      arrText: hhmm(arrival),
      eta,
      etaText: eta <= 0 ? "jetzt" : eta + " min",
      realMs,
      umstiege,
    };
  })
  .filter(Boolean)
  .filter(d => d.eta >= 0)
  .filter(d => d.umstiege === 0)
  .filter(d => !wanted.length || wanted.includes(d.line))
  .sort((x, y) => x.realMs - y.realMs)
  .slice(0, block.rows);

  return {
    list,
    offset: offset === null ? 120 : offset,
    // Fuer ?debug=1: was die API wirklich verstanden und
    // geliefert hat. Erspart Raten bei falschen Haltestellen.
    diag: {
      erkanntVon: (json.from && json.from.name) || null,
      erkanntNach: (json.to && json.to.name) || null,
      gefunden: (json.connections || []).length,
      gefiltertAuf: list.length,
      linienFilter: wanted,
      roh: roh.slice(0, 8),
    },
  };
}

async function departures(block) {
  const limit = Math.min(40, block.rows + 14);
  const url = "https://transport.opendata.ch/v1/stationboard"
            + "?station=" + encodeURIComponent(block.stop)
            + "&limit=" + limit;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Transport-API " + res.status);
  const json = await res.json();

  const wanted = block.lines.split(",").map(s => s.trim()).filter(Boolean);

  // Fahrtrichtung ueber das Endziel. Kleinschreibung und
  // Teilstring, damit "basel" auch "Basel, MParc" trifft.
  const liste = (v) => String(v || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  const nur   = liste(block.dest);
  const ohne  = liste(block.notDest);
  const passt = (ziel) => {
    const z = String(ziel || "").toLowerCase();
    if (nur.length  && !nur.some(n => z.includes(n)))  return false;
    if (ohne.length &&  ohne.some(n => z.includes(n))) return false;
    return true;
  };
  const now = Date.now();
  let offset = null;

  const list = (json.stationboard || []).map(t => {
    const stop  = t.stop || {};
    const sched = stop.departure || null;
    const prog  = (stop.prognosis && stop.prognosis.departure) || null;
    const real  = prog || sched;
    if (!real) return null;

    if (offset === null) offset = offsetMinutes(real);

    // departureTimestamp ist Unix-Sekunden und damit eindeutig.
    const realMs  = stop.departureTimestamp ? stop.departureTimestamp * 1000 : Date.parse(real);
    const schedMs = sched ? Date.parse(sched) : null;
    const delay   = (prog && schedMs) ? Math.round((Date.parse(prog) - schedMs) / 60000) : 0;
    const eta     = Math.round((realMs - now) / 60000);

    return {
      line: String(t.number || t.name || "").trim(),
      dest: t.to || "",
      delay: delay > 0 ? delay : 0,
      schedText: hhmm(sched),
      timeText: hhmm(real),
      arrText: "",
      eta,
      etaText: eta <= 0 ? "jetzt" : eta + " min",
      realMs,
    };
  })
  .filter(Boolean)
  .filter(d => d.eta >= 0)
  .filter(d => !wanted.length || wanted.includes(d.line))
  .filter(d => passt(d.dest))
  .sort((x, y) => x.realMs - y.realMs)
  .slice(0, block.rows);

  return { list, offset: offset === null ? 120 : offset };
}

/* ============================================================
   Wetter
   ============================================================ */
const WMO = {
  0: "klar", 1: "heiter", 2: "bewoelkt", 3: "bedeckt",
  45: "Nebel", 48: "Reifnebel",
  51: "Niesel", 53: "Niesel", 55: "Niesel",
  56: "Glatteis", 57: "Glatteis",
  61: "Regen", 63: "Regen", 65: "Starkregen",
  66: "Glatteis", 67: "Glatteis",
  71: "Schnee", 73: "Schnee", 75: "Schneefall",
  77: "Graupel",
  80: "Schauer", 81: "Schauer", 82: "Starkschauer",
  85: "Schneeschauer", 86: "Schneeschauer",
  95: "Gewitter", 96: "Hagel", 99: "Hagel",
};

async function weather(lat, lon) {
  const url = "https://api.open-meteo.com/v1/forecast"
            + "?latitude=" + lat + "&longitude=" + lon
            + "&current=temperature_2m,weather_code"
            + "&daily=temperature_2m_max,temperature_2m_min"
            + "&timezone=Europe%2FZurich&forecast_days=1";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Open-Meteo " + res.status);
  const j = await res.json();
  return {
    temp: Math.round(j.current.temperature_2m),
    cond: WMO[j.current.weather_code] || "",
    max: Math.round(j.daily.temperature_2m_max[0]),
    min: Math.round(j.daily.temperature_2m_min[0]),
  };
}

/* ============================================================
   Route
   ============================================================ */
export async function GET(request) {
  try {
    return await handle(request);
  } catch (err) {
    // Ein nackter 500er sagt nichts. Lieber Klartext, dann
    // steht die Ursache direkt im Browser.
    return new Response(
      "Board-Fehler: " + (err && err.message ? err.message : String(err)) +
      "\n\n" + (err && err.stack ? err.stack : ""),
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }
}

async function handle(request) {
  const url = new URL(request.url);

  // Stufe 1 der Diagnose: antwortet, sobald das Modul ueberhaupt
  // geladen werden konnte. Braucht weder Netz noch Schriften.
  if (url.searchParams.get("ping") === "1") {
    return new Response("ok, Modul geladen, Runtime " + (process.release ? "node" : "edge"),
      { headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  // Stufe 2 der Diagnose: nur die Schriften, ohne Daten und
  // ohne Rendern. Sagt dir genau, welche Datei zickt.
  if (url.searchParams.get("fonts") === "1") {
    const f = await fonts(url.origin);
    return new Response(
      "ok, " + f.length + " Schriften geladen\n" +
      f.map(x => x.name + " " + x.weight + ": " + x.data.byteLength + " Bytes").join("\n"),
      { headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  const cfg = conf(url);

  // Faellt eine Quelle aus, wird das Board trotzdem gezeichnet
  // und im Kopf als alt markiert. Ein 500er wuerde beim Geraet
  // nur ein leeres Panel hinterlassen, das ist schlechter.
  let a = { list: [], offset: 120 }, b = { list: [], offset: 120 };
  let wx = null, stale = false;

  // Demo-Modus: feste Beispieldaten, kein Netz. Praktisch zum
  // Layout beurteilen, wenn nachts nichts faehrt.
  if (url.searchParams.get("demo") === "1") {
    const mk = (line, dest, delay, hh, mm, eta, arr) => ({
      line, dest, delay,
      schedText: hh + ":" + String(mm).padStart(2, "0"),
      timeText: hh + ":" + String(mm + delay).padStart(2, "0"),
      arrText: arr || "",
      eta, etaText: eta <= 0 ? "jetzt" : eta + " min",
    });
    a = { list: [
      mk("10", "Dornach, Bahnhof", 1, "07", 16, 2, "07:38"),
      mk("17", "Basel, Wiesenplatz", 0, "07", 19, 4, "07:41"),
      mk("10", "Basel, Bahnhof SBB", 0, "07", 24, 9, "07:46"),
      mk("17", "Basel, MParc", 3, "07", 26, 14, "07:51"),
    ], offset: 120 };
    b = { list: [
      mk("47", "Muttenz, Bahnhof", 0, "07", 21, 6, "07:33"),
      mk("47", "Muttenz, Bahnhof", 2, "07", 33, 20, "07:47"),
      mk("47", "Muttenz, Bahnhof", 0, "07", 45, 0, "07:57"),
    ], offset: 120 };
    wx = { temp: 21, cond: "heiter", min: 14, max: 27 };
  } else {

  const hole = async (blk) => {
    if (!blk.to) return departures(blk);
    const r = await connections(blk);
    if (r.list.length) return r;
    // Nichts uebrig? Lieber Abfahrten ohne Ankunftszeit zeigen
    // als eine leere Tafel. Die Diagnose bleibt erhalten.
    const fb = await departures(blk);
    return { ...fb, diag: { ...r.diag, hinweis: "leer, Abfahrtstafel als Rueckfall" } };
  };

  const results = await Promise.allSettled([
    hole(cfg.a),
    hole(cfg.b),
    weather(cfg.lat, cfg.lon),
  ]);

  if (results[0].status === "fulfilled") a = results[0].value; else stale = true;
  if (results[1].status === "fulfilled") b = results[1].value; else stale = true;
  if (results[2].status === "fulfilled") wx = results[2].value;
  }

  const offset = a.offset ?? b.offset ?? 120;

  if (url.searchParams.get("debug") === "1") {
    return new Response(
      JSON.stringify({ cfg, a, b, wx, stale, stamp: stampFrom(offset) }, null, 2),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  // next/og erst hier laden. Als Top-Level-Import reisst ein
  // Fehler beim Initialisieren das ganze Modul mit, dann greift
  // kein try-catch mehr und du siehst nur einen nackten 500er.
  const { ImageResponse } = await import("next/og");

  // Farben vor dem Rendern festlegen
  setInvert(cfg.invert);

  // Countdown nur zeigen, wenn auch im Minutentakt aktualisiert
  // wird. "auto" entscheidet nach Uhrzeit, 1 und 0 erzwingen.
  const zeigeEta = cfg.eta === "1" ? true
                 : cfg.eta === "0" ? false
                 : istStosszeit(offset);

  // WICHTIG: ImageResponse streamt das PNG und schickt dabei kein
  // Content-Length. Manche Clients, darunter ESPHome, lesen genau
  // dieses Feld und laden sonst 0 Bytes. Deshalb das Bild komplett
  // in den Speicher holen und mit gesetzter Laenge ausliefern.
  const img = new ImageResponse(
    (
      <Board
        a={{ ...cfg.a, list: a.list }}
        b={{ ...cfg.b, list: b.list }}
        weather={wx}
        stamp={stampFrom(offset)}
        stale={stale}
        eta={zeigeEta}
      />
    ),
    { width: W, height: H, fonts: await fonts(url.origin) }
  );

  const bytes = await img.arrayBuffer();

  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "content-length": String(bytes.byteLength),
      "accept-ranges": "none",
      "cache-control": "public, s-maxage=45, stale-while-revalidate=120",
    },
  });
}
