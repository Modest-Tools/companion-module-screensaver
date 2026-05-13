# Framebuffer rewrite — prototype branch

This directory tracks the parallel framebuffer-architecture work, kept separate from the
side-load module on `main` so v0.7.x users aren't affected.

## Status

**Blocked on maintainer alignment.** No Companion-core API for page-level overlays
exists yet. The next move is posting `PROPOSAL.md` as a comment on
[bitfocus/companion#428](https://github.com/bitfocus/companion/issues/428) and
waiting for haakonnessjoen's response.

## What's here

- `PROPOSAL.md` — design proposal to post on issue #428. Built on the new
  layered-elements model from [PR #4098](https://github.com/bitfocus/companion/pull/4098)
  (graphics overhaul, merged April 2026).
- `src/` — placeholder for the rewritten module. Populated only after the
  Companion-core API is settled.

## Code to port over from the side-load module when the time comes

The framebuffer rewrite drops most of the per-button machinery but keeps the
input-handling pieces. From `../src/`:

- `gifMaster.ts` — GIF master decoder. Pre-decodes RGBA frames; the rewrite just
  pushes whole frames to the page overlay instead of slicing per-tile.
- `webpMaster.ts` — same idea for animated WebP.
- `screensaverLibrary.ts` — library scanner (Elgato Marketplace `.zip` shapes,
  master GIF naming conventions, `Gifs/` subfolder handling). All still relevant.
- `idleTracker.ts` — idle detection, if the core doesn't end up owning idle/wake.
- `setupFile.ts` — `.companionconfig` generator. Probably obsolete in a framebuffer
  world (no per-button feedbacks to wire up), but the trigger-generation portion
  might still be useful if activation stays module-driven.

What gets dropped:

- `masterDeck.ts` — per-tile slicing logic. Companion-core's renderer does the
  per-cell slicing now.
- `feedbacks.ts` — no more `screensaver_tile` feedback (that's the architecture
  the maintainer rejected).
- `presets.ts` slot grid — same reason.
- Tile-tick interval that fires `checkFeedbacks` — replaced by direct frame pushes
  to the overlay layer at whatever cadence the API expects.

## Pending decisions (from PROPOSAL.md)

1. Element list (reusing #4098 schema) vs raw pixel buffer
2. Page-scoped vs surface-group-scoped
3. Idle/activation: core-driven or module-driven

Once the maintainer picks, prototype work starts here.
