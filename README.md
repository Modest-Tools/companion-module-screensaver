# companion-module-screensaver

A Bitfocus Companion module that plays **Elgato Stream Deck screensavers** across your deck after an idle period — a pure-JS port of the screensaver feature in Elgato's native Stream Deck app, so any animated screensaver from the [Elgato Marketplace](https://marketplace.elgato.com) works on Companion-controlled decks.

> Status: early. Working on real hardware via Companion's local module import. Distributed as side-loaded `.tgz` releases — not in the official bundled-modules registry.

## What it does

- 🖼️ **Elgato Marketplace port** — drop a screensaver `.zip` into the **Install screensaver from zip** action and the module unpacks it into your library, picks the right resolution for your deck (Mini / Standard / XL / Plus), and starts animating across all your buttons after the configured idle period.
- ⏱️ **Idle detection** — configurable timeout, with a "warning" feedback that triggers shortly before activation so you can flash a key.
- 🔄 **One-click page setup** — a `Generate page setup file` action writes a `.companionconfig` you import via Companion's Settings → Import to install all the billboard buttons in one shot, pre-wired with the screensaver tile feedback and idle reset on press.
- 🛑 **Auto-dismiss** — pressing any button on the billboard page resets the idle timer and exits the screensaver.
- 📂 **Multi-screensaver library** — keep several installed; pick the active one from a dropdown without redoing your billboard page.

## Quick start

### 1. Install the module

This module is distributed as a side-loaded package only (it isn't in the Companion bundled-modules registry):

1. Download the latest `.tgz` from [Releases](https://github.com/Modest-Tools/companion-module-screensaver/releases).
2. In Companion: **Modules → Import module package** → pick the `.tgz`.

(Or build from source — see [Development](#development).)

### 2. Add the connection

**Connections → Add Connection → Modest: Screensaver**. The settings page is grouped into three numbered sections — fill them top to bottom:

1. **Pages & timing**: idle minutes, screensaver page (default 99 — kept out of the way), return page (where to switch back to when the screensaver exits).
2. **Screensaver library**: folder path (default `~/Documents/CompanionScreensavers`, auto-created), deck size, and the active screensaver dropdown (empty until you install one).
3. **Advanced**: animation FPS, legacy raw-folder override.

### 3. Install a screensaver from the Elgato Marketplace

Module actions in Companion don't appear in their own menu — you run them by binding them to a button (or a trigger) and firing it. For one-shot setup actions like this, the easiest pattern is a temporary "setup" page:

1. Download a screensaver `.zip` from [marketplace.elgato.com](https://marketplace.elgato.com) (Stream Deck → Screensavers). Save it anywhere — `~/Downloads` works (the action expands `~/`).
2. In Companion: **Buttons** tab → pick any unused button on a temporary page → **Add action** → choose your **Screensaver** connection → pick **Install screensaver from zip**.
3. Paste the path to the `.zip` (e.g. `~/Downloads/some-screensaver.zip` or the absolute `/Users/you/Downloads/...`) into the action's **Path to .zip file** field. Save the button.
4. Press the button on your deck (or the soft-press in Companion's UI). Watch the connection's **View Logs** for `Installed screensaver "..."`.
5. Open the connection settings — your screensaver now appears in the **Active screensaver** dropdown. Pick it.

You can delete the temporary install button afterward.

### 4. Set Stream Deck surface IDs (recommended)

Open **Connections → your Screensaver connection → Edit** and fill in **Stream Deck surface IDs** with the deck(s) you want the screensaver to take over. Find the IDs in **Surfaces** (e.g. `streamdeck:A00SA4442O4IRG`); separate multiple decks with commas. This is optional — but if you set it, the next step embeds ready-made page-switch triggers for those surfaces. If you leave it blank you'll add A and B manually (the README below tells you how).

### 5. Generate the billboard page + triggers

Run the **Generate page setup file** action the same way you ran the install action — bind it to a temporary button and press it. It does both things in one shot:

- Writes `~/Downloads/screensaver-setup.companionconfig`. Import it via **Settings → Import / Export → Import**. The file installs:
  - The screensaver billboard page at the configured target page (default 99) — all buttons pre-wired with the per-slot GIF tile feedback and idle-reset on press.
  - The **Reset idle on any press** trigger (always embedded — no surface ID needed).
  - **If you filled in `Stream Deck surface IDs`:** the **switch to billboard** and **return to main** triggers, with one set-page action per surface, pre-wired to the right pages.
- Logs the import summary in the connection's **View Logs** — including manual setup steps for any triggers we couldn't embed (only relevant if you skipped step 4).

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
