## Prompt Battle Project Specifications

## Problem (Core Idea)

Companies have spent heavily on AI tool seats, but nobody can answer the question that decides the ROI: are our people actually good at using them? Directing an AI agent precisely toward an outcome is the defining skill of AI-assisted work, yet it is untrained and unmeasured:

- The skill is real but untrained — most "AI training" is passive slideware that says "be specific" without making anyone demonstrate it
- Adoption ≠ proficiency — usage dashboards show whether the tool is opened, not how well it is wielded
- No instrument measures it — traditional coding assessments test code authorship, the wrong skill for agent-driven work
- So L&D can't baseline the skill, prove it improved, or justify the spend

Prompt Battle provides ONE scored, repeatable way to both _build_ the skill and _prove_ it improved: a game where the player recreates a hidden visual target by directing an AI coding agent in plain language. The player can see the target, the agent cannot — the player is the agent's eyes, and the only lever is how precisely they describe and refine. The engaging game is the delivery mechanism; the score is the product.

## Users

- **L&D / Enablement Teams**:
  Rolling out AI tools (Copilot, Cursor, ChatGPT Enterprise, Claude for Work) and accountable for adoption and ROI. Need to baseline proficiency, show a delta, and defend the spend.

- **Engineering Leaders / Managers**:
  Handed AI-assisted-development mandates. Need their teams to actually get good, not just hold a licence.

- **Dev-tool / AI Platforms**:
  Want to drive activation and proficiency among their own users — an assessment/game layer that makes the tool stickier.

- **Bootcamps / Training Providers**:
  Building "AI fluency" curricula and needing a measurable, engaging practice instrument to anchor them.

- **The Player (end user)**:
  The developer or employee doing the reps — sees the target, directs the agent, watches accuracy update live, and climbs the ladder.

## Features

Here is a list of features for Prompt Battle.

A. **The Round (Core Loop)**
The round is the unit of play:

- Player sees the target plus its palette (exact hex codes)
- Up to **5 conversational prompts**, up to **10 minutes**, early submit allowed
- Each prompt refines the last; the full prompt + code history is carried to the agent
- Agent writes HTML/CSS blind; output renders live in a fixed 400×300 sandbox
- Player always sees: rendered output + the agent's code + a live diff overlay against the target
- Round ends at 5 prompts OR 10 minutes OR submit → final score

B. **Scoring**

- **Score = 1000 · A^γ · (1 − λ(P − 1))** where A is pixel-diff accuracy and P is prompts used
- Raw accuracy A is shown to the player; A^γ is applied only at scoring time
- The multiplicative prompt penalty makes "specify well up front" fall out of the math — each later prompt must clear a higher bar
- Time is a leaderboard tiebreaker only, never folded into the score
- λ and γ are exposed, tunable constants

C. **Targets**

- Every target is pure HTML/CSS (no imported images, photos, or rasters), so every target is provably reconstructable to 100%
- Two kinds: `shapes` (tight diff tolerance) and `text` (looser / blur-before-diff)
- The palette is shown to the player so the challenge is layout/shape description, not a colour-guessing lottery
- Single daily target or a library / ranked ladder

D. **The AI Agent**

- Multi-provider: Claude (Anthropic), OpenAI, or Gemini
- Receives only the system prompt, the full prompt/code history, and the new player prompt
- **Never** the target image and **never** any assets — the entire game lives at this boundary
- Self-render OFF (ranked): the agent doesn't see its own previous output, keeping all perception on the player
- HTML/CSS-only output enforced (scripts, inline handlers, and `javascript:` URLs stripped)

E. **Trust & Anti-cheat**

- The target never leaves the server; rendering and scoring run server-side
- Server-authoritative round timer and 5-prompt cap (never trust the client clock or counter)
- Sandboxed render with scripts disabled and a CSP blocking external requests
- The only legitimate channel to a high score is description quality

F. **Accounts, Leaderboard & Replay**

- Account authentication
- Per-target leaderboard ranked by score, with time as tiebreaker
- Every prompt step persisted — the replay / anti-cheat trail and the raw material for "how players describe things" analysis

G. **Assessment & Analytics (Pro / buyer-facing)**

- Admin dashboard showing baseline-to-current proficiency
- Scored, anti-cheat-hardened, replayable certification of agent-steering ability
- The persisted prompt-by-prompt trail is what makes the score credible as an assessment, not just a game

## Data

This is a rough mockup of what the data will look like. This is not set in stone:

**TARGET**

- id
- name
- difficulty
- kind (`shapes` | `text` — drives diff tolerance)
- diffThreshold (per-target pixelmatch tolerance; + blur flag for text)
- dimensions (400×300)
- referenceHtml / referenceCss (source of truth, never sent to client/agent)
- targetPngUrl (shown to the player _and_ the ground-truth bitmap scored against)
- palette (jsonb — shown to the player)
- fontAssets (jsonb — text targets only, deferred until first text target)
- createdAt

**ROUND**

- id
- startedAt (server) / endedAt
- status
- promptsUsed
- accuracy
- score
- timeTakenMs
- \*fields for user, target relations

**ROUNDPROMPT**

- id
- seq (1..5)
- promptText
- agentCode
- renderedPngUrl
- accuracyAtStep
- createdAt
- \*field for round relation

**USER**

- id
- isPro (for paid accounts)
- \*auth fields (Supabase)

**LEADERBOARD** (derived view)

- best score per user per target, time as tiebreaker

## Tech Stack

- Framework React + TypeScript front end (Vite for the prototype)
- FastAPI (Python) back end — round lifecycle, LLM proxy, rendering, scoring
- API routes for storing rounds/prompts and proxying AI calls
- TypeScript for type safety

**Database & ORM Supabase**
PostgreSQL + Auth

- Postgres in the cloud (Supabase)
- IMPORTANT: never push schema directly — use migrations run in dev then prod

**Rendering & Scoring**

- Headless Chromium via Playwright (server-side worker) — the one new infra piece
- pixelmatch for the PNG-vs-PNG pixel diff at a fixed 400×300
- Production never trusts the client to produce its own score

**AI Integration**

- Multi-provider: Claude (Anthropic) / OpenAI / Gemini
- Production: server-side keyed proxy, rate-limited per user/round; optional customer-supplied key

**Prototype (Phase 0.1 — built)**

- Vite + React + TypeScript, no backend
- Browser-direct provider calls, key from `.env`, provider dropdown
- html2canvas in-browser diff, 4–5 hardcoded shapes targets, full locked loop

**Styling**

- Custom CSS with design tokens (CSS variables); Space Grotesk (display) + JetBrains Mono (stats/code)
- Hosting: Vercel / Railway

## Monetization

B2B SaaS sold per-seat to organisations upskilling their people, with a land-and-expand path.

**Free / Pilot:**

- Free daily challenge
- Single-team pilot to seed the org

**Team / Enablement (paid, per-seat):**

- Practice library and ranked ladders
- Team leaderboards
- Admin dashboard (baseline-to-current proficiency)
- Priced per seat, benchmarked to L&D / assessment seats (price TBD)

**Assessment & Certification (per assessment or per seat):**

- Scored, anti-cheat-hardened, replayable test of agent-steering for hiring, onboarding gates, and internal certification
- The persisted prompt-by-prompt replay trail is what makes it credible

**Content Licensing / Platform deals:**

- Curated target sets licensed to bootcamps and training providers
- Embedded by dev-tool / AI platforms to lift activation among their users

Unit economics: the only meaningful variable cost is the per-prompt LLM call, already bounded by the 5-prompt cap, rate limiting, and an optional customer-supplied-key path. During the hackathon prototype, all mechanics are open and unmetered.

## UI/UX

**General**

- Modern, minimal, developer-focused
- Dark mode by default, black + dark green palette
- Clean typography, generous whitespace, subtle borders
- Reference: CSSBattle, Linear, Raycast
- Syntax-highlighted view of the agent's HTML output

**Layout**

- Toolbar: target selector, provider + model selectors, API-key status, live γ/λ controls
- Three panels:
    - **Target** — rendered target image + palette swatches (exact hex) + difficulty/kind badges
    - **Direct the Agent** — accuracy / prompts-used / time-left stats, conversation history, prompt input, send + submit-early
    - **Agent Output** — live render, diff-overlay toggle, scrollable HTML code view
- Round replay viewer (later phase)

**Colors & Type**

- Base: #060b08 (near-black)
- Surfaces: #13211a / #1b2c22 (dark green)
- Accent / CTA: #46ec82 (green)
- Accuracy: #4fdca5 (green)
- Brand / badges: #1d8a55 (dark green)
- Diff overlay + errors: #ff2bd6 (magenta — deliberately off-palette so mismatched pixels stay visible)
- Display: Space Grotesk · Mono: JetBrains Mono

**Responsive**

- Desktop-first but mobile usable
- The three panels stack into a single column on narrow screens

**Micro-interactions:**

- Live accuracy updates after each render
- Diff-overlay toggle highlighting mismatched pixels
- Countdown timer and an "Agent is building…" thinking state
- Score reveal on submit, hover states on controls, focus outlines
