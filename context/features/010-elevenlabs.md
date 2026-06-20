# Add ElevenLabs Speech-to-Text to the Prompt Box

## Overview

Let players **speak** their prompt instead of typing it. A mic button beside the prompt textarea records browser audio and sends it to ElevenLabs' Speech-to-Text API; the returned transcript is appended into the prompt draft. Recording is click-to-toggle (click to start, click again to stop + transcribe).

Consistent with the Phase 0.1 prototype, the call goes **straight from the browser** to ElevenLabs using a key from `.env` or a pasted toolbar field — the same pattern already used for the LLM providers in [src/lib/llm.ts](../../src/lib/llm.ts) and [src/config.ts](../../src/config.ts). No backend. This is input-only: it does not touch the agent boundary, the renderer, the sanitizer, scoring, or the locked rules.

## Requirements

- **STT module** — new [src/lib/stt.ts](../../src/lib/stt.ts) mirroring the style/error handling of [src/lib/llm.ts](../../src/lib/llm.ts):
    - `transcribeAudio({ apiKey, audio }: { apiKey: string; audio: Blob }): Promise<string>`.
    - Throws if `!apiKey` (match `callAgent`'s "No API key" guard).
    - `POST https://api.elevenlabs.io/v1/speech-to-text` with header `xi-api-key` (do **not** set `Content-Type` — let the browser set the multipart boundary).
    - Body: `FormData` with `model_id="scribe_v1"` and `file=<Blob>`.
    - On `!res.ok`, throw `ElevenLabs error <status>: <body slice>` (same shape as `readJson` in llm.ts). Return `data.text ?? ''`.
- **Mic recording** — new [src/lib/useRecorder.ts](../../src/lib/useRecorder.ts) hook using `navigator.mediaDevices.getUserMedia({ audio: true })` + `MediaRecorder`: `start()`, `stop()` (resolves one `audio/webm` `Blob`, stops all tracks), and an `isRecording` flag. Toggle only — no silence detection.
- **Config + env**:
    - [src/config.ts](../../src/config.ts): add `getElevenLabsEnvKey()` returning `import.meta.env.VITE_ELEVENLABS_API_KEY ?? ''`, and an `ELEVENLABS` constant (endpoint + `model_id: 'scribe_v1'`) alongside the existing locked constants.
    - [.env.example](../../.env.example): add `VITE_ELEVENLABS_API_KEY=`.
    - Do **not** extend the `ProviderId` union in [src/types.ts](../../src/types.ts) — STT is separate from the LLM providers.
- **App wiring** in [src/App.tsx](../../src/App.tsx):
    - Session state near the existing key state (~lines 116–142): `sttKeyOverride`/`setSttKeyOverride`, derived `effectiveSttKey = sttKeyOverride.trim() || getElevenLabsEnvKey()`, a `keySource` tag mirroring lines 136–142, plus `isTranscribing` state and the recorder hook.
    - Mic button in the `.actions` row beside **Send prompt** (~lines 575–583):
        - Recording → `stop()`, set `isTranscribing`, `transcribeAudio(...)`, then `setDraft(prev => prev ? prev + ' ' + text : text)` (append); clear flag.
        - Not recording → `start()`.
        - Wrap in try/catch and surface failures via the existing agent-error path (`dispatch({ type: 'FAIL', error })`, which sets `round.error` shown at App.tsx:532).
        - Disabled when `promptDisabled` (~line 573) or `!effectiveSttKey`.
        - Button label/icon reflects state: `🎤 Speak` / `● Rec` / `Transcribing…`.
    - **Toolbar key field** in `Toolbar` (~lines 709–809): add an ElevenLabs API-key `<label className="field key">` copied from the existing block (~lines 761–782), wired to `sttKeyOverride`/`setSttKeyOverride` with its own `keySource` keytag; thread the new props through `ToolbarProps`.
- **Styling** [src/styles.css](../../src/styles.css): reuse `.btn` (~lines 550–580); add a `.btn.recording` modifier using `--diff` (magenta) so active recording is obvious. No new layout primitives.

## References

- @src/App.tsx — prompt `<textarea>` + `.actions` row (~555–594); key state (~116–142); `handleSubmit` (~240–292); error display (line 532); `Toolbar` + `ToolbarProps` (~692–810).
- @src/lib/llm.ts — provider adapter + `readJson` error pattern to mirror.
- @src/config.ts — `getEnvKey`, `PROVIDERS`, locked constants.
- @.env.example — `VITE_*` key entries.
- @src/styles.css — `.btn` (~550–580), `.field`/`.toolbar` (~49–152), `.actions` (~544–548).
- ElevenLabs STT: `POST https://api.elevenlabs.io/v1/speech-to-text`, header `xi-api-key`, multipart `model_id`+`file`, transcript in response `.text`.

## Notes

- **CORS risk (verify first):** ElevenLabs does not document browser CORS support. During verification, confirm in DevTools Network that the POST is not CORS-blocked. If it is, a browser-direct call isn't viable in the prototype — stop and report before proceeding (a proxy would be out of Phase 0.1 scope).
- **Key exposure:** like the LLM keys, the ElevenLabs key lives in the browser — acceptable for the prototype, same trade-off as existing providers.
- Working agreement: branch `feature/elevenlabs-stt`; TypeScript strict, no `any` (use `unknown`); do not commit without permission.
- **Verification:** `npm run build` (tsc strict — the only gate) passes; then `npm run dev` with `VITE_ELEVENLABS_API_KEY` set (or pasted): mic toggles record state, spoken text appends to the prompt box, errors (empty/invalid key) surface in-UI without crashing, and the mic is disabled when `promptDisabled`.
