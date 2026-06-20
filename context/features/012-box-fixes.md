# Box fix: center the render frames within their panels

## Problem

The two render frames — the **Target** preview and the **Agent output** preview — sit flush
against the left edge of their panels instead of being centered. On wide screens the gap to the
right of each box is obvious and makes the layout look unbalanced.

## Root cause

Both frames use the shared `.stage` class ([src/styles.css](../../src/styles.css)), sized to a
fixed `400×300` (the width/height are set inline by the `Stage` component in
[src/App.tsx](../../src/App.tsx)). `.stage` is a normal block element inside `.panel`, and a
fixed-width block in normal flow aligns to the **left** of its container. The panels are grid
columns (`grid-template-columns: repeat(3, minmax(360px, 1fr))`) that are routinely wider than
400px, so the box leaves empty space on its right and reads as "not centered".

## Fix

Add horizontal auto-margins to `.stage` so the fixed-width box centers within its panel:

```css
.stage {
    /* …existing rules… */
    margin-inline: auto;
}
```

- This centers **only** the stage box. The panel title, badges (`.meta`), and palette stay
  left-aligned as before (they are separate block elements, unaffected).
- Because `.stage` already has an explicit width and `max-width: 100%`, `auto` left/right margins
  resolve to equal space on both sides on wide panels, and collapse to zero when the panel is
  narrower than the box — so nothing changes on small screens / the single-column `@media` layout.
- Both render frames share `.stage`, so the Target box and the Agent output box are both centered
  by this single rule, keeping them visually aligned. The in-stage Start gate (`.stage-start`) and
  the diff overlay (`.stage-overlay`, absolutely positioned within `.stage`) are unaffected.

## Scope

CSS-only, one declaration in [src/styles.css](../../src/styles.css). No change to the `Stage`
component, the renderer, scoring, or any other behaviour. The 400×300 raster used for scoring is
untouched — this only affects on-screen placement.

## Verification

1. `npm run build` — tsc/vite must pass.
2. `npm run dev`:
   - On a wide window, both the Target and Agent output boxes are horizontally centered in their
     panels with equal space on each side.
   - Titles, difficulty/kind badges, and the colour palette remain left-aligned.
   - Narrow the window below the single-column breakpoint (≤1180px): boxes still fit and stay
     centered, with no horizontal overflow.
