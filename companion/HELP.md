# Screensaver

Displays a quote-of-the-day style screensaver on a Stream Deck after a configurable idle period, with smart word-by-word reveal animations.

## Setup

1. Add a connection of type **Screensaver**.
2. Configure the idle timeout, refresh interval, and target page.
3. On your billboard page, place text buttons that use the chunk variables:
   - `$(screensaver:quote_chunk_1)` ... `$(screensaver:quote_chunk_N)`
   - `$(screensaver:author_chunk_1)` ... `$(screensaver:author_chunk_N)`
4. (Optional) Use the `screensaver_active` and `screensaver_idle_warning` feedbacks to style buttons.

## Actions

- **Start screensaver** — manually trigger the screensaver
- **Stop screensaver** — exit the screensaver
- **Refresh quote** — fetch a new quote and run the reveal sequence
- **Reset idle timer** — reset the inactivity counter

## Variables

- `quote_chunk_1` … `quote_chunk_N` — quote chunks (smart-grouped words)
- `author_chunk_1` … `author_chunk_N` — author chunks
- `screensaver_active` — `1` while running, `0` otherwise
- `current_quote`, `current_author` — full text
- `seconds_since_last_press` — live idle counter
- `last_quote_fetched_at` — ISO timestamp of last fetch
