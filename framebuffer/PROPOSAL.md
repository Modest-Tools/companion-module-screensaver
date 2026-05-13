# PageOverlayLayer — proposal for issue #428

> This is a design proposal intended to be posted as a comment on
> [bitfocus/companion#428](https://github.com/bitfocus/companion/issues/428).
> Edit before posting if you want; the goal is to land on an API shape
> that haakonnessjoen is willing to merge before we write code.

---

## Proposal: a `PageOverlayLayer` so animated backgrounds compose with PR #4098's element model

Following up on my [May 10 comment](https://github.com/bitfocus/companion/issues/428#issuecomment-4415819619) — instead of just offering decoder/slicer code, I want to put a concrete API shape on the table so we can converge before anyone writes code.

I think the recently-merged graphics overhaul ([#4098](https://github.com/bitfocus/companion/pull/4098)) actually changes the answer here significantly. The per-button render pipeline now goes through an ordered element list (`StyleLayersModel` — `elements[0]` is a `canvas` background, then text/image layers on top). That makes a page-level overlay much cleaner to add than it would have been pre-#4098: we don't have to invent a new composition pipeline, we just need a page-scoped element list that gets composited *under* `elements[0]` of every button on that page, clipped to each button's grid cell.

### Concept

```
┌─────────── page render order ───────────┐
│ 4. button elements[N]   (text overlays) │ ← existing per-button
│ 3. button elements[1]   (button image)  │ ← existing per-button
│ 2. button elements[0]   (button bg)     │ ← existing per-button
│ 1. PageOverlayLayer elements[0..N]      │ ← NEW, page-scoped
└─────────────────────────────────────────┘
```

A `PageOverlayLayer` is a page-scoped element list using the same schema as `StyleLayersModel` (or a deliberately-trimmed subset). Each cell of the page grid gets the slice of the overlay corresponding to its position — so a single `canvas`-type element with an animated source becomes a full-deck animation behind whatever per-button styling the user has set. Buttons with opaque backgrounds occlude it; buttons with transparent / no background let it show through.

### How it composes with PR #4098

The Renderer ([`companion/lib/Graphics/Renderer.ts`](https://github.com/bitfocus/companion/blob/main/companion/lib/Graphics/Renderer.ts)) currently renders each button from a single `StyleLayersModel`. The change is essentially: before drawing a button's own `elements[0]`, fetch the page's overlay (if any), compute the slice for this button's `(row, col)` based on the page's `GridSize`, and draw that slice as a pre-layer. Then the existing per-button layers draw on top normally.

Possible touchpoints (from a quick read of the source — not authoritative):

- `companion/lib/Graphics/Renderer.ts` — composition entry point
- `companion/lib/Graphics/LayeredProcessedStyleGenerator.ts` — element list processing
- `shared-lib/lib/Graphics/LayeredRenderer.ts` — `backgroundElement` lookup logic
- `shared-lib/lib/Model/StyleLayersModel.ts` — sibling for the new `PageOverlayModel`
- `companion/lib/Page/Controller.ts` (or wherever page state lives) — store/retrieve the overlay per page

### What I want your input on before any code

1. **Element list, or raw pixel buffer?** Reusing the #4098 element schema feels right (one canvas element with a source binding = animated background; multiple elements = composed overlay). But if you'd rather it be a raw RGBA buffer pushed by modules, that's a smaller API surface — at the cost of dropping the composition power #4098 just unlocked.

2. **Page-scoped or surface-group-scoped?** Page-scoped is simpler. Surface-group-scoped is what you described earlier (spans multiple physical devices). The two aren't mutually exclusive — page-scoped is a subset — but the data model and storage location differ. Do you have a preference, or has the v5 surface-group model evolved enough that this should target groups directly?

3. **Idle/activation: core or module-driven?** Two reasonable answers:
   - **Module-driven:** the module exposes `Set page overlay` / `Clear page overlay` actions and the user wires them to triggers (idle, time-of-day, manual button, whatever). Core just stores and renders the overlay.
   - **Core-driven:** core owns an idle-timeout setting per page/group, fires "show overlay" / "hide overlay" itself, and exposes events modules can subscribe to.

   The first is more flexible and matches Companion's general "core is dumb, modules drive" pattern. The second is what users probably *expect* a "screensaver" feature to be. I lean toward the first — but you tell me.

### What I'll contribute

Once you confirm a direction, I'll:

- Open a draft PR against `bitfocus/companion` implementing the chosen API (model + renderer changes + storage).
- Rewrite the screensaver module ([Modest-Tools/companion-module-screensaver](https://github.com/Modest-Tools/companion-module-screensaver)) against it.
- Port over the existing Elgato Marketplace `.zip` library scanner, GIF/WebP master decoders, and idle helpers from the current side-load module so this lands as a usable feature, not just a demo.

The current per-button-feedback approach in the side-load module stays around for users who already deployed it; nothing breaks.

Happy to break this into separate issues if that's how you'd rather scope it.
