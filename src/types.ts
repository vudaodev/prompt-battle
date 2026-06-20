export type ProviderId = 'anthropic' | 'openai' | 'gemini';

export type TargetKind = 'shapes' | 'text';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface PaletteColor {
  name: string;
  hex: string;
}

export interface Target {
  /** stable id, also used as the leaderboard key in later phases */
  id: string;
  name: string;
  difficulty: Difficulty;
  kind: TargetKind;
  /** pixelmatch threshold (0..1). Tight (~0.1) for shapes. */
  diffThreshold: number;
  /** self-contained reference HTML (inline CSS). Never shown to the agent. */
  html: string;
  /** exact hex codes shown to the player (see design doc §11). */
  palette: PaletteColor[];
}

/** Provider-neutral conversation message. Adapted per provider in lib/llm.ts. */
export interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

export interface AttemptStep {
  seq: number;
  prompt: string;
  code: string;
  accuracy: number;
  renderUrl: string;
  diffUrl: string;
}
