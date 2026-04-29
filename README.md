# Phant

A modern, pure-dark, periwinkle-accented local music player for Windows.

Built because MusicBee's interface felt dated. Phant scans a music folder,
displays albums in an Apple Music-style grid, plays MP3/FLAC/M4A/OGG/Opus/WAV,
and integrates with Last.fm, Discord Rich Presence, and the Windows System
Media Transport Controls.

[Latest release](https://github.com/Serocious/Phant-Player/releases/latest)

## Features

- **Library scan** over a folder of albums, with embedded album art extraction
- **Albums / Songs / Artists / Favourites views**, all sortable, all searchable
- **Apple Music-style album grid** with hover-to-play overlays
- **Playlists** — create, rename, delete; right-click any track to add to a
  playlist; drag-to-reorder tracks within a playlist
- **Favourites** — heart any track; the Favourites view supports manual
  drag-to-reorder
- **Queue management** — play next, add to queue, an "Up Next" popup, plus
  shuffle and repeat (off / all / one)
- **Persistent queue** — your queue, current track, shuffle, and repeat mode
  survive app restarts
- **Drag-to-seek** on the progress and volume bars
- **Track details popup** showing format, bitrate, sample rate, channels, file
  size, plus an editable notes field per track and a click-to-show-in-folder
  link
- **Last.fm scrobbling** — follows the official rule (track ≥30s, played for
  either 4 minutes or 50% of duration)
- **Discord Rich Presence** with album art automatically looked up via the
  iTunes API
- **Windows SMTC integration** — Bluetooth headphone media keys, Windows
  volume overlay, and the lock screen all just work
- Local SQLite library cache (pure JavaScript, no native compilation)

## Tech

- Electron 33 + React 18 + TypeScript
- Vite for the renderer build
- sql.js for the library database (no native compilation needed)
- music-metadata for tag and embedded-art parsing
- electron-builder for the Windows installer

## Install (end users)

Download the latest installer from the
[releases page](https://github.com/Serocious/Phant-Player/releases/latest)
and run it.

The build is unsigned, so Windows SmartScreen will warn the first time it's
run. Click "More info" → "Run anyway".

## Running from source

```bash
npm install
npm run dev
```

The app opens at `http://localhost:5173` inside an Electron window. On first
launch you'll be asked to choose your music folder.

## Building a Windows installer

```bash
npm run build
```

Output appears in `release/`. The installer is `Phant-Setup-x.y.z.exe`.

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
4. Restart Phant, open Settings, click **Connect to Last.fm**, authorise in
   the browser, and click **"I've authorised — complete connection"**.

`config.json` is gitignored.

## Discord Rich Presence setup

Phant talks to Discord directly via local IPC — no third-party tools needed.
You'll need to register a free Discord application to get a Client ID:

1. Visit [discord.com/developers/applications](https://discord.com/developers/applications)
   and click **New Application**. Name it "Phant" (or whatever you'd like to
   appear in your Discord status).
2. Copy the **Application ID**.
3. Under **Rich Presence → Art Assets**, upload three images, each at least
   512×512 PNG:
   - `phant_logo` — used as the large image when no album art match is found
   - `play` — small icon shown when a track is actively playing
   - `pause` — small icon shown when paused
4. In Phant, open **Settings → Discord Rich Presence**, paste the Application
   ID, and tick **Enabled**.

Phant will look up album art for each track via the iTunes Search API. Albums
that aren't on Apple Music will fall back to the `phant_logo` image.

## Project layout

```
src/
  main/                     Electron main process (Node)
    main.ts                 Window, IPC, custom protocol, config loading
    db.ts                   SQLite (sql.js) helpers and schema
    scanner.ts              Library scanner, tag parsing, embedded album art
    lastfm.ts               Last.fm API client (auth, scrobble)
    discordRpc.ts           Discord Rich Presence + iTunes art lookup
  preload/preload.ts        contextBridge.exposeInMainWorld('api', ...)
  renderer/                 React UI
    App.tsx                 Root component, routing, modal orchestration
    styles.css
    components/             Reusable UI components
      AlbumCover.tsx        Cached cover loader
      ContextMenu.tsx       Right-click menu with submenu support
      ConfirmModal.tsx
      FavouriteButton.tsx
      Icons.tsx             All SVG icons
      SearchBox.tsx
      TextInputModal.tsx
      TrackDetailsPopup.tsx
      UpNextPopup.tsx
    hooks/                  Player & app-state hooks
      usePlayer.ts          Queue manager, audio element lifecycle
      useMediaSession.ts    SMTC wiring via MediaSession API
      useFavourites.ts
      usePlaylists.ts
      useDragSeek.ts        Click-and-drag for slider bars
      useDiscordPresence.ts Pushes activity to the main-process RPC module
    assets/logo.png
  shared/types.ts           Track, Album, Artist, Playlist types + IPC names
build/icon.ico, icon.png    Installer icon
config.example.json         Template — copy to config.json
```

## Status

Personal project, actively developed. Things that work are reliable; things
that are missing are simply not built yet.

Things that aren't built yet:
- Keyboard shortcuts
- M3U import/export
- Cross-platform builds (Windows only for now)
- Auto-updates inside the installed app
- Spectrogram / waveform visualisations

## License

MIT — see `LICENSE`.
