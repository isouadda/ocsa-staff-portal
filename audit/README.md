# The audit suite

One command walks every screen the portal can show, in English and in
Spanish, at all four text sizes, on a 375 pixel screen.

```
npm run audit
```

It builds the app, serves the build, drives it in a headless browser, and
prints one table. It exits non-zero when anything failed.

**Every portal build from now on runs this and pastes the table in its
pull request.**

## What it checks

On every screen and every sheet, in both languages, at every text size:

- the page does not scroll sideways
- no text is cut off, by its own box or by an ancestor
- every control can be tapped: with the control scrolled into view, a hit
  test at its center resolves to that control and not to something over it
- every control is at least 44 by 44
- no English text shows on a Spanish screen, judged against the app's own
  word table
- the bottom bar sits inside the screen, measured on every screen, since
  two faults have already landed there

Then it walks the journeys a person actually takes, in both languages,
and judges each one first on what the app sent and then on what the
screen said.

## Coverage proves itself

`audit/inventory.js` reads the tabs, the sign in screens and the full
screen sheets out of `src` and reconciles them against the cases the
suite drives. **A screen or a sheet with no case prints `NO CASE` and
fails the run**, so a screen added tomorrow cannot land untested.

## Known failures

`audit/known.json` holds what the app gets wrong today. Each entry names
the check, the text that identifies it, the screen it is on, and one line
on why.

- A known failure prints as `KNOWN` on every run and does not fail it.
- **A known failure that starts passing fails the run** until it is taken
  off the list, so a fix is always noticed.

The next build fixes them and removes them. The suite never changes
anything under `src/`.

## How it is put together

| File | What it holds |
| --- | --- |
| `run.js` | the one process: build, serve, drive, print the table, set the exit code |
| `serve.js` | a static server for the build, on Node's own http module |
| `stub.js` | the whole API in one file, so the next build extends it in one place. Every value in it is invented |
| `browser.js` | a phone shaped page with the clock fixed and storage seeded |
| `inventory.js` | what the app can show, read out of `src`, and what the suite drives |
| `checks.js` | the checks every screen is put through |
| `screens.js` | how each screen and sheet is reached, and the sweep |
| `journeys.js` | the journeys, in both languages |
| `known.js` | the known failure list and how a row is matched to it |
| `known.json` | what the app gets wrong today |
| `words.js` | the app's Spanish table, read without importing it |

## The clock

Fixed at 9:30 PM on Thursday, October 1, 2026, in America/New_York. That
is already October 2 in UTC, so a date read as UTC midnight shows a day
early and the suite catches it.

## Options

- `npm run audit -- --no-build` drives the build already in `build/`.
- `AUDIT_PORT=4788` sets the port the build is served on.
- `AUDIT_ONLY=screens` or `AUDIT_ONLY=journeys` runs one half, which is
  what you want while working on a single case.
- `AUDIT_WRITE_KNOWN=1` writes what is failing today into `known.json`
  with a placeholder reason. Write the reason on each one by hand.

`npm run build` rewrites `src/buildStamp.js`, so the run puts that file
back exactly as it found it and leaves the working tree alone.
