# Employee Progress Dashboard (mock)

## Overview

A mock, employee-facing progress dashboard rendered as a new React page in the
prototype, styled in the website's dark-green brand palette. It shows an
individual employee their AI-prompting proficiency over time — the focal point
is the headline **AI Skill Score** and its 8-week trend, supported by stat
cards, recent-battle history, and recommended drills. It is purely
presentational with hard-coded data: no backend, no persistence, no game logic,
and it produces no scored attempt. The design doc names a buyer-facing "admin
dashboard showing baseline-to-current proficiency" as a future B2B feature; this
is the employee-perspective counterpart, mocked for the prototype.

## Requirements

- New `src/Dashboard.tsx`, presentational only, props `onHome` (→ landing) and
  `onStart` (→ game). Hard-coded data for one fictional employee.
- `src/Root.tsx`: extend the view union to `'landing' | 'game' | 'dashboard'`
  and route the dashboard between landing and game.
- `src/Landing.tsx`: add an `onDashboard` prop and a "My progress" link in the
  existing `.landing-nav-links`.
- Sections: header (employee identity), **skill score + inline-SVG trend chart
  (focus)**, stat row (team rank / rounds / avg accuracy / best score),
  recent-battle history table, recommended drills.
- Pull target names/difficulties from `targets` in `src/targets/manifest.ts` so
  history/drills stay in sync with the real game.
- Trend chart is hand-built inline SVG — no new npm dependencies.
- Styling via new `dash-*` classes appended to `src/styles.css`, reusing the
  `:root` tokens, `.landing-nav`, `.panel`, `.btn`, and `.badge` vocabulary.
- Layout stacks gracefully on narrow viewports (`@media (max-width: 860px)`).

## References

- @src/Dashboard.tsx — the page.
- @src/Root.tsx, @src/Landing.tsx — view switch + entry point.
- @src/styles.css — `dash-*` block (and the reused `landing-*`/token rules).
- @src/targets/manifest.ts — `targets` source for history/drills.
- @context/project-design-doc.md — the future "admin dashboard" framing.

## Notes

- Mock only: no scoring/renderer/agent code is touched, so the in-round agent
  blindness boundary and locked scoring formula are unaffected.
- `npm run build` (tsc strict + vite build) is the gate.
