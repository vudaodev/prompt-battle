import type { ProviderId } from './types';

/** Fixed canvas. Reference target and every attempt are rasterized at these dims. */
export const CANVAS = { width: 400, height: 300 } as const;

/** Locked game rules (design doc §3, §4). */
export const MAX_PROMPTS = 5;
export const ROUND_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Scoring constants, exposed so they can be tuned from play data (design doc §4).
 * Score = 1000 · A^gamma · (1 − lambda·(P − 1))
 * These are the defaults; both are editable live in the toolbar.
 */
export const DEFAULT_GAMMA = 2.5; // accuracy curve exponent (~2–3)
export const DEFAULT_LAMBDA = 0.05; // per-prompt decay

/** ElevenLabs Speech-to-Text (prompt-box mic). Separate from the LLM providers. */
export const ELEVENLABS = {
    endpoint: 'https://api.elevenlabs.io/v1/speech-to-text',
    modelId: 'scribe_v1',
} as const;

/** The agent never sees the target. This is the entire game — guard it. */
export const SYSTEM_PROMPT = [
  'You are a coding agent.',
  'Output a single self-contained HTML document with inline CSS only.',
  'No JavaScript. No external requests (no <img src>, no @font-face URLs, no fonts/CDNs).',
  'The canvas is exactly 400x300 pixels; the <body> should fill it with no margin.',
  'Recreate exactly what the user describes. The user can see a target image that you cannot.',
  'Return only the HTML code. No explanation, no commentary, no markdown code fences.',
].join(' ');

/**
 * Post-round coach. Unlike SYSTEM_PROMPT, this path *is* shown the target
 * (the reference HTML) by design — it runs only after a round is scored and
 * over, produces no scored attempt, and never relaxes the in-round boundary.
 */
export const COACH_SYSTEM_PROMPT = [
  'You are a Prompt Battle coach.',
  'In Prompt Battle, a player recreates a hidden visual target by describing it to a coding agent that CANNOT see the target — only the player can.',
  'The agent builds HTML/CSS purely from the player\'s words; its accuracy is a pixel-diff against the target.',
  'Unlike the agent, you CAN see the target: you are given its reference HTML, the player\'s prompts in order (each tagged with the accuracy it produced), the agent\'s final HTML, and the final accuracy and score.',
  'First, briefly explain why the agent likely produced what it did given the exact wording the player used — point at specific prompts.',
  'Then give concrete, prioritized suggestions for clearer prompts: better wording for shapes, sizes, positions, and colour placement, quoting or referencing the player\'s actual prompts.',
  'Be specific and encouraging. Lead with the highest-impact change.',
  'Reply in short plain-text prose with simple "- " bullets. No HTML, no markdown code fences, no headings. A few hundred words at most.',
].join(' ');

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  /** First entry is the default model. Update these IDs as providers ship new models. */
  models: string[];
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    models: ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4.1', 'gpt-4o-mini'],
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  },
];

/** Read the key for a provider from .env (VITE_*). Empty string if unset. */
export function getEnvKey(provider: ProviderId): string {
  switch (provider) {
    case 'anthropic':
      return import.meta.env.VITE_ANTHROPIC_API_KEY ?? '';
    case 'openai':
      return import.meta.env.VITE_OPENAI_API_KEY ?? '';
    case 'gemini':
      return import.meta.env.VITE_GEMINI_API_KEY ?? '';
  }
}

/** ElevenLabs STT key from .env (VITE_*). Empty string if unset. */
export function getElevenLabsEnvKey(): string {
  return import.meta.env.VITE_ELEVENLABS_API_KEY ?? '';
}
