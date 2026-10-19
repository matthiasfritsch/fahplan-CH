# Fahrplan-Board

Rendert ein 800 x 480 PNG fuer den reTerminal E1001: oben das Wort des
Tages (DE, EN, FR), links Familien-Events in und um Basel mit QR-Code zur
vollen Eventliste, rechts invertiert der Fahrplan fuer zwei Haltestellen. Laeuft auf Vercel Hobby, also
dauerhaft kostenlos, und braucht keinen Browser zum Rendern.

## Was wo liegt

| Datei | Wofuer |
|---|---|
| `app/api/board/Board.jsx` | Das Layout. Die einzige Datei, die du zum Umgestalten anfassen musst. |
| `app/api/board/route.jsx` | Daten holen, Schriften laden, PNG ausliefern. |
| `app/page.jsx` | Bedienseite im Browser: Haltestellen suchen, Vorschau, Geraete-URL. |
| `app/e/page.jsx` | Eventseite hinter dem QR-Code (`/e`): alle Familien-Events der naechsten zwei Wochen mit Links, darunter Jazz, Streetart, Gaming, Anime und Hip-Hop fuer Lisa und Matthias. |
| `lib/content.mjs` | Auswahl von Wort und Events, Zeichenlimits. |
| `data/words.json` | Woerter des Tages, rotieren taeglich. |
| `lib/sources.mjs` | Live-Eventquellen: Schule, Basel-West, Gugu Basel, myBasel, Eventfrog. |
| `lib/events.mjs` | Laedt die Events fuer Board und Eventseite (`/e`). |
| `lib/curate.mjs` | Doppelte zusammenlegen, Kleinkind-Angebote und Dauerangebote filtern, Themen fuer Lisa und Matthias erkennen. |
| `data/events.json` | Optionale handgepflegte Events und Schulferien. |

## Deployen ohne Kommandozeile

1. Ordner als ZIP auf GitHub hochladen, in ein neues Repository.
2. Auf vercel.com mit dem GitHub-Konto anmelden, "Add New Project",
   das Repository auswaehlen, "Deploy" druecken. Voreinstellungen passen.
3. Nach etwa einer Minute die vergebene `.vercel.app` Adresse oeffnen.
   Dort Haltestellen suchen und die Vorschau pruefen.

## Haltestellen dauerhaft hinterlegen

Unsere Haltestellen stehen als Voreinstellung im Code
(`conf()` in `app/api/board/route.jsx`), das Geraet ruft einfach
`/api/board` auf. Zum Aendern entweder dort anpassen oder in Vercel
unter Settings, Environment Variables diese Namen setzen (schlaegt die
Voreinstellung), dann einmal neu deployen:

```
BOARD_STOP_A      Bottmingen, Batteriestrasse
BOARD_LINES_A     10, 17
BOARD_LABEL_A     Tram
BOARD_ROWS_A      4
BOARD_NOTDEST_A   Rodersdorf, Flüh, Ettingen

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

## Wort und Events

Das Wort rotiert nach Datum, jeder Aufruf am selben Tag zeigt
dasselbe. Events holt das Board live auf Vercel aus diesen Quellen
(`lib/sources.mjs`), eine Stunde zwischengespeichert:

| Quelle | Was | Wie |
|---|---|---|
| Rudolf Steiner Schule Basel | Schultermine, Badge SCHULE | iCal-Feed der Schul-Website |
| Stadtteilsekretariat Basel-West | Quartierflohmaerkte, Badge FLOHMARKT | iCal-Feed |
| Gugu Basel (gugubasel.ch) | Kuratierte Wochenendplaene: Workshops, Kindertheater, Kinderdisco, Flohmis | Statische Seite, "Anytime"-Tipps und Kleinkind-Angebote gefiltert, Picks und Angebote ab ca. 7 Jahren zuerst |
| myBasel, Rubrik Kinder | Workshops, Kinderkino, Theater, Mitmach-Aktionen, Kinderflohmis | HTML-Liste, bezahlte "Empfehlungen" gefiltert |
| Eventfrog | Kinder & Familie im Umkreis von 30 km | Public API, braucht `EVENTFROG_API_KEY` (oder `Events`) |
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
Beispielsatz 40, Eventtitel 40, siehe `LIMITS` in `lib/content.mjs`).
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
Balkenhoehe, Hoehe des Wortbands (H_WORD), Breite der linken Seite, Spaltenbreiten,
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

## Das Geraet (E-Paper)

Die Firmware steht in `firmware/fahrplan-board.yaml` (ESPHome, Seeed
reTerminal E1001). GitHub baut sie bei jeder Aenderung automatisch und
legt die fertige Datei hier ab:
https://github.com/matthiasfritsch/fahplan-CH/releases/download/firmware-latest/fahrplan-board.factory.bin

**Neu aufspielen (per USB-Kabel, Chrome oder Edge):**
1. Datei oben herunterladen.
2. https://web.esphome.io oeffnen, E-Paper per USB-C anstecken, **Connect**,
   Anschluss waehlen.
3. **Install** und die heruntergeladene Datei auswaehlen. Warten bis fertig.
4. Danach **Configure Wi-Fi** (falls angeboten), WLAN und Passwort eintragen.

**WLAN-Passwort geaendert:** Das Geraet findet das alte WLAN nicht und
oeffnet nach etwa einer Minute den Hotspot **Fahrplan-Board** (Passwort
`fahrplan-hilfe`). Handy verbinden, Seite `192.168.4.1` oeffnen, Heim-WLAN
waehlen, neues Passwort eintragen. Kein Kabel, kein Flashen noetig.

Das WLAN-Passwort steht bewusst nirgends im Repo, es liegt nur im Geraet.
Takt: Mo bis Fr 6:30 bis 8:30 alle 2 Minuten, sonst alle 15 Minuten.
