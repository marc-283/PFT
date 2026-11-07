# PFT – Personal Fitness Tracker · v1.4.0

Fitness-App im Look von PFM: schwarz, gelber Akzent, Barlow-Schrift, Startbildschirm, Wisch-Gesten. Läuft komplett offline auf dem Handy, alle Daten bleiben auf dem Gerät.

## Neu in 1.4.0

**Bedienung**
- **Tab-Leiste unten:** Heute · Training · Essen · Fortschritt · Mehr. Jeder Tab merkt sich, wo du warst; den aktiven Tab nochmal antippen → zurück zu seinem Anfang. Im laufenden Training und im Mahlzeit-Editor ist die Leiste ausgeblendet.
- **Heute:** zwei große Knöpfe **Training** und **Mahlzeit**, darunter „Als Nächstes“, heute gegessen, Gewicht, letztes Training und die Woche. Hyrox, Fußball und Sonstiges stehen nicht mehr im Hauptmenü – sie sind über **Training starten → Andere Sportarten** und im Tab Training erreichbar.
- **Sportarten ausblenden:** Mehr → „Sportarten in der App“ – Laufen, Hyrox, Fußball (und Sonstiges) abwählen. Sie verschwinden aus Training und Start-Menü, die Einträge bleiben und zählen weiter in Verlauf und Berichten.
- **Fortschritt** bündelt Kraft, Körper, Verlauf und Berichte. **Mehr** enthält nur noch Einstellungen (Sprache, Sportarten, Pausen-Timer, Tagesziele, Daten, Startverhalten); Lebensmittel sind unter Essen, der Verlauf unter Fortschritt.
- **Nichts geht mehr aus Versehen verloren:** Wer ein altes Training bearbeitet oder eine Mahlzeit nicht gespeichert hat und zurückgeht, wird gefragt (Speichern · Verwerfen · Weiter bearbeiten). Im Live-Training und im Mahlzeit-Editor geht Zurückwischen nur noch vom linken Rand.

**Training**
- **„Heute: …“ in jeder Übungskarte:** der Steigerungsvorschlag direkt im Training, z. B. „Heute 82,5 kg × 6–8 – letztes Mal alle Sätze mit 8 Wdh.“ oder „10 kg × 12 · 12 – eine Wdh. mehr pro Satz“. Bei Skills: mehr Sekunden/Wdh. oder die nächste Stufe.
- **Pause pro Übung:** ⏱-Knopf in der Übungskarte und im Workout-Plan, z. B. 3:00 für Kniebeugen, 1:00 für Seitheben. Wird im Plan gespeichert und für die Übung gemerkt; sonst gilt die Standard-Pause.
- **Supersätze:** ⋯ an einer Übung → „Supersatz mit nächster Übung“. Nach dem Satz der ersten Übung kein Timer, PFT springt zur zweiten; die Pause startet erst nach der letzten Übung des Supersatzes.
- **Dropsätze:** Nach einem abgehakten Arbeitssatz „+ Dropsatz – weniger Gewicht, direkt danach“. Vorschlag ca. 20 % weniger (oder was du letztes Mal als Dropsatz hattest). Dropsätze zählen ins Volumen, aber nicht als eigener Satz und nicht für Rekorde. Alternativ die Satznummer antippen: normal → Aufwärmen → Dropsatz.

**Körper & Ernährung**
- **Körpergewicht:** Fortschritt → Körper. Ein Eintrag pro Tag, Kurve mit Tageswerten und Ø 7 Tage, Veränderung über 4 Wochen und – wenn in den letzten 4 Wochen genug Mahlzeiten und Gewichte eingetragen sind – eine grobe Schätzung deines Kalorienbedarfs aus Essen + Gewichtstrend.
- **Eiweißziel aus dem Gewicht:** Mehr → Tagesziele → „Aus Körpergewicht“, z. B. 1,8 g pro kg → rechnet sich mit dem Ø der letzten 7 Tage automatisch mit.
- **Barcode scannen:** Kamera-Knopf neben der Suche in Lebensmittel, in der Zutaten-Auswahl, im Mahlzeit-Editor („Barcode scannen“), im eigenen Lebensmittel und als **Scannen** neben „Mahlzeit eintragen“. Den Code in den Rahmen halten – er wird von selbst erkannt. Oder die Nummer unten eintippen (Prüfziffer wird kontrolliert). PFT schaut zuerst in deinen eigenen Lebensmitteln nach, dann in Open Food Facts; nicht gefunden → Werte von der Packung eintragen, der Barcode wird mitgespeichert und beim nächsten Scan sofort erkannt. Auf dem iPhone fragt Safari beim ersten Scan nach der Kamera.
- Berichte zeigen jetzt auch **Ø Körpergewicht** und die Veränderung von der ersten bis zur letzten Woche; der CSV-Export enthält Satzart (Aufwärmen/Dropsatz), Supersätze und das Körpergewicht.

**Unter der Haube**
- **Speicher ohne Grenze:** Daten liegen jetzt in **IndexedDB** statt in einem großen localStorage-Eintrag (dort waren ca. 5 MB Schluss). Alte Daten werden beim ersten Start automatisch übernommen. Eingebaute Lebensmittel in Mahlzeiten werden nur noch als ID + Gramm gespeichert, die Nährwerte kommen beim Laden aus der Lebensmittelliste (eigene Lebensmittel behalten ihre Werte). PFT bittet den Browser außerdem, die Daten dauerhaft zu behalten. Ohne IndexedDB (manche private Modi) läuft alles wie bisher über localStorage.
- **Code aufgeteilt:** `index.html` (Gerüst), `style.css`, `data.js` (Texte, Übungen, Speicher), `foods.js` (Lebensmittel), `views.js` (Bildschirme, Charts), `app.js` (Bedienung, Scanner, Start). Der Barcode-Leser für iPhone (`vendor/zxing.min.js`, ZXing, Apache-2.0) wird erst beim ersten Scan geladen und dann offline gehalten.

## Neu in 1.3.0

- **Berichte:** eigenes Menü (Kachel „Berichte“ im Hauptmenü) mit Monats-, Quartals-, Halbjahres- und Jahresberichten. Ein Bericht erscheint automatisch, sobald der Zeitraum vorbei ist – im Menü steht dann „Neuer Bericht“. Der laufende Zeitraum lässt sich jederzeit ansehen („läuft noch – Stand heute“, verglichen bis zum gleichen Tag).
  - **Das hast du geleistet:** Zusammenfassung in Sätzen (mehr/weniger Training, aktivster Monat seit …, Rekorde, neue Skill-Stufen, Laufkilometer, Ernährung).
  - **Überblick als Liste:** Einheiten, Trainingszeit, aktive Tage, Rekorde, Gym-Volumen, Sätze, Wiederholungen, Haltezeit, Läufe, km, Ø Pace, Hyrox, Fußball – jeweils mit Vergleichswert und ▲/▼ in Prozent.
  - **Vergleich wählbar:** Vormonat/-quartal/-halbjahr oder derselbe Zeitraum im Vorjahr; mit ‹ › durch die Zeiträume blättern.
  - **Grafisch:** kumulierte Linie (dieser vs. Vergleichszeitraum) und Balken pro Woche bzw. Monat – für Zeit, Einheiten, Volumen, Sätze oder km, antippen zum Ablesen.
  - **Kategorien:** Sportarten (Trainingszeit) und Muskelgruppen (harte Sätze) mit Vergleichsbalken.
  - **Steigerungen:** Bestwert je Übung (e1RM, bester Satz, längste Haltezeit) gegenüber dem Vergleichszeitraum, neue Stufen, neue Rekorde, Bestwerte beim Laufen, Ernährung im Schnitt.
- **Eigene Lebensmittel wie auf der Packung:** Energie (kcal oder kJ), Fett, davon gesättigte Fettsäuren, Kohlenhydrate, davon Zucker, Ballaststoffe, Eiweiß, Salz – wahlweise pro 100 g, pro 100 ml oder pro Portion (wird automatisch auf 100 g umgerechnet). Dazu Marke und Mengen (1 Stück, 1 Portion, 1 Packung = … g). Anlegen über Ernährung → „Eigenes Lebensmittel anlegen“, Lebensmittel → „Meine Lebensmittel“ oder direkt im Mahlzeit-Editor. Danach in jeder Mahlzeit einfach den Namen (oder Marke + Name) eintippen; Zucker, Ballaststoffe, Salz usw. werden angezeigt, wo sie bekannt sind.
- **Übungen direkt im Training ändern:** Übungsnamen oder ⋯ antippen → Übung tauschen (eingetragene Sätze bleiben), bearbeiten (Name, Muskelgruppe), Verlauf ansehen, verschieben oder entfernen (mit Rückgängig). Gleiches im Workout-Editor.
- Bessere Erkennung zusammengesetzter Wörter beim Eintippen, z. B. „erdnuss butter“, „protein riegel“, „vollkorn toast“.

## Neu in 1.2.0

- **Mengen anpassen:** Jede Zutat einer Mahlzeit hat jetzt − / + und ein Mengenfeld; die Einheit lässt sich umschalten (g ↔ Stück, Scheiben, EL, TL, Glas, Becher …). kcal, Eiweiß, Fett und Kohlenhydrate rechnen sich proportional mit. Dazu **Portion ×½ … ×4** für alle Zutaten auf einmal.
- **Meine Mahlzeiten:** Eine Mahlzeit mit „★ Als meine Mahlzeit speichern" ablegen (z. B. Porridge) und an jedem Tag mit **„+ Heute"** eintragen – oder antippen, Mengen anpassen und dann speichern. Verwalten unter Ernährung → Meine Mahlzeiten (Kurzbefehl `#mymeals`).
- **Viel mehr Lebensmittel:** ca. 450 eingebaut (neu u. a. Fisch & Meeresfrüchte, mehr Käse, Brot, Wurst, Obst, Gemüse, Getränke, Snacks, ~50 Gerichte).
- **Open Food Facts:** In Lebensmittel und in der Auswahl einer Zutat lassen sich Millionen Packungsprodukte suchen – per Name oder Barcode-Nummer. Treffer antippen → Werte prüfen → als eigenes Lebensmittel speichern. Braucht Internet; die Daten stammen von der Community (ODbL).
- Mahlzeiten aus 1.1 werden automatisch übernommen und sind danach ebenfalls anpassbar.

## Neu in 1.1.0

- **Sprache:** Englisch als Standard, umschaltbar auf Deutsch (Einstellungen → Language/Sprache). Die Wahl bleibt gespeichert.
- **Ernährung:** Zutaten frei eintippen, z. B. „eier 5 stk, brot 2 scheiben, 200g hähnchen" – PFT erkennt Lebensmittel und Mengen (g, ml, Stk, Scheiben, EL, TL, Glas, Tasse, Handvoll, Dose, Portion …, deutsch oder englisch) und zeigt kcal, Eiweiß, Fett und Kohlenhydrate in Gramm. Tagesübersicht, Verlauf als Chart, „Nochmal?" für wiederkehrende Mahlzeiten, eigene Lebensmittel von der Packung, optionale Tagesziele.
- **Calisthenics:** eigenes Menü mit Halte-Skills (Handstand, L-Sitz, Elbow Lever, Front/Back Lever, Planche, Human Flag …), dynamischen Skills (Muscle-up, Hüftaufschwung, HSPU, Dragon Flag, Pistol Squat …) und Grundübungen – jeweils mit Progressionsstufen, Haltezeiten bzw. Wiederholungen, Rekorden und Tipp für die nächste Stufe.
- **Wischen wie in PFM:** zurück jetzt vom linken Rand *und* von fast überall auf der Seite (nicht auf Charts, Eingabefeldern und Chip-Leisten).
- **Neues Startbild:** Turnring im Spotlight mit Magnesia-Wolke.
- Daten aus 1.0 werden automatisch übernommen.

## Was sonst drin ist

- **Gym-Training live loggen:** Sätze mit kg und Wiederholungen, „Vorher"-Werte vom letzten Mal, Aufwärm- und Dropsätze, Supersätze, Pausen-Timer pro Übung, Rekorde live.
- **Workouts bauen:** eigene Pläne mit Sätzen, Wdh.-Spanne und (bei Skills) Stufe.
- **Fortschritt grafisch:** e1RM, Gewicht, Volumen je Übung mit Rekordlinie, Antippen zum Ablesen, Vollbild mit „Abspielen"; Wochenvolumen, Sätze pro Muskelgruppe.
- **Laufen, Hyrox, Fußball, Sonstiges:** Dauer, Distanz, Pace, Art, Anstrengung, Tore/Vorlagen, Bestwerte.
- **Daten:** Backup als JSON, CSV-Export (Sätze, Mahlzeiten, Körpergewicht), Beispieldaten zum Ausprobieren.

## Auf GitHub aktualisieren

Im bestehenden Repo **Add file → Upload files**, den kompletten Inhalt dieses Ordners hineinziehen – **inklusive des Ordners `vendor`** und der neuen Dateien `style.css`, `data.js`, `foods.js`, `views.js`, `app.js` – und committen (gleichnamige Dateien werden ersetzt, ältere Dateien müssen nicht gelöscht werden). GitHub Pages veröffentlicht nach ca. 1 Minute. Beim nächsten Öffnen mit Internet lädt die App die neue Version (neuer Cache-Name in `sw.js`); falls nicht sofort: App einmal komplett schließen und neu öffnen.

Erstmalig: neues *public* Repository anlegen, Dateien hochladen, **Settings → Pages → Deploy from a branch → `main` / `(root)`**.

## Aufs iPhone holen

Link in **Safari** öffnen → **Teilen → Zum Home-Bildschirm**. Die Home-Bildschirm-App hat ihren eigenen Speicher – ab und zu **Mehr → Backup sichern** (z. B. in iCloud Drive).

## Kurzbefehle

`#start` (Training) · `#meal` (Mahlzeit eintragen) · `#scan` (Mahlzeit + Barcode-Scanner) · `#weight` (Gewicht eintragen) · `#mymeals` · `#reports` (Berichte) · `#body` · `#food` · `#cali` · `#progress` · `#history` · `#workouts` · `#run` · `#hyrox` · `#fb` · `#more` · `#live`
