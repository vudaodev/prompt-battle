import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sameOriginOk } from './_guard.js';

/**
 * Server-side ElevenLabs Speech-to-Text proxy (Vercel Serverless Function).
 *
 * The browser POSTs JSON `{ audio: <base64>, type: <mime> }` (no API key). We
 * decode the audio, inject ELEVENLABS_API_KEY from the server environment,
 * forward to ElevenLabs as multipart/form-data, and return `{ text }`.
 *
 * Why base64/JSON and not the raw request stream: standalone @vercel/node
 * functions always buffer and parse the request body before the handler runs,
 * so reading `req` as a raw stream never fires 'data'/'end' and the function
 * hangs/crashes (FUNCTION_INVOCATION_FAILED). JSON via `req.body` is the
 * reliable path — the same one api/llm.ts uses.
 *
 * The key lives ONLY here (Vercel env var ELEVENLABS_API_KEY, no VITE_ prefix).
 */

const ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text';
const MODEL_ID = 'scribe_v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!sameOriginOk(req)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error('Server is missing ELEVENLABS_API_KEY.');

    const { audio, type } = (req.body ?? {}) as { audio?: string; type?: string };
    if (!audio) throw new Error('No audio payload.');
    const bytes = Buffer.from(audio, 'base64');

    const form = new FormData();
    form.append('model_id', MODEL_ID);
    form.append('file', new Blob([bytes], { type: type || 'audio/webm' }), 'audio.webm');

    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
    });
    if (!upstream.ok) {
      const body = await upstream.text().catch(() => '');
      throw new Error(`ElevenLabs error ${upstream.status}: ${body.slice(0, 300)}`);
    }
    const data = (await upstream.json()) as { text?: string };
    res.status(200).json({ text: data.text ?? '' });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Proxy error' });
  }
}
