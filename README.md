# Fahrplan-Board

Rendert ein 800 x 480 PNG mit zwei Haltestellen und Wetter, fertig zum
Abholen durch den reTerminal E1001. Laeuft auf Vercel Hobby, also
dauerhaft kostenlos, und braucht keinen Browser zum Rendern.

## Was wo liegt

| Datei | Wofuer |
|---|---|
| `app/api/board/Board.jsx` | Das Layout. Die einzige Datei, die du zum Umgestalten anfassen musst. |
| `app/api/board/route.jsx` | Daten holen, Schriften laden, PNG ausliefern. |
| `app/page.jsx` | Bedienseite im Browser: Haltestellen suchen, Vorschau, Geraete-URL. |

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
BOARD_STOP_A    Bottmingen, Schloss
BOARD_LINES_A   10, 17
BOARD_LABEL_A   Tram
BOARD_ROWS_A    4

BOARD_STOP_B    Binningen, Kronenplatz
BOARD_LINES_B   34, 47
BOARD_LABEL_B   Bus
BOARD_ROWS_B    3

BOARD_LAT       47.52
BOARD_LON       7.57
```

Alles laesst sich auch per URL ueberschreiben, praktisch zum Ausprobieren:
`/api/board?stopA=...&linesA=10,17&rowsA=5`

`/api/board?debug=1` liefert statt des Bildes die Rohdaten als JSON.
Erste Anlaufstelle, wenn eine Zeile fehlt oder komisch aussieht.

## Layout aendern

Alles Wichtige steht oben in `Board.jsx` als Konstanten: Seitenrand,
Kopfhoehe, Balkenhoehe, Spaltenbreiten, Farben. Die Zeilenhoehe rechnet
sich aus der uebrigen Hoehe und der Anzahl Zeilen selbst aus, du kannst
also 4 plus 3 oder 5 plus 2 fahren, ohne Zahlen nachzuziehen.

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
