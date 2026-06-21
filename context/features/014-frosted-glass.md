# Frosted-glass sticky nav (fix scroll line floating over buttons)

## Overview

On the landing page, scrolling makes the sticky nav's bottom line drift across the hero's
"Play now" / "See how it works" buttons, and a second parallel line briefly appears — an eyesore.

Root cause is the sticky nav in [src/styles.css](../../src/styles.css) (`.landing-nav`):

```css
.landing-nav {
    position: sticky;
    top: 0;
    background: linear-gradient(180deg, var(--bg) 70%, transparent); /* bottom 30% transparent */
    border-bottom: 1px solid var(--border);                          /* hard line at the edge */
}
```

- The bottom third of the nav background fades to **transparent**, so content scrolling underneath
  (hero buttons, and the hero's own `border-bottom`) shows through **sharply**, and the nav's
  border line sits directly over it.
- When a section divider scrolls up near the nav line, both are visible at once → the "two lines".

**Goal:** the nav reads as a semi-transparent frosted bar — content behind it is softly blurred
rather than showing through under the line, so the line never floats over crisp buttons and section
dividers blur away before reaching it. No double line.

**Decision (confirmed):** frosted glass (near-opaque background + backdrop blur), not a fully solid
bar or a borderless fade.

## Approach

Single CSS change to `.landing-nav` in [src/styles.css](../../src/styles.css): replace the
fade-to-transparent gradient with a near-opaque frosted background plus a backdrop blur; keep the
single `border-bottom`.

```css
.landing-nav {
    /* …layout/position unchanged… */
    /* Frosted glass: near-opaque base so scrolled content/dividers blur away
       instead of showing through under the border line. --bg #060b08 @ ~0.82 */
    background: rgba(6, 11, 8, 0.82);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
}
```

- `rgba(6, 11, 8, …)` is `var(--bg)` (#060b08) expressed with alpha — CSS variables can't take an
  inline alpha, so the literal is used.
- High alpha (~0.82) keeps scrolled content from reading as a sharp second line; the blur softens
  the rest. If `backdrop-filter` is unsupported, the `rgba(…,0.82)` base degrades gracefully.

## Files

- **Edit only**: [src/styles.css](../../src/styles.css) — `.landing-nav` rule. No JSX/TS/dependency
  changes; renderer/scoring/agent boundary untouched (presentational).

## Reuse (don't rebuild)

- Existing `.landing-nav` rule and the dark-green palette tokens (`--bg`, `--border`) — only the
  background treatment changes.

## Verification

1. `npm run dev`, open the landing page.
2. Scroll slowly past the hero. Confirm:
   - The nav's bottom line no longer floats over sharp button text — content behind the bar is
     blurred, not crisp.
   - You never see two parallel hard lines at once; the hero divider blurs out behind the bar
     before reaching the nav line.
   - Verify in Chrome/Edge (backdrop-filter supported).
3. `npm run build` — tsc strict must pass (the project's only gate).
