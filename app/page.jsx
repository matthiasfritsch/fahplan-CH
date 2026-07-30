"use client";

import { useEffect, useState } from "react";

/* Kleine Bedienseite: Haltestellen suchen, Vorschau ansehen,
   fertige URL fuers Geraet kopieren. Laeuft nur im Browser
   und hat mit dem gerenderten Board nichts zu tun. */

const box = {
  background: "#fff", border: "1px solid #cfcfcd", borderRadius: 6,
  padding: "16px 18px",
};
const label = {
  fontSize: 11, fontWeight: 600, letterSpacing: ".06em",
  textTransform: "uppercase", color: "#666", display: "block", marginBottom: 5,
};
const input = {
  font: "inherit", fontSize: 14, padding: "7px 9px", width: "100%",
  border: "1px solid #bbb", borderRadius: 4, boxSizing: "border-box",
};

function StopPicker({ title, value, onChange, lines, onLines, rows, onRows, kind, onKind, notDest, onNotDest }) {
  const [hits, setHits] = useState([]);
  const [open, setOpen] = useState(false);

  async function search(q) {
    if (q.trim().length < 2) { setOpen(false); return; }
    try {
      const r = await fetch(
        "https://transport.opendata.ch/v1/locations?type=station&query=" + encodeURIComponent(q)
      );
      const j = await r.json();
      setHits((j.stations || []).filter(s => s.name).slice(0, 10));
      setOpen(true);
    } catch { setOpen(false); }
  }

  return (
    <div style={{ ...box, position: "relative" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{title}</div>

      <label style={label}>Haltestelle</label>
      <input
        style={input} value={value} placeholder="tippen und auswaehlen"
        onChange={(e) => { onChange(e.target.value); search(e.target.value); }}
      />
      {open && hits.length > 0 && (
        <div style={{
          position: "absolute", zIndex: 5, left: 18, right: 18,
          background: "#fff", border: "1px solid #bbb", maxHeight: 200, overflow: "auto",
        }}>
          {hits.map((s) => (
            <button
              key={s.id || s.name}
              onClick={() => { onChange(s.name); setOpen(false); }}
              style={{
                display: "block", width: "100%", textAlign: "left", font: "inherit",
                fontSize: 13, padding: "7px 9px", border: 0,
                borderBottom: "1px solid #eee", background: "#fff", cursor: "pointer",
              }}
            >{s.name}</button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <label style={label}>Gegenrichtung ausblenden</label>
        <input style={input} value={notDest} placeholder="Rodersdorf, Ettingen"
          onChange={(e) => onNotDest(e.target.value)} />
        <span style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>
          Endziele der Richtung, die du nicht sehen willst.
        </span>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <div style={{ flex: 2 }}>
          <label style={label}>Nur diese Linien</label>
          <input style={input} value={lines} placeholder="10, 17"
            onChange={(e) => onLines(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>Beschriftung</label>
          <input style={input} value={kind} onChange={(e) => onKind(e.target.value)} />
        </div>
        <div style={{ width: 70 }}>
          <label style={label}>Zeilen</label>
          <input style={input} type="number" min="1" max="8" value={rows}
            onChange={(e) => onRows(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [a, setA] = useState({ stop: "", lines: "", rows: "4", label: "Tram", notDest: "" });
  const [b, setB] = useState({ stop: "", lines: "", rows: "3", label: "Bus", notDest: "" });
  const [coords, setCoords] = useState("47.52, 7.57");
  const [bust, setBust] = useState(0);

  const [lat, lon] = coords.split(",").map(s => parseFloat(s.trim()));

  const query = new URLSearchParams({
    stopA: a.stop, linesA: a.lines, rowsA: a.rows, labelA: a.label, notDestA: a.notDest,
    stopB: b.stop, linesB: b.lines, rowsB: b.rows, labelB: b.label, notDestB: b.notDest,
    lat: isNaN(lat) ? "47.52" : String(lat),
    lon: isNaN(lon) ? "7.57" : String(lon),
  }).toString();

  const path = "/api/board?" + query;
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  // Vorschau alle 30 Sekunden neu ziehen
  useEffect(() => {
    const t = setInterval(() => setBust(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 32 }}>
      <h1 style={{ fontSize: 17, margin: "0 0 4px" }}>Fahrplan-Board</h1>
      <p style={{ fontSize: 13, color: "#555", margin: "0 0 22px", lineHeight: 1.5 }}>
        Zwei Haltestellen waehlen, Vorschau pruefen, URL unten ins Geraet uebernehmen.
        Die Vorschau ist dasselbe PNG, das der reTerminal spaeter laedt.
      </p>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
        <StopPicker
          title="Block 1, oben"
          value={a.stop} onChange={(v) => setA({ ...a, stop: v })}
          lines={a.lines} onLines={(v) => setA({ ...a, lines: v })}
          rows={a.rows} onRows={(v) => setA({ ...a, rows: v })}
          kind={a.label} onKind={(v) => setA({ ...a, label: v })}
          notDest={a.notDest} onNotDest={(v) => setA({ ...a, notDest: v })}
        />
        <StopPicker
          title="Block 2, unten"
          value={b.stop} onChange={(v) => setB({ ...b, stop: v })}
          lines={b.lines} onLines={(v) => setB({ ...b, lines: v })}
          rows={b.rows} onRows={(v) => setB({ ...b, rows: v })}
          kind={b.label} onKind={(v) => setB({ ...b, label: v })}
          notDest={b.notDest} onNotDest={(v) => setB({ ...b, notDest: v })}
        />
      </div>

      <div style={{ ...box, marginTop: 14 }}>
        <label style={label}>Wetter-Koordinaten (Lat, Lon)</label>
        <input style={{ ...input, maxWidth: 220 }} value={coords}
          onChange={(e) => setCoords(e.target.value)} />
      </div>

      <div style={{ margin: "26px 0 10px", display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={() => setBust(Date.now())}
          style={{
            font: "inherit", fontSize: 13, fontWeight: 500, padding: "7px 14px",
            border: "1px solid #000", background: "#000", color: "#fff",
            borderRadius: 4, cursor: "pointer",
          }}
        >Vorschau neu laden</button>
        <span style={{ fontSize: 12, color: "#777" }}>aktualisiert sich alle 30 s von selbst</span>
      </div>

      <img
        src={path + "&_=" + bust}
        alt="Vorschau"
        width={800} height={480}
        style={{ display: "block", boxShadow: "0 2px 24px rgba(0,0,0,.18)", background: "#fff" }}
      />

      <div style={{ ...box, marginTop: 22 }}>
        <label style={label}>URL fuers Geraet</label>
        <code style={{
          display: "block", fontSize: 12, wordBreak: "break-all",
          background: "#f6f6f4", padding: 10, borderRadius: 4, lineHeight: 1.5,
        }}>{origin + path}</code>
        <p style={{ fontSize: 12, color: "#777", margin: "10px 0 0", lineHeight: 1.5 }}>
          Wenn du dieselben Werte als Umgebungsvariablen in Vercel hinterlegst
          (BOARD_STOP_A, BOARD_LINES_A und so weiter), reicht dem Geraet
          spaeter der nackte Pfad /api/board.
        </p>
      </div>
    </main>
  );
}
