# Framebuffer rewrite — prototype branch

This directory tracks the parallel framebuffer-architecture work, kept separate from the
side-load module on `main` so v0.7.x users aren't affected.

## Status

**Blocked on maintainer alignment.** The design proposal lives in `PROPOSAL.md` and
was posted as a comment on
[bitfocus/companion#428](https://github.com/bitfocus/companion/issues/428#issuecomment-4443793705)
on 2026-05-13. We're waiting on haakonnessjoen's response to converge on the
Companion-core API shape before any module code becomes real.

Pre-ported code lives in `src/` so we're ready to plug in as soon as the API
lands.

## What's here

### `PROPOSAL.md`

The design proposal: `PageOverlayLayer` as a page-scoped element list composited
under each button's existing layers, sliced per-cell by the page `GridSize`,
building on the layered-element model from
[PR #4098](https://github.com/bitfocus/companion/pull/4098) (graphics overhaul,
merged April 2026).

### `src/` — ported / API-agnostic code

These don't depend on the eventual rendering API and are usable as-is:

| File | Purpose |
|---|---|
| `masterFrame.ts` | `MasterSource` type — abstract full-deck animation source. `frameIndexAtTime()` helper for wall-clock-to-frame lookup. Drops the per-tile slicing fields the side-load module needed. |
| `gifMaster.ts` | Animated-GIF master decoder. Pre-decodes all frames to RGBA (cheap for typical Elgato pack sizes). |
| `webpMaster.ts` | Animated-WebP master decoder. Decodes on-demand (some Elgato WebP packs are huge — Matrix Code is 1532 × 1920×1080). |
| `library.ts` | Library scanner: handles Elgato `.zip` install, `Gifs/` subfolder shapes, master-file deck-size classification. Lifted verbatim from the side-load module. |
| `idle.ts` | Idle tracker. Used only if activation stays module-driven. If the maintainer goes core-driven, this drops out. |
| `omggif.d.ts` / `node-webpmux.d.ts` | Module type declarations. |

### `src/main.ts` — entry-point stub

Sketches the playback loop, lifecycle (start/stop), and library wiring. The
parts that depend on the Companion-core API are marked `[awaiting API]` with
likely-shape comments. Specifically:

- `start()` / `stop()` — telling Companion to install/clear our page overlay
- `pushFrame()` — shipping the current frame's RGBA buffer to the overlay
- `onButtonPress()` / `tickIdle()` — only meaningful if activation is
  module-driven; if core-driven these go away

## What's intentionally NOT here yet

| Concern | When it lands |
|---|---|
| `package.json`, `manifest.json`, `tsconfig.json`, `dist/` build | After API shape is settled |
| Module ID, action/feedback/variable schema | After API shape is settled |
| Separate repo (`companion-module-screensaver-fb`) | After we have something worth deploying |
| Companion-core PR | After API agreement |

## Open questions (in `PROPOSAL.md`)

1. **Element list or raw pixel buffer?** Reuse the #4098 element schema, or a separate raw RGBA channel?
2. **Page-scoped or surface-group-scoped?** Page is simpler; surface-group can span devices (which was the maintainer's earlier ask).
3. **Idle/activation: core or module-driven?** Maps directly onto whether `idle.ts` and `onButtonPress`/`tickIdle` survive into the final module.

## What gets dropped from the side-load module

Reference, not action — these stay on `main` for v0.7.x users:

- `src/masterDeck.ts` — per-tile slicing logic. Companion-core's renderer
  does per-cell slicing now.
- `src/feedbacks.ts` — no more `screensaver_tile` feedback (the architecture
  the maintainer rejected).
- `src/presets.ts` slot grid — same reason.
- `src/setupFile.ts` — no per-button feedbacks to wire up, so no
  `.companionconfig` generator. Trigger generation may survive if activation
  stays module-driven.
- Tile-tick `setInterval` that fires `checkFeedbacks` — replaced by direct
  frame pushes to the page overlay.
