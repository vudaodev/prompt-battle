# Set default target to Encode and default provider to OpenAI

## Overview

Change the app's initial selections on load so a fresh session starts with the **Encode Logo** target selected and **OpenAI** as the active API provider (instead of the current defaults: Split Horizon target and Anthropic provider). This is a small change to initial React state in [src/App.tsx](src/App.tsx) only — no change to game rules, scoring, rendering, the target catalog, or the provider list. The player can still switch target and provider from the toolbar as before.

## Requirements

- **Default target = Encode.** In [src/App.tsx](src/App.tsx#L103), the target is chosen by `const [targetIndex, setTargetIndex] = useState(0)` (→ `targets[0]`, currently Split Horizon). Initialize it to the Encode target's index, looked up by id rather than a magic number — e.g. derive the initial index from `targets.findIndex(t => t.id === 'encode')` so it survives any future reordering of the `targets` array in [src/targets/manifest.ts](src/targets/manifest.ts). Guard against `-1` (fall back to `0`) so a renamed/removed id can't break load.
- **Default provider = OpenAI.** In [src/App.tsx](src/App.tsx#L106), change `useState<ProviderId>('anthropic')` to `'openai'`. The model is derived from the provider at [src/App.tsx:108](src/App.tsx#L108) (`providerCfg.models[0]`), so the default model will automatically become `gpt-4o` (first entry of the OpenAI `models` array in [src/config.ts](src/config.ts)) — confirm this resolves correctly and no separate model default needs editing.
- Do **not** reorder the `targets` array or the `PROVIDERS` array; only change the initial selection state. (Keeps diffs minimal and avoids side effects elsewhere that assume `targets[0]`/`PROVIDERS[0]`.)
- No changes to scoring, the locked rules, the renderer, the sanitizer, the system prompt, the agent message history, or the target data model.
- `npm run build` must pass (tsc strict).
- Verify with `npm run dev`: on first load the target preview shows the Encode logo and the provider selector reads OpenAI (model `gpt-4o`).

## References

- @src/App.tsx — initial state for `targetIndex` (line ~103) and `provider` (line ~106); model derivation (line ~108).
- @src/config.ts — `PROVIDERS` list (OpenAI entry, `models[0]` = `gpt-4o`); `getEnvKey` for the OpenAI key.
- @src/targets/manifest.ts — `targets` array; the Encode entry has `id: 'encode'`.

## Notes

- Looking the target up by `id` (not a literal index) is preferred so this default doesn't silently break if targets are added/reordered later.
- OpenAI calls need `VITE_OPENAI_API_KEY` in `.env` (or a key pasted into the toolbar). Changing the default provider does not provide a key; if none is set the existing "missing key" handling applies — this feature only changes which provider is pre-selected, not key management.
