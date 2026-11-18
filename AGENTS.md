# 432 — the driver's music player (Frank's music/uber/432 app)

 The workspace (Frank's folder convention, 2026-11-18): `432/repo/` = the
 git home = THIS folder (the code + this file travel together); `432/music/`
 = the master shelf, outside git by construction. The vocabulary: `repo` =
 the pure git home one folder down · `source` = the code folder when git
 sits at the project root (origin rejected — git's own remote word).

 A PWA that plays music at A=432 in the car. Roadmap = Frank's own
 `⌁ docs/projects/Ϟ music.md` (9 lines: playable while driving · installable ·
 ±key/±bpm/432 toggle · YouTube playlists · 440→432 conversion · detect ·
 auto-adjust · car buttons · fades).

## The clarifying round (2026-11-18, Frank's answers)
- Conversion = FULL time-stretch engine from day one (no Audacity baking):
 `@soundtouchjs/audio-worklet` — pitch and tempo travel INDEPENDENTLY.
- Sources = local files + a YouTube playlist tab (both).
- v0 extras = crossfade between songs + ±key/±bpm fine-tune (independent).
 No shuffle, no sleep timer.
- Library = a handful of favourites (under ~30).

## Stack & layout
- Vite + TypeScript, vanilla (no framework). Build = `tsc --noEmit && vite build`.
- `src/audio.ts` — the Engine: AudioContext + SoundTouchNode (worklet) graph
 buffer source → lane gain (crossfade) → node → master → out.
- `src/library.ts` — IndexedDB blob store (survives reloads = the installed app).
- `src/main.ts` — driver UI + MediaSession (car wheel buttons) + progress.
- `public/manifest.webmanifest` — PWA (portrait standalone). Icons = TODO.

## Engine notes (the load-bearing facts)
- `SoundTouchNode.register(ctx, processorUrl)` BEFORE `new SoundTouchNode({context})`.
- `node.pitch` = multiplier; the 432 toggle = 2^(-31.766/1200) = 432/440.
 ±key = semitones on top (total cents = keySemis*100 + (is432 ? -31.766 : 0)).
- TEMPO without pitch: set BOTH `src.playbackRate` and `node.playbackRate`
 to the same value (the processor compensates). v0 tempo = 0.75..1.5.
- Fade-between = the lane gain ramp (0.5s out / 0.5s in) — the roadmap's
 "fade in out" reads as dip, not overlap; overlap = later if wanted.
- The AudioContext is created on first gesture (mobile autoplay rules).

## Known limits (honest, by design)
- YouTube tab: a PWA cannot pipe YT audio through the engine (cross-origin) —
 the YT player can only get the RATE trick (coupled tempo). Local files get
 the real treatment. (The tab is not built yet.)
- The worklet asset = `soundtouch-processor-*.js` emitted by Vite (73 kB).
- No service worker yet = the PWA installs but needs the network for the
 shell; audio is all local. SW caching = next polish.

## Open threads
→ PWA icons (the manifest's icons array is empty = install prompt is weak).
→ The YouTube playlist tab (rate-trick only).
→ Service worker (offline shell).
→ Long-press on ± for fast steps; now-playing screen polish.