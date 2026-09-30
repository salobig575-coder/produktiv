# Native Apps (iPhone, Android, Mac, Desktop)

Produktiv ist eine PWA und läuft so bereits auf Web, iPhone, Android und Desktop (Installieren über den Browser).
Für Funktionen, die ein Browser nicht kann, gibt es eine native Hülle mit [Capacitor](https://capacitorjs.com/) – dieselbe Codebasis, kein Umschreiben.

## Was die Hülle bringt

| Funktion | PWA | Native Hülle |
|---|---|---|
| Kalender, Planer, Fokus, Fitness | ja | ja |
| Erinnerungen bei geschlossener App | nein (nur bei geöffneter App) | **ja** – bereits eingebaut (`js/native.js`, Plugin `@capacitor/local-notifications`) |
| App-Store-Verteilung, Icon, Splash | nein | ja |
| Apps wirklich sperren (Opal-Prinzip) | nein | nur mit eigenem Native-Code, siehe unten |
| Widgets, Watch, Siri-Kurzbefehle | nein | mit eigenem Native-Code |

## Einrichten

Voraussetzungen: Node 20+, für iOS ein Mac mit Xcode, für Android Android Studio.

```bash
npm install
npm run cap:add:ios        # einmalig, nur auf dem Mac
npm run cap:add:android    # einmalig
npm run cap:ios            # baut www/, synchronisiert und öffnet Xcode
npm run cap:android        # baut www/, synchronisiert und öffnet Android Studio
```

Nach jeder Änderung an der Web-App genügt `npm run cap:sync`.
Mac-Desktop: dieselbe iOS-App läuft auf Apple-Silicon-Macs, oder du verpackst `www/` mit [Tauri](https://tauri.app/) bzw. Electron.

## Erinnerungen

`Native.syncReminders()` plant beim Öffnen des Kalenders alle Erinnerungen der nächsten 7 Tage neu als lokale Benachrichtigungen.
Die Berechtigung wird angefragt, sobald „Erinnerungen“ in den Einstellungen aktiviert wird.
Auf Android 13+ und iOS erscheint dafür der System-Dialog. Ohne Öffnen der App werden nach 7 Tagen keine neuen Erinnerungen mehr geplant.

## App-Blocking (Fokus „Strikt“)

Der Härtegrad „Strikt“ sperrt im Web nur die Bedienung des Timers. Echtes Sperren anderer Apps braucht Betriebssystem-Schnittstellen, die **nicht** Teil dieses Repos sind:

- **iOS:** Screen Time API (`FamilyControls`, `ManagedSettings`, `DeviceActivity`). Dafür braucht der Apple-Entwickler-Account das Entitlement *Family Controls (Distribution)*, das bei Apple beantragt werden muss. Umsetzung als eigenes Capacitor-Plugin in Swift.
- **Android:** `UsageStatsManager` plus Overlay bzw. Accessibility-Service, als Capacitor-Plugin in Kotlin. Google Play prüft Accessibility-Nutzung streng.

Empfohlene Reihenfolge: erst Erinnerungen und Store-Build, danach das Blocking als separates Plugin (`FocusBlocker.start({ minutes, level })`), das der Fokus-Timer beim Start aufruft.

## KI und Schlüssel

Die KI-Funktionen sind optional. Der API-Schlüssel liegt nur lokal auf dem Gerät (Einstellungen → KI) und wird direkt an Anthropic gesendet. Für eine App, die du an andere weitergibst, solltest du stattdessen einen **eigenen Proxy** betreiben und dessen URL bei „Proxy-Endpunkt“ eintragen. Ein Schlüssel im ausgelieferten Client wäre für Fremde auslesbar.
