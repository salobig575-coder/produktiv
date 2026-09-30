# Produktiv

Persönlicher Planer, Fokus-Timer und Fitness-Tracker in einer App. Läuft als PWA (Web, iPhone, Android, Mac, PC), Daten liegen lokal in IndexedDB und lassen sich optional über Supabase zwischen Geräten synchronisieren.

## Bereiche

- **Heute:** „Jetzt“-Karte (aktueller/nächster Block, Vorschlag für freie Zeit), Aufgaben, Gewohnheiten, Fortschritt.
- **Planen:** Kalender (Tag, Woche, Monat, Jahr), Aufgaben mit Unteraufgaben und Wiederholung, Notizen, Routinen mit Zeitfenster, Fokus-Timer mit Härtegraden.
- **Fitness:** Workouts, Übungen, Fortschritt, Körperwerte.

Automatik im Planer: Schnelleingabe in Alltagssprache, „Tag planen“ (Vorschlag mit Bestätigung), Umplanung verpasster Blöcke, Überlastungshinweis, lernende Zeitschätzung, Feiertage, Erinnerungen, optionale KI (Aufgaben zerlegen, Wochenfazit).

Tastenkürzel (Mac/PC): `1`/`2`/`3` Bereiche, `/` oder Strg/Cmd+K Suche, im Kalender `←` `→` `t` `d` `w` `n`, `Esc` schließt Fenster.

## Entwickeln

Kein Build nötig: `index.html` direkt über einen statischen Server öffnen, z. B.

```bash
python3 -m http.server 8123
```

Tests (keine Abhängigkeiten): `npm test`

## Struktur

| Datei | Zweck |
|---|---|
| `js/app.js` | App-Gerüst, Navigation, Hilfsfunktionen, Tastenkürzel |
| `js/db.js` | IndexedDB (Stores inkl. `events`), Backup-Export/-Import |
| `js/planner.js` | Planer-Logik ohne UI: Wiederholungen, freie Zeit, Auto-Planung, Schnelleingabe, ICS, Erinnerungen |
| `js/calendar.js` | Kalender-Ansichten, Timeline, Ziehen/Größe ändern, Editor |
| `js/tasks.js`, `js/habits.js`, `js/focus.js`, `js/notes.js` | Aufgaben, Routinen, Fokus-Timer, Notizen |
| `js/today.js`, `js/search.js`, `js/settings.js` | Heute-Tab, globale Suche, Einstellungen |
| `js/holidays.js` | Feiertage je Bundesland |
| `js/sync.js` | Geräte-Sync über Supabase |
| `js/ai.js`, `js/native.js` | Optionale KI, Brücke zur nativen Hülle |
| `sw.js` | Service Worker (Cache-Name bei jeder Auslieferung erhöhen) |

## Weiterführende Anleitungen

- [`SYNC.md`](SYNC.md): Veröffentlichen auf GitHub Pages, Installation auf allen Geräten, Sync einrichten
- [`NATIVE.md`](NATIVE.md): iOS/Android-App mit Capacitor, native Erinnerungen, App-Blocking
- [`supabase/schema.sql`](supabase/schema.sql): Datenbankschema für den Sync
