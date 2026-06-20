import type { Msg, ProviderId } from '../types';

/**
 * Call the selected provider directly from the browser and return the agent's
 * raw text (which may still contain markdown fences — sanitize before render).
 *
 * Browser-direct notes:
 *  - Anthropic requires the `anthropic-dangerous-direct-browser-access` header.
 *  - OpenAI / Gemini allow browser calls; the key is visible in the bundle.
 *  - All three are fine for a LOCAL hackathon run; keys leak if deployed public.
 */
export async function callAgent(args: {
  provider: ProviderId;
  model: string;
  apiKey: string;
  system: string;
  messages: Msg[];
}): Promise<string> {
  const { provider, model, apiKey, system, messages } = args;
  if (!apiKey) throw new Error('No API key for the selected provider.');

  switch (provider) {
    case 'anthropic':
      return callAnthropic(model, apiKey, system, messages);
    case 'openai':
      return callOpenAI(model, apiKey, system, messages);
    case 'gemini':
      return callGemini(model, apiKey, system, messages);
  }
}

const MAX_TOKENS = 2048;

async function callAnthropic(model: string, apiKey: string, system: string, messages: Msg[]) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
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

async function callOpenAI(model: string, apiKey: string, system: string, messages: Msg[]) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
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

async function callGemini(model: string, apiKey: string, system: string, messages: Msg[]) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` +
    encodeURIComponent(apiKey);
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
