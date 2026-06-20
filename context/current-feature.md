# Current Feature

002 — Add Paste Colour. Make the target's existing palette swatches clickable so the
player can insert a swatch's hex into the prompt textarea. See
[features/002-add-paste-colour.md](features/002-add-paste-colour.md).

## Status

Completed

## Goals

- Make each palette swatch in [App.tsx](../src/App.tsx#L328-L338) clickable; clicking
  inserts that swatch's `hex` into the prompt `<textarea>` at the caret (or appended),
  via `setDraft`, keeping the textarea focused.
- Offer only colours from `target.palette` — no full colour picker, no pixel-sampling.
- Disable swatch clicks while the prompt is disabled (`phase === 'thinking'` or
  `promptsUsed >= MAX_PROMPTS`); add a clickable affordance (cursor/hover/title).
- No change to scoring, rendering, system prompt, target data model, or agent history.

## Notes

Stays within invariants: the palette is already shown to the player and never to the
agent; the pasted hex just becomes part of the normal player prompt.

## History

<!-- Keep this updated. Earliest to latest -->

| Date | Time (GMT) | Description |
| ---- | ---------- | ----------- |
| 2026-06-20 | 15:03 | Set as current feature; spec scoped to clickable target-palette swatches. |
| 2026-06-20 | 15:10 | Added the encode logo (`06-encode.html`) as a registered target in `manifest.ts` (id `encode`, hard, diffThreshold 0.12). Renamed the file to the `NN-name.html` convention. |
| 2026-06-20 | 15:20 | Implemented: clickable palette swatches insert hex into prompt; build passes. |
