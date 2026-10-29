# PFT – Personal Fitness Tracker · v1.1.0

Fitness-App im Look von PFM: schwarz, gelber Akzent, Barlow-Schrift, Startbildschirm, Wisch-Gesten. Läuft komplett offline auf dem Handy, alle Daten bleiben auf dem Gerät.

## Neu in 1.1.0

- **Sprache:** Englisch als Standard, umschaltbar auf Deutsch (Einstellungen → Language/Sprache). Die Wahl bleibt gespeichert.
- **Ernährung:** Zutaten frei eintippen, z. B. „eier 5 stk, brot 2 scheiben, 200g hähnchen" – PFT erkennt Lebensmittel und Mengen (g, ml, Stk, Scheiben, EL, TL, Glas, Tasse, Handvoll, Dose, Portion …, deutsch oder englisch) und zeigt kcal, Eiweiß, Fett und Kohlenhydrate in Gramm. Tagesübersicht, Verlauf als Chart, „Nochmal?" für wiederkehrende Mahlzeiten, eigene Lebensmittel von der Packung, optionale Tagesziele.
- **Calisthenics:** eigenes Menü mit Halte-Skills (Handstand, L-Sitz, Elbow Lever, Front/Back Lever, Planche, Human Flag …), dynamischen Skills (Muscle-up, Hüftaufschwung, HSPU, Dragon Flag, Pistol Squat …) und Grundübungen – jeweils mit Progressionsstufen, Haltezeiten bzw. Wiederholungen, Rekorden und Tipp für die nächste Stufe.
- **Wischen wie in PFM:** zurück jetzt vom linken Rand *und* von fast überall auf der Seite (nicht auf Charts, Eingabefeldern und Chip-Leisten).
- **Neues Startbild:** Turnring im Spotlight mit Magnesia-Wolke.
- Daten aus 1.0 werden automatisch übernommen.

## Was sonst drin ist

- **Gym-Training live loggen:** Sätze mit kg und Wiederholungen, „Vorher"-Werte vom letzten Mal, Aufwärmsätze, Pausen-Timer, Rekorde live.
- **Workouts bauen:** eigene Pläne mit Sätzen, Wdh.-Spanne und (bei Skills) Stufe.
- **Fortschritt grafisch:** e1RM, Gewicht, Volumen je Übung mit Rekordlinie, Antippen zum Ablesen, Vollbild mit „Abspielen"; Wochenvolumen, Sätze pro Muskelgruppe.
- **Laufen, Hyrox, Fußball, Sonstiges:** Dauer, Distanz, Pace, Art, Anstrengung, Tore/Vorlagen, Bestwerte.
- **Daten:** Backup als JSON, CSV-Export (Sätze und Mahlzeiten), Beispieldaten zum Ausprobieren.

## Auf GitHub aktualisieren

Im bestehenden Repo **Add file → Upload files**, den kompletten Inhalt dieses Ordners hineinziehen und committen (gleichnamige Dateien werden ersetzt). GitHub Pages veröffentlicht nach ca. 1 Minute. Beim nächsten Öffnen mit Internet lädt die App die neue Version (neuer Cache-Name in `sw.js`); falls nicht sofort: App einmal komplett schließen und neu öffnen.

Erstmalig: neues *public* Repository anlegen, Dateien hochladen, **Settings → Pages → Deploy from a branch → `main` / `(root)`**.

## Aufs iPhone holen

Link in **Safari** öffnen → **Teilen → Zum Home-Bildschirm**. Die Home-Bildschirm-App hat ihren eigenen Speicher – ab und zu **Einstellungen → Backup sichern** (z. B. in iCloud Drive).

## Kurzbefehle

`#start` (Training) · `#meal` (Mahlzeit eintragen) · `#food` · `#cali` · `#progress` · `#history` · `#workouts` · `#run` · `#hyrox` · `#fb` · `#live`
