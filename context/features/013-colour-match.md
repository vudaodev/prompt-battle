# Resolve spoken/typed colour names to exact palette hex

## Overview

Voice input (ElevenLabs STT) lets players prompt hands-free, but colours are a blind spot. The
palette colour **names** ("Azure", "Cyan", "Backdrop") exist only as on-screen swatch labels in
[src/App.tsx](../../src/App.tsx) (`title={`Insert ${c.name} (${c.hex})`}`); they are **never sent
to the agent**, and [src/config.ts](../../src/config.ts) `SYSTEM_PROMPT` carries no name→hex legend.

- Clicking a swatch calls `insertColor(c.hex)` → drops the **exact hex** (`#2256e0`) into the
  prompt. That precision is what lets a perfect reconstruction score 100%.
- Voice (`handleMic` → `transcribeAudio` in [src/lib/stt.ts](../../src/lib/stt.ts)) appends the
  **raw transcript**. Saying "azure" sends the literal word; the agent has no idea it means
  `#2256e0`, picks a generic azure, and accuracy suffers. Dictating a hex aloud is impractical.

**Goal:** let players name a palette colour by voice (or by typing) and have the agent receive the
exact hex — without handing the agent the whole palette.

**Decisions (confirmed):** resolve **client-side**, applied to **all prompts** (typed + voice) at
submit time.

## Approach

Add a pure helper that annotates palette colour names in a prompt with their exact hex, and call it
in `handleSubmit` before the prompt is sent to the agent.

### 1. New helper `annotatePaletteColors(prompt, palette)` — module-level in [src/App.tsx](../../src/App.tsx)

Place it beside the existing module-level helpers (`formatTime`, `pct`, `buildCoachContext`).
Signature: `(prompt: string, palette: PaletteColor[]) => string` (reuse `PaletteColor` from
[src/types.ts](../../src/types.ts)).

- For each palette entry, match its `name` case-insensitively on a **word boundary**
  (`\b`, regex-escape the name defensively) and annotate the **first occurrence only** by appending
  ` (hex)` after the matched word — e.g. `"top half azure"` → `"top half azure (#2256e0)"`.
  Appending (not replacing) preserves the player's original wording and casing.
- **Guard against redundancy:** skip annotation for a colour if its hex string already appears in
  the prompt (covers the case where the player also clicked the swatch, which inserted the hex).
- Return the prompt unchanged when no names match (the common typed-hex / swatch flow is untouched).

### 2. Annotate the voice transcript in `handleMic` in [src/App.tsx](../../src/App.tsx)

When a dictated transcript lands, run it through `annotatePaletteColors` **before** appending it to
the draft, so the player immediately sees the hex beside what they said — e.g. saying "azure" drops
`azure (#2256e0)` into the prompt box. This makes the resolution visible and lets the player
distinguish exactly which colour was captured. Because the hex is now in the draft text, it also
flows into the prompt log (`step.prompt`) for that attempt.

### 3. Wire into `handleSubmit` in [src/App.tsx](../../src/App.tsx)

- Keep `const prompt = draft.trim();` and compute
  `const sentPrompt = annotatePaletteColors(prompt, target.palette);`.
- Send `sentPrompt` to the agent (in the `messages` array and the carried `history`).
- This also resolves **typed** colour names at submit time. For voice, the draft already contains
  the hex, so the redundancy guard skips re-annotating it (no double `(#hex)`).

### Boundary note

This preserves the game's invariant: the agent still only learns colours the player **explicitly
named** — it is never given the full palette legend. The resolution is a deterministic client-side
rewrite of the player's own words, equivalent to the player having pasted the hex themselves. No
change to the in-round blindness rule in CLAUDE.md.

## Files

- **Edit only**: [src/App.tsx](../../src/App.tsx) — add `annotatePaletteColors` helper + use it in
  `handleSubmit`. No config, CSS, type, or dependency changes; renderer/scoring/sanitizer/STT all
  untouched.

## Reuse (don't rebuild)

- `PaletteColor` type — [src/types.ts](../../src/types.ts).
- `target.palette` (name + hex per target) — already in scope in `App` from
  [src/targets/manifest.ts](../../src/targets/manifest.ts).
- Existing `handleSubmit` message-building / history pattern — only the prompt string changes.

## Known limitation

Some palette names are common English words ("Border", "Surface", "Void", "Backdrop", "Sky",
"White", "Blue"). First-occurrence word-boundary annotation can occasionally fire on a non-colour
use (e.g. "draw a border"). Accepted for the prototype; annotation is additive (appends a hex the
agent may ignore in clearly structural context) rather than destructive. Can be tightened later
(e.g. only colours adjacent to colour-cue words) if it proves noisy.

## Verification

1. `npm run build` — tsc strict must pass (type the helper; no `any`).
2. `npm run dev`, using a target with named colours (e.g. Encode: Azure `#2256e0`, Cyan `#34c5d8`):
   - Type (or dictate via the mic) "fill the whole canvas with azure" and send. Confirm the **Agent
     output** code panel contains the exact `#2256e0` — proving the name resolved to hex.
   - Type "blue" → agent receives the Blue hex; the prompt log still shows your raw "blue".
   - Redundancy guard: type "azure #2256e0" → not double-annotated (no `(#2256e0)` added).
   - Swatch click flow still works unchanged (hex inserted directly, no annotation).
