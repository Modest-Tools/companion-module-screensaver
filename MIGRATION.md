# Deploying the screensaver module to another computer

Goal: get this module running on a different machine (e.g. a show-control computer running Companion alongside a console) without trashing whatever's already configured there.

## On the new computer

1. **Install Companion v4** (4.3.x). Skip if already installed.

2. **Download the module package** from [Releases](https://github.com/Modest-Tools/companion-module-screensaver/releases). Save the latest `.tgz` (currently `screensaver-0.5.4.tgz`) to `~/Downloads`.

3. **Companion → Modules → Import module package** → pick the `.tgz`.

4. **Find this machine's Stream Deck surface ID:** Surfaces tab → click the deck → copy the ID. Looks like `streamdeck:A00SA4442O4IRG`. Different from any other deck — each has its own serial.

5. **Connections → Add Connection → "Modest: Screensaver".** In the Edit dialog:
   - **Module Version:** 0.5.4 (or latest)
   - **Idle minutes:** 10 (or whatever)
   - **Screensaver page (target):** pick an **unused** page number. If pages 1 and 2 are already in use, use 3 (and create it via Pages → Insert page after).
   - **Return page:** whichever page should be the resting state.
   - **Stream Deck surface IDs:** paste the ID from step 4.
   - **Incoming zip folder:** leave default (`~/Downloads`).
   - **Active screensaver:** leave empty for now.
   - Save.

6. **Get a screensaver on disk.** Either re-download from Elgato Marketplace on this machine, or copy the `.zip` over via USB / AirDrop / shared folder. Drop the `.zip` in `~/Downloads`. Within ~30 seconds the auto-installer extracts it. Open the connection settings → pick from the **Active screensaver** dropdown → save.

7. **Make sure the target page actually exists** in Pages. Pages tab → Insert Page After until your target page number is there.

8. **Bind a temporary button to "Generate page setup file":** any unused slot → Add action → Screensaver connection → Generate page setup file → Save → press it. That writes `~/Downloads/screensaver-setup.companionconfig`.

9. **Import the generated file surgically.** Settings → Import / Export → Import → pick the `.companionconfig`.

   > ⚠️ **Do not use Full Import — it overwrites all pages.**

   Use the two tabs at the top instead:
   - **Buttons tab:** Source page = the Screensaver page from the file. Destination page = your target page from step 5. Click "Replace page X with imported page".
   - **Triggers tab:** tick all 3 triggers. Connections behavior = Link to existing Screensaver. Click "Add to existing triggers".

10. **(Optional)** bind a button with the **Start screensaver** action so you can manually activate without waiting for idle.

## Gotchas (learned the hard way)

- **Never use Full Import.** It nukes all your existing pages. Always go through the Buttons + Triggers tabs.
- **The target page must exist before you import.** The destination dropdown only lists pages that exist.
- **Don't pick a target page that has existing buttons on it.** The import replaces page contents.
- **Surface IDs are unique per Stream Deck.** The ID from one machine will not work on another.
- The **Generate page setup file** action writes a fresh file each time you press it — re-run it after changing target / return pages or surface IDs in the config.

## Where things live

| Thing | Path |
|---|---|
| Module package | `~/Downloads/screensaver-X.Y.Z.tgz` |
| Screensaver library | `~/Documents/CompanionScreensavers/` |
| Auto-install watch folder | `~/Downloads` (or as configured) |
| Generated setup file | `~/Downloads/screensaver-setup.companionconfig` |
| Companion data dir | `~/Library/Application Support/companion/v4.3/` |
| DB backups (recover from disaster) | same folder, `db.sqlite.bak*` |
