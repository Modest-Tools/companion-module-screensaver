# Changelog

## 0.7.0 — 2026-05-13

### Changed
- **Config UI streamlined.** Dropped the three header static-text blocks and the verbose About paragraph in favor of a single setup hint at the top + tighter per-field tooltips. Field order reorganised so deck size and active screensaver appear next to each other (the two most-touched fields).
- **Action descriptions tightened.** `Install screensaver from zip` and `Generate page setup file` now have one-sentence descriptions; details moved to per-field tooltips.
- **README rewritten.** Quick-start now leads with the auto-install watcher (drop zip in `~/Downloads`) instead of the bind-to-temp-button manual flow. Reference tables for actions/feedbacks/variables retained.
- **Auto-install hint surfaced.** When zips are auto-installed in the background, the log now points users at the "Active screensaver" dropdown.

### Removed
- **Legacy `tileFolder` config field.** This was a v0.1-era escape hatch for pointing the renderer directly at a folder of tile GIFs without using the library. Marked `@deprecated` since v0.4.0 and superseded by the library workflow. Removing it cleans up one confusing knob in the connection settings. Connections that had a value set just ignore it now.

## 0.6.3 — 2026-05-13

### Changed
- **Tile downsample target dropped from 96 px → 72 px.** Matches Stream Deck MK.2's native button pixel count. Previously each tile was slightly oversampled, inflating per-frame IPC payload by ~44% with no visible benefit. Per-tile RGBA payload: 36 KB → 20 KB.
- **Per-tile frame-diff.** The `screensaver_tile` feedback callback now compares each new tile to the last buffer shipped to Companion for that slot, returning `null` (skip the update) when they're byte-identical. For content with a static background (most logo loops) this skips 80%+ of the per-frame IPC payload. Comparison is `Buffer.equals` (native byte compare, microseconds per tile).

### Notes
- Combined effect: throughput for a typical logo-loop screensaver drops from ~13.5 MB/s @ 25 fps to ~1.5 MB/s — roughly 9×. Should make 20-25 fps viable on machines where 15 fps was previously the ceiling.

## 0.6.2 — 2026-05-13

### Fixed
- **`Start screensaver` / `Stop screensaver` actions intermittently timed out from the host's side** (`Module: Error executing action: Call timed out`) and the screensaver only fired on the deck *sometimes*. The tile-refresh interval was running at 15 fps continuously from module init — even when the screensaver wasn't active — shipping ~225 tile-buffer IPC messages per second to Companion's host. That starved the action-reply queue and the action ack would miss the host's ~7-second timeout window. The tile ticker now only runs while `this.active` is true: started in `startScreensaver()`, stopped in `stopScreensaver()`. Idle-state tile buttons keep showing the last sliced frame (the one-shot `refreshMasterFrame()` at load populates the initial frame, so buttons aren't blank on the screensaver page before activation).

## 0.6.1 — 2026-05-12

### Fixed
- **Pac Man Animated Screensaver V2 (and similarly-shaped Elgato packs) was invisible to the scanner.** Three independent bugs combined to produce an install that left no trace in the dropdown:
  - `findMasterFiles()` only read the screensaver folder's direct root, so packs that ship their full-deck GIFs inside a `Gifs/` subfolder returned zero matches. The scanner now also looks in `Gifs/`/`gifs/`.
  - `isScreensaverZip()` capped the deck-named-gif heuristic at one path separator, so a zip that nested gifs inside a top-level wrapper folder *and* a `Gifs/` subfolder (two separators) was rejected outright by the auto-installer. The depth cap is gone — the Elgato deck-suffix regex (`*_MK_2.gif`, `*_XL_2.gif`, `*_SDPlus_2.gif`, `*_SDMini_2.gif`) is specific enough to recognise these packs at any depth.
  - `installScreensaverFromZip()` extracted entry paths verbatim, so a zip with a single top-level wrapper folder (e.g. `Pac Man Animated Screensaver V2/…`) produced an install nested one level too deep. The installer now detects a single common top-level folder across all entries and strips it during extraction.

## 0.6.0 — 2026-05-11

### Added
- **Master-format GIF support.** Older Elgato packs (e.g. "Pac Man Animated Screensaver V2") ship a full-deck animation as a per-deck-size `.gif` file at the screensaver folder root — `*_MK_2.gif` for Standard / MK.2, `*_XL_2.gif` for XL, `*_SDPlus_2.gif` for Plus, `*_SDMini_2.gif` for Mini. The library scanner now recognises these as master format and the renderer picks the file matching the configured deck size, falling back to the first available file if none match. Decoding via `omggif` with the same running-canvas disposal handling used for the per-button-tile path. Frames are pre-decoded into RGBA buffers at load so per-frame slicing is O(1).
- Auto-installer's zip sniffer now accepts master-GIF packs (`.gif` files at zip root whose names match the Elgato deck-model naming convention).

### Changed
- Master-format abstraction generalised. `WebpMasterDeck` → `MasterDeck`, with a polymorphic `getFrameRgba(idx)` so the slicer + frame-timing helpers don't care whether the source is `.webp` or `.gif`. WebP loader lives in `webpMaster.ts`, GIF loader in `gifMaster.ts`, shared bits in `masterDeck.ts`.
- `InstalledScreensaver` gains `masterFilesByDeckSize: Record<DeckSize, string | null>` — a deck-size-keyed pre-classification of master files based on Elgato's filename hints. The active-screensaver loader uses this first, falling back to `masterFiles[0]` for single-file packs (typical WebP shape).

## 0.5.4 — 2026-05-10

### Fixed
- **Manual `Start screensaver` action was immediately cancelled by its own button press** — the "reset idle on any press" trigger fires for every button press, including the one that triggered the start action, so the screensaver would activate and then immediately get stopped again, bouncing the deck back to the return page. Manual starts now get a 2-second grace window during which `reset_idle_timer` is suppressed.

## 0.5.3 — 2026-05-10

### Fixed
- **Generated `.companionconfig` triggers had broken conditions.** The page-switch triggers (activate/return) emitted `variable_value` conditions with raw string option values — Companion v4 expects each option wrapped in `{ value, isExpression }`, so when imported the conditions silently failed to evaluate (variable / op / value showed as empty in the trigger editor) and the triggers never fired. Conditions are now emitted in the wrapped shape that matches what Companion's own export produces. Existing setups with the buggy triggers need to be re-imported from a freshly-regenerated file (or manually re-pick the variable / op / value in the trigger editor).

## 0.5.2 — 2026-05-10

### Fixed
- **Master-format screensavers were saturating Companion's IPC pipe and timing out RPC calls** (config-fields fetches, action invocations) because each tile shipped at native master resolution — for a 1920×1080 master on a 5×3 grid that's 384×360 RGBA per tile (552 KB) × 15 tiles × 15 fps ≈ 120 MB/sec. Tiles are now downsampled to a max long-edge of 96 px (≈ Stream Deck button native pixels) during slicing, dropping per-frame data ~16×.

## 0.5.1 — 2026-05-10

### Fixed
- v0.5.0 packaged `main.js` but not `libwebp.wasm`, so `loadWebpMaster` threw `ENOENT: no such file or directory, open '<module>/libwebp.wasm'` at runtime. Added `build-config.cjs` with an `extraFiles` entry so `companion-module-build` ships the WASM file alongside the bundle.

## 0.5.0 — 2026-05-10

### Added
- **Master-format screensaver support.** Elgato now ships some Marketplace screensavers as a single full-deck animated `.webp` file (e.g. "Matrix Code") instead of pre-tiled per-button GIFs. The library scanner now recognises these as a `master` format, the auto-installer accepts them, and the renderer slices each animation frame into per-button tiles at runtime. One master file works for any deck size — the slicing math just adjusts to the configured grid. Decoding via `node-webpmux` (pure JS+WASM, no native deps).

### Changed
- `installedScreensaver` data shape now carries `format: 'tiles' | 'master'` plus a `masterFiles[]` list. The active-screensaver dropdown still shows both formats interchangeably; format affects only the rendering path.

### Notes
- For animations with hundreds of frames (Matrix Code is 1532 frames, ~50s), the renderer decodes one frame at a time on the tile-tick interval rather than pre-decoding the whole loop, keeping memory bounded to ~1 frame's worth of pixel data plus the sliced tile cache.

## 0.4.7 — 2026-05-10

### Fixed
- **Critical: `~/` was not being expanded for the library folder path field**, so a library path like `~/Documents/CompanionScreensavers` would extract zips into a literal `~/` subdirectory of Companion's module folder instead of the user's home — silently filling the module's install dir with up to gigabytes of bogus extractions. Path expansion is now centralised through one helper that runs everywhere a user-supplied path is used (library, incoming, manual zipPath).

## 0.4.6 — 2026-05-10

### Fixed
- **Critical: auto-installer would extract every `.zip` in the incoming folder**, including non-screensaver zips, and re-extract the same zips every 30 seconds because the resulting folders didn't match the library's screensaver-shape check. The auto-installer now (a) inspects each zip's entries and skips anything that doesn't look like an Elgato screensaver, and (b) remembers skipped/failed zips for the lifetime of the connection so they're not retried until the connection restarts or the incoming folder changes.
- **Auto-install is now refused when the library folder and the incoming folder are the same path** — extracting screensavers into the same directory we're scanning for new zips causes feedback loops and pollutes whatever folder the user picked. A clear warning is logged in that case.

## 0.4.5 — 2026-05-10

### Added
- **Incoming zip folder + auto-install.** New `incomingZipFolder` config field (default `~/Downloads`). The module scans this folder every ~30s and auto-installs any new `.zip` it hasn't seen, so dropping a file in your Downloads folder is enough — no button-press needed.
- **Dropdown picker on the manual install action.** "Install screensaver from zip" now has a dropdown listing every `.zip` in the incoming folder; pick one and press the button instead of typing a path. The textinput is still there as a fallback for files outside the watch folder.

### Changed
- Manual install action now refuses directory paths up front with a clear message ("X is a folder, not a .zip file") instead of letting AdmZip throw `EISDIR` at extract-time.

## 0.4.4 — 2026-05-10

### Added
- "Install screensaver from zip" now reports progress: logs the resolved zip + library paths the moment it starts, validates the zip exists with a clear error if not, and on success logs how many screensavers are now in the library.
- Two new variables — `last_install_result` and `last_install_at` — surface the most recent install outcome so you can put it on a button (text expression `$(Screensaver:last_install_result)`) instead of digging through Companion's logs.
- The connection's status badge briefly switches to "Installing zip…" while the action runs.

## 0.4.3 — 2026-05-10

### Added
- New `surfaceIds` config field — comma-separated list of Stream Deck surface IDs (e.g. `streamdeck:A00SA4442O4IRG`). When filled, the generated `.companionconfig` file now embeds two ready-to-go page-switch triggers — one to switch the listed surface(s) to the screensaver page when activation fires, and one to return to the main page when it exits. Multi-surface setups get one set-page action per surface.
- The "reset idle on any press" trigger is now embedded in the generated file unconditionally — no surface ID needed for it, since it just calls back into the connection.

### Changed
- The generated `.companionconfig` now uses Companion's `type: "full"` export shape so it can carry both the screensaver page and the triggers in a single import. Previously it was `type: "page"` (which can't include triggers) and the user had to add 3 triggers manually.
- Setup-file action log output is now structured around what was embedded vs. skipped: lists the auto-imported triggers up front and only prints the manual-setup steps for triggers that couldn't be embedded (e.g. when `surfaceIds` is blank).

### Notes
- Bundled-modules registry submission was rejected by Bitfocus — the module is distributed via GitHub releases for side-loading instead. See README for install instructions.

## 0.4.1 — 2026-05-10

### Added
- New `returnPage` config field — the page the deck switches back to when the screensaver exits.
- The `Generate page setup file` action now emits a fully-prefilled trigger setup checklist in its log output, so users can copy 3 triggers into Companion's Triggers tab without thinking. Includes the actual variable names, page numbers, and connection label.

### Changed
- Connection settings reorganized into 3 numbered sections (Pages & timing → Library → Advanced) with explanatory static-text headers.
- Default `targetPage` changed from 1 to 99 — keeps the screensaver page out of the way of users' main pages by default.
- "About" blurb now spells out the 3-step setup workflow up front.
- Library section explicitly tells users where to download Marketplace zips and that the file path can be anywhere.

### Notes
- Auto-trigger embedding (so the user doesn't have to add the 3 triggers manually) is deferred to v0.4.2 once we have a way to reliably target surfaces in trigger actions across multi-deck setups.

## 0.4.0 — 2026-05-10

### Removed
- **Quote-of-the-day mode** and the entire text mosaic system. The module is now focused exclusively on porting Elgato Marketplace screensavers — the mosaic text rendering needed more polish than was worth shipping in this milestone, and the GIF screensaver experience is the primary use case.
- Removed dependencies: `pureimage` and the bundled Roboto fonts (~1MB saved). Removed source files: `quoteSource.ts`, `quotes.json`, `textMosaic.ts`, `chunker.ts`, `build-config.cjs`.
- Removed actions: `refresh_quote`. Removed config fields: `quoteSource`, `customQuoteUrl`, `maxCharsPerChunk`, `quoteRevealDelayMs`, `authorRevealDelayMs`, `authorStartDelayMs`, `quoteSlots`, `authorSlots`, `displayMode`, `mosaicLayout`, `tilePixelSize`, `mosaicTextColor`, `mosaicAuthorColor`, `mosaicBgColor`, `mosaicWordRevealMs`. Removed variables: `quote_chunk_*`, `author_chunk_*`, `current_quote`, `current_author`, `last_quote_fetched_at`.

### Changed
- Generated billboard page no longer carries text expressions on each button — every cell is just the `Screensaver tile` feedback (GIF frame for that slot) plus the `Reset idle timer` action.
- Description in the manifest updated to reflect the focused scope.
- Package size: 621 KB → 24 KB.

### Notes
- Existing connections from v0.3.x will keep working: the removed config fields are simply ignored. The active screensaver, library path, deck size, and idle timeout settings are preserved.
- If you want the quote/mosaic feature back, it's preserved in the v0.3.2 git tag and can be revived once the formatting is polished.

## 0.3.2 — 2026-05-09

### Added
- New mosaic layout `row-snap` (now the default): each line of text fits entirely inside one button row and the block is top-aligned. Drastically improves legibility on physical Stream Decks because no line of text crosses a button bezel anymore.
- Config option `mosaicLayout` (`row-snap` | `centered`) to switch back to the old centered behavior.

### Why
Previously the centered layout could split a single line of text across two button rows, with the bezel slicing through the middle of letters. Row-snap sizes the font so each line fits in one row, then renders each line vertically centered in its row. Author appears in the bottom row when present and there's space.

## 0.3.1 — 2026-05-09

### Fixed
- Added `runtime.permissions.filesystem: true` to the manifest. Companion v4 sandboxes module FS access by default, which broke font loading and screensaver library scanning. With this flag, the module process gets `--allow-fs-read` and `--allow-fs-write`.
- Font path resolution now checks the bundled module root in addition to the dev `assets/fonts/` location, since `extraFiles` flattens directory structure on package.
- Font load failures are now non-fatal — the module still initializes in gif-only mode if Roboto can't be loaded.

## 0.3.0 — 2026-05-09

### Added
- **Screensaver library**: scans a configurable folder (default `~/Documents/CompanionScreensavers`) for installed screensavers, with a dropdown in the connection settings to pick the active one.
- **Auto-resolution selection**: picks the right `SD Mini` / `SD Standard` / `SD XL` / `SD Plus` subfolder based on the configured deck size, with closest-size fallback.
- **`Install screensaver from zip` action**: extracts an Elgato marketplace `.zip` directly into the library folder. Skips heavy `.streamDeckProfile` files and macOS metadata.
- **Deck size dropdown**: derives default grid dimensions per deck (Mini 3×2, Standard 5×3, XL 8×4, Plus 4×2).
- New connection config: `screensaverLibraryPath`, `screensaverId`, `deckSize`.

## 0.2.0 — 2026-05-09

### Added
- **Text mosaic display mode** (default): renders the quote as one large image painted across all 15 buttons rather than stuffing per-button text. Auto-fits font size, supports word-by-word reveal, and never constrains long words to a single button.
- **Composite mode** (`text-over-gif`): renders the text mosaic on top of an animated Elgato GIF screensaver in one composited frame.
- **Screensaver library**: scans a configurable folder (default `~/Documents/CompanionScreensavers`) for installed screensavers, with a dropdown in the connection settings to pick the active one.
- **Auto-resolution selection**: picks the right `SD Mini` / `SD Standard` / `SD XL` / `SD Plus` subfolder based on the configured deck size, with closest-size fallback.
- **`Install screensaver from zip` action**: extracts an Elgato marketplace `.zip` directly into the library folder. Skips heavy `.streamDeckProfile` files and macOS metadata.
- **Bundled Roboto font** for cross-platform text rendering with no native dependencies.
- New connection config: `displayMode`, `screensaverLibraryPath`, `screensaverId`, `deckSize`, `tilePixelSize`, `mosaicTextColor`, `mosaicAuthorColor`, `mosaicBgColor`, `mosaicWordRevealMs`.

### Changed
- Default display mode is now text-mosaic. The pre-mosaic chunk-variable behavior is preserved as `text-vars` for back-compat.
- Grid columns/rows now derive automatically from the deck size, but can still be overridden.

### Notes
- Companion connections from v0.1 will default to `text-mosaic` and the new `~/Documents/CompanionScreensavers` library path. Existing `tileFolder` paths still work as a legacy override.

## 0.1.0 — 2026-05-08

Initial release.

- Idle-timed screensaver with quote-of-the-day reveal.
- Per-slot text variable chunking.
- Optional animated GIF tile background loaded from a folder.
- Bundled built-in quotes + custom URL fetcher.
- `Generate page setup file` action that produces a `.companionconfig` for one-shot import.
