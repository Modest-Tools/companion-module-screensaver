# Changelog

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
