# 🌱 Wurzelimperium Quest-Tracker

Eine kleine Web-App, um die Quests aus [Wurzelimperium](https://www.wurzelimperium.de/)
zu verfolgen: Quests abhaken und sehen, was als Nächstes anzupflanzen ist. Läuft
komplett im Browser (kein Login, kein Server) und wird über **GitHub Pages** gehostet.
Der Fortschritt liegt als Datei **im Repo** (`src/data/progress.json`) – kein
localStorage.

Die Quest-Daten stammen aus dem
[Wurzelimperium-Forum](https://wurzelforum.wurzelimperium.de/viewtopic.php?t=80445)
und liegen als statische Datei im Projekt (`src/data/quests.json`).

## Features

- **23 Questreihen · 1244 Quests** – gruppiert (Kakteen-Familie, Erholungsgarten I/II …)
- **Anzeige auf Quest-Ebene**, aktuelle Quest je Reihe wird hervorgehoben
- **Empfehlungen**: aggregierter Bedarf über die aktuelle bzw. alle offenen Quests
- **Level-Filter** (nur erreichbare Reihen), erledigte ausblenden
- **Fortschritt im Repo** (`src/data/progress.json`) – read-only in der App

## Fortschritt (progress.json)

Die App ist **read-only**: Sie zeigt den Fortschritt nur an. Geändert wird er
ausschließlich durch **Bearbeiten der Datei** `src/data/progress.json` – pro
Reihe die Anzahl erledigter Quests:

```json
{
  "version": 1,
  "level": 18,
  "series": {
    "traditionelle-questreihe": 16,
    "wassergarten": 3
  }
}
```

Das heißt: Quests 1–16 der traditionellen Reihe sind erledigt, Quest 17 ist die
aktuelle. Reihen ohne Eintrag stehen auf 0. Die `seriesId` (z. B.
`traditionelle-questreihe`) steht in der App unter jeder Reihe als Hinweis.

`level` ist dein Spieler-Level und dient als Startwert für den Level-Filter
(`null` = kein Filter). In der Vorlage stehen bereits alle 23 Reihen auf 0.

Ablauf: Zahl anpassen → committen → pushen. Auf der gehosteten Seite erscheint
der neue Stand nach dem automatischen Deploy. Lokal (`npm run dev`) genügt
Speichern der Datei (Hot-Reload).

## Entwicklung

```bash
npm install     # Abhängigkeiten
npm run dev     # Dev-Server (http://localhost:5173)
npm run build   # Produktions-Build nach dist/
npm run preview # Build lokal ansehen
```

## Quest-Daten aktualisieren

Wenn das Forum neue Quests bekommt, die Datei neu erzeugen:

```bash
npm run extract
```

Das Skript `scripts/extract.mjs` lädt den Forum-Thread, parst alle Reihen und
schreibt `src/data/quests.json` neu. Danach committen.

## Deployment (GitHub Pages)

1. Repo auf GitHub anlegen und pushen (Branch `main`).
2. In den Repo-Einstellungen: **Settings → Pages → Build and deployment →
   Source: „GitHub Actions"**.
3. Jeder Push auf `main` baut die App und veröffentlicht sie automatisch
   (siehe `.github/workflows/deploy.yml`).

Der Base-Pfad wird im Workflow automatisch auf den Repo-Namen gesetzt, die App
läuft dann unter `https://<dein-name>.github.io/<repo-name>/`.

## Technik

Vite + Svelte 5 (reines JavaScript). Fortschritt read-only aus
`src/data/progress.json`; kein localStorage, keine Backend-Abhängigkeit.
