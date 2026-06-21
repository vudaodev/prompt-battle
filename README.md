# Prompt Battle — Prototype

A browser-only prototype of Prompt Battle: recreate a hidden visual target by directing an AI coding agent in plain language. You can see the target; the agent can't. Your only lever is description.

Runs entirely in the browser — no backend. The agent call goes straight from the browser to whichever provider you pick (Claude, OpenAI, or Gemini), using a key from your local `.env`.

## File Structure

```
prompt-battle-prototype/
├── index.html              # Vite entry; loads brand fonts
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── .env.example            # copy to .env and add your key(s)
├── .gitignore
└── src/
    ├── main.tsx            # React mount
    ├── App.tsx             # game loop, state machine, timer, full UI
    ├── styles.css          # brand theme
    ├── types.ts            # shared types
    ├── config.ts           # canvas, caps, scoring defaults, providers, system prompt
    ├── vite-env.d.ts       # typed VITE_* env vars
    ├── lib/
    │   ├── llm.ts          # multi-provider browser-direct agent calls
    │   ├── sanitize.ts     # extract HTML + strip non-HTML/CSS
    │   ├── render.ts       # render HTML → 400×300 canvas (iframe + html2canvas)
    │   └── scoring.ts      # pixelmatch diff + Score formula
    └── targets/
        ├── manifest.ts     # registers each target (metadata + palette)
        ├── 01-split-horizon.html
        ├── 02-bullseye.html
        ├── 03-tricolore.html
        ├── 04-nested.html
        ├── 05-profile-card.html
        └── 06-encode.html
```

## Getting started

You need Node 18+ (`node -v` to check).

```bash
# 1. install dependencies
npm install

# 2. add your API key(s)
cp .env.example .env
#    then open .env and paste a key for the provider(s) you want to use:
#      VITE_ANTHROPIC_API_KEY=sk-ant-...
#      VITE_OPENAI_API_KEY=sk-...
#      VITE_GEMINI_API_KEY=...
#    (you only need a key for the provider you'll select in the app)

# 3. run it
npm run dev
```

Vite prints a local URL (usually `http://localhost:5173`) and opens it. Pick a target, pick a provider, and start describing.

> You can also skip `.env` entirely and paste a key into the **API key** box in the toolbar — it's kept in memory for the session only.

## How to play

1. Look at the target (top-left) and its palette — exact hex codes are given on purpose, so the challenge is describing **shape, size, and position**, not guessing colours.
2. Type a prompt describing what to build. The agent writes HTML/CSS blind and it renders on the right with a live accuracy score.
3. Refine over up to **5 prompts**, within **10 minutes**. Each prompt slightly lowers your multiplier, so specify well up front.
4. **Submit early** any time to bank unused prompts. Toggle **Diff overlay** to see mismatched pixels in magenta.

Score = `1000 · A^γ · (1 − λ(P−1))`. γ and λ are adjustable live in the toolbar so you can feel how the curve behaves.

## Adding your own targets

Every target is pure HTML/CSS (no images, no external requests), which is what guarantees it's reconstructable to 100%. To add one:

1. Drop a self-contained `.html` file in `src/targets/` (inline `<style>`, body sized to 400×300, no scripts).
2. Import it and add an entry in `src/targets/manifest.ts`:

    ```ts
    import mine from './06-my-target.html?raw';

    // ...add to the targets array:
    {
      id: 'my-target',
      name: 'My Target',
      difficulty: 'medium',
      kind: 'shapes',
      diffThreshold: 0.1,   // tight for shapes; loosen slightly for lots of rounded edges
      html: mine,
      palette: [{ name: 'Indigo', hex: '#3a36c4' }],
    }
    ```

The ground-truth bitmap is generated **from this HTML at runtime** through the same renderer that scores attempts, so a perfect reconstruction genuinely hits 100%.

## Updating model IDs

Default model names live in `src/config.ts` under `PROVIDERS`. Providers ship new models often — if a call 404s on the model, edit the `models` array there (the first entry is the default).

## Notes & limitations (it's a prototype)

- **Keys are in the browser bundle.** Fine for local use; they'd be exposed if you deployed this static site publicly. Real key handling is a server concern (design doc Phase 1).
- **No anti-cheat.** The reference CSS is technically inspectable in devtools. The prototype just proves the loop is fun; server-side scoring/timer come in Phase 1.
- **Scoring is client-side** via `html2canvas` + `pixelmatch`. `html2canvas` is an approximation of the browser's renderer, so accuracy is indicative, not authoritative — production swaps in headless Chromium. If a render looks wrong, check the browser console.
- **CORS:** all three providers allow browser-direct calls (Anthropic via an explicit opt-in header, already set). If a provider later blocks browser origins, you'd need a tiny proxy.
