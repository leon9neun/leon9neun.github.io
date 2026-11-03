# Portfolio

Meine persönliche Portfolio-Webseite. Sie zeigt, wer ich bin, wo ich gearbeitet habe und an welchen Projekten ich arbeite.

**Live:** [`leon9neun.github.io`](https://leon9neun.github.io)

## Inhalt

- **Homepage:** Kurzvorstellung, About-Abschnitt
- **Experience:** Skills und eine Timeline der bisherigen Stationen
- **Projekte:** Karten mit Beschreibung, Technologien und Link zum Repo
- **Kontakt:** Mail-Adresse zum Kopieren, QR-Code, LinkedIn und GitHub

Die Seite ist statisch. Sie hat kein Tracking, setzt keine Cookies.

## Technik

| Bereich | Lösung |
|---|---|
| Framework | [Astro](https://astro.build) mit statischer Ausgabe |
| Sprache | JavaScript, HTML, CSS |
| Styling | eigenes CSS mit Design-Tokens |
| Schrift | Source Code Pro, lokal eingebunden |
| Hosting | GitHub Pages |
| Deployment | GitHub Actions bei jedem Push auf `main` |


## Inhalte pflegen

Für neue Inhalte muss kein Code geändert werden.

| Was | Wo |
|---|---|
| Name, Rolle, Kontakt, Homepage-Texte | `src/content/site/site.md` |
| neue Station | neue Datei in `src/content/experience/`, z. B. `2024-04-firmenname.md` |
| neues Projekt | neue Datei in `src/content/projects/`, z. B. `projektname.md` |
| Bilder | `public/images/` |

Die Felder jeder Datei werden beim Build geprüft. Fehlt ein Pflichtfeld, bricht der Build mit einer Fehlermeldung ab.

## Struktur
```
src/
├─ components/   wiederverwendbare Bausteine
├─ content/      Inhalte als Markdown (site, experience, projects)
├─ layouts/      Seitenrahmen
├─ lib/          Hilfsfunktionen und Client-Skripte
├─ pages/        Seiten und Routen
└─ styles/       Design-Tokens und globale Styles
docs/            Projekt-Dokumentation
```
