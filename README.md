# companion-module-screensaver

A Bitfocus Companion module that turns your Stream Deck into a screensaver after an idle period. Pick from two modes: **animated GIF tiles** (port of Elgato's Stream Deck screensavers, including marketplace zips) or **text mosaic** (a quote painted across the entire deck like a single image instead of cramming text into each button).

> Status: early. Working on real hardware via Companion's local module import. Not yet in the official Companion bundled-modules registry.

## Features

- 🖼️ **Elgato screensaver port** — drop an Elgato Marketplace `.zip` into your library folder and the module unpacks it, picks the right resolution for your deck (Mini / Standard / XL / Plus), and animates it across all your buttons.
- ✏️ **Text mosaic** — quotes render as a single image painted across all 15 buttons, with auto-fit font sizing and word-by-word reveal. Long words can span multiple buttons; the type isn't constrained per-tile.
- 🌐 **Quote sources** — bundled built-in quotes, or point at any JSON URL that returns `{ quote, author }`.
- 🎛️ **Composite mode** — text mosaic over the GIF background for a polished Elgato-style look.
- ⏱️ **Idle detection** — configurable timeout, with a "warning" feedback that triggers shortly before activation.
- 🔄 **One-click page setup** — a `Generate page setup file` action writes a `.companionconfig` file you import via Companion's Settings → Import to install all 15 billboard buttons in one shot.
- 🛑 **Auto-dismiss** — any button press while the screensaver is active resets the idle timer and exits.

## Quick start

### 1. Install the module

Until this module lands in Companion's official store, install it locally:

```bash
git clone https://github.com/Modest-Tools/companion-module-screensaver.git
cd companion-module-screensaver
npm install
npm run build
./node_modules/.bin/companion-module-build
```

That produces `screensaver-<version>.tgz`. In Companion: **Modules → Import module package** → pick that file.

### 2. Add the connection

**Connections → Add Connection → Modest: Screensaver**.

### 3. Generate the billboard page

In your billboard page (default page 1), use the **Generate page setup file** action once. It writes `~/Downloads/screensaver-setup.companionconfig`. Import that file via **Settings → Import / Export → Import** and pick a target page. All 15 mosaic buttons appear pre-wired.

### 4. (Optional) Install an Elgato screensaver

1. Download a screensaver `.zip` from [marketplace.elgato.com](https://marketplace.elgato.com).
2. Use the **Install screensaver from zip** action with the path to the `.zip`. The module extracts it into your library folder (defaults to `~/Documents/CompanionScreensavers`).
3. Open the connection settings and pick the screensaver from the **Active screensaver** dropdown.

### 5. (Optional) Wire a custom quote URL

Set **Quote source** to *Custom URL* and provide a URL that returns:

```json
{ "quote": "Your text here.", "author": "Source name" }
```

Refresh interval is configurable (default 3 minutes).

## Display modes

| Mode | What you see |
|---|---|
| **Text mosaic** *(default)* | Quote rendered as one image painted across all buttons. No GIF background. |
| **Text mosaic over GIF** | Quote layered on top of an animated Elgato screensaver. |
| **GIF only** | Animated screensaver with no text. |
| **Legacy: per-button text variables** | The pre-mosaic behavior — chunks the quote into text variables per slot. Kept for back-compat. |

## Actions

| Action | Description |
|---|---|
| `Start screensaver` | Manually trigger the screensaver. |
| `Stop screensaver` | Manually exit the screensaver. |
| `Refresh quote` | Pick a new quote and re-run the reveal. |
| `Reset idle timer` | Mark activity (already wired into every billboard button). |
| `Install screensaver from zip` | Extract an Elgato `.zip` into the library folder. |
| `Generate page setup file` | Write a `.companionconfig` you import to install the billboard page. |

## Feedbacks

| Feedback | Use it for |
|---|---|
| `Screensaver active` | Boolean — true while the screensaver is showing. |
| `Idle warning` | Boolean — true when the deck is about to go idle (configurable threshold). |
| `Screensaver tile` | Advanced — pushes the per-slot image buffer. Wired automatically by the generated billboard page. |

## Variables

| Variable | Value |
|---|---|
| `screensaver_active` | `1` while showing, `0` otherwise |
| `seconds_since_last_press` | Live counter |
| `current_quote` | The full text of the current quote |
| `current_author` | The author of the current quote |
| `last_quote_fetched_at` | ISO timestamp |
| `quote_chunk_N` / `author_chunk_N` | Legacy per-slot text variables (only populated in `text-vars` mode) |

## Library folder layout

When you install screensavers from zip, they end up at:

```
<libraryPath>/<screensaver name>/Profiles/Wallpaper GIFs/SD Standard/Standard Pad 1.gif
                                                          /SD Mini/Mini Pad 1.gif
                                                          /SD XL/XL Pad 1.gif
                                                          /SD Plus/Plus Pad 1.gif
```

The module auto-picks the subfolder matching the configured **Deck size**, and falls back to the closest available size if the requested one isn't included in the zip.

## Idle detection — required setup

The Companion module SDK doesn't expose a global "any button pressed" event. Idle detection works in two ways:

1. **Automatic** for buttons on the screensaver's billboard page — every generated chunk button calls `Reset idle timer` on press.
2. **Recommended for everything else** — add a Companion **Trigger**:
   - Triggers → New Trigger → On any button press → Action: `Screensaver — Reset idle timer`

With that trigger in place, presses on every surface reset the idle counter.

## Switching to the billboard page

Modules can't directly drive page navigation. Add a second Trigger:

1. Event type: **Variable changes** → `screensaver:screensaver_active` becomes `1`
2. Action: `internal — Set surface page` → set all your surfaces to the configured billboard page

## Development

```bash
npm install
npm run dev   # tsc --watch
```

Then in another terminal, build the package and re-import:

```bash
./node_modules/.bin/companion-module-build
```

The output `.tgz` goes in **Modules → Import module package**. After importing a new version, open the connection's edit dialog and switch the **Module Version** to match.

## License

MIT — see [LICENSE](LICENSE).

## Credits

- Built on [@companion-module/base](https://github.com/bitfocus/companion-module-base).
- Text rendering via [pureimage](https://github.com/joshmarinacci/node-pureimage) (pure-JS, no native deps).
- GIF decoding via [omggif](https://github.com/deanm/omggif).
- Bundled font: [Roboto](https://fonts.google.com/specimen/Roboto) (Apache 2.0).
- Elgato Stream Deck and the Marketplace are trademarks of Elgato Systems. This module is unaffiliated.
