import { useEffect, useReducer, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
    CANVAS,
    DEFAULT_GAMMA,
    DEFAULT_LAMBDA,
    MAX_PROMPTS,
    PROVIDERS,
    ROUND_MS,
    SYSTEM_PROMPT,
    COACH_SYSTEM_PROMPT,
    getEnvKey,
    getElevenLabsEnvKey,
} from './config';
import type { AttemptStep, Msg, PaletteColor, ProviderId, Target } from './types';
import { targets } from './targets/manifest';
import { callAgent } from './lib/llm';
import { transcribeAudio } from './lib/stt';
import { useRecorder } from './lib/useRecorder';
import { prepareHtml } from './lib/sanitize';
import { renderHtmlToCanvas, canvasPixels } from './lib/render';
import { computeDiff, computeScore } from './lib/scoring';

// ---------------------------------------------------------------- round state

type Phase = 'idle' | 'ready' | 'thinking' | 'ended';

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
    coachStatus: 'idle' | 'loading' | 'done' | 'error';
    coachFeedback: string | null;
    coachError: string | null;
}

const initialRound: RoundState = {
    phase: 'idle',
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
    coachStatus: 'idle',
    coachFeedback: null,
    coachError: null,
};

type Action =
    | { type: 'RESET' }
    | { type: 'START' }
    | { type: 'START_THINKING' }
    | { type: 'STEP_RESULT'; step: AttemptStep; history: Msg[] }
    | { type: 'FAIL'; error: string }
    | { type: 'FINALIZE'; score: number }
    | { type: 'COACH_START' }
    | { type: 'COACH_RESULT'; feedback: string }
    | { type: 'COACH_FAIL'; error: string };

function roundReducer(state: RoundState, action: Action): RoundState {
    switch (action.type) {
        case 'RESET':
            return initialRound;
        case 'START':
            // Begin a fresh, running round: reset prior state, reveal the
            // target (phase ≠ idle), and start the countdown in one render.
            return { ...initialRound, phase: 'ready', startedAt: Date.now() };
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
        case 'COACH_START':
            return {
                ...state,
                coachStatus: 'loading',
                coachError: null,
            };
        case 'COACH_RESULT':
            return {
                ...state,
                coachStatus: 'done',
                coachFeedback: action.feedback,
            };
        case 'COACH_FAIL':
            return {
                ...state,
                coachStatus: 'error',
                coachError: action.error,
            };
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

/**
 * Resolve palette colour *names* to their exact hex so a player who says or types
 * "azure" sends the agent the precise `#2256e0` it needs to score — the same value
 * a swatch click would have inserted. Appends ` (hex)` after the first occurrence
 * of each palette name (word-boundary, case-insensitive), preserving the player's
 * wording. Skips a colour whose hex is already present (e.g. a swatch was clicked).
 *
 * The agent still only learns colours the player explicitly named — it is never
 * given the full palette legend, so the in-round blindness boundary is preserved.
 */
function annotatePaletteColors(prompt: string, palette: PaletteColor[]): string {
    let out = prompt;
    for (const { name, hex } of palette) {
        if (out.toLowerCase().includes(hex.toLowerCase())) continue;
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(
            new RegExp(`\\b${escaped}\\b`, 'i'),
            (match) => `${match} (${hex})`,
        );
    }
    return out;
}

/**
 * Assemble the single user message the post-round coach analyses: the target's
 * reference HTML (which the in-round agent never saw), the ordered prompts each
 * tagged with the accuracy it produced, the agent's final HTML, and the final
 * accuracy/score. One { role: 'user' } message — no multi-turn.
 */
function buildCoachContext(
    target: Target,
    steps: AttemptStep[],
    finalScore: number | null,
): string {
    const finalAccuracy = steps.length ? steps[steps.length - 1].accuracy : 0;
    const finalCode = steps.length ? steps[steps.length - 1].code : '(no attempt produced)';
    const promptList = steps
        .map((s) => `#${s.seq} (${pct(s.accuracy)}): "${s.prompt}"`)
        .join('\n');

    return [
        `Target: ${target.name} (difficulty: ${target.difficulty})`,
        '',
        'Target reference HTML (what the player could see; the agent could not):',
        target.html,
        '',
        'Player prompts in order, tagged with the accuracy each produced:',
        promptList,
        '',
        "Agent's final HTML:",
        finalCode,
        '',
        `Final accuracy: ${pct(finalAccuracy)} · Final score: ${finalScore ?? 0}`,
    ].join('\n');
}

// ---------------------------------------------------------------- component

export default function App({ onHome }: { onHome?: () => void } = {}) {
    // Default to the Encode target; look it up by id so this survives reordering.
    const defaultTargetIndex = Math.max(
        0,
        targets.findIndex((t) => t.id === 'encode'),
    );
    const [targetIndex, setTargetIndex] = useState(defaultTargetIndex);
    const target = targets[targetIndex];

    const [provider, setProvider] = useState<ProviderId>('openai');
    const providerCfg = PROVIDERS.find((p) => p.id === provider)!;
    const [model, setModel] = useState(providerCfg.models[0]);
    const [keyOverride, setKeyOverride] = useState('');

    // ElevenLabs STT (prompt-box mic) — separate key from the LLM providers.
    const [sttKeyOverride, setSttKeyOverride] = useState('');
    const [isTranscribing, setIsTranscribing] = useState(false);
    const recorder = useRecorder();

    const [gamma, setGamma] = useState(DEFAULT_GAMMA);
    const [lambda, setLambda] = useState(DEFAULT_LAMBDA);

    const [draft, setDraft] = useState('');
    const [showDiff, setShowDiff] = useState(false);
    const [now, setNow] = useState(Date.now());

    const [targetRenderUrl, setTargetRenderUrl] = useState<string | null>(null);
    const [targetError, setTargetError] = useState<string | null>(null);
    const refPixels = useRef<Uint8ClampedArray | null>(null);
    const promptRef = useRef<HTMLTextAreaElement>(null);
    const howToPlayRef = useRef<HTMLDialogElement>(null);
    const coachRef = useRef<HTMLDialogElement>(null);

    const [round, dispatch] = useReducer(roundReducer, initialRound);

    const envKey = getEnvKey(provider);
    const effectiveKey = keyOverride.trim() || envKey;
    const keySource: 'pasted' | 'env' | 'none' = keyOverride.trim()
        ? 'pasted'
        : envKey
          ? 'env'
          : 'none';

    const sttEnvKey = getElevenLabsEnvKey();
    const effectiveSttKey = sttKeyOverride.trim() || sttEnvKey;
    const sttKeySource: 'pasted' | 'env' | 'none' = sttKeyOverride.trim()
        ? 'pasted'
        : sttEnvKey
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

    const promptDisabled =
        round.phase === 'idle' ||
        round.phase === 'thinking' ||
        round.promptsUsed >= MAX_PROMPTS;

    // Insert a palette colour's hex into the prompt at the caret (or appended).
    function insertColor(hex: string) {
        if (promptDisabled) return;
        const insert = `${hex} `;
        const el = promptRef.current;
        if (!el) {
            setDraft(
                (prev) =>
                    prev + (prev && !prev.endsWith(' ') ? ' ' : '') + insert,
            );
            return;
        }
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? start;
        setDraft((prev) => prev.slice(0, start) + insert + prev.slice(end));
        const caret = start + insert.length;
        requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(caret, caret);
        });
    }

    async function handleSubmit() {
        if (!canSubmit) return;
        const prompt = draft.trim();
        // What the agent sees: palette colour names resolved to their exact hex.
        // The prompt log still shows the raw `prompt` (what the player said).
        const sentPrompt = annotatePaletteColors(prompt, target.palette);
        const seq = round.promptsUsed + 1;
        setDraft('');
        dispatch({ type: 'START_THINKING' });

        try {
            const messages: Msg[] = [
                ...round.history,
                { role: 'user', content: sentPrompt },
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

    // Mic toggle: click to record, click again to stop + transcribe. The
    // transcript is appended into the prompt draft (input-only — no agent call).
    async function handleMic() {
        if (promptDisabled || !effectiveSttKey) return;
        try {
            if (recorder.isRecording) {
                const audio = await recorder.stop();
                setIsTranscribing(true);
                const raw = (
                    await transcribeAudio({ apiKey: effectiveSttKey, audio })
                ).trim();
                // Resolve spoken colour names to their exact hex in-place, so the
                // player sees e.g. "azure (#2256e0)" beside what they said.
                const text = annotatePaletteColors(raw, target.palette);
                if (text) {
                    setDraft((prev) => (prev ? `${prev} ${text}` : text));
                }
            } else {
                await recorder.start();
            }
        } catch (e) {
            dispatch({
                type: 'FAIL',
                error: e instanceof Error ? e.message : 'Microphone failed.',
            });
        } finally {
            setIsTranscribing(false);
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

    function handleStart() {
        dispatch({ type: 'START' });
        setDraft('');
        setShowDiff(false);
    }

    // End-of-round "New round": return to the idle gate (Start button + cleared
    // agent output), identical to a fresh load. The in-stage Start begins play.
    function handleReset() {
        dispatch({ type: 'RESET' });
        setDraft('');
        setShowDiff(false);
    }

    // Post-round only: hand the coach the target + the player's prompts and ask
    // for feedback. Reuses the active provider/model/key; no scored attempt.
    async function handleCoach() {
        if (!effectiveKey || round.steps.length === 0) return;
        dispatch({ type: 'COACH_START' });
        try {
            const content = buildCoachContext(
                target,
                round.steps,
                round.finalScore,
            );
            const text = await callAgent({
                provider,
                model,
                apiKey: effectiveKey,
                system: COACH_SYSTEM_PROMPT,
                messages: [{ role: 'user', content }],
            });
            dispatch({ type: 'COACH_RESULT', feedback: text.trim() });
            // Reveal the feedback in a scrollable modal once it's ready.
            coachRef.current?.showModal();
        } catch (e) {
            dispatch({
                type: 'COACH_FAIL',
                error: e instanceof Error ? e.message : 'Something went wrong.',
            });
        }
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
                onHome={onHome}
                provider={provider}
                model={model}
                keySource={keySource}
                keyOverride={keyOverride}
                sttKeySource={sttKeySource}
                sttKeyOverride={sttKeyOverride}
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
                onSttKeyOverride={setSttKeyOverride}
                onGamma={setGamma}
                onLambda={setLambda}
                onTarget={setTargetIndex}
            />

            <main className="grid">
                {/* ---- target ---- */}
                <section
                    className="panel panel--stage"
                    style={
                        {
                            '--canvas-width': `${CANVAS.width}px`,
                        } as CSSProperties
                    }
                >
                    <h2 className="panel-title">Target</h2>
                    <Stage>
                        {round.phase === 'idle' ? (
                            <div className="stage-empty stage-start">
                                <button
                                    className="btn primary"
                                    onClick={handleStart}
                                >
                                    Start
                                </button>
                                <p className="stage-start-hint">
                                    Reveals the target and starts the timer.
                                </p>
                            </div>
                        ) : targetRenderUrl ? (
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
                    <button
                        type="button"
                        className="how-to-play-trigger"
                        onClick={() => howToPlayRef.current?.showModal()}
                    >
                        How To Play
                    </button>
                    <dialog
                        ref={howToPlayRef}
                        className="how-to-play-dialog"
                        onClick={(e) => {
                            // Close when the backdrop (the dialog itself) is clicked.
                            if (e.target === howToPlayRef.current)
                                howToPlayRef.current?.close();
                        }}
                    >
                        <div className="how-to-play-card">
                            <div className="how-to-play-head">
                                <h2 className="how-to-play-title">
                                    How To Play
                                </h2>
                                <button
                                    type="button"
                                    className="how-to-play-close"
                                    aria-label="Close"
                                    onClick={() =>
                                        howToPlayRef.current?.close()
                                    }
                                >
                                    ×
                                </button>
                            </div>
                            <ol className="how-to-play-steps">
                                <li>
                                    Click <strong>Start</strong> to reveal the
                                    target and start the{' '}
                                    {Math.round(ROUND_MS / 60000)}-minute timer.
                                </li>
                                <li>
                                    Describe the target to the agent in plain
                                    language — it can’t see it, so you are its
                                    eyes. Name shapes, sizes and positions.
                                </li>
                                <li>
                                    Use the exact hex codes shown beside the
                                    target; click a swatch to drop one into your
                                    prompt.
                                </li>
                                <li>
                                    Refine across up to {MAX_PROMPTS} prompts —
                                    fewer prompts scores higher, so aim to nail
                                    it early.
                                </li>
                                <li>
                                    Toggle <strong>Diff overlay</strong> to see
                                    where your render misses, then{' '}
                                    <strong>Submit early</strong> when you’re
                                    happy — or let the timer run out.
                                </li>
                                <li>
                                    The play area is a fixed{' '}
                                    <strong>
                                        {CANVAS.width}×{CANVAS.height}
                                    </strong>{' '}
                                    pixel canvas — the target and every attempt
                                    render to those exact dimensions, so
                                    describe your layout to that size.
                                </li>
                            </ol>
                        </div>
                    </dialog>
                    <div className="meta">
                        <span className="badge">{target.name}</span>
                        <span className="badge ghost">{target.difficulty}</span>
                        <span className="badge ghost">{target.kind}</span>
                    </div>
                    <div className="palette">
                        {target.palette.map((c) => (
                            <button
                                type="button"
                                className="swatch"
                                key={c.hex}
                                onClick={() => insertColor(c.hex)}
                                disabled={promptDisabled}
                                title={`Insert ${c.name} (${c.hex})`}
                            >
                                <span
                                    className="chip"
                                    style={{ background: c.hex }}
                                />
                                <span className="chip-name">{c.name}</span>
                                <span className="chip-hex">{c.hex}</span>
                            </button>
                        ))}
                    </div>
                    <p className="hint">
                        Exact hex codes are shown on purpose — describe shape,
                        size and position, not colour. Click a colour, or
                        dictate it, to drop it into the chatbox.
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
                                onClick={handleReset}
                            >
                                New round
                            </button>

                            {round.steps.length > 0 && (
                                <div className="coach">
                                    {round.coachStatus === 'loading' ? (
                                        <button
                                            className="btn"
                                            disabled
                                        >
                                            Analysing your prompts…
                                        </button>
                                    ) : round.coachStatus === 'done' &&
                                      round.coachFeedback != null ? (
                                        <button
                                            className="btn"
                                            onClick={() =>
                                                coachRef.current?.showModal()
                                            }
                                        >
                                            View feedback
                                        </button>
                                    ) : (
                                        <>
                                            {round.coachStatus === 'error' &&
                                                round.coachError && (
                                                    <div className="error">
                                                        {round.coachError}
                                                    </div>
                                                )}
                                            <button
                                                className="btn"
                                                onClick={handleCoach}
                                                disabled={!effectiveKey}
                                            >
                                                {round.coachStatus === 'error'
                                                    ? 'Retry feedback'
                                                    : 'Get feedback'}
                                            </button>
                                            {!effectiveKey && (
                                                <p className="hint warn">
                                                    Add an API key to get
                                                    coaching feedback.
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <textarea
                                ref={promptRef}
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
                                disabled={promptDisabled}
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
                                    className={`btn${recorder.isRecording ? ' recording' : ''}`}
                                    onClick={handleMic}
                                    disabled={
                                        promptDisabled ||
                                        !effectiveSttKey ||
                                        isTranscribing
                                    }
                                    title={
                                        effectiveSttKey
                                            ? 'Speak your prompt'
                                            : 'Add an ElevenLabs API key to use the mic'
                                    }
                                >
                                    {isTranscribing
                                        ? 'Transcribing…'
                                        : recorder.isRecording
                                          ? '● Rec'
                                          : '🎤 Speak'}
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

                    <dialog
                        ref={coachRef}
                        className="coach-dialog"
                        onClick={(e) => {
                            // Close when the backdrop (the dialog itself) is clicked.
                            if (e.target === coachRef.current)
                                coachRef.current?.close();
                        }}
                    >
                        <div className="coach-card">
                            <div className="coach-head">
                                <h2 className="coach-title">Prompt coach</h2>
                                <button
                                    type="button"
                                    className="coach-close"
                                    aria-label="Close"
                                    onClick={() => coachRef.current?.close()}
                                >
                                    ×
                                </button>
                            </div>
                            <div className="coach-feedback">
                                {round.coachFeedback}
                            </div>
                        </div>
                    </dialog>
                </section>

                {/* ---- agent output ---- */}
                <section
                    className="panel panel--stage"
                    style={
                        {
                            '--canvas-width': `${CANVAS.width}px`,
                        } as CSSProperties
                    }
                >
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
    onHome?: () => void;
    provider: ProviderId;
    model: string;
    keySource: 'pasted' | 'env' | 'none';
    keyOverride: string;
    sttKeySource: 'pasted' | 'env' | 'none';
    sttKeyOverride: string;
    gamma: number;
    lambda: number;
    targetIndex: number;
    disabledModelSwitch: boolean;
    onProvider: (p: ProviderId) => void;
    onModel: (m: string) => void;
    onKeyOverride: (k: string) => void;
    onSttKeyOverride: (k: string) => void;
    onGamma: (n: number) => void;
    onLambda: (n: number) => void;
    onTarget: (i: number) => void;
}

function Toolbar(props: ToolbarProps) {
    const cfg = PROVIDERS.find((p) => p.id === props.provider)!;
    const [settingsOpen, setSettingsOpen] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!settingsOpen) return;
        const onPointerDown = (e: MouseEvent) => {
            if (
                settingsRef.current &&
                !settingsRef.current.contains(e.target as Node)
            )
                setSettingsOpen(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSettingsOpen(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [settingsOpen]);

    return (
        <header className="toolbar">
            {props.onHome ? (
                <button
                    type="button"
                    className="brand brand-link"
                    onClick={props.onHome}
                    title="Back to home"
                >
                    Prompt&nbsp;Battle
                </button>
            ) : (
                <div className="brand">Prompt&nbsp;Battle</div>
            )}

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
            </div>

            <div className="settings" ref={settingsRef}>
                <button
                    type="button"
                    className="settings-trigger"
                    aria-label="Settings"
                    aria-expanded={settingsOpen}
                    title="Settings"
                    onClick={() => setSettingsOpen((open) => !open)}
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </button>

                {settingsOpen && (
                    <div className="settings-panel">
                        <div className="score-explainer">
                            <code className="score-formula">
                                Score = 1000 · A<sup>γ</sup> · (1 − λ(P − 1))
                            </code>
                            <dl className="score-terms">
                                <div>
                                    <dt>A</dt>
                                    <dd>accuracy — pixel match, shown 0–100%</dd>
                                </div>
                                <div>
                                    <dt>γ</dt>
                                    <dd>
                                        curve exponent — higher punishes
                                        near-misses harder
                                    </dd>
                                </div>
                                <div>
                                    <dt>λ</dt>
                                    <dd>
                                        per-prompt penalty — each prompt after
                                        the first cuts the score
                                    </dd>
                                </div>
                                <div>
                                    <dt>P</dt>
                                    <dd>prompts used (max {MAX_PROMPTS})</dd>
                                </div>
                            </dl>
                        </div>
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

                <label className="field key">
                    <span>
                        ElevenLabs key{' '}
                        <em className={`keytag ${props.sttKeySource}`}>
                            {props.sttKeySource === 'env'
                                ? 'from .env'
                                : props.sttKeySource === 'pasted'
                                  ? 'pasted'
                                  : 'missing'}
                        </em>
                    </span>
                    <input
                        type="password"
                        placeholder={
                            props.sttKeySource === 'env'
                                ? 'using .env key'
                                : 'paste key for mic (optional)'
                        }
                        value={props.sttKeyOverride}
                        onChange={(e) => props.onSttKeyOverride(e.target.value)}
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
                    </div>
                )}
            </div>
        </header>
    );
}
