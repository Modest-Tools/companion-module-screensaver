# companion-module-screensaver

A Bitfocus Companion module that plays **Elgato Stream Deck screensavers** across your deck after an idle period. Drop a `.zip` from the [Elgato Marketplace](https://marketplace.elgato.com), pick a screensaver from a dropdown, import one config file — done.

> Distributed as side-loaded `.tgz` releases. Not in the official bundled-modules registry (architectural mismatch — see [bitfocus/companion#428](https://github.com/bitfocus/companion/issues/428)).

## Quick start

### 1. Install the module

Download the latest `.tgz` from [Releases](https://github.com/Modest-Tools/companion-module-screensaver/releases), then in Companion: **Modules → Import module package** → pick the `.tgz`.

### 2. Add the connection

**Connections → Add Connection → Modest: Screensaver**.

Defaults work out of the box. Only thing to set if it doesn't match: **Deck size** (Mini / Standard / XL / Plus). Optionally fill in **Stream Deck surface IDs** (comma-separated, e.g. `streamdeck:A00SA4442O4IRG`, find them in Companion → Surfaces) so step 4 can auto-embed page-switch triggers for those decks.

### 3. Install a screensaver

Drop an Elgato `.zip` into `~/Downloads` (or whatever you set as **Incoming zip folder**). The module auto-installs within ~30 seconds. Then pick it from the **Active screensaver** dropdown in the connection settings.

That covers the easy path. For one-off paths outside the watcher, use the `Install screensaver from zip` action.

### 4. Generate the billboard page + triggers

Run the **Generate page setup file** action — easiest is dropping the matching preset onto a temp button and pressing it. It writes `~/Downloads/screensaver-setup.companionconfig`. Import via **Settings → Import / Export → Import**. The file installs:

- The screensaver page (default page 99) — all tile buttons pre-wired with per-slot animation feedback and idle-reset on press.
- A `Reset idle on any press` trigger.
- If you set `Stream Deck surface IDs` in step 2: the `switch to billboard` and `return to main` triggers, pre-wired to your decks.

Done — after the configured idle period, the deck takes over with the screensaver. Tap any button to exit.

## What it does

- **Elgato Marketplace port** — unpacks `.zip` files into a library folder, picks the right resolution for your deck, animates across the buttons.
- **Idle detection** — configurable timeout, with an `Idle warning` feedback for flashing a key before activation.
- **Multi-screensaver library** — install several, pick the active one from a dropdown.
- **Master-format support** — single-file `.webp` and `.gif` packs (one full-deck animation sliced into per-button tiles at runtime).
- **Auto-install watcher** — drop zips in a folder, they install in the background.

## Reference

### Actions
| Action | Description |
|---|---|
| `Start screensaver` | Manually trigger the screensaver. |
| `Stop screensaver` | Manually exit. |
| `Reset idle timer` | Mark activity (already wired into every billboard button). |
| `Install screensaver from zip` | One-off install from any `.zip` path. |
| `Generate page setup file` | Write a `.companionconfig` for one-shot page + trigger import. |

### Feedbacks
| Feedback | Use it for |
|---|---|
| `Screensaver active` | Boolean — true while the screensaver is showing. |
| `Idle warning (about to activate)` | Boolean — true when remaining idle seconds is below a configurable threshold. |
| `Screensaver tile (animated background)` | Advanced — the per-slot animation image. Wired automatically by the generated page. |

### Variables
| Variable | Value |
|---|---|
| `screensaver_active` | `1` while showing, `0` otherwise |
| `seconds_since_last_press` | Live counter, updated every second |
| `last_install_result` | Result of the most recent install (auto or manual) |
| `last_install_at` | Timestamp of the last install attempt |

## Library folder layout

The auto-installer accepts both Elgato pack shapes:

```
<libraryPath>/<screensaver name>/Profiles/Wallpaper GIFs/SD Standard/...   ← per-deck-size tile folders
<libraryPath>/<screensaver name>/something.webp                            ← single-file master (any size deck)
<libraryPath>/<screensaver name>/something_MK_2.gif                        ← per-deck-size master GIFs
<libraryPath>/<screensaver name>/Gifs/something_MK_2.gif                   ← same, nested
```

Drop any animated `.gif` into a subfolder of the library and it'll be picked up as a master screensaver — aspect ratio should roughly match your deck (5:3 for Standard MK.2, 2:1 for XL/Plus, 3:2 for Mini).

## Development

```bash
git clone https://github.com/Modest-Tools/companion-module-screensaver.git
cd companion-module-screensaver
yarn install
yarn run build
yarn run package
```

Output is `screensaver-<version>.tgz`. Import via **Modules → Import module package** in Companion.

## License

MIT — see [LICENSE](LICENSE).

## Credits

- Built on [@companion-module/base](https://github.com/bitfocus/companion-module-base).
- GIF decoding via [omggif](https://github.com/deanm/omggif), WebP via [node-webpmux](https://github.com/LeMisterV/node-webpmux).
- Zip extraction via [adm-zip](https://github.com/cthackers/adm-zip).
- Elgato Stream Deck and the Elgato Marketplace are trademarks of Elgato Systems. This module is unaffiliated; it just reads the public `.zip` format their marketplace exports.
