# Event-Routine

Laeuft als Claude-Routine zweimal pro Woche: Montag 05:00 fuer die
Woche, Donnerstag 05:00 als Update fuers Wochenende. Der Prompt unten
ist genau das, was die Routine bekommt.

---

Aktualisiere `data/events.json` im Repository matthiasfritsch/fahplan-ch
(Branch main) mit Familien-Events fuer die Zeit von heute bis
einschliesslich naechsten Sonntag.

Zielgruppe: Familie in Bottmingen bei Basel, Kind ca. 10 Jahre.

Was rein soll:
- Basel und Umgebung (Basel-Stadt, Baselland): Kinder- und
  Familienangebote, Fuehrungen, Workshops, Theater, Kinderkino, Maerkte,
  Feste, Sportevents zum Mitmachen oder Zuschauen.
- Ausfluege bis ca. 1h Fahrzeit mit dem OeV ab Bottmingen (z.B. Luzern,
  Bern, Zuerich, Schwarzwald, Elsass): nur wenn es sich fuer einen Tag
  lohnt, vor allem am Wochenende.
- Pro Werktag reichen 1 bis 2 gute Vorschlaege, am Samstag und Sonntag
  je 3 bis 5. In den Schulferien (Feld `holidays`) auch werktags 3 bis 5,
  dann gibt es viele Ferienangebote (Ferienpass, Museums-Workshops).

Quellen: myBasel (mybasel.ch/veranstaltungen/kinder), agendabasel.ch,
Eventfrog, BaselLive, basel.com, baselland-tourismus.ch, lolabrause.ch,
Websites von Museen, Zoo Basel, Theater Arlecchino und anderen Theatern. Jedes
Event muss auf einer Quelle mit Datum und Uhrzeit bestaetigt sein.
Nichts erfinden, nichts schaetzen. Lieber weniger Eintraege.

Fahrzeit fuer Ausfluege: ueber
`https://transport.opendata.ch/v1/connections?from=Bottmingen&to=<Ort>`
pruefen und gerundet angeben ("1h10", "25 min").

Format (UTF-8, Felder genau so):

    {
      "updated": "JJJJ-MM-TT",
      "note": "Wird von der Claude-Routine geschrieben. Nicht von Hand pflegen.",
      "holidays": [
        { "name": "Herbstferien BL/BS", "from": "2026-09-26", "to": "2026-10-11" }
      ],
      "events": [
        { "date": "2026-09-26", "time": "10:00",
          "title": "Kinderflohmarkt", "place": "Kasernenareal" },
        { "date": "2026-09-26", "time": "ab 10",
          "title": "Verkehrshaus: Tag der Bahn",
          "city": "Luzern", "travel": "1h10" }
      ]
    }

Regeln:
- `time` ist "HH:MM" oder "ab H" (fuer ganztaegige Angebote mit
  Oeffnungszeit).
- `title` hoechstens 40 Zeichen, `place` hoechstens 30, `city`
  hoechstens 14. Kurz und klar, ohne Werbesprache.
- Basel-Events: `place` setzen, `city` weglassen.
- Auswaerts: `city` und `travel` setzen, `place` optional.
- `updated` ist das heutige Datum.
- `holidays`: Schulferien Basel-Landschaft der naechsten Wochen, von
  baselland.ch pruefen. Bestehende Eintraege behalten, abgelaufene
  entfernen.

Technik: Manche Kalender (z.B. Eventfrog) laden ihre Liste erst im
Browser per JavaScript. Ein einfacher Abruf sieht dann nur eine leere
Seite. In dem Fall die Seite mit Playwright und dem vorinstallierten
Chromium rendern (`executablePath: '/opt/pw-browsers/chromium'` bzw.
PLAYWRIGHT_BROWSERS_PATH ist gesetzt, nichts nachinstallieren) und den
sichtbaren Text auswerten.

Netzwerk: Die Routine arbeitet mit allen erreichbaren Quellen. Einzelne
blockierte Domains ueberspringen und melden. Nur wenn gar keine Quelle
erreichbar ist: abbrechen. Nie Events aus Suchmaschinen-Snippets uebernehmen.

Danach `npm run check` ausfuehren. Schlaegt der Check fehl, die
Eintraege kuerzen, bis er gruen ist. Dann committen ("Events KW <nr>")
und auf main pushen. Keine anderen Dateien aendern.
