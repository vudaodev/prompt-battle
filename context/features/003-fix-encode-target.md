# Fix phantom square in encode target render

## Overview

The encode logo target ([src/targets/06-encode.html](src/targets/06-encode.html)) renders with a spurious, hard-edged lighter square behind the central `e`. The square is **not in the HTML** — it is a rendering artifact. **Confirmed root cause (via headless-Chromium bisect of the render path):** the `box-shadow: 0 24px 60px -18px rgba(34,86,224,0.7)` on `.logo`. html2canvas (v1.4.1, used by the shared renderer) mis-renders a blurred, negative-spread drop shadow as an opaque filled square behind the element. (An earlier hypothesis blamed the `.logo::after` radial-gradient sheen — that was wrong; removing the sheen had no effect.) The fix removes the box-shadow and keeps the sheen. The end result: the in-app render of the target matches the intended design (and stays provably reconstructable to 100%).

## Requirements

- Remove the `box-shadow` on `.logo` in [src/targets/06-encode.html](src/targets/06-encode.html) — it is the source of the square (html2canvas can't render the blurred/negative-spread shadow and fills a rectangle instead).
- Keep the `.logo::after` radial sheen, adding `border-radius: inherit` so html2canvas clips the overlay to the logo's rounded corners.
- The visible result through the shared renderer ([src/lib/render.ts](src/lib/render.ts)) must contain **no square** — only the rounded gradient logo, the subtle sheen, the white `e`, and the two white dots.
- The target must remain self-contained and pure HTML/CSS: inline `<style>` only, no scripts, no external requests/images/fonts — so it stays provably reconstructable to 100%.
- Do not change the renderer, sanitizer, scoring, or the manifest entry; the fix is scoped to the target HTML.
- `npm run build` must pass (tsc strict).
- Verify the rendered output (through the html2canvas render path) no longer shows the square.

## References

- @src/targets/06-encode.html — the target file with the `.logo::after` radial-gradient sheen that triggers the artifact.
- @src/lib/render.ts — shared renderer; rasterizes via html2canvas (the source of the mis-render).
- @CLAUDE.md — "Adding a target" guidance and renderer invariants.
- @context/features/001-add-encode-image.md — the feature that registered this target.

## Notes

- Root cause is specific to html2canvas 1.4.1's limited radial-gradient support; the file renders correctly when opened directly in a browser. Test the fix through the in-app render path, not just a browser preview.
- Keep the change minimal and confined to the `.logo::after` rule — the rest of the target (gradient, `e`, dots) renders correctly and should not be touched.
- If the sheen is removed rather than reworked, confirm the player can still describe the resulting flat-gradient logo to 100% accuracy (no hidden detail lost that the renderer would penalize).
