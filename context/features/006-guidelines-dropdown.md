# "How To Play" guidelines popup under the target

## Overview

Add a small **How To Play** trigger directly under the target image in the Target panel that opens a modal **popup** with a short list of guidelines explaining how a round works. A player unfamiliar with the game sees the "How To Play" label, clicks it, and reads the rules in a centred dialog over a dimmed backdrop; it stays out of the way for players who already know. This is a presentation-only change to [src/App.tsx](src/App.tsx) plus a small [src/styles.css](src/styles.css) addition — no change to game rules, scoring, rendering, the sanitizer, the agent boundary, or the locked rules (`MAX_PROMPTS`, `ROUND_MS`).

Use the native `<dialog>` element opened with `showModal()` so the modal behaviour, backdrop, focus trapping, and Esc-to-close come for free; the only added state is a `useRef<HTMLDialogElement>`.

## Requirements

- **Placement.** Render the trigger button inside the Target `<section className="panel">`, directly under the target `<Stage>` (i.e. immediately after the `</Stage>` close, before the `.meta` badges) so it sits under the image as requested. It must show in every phase, including `idle` (so a new player can read the rules before clicking Start). The `<dialog>` itself is portalled to the top layer by the browser, so its position in the JSX is incidental.
- **Popup, not inline.** A `<button className="how-to-play-trigger">How To Play</button>` calls `dialogRef.current?.showModal()`. The guidelines live inside a `<dialog ref={dialogRef} className="how-to-play-dialog">` with a header (title + `×` close button) and the list. Close on: the `×` button (`dialog.close()`), a click on the backdrop (compare `e.target === dialogRef.current`), and Esc (native to `showModal()`).
- **Guidelines content.** An ordered list (`<ol className="how-to-play-steps">`) covering the round loop, derived from the locked constants rather than hard-coded numbers where practical:
  1. Click **Start** to reveal the target and start the timer (use `Math.round(ROUND_MS / 60000)` for the minutes, so it reads "10-minute").
  2. Describe the target to the agent in plain language — it can't see it, so you are its eyes. Name shapes, sizes and positions.
  3. Use the exact hex codes shown beside the target; click a swatch to drop one into your prompt.
  4. Refine across up to `{MAX_PROMPTS}` prompts — fewer prompts scores higher, so aim to nail it early.
  5. Toggle **Diff overlay** to see where your render misses, then **Submit early** when you're happy — or let the timer run out.
- **Styling.** Add rules to [src/styles.css](src/styles.css) consistent with the existing dark-green palette and tokens (`--muted`, `--border`, `--mono`, etc.). The trigger should look like the other panel sub-labels (uppercase, `--mono`, `--muted`, `cursor: pointer`); the dialog card reuses the `.panel`-like surface (`--surface`, `--border`, `radius`), and `::backdrop` dims the page. The list text uses the same muted treatment as `.hint`.
- Only a single `useRef<HTMLDialogElement>` is added; no `useState` and no change to the round state machine.
- `npm run build` must pass (tsc strict).
- Verify via `npm run dev`: under the target image a "How To Play" button is visible; clicking it opens a centred popup over a dimmed backdrop; it closes via the `×`, the backdrop, and Esc; it appears both before and after Start and does not shift or overlap the palette/badges.

## References

- @src/App.tsx — Target panel: `<Stage>` block, then `.meta` badges, `.palette`, and the existing `.hint` paragraph. Insert the trigger button + `<dialog>` between `</Stage>` and `.meta`; add the `howToPlayRef` alongside the other `useRef`s.
- @src/config.ts — `ROUND_MS` and `MAX_PROMPTS` (already imported into App.tsx) for the dynamic copy.
- @src/styles.css — existing panel/`.hint`/`.panel-title` rules to match (`--muted`, `--border`, `--mono`, `--surface`, `--surface-2`).

## Notes

- Scope is presentation only. Do **not** touch `computeScore`/`computeDiff`, the renderer, the sanitizer, the system prompt, or the agent message history.
- Prefer the native `<dialog>` + `showModal()` over a hand-rolled overlay: focus trapping, top-layer stacking, backdrop, and Esc-to-close are built in, keeping the React surface to one ref.
- This is complementary to the existing one-line `.hint` notes already in the Target and Direct-the-agent panels; those stay as quick inline reminders, while this popup is the fuller "new player" explainer.
