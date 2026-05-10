# companion-module-screensaver

A Bitfocus Companion module that plays **Elgato Stream Deck screensavers** across your deck after an idle period — a pure-JS port of the screensaver feature in Elgato's native Stream Deck app, so any animated screensaver from the [Elgato Marketplace](https://marketplace.elgato.com) works on Companion-controlled decks.

> Status: early. Working on real hardware via Companion's local module import. Submission to the official Companion bundled-modules registry is in flight.

## What it does

- 🖼️ **Elgato Marketplace port** — drop a screensaver `.zip` into the **Install screensaver from zip** action and the module unpacks it into your library, picks the right resolution for your deck (Mini / Standard / XL / Plus), and starts animating across all your buttons after the configured idle period.
- ⏱️ **Idle detection** — configurable timeout, with a "warning" feedback that triggers shortly before activation so you can flash a key.
- 🔄 **One-click page setup** — a `Generate page setup file` action writes a `.companionconfig` you import via Companion's Settings → Import to install all the billboard buttons in one shot, pre-wired with the screensaver tile feedback and idle reset on press.
- 🛑 **Auto-dismiss** — pressing any button on the billboard page resets the idle timer and exits the screensaver.
- 📂 **Multi-screensaver library** — keep several installed; pick the active one from a dropdown without redoing your billboard page.

## Quick start

### 1. Install the module

Until this lands in Companion's official store, install it as a local package:

1. Download the latest `.tgz` from [Releases](https://github.com/Modest-Tools/companion-module-screensaver/releases).
2. In Companion: **Modules → Import module package** → pick the `.tgz`.

(Or build from source — see [Development](#development).)

### 2. Add the connection

**Connections → Add Connection → Modest: Screensaver**. The settings page is grouped into three numbered sections — fill them top to bottom:

1. **Pages & timing**: idle minutes, screensaver page (default 99 — kept out of the way), return page (where to switch back to when the screensaver exits).
2. **Screensaver library**: folder path (default `~/Documents/CompanionScreensavers`, auto-created), deck size, and the active screensaver dropdown (empty until you install one).
3. **Advanced**: animation FPS, legacy raw-folder override.

### 3. Install a screensaver from the Elgato Marketplace

1. Download a screensaver `.zip` from [marketplace.elgato.com](https://marketplace.elgato.com) (Stream Deck → Screensavers). Save it anywhere — `~/Downloads` is fine.
2. Trigger the **Install screensaver from zip** action with the path to the `.zip`. The module unpacks it into your library folder.
3. Open the connection settings — your screensaver appears in the **Active screensaver** dropdown. Pick it.

### 4. Generate the billboard page + triggers

Run the **Generate page setup file** action once. It does two things:

- Writes `~/Downloads/screensaver-setup.companionconfig`. Import it via **Settings → Import / Export → Import** and pick the screensaver page from step 2 — all buttons appear pre-wired with the per-slot GIF tile feedback and idle-reset on press.
- Logs an exact 3-trigger setup checklist to the connection's **View Logs**, with your variable names and page numbers prefilled. Open Companion's **Triggers** tab and create the three triggers it lists. They handle:
  - Auto-switching to the screensaver page when activating
  - Switching back to your return page when exiting
  - Resetting the idle timer on any button press anywhere on the deck

After that, idle for the configured timeout and the deck takes over with the screensaver. Tap any button to exit and return to your main page.

## Actions

| Action | Description |
|---|---|
| `Start screensaver` | Manually trigger the screensaver. |
| `Stop screensaver` | Manually exit the screensaver. |
| `Reset idle timer` | Mark activity (already wired into every billboard button). |
| `Install screensaver from zip` | Extract an Elgato `.zip` into the library folder. |
| `Generate page setup file` | Write a `.companionconfig` you import to install the billboard page. |

## Feedbacks

| Feedback | Use it for |
|---|---|
| `Screensaver active` | Boolean — true while the screensaver is showing. |
| `Idle warning (about to activate)` | Boolean — true when remaining idle seconds is below a configurable threshold. Useful for flashing a key before the screensaver kicks in. |
| `Screensaver tile (animated background)` | Advanced — pushes the per-slot animated GIF tile image. Wired automatically by the generated billboard page. |

## Variables

| Variable | Value |
|---|---|
| `screensaver_active` | `1` while showing, `0` otherwise |
| `seconds_since_last_press` | Live counter, updated every second |

## Library folder layout

Installed screensavers end up at:

```
<libraryPath>/<screensaver name>/Profiles/Wallpaper GIFs/SD Standard/Standard Pad 1.gif
                                                          /SD Mini/Mini Pad 1.gif
                                                          /SD XL/XL Pad 1.gif
                                                          /SD Plus/Plus Pad 1.gif
```

The module auto-picks the subfolder matching the configured **Deck size**, and falls back to the closest available size if the requested one isn't included in the zip.

## Development

```bash
git clone https://github.com/Modest-Tools/companion-module-screensaver.git
cd companion-module-screensaver
yarn install
yarn run build
yarn run package
```

Output is `screensaver-<version>.tgz`. Import via **Modules → Import module package** in Companion. After importing a new version, open the connection's edit dialog and switch the **Module Version** to match.

## License

MIT — see [LICENSE](LICENSE).

## Credits

- Built on [@companion-module/base](https://github.com/bitfocus/companion-module-base).
- GIF decoding via [omggif](https://github.com/deanm/omggif).
- Zip extraction via [adm-zip](https://github.com/cthackers/adm-zip).
- Elgato Stream Deck and the Elgato Marketplace are trademarks of Elgato Systems. This module is unaffiliated; it just reads the public `.zip` format their marketplace exports.
