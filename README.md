# Enten-Flug

Ein kleines Browser-Spiel: reite eine Ente und flieg durch die Wolken.

## Spielen

1. `index.html` im Browser öffnen (Doppelklick reicht — kein Server, keine Installation).
2. Im Menü die Ente nach Wunsch gestalten (Farben, Größe, Hut, Sonnenbrille, Reiter).
3. Schwierigkeit und Hintergrund wählen.
4. Auf **▶ Spielen** klicken.

## Steuerung

- **Leertaste** / **↑** / Klick / Tippen — Flügelschlag
- **Esc** — zurück zum Menü

## Punkte

- +1 für jede Wolkenlücke, durch die du fliegst
- +5 für jeden goldenen Ring, den du einsammelst
- Der Highscore wird im Browser (`localStorage`) gespeichert.

## Dateien

- `index.html` — Seitengerüst (Menü + Canvas)
- `styles.css` — Menü- und HUD-Stil
- `duck.js` — parametrisches Enten-Rendering (Live-Preview & Spiel teilen sich denselben Code)
- `menu.js` — Menü-Logik, Live-Vorschau, Speichern via `localStorage`
- `game.js` — Spielschleife, Physik, Hindernisse, Kollisionen
