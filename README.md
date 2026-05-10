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

**Connections → Add Connection → Modest: Screensaver**.

Configure:
- **Idle minutes before activation** — how long with no input before the screensaver kicks in.
- **Target billboard page** — which Companion page to render the screensaver on.
- **Library folder path** — where installed screensavers are stored. Defaults to `~/Documents/CompanionScreensavers`.
- **Deck size** — Mini / Standard / XL / Plus. Used to pick the right tile resolution.
- **Active screensaver** — dropdown of screensavers in your library. Empty until you install one.

### 3. Install a screensaver from the Elgato Marketplace

1. Download a screensaver `.zip` from [marketplace.elgato.com](https://marketplace.elgato.com) (filter for screensavers).
2. Trigger the **Install screensaver from zip** action with the path to the `.zip`.
3. Open the connection settings — your screensaver appears in the **Active screensaver** dropdown. Pick it.

### 4. Generate the billboard page

Use the **Generate page setup file** action once. It writes `~/Downloads/screensaver-setup.companionconfig`. Import it via **Settings → Import / Export → Import** and pick a target page. All the buttons appear pre-wired — each cell shows its corresponding screensaver tile via the `Screensaver tile` feedback, and presses reset the idle timer.

### 5. (Recommended) Wire global idle reset

The Companion module SDK doesn't expose a global "any button pressed" event, so by default only presses on the billboard page count as activity. Add a Companion **Trigger** to fix that:

- Triggers → New Trigger → **On any button press** → Action: `Modest: Screensaver — Reset idle timer`

Now presses on every surface reset the idle counter.

### 6. (Recommended) Auto-switch to the billboard page

Modules can't directly drive page navigation. Add a second Trigger:

- **Variable changes** → `screensaver:screensaver_active` becomes `1` → Action: `internal — Set surface page` → set your surfaces to the billboard page.

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
