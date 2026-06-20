# Start button gates the round (rename, timer-on-start, hidden target)

## Overview

Add an explicit "armed but not started" gate to the round. On a fresh load the app sits in a new **idle** state: the target image is hidden and the round timer is shown at full but not counting. The player begins by clicking a button now labelled **Start** (renamed from "New round"), which simultaneously reveals the target and starts the countdown. This is a UI/state-flow change in [src/App.tsx](src/App.tsx) only — no change to scoring, the renderer, the sanitizer, the agent boundary, or the locked rules (`MAX_PROMPTS`, `ROUND_MS`).

Today the round starts in `phase: 'ready'` with `startedAt: null`; the target renders and is always visible, and the timer only begins on the first prompt submit (`START_THINKING` sets `startedAt: state.startedAt ?? Date.now()`). The two existing "New round" buttons just `RESET`.

## Requirements

- **Rename the button to "Start".** Change both buttons currently reading "New round" to "Start":
  - the toolbar control ([src/App.tsx:708-710](src/App.tsx#L708-L710), `btn ghost`), and
  - the end-of-round result button ([src/App.tsx:445-450](src/App.tsx#L445-L450), `btn primary`).
- **Add an idle (pre-start) phase.** Add `'idle'` to the `Phase` union ([src/App.tsx:22](src/App.tsx#L22)) and set `initialRound.phase = 'idle'` ([src/App.tsx:39](src/App.tsx#L39)). `RESET` already returns `initialRound`, so it returns to idle.
- **Add a `START` action.** Add `{ type: 'START' }` to `Action` and handle it in `roundReducer` so it begins a fresh, running round in one step:
  `case 'START': return { ...initialRound, phase: 'ready', startedAt: Date.now() };`
  This clears any prior attempt state, reveals the target (phase ≠ idle), and starts the timer.
- **Timer counts down from the click.** The tick and timeout effects ([src/App.tsx:164-198](src/App.tsx#L164-L198)) already gate on `startedAt != null` and `remainingMs` already falls back to full `ROUND_MS` when `startedAt == null`. Because `START` sets `startedAt = Date.now()`, the "Time left" stat shows the full time (e.g. `10:00`) while idle and begins counting down the moment Start is clicked. No timer-logic edits should be needed beyond the new action.
- **Target hidden until Start.** In the Target panel ([src/App.tsx:336-350](src/App.tsx#L336-L350)), only render the `<img className="stage-img">` when `round.phase !== 'idle'`. While idle, show a placeholder in the `<Stage>` (e.g. "Click Start to reveal the target and begin the timer."). **Keep the existing target-render `useEffect` unchanged** ([src/App.tsx:139-162](src/App.tsx#L139-L162)) so `refPixels.current` / `targetRenderUrl` are still computed — only the *visible* image is gated, never the reference pixels used for scoring.
- **Gate prompting while idle.** Include `'idle'` in `promptDisabled` ([src/App.tsx:207-208](src/App.tsx#L207-L208)) so the prompt textarea and palette swatches are disabled before Start. `canSubmit` already requires `phase === 'ready'`, so Send stays disabled in idle; `Submit early` is already disabled while `startedAt == null`.
- **Wire the handler.** Rename/repurpose `handleNewRound` ([src/App.tsx:295-299](src/App.tsx#L295-L299)) to `handleStart`, dispatching `{ type: 'START' }` (plus the existing `setDraft('')` / `setShowDiff(false)`). Update the toolbar prop (`onNewRound` → `onStart`, [src/App.tsx:331](src/App.tsx#L331), [src/App.tsx:606](src/App.tsx#L606), [src/App.tsx:708](src/App.tsx#L708)) and the result-button `onClick` to use it. Both "Start" buttons begin a fresh running round.
- `npm run build` must pass (tsc strict).
- Verify via `npm run dev`: on first load the Target panel shows a placeholder (no image) and "Time left" reads full time without counting; clicking **Start** reveals the target and the timer immediately begins counting down; prompting works as before once started.

## References

- @src/App.tsx — `Phase`/`RoundState`/`initialRound` and `roundReducer` (lines ~22-87); timer effects and `remainingMs` (lines ~164-198); `promptDisabled`/`canSubmit` (lines ~200-208); `handleNewRound` (lines ~295-299); Target panel (lines ~336-350); result button (lines ~445-450); toolbar button + props (lines ~606, ~708-710).
- @context/project-overview.md / @context/project-design-doc.md — round flow and the `ROUND_MS` / timer rules (time is a leaderboard tiebreaker only; do not fold it into scoring).

## Notes

- Scope is presentation/flow only. Do **not** touch `computeScore`/`computeDiff`, the renderer, the sanitizer, the system prompt, or the agent message history. The reference target must still be rendered through the same `renderHtmlToCanvas` path — it is merely visually hidden until Start, not skipped.
- Selecting a different target already `RESET`s the round; with the idle initial phase this means switching targets re-gates them behind Start, which is the intended behaviour.
- A single `START` action that returns `{ ...initialRound, phase: 'ready', startedAt: Date.now() }` is preferred over dispatching `RESET` then a separate start, so the reset + reveal + timer-start happen atomically in one render.
