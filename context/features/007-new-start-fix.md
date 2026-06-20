# Fix: ending early doesn't reset the Start gate or the agent output

## Overview

When a round ends via **Submit early** (and equally via timeout or hitting `MAX_PROMPTS`), the app does not return to the clean pre-start state. The Target panel keeps showing the target image instead of the **Start** gate, and the end-of-round button jumps straight back into a *running* round rather than resetting. The result is that the "Start" affordance and the **Agent output** panel are never reset to their fresh-load state. This is a small state-flow fix in [src/App.tsx](../../src/App.tsx) only — no change to scoring, rendering, the sanitizer, the agent boundary, or the locked rules (`MAX_PROMPTS`, `ROUND_MS`).

## Root cause

The end-of-round result button calls `handleStart`, which dispatches `START`:

```ts
case 'START':
    return { ...initialRound, phase: 'ready', startedAt: Date.now() };
```

`START` skips the `idle` phase and immediately begins a live, timer-running round. Because the app never passes back through `idle`, the Target panel's **Start** gate ([src/App.tsx](../../src/App.tsx) `round.phase === 'idle'` branch in the Target `<Stage>`) is never shown again after the first round. The agent-output reset *does* happen incidentally (`initialRound` nulls `currentRenderUrl`/`currentCode` and empties `steps`), but it is immediately replaced by a new running round, so to the player neither the Start button nor the agent output appears to reset to the gated, empty state.

## Desired behaviour

After a round ends (Submit early, timeout, or max prompts), clicking the end-of-round button returns the app to exactly the **fresh-load idle state**:

- the Target panel shows the **Start** gate again (target image hidden until the player starts),
- the **Agent output** panel resets to "No attempt yet" (no render, no code, no diff),
- the prompt log clears, the timer shows full `ROUND_MS` and is paused,
- the player then clicks the in-stage **Start** to begin the next round (timer starts, target revealed) — identical to a first-time load.

## Requirements

- **End-of-round button resets to idle, not to a running round.** Add a `handleReset` that dispatches `{ type: 'RESET' }` (plus `setDraft('')` and `setShowDiff(false)`, mirroring `handleStart`). Point the end-of-round result button (`round.phase === 'ended'` branch in the "Direct the agent" panel, the `btn primary` currently wired to `handleStart`) at `handleReset` instead. `RESET` already returns `initialRound` (phase `idle`), so the Start gate reappears and the agent output clears in one dispatch.
- **Keep the in-stage Start as the round-starter.** The Target `<Stage>` idle **Start** button must continue to call `handleStart` (`START` → `ready`, timer running). Only the *end-of-round* button changes.
- **Relabel the end-of-round button** from "Start" to **"New round"** so it reads correctly — it returns to the gated pre-start screen rather than starting a live round. (The actual round still begins from the in-stage Start gate.)
- Do **not** change the `START` action, the `idle` gating from feature 005, `handleFinalize`, or `computeScore`/`computeDiff`. Submit early still finalizes and shows the score; only the post-result reset path changes.
- `npm run build` must pass (tsc strict).
- Verify via `npm run dev`: start a round, send at least one prompt, click **Submit early** → score shows; click **New round** → the Target panel shows the **Start** gate (image hidden), the **Agent output** panel reads "No attempt yet", the prompt log is empty, and "Time left" shows full time and is not counting; clicking the in-stage **Start** begins a fresh round. Repeat the check for a round that ends by timeout and by reaching `MAX_PROMPTS`.

## References

- @src/App.tsx — `roundReducer` `START`/`RESET` cases (~lines 62-67); `handleStart` (~lines 303-307); end-of-round result button in the "Direct the agent" panel (`round.phase === 'ended'` branch, `btn primary`, ~lines 512-530); Target `<Stage>` idle Start branch (~lines 346-357); Agent output `<Stage>` driven by `round.currentRenderUrl` (~lines 599+).
- @context/features/005-start-button-gate.md — the `idle` gate and `START`/`RESET` semantics this fix builds on.

## Notes

- Scope is state-flow/presentation only. Do **not** touch the renderer, sanitizer, system prompt, agent message history, or the scoring/locked rules.
- Returning to `idle` (rather than re-using `START`) keeps a single source of truth for "a fresh round looks like X" (`initialRound`) and makes the post-round state identical to first load.
- All three end conditions (Submit early, timeout, `MAX_PROMPTS`) funnel through `FINALIZE` → `phase: 'ended'` and share the one result button, so fixing that button covers all of them.
