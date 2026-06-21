# Deploying Prompt Battle to Vercel

This repo is set up to deploy as a **Vite static site + serverless API proxy** on
Vercel. In production the browser holds **no API keys** — it calls `/api/llm` and
`/api/stt`, and those serverless functions inject the real keys from server-side
environment variables. This guide walks through it end to end.

## How the deployed app differs from local

| | Local dev | Vercel (this guide) |
|---|---|---|
| Provider calls | Browser → provider directly | Browser → `/api/*` → provider |
| Where the key lives | `.env` (`VITE_*`), inlined in the bundle | Vercel env vars (no `VITE_` prefix), server-only |
| Toggle | `VITE_USE_PROXY` unset | `VITE_USE_PROXY=1` |

The switch is the [`USE_PROXY`](src/config.ts) flag, driven by `VITE_USE_PROXY`.
When it's on, [src/lib/llm.ts](src/lib/llm.ts) / [src/lib/stt.ts](src/lib/stt.ts)
send requests with no key, and [api/llm.ts](api/llm.ts) / [api/stt.ts](api/stt.ts)
add the secret key. A same-origin guard ([api/_guard.ts](api/_guard.ts)) blocks any
request that doesn't come from your own deployed site.

> ⚠️ **The one rule that matters:** in production, set the secret keys **WITHOUT**
> the `VITE_` prefix. Anything named `VITE_*` is compiled into the public JavaScript
> bundle and is visible to anyone. (If you slip up, the app logs a console warning at
> startup — see [src/config.ts](src/config.ts).)

---

## Prerequisites

- The code is pushed to GitHub (it is: `vudaodev/prompt-battle`, branch `main`).
- A free [Vercel account](https://vercel.com/signup) (sign in with GitHub).
- API key(s) for the provider(s) you want to offer:
  - OpenAI — `OPENAI_API_KEY`
  - Anthropic (Claude) — `ANTHROPIC_API_KEY`
  - Google Gemini — `GEMINI_API_KEY`
  - ElevenLabs (mic / speech-to-text, optional) — `ELEVENLABS_API_KEY`

  You only need keys for the providers you'll actually use.

---

## Option A — Deploy from the Vercel dashboard (recommended)

### 1. Import the project
1. Go to <https://vercel.com/new>.
2. Under **Import Git Repository**, pick `vudaodev/prompt-battle`. (Authorize the
   Vercel GitHub app for the repo if prompted.)

### 2. Confirm build settings
Vercel reads [vercel.json](vercel.json) and should auto-fill:
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

Leave these as-is. The `api/` folder is detected automatically as serverless
functions (typed with `@vercel/node`, already a dev dependency) — no extra config.

### 3. Add Environment Variables
Before the first deploy, expand **Environment Variables** and add the following.
Apply each to **Production, Preview, and Development** (the three checkboxes).

**Required — turn on proxy mode (build-time):**

| Name | Value |
|------|-------|
| `VITE_USE_PROXY` | `1` |

**Required — the secret key(s) (server-only, NO `VITE_` prefix):**

| Name | Value |
|------|-------|
| `OPENAI_API_KEY` | `sk-...` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` *(only if offering Claude)* |
| `GEMINI_API_KEY` | `...` *(only if offering Gemini)* |
| `ELEVENLABS_API_KEY` | `...` *(only if using the mic)* |

**Do NOT add** `VITE_OPENAI_API_KEY`, `VITE_ANTHROPIC_API_KEY`, etc. — those would
leak into the bundle.

**Optional — `ALLOWED_ORIGIN`:** not needed for the normal case. The proxy already
allows requests from its own host (so `*.vercel.app` and any custom domain pointed at
this project just work). Only set this if your frontend is served from a *different*
host than the API — e.g. `ALLOWED_ORIGIN=https://play.example.com`.

### 4. Deploy
Click **Deploy**. Vercel runs `npm install` then `npm run build` (which now also
type-checks `api/` via `tsconfig.api.json`) and publishes. You'll get a URL like
`https://prompt-battle-xxxx.vercel.app`.

### 5. Verify (see the checklist below).

After this, every push to `main` auto-deploys to production, and every PR/branch gets
a preview URL.

---

## Option B — Deploy from the CLI

```bash
npm i -g vercel        # install the CLI
vercel login           # authenticate

# from the repo root:
vercel                 # first run: link/create the project, deploys a PREVIEW

# add env vars (repeat per variable; you'll be asked which environments)
vercel env add VITE_USE_PROXY        # value: 1
vercel env add OPENAI_API_KEY        # value: sk-...
vercel env add ELEVENLABS_API_KEY    # value: ...   (if using the mic)
# ...add ANTHROPIC_API_KEY / GEMINI_API_KEY as needed

vercel --prod          # promote to production with the env vars applied
```

> Env vars are read at **build time** for `VITE_*` and at **run time** for the
> server keys. If you add or change any variable after a deploy, **redeploy** so it
> takes effect (`vercel --prod`, or "Redeploy" in the dashboard).

---

## Verification checklist

On your deployed URL:

1. **App loads** and you can start a round.
2. **Agent call works:** describe a target and submit — the agent should render an
   attempt. (This proves `/api/llm` + the server key are wired correctly.)
3. **Keys are NOT in the bundle:** open DevTools → Network → reload → find the
   `index-*.js` asset → search it for `sk-` or your key. You should find **nothing**.
   Also check the console: no `[prompt-battle] USE_PROXY is on but a VITE_*_API_KEY
   is set` warning.
4. **Mic (optional):** click the mic, record a phrase, confirm it transcribes
   (proves `/api/stt` + `ELEVENLABS_API_KEY`).
5. **Proxy is locked down (optional):** from a terminal,
   ```bash
   curl -i -X POST https://YOUR-URL/api/llm -H 'content-type: application/json' -d '{}'
   ```
   should return **`403 Forbidden`** (no `Origin` header = not from your site). Your
   own in-app requests still work because the browser sends a matching `Origin`.

---

## Troubleshooting

- **Agent calls fail with "Server is missing OPENAI_API_KEY":** the key isn't set for
  the deployed environment, or you set it as `VITE_OPENAI_API_KEY`. Add the
  non-prefixed key and redeploy.
- **Calls go to the provider directly / key visible in bundle:** `VITE_USE_PROXY`
  isn't set (or wasn't set at build time). Add `VITE_USE_PROXY=1` and **redeploy** —
  `VITE_*` vars are baked in at build, so a redeploy is required.
- **Everything returns `403`:** the request `Origin` doesn't match the host. This is
  normal for `curl`/external clients. If your real frontend is on a separate domain
  from the API, set `ALLOWED_ORIGIN` to that frontend's origin.
- **Model 404s:** the default model id in [src/config.ts](src/config.ts) `PROVIDERS`
  may be stale — update the `models` array (first entry is the default).
- **Build fails on `tsc -p tsconfig.api.json`:** ensure `@vercel/node` installed
  (it's a dev dependency; Vercel installs dev deps during build by default).
