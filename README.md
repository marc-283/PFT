# PFT – Personal Fitness Tracker · v1.0.0

Fitness-App im Look von PFM: schwarz, gelber Akzent, Barlow-Schrift, Startbildschirm, Wisch-Gesten. Läuft komplett offline auf dem Handy, alle Daten bleiben auf dem Gerät.

## Was drin ist

- **Gym-Training live loggen:** Übungen mit Sätzen, Gewicht (kg) und Wiederholungen. „Vorher"-Spalte zeigt das letzte Mal, Platzhalter übernehmen die Werte beim Abhaken. Aufwärmsätze (Satznummer antippen → „A") zählen nicht für Rekorde. Pausen-Timer nach jedem Satz (Zeit in den Einstellungen).
- **Workouts bauen:** eigene Pläne (z. B. Push/Pull/Beine) mit Sätzen und Wdh.-Spanne. Beim Start ist alles vorausgefüllt.
- **Fortschritt grafisch:** pro Übung geschätztes 1RM (Epley), schwerstes Gewicht, Volumen – mit Rekordlinie, Antippen zum Ablesen, Vollbild mit „Abspielen". Dazu Wochenvolumen, Sätze pro Muskelgruppe, Rekorde und ein Tipp fürs nächste Training.
- **Laufen, Hyrox, Fußball, Sonstiges:** Dauer, Distanz, Pace, Art (z. B. Tempo/Spiel/Wettkampf), Anstrengung 1–10, Tore/Vorlagen. Eigene Ansicht mit Wochen-Charts und Bestwerten.
- **Übungsbibliothek:** gut 50 Übungen auf Deutsch, eigene anlegen und umbenennen.
- **Daten:** Backup als JSON (z. B. in iCloud Drive), CSV-Export für Excel/Numbers, Beispieldaten zum Ausprobieren.

## Auf GitHub veröffentlichen (wie bei PFM)

1. Auf github.com ein **neues Repository** anlegen, z. B. `pft`. Für kostenloses GitHub Pages muss es *public* sein.
2. Im Repo **Add file → Upload files** und den kompletten Inhalt dieses Ordners hineinziehen (`index.html`, `sw.js`, `manifest.webmanifest`, `splash.jpg`, die Ordner `fonts/` und `icons/`). Commit.
3. **Settings → Pages →** Source: *Deploy from a branch*, Branch: `main`, Ordner: `/ (root)` → Save.
4. Nach ca. 1 Minute läuft die App unter `https://DEIN-NAME.github.io/pft/`.

## Aufs iPhone holen

1. Den Link in **Safari** öffnen.
2. **Teilen → Zum Home-Bildschirm.**
3. Ab jetzt PFT immer über das Icon öffnen. Oben im Menü steht dann „Auf diesem iPhone" (grüner Punkt).

Wichtig: Die Home-Bildschirm-App hat ihren eigenen Speicher, getrennt von Safari. Wird das Icon gelöscht, sind die Daten weg – deshalb ab und zu **Einstellungen → Backup sichern**. Ein Backup lässt sich auf jedem Gerät wieder laden.

## Updates

Neue Version = Dateien im Repo ersetzen. `sw.js` enthält einen Cache-Namen mit Versionsnummer (`pft-1.0.0-…`). Ändert sich der, lädt die App beim nächsten Öffnen mit Internet die neue Version. Wird nur `index.html` von Hand geändert, den Cache-Namen in `sw.js` ebenfalls ändern – sonst zeigt das iPhone weiter die alte Version.

## Kurzbefehle

Links mit Anhang öffnen direkt eine Ansicht (z. B. für die iOS-Kurzbefehle-App):
`#start` (Training starten) · `#live` (laufendes Training) · `#progress` · `#history` · `#workouts` · `#run` · `#hyrox` · `#fb`
