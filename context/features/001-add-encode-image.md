# Add encode logo as a target image

## Overview

Register the existing [src/targets/06-encode.html](src/targets/06-encode.html) as a playable target in the app. The file is a pure HTML/CSS recreation of the "encode" logo — a blue-to-cyan gradient rounded square on a dark `#1b1f24` backdrop, with a centered white lowercase `e` flanked by two white accent dots (top and bottom). Once registered, it appears in the target list and can be selected for a round, rendered through the shared renderer as both the reference and the basis for scoring.

## Requirements

- Register `06-encode.html` in [src/targets/manifest.ts](src/targets/manifest.ts): import it with `?raw` and add a manifest entry (id, display name, the raw HTML, and `diffThreshold`).
- Give the target a stable `id` and a human-readable name (e.g. "encode logo").
- Set `diffThreshold` to ~0.12 — the target is dominated by rounded corners, a radial sheen, and large anti-aliased glyph/gradient edges, so the slightly looser shapes-with-AA value is appropriate (per CLAUDE.md guidance).
- The target must remain provably reconstructable to 100%: confirm `06-encode.html` is self-contained — inline `<style>`, no scripts, no external requests/images/fonts. (Verified: it uses only inline CSS and system fonts.)
- `npm run build` must pass (tsc strict) with the new manifest entry.
- The agent must never receive `06-encode.html`, its source, or the rendered image — registration only adds it to the target catalog the player sees.

## References

- @src/targets/06-encode.html — the target file to register.
- @src/targets/manifest.ts — where targets are registered.
- @src/lib/render.ts — the shared renderer used for both reference and attempts.
- @CLAUDE.md — "Adding a target" section (import `?raw`, body sized 400×300, `diffThreshold` guidance).

## Notes

- The body is sized via a 400×300 `.canvas` wrapper matching the renderer's fixed canvas; no resizing needed.
- One font note: the glyph uses `'Segoe UI', system-ui, sans-serif`. Since both the reference and attempts render through the same renderer on the same machine, font substitution affects both identically and does not threaten the 100%-reconstructable invariant — but be aware exact pixel parity depends on the player describing the same font stack.
