# Lessons

## 1: `VITE_*` API keys leak into the client bundle

Any `VITE_`-prefixed env var is exposed to the browser.

**Problem:** Provider keys (`VITE_ANTHROPIC_API_KEY`, etc.) are inlined as plaintext into the JS bundle at build time. `npm run build` + deploy to any public URL makes them trivially extractable.

**Fix:** Never deploy the static build publicly with real keys in `.env`. Rotate any key that was built/deployed, set provider spend limits, and prefer the in-app toolbar paste (session-only). Production should proxy calls through a backend so the key never reaches the browser.

**Notes:** `.env` is gitignored and untracked; no hardcoded keys in source. Risk is the build pipeline, not git. See [.env.example](../.env.example).

**Pushing source to GitHub:** Safe. `npm run build` pushes nothing; `git push` only uploads tracked files. `.env` is gitignored + untracked and `dist/` is gitignored, so neither reaches the repo. Two things to never do: (1) `git add -f .env`, (2) commit or publicly host `dist/` — the build inlines the key as plaintext into `dist/assets/*.js`. Also worth checking once: confirm no key was committed in history *before* `.gitignore` existed (`git log -p -S VITE_`).

## 2: html2canvas 1.4.1 mis-renders `box-shadow` as a hard square

The renderer ([lib/render.ts](../src/lib/render.ts)) rasterizes both targets and attempts with html2canvas 1.4.1 — and it does **not** faithfully render all CSS. Notably, `box-shadow` (especially a soft/blurred glow) gets drawn as a hard opaque square ignoring the element's `border-radius`, producing a phantom box in the canvas that isn't in the live DOM.

**Problem:** The encode-logo target used a `box-shadow` glow on the rounded `.logo`. It looked correct in the browser but rasterized with a square artifact, so the target image (and any attempt copying it) was wrong — and since the *same* renderer rasterizes both, this silently corrupts scoring.

**Fix:** Removed the `box-shadow` and recreated the glow with a radial-gradient `::after` pseudo-element using `border-radius: inherit` — which html2canvas does render correctly. Verified clean through the actual html2canvas path, not just the live DOM.

**Notes / takeaways:**
- A target looking right in the browser is **not** sufficient — it must look right *through `renderHtmlToCanvas`*. Bisect suspicious renders in headless Chromium against the html2canvas output, not the DOM.
- Prefer html2canvas-safe CSS in targets: gradients, borders, `border-radius`, solid fills. Be wary of `box-shadow`, filters, and other effects the library approximates.
- This is why target `diffThreshold` is loosened (~0.12) for lots of rounded/AA edges — html2canvas rasterization isn't pixel-identical to a browser paint.
