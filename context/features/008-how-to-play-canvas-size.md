# Add Canvas Size Note to How To Play

## Overview

Add a sixth item to the **How To Play** popup explaining the fixed size of the play area. The dialog currently lists five steps; this adds step **6** noting that both the target and every attempt are rendered to an exact, fixed-size canvas (400×300), so the player understands they're describing a layout to those precise dimensions. Presentation-only change.

## Requirements

- Append a sixth `<li>` to the `how-to-play-steps` `<ol>` in [src/App.tsx](../../src/App.tsx) (after the existing "Diff overlay / Submit early" item, ~line 427).
- The note states the canvas is a fixed size; derive the numbers from the `CANVAS` constant (`CANVAS.width` × `CANVAS.height`) already imported into `App.tsx` rather than hardcoding `400`/`300`, so it stays in sync with [src/config.ts](../../src/config.ts).
- Match the wording tone and JSX style of the surrounding `<li>` entries (sentence case, curly apostrophes, `<strong>` for emphasis where it fits).
- No new styles needed — the existing `.how-to-play-steps` rules cover the added item.

## References

- @src/App.tsx — How To Play `<dialog>` and `<ol className="how-to-play-steps">` (lines ~400–427).
- @src/config.ts — `CANVAS = { width: 400, height: 300 }` (line 4).
- @context/features/006-guidelines-dropdown.md — original How To Play popup spec.

## Notes

- No changes to scoring, the renderer, the sanitizer, the agent boundary, or the locked rules (`MAX_PROMPTS`, `ROUND_MS`).
- Verification: `npm run build` (tsc strict) passes, and the sixth step appears in the popup.
