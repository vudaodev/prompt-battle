# Post-round prompt coach: explain the agent's approach and how to prompt better

## Overview

After a round ends (via **Submit early**, timeout, or hitting `MAX_PROMPTS`), let the player request AI **coaching feedback** on how they prompted. The coach receives the player's prompts in order, each attempt's accuracy, the agent's final HTML, the final score — **and the target's reference HTML** — and returns plain-language feedback on (a) why the agent likely produced what it did given the prompts, and (b) specific, actionable ways the prompts could have been clearer to score higher.

This is additive UI + one new LLM call path in [src/App.tsx](../../src/App.tsx), [src/config.ts](../../src/config.ts), and [src/styles.css](../../src/styles.css). No change to scoring, the renderer, the sanitizer, the in-round agent, or the locked rules (`MAX_PROMPTS`, `ROUND_MS`).

**Decisions (confirmed):**
- **Coach sees the target.** It is given `target.html` (the reference). This is a deliberate, post-scoring path — the *in-round* agent ([src/config.ts](../../src/config.ts) `SYSTEM_PROMPT`) stays blind, preserving the game's boundary during play.
- **On-demand.** Feedback is generated only when the player clicks a **Get feedback** button in the end-of-round result; no automatic call.
- **Reuses the selected provider/model.** The coach calls the existing `callAgent` ([src/lib/llm.ts](../../src/lib/llm.ts)) with the active toolbar `provider`/`model`/`effectiveKey` — no new key, no new adapter.

## What already exists (reuse, don't rebuild)

- `round.steps: AttemptStep[]` — every prompt with its `seq`, `prompt`, `code`, `accuracy` ([src/types.ts](../../src/types.ts)). This is the prompt history the coach analyses.
- `round.finalScore`, `round.accuracy`, `round.promptsUsed`, and `target` (`name`, `html`, `palette`, `difficulty`).
- `callAgent({ provider, model, apiKey, system, messages })` returns raw text — reuse directly. **Do not** run `prepareHtml`/`renderHtmlToCanvas` on the coach output; it's prose, displayed as text.

## Requirements

- **Coach system prompt.** Add `COACH_SYSTEM_PROMPT` to [src/config.ts](../../src/config.ts), next to `SYSTEM_PROMPT`. It should frame the model as a Prompt Battle coach: the player described a target to a coding agent that could **not** see it; the coach **can** see the target's reference HTML; it should explain why the agent produced what it did from the prompts given, then give concrete, prioritized suggestions for clearer prompts (shape/size/position/colour-placement wording), referencing the player's actual prompts. Ask for short plain-text prose with simple `- ` bullets, **no HTML and no markdown code fences**, a few hundred words max.
- **Context builder.** Add a module-level helper in [src/App.tsx](../../src/App.tsx) (alongside `formatTime`/`pct`), e.g. `buildCoachContext(target, steps, finalScore)`, that assembles one user message string containing: the target reference HTML (`target.html`), the target name/difficulty, the ordered prompts each tagged with their resulting accuracy (`#1 (47.2%): "…"`), the agent's **final** HTML (`steps[last].code`), and the final accuracy/score. Keep it to a single `{ role: 'user', content }` message.
- **Coach state in the reducer.** Extend `RoundState` with `coachStatus: 'idle' | 'loading' | 'done' | 'error'`, `coachFeedback: string | null`, `coachError: string | null` (defaults in `initialRound`: `'idle'`/`null`/`null`). Add actions `COACH_START`, `COACH_RESULT` (`feedback`), `COACH_FAIL` (`error`) and handle them. Because `RESET`/`START` return from `initialRound`, **New round** and a fresh start clear coach state automatically (this builds on feature 007's reset).
- **Handler.** Add `handleCoach()` in [src/App.tsx](../../src/App.tsx): dispatch `COACH_START`, call `callAgent` with `COACH_SYSTEM_PROMPT` and the built context, then dispatch `COACH_RESULT` with `text.trim()` (or `COACH_FAIL` on error, mirroring the existing `handleSubmit` try/catch).
- **UI (end-of-round result block only).** In the `round.phase === 'ended'` result branch of the "Direct the agent" panel, under the score/sub and near the **New round** button, render the coach area driven by `coachStatus`:
  - `idle`: a **Get feedback** button (`btn`) calling `handleCoach`. Disable it when `!effectiveKey` or `round.steps.length === 0` (nothing to analyse), with a short hint when disabled for a missing key.
  - `loading`: a disabled "Analysing your prompts…" state.
  - `done`: the feedback rendered as wrapped text in a scrollable box (reuse a `.code`-like treatment, but normal font / `white-space: pre-wrap`).
  - `error`: reuse the existing `.error` styling with the message and allow retry (button returns to `idle` affordance).
- **Styling.** Add `.coach-*` rules to [src/styles.css](../../src/styles.css) consistent with the dark-green tokens (`--surface-2`, `--border`, `--muted`, `--mono`). The feedback box should be readable prose (not monospace), scrollable if long.
- `npm run build` must pass (tsc strict; no `any` — type the new action payloads).
- Verify via `npm run dev`: play a round with 2–3 prompts, **Submit early**; in the result, click **Get feedback** → a loading state shows, then plain-text coaching appears referencing your prompts and the target; **New round** clears the feedback and returns to the idle Start gate. Re-check that the button is disabled with no API key and hidden/disabled when zero prompts were sent. Confirm the timeout and `MAX_PROMPTS` end paths show the same coach affordance.

## References

- @src/App.tsx — `RoundState`/`initialRound`/`roundReducer` (round-state machine); `handleSubmit` (existing `callAgent` + try/catch pattern to mirror); `handleReset` (feature 007); end-of-round result block in the "Direct the agent" panel (`round.phase === 'ended'`).
- @src/config.ts — `SYSTEM_PROMPT` (place `COACH_SYSTEM_PROMPT` beside it); `PROVIDERS`.
- @src/lib/llm.ts — `callAgent` (reused as-is; provider-neutral, returns raw text).
- @src/types.ts — `AttemptStep`, `Msg`.
- @context/features/007-new-start-fix.md — the reset path that auto-clears round (now incl. coach) state.

## Notes

- **Invariant boundary.** CLAUDE.md states the agent must never see the target; that rule governs the **in-round** agent and is unchanged here. The coach is a separate, explicitly post-scoring path that sees `target.html` by design (player-approved). Worth a one-line note in CLAUDE.md's invariants section so the docs stay honest — flag, don't silently diverge.
- Do **not** sanitize or render the coach output; it is displayed as text, so the `<script>`/`on*` stripping in `prepareHtml` is irrelevant and rendering it through the iframe path would be wrong.
- Keep the coach to a single `callAgent` call with one user message; no streaming, no multi-turn. Output stays within the existing `MAX_TOKENS` (2048) in [src/lib/llm.ts](../../src/lib/llm.ts).
- Including the agent's final HTML lets the coach explain "why it took that approach"; if a target's HTML is very large, truncating it in `buildCoachContext` is acceptable, but most targets here are small.
- Scope: do not add a leaderboard, persistence, or per-prompt inline feedback — just one end-of-round summary. Those can be follow-ups.
