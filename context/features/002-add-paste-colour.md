# 002 — Add Paste Colour

## Overview

When a player is describing the target in plain language, they often know the colour
they want visually but not its exact name or hex value. This feature makes the
**target's existing palette swatches clickable**: the player clicks a swatch and its
hex value is inserted into the prompt box. This lowers the friction of describing
colour precisely without guessing a hex code.

Crucially, this is **not** a full colour picker — the only colours offered are the
ones already present in the target's declared palette
([`PaletteColor[]`](../../src/types.ts#L6) on each target). A player can never paste a
colour that isn't part of the target. The palette is already rendered to the player as
read-only swatches in [App.tsx](../../src/App.tsx#L328-L338); this feature makes those
same swatches actionable.

## Requirements

- Make each existing palette swatch in [App.tsx](../../src/App.tsx#L328-L338)
  clickable. Do **not** add a native `<input type="color">` or any picker that exposes
  arbitrary colours.
- Clicking a swatch inserts that swatch's `hex` (e.g. `#4f46e5`) into the prompt
  `<textarea>` (the `draft` input around [App.tsx:419](../../src/App.tsx#L419))
  rather than overwriting existing text.
  - Insert at the current caret position if the textarea has focus; otherwise append
    to the end.
  - Update React state via `setDraft` so the controlled `<textarea>` stays in sync.
  - Keep the textarea focused after insertion so the player can keep typing.
- The inserted text is the hex with a trailing space, so it reads naturally inline
  (e.g. `... a rectangle in #4f46e5 filling the top half`).
- Swatch clicks are disabled whenever the prompt textarea is disabled (i.e. during
  `phase === 'thinking'` or when `promptsUsed >= MAX_PROMPTS`).
- Give the swatches an affordance that they are clickable (cursor, hover state, and an
  accessible role/`title` such as “Insert {name} ({hex})”), styled in
  [styles.css](../../src/styles.css) to match the existing `.swatch` look.
- No change to scoring, rendering, the system prompt, the target data model, or the
  agent message history — this only affects how the player composes their prompt text.

## References

- [@src/App.tsx](../../src/App.tsx) — palette swatches (lines 328–338) and the prompt
  `<textarea>` / `draft` / `setDraft` state (around line 419).
- [@src/types.ts](../../src/types.ts) — `PaletteColor` and `Target.palette`.
- [@src/styles.css](../../src/styles.css) — `.palette`, `.swatch`, `.chip` styling.
- [@CLAUDE.md](../../CLAUDE.md) — invariants and working agreement.

## Notes

- Stay within the invariants: the agent must never receive the target, reference HTML,
  or any asset. The palette is already shown to the player (and never to the agent);
  the pasted hex becomes part of the normal player prompt and nothing else.
- Source of colours is `target.palette` only — no pixel-sampling of the rendered
  target and no arbitrary-colour picker. This keeps the offered colours exactly the
  set the designer declared for that target.
- Verification: `npm run build` must pass, then `npm run dev` and confirm clicking a
  palette swatch inserts its hex at the caret without clobbering existing prompt text,
  and that swatches are inert while the agent is thinking or prompts are exhausted.

## History

<!-- Keep this updated. Earliest to latest -->

| Date | Time (GMT) | Description |
| ---- | ---------- | ----------- |
| 2026-06-20 | 14:58 | Spec created. |
| 2026-06-20 | 15:02 | Scoped to clickable target-palette swatches only (no full colour picker). |
| 2026-06-20 | 15:20 | Implemented on feature/add-paste-colour; build passes. |
