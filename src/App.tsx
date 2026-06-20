import { useEffect, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
    CANVAS,
    DEFAULT_GAMMA,
    DEFAULT_LAMBDA,
    MAX_PROMPTS,
    PROVIDERS,
    ROUND_MS,
    SYSTEM_PROMPT,
    getEnvKey,
} from './config';
import type { AttemptStep, Msg, ProviderId } from './types';
import { targets } from './targets/manifest';
import { callAgent } from './lib/llm';
import { prepareHtml } from './lib/sanitize';
import { renderHtmlToCanvas, canvasPixels } from './lib/render';
import { computeDiff, computeScore } from './lib/scoring';

// ---------------------------------------------------------------- round state

type Phase = 'ready' | 'thinking' | 'ended';

interface RoundState {
    phase: Phase;
    startedAt: number | null;
    promptsUsed: number;
    history: Msg[];
    steps: AttemptStep[];
    currentCode: string | null;
    currentRenderUrl: string | null;
    currentDiffUrl: string | null;
    accuracy: number | null;
    finalScore: number | null;
    error: string | null;
}

const initialRound: RoundState = {
    phase: 'ready',
    startedAt: null,
    promptsUsed: 0,
    history: [],
    steps: [],
    currentCode: null,
    currentRenderUrl: null,
    currentDiffUrl: null,
    accuracy: null,
    finalScore: null,
    error: null,
};

type Action =
    | { type: 'RESET' }
    | { type: 'START_THINKING' }
    | { type: 'STEP_RESULT'; step: AttemptStep; history: Msg[] }
    | { type: 'FAIL'; error: string }
    | { type: 'FINALIZE'; score: number };

function roundReducer(state: RoundState, action: Action): RoundState {
    switch (action.type) {
        case 'RESET':
            return initialRound;
        case 'START_THINKING':
            return {
                ...state,
                phase: 'thinking',
                error: null,
                startedAt: state.startedAt ?? Date.now(),
            };
        case 'STEP_RESULT':
            return {
                ...state,
                phase: 'ready',
                promptsUsed: action.step.seq,
                steps: [...state.steps, action.step],
                history: action.history,
                currentCode: action.step.code,
                currentRenderUrl: action.step.renderUrl,
                currentDiffUrl: action.step.diffUrl,
                accuracy: action.step.accuracy,
            };
        case 'FAIL':
            return { ...state, phase: 'ready', error: action.error };
        case 'FINALIZE':
            return { ...state, phase: 'ended', finalScore: action.score };
    }
}

// ---------------------------------------------------------------- helpers

function formatTime(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const pct = (a: number) => `${(a * 100).toFixed(1)}%`;

// ---------------------------------------------------------------- component

export default function App() {
    const [targetIndex, setTargetIndex] = useState(0);
    const target = targets[targetIndex];

    const [provider, setProvider] = useState<ProviderId>('anthropic');
    const providerCfg = PROVIDERS.find((p) => p.id === provider)!;
    const [model, setModel] = useState(providerCfg.models[0]);
    const [keyOverride, setKeyOverride] = useState('');

    const [gamma, setGamma] = useState(DEFAULT_GAMMA);
    const [lambda, setLambda] = useState(DEFAULT_LAMBDA);

    const [draft, setDraft] = useState('');
    const [showDiff, setShowDiff] = useState(false);
    const [now, setNow] = useState(Date.now());

    const [targetRenderUrl, setTargetRenderUrl] = useState<string | null>(null);
    const [targetError, setTargetError] = useState<string | null>(null);
    const refPixels = useRef<Uint8ClampedArray | null>(null);

    const [round, dispatch] = useReducer(roundReducer, initialRound);

    const envKey = getEnvKey(provider);
    const effectiveKey = keyOverride.trim() || envKey;
    const keySource: 'pasted' | 'env' | 'none' = keyOverride.trim()
        ? 'pasted'
        : envKey
          ? 'env'
          : 'none';

    // Render the reference target whenever the selection changes; reset the round.
    useEffect(() => {
        let cancelled = false;
        dispatch({ type: 'RESET' });
        setDraft('');
        setShowDiff(false);
        setTargetRenderUrl(null);
        setTargetError(null);
        refPixels.current = null;

        (async () => {
            try {
                const canvas = await renderHtmlToCanvas(target.html);
                if (cancelled) return;
                refPixels.current = canvasPixels(canvas);
                setTargetRenderUrl(canvas.toDataURL());
            } catch {
                if (!cancelled) setTargetError('Failed to render this target.');
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [targetIndex]); // eslint-disable-line react-hooks/exhaustive-deps

    // Timer tick.
    useEffect(() => {
        if (round.startedAt == null || round.phase === 'ended') return;
        const id = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(id);
    }, [round.startedAt, round.phase]);

    // Timeout -> finalize.
    useEffect(() => {
        if (round.startedAt == null || round.phase === 'ended') return;
        if (round.startedAt + ROUND_MS - now <= 0) {
            dispatch({
                type: 'FINALIZE',
                score: computeScore(
                    round.accuracy ?? 0,
                    round.promptsUsed,
                    gamma,
                    lambda,
                ),
            });
        }
    }, [
        now,
        round.startedAt,
        round.phase,
        round.accuracy,
        round.promptsUsed,
        gamma,
        lambda,
    ]);

    const remainingMs =
        round.startedAt == null
            ? ROUND_MS
            : Math.max(0, round.startedAt + ROUND_MS - now);

    const canSubmit =
        round.phase === 'ready' &&
        !!draft.trim() &&
        round.promptsUsed < MAX_PROMPTS &&
        !!effectiveKey &&
        refPixels.current != null;

    async function handleSubmit() {
        if (!canSubmit) return;
        const prompt = draft.trim();
        const seq = round.promptsUsed + 1;
        setDraft('');
        dispatch({ type: 'START_THINKING' });

        try {
            const messages: Msg[] = [
                ...round.history,
                { role: 'user', content: prompt },
            ];
            const raw = await callAgent({
                provider,
                model,
                apiKey: effectiveKey,
                system: SYSTEM_PROMPT,
                messages,
            });
            const code = prepareHtml(raw);
            const canvas = await renderHtmlToCanvas(code);
            const { accuracy, diffCanvas } = computeDiff(
                refPixels.current!,
                canvasPixels(canvas),
                target.diffThreshold,
            );
            const step: AttemptStep = {
                seq,
                prompt,
                code,
                accuracy,
                renderUrl: canvas.toDataURL(),
                diffUrl: diffCanvas.toDataURL(),
            };
            const history: Msg[] = [
                ...messages,
                { role: 'assistant', content: code },
            ];
            dispatch({ type: 'STEP_RESULT', step, history });

            if (seq >= MAX_PROMPTS) {
                dispatch({
                    type: 'FINALIZE',
                    score: computeScore(accuracy, seq, gamma, lambda),
                });
            }
        } catch (e) {
            dispatch({
                type: 'FAIL',
                error: e instanceof Error ? e.message : 'Something went wrong.',
            });
        }
    }

    function handleFinalize() {
        dispatch({
            type: 'FINALIZE',
            score: computeScore(
                round.accuracy ?? 0,
                round.promptsUsed,
                gamma,
                lambda,
            ),
        });
    }

    function handleNewRound() {
        dispatch({ type: 'RESET' });
        setDraft('');
        setShowDiff(false);
    }

    const scorePreview =
        round.accuracy != null
            ? computeScore(
                  round.accuracy,
                  Math.max(1, round.promptsUsed),
                  gamma,
                  lambda,
              )
            : null;

    return (
        <div className="app">
            <Toolbar
                provider={provider}
                model={model}
                keySource={keySource}
                keyOverride={keyOverride}
                gamma={gamma}
                lambda={lambda}
                targetIndex={targetIndex}
                disabledModelSwitch={round.phase === 'thinking'}
                onProvider={(p) => {
                    setProvider(p);
                    setModel(PROVIDERS.find((x) => x.id === p)!.models[0]);
                }}
                onModel={setModel}
                onKeyOverride={setKeyOverride}
                onGamma={setGamma}
                onLambda={setLambda}
                onTarget={setTargetIndex}
                onNewRound={handleNewRound}
            />

            <main className="grid">
                {/* ---- target ---- */}
                <section className="panel">
                    <h2 className="panel-title">Target</h2>
                    <Stage>
                        {targetRenderUrl ? (
                            <img
                                className="stage-img"
                                src={targetRenderUrl}
                                alt="target"
                            />
                        ) : (
                            <div className="stage-empty">
                                {targetError ?? 'Rendering target…'}
                            </div>
                        )}
                    </Stage>
                    <div className="meta">
                        <span className="badge">{target.name}</span>
                        <span className="badge ghost">{target.difficulty}</span>
                        <span className="badge ghost">{target.kind}</span>
                    </div>
                    <div className="palette">
                        {target.palette.map((c) => (
                            <div className="swatch" key={c.hex}>
                                <span
                                    className="chip"
                                    style={{ background: c.hex }}
                                />
                                <span className="chip-name">{c.name}</span>
                                <span className="chip-hex">{c.hex}</span>
                            </div>
                        ))}
                    </div>
                    <p className="hint">
                        Exact hex codes are shown on purpose — describe shape,
                        size and position, not colour.
                    </p>
                </section>

                {/* ---- direct the agent ---- */}
                <section className="panel">
                    <h2 className="panel-title">Direct the agent</h2>
                    <div className="stat-row">
                        <Stat
                            label="Accuracy"
                            value={
                                round.accuracy != null
                                    ? pct(round.accuracy)
                                    : '—'
                            }
                            accent="teal"
                        />
                        <Stat
                            label="Prompts"
                            value={`${round.promptsUsed}/${MAX_PROMPTS}`}
                        />
                        <Stat
                            label="Time left"
                            value={formatTime(remainingMs)}
                            accent={remainingMs < 60_000 ? 'amber' : undefined}
                        />
                    </div>

                    <div className="log">
                        {round.steps.length === 0 &&
                            round.phase !== 'thinking' && (
                                <p className="log-empty">
                                    The agent can’t see the target — you are its
                                    eyes. Describe what to build.
                                </p>
                            )}
                        {round.steps.map((s) => (
                            <div className="log-item" key={s.seq}>
                                <div className="log-head">
                                    <span className="seq">#{s.seq}</span>
                                    <span className="log-acc">
                                        {pct(s.accuracy)}
                                    </span>
                                </div>
                                <p className="log-prompt">{s.prompt}</p>
                            </div>
                        ))}
                        {round.phase === 'thinking' && (
                            <div className="log-item thinking">
                                Agent is building…
                            </div>
                        )}
                    </div>

                    {round.error && <div className="error">{round.error}</div>}

                    {round.phase === 'ended' ? (
                        <div className="result">
                            <div className="result-score">
                                {round.finalScore}
                            </div>
                            <div className="result-sub">
                                {round.accuracy != null
                                    ? pct(round.accuracy)
                                    : '0%'}{' '}
                                accuracy · {round.promptsUsed} prompt
                                {round.promptsUsed === 1 ? '' : 's'}
                            </div>
                            <button
                                className="btn primary"
                                onClick={handleNewRound}
                            >
                                New round
                            </button>
                        </div>
                    ) : (
                        <>
                            <textarea
                                className="prompt"
                                placeholder={
                                    round.promptsUsed === 0
                                        ? 'e.g. A solid indigo rectangle filling the top half, amber on the bottom half.'
                                        : 'Refine it — what should change?'
                                }
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (
                                        (e.metaKey || e.ctrlKey) &&
                                        e.key === 'Enter'
                                    )
                                        handleSubmit();
                                }}
                                disabled={
                                    round.phase === 'thinking' ||
                                    round.promptsUsed >= MAX_PROMPTS
                                }
                            />
                            <div className="actions">
                                <button
                                    className="btn primary"
                                    onClick={handleSubmit}
                                    disabled={!canSubmit}
                                >
                                    {round.phase === 'thinking'
                                        ? 'Building…'
                                        : 'Send prompt'}
                                </button>
                                <button
                                    className="btn"
                                    onClick={handleFinalize}
                                    disabled={
                                        round.phase === 'thinking' ||
                                        round.startedAt == null
                                    }
                                >
                                    Submit early
                                </button>
                            </div>
                            {!effectiveKey && (
                                <p className="hint warn">
                                    No API key for {providerCfg.label}. Add one
                                    to <code>.env</code> or paste it in the
                                    toolbar.
                                </p>
                            )}
                            <p className="hint">⌘/Ctrl + Enter to send.</p>
                        </>
                    )}
                </section>

                {/* ---- agent output ---- */}
                <section className="panel">
                    <div className="panel-title-row">
                        <h2 className="panel-title">Agent output</h2>
                        <label className="toggle">
                            <input
                                type="checkbox"
                                checked={showDiff}
                                onChange={(e) => setShowDiff(e.target.checked)}
                                disabled={!round.currentDiffUrl}
                            />
                            Diff overlay
                        </label>
                    </div>
                    <Stage>
                        {round.currentRenderUrl ? (
                            <>
                                <img
                                    className="stage-img"
                                    src={round.currentRenderUrl}
                                    alt="agent render"
                                />
                                {showDiff && round.currentDiffUrl && (
                                    <img
                                        className="stage-overlay"
                                        src={round.currentDiffUrl}
                                        alt="diff"
                                    />
                                )}
                            </>
                        ) : (
                            <div className="stage-empty">
                                {round.phase === 'thinking'
                                    ? 'Rendering…'
                                    : 'No attempt yet'}
                            </div>
                        )}
                    </Stage>
                    <div className="meta">
                        {scorePreview != null && (
                            <span className="badge ghost">
                                score if you submit now: {scorePreview}
                            </span>
                        )}
                    </div>
                    <pre className="code">
                        {round.currentCode ??
                            '<!-- agent HTML will appear here -->'}
                    </pre>
                </section>
            </main>
        </div>
    );
}

// ---------------------------------------------------------------- subcomponents

function Stage({ children }: { children: ReactNode }) {
    return (
        <div
            className="stage"
            style={{ width: CANVAS.width, height: CANVAS.height }}
        >
            {children}
        </div>
    );
}

function Stat({
    label,
    value,
    accent,
}: {
    label: string;
    value: string;
    accent?: 'teal' | 'amber';
}) {
    return (
        <div className={`stat ${accent ?? ''}`}>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
        </div>
    );
}

interface ToolbarProps {
    provider: ProviderId;
    model: string;
    keySource: 'pasted' | 'env' | 'none';
    keyOverride: string;
    gamma: number;
    lambda: number;
    targetIndex: number;
    disabledModelSwitch: boolean;
    onProvider: (p: ProviderId) => void;
    onModel: (m: string) => void;
    onKeyOverride: (k: string) => void;
    onGamma: (n: number) => void;
    onLambda: (n: number) => void;
    onTarget: (i: number) => void;
    onNewRound: () => void;
}

function Toolbar(props: ToolbarProps) {
    const cfg = PROVIDERS.find((p) => p.id === props.provider)!;
    return (
        <header className="toolbar">
            <div className="brand">Prompt&nbsp;Battle</div>

            <div className="controls">
                <label className="field">
                    <span>Target</span>
                    <select
                        value={props.targetIndex}
                        onChange={(e) => props.onTarget(Number(e.target.value))}
                    >
                        {targets.map((t, i) => (
                            <option key={t.id} value={i}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="field">
                    <span>Provider</span>
                    <select
                        value={props.provider}
                        onChange={(e) =>
                            props.onProvider(e.target.value as ProviderId)
                        }
                    >
                        {PROVIDERS.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="field">
                    <span>Model</span>
                    <select
                        value={props.model}
                        onChange={(e) => props.onModel(e.target.value)}
                        disabled={props.disabledModelSwitch}
                    >
                        {cfg.models.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="field key">
                    <span>
                        API key{' '}
                        <em className={`keytag ${props.keySource}`}>
                            {props.keySource === 'env'
                                ? 'from .env'
                                : props.keySource === 'pasted'
                                  ? 'pasted'
                                  : 'missing'}
                        </em>
                    </span>
                    <input
                        type="password"
                        placeholder={
                            props.keySource === 'env'
                                ? 'using .env key'
                                : 'paste key (optional)'
                        }
                        value={props.keyOverride}
                        onChange={(e) => props.onKeyOverride(e.target.value)}
                    />
                </label>

                <label className="field narrow">
                    <span>γ {props.gamma.toFixed(1)}</span>
                    <input
                        type="range"
                        min={1}
                        max={4}
                        step={0.1}
                        value={props.gamma}
                        onChange={(e) => props.onGamma(Number(e.target.value))}
                    />
                </label>

                <label className="field narrow">
                    <span>λ {props.lambda.toFixed(2)}</span>
                    <input
                        type="range"
                        min={0}
                        max={0.2}
                        step={0.01}
                        value={props.lambda}
                        onChange={(e) => props.onLambda(Number(e.target.value))}
                    />
                </label>

                <button className="btn ghost" onClick={props.onNewRound}>
                    New round
                </button>
            </div>
        </header>
    );
}
