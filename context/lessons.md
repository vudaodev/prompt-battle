# Lessons

## 1: `VITE_*` API keys leak into the client bundle

Any `VITE_`-prefixed env var is exposed to the browser.

**Problem:** Provider keys (`VITE_ANTHROPIC_API_KEY`, etc.) are inlined as plaintext into the JS bundle at build time. `npm run build` + deploy to any public URL makes them trivially extractable.

**Fix:** Never deploy the static build publicly with real keys in `.env`. Rotate any key that was built/deployed, set provider spend limits, and prefer the in-app toolbar paste (session-only). Production should proxy calls through a backend so the key never reaches the browser.

**Notes:** `.env` is gitignored and untracked; no hardcoded keys in source. Risk is the build pipeline, not git. See [.env.example](../.env.example).

**Pushing source to GitHub:** Safe. `npm run build` pushes nothing; `git push` only uploads tracked files. `.env` is gitignored + untracked and `dist/` is gitignored, so neither reaches the repo. Two things to never do: (1) `git add -f .env`, (2) commit or publicly host `dist/` — the build inlines the key as plaintext into `dist/assets/*.js`. Also worth checking once: confirm no key was committed in history *before* `.gitignore` existed (`git log -p -S VITE_`).
