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
  labelA: process.env.BOARD_LABEL_A,
  rowsA:  process.env.BOARD_ROWS_A,
  stopB:  process.env.BOARD_STOP_B,
  linesB: process.env.BOARD_LINES_B,
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
      label: pick("labelA", "Tram"),
      rows:  parseInt(pick("rowsA", "4"), 10) || 4,
    },
    b: {
      stop:  pick("stopB",  "Bottmingen"),
      lines: pick("linesB", ""),
      label: pick("labelB", "Bus"),
      rows:  parseInt(pick("rowsB", "3"), 10) || 3,
    },
    lat: parseFloat(pick("lat", "47.52")),
    lon: parseFloat(pick("lon", "7.57")),
  };
}

/* ============================================================
   Schriften
   Google Fonts liefert TTF statt WOFF2, wenn man sich als
   alter Browser ausgibt. Satori kann kein WOFF2, deshalb der
   Umweg. Das Ergebnis bleibt im Modul-Cache, wird also nur
   beim ersten Aufruf nach einem Kaltstart geholt.
   ============================================================ */
const OLD_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/25.0.1364.97 Safari/537.36";

let FONT_CACHE = null;

async function ttf(family, weight) {
  const cssUrl =
    "https://fonts.googleapis.com/css2?family=" +
    encodeURIComponent(family) + ":wght@" + weight;
  const css = await fetch(cssUrl, { headers: { "User-Agent": OLD_UA } }).then(r => r.text());
  const m = css.match(/src:\s*url\((https:\/\/[^)]+\.ttf)\)/);
  if (!m) throw new Error("Keine TTF-Quelle fuer " + family + " " + weight);
  const res = await fetch(m[1]);
  return res.arrayBuffer();
}

async function fonts() {
  if (FONT_CACHE) return FONT_CACHE;
  const [c5, c7, m5, m6] = await Promise.all([
    ttf("IBM Plex Sans Condensed", 500),
    ttf("IBM Plex Sans Condensed", 700),
    ttf("IBM Plex Mono", 500),
    ttf("IBM Plex Mono", 600),
  ]);
  FONT_CACHE = [
    { name: "Plex Cond", data: c5, weight: 500, style: "normal" },
    { name: "Plex Cond", data: c7, weight: 700, style: "normal" },
    { name: "Plex Mono", data: m5, weight: 500, style: "normal" },
    { name: "Plex Mono", data: m6, weight: 600, style: "normal" },
  ];
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

  return new ImageResponse(
    (
      <Board
        a={{ ...cfg.a, list: a.list }}
        b={{ ...cfg.b, list: b.list }}
        weather={wx}
        stamp={stampFrom(offset)}
        stale={stale}
      />
    ),
    {
      width: W,
      height: H,
      fonts: await fonts(),
      headers: {
        // Kurz cachen: schuetzt die Transport-API vor Doppelabrufen,
        // ohne dass die Anzeige spuerbar hinterherhinkt.
        "Cache-Control": "public, s-maxage=45, stale-while-revalidate=120",
      },
    }
  );
}
