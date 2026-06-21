import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sameOriginOk } from './_guard';

/**
 * Server-side ElevenLabs Speech-to-Text proxy (Vercel Serverless Function).
 *
 * The browser POSTs the raw recorded audio as the request body (Content-Type =
 * the clip's mime, e.g. audio/webm). This function injects ELEVENLABS_API_KEY
 * from the server environment, forwards to ElevenLabs as multipart/form-data,
 * and returns { text }.
 *
 * The key lives ONLY here (Vercel env var ELEVENLABS_API_KEY, no VITE_ prefix).
 */

// We need the raw bytes, not a parsed JSON body.
export const config = { api: { bodyParser: false } };

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

    const audio = await readRawBody(req);
    const type =
      (req.headers['content-type'] as string | undefined) ?? 'application/octet-stream';

    const form = new FormData();
    form.append('model_id', MODEL_ID);
    form.append('file', new Blob([new Uint8Array(audio)], { type }), 'audio');

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

function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
