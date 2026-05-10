# Changelog

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
