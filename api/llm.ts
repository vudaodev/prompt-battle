import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Server-side LLM proxy (Vercel Serverless Function).
 *
 * The browser POSTs { provider, model, system, messages } with NO API key.
 * This function injects the secret key from the server environment and forwards
 * to the provider, returning { text } in the same shape the client expects.
 *
 * Keys live ONLY here (set in Vercel → Project → Settings → Environment
 * Variables, WITHOUT the VITE_ prefix so they are never inlined into the
 * browser bundle):
 *   OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY
 */

const MAX_TOKENS = 2048;

type Role = 'user' | 'assistant';
interface Msg {
  role: Role;
  content: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { provider, model, system, messages } = req.body as {
      provider: 'anthropic' | 'openai' | 'gemini';
      model: string;
      system: string;
      messages: Msg[];
    };

    let text: string;
    switch (provider) {
      case 'anthropic':
        text = await callAnthropic(model, system, messages);
        break;
      case 'openai':
        text = await callOpenAI(model, system, messages);
        break;
      case 'gemini':
        text = await callGemini(model, system, messages);
        break;
      default:
        res.status(400).json({ error: `Unknown provider: ${provider}` });
        return;
    }
    res.status(200).json({ text });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Proxy error' });
  }
}

function requireKey(name: string): string {
  const key = process.env[name];
  if (!key) throw new Error(`Server is missing ${name}.`);
  return key;
}

async function callAnthropic(model: string, system: string, messages: Msg[]) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': requireKey('ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: MAX_TOKENS, system, messages }),
  });
  const data = await readJson(res, 'Anthropic');
  const blocks: Array<{ type: string; text?: string }> = data.content ?? [];
  return blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
}

async function callOpenAI(model: string, system: string, messages: Msg[]) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${requireKey('OPENAI_API_KEY')}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  const data = await readJson(res, 'OpenAI');
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGemini(model: string, system: string, messages: Msg[]) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` +
    encodeURIComponent(requireKey('GEMINI_API_KEY'));
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: MAX_TOKENS },
    }),
  });
  const data = await readJson(res, 'Gemini');
  const parts: Array<{ text?: string }> = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? '').join('');
}

async function readJson(res: Response, label: string): Promise<any> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${label} error ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}
