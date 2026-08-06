import Board, { W, H } from "./Board";

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
  destA:  process.env.BOARD_DEST_A,
  notDestA: process.env.BOARD_NOTDEST_A,
  labelA: process.env.BOARD_LABEL_A,
  rowsA:  process.env.BOARD_ROWS_A,
  stopB:  process.env.BOARD_STOP_B,
  linesB: process.env.BOARD_LINES_B,
  destB:  process.env.BOARD_DEST_B,
  notDestB: process.env.BOARD_NOTDEST_B,
  labelB: process.env.BOARD_LABEL_B,
  rowsB:  process.env.BOARD_ROWS_B,
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
      dest:  pick("destA", ""),
      notDest: pick("notDestA", ""),
      label: pick("labelA", "Tram"),
      rows:  parseInt(pick("rowsA", "4"), 10) || 4,
    },
    b: {
      stop:  pick("stopB",  "Bottmingen"),
      lines: pick("linesB", ""),
      dest:  pick("destB", ""),
      notDest: pick("notDestB", ""),
      label: pick("labelB", "Bus"),
      rows:  parseInt(pick("rowsB", "3"), 10) || 3,
    },
    lat: parseFloat(pick("lat", "47.52")),
    lon: parseFloat(pick("lon", "7.57")),
  };
}

/* ============================================================
   Schriften
   Feste Adressen statt CSS-Parsen. Die WOFF-Dateien kommen aus
   den offiziellen npm-Paketen von IBM, ausgeliefert ueber zwei
   unabhaengige CDNs. Satori kann TTF, OTF und WOFF, nur WOFF2
   nicht, deshalb bewusst die WOFF-Variante.

   Das Ergebnis bleibt im Modul-Cache, wird also nur beim ersten
   Aufruf nach einem Kaltstart geholt.
   ============================================================ */
const FONT_FILES = [
  { name: "Plex Cond", weight: 500, pkg: "@ibm/plex-sans-condensed@2.0.0", file: "IBMPlexSansCondensed-Medium.woff" },
  { name: "Plex Cond", weight: 700, pkg: "@ibm/plex-sans-condensed@2.0.0", file: "IBMPlexSansCondensed-Bold.woff" },
  { name: "Plex Mono", weight: 500, pkg: "@ibm/plex-mono@2.5.0",           file: "IBMPlexMono-Medium.woff" },
  { name: "Plex Mono", weight: 600, pkg: "@ibm/plex-mono@2.5.0",           file: "IBMPlexMono-SemiBold.woff" },
];

let FONT_CACHE = null;

// Reihenfolge der Quellen: zuerst die Dateien aus public/fonts
// im eigenen Projekt, danach zwei oeffentliche CDNs als Netz.
function sourcesFor(spec, origin) {
  const npmPath = spec.pkg + "/fonts/complete/woff/" + spec.file;
  return [
    origin + "/fonts/" + spec.file,
    "https://cdn.jsdelivr.net/npm/" + npmPath,
    "https://unpkg.com/" + npmPath,
  ];
}

async function loadFont(spec, origin) {
  const fehler = [];
  for (const src of sourcesFor(spec, origin)) {
    try {
      const res = await fetch(src);
      if (!res.ok) { fehler.push(src + " -> " + res.status); continue; }
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1000) { fehler.push(src + " -> zu klein"); continue; }
      return { name: spec.name, data: buf, weight: spec.weight, style: "normal" };
    } catch (e) {
      fehler.push(src + " -> " + e.message);
    }
  }
  throw new Error("Schrift nicht ladbar: " + spec.file + "\n  " + fehler.join("\n  "));
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

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function stampFrom(offsetMin) {
  const d = new Date(Date.now() + offsetMin * 60000);
  const p = n => String(n).padStart(2, "0");
  return WEEKDAYS[d.getUTCDay()] + " " + p(d.getUTCDate()) + "." + p(d.getUTCMonth() + 1)
       + "  " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
}

/* ============================================================
   Abfahrten
   ============================================================ */
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

  const results = await Promise.allSettled([
    departures(cfg.a),
    departures(cfg.b),
    weather(cfg.lat, cfg.lon),
  ]);

  if (results[0].status === "fulfilled") a = results[0].value; else stale = true;
  if (results[1].status === "fulfilled") b = results[1].value; else stale = true;
  if (results[2].status === "fulfilled") wx = results[2].value;

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
