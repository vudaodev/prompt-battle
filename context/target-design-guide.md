# Target Design Guide — Prompt Battle

A self-contained brief for creating new HTML/CSS "targets" for the Prompt Battle game. You do **not** need access to any codebase to follow this — everything you need is below. Deliver finished `.html` files plus a little metadata (see "What to deliver").

## What a target is

A target is a **single self-contained `.html` file** showing one visual design — a logo, a shape composition, a card, etc. In the game, a player sees the rendered design and must describe it to an AI agent that recreates it; the score is a pixel-diff between the original and the recreation. Because of that, **targets must be pure, reproducible HTML/CSS** — no randomness, no animation, no outside dependencies. A perfect description must be able to score 100%.

## Hard requirements (non-negotiable)

1. **Canvas is exactly 400 × 300 pixels.** The visible design must be sized to and fit inside a 400px-wide, 300px-tall area. Size the `body` (or an inner wrapper element) to exactly `400px × 300px`.
2. **One file, fully self-contained.** All CSS goes in a single inline `<style>` block in the `<head>`. No separate `.css` files.
3. **No scripts.** No `<script>` tags, no `on*=` event handlers, no `javascript:` URLs.
4. **No external requests of any kind.** No external images, no `<img src="http…">`, no web fonts (`@font-face` / Google Fonts), no `@import`, no URL that touches the network. Use only system fonts (e.g. `system-ui`, `'Segoe UI', sans-serif`).
5. **No randomness, no animation, no time-based rendering.** The design must look identical on every render so it can be scored to 100%.
6. **Reset default margins.** Start with `html, body { margin: 0; padding: 0; }` so the design isn't pushed off-center.
7. **Provably reconstructable.** Everything must be expressible in plain HTML/CSS — shapes, gradients, borders, and text — so a perfect description scores 100%.

## ⚠️ Critical: render-safe CSS only (read this)

The game rasterizes designs with a specific library, **html2canvas 1.4.1**, which does **not** render all CSS faithfully. A design that looks perfect in a normal browser tab can rasterize *wrong* — and because the same renderer is used for both the original and the player's recreation, a bad render silently corrupts scoring. **"It looks fine in Chrome" is not sufficient proof** — the design must render correctly through html2canvas specifically.

**The mistake we will not repeat: never use `box-shadow`.**
html2canvas 1.4.1 draws `box-shadow` — especially a soft/blurred glow — as a **hard opaque square** that ignores `border-radius`, producing a phantom box that isn't in the live page. This corrupted a real target once; don't reintroduce it.

- ❌ **Avoid:** `box-shadow`, `filter` / `backdrop-filter` (blur, drop-shadow), `clip-path`, `mask`, `mix-blend-mode`, and other effects the library only approximates.
- ✅ **Safe and preferred:** solid fills, `linear-gradient`, `radial-gradient`, `border`, `border-radius`, flexbox/grid layout, `transform`, `opacity`, `::before` / `::after` pseudo-elements, and text.
- **Need a glow or sheen?** Use a `radial-gradient` on a `::after` pseudo-element with `border-radius: inherit` instead of `box-shadow`. (See the worked example below.)

If you can, verify your output through html2canvas 1.4.1 directly (it's a small open-source JS library). If you can't, **stay strictly inside the "Safe and preferred" list above** and you'll be fine.

## Style / fit guidance

- Keep designs geometric and clean — flat fills, gradients, rounded rectangles, circles, simple text. They read well at 400×300 and score reliably.
- Use a small, deliberate palette (2–6 colors) with **exact hex codes**. List them in your deliverable.
- Center the artwork on a solid background color so edges are unambiguous.
- Vary difficulty: a two-color split is **easy**; a multi-layer card or logo is **hard**.

## Minimal skeleton

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
      }
      body {
        width: 400px;
        height: 300px;
        background: #0d0b1f;        /* solid backdrop */
        display: flex;
        align-items: center;
        justify-content: center;     /* center the artwork */
      }
      /* ...your design's classes here (solid fills, gradients,
         border-radius, transforms — NO box-shadow/filter)... */
    </style>
  </head>
  <body>
    <!-- your markup here -->
  </body>
</html>
```

## Worked examples

**Simplest possible (easy):** a two-color horizontal split.

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; }
      body {
        width: 400px;
        height: 300px;
        display: flex;
        flex-direction: column;
      }
      .top    { flex: 1; background: #3a36c4; }
      .bottom { flex: 1; background: #ffb020; }
    </style>
  </head>
  <body>
    <div class="top"></div>
    <div class="bottom"></div>
  </body>
</html>
```

**Richer (hard):** a gradient rounded-square logo with a sheen done *without* `box-shadow` — note the `::after` radial-gradient glow and the comments explaining the render-safety choices.

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        height: 100%;
        margin: 0;
        display: grid;
        place-items: center;
        background: #1b1f24;
        font-family: 'Segoe UI', system-ui, sans-serif;
      }
      .canvas {                 /* the 400 x 300 image area */
        width: 400px;
        height: 300px;
        display: grid;
        place-items: center;
        background: #1b1f24;
        overflow: hidden;
      }
      .logo {
        position: relative;
        width: 264px;
        height: 264px;
        border-radius: 22%;
        background: linear-gradient(40deg, #1f49d8 0%, #2256e0 30%, #2f86e8 60%, #34c5d8 100%);
        overflow: hidden;
        /* No box-shadow: html2canvas 1.4.1 would draw it as a hard square. */
      }
      .logo::after {            /* sheen via radial-gradient instead of box-shadow */
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit; /* keeps the sheen inside the rounded corners */
        background: radial-gradient(120% 100% at 100% 0%, rgba(255,255,255,0.18), rgba(255,255,255,0) 55%);
      }
      .e {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: #fff;
        font-size: 138px;
        font-weight: 700;
        line-height: 1;
        transform: translateY(-14px);
        z-index: 2;
      }
      .dot {
        position: absolute;
        width: 19px; height: 19px;
        border-radius: 50%;
        background: #fff;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2;
      }
      .dot.top    { top: 15%; }
      .dot.bottom { bottom: 15%; }
    </style>
  </head>
  <body>
    <div class="canvas">
      <div class="logo">
        <span class="dot top"></span>
        <span class="e">e</span>
        <span class="dot bottom"></span>
      </div>
    </div>
  </body>
</html>
```

## What to deliver

For each target, send back:
1. **The `.html` file**, named `short-name.html` (lowercase, hyphenated — e.g. `sunset-stripes.html`).
2. **A friendly name** (e.g. "Sunset Stripes").
3. **A difficulty:** `easy`, `medium`, or `hard`.
4. **The exact palette** — every hex code used, each with a short friendly name (e.g. `Indigo #3a36c4`, `Amber #ffb020`).

That metadata is all we need on our side to register the target. Aim for a few designs spanning easy → hard.
