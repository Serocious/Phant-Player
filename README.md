# Phant

A modern, pure-dark, periwinkle-accented local music player for Windows.

Built because MusicBee's interface felt dated. Phant scans a music folder,
displays albums in an Apple Music-style grid, plays MP3/FLAC/M4A/OGG/Opus/WAV,
and integrates with Last.fm and the Windows System Media Transport Controls
(so Discord rich presence works through Music Presence with no extra setup).

![Phant screenshot — TODO replace this line with an actual screenshot]()

## Features

- Library scan over a folder of albums, with embedded album art extraction
- Albums / Songs / Artists views, all sortable
- Apple Music-style album grid with hover-to-play overlays
- Pure-dark theme with periwinkle accent
- Now-playing bar with play / pause / next / previous / seek / volume
- **Last.fm scrobbling** — follows the official scrobble rule (track ≥30s,
  played for either 4 minutes or 50% of duration)
- **Windows SMTC integration** — Discord Music Presence, Bluetooth headphone
  media keys, Windows volume overlay, and lock screen all just work
- Local SQLite library cache (pure JavaScript, no native compilation)

## Tech

- Electron 33 + React 18 + TypeScript
- Vite for the renderer build
- sql.js for the library database (no native compilation needed)
- music-metadata for tag and embedded-art parsing
- electron-builder for the Windows installer

## Running from source

```bash
npm install
npm run dev
```

The app opens at `http://localhost:5173` inside an Electron window. First run
will scan your music folder.

By default the music folder path is hardcoded to `E:\Music` in `App.tsx`. If
yours is elsewhere, change that one string before scanning. (A proper folder
picker is on the todo list.)

## Building a Windows installer

```bash
npm run build
```

Output appears in `release/`. The installer is `Phant-Setup-x.y.z.exe`.

The build is unsigned, so Windows SmartScreen will warn the first time it's
run. Click "More info" → "Run anyway".

## Last.fm setup

1. Get an API key and shared secret from
   https://www.last.fm/api/account/create.
2. Create a `config.json` next to the running app:
   - In dev: project root
   - When installed: `%APPDATA%\Phant\config.json`
3. With contents:
   ```json
   {
     "lastfm": {
       "apiKey": "...",
       "apiSecret": "..."
     }
   }
   ```
4. Restart the app, open Settings, click **Connect to Last.fm**, authorise in
   the browser, and click **"I've authorised — complete connection"**.

`config.json` is gitignored.

## Project layout

```
src/
  main/             Electron main process (Node)
    main.ts         Window, IPC, custom protocol, config loading
    db.ts           SQLite (sql.js) helpers
    scanner.ts      Library scanner, tag parsing, album art
    lastfm.ts       Last.fm API client (auth, scrobble)
  preload/preload.ts
  renderer/         React UI
    App.tsx
    styles.css
    components/AlbumCover.tsx, Icons.tsx
    hooks/usePlayer.ts, useMediaSession.ts
    assets/logo.png
  shared/types.ts
build/icon.ico, icon.png   Installer icon
config.example.json        Template — copy to config.json
```

## Status

Personal project, early stage. Things that work are reliable; things that are
missing are simply not built yet.

Things that aren't built yet:
- Folder picker (music folder is currently hardcoded)
- Search across the library
- Playlists, queue management, shuffle, repeat
- Drag-to-seek on the progress bar (click-to-seek works)
- Keyboard shortcuts
- Cross-platform builds (Windows only for now)

## License

MIT — see `LICENSE`.
