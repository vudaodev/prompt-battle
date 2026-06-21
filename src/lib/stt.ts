import { ELEVENLABS } from '../config';

/**
 * Transcribe a recorded audio clip with ElevenLabs Speech-to-Text, browser-direct
 * (same trade-off as the LLM provider calls in llm.ts — the key is visible in the
 * bundle, fine for the local prototype). Input-only: never touches the agent.
 *
 * Note: we intentionally do NOT set Content-Type — the browser sets the multipart
 * boundary for us when the body is FormData.
 */
export async function transcribeAudio({
    apiKey,
    audio,
    useProxy,
}: {
    apiKey: string;
    audio: Blob;
    /** Route through the server-side proxy (api/stt.ts) instead of calling
     *  ElevenLabs directly, so the key never reaches the browser. */
    useProxy?: boolean;
}): Promise<string> {
    // No client-side key: in proxy mode the server supplies it; else it's an error.
    if (!apiKey) {
        if (useProxy) return transcribeViaProxy(audio);
        throw new Error('No ElevenLabs API key.');
    }

    const form = new FormData();
    form.append('model_id', ELEVENLABS.modelId);
    form.append('file', audio);

    const res = await fetch(ELEVENLABS.endpoint, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey },
        body: form,
    });

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`ElevenLabs error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    return data.text ?? '';
}

/**
 * Send the audio to the server proxy as base64 JSON, which adds the key and
 * forwards. JSON (not raw binary) because standalone @vercel/node functions
 * buffer/parse the body before the handler runs, so a raw request stream is
 * unreadable there — see api/stt.ts.
 */
async function transcribeViaProxy(audio: Blob): Promise<string> {
    const base64 = await blobToBase64(audio);
    const res = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audio: base64, type: audio.type || 'audio/webm' }),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`STT proxy error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    return data.text ?? '';
}

/** Read a Blob as a base64 string (without the `data:...;base64,` prefix). */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string; // data:<mime>;base64,<data>
            const comma = result.indexOf(',');
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () =>
            reject(reader.error ?? new Error('Failed to read audio.'));
        reader.readAsDataURL(blob);
    });
}
