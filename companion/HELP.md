# Screensaver

Plays Elgato Marketplace screensavers across your Stream Deck after a configurable idle period.

## Setup

1. Add a connection of type **Modest: Screensaver**.
2. Set **Idle minutes**, **Target page**, **Library folder path**, and **Deck size**.
3. Trigger the **Install screensaver from zip** action with the path to a `.zip` from [Elgato Marketplace](https://marketplace.elgato.com).
4. In the connection settings, pick the screensaver from the **Active screensaver** dropdown.
5. Trigger the **Generate page setup file** action and import the resulting `.companionconfig` to install the billboard page.

## Recommended triggers

- **On any button press → Reset idle timer** — so presses on any surface (not just the billboard page) count as activity.
- **Variable `screensaver:screensaver_active` becomes `1` → Set surface page to billboard** — auto-switches to the billboard page when the screensaver kicks in.

## Actions

- **Start screensaver** — manually trigger
- **Stop screensaver** — exit
- **Reset idle timer** — reset the inactivity counter
- **Install screensaver from zip** — extract an Elgato `.zip` into the library
- **Generate page setup file** — write a `.companionconfig` for one-shot import

## Feedbacks

- **Screensaver active** — true while showing
- **Idle warning (about to activate)** — true when remaining idle seconds is at most N
- **Screensaver tile** — pushes the per-slot GIF frame (auto-wired by the generated page)

## Variables

- `screensaver_active` — `1` while running, `0` otherwise
- `seconds_since_last_press` — live idle counter
