# Landing Page Redesign

## Overview

Rebuild the pre-game landing page ([src/Landing.tsx](src/Landing.tsx)) to match the richer marketing layout in
[context/screenshots/promptlandingpage.png](context/screenshots/promptlandingpage.png): a top nav bar, a two-column
hero with a decorative game-preview mock, a three-step "how it works" row, a scoring section (formula + metrics),
a six-card feature grid, a closing CTA band, and a footer.

**Recolour to our palette.** The mockup is navy + orange. "Our current colours" means it must use the existing
tokens in [src/styles.css](src/styles.css) — black/dark-green surfaces (`--bg`, `--surface`, `--surface-2`,
`--border`), green accent (`--accent`) for CTAs/highlights, `--text`/`--muted` for type. **No new colours, no
orange/navy.** Keep the `--display`/`--mono` fonts. Purely presentational; no game logic, no router.

## Requirements

- **Top nav bar** (sticky, matches the dark toolbar look): brand "Prompt Battle" on the left; anchor links
  (How it works / Scoring / Challenges) that smooth-scroll to the sections below; a `btn primary` **Play now**
  CTA on the right that calls `onStart`. Collapse links gracefully on narrow widths.
- **Hero (two columns):**
  - Left: headline split across two lines — first line `--text`, second line in `--accent` (e.g. "You can see it."
    / "Your agent can't."). Lede paragraph. Two CTAs: `btn primary` **Play now** (`onStart`) and a `btn ghost`
    **See how it works** that scrolls to the steps section.
  - Right: a **decorative static mock** of the game UI (a framed dark canvas with a couple of simple CSS shapes,
    e.g. a square + circle, and a faux prompt bar). It is illustrative only — not a real target render, not wired
    to the renderer/targets, and shows no actual target. This does not touch the agent-blindness invariant.
- **"Three moves, one blind builder."** — three cards (numbered/iconed) for: See the target / Transmit a
  description / Score the match. Keep the copy aligned with the real loop (player sees target, agent is blind,
  pixel-diff scoring). Include the small callout note row beneath the cards. Reuse/adapt existing `.landing-step*`.
- **"Scored on what actually matters."** — left: a formula card showing `Score = 1000 · A^γ · (1 − λ(P − 1))`
  (display the locked formula; do not invent new scoring). Right: a short metric list — Accuracy, Prompts used,
  Time (note Time is a tiebreaker only, per the locked rules). Source `MAX_PROMPTS`/`ROUND_MS`/`CANVAS` from
  [src/config.ts](src/config.ts) where numbers appear — no hardcoding.
- **"Built for the grind."** — a six-card feature grid (e.g. economical prompts, conversational refining, a truly
  blind agent, pixel-perfect scoring, visual diff overlay, leaderboards). Cards reuse the surface/border tokens.
- **Closing CTA band** — "Think you can describe your way to 1000?" with a subline and a `btn primary` **Play now**
  (`onStart`). The `1000` ties to the score ceiling.
- **Footer** — brand + one-line description + 2–3 columns of (non-functional or anchor) links. Muted styling.
- All new styling goes in the `/* ---- landing page ---- */` block of [src/styles.css](src/styles.css), extending
  the existing `.landing*` rules. Responsive: hero collapses to one column, nav links wrap/hide, grids reflow on
  narrow viewports (mirror the existing `@media (max-width: 1180px)` approach).
- `Landing` keeps its current contract: `export default function Landing({ onStart }: { onStart: () => void })`,
  rendered by [src/Root.tsx](src/Root.tsx). No prop/signature changes; `onStart` switches to the game view.
- `npm run build` (tsc strict) must pass.

## References

- @context/screenshots/promptlandingpage.png — target layout (recolour to our palette).
- @src/Landing.tsx — current landing page being replaced.
- @src/styles.css — palette tokens (`:root`) and existing `.landing*` rules to extend.
- @src/Root.tsx — landing/game view switch and `onStart` wiring.
- @src/config.ts — `MAX_PROMPTS`, `ROUND_MS`, `CANVAS`, scoring constants to source numbers from.

## Notes

- Marketing/presentational only — must not import or invoke the renderer, scoring, or provider code, and must not
  display a real target. The hero preview is hand-built decorative CSS.
- Keep the locked scoring formula and rules accurate in the copy (`Score = 1000 · A^γ · (1 − λ(P − 1))`,
  `MAX_PROMPTS`, `ROUND_MS`, time as tiebreaker only) — the landing page must not contradict the design doc.
- Stay within the dark-green palette; do not introduce the mockup's orange/navy or add new CSS variables unless a
  derived shade is genuinely needed (prefer existing tokens / `color-mix` over the current ones).
