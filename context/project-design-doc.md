# Prompt Battle — Architecture & Design Doc

A CSSBattle-style game where players recreate a visual target by directing an AI coding agent, not by writing code themselves — built as a skill-building and assessment product for organisations upskilling their workforce on AI.

## 1. Concept in one paragraph

The player is shown a target design. They cannot write code and the agent cannot see the target — the player’s only lever is natural-language description. The player relays what they see (“a dark navy square, top-left, about a third of the width…”), the agent writes HTML/CSS blind, the result renders live, and the player corrects over successive prompts. The skill being tested is precise visual description and agent steering, not CSS. Score rewards accuracy and efficiency together. Directing an agent precisely is the defining skill of AI-assisted work, so Prompt Battle is positioned as a skill-building and assessment product for the organisations now responsible for training it — the game is how the skill gets trained and measured.

The critical asymmetry: the target is visible to the player and withheld from the agent. The player is the agent’s eyes. Every decision below protects that asymmetry.

**Everything in a target is reproducible in pure HTML and CSS** — shapes, gradients, borders, patterns, CSS-drawable icons, and text. There are no imported image files, photos, or rasters anywhere in the game. This is a hard constraint, not a default: it’s what keeps every target provably scorable to 100% and keeps the agent boundary clean (there is no asset to supply, so nothing to leak except the target PNG, which never leaves the server). A more intricate CSS icon or pattern is simply a harder _shapes_ target — not a separate category.

## 2. Hackathon track — the “real business” bar (Solvimon)

This project targets Solvimon’s track: the entry with the strongest chance of becoming a **real business** — a clear problem, a believable customer, and a sensible path to monetisation. Prompt Battle’s buyer is whoever owns _“are our people actually good at using AI?”_ — L&D and enablement teams rolling out AI tools, engineering leaders handed AI-assisted-development mandates, and dev-tool platforms and training providers building “AI fluency” curricula. These are existing budget-holders already buying assessment seats (CodeSignal, HackerRank) and L&D platforms, so Prompt Battle slots into an existing line item rather than inventing one.

The problem is live now: companies have spent heavily on AI tool seats, but **adoption isn’t proficiency** and **no instrument measures the skill**. Usage dashboards show whether people open the tool, not how well they wield it; traditional coding assessments test code authorship — the wrong skill for agent-driven work. So L&D can’t baseline agent-steering ability, prove it improved, or justify the spend. Prompt Battle is built directly on that gap: a scored, repeatable way to both _build_ the skill and _prove_ it improved.

Monetisation is **per-seat B2B SaaS with a land-and-expand path** — a team/enablement subscription (practice library, ranked ladders, admin dashboard showing baseline-to-current proficiency) as the core motion, plus an assessment/certification lane (the persisted prompt-by-prompt replay trail is what makes the score credible) and content-licensing to bootcamps and platforms on top. Unit economics are sane: the only meaningful variable cost is the per-prompt LLM call, already bounded by the 5-prompt cap, server-side rate limiting, and an optional customer-supplied-key path. The engaging game is the delivery mechanism; the score is the product.

## 3. Core game loop

```
Round starts ──► Player sees target (+ palette) ──► Player types prompt #1
                                                          │
                          ┌───────────────────────────────┘
                          ▼
        Agent (no target access) generates full HTML/CSS
                          │
                          ▼
        Output rendered in fixed sandbox ──► live pixel-diff accuracy shown
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
  Prompt #2…#5 (refine)              Submit early
        │                                   │
        └─────────► ends at 5 prompts OR 10 min OR submit ─► final score
```

Up to 5 prompts, up to 10 minutes, early submit allowed.
Prompts are conversational — each refines the last (full history carried to the agent).
Player always sees: rendered output + the agent’s code + a live diff overlay against the target.

## 4. Scoring system (locked)

**Score = 1000 · A^γ · (1 − λ(P − 1))**

| Symbol | Meaning                  | Value                    |
| ------ | ------------------------ | ------------------------ |
| A      | pixel-diff accuracy, 0–1 | computed                 |
| P      | prompts used, 1–5        | counted                  |
| λ      | per-prompt decay         | ~0.05 (tunable constant) |
| γ      | accuracy curve exponent  | ~2–3 (tunable constant)  |

**Prompt multiplier (1 − λ(P−1)):**

| P   | multiplier | score @100% | score @90%  |
| --- | ---------- | ----------- | ----------- |
| 1   | ×1.00      | 1000        | 900·(0.9^γ) |
| 2   | ×0.95      | 950         | …           |
| 3   | ×0.90      | 900         | …           |
| 4   | ×0.85      | 850         | …           |
| 5   | ×0.80      | 800         | …           |

**Why multiplicative (the design rationale):** λ is not an arbitrary penalty — it’s the break-even accuracy gain below which spending another prompt lowers your score. Each later prompt must clear a slightly higher bar than the one before, so “specify well up front, don’t lazily nudge five times” falls out of the math rather than being a bolted-on rule. Because efficiency reward scales with accuracy, you can’t win on efficiency while doing bad work.

**Why A^γ:** pixel-diff clusters at the top — most real attempts land 92–99%. Raw A wastes range nobody uses and ties the leaderboard. γ ≈ 2–3 makes 95% read meaningfully worse than 99%. This is how CSSBattle stays strict.

**Time:** leaderboard tiebreaker only, never folded into the score. Early submit already self-rewards by banking unused prompts.

**Per-target diff tolerance:** the formula, λ, and γ are global and identical across all targets — what varies per target is only the diff tolerance that produces A (see Section 5). Text-bearing targets run a looser tolerance (or blur-before-diff) so a sub-perceptual glyph offset doesn’t crater an otherwise-correct attempt; shapes targets run tight. This keeps the incentive structure constant while matching strictness to each target’s intrinsic edge-sensitivity.

**Tradeoff to revisit:** this formula deliberately allows a 1-prompt 90% (≈900·0.9^γ) to occasionally beat a 5-prompt 100% (800). If you decide accuracy must always win, switch to additive (Score = 850·A^γ + (5−P)·30). Keep λ and γ as exposed constants so the curve can be tuned from play data.

## 5. Accuracy pipeline (the technically load-bearing part)

Pixel diff only works if target and output are rasterized at byte-identical dimensions in a deterministic environment.

1. Agent output renders in a fixed 400×300 sandbox (matches the target canvas).
1. Rasterize to RGBA bitmap.

- **Prototype:** html2canvas in the browser — fine, low-stakes.
- **Production:** render server-side in headless Chromium (Playwright/Puppeteer). Never trust the client to produce its own score.

1. Compare against the pre-rendered target PNG with pixelmatch (or equivalent).
1. A = 1 − (mismatched pixels / total pixels), with a per-target tolerance (Section 9 `diff_threshold`) rather than one global value.
1. Apply A^γ only at scoring time; show raw A to the player so feedback feels honest.

**Per-target tolerance by kind:** because every target is pure CSS, there are only two kinds — `shapes` and `text` — and the tag selects how A is computed:

- **shapes** — tight pixelmatch threshold. Solid regions are mostly interior, so a small offset costs only edge pixels; strictness is fair. This includes intricate CSS-drawn icons and patterns; they’re still solid-region shapes and diff the same way.
- **text** — loose threshold or Gaussian-blur both bitmaps a few px before diffing. Glyphs are almost all edge, so a 1–2px offset mismatches a large share of pixels; blur turns that hard cliff into a smooth slope. This is the cheapest fix (a couple of lines in the scoring step). SSIM is the more honest long-term option but changes the A definition — hold for later.

> **Text content vs. appearance.** On a text target, the player types the literal string verbatim (you can’t _describe_ “BATTLE” into existence, and guessing it isn’t a skill worth testing). That makes the **content** free transcription; the actual skill is **appearance** — font, weight, size, color, position. Text targets therefore test a narrower skill than shapes, which is fine because text is the rare variant (see below). The blur tolerance exists precisely to cushion sub-perceptual offsets in that appearance dimension.

**Practical sequencing:** the game is _mainly shapes_. Text is an occasional variant, so the deterministic-font + blur path is **deferred infrastructure, not launch-blocking**. v1 ships on shapes with a single tight global threshold and zero font worries; the font-pinning and blur step land only when you author your first text target.

**Determinism — to be clear:** within one pinned render environment, text is fully deterministic — same HTML/CSS renders byte-identical every time, so scores are reproducible. Text’s problem is _sensitivity_ (harshness of small real offsets), not randomness. Non-determinism only appears if target and attempts render in different environments, which the single pinned pipeline below eliminates.

**Determinism gotchas that will silently corrupt scores:**

- **Fonts.** Only relevant once a text target ships. The moment one text target goes live, an un-pinned font pipeline silently corrupts its scores, so the deterministic-font setup (embedded fonts + `await document.fonts.ready` before screenshot) must be in place _before that first text target_, even though shapes-only targets don’t need it. Render the target in the same environment that scores attempts.
- **Antialiasing / subpixel.** Two visually identical renders can differ on edges. Use pixelmatch’s threshold; don’t demand exact equality.
- **Render environment drift.** Target PNGs should be (re)generated by the same headless pipeline used for scoring, so the ground truth and attempts share rendering quirks.

## 6. The AI agent

**Prototype:** browser-direct calls to any of three providers — Claude (Anthropic), OpenAI, or Gemini — selected from a dropdown, with the key read from a local `.env`. No backend: the browser calls the provider API directly (Anthropic via its opt-in browser header). This exposes the key in the client bundle, which is acceptable for a local hackathon demo but not for a deployed site. **Production:** server-side key; FastAPI proxies every call (never expose the key client-side; rate-limit per user/round). User-supplied keys are a later option if you want to offload cost.

**Per-prompt request contents:**

- **System prompt:** “You are a coding agent. Output a single self-contained HTML document with inline CSS only. No JavaScript. Canvas is exactly 400×300. Return only code.”
- **Full conversation history** (prior prompts + prior code outputs).
- **The new player prompt.**
- **Never the target image.** This is the whole game — guard it at the API boundary.

**The agent receives no assets, ever.** Because every target is pure CSS, there is nothing to supply the agent beyond text — no image files, no font files relayed as data, nothing. The only sensitive artifact in the system is the target PNG, and it never leaves the server. This is a stronger, simpler version of the boundary rule: there is literally nothing else that _could_ leak.

**Enforcement:** strip anything that isn’t HTML/CSS from the agent’s output before rendering (remove `<script>`, inline event handlers, `javascript:` URLs). The model occasionally adds JS even when told not to.

**Self-render — LOCKED OFF (v1 ranked):** the agent does not see a screenshot of its own previous output. It reasons only from code history + the player’s descriptions. Rationale: keeps all perception on the player (“player = eyes”), cheaper, lower variance (no vision tokens, no run-to-run image noise), and faithful to “directing a coding agent.” Note it can’t see the target either way, so self-render could only ever fix execution slop, never understanding gaps — and the understanding gap is the game. Revisit only if targets get complex enough that the model’s code-intent and actual-render genuinely diverge; if so, add it as a practice mode toggle, not in ranked.

## 7. Sandbox & anti-gaming

- Render in an `<iframe sandbox>` with scripts disabled and a strict CSP blocking external network requests (no exfiltration, no phoning home, no loading the target).
- Fixed viewport, no scroll, output clipped to 400×300.
- HTML/CSS-only is enforced server-side in prod, not just by prompt instruction.
- Because the agent never receives the target and rendering+scoring happen server-side, the player cannot extract the target or fake a score. The only legitimate channel is description quality.
- **Timer authority:** server stamps round start; server validates the ≤10-min window and ≤5-prompt cap. Never trust the client clock or prompt counter.

> Note: the CSP’s no-external-requests rule is now unconditionally clean — since no target uses imported assets, the agent never has a legitimate reason to emit `<img src>`, `@font-face` from a URL, or any external fetch. Any such request is unambiguously something to strip.

## 8. System architecture

```
┌─────────────┐      ┌──────────────────────────────┐      ┌────────────┐
│  React (TS)  │◄────►│         FastAPI               │◄────►│  Postgres   │
│  - target    │      │  - round lifecycle / timer    │      │ (Supabase)  │
│  - prompt UI │      │  - LLM proxy (keyed)          │      └────────────┘
│  - live diff │      │  - headless render + pixelmatch│      ┌────────────┐
│  - code view │      │  - scoring                    │◄────►│  Headless   │
└─────────────┘      └──────────────────────────────┘      │  Chromium   │
                                                            └────────────┘
```

Stack aligns with your existing tooling: React/TS front end, FastAPI back end, Supabase (Postgres + auth), Vercel/Railway for hosting. The headless renderer is the one new infra piece — a worker (Railway service or container) running Playwright.

## 9. Data model (sketch)

```
targets
  id, name, difficulty,
  kind,                                 -- 'shapes' | 'text'  → drives diff tolerance
  diff_threshold,                       -- per-target pixelmatch tolerance (+ blur flag for text)
  dimensions (400×300),
  reference_html, reference_css,        -- source of truth, never sent to client/agent
  target_png_url, palette (jsonb),      -- palette IS shown to the player
  font_assets (jsonb),                  -- text targets only: pinned font-family/weight/size + embedded files
  created_at

rounds
  id, user_id, target_id,
  started_at (server),  ended_at,  status,
  prompts_used, accuracy, score, time_taken_ms

round_prompts
  id, round_id, seq (1..5),
  prompt_text, agent_code, rendered_png_url,
  accuracy_at_step, created_at

users         -- Supabase auth
leaderboard   -- derived view: best score per user per target, time as tiebreaker
```

`kind` is just `shapes` / `text` — there is no image category, because no target imports a raster. The old `reference_images` column is gone: with everything CSS-reproducible there are no supplied image files to store or relay. `font_assets` stays but is text-only and deferred until the first text target.

Keep each prompt step persisted — it’s both the replay/anti-cheat trail and great material for the “how players describe things” analysis that makes a strong portfolio writeup.

## 10. API surface

| Method | Endpoint                 | Notes                                                                                          |
| ------ | ------------------------ | ---------------------------------------------------------------------------------------------- |
| GET    | /targets                 | list (no reference code)                                                                       |
| GET    | /targets/{id}            | returns target PNG, dims, palette — not reference HTML/CSS                                     |
| POST   | /rounds                  | start round; server returns round_id + authoritative start time                                |
| POST   | /rounds/{id}/prompt      | server appends to history, calls LLM, renders, returns agent code + render PNG + live accuracy |
| POST   | /rounds/{id}/submit      | finalize, compute final score                                                                  |
| GET    | /leaderboard/{target_id} | ranked by score, time as tiebreaker                                                            |

## 11. Target content pipeline

A target exists in two forms, each with a distinct job:

- **`reference_html` / `reference_css`** — the hand-authored CSS source, the answer key. **Never shown to player or agent** (if it reached the client, a player could read it in devtools and dictate it back, collapsing the game). Server-locked, always.
- **`target_png_url`** — the PNG the player sees _and_ the ground-truth bitmap every attempt is diffed against.

The PNG is **rendered from the reference CSS through the exact same headless pipeline that scores attempts** (§5), never authored independently. That identity is what makes 100% achievable: ground truth and every attempt share one renderer, so a perfect CSS reconstruction matches pixel-for-pixel. Scoring is therefore always PNG-vs-PNG — the CSS is the source, the PNG the derived display + comparison artifact. (Storage: §9.)

**The reproducibility gate is absolute.** Every target must be exactly reconstructable in CSS, or 100% is impossible and the round feels unfair — there is no raster fallback (§1). That ranks the authoring methods:

- **Hand-authored reference HTML/CSS — the only v1 method.** Reproducibility holds by construction, since the ground-truth PNG is produced _from_ that CSS through the scoring pipeline.
- **Figma/SVG → PNG export — later, gated.** Prettier but risky: a gradient, texture, or blur CSS can’t cleanly hit silently makes the target unwinnable. Must pass a reproducibility check (rebuild in CSS, diff at 100%) before publishing.
- **AI-generated targets — later, gated.** Scale content fast; same check required.

**Format rules:** PNG only, never JPEG — its lossy edge artifacts no CSS render reproduces, and it has no alpha channel — for ground truth _and_ attempt renders. And never publish an image that didn’t originate as CSS (Figma export, screenshot, AI image used directly): if it didn’t come from CSS, nobody can recreate it in CSS, and 100% becomes impossible.

**Show the palette** (like CSSBattle): exposing exact hex codes moves the challenge to layout/shape description — the interesting part — instead of a color-guessing lottery that pixel-diff punishes harshly.

## 12. Open questions still to decide

- Per-target `diff_threshold` / blur radius for text — tune for fair antialias + offset tolerance once real attempts exist (deferred with text itself).
- Cross-target leaderboard comparability — different tolerances per kind mean a 95% on a text target ≠ 95% on a shapes target. Fine if the leaderboard is per-target (recommended for v1, CSSBattle-style). Only needs normalisation if you later want one pooled global skill rating.
- Single daily target vs. a library / ranked ladder — affects leaderboard design.
- λ and γ final values — ship the defaults, tune from play data.

**Resolved:**

- Agent self-render → OFF (Section 6).
- All targets are pure HTML/CSS — no imported images, photos, or rasters anywhere. CSS-drawable icons and patterns are just harder _shapes_ targets, not a separate category.
- Target kinds collapse to `shapes` / `text`; the old `shapes+image` category and `reference_images` storage are removed (Sections 1, 5, 9).
- Text targets: player types the literal string verbatim (content is free); appearance is the skill; blur tolerance + font-pinning are deferred until the first text target ships (Sections 5, 9).

## 13. Build roadmap

| Phase                 | Status      | Goal                          | Key pieces                                                                                                                                                                                                                                 |
| --------------------- | ----------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.1 — Prototype       | ✅ Complete | Prove the loop is fun         | Vite + React + TS app (no backend), provider dropdown (Claude/OpenAI/Gemini) with key from `.env`, html2canvas diff, 4–5 hardcoded shapes targets, full locked loop (5-prompt/10-min/early-submit/diff overlay), scoring constants exposed |
| 0.2 — Prototype       | ⬜ Planned  | TBD                           | TBD                                                                                                                                                                                                                                        |
| 1 — Core service      | ⬜ Planned  | Real, cheat-resistant scoring | FastAPI, server-side LLM proxy, Playwright render + pixelmatch, server-authoritative timer                                                                                                                                                 |
| 2 — Persistence       | ⬜ Planned  | Accounts + history            | Supabase auth, rounds/prompts schema, per-target leaderboard                                                                                                                                                                               |
| 3 — Content + polish  | ⬜ Planned  | More targets, daily challenge | Target pipeline, palette display, diff overlay UX, replay viewer                                                                                                                                                                           |
| 4 — Portfolio writeup | ⬜ Planned  | Depth story                   | Scoring-math derivation, anti-cheat architecture, “how players describe images” data analysis                                                                                                                                              |

---

**Decisions locked in this doc:** player-sees-target/agent-doesn’t asymmetry, 5-prompt/10-min/early-submit, conversational refinement, agent self-render OFF (ranked), multiplicative scoring with exposed λ/γ, HTML/CSS-only, fixed-size script-stripped sandbox, output+code+diff-overlay view, multi-provider browser-direct LLM (.env key, no backend) for prototype / keyed server proxy for prod, hand-authored reproducible targets, **all targets pure CSS (no imported assets), kinds = shapes / text with a per-target diff tolerance (tight for shapes, loose/blur for text).**
