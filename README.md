# Fahrplan-Board

Rendert ein 800 x 480 PNG fuer den reTerminal E1001: links Familien-Events
in und um Basel, Wort des Tages (DE, EN, FR) und ein 10-Minuten-Znacht mit
QR-Code zum Rezept, rechts der Fahrplan fuer zwei Haltestellen. Laeuft auf Vercel Hobby, also
dauerhaft kostenlos, und braucht keinen Browser zum Rendern.

## Was wo liegt

| Datei | Wofuer |
|---|---|
| `app/api/board/Board.jsx` | Das Layout. Die einzige Datei, die du zum Umgestalten anfassen musst. |
| `app/api/board/route.jsx` | Daten holen, Schriften laden, PNG ausliefern. |
| `app/page.jsx` | Bedienseite im Browser: Haltestellen suchen, Vorschau, Geraete-URL. |
| `app/r/[id]/page.jsx` | Rezeptseite hinter dem QR-Code, z.B. `/r/gnocchi`. |
| `lib/content.mjs` | Auswahl von Wort, Znacht und Events, Zeichenlimits. |
| `data/words.json` | Woerter des Tages, rotieren taeglich. |
| `data/dinners.json` | 10-Minuten-Gerichte mit Zutaten und Schritten. |
| `lib/sources.mjs` | Live-Eventquellen: Schule, Basel-West, Eventfrog. |
| `data/events.json` | Optionale handgepflegte Events und Schulferien. |
| `data/ideas.json` | Rueckfall, wenn keine Events da sind. |

## Deployen ohne Kommandozeile

1. Ordner als ZIP auf GitHub hochladen, in ein neues Repository.
2. Auf vercel.com mit dem GitHub-Konto anmelden, "Add New Project",
   das Repository auswaehlen, "Deploy" druecken. Voreinstellungen passen.
3. Nach etwa einer Minute die vergebene `.vercel.app` Adresse oeffnen.
   Dort Haltestellen suchen und die Vorschau pruefen.

## Haltestellen dauerhaft hinterlegen

In Vercel unter Settings, Environment Variables eintragen, dann einmal
neu deployen. Danach reicht dem Geraet der nackte Pfad `/api/board`.

```
BOARD_STOP_A      Bottmingen, Batteriestrasse
BOARD_LINES_A     10, 17
BOARD_LABEL_A     Tram
BOARD_ROWS_A      4
BOARD_NOTDEST_A   Rodersdorf, Ettingen

BOARD_STOP_B      Bottmingen, Bodenackerstrasse
BOARD_LINES_B     47
BOARD_LABEL_B     Bus
BOARD_ROWS_B      3
BOARD_NOTDEST_B   Schloss

BOARD_LAT       47.52
BOARD_LON       7.57
```

Alles laesst sich auch per URL ueberschreiben, praktisch zum Ausprobieren:
`/api/board?stopA=...&linesA=10,17&rowsA=5`

## Linke Seite

Wort und Znacht rotieren nach Datum, jeder Aufruf am selben Tag zeigt
dasselbe. Events holt das Board live auf Vercel aus diesen Quellen
(`lib/sources.mjs`), eine Stunde zwischengespeichert:

| Quelle | Was | Wie |
|---|---|---|
| Rudolf Steiner Schule Basel | Schultermine, Badge SCHULE | iCal-Feed der Schul-Website |
| Stadtteilsekretariat Basel-West | Quartierflohmaerkte, Badge FLOHMARKT | iCal-Feed |
| Eventfrog | Kinder & Familie im Umkreis von 30 km | Public API, braucht `EVENTFROG_API_KEY` |
| `data/events.json` | Handgepflegte Zusatz-Events (optional) | Datei im Repo |

Angezeigt wird heute bis Sonntag: unter der Woche ein Event pro Tag,
Wochenende und Schulferien bekommen mehr Platz. Schultermine und
Flohmaerkte haben Vorrang. Events ausserhalb von etwa 9 km tragen ein
Badge mit Ort und Distanz. Faellt eine Quelle aus, fehlen nur deren
Events. `/api/board?debug=1` zeigt unter `sourceReport`, wie viele
Events jede Quelle geliefert hat.

`EVENTFROG_API_KEY` gehoert nur in die Vercel-Umgebungsvariablen, nie
ins Repo (das Repo ist oeffentlich).

`BOARD_PUBLIC_URL` setzt die Adresse im QR-Code, zum Beispiel
`https://mein-board.vercel.app`. Ohne Angabe nimmt das Board die
Adresse, unter der es aufgerufen wurde.

Die Layout-Flaechen sind fix, deshalb gelten Zeichenlimits (Wort 20,
Gericht 30, Eventtitel 40, siehe `LIMITS` in `lib/content.mjs`).
`npm run check` prueft alle Listen und laeuft vor jedem Build
automatisch. Ein zu langer Eintrag bricht den Deploy ab, statt auf dem
Geraet abgeschnitten zu werden.

Zum Testen: `/api/board?demo=1&date=2026-09-26&time=09:00` spielt
einen beliebigen Tag mit Beispiel-Events durch.

## Fahrtrichtung

Die API kennt kein Richtungsfeld, wohl aber das Endziel jeder Fahrt.
Darueber wird gefiltert, mit Teilstring und ohne Ruecksicht auf
Gross- und Kleinschreibung.

- `BOARD_NOTDEST_A` bzw. `notDestA` blendet Ziele aus. Robuster,
  weil die Gegenrichtung wenige feste Endpunkte hat.
- `BOARD_DEST_A` bzw. `destA` laesst nur genannte Ziele durch.
  Sproeder, weil Kurzwenden Richtung Stadt sonst wegfallen.

Beide Listen werden an Kommas getrennt. Volle Haltestellennamen mit
Komma zerfallen dadurch in zwei Begriffe, was meistens trotzdem
passt. Im Zweifel ein einzelnes eindeutiges Wort nehmen, also
`Schloss` statt `Bottmingen, Schloss`.

`/api/board?debug=1` liefert statt des Bildes die Rohdaten als JSON.
Erste Anlaufstelle, wenn eine Zeile fehlt oder komisch aussieht.

## Layout aendern

Alles Wichtige steht oben in `Board.jsx` als Konstanten: Kopfhoehe,
Balkenhoehe, Hoehe von Wort und Znacht (H_LEARN), Breite der linken Seite, Spaltenbreiten,
Farben. Die Zeilenhoehe im Fahrplan rechnet sich aus der uebrigen Hoehe
und der Anzahl Zeilen selbst aus, du kannst also 4 plus 3 oder 5 plus 2
fahren, ohne Zahlen nachzuziehen. Wer H_LEARN
aendert, muss `EVENT_BUDGET` in `lib/content.mjs` nachziehen.

Satori, der Renderer, kennt nur einen Teil von CSS. Merksaetze:

- Nur Flexbox. Kein Grid, kein Float.
- Jedes Element mit mehreren Kindern braucht `display: "flex"`.
- Kein `gap`, stattdessen `marginRight`.
- Kein `text-overflow`, deshalb kuerzt `clip()` lange Ziele hart ab.
- Nur TTF, OTF und WOFF als Schrift. Kein WOFF2.

## Datenquellen

Fahrplan von `transport.opendata.ch`, kein Schluessel noetig. Wetter von
Open-Meteo, ebenfalls ohne Schluessel. Faellt eine Quelle aus, wird das
Board trotzdem gezeichnet und im Kopf als "alte Daten" markiert, statt
dem Geraet einen Fehler zu liefern und ein leeres Panel zu hinterlassen.

## Verbrauch im Blick behalten

Vercel Hobby enthaelt vier Stunden Active CPU pro Monat. Ein Render
liegt grob bei einer halben bis einer Sekunde, das reicht fuer etwa 500
bis 900 Abrufe am Tag. Ein Takt von zwei Minuten rund um die Uhr waere
mit 720 Abrufen knapp; sinnvoller ist ein enger Takt nur zur Pendelzeit
und sonst alle 15 bis 20 Minuten. Die Antwort wird 45 Sekunden am Rand
zwischengespeichert, versehentliche Doppelabrufe kosten also nichts.

## Weiter zum Geraet

Im ESPHome-Setup des reTerminal die URL als `online_image` eintragen,
Format PNG, Typ BINARY. Alle 10 bis 20 Aktualisierungen einen vollen
Refresh statt eines Partial Refresh einplanen, sonst bauen sich
Schatten alter Ziffern auf.
