# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Prompt Battle is a game where a player recreates a hidden visual target by directing an AI coding agent in plain language. **The player can see the target; the agent cannot.** The only lever is description quality, and the score (pixel-diff accuracy, penalized per prompt) is the product. See [context/project-design-doc.md](context/project-design-doc.md) for the full spec.

This repo is **Phase 0.1 — the prototype**: a browser-only Vite + React + TypeScript app with no backend. Provider API calls go straight from the browser to Anthropic/OpenAI/Gemini using a key from `.env`. Rendering and scoring happen client-side. The design doc describes a production architecture (FastAPI proxy, server-authoritative timer/scoring, Playwright rendering, Supabase) that is **not built here** — do not assume it exists in this codebase.

## Commands

```bash
npm run dev       # Vite dev server (http://localhost:5173), opens browser
npm run build     # tsc (typecheck) && vite build — this is the only gate
npm run preview   # serve the production build
```

There is **no test runner, no linter, and no test suite.** `npm run build` runs `tsc` in strict mode and is the de-facto verification step — a green build is the bar before committing. "Verify it works" means running `npm run dev` and checking the browser/console.

API keys: copy `.env.example` to `.env` and set `VITE_ANTHROPIC_API_KEY` / `VITE_OPENAI_API_KEY` / `VITE_GEMINI_API_KEY` (only the provider you'll use). Keys can also be pasted into the in-app toolbar (session-only memory).

## Architecture

Everything lives in [src/](src/). The whole game is small and centers on one invariant: **the same renderer rasterizes both the reference target and every agent attempt, which is what makes a perfect reconstruction genuinely score 100%.**

The round loop runs entirely inside [src/App.tsx](src/App.tsx) (state machine via `useReducer`, timer, full UI). One prompt cycle does:

1. **Build messages** — system prompt + full prompt/code history + new player prompt. The carried history is provider-neutral `Msg[]`.
2. [lib/llm.ts](src/lib/llm.ts) — `callAgent()` dispatches to one of three browser-direct provider adapters (Anthropic needs the `anthropic-dangerous-direct-browser-access` header). Returns raw text.
3. [lib/sanitize.ts](src/lib/sanitize.ts) — `prepareHtml()` strips markdown fences, extracts the HTML doc, and removes scripts / `on*=` handlers / `javascript:` URLs. This enforces the "HTML/CSS only" rule client-side (production does it server-side).
4. [lib/render.ts](src/lib/render.ts) — `renderHtmlToCanvas()` renders into a sandboxed same-origin **srcdoc iframe** (`sandbox="allow-same-origin"`, no scripts), then `html2canvas` rasterizes its body to a fixed 400×300 canvas. Both target and attempts go through this exact function.
5. [lib/scoring.ts](src/lib/scoring.ts) — `computeDiff()` runs pixelmatch (diff pixels rendered in brand magenta for the overlay); `computeScore()` applies the locked formula.

Supporting files: [config.ts](src/config.ts) holds the locked constants and the agent system prompt; [types.ts](src/types.ts) holds shared types; [targets/manifest.ts](src/targets/manifest.ts) registers targets.

## Invariants — do not break these (they are the game)

- **The agent must never receive the target image, the reference HTML, or any asset.** The entire game lives at this boundary (`Target.html` is documented "Never shown to the agent"). It also never sees its own previous render — all perception stays with the player.
- **Reference and attempts must use the same renderer** ([lib/render.ts](src/lib/render.ts)). Don't render the target through a different path.
- **Scoring formula is locked**: `Score = 1000 · A^γ · (1 − λ(P − 1))`. `A^γ` is applied **only** at scoring time in `computeScore`; the player is always shown raw accuracy `A`. Defaults `DEFAULT_GAMMA = 2.5`, `DEFAULT_LAMBDA = 0.05`, both live-tunable in the toolbar.
- **Locked rules**: `MAX_PROMPTS = 5`, `ROUND_MS = 10 min`. Time is a leaderboard tiebreaker only — never folded into the score.

## Adding a target

Drop a self-contained `.html` file (inline `<style>`, body sized to 400×300, **no scripts, no external requests/images/fonts**) in [src/targets/](src/targets/), import it with `?raw` in [targets/manifest.ts](src/targets/manifest.ts), and add an entry. `diffThreshold` ~0.1 for shapes; loosen slightly (~0.12) for lots of rounded/AA edges. Targets must be pure HTML/CSS so they're provably reconstructable to 100%.

## Updating model IDs

Provider model lists live in `PROVIDERS` in [config.ts](src/config.ts) (first entry is the default). If a call 404s on the model, edit the `models` array there.

## Context files (read before non-trivial work)

- [context/project-design-doc.md](context/project-design-doc.md) — comprehensive spec and **source of truth**.
- [context/project-overview.md](context/project-overview.md) — shorter version of the same spec. It and the design doc must **not contradict each other**; if you change one, keep them consistent.
- [context/current-feature.md](context/current-feature.md) — the feature currently being worked on; update its History table (date + GMT time) on completion.

> [context/coding-standards.md](context/coding-standards.md) describes a Next.js / Tailwind v4 / Prisma / shadcn stack. **The prototype does not use any of those** — it's plain Vite + React + hand-written CSS in [src/styles.css](src/styles.css), no Tailwind, no ORM. Treat that file as aspirational for a future stack, not as rules for this codebase.

## Working agreement (from context/ai-interaction.md)

- One branch per change: `feature/[name]` or `fix/[name]`. Ask before deleting the branch after merge.
- **Do not commit without permission, and only after `npm run build` passes.** Conventional commit messages (`feat:`, `fix:`, `chore:`). Do **not** put "Generated with Claude" (or co-author trailers) in commit messages.
- Make minimal changes; don't refactor unrelated code or add features not in the spec. Ask before large refactors. Never delete files without clarification.
- TypeScript strict mode, no `any` (use `unknown`); functional components and hooks only.
