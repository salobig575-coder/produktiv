# Produktiv auf allen Geräten

## 1. App veröffentlichen (GitHub Pages)

1. Den Pull Request mit diesen Änderungen nach `main` mergen.
2. Im Repo: **Settings → Pages → Source: GitHub Actions** wählen (einmalig).
3. Der Workflow „Auf GitHub Pages veröffentlichen“ läuft automatisch. Danach ist die App unter
   `https://salobig575-coder.github.io/produktiv/` erreichbar.

Das Repo ist öffentlich, also ist auch der Code der Seite öffentlich. Deine **Daten** liegen nicht im Repo.

## 2. Auf jedem Gerät installieren

- **iPhone:** Link in **Safari** öffnen → Teilen → „Zum Home-Bildschirm“. Nur so laufen Benachrichtigungen und der Offline-Modus zuverlässig (iOS 16.4+).
- **Mac:** In Safari „Zum Dock hinzufügen“ (macOS Sonoma+) oder in Chrome/Edge das Installieren-Symbol in der Adressleiste.
- **PC:** In Chrome oder Edge das Installieren-Symbol in der Adressleiste.

## 3. Sync einrichten (Supabase, kostenlos)

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen.
2. **SQL Editor** → Inhalt von `supabase/schema.sql` einfügen → Run.
3. **Authentication → Providers → Email**: „Confirm email“ ausschalten (sonst musst du beim Registrieren erst einen Link bestätigen).
4. **Project Settings → API**: *Project URL* und den *anon public* Key kopieren.
5. In Produktiv: Zahnrad → **Geräte-Sync** → URL und Key eintragen, E-Mail und Passwort wählen → **Registrieren**.
6. Auf den anderen Geräten dieselben Angaben eintragen und **Anmelden**.

Der anon-Key ist für den Einsatz im Browser gedacht; geschützt sind deine Daten durch die Zeilen-Regeln (Row Level Security) in `schema.sql`. Den *service_role*-Key nie in die App eintragen.

## So funktioniert der Abgleich

- Die lokale Datenbank auf dem Gerät bleibt die Arbeitskopie – die App funktioniert auch offline.
- Änderungen werden nach ein paar Sekunden hochgeladen, beim Öffnen der App, beim Zurückkehren ins Fenster und bei Netz-Rückkehr geholt.
- Bei einem Konflikt (dasselbe Element auf zwei Geräten geändert) gewinnt der neuere Änderungszeitpunkt.
- Nicht synchronisiert werden: Fortschrittsfotos (bleiben lokal), der KI-Schlüssel sowie die mitgelieferten Übungen (kommen aus der App selbst; eigene Übungen werden synchronisiert).
- Die erste Anmeldung lädt vorhandene Daten des Geräts hoch. Melde dich zuerst auf dem Gerät mit den meisten Daten an.
- Tipp: Exportiere weiterhin gelegentlich ein Backup (Einstellungen → Backup).

## Erinnerungen

- **Web/PWA:** Erinnerungen erscheinen, solange die App geöffnet ist. Auf dem iPhone braucht es dafür die installierte App.
- **Immer, auch bei geschlossener App:** nur mit der nativen Hülle, siehe `NATIVE.md`.
