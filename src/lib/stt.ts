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

/** Send the raw audio bytes to the server proxy, which adds the key and forwards. */
async function transcribeViaProxy(audio: Blob): Promise<string> {
    const res = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'content-type': audio.type || 'application/octet-stream' },
        body: audio,
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`STT proxy error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    return data.text ?? '';
}
