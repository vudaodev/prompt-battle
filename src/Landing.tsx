import {
    CANVAS,
    DEFAULT_GAMMA,
    DEFAULT_LAMBDA,
    MAX_PROMPTS,
    ROUND_MS,
} from './config';
import { targets } from './targets/manifest';

/**
 * Pre-game landing page. Purely presentational — explains the product and hands
 * off to the game via Start CTAs. No game logic, no rendering of targets; the
 * hero preview is a hand-built decorative mock, never a real target render.
 */
export default function Landing({ onStart }: { onStart: () => void }) {
    const minutes = Math.round(ROUND_MS / 60000);

    // Smooth-scroll to an in-page section (nav links + "See how it works").
    const scrollTo = (id: string) => () => {
        document
            .getElementById(id)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const steps = [
        {
            n: 1,
            title: 'See the target',
            body: 'A hidden visual is revealed only to you. The agent never gets to look at it — your words are its only window.',
        },
        {
            n: 2,
            title: 'Transmit a description',
            body: `Describe the shapes, sizes, positions and exact colours. The agent rebuilds it in HTML/CSS over up to ${MAX_PROMPTS} prompts within ${minutes} minutes.`,
        },
        {
            n: 3,
            title: 'Score the match',
            body: `Your render is pixel-diffed against the target on a fixed ${CANVAS.width}×${CANVAS.height} canvas. Nail it in fewer prompts to score higher.`,
        },
    ];

    const metrics = [
        {
            name: 'Accuracy',
            body: 'How closely your render matches the target, pixel for pixel. The dominant term — a perfect rebuild is reachable.',
        },
        {
            name: 'Prompts used',
            body: `Each prompt past the first costs you. You get ${MAX_PROMPTS}; spend them well.`,
        },
        {
            name: 'Time',
            body: `A ${minutes}-minute round. Time is a leaderboard tiebreaker only — never folded into the score.`,
        },
    ];

    const features = [
        {
            title: 'Economical prompts',
            body: `Only ${MAX_PROMPTS} prompts per round. Precision beats volume.`,
        },
        {
            title: 'Conversational refining',
            body: 'The agent remembers the round. Correct it, nudge it, converge.',
        },
        {
            title: 'A truly blind agent',
            body: 'It never sees the target, the reference, or even its own render.',
        },
        {
            title: 'Pixel-perfect scoring',
            body: 'Same renderer for target and attempt — 100% is genuinely possible.',
        },
        {
            title: 'Visual diff overlay',
            body: 'Mismatched pixels light up so you can see exactly what to fix.',
        },
        {
            title: 'Shared leaderboards',
            body: 'Climb the board. Fewer prompts and faster rounds break ties.',
        },
    ];

    return (
        <div className="landing">
            <nav className="landing-nav">
                <span className="landing-nav-brand">Prompt Battle</span>
                <div className="landing-nav-links">
                    <button
                        className="landing-nav-link"
                        onClick={scrollTo('how-it-works')}
                    >
                        How it works
                    </button>
                    <button
                        className="landing-nav-link"
                        onClick={scrollTo('scoring')}
                    >
                        Scoring
                    </button>
                    <button
                        className="landing-nav-link"
                        onClick={scrollTo('challenges')}
                    >
                        Challenges
                    </button>
                </div>
                <button className="btn primary" onClick={onStart}>
                    Play now
                </button>
            </nav>

            <section className="landing-hero">
                <div className="landing-hero-copy">
                    <span className="landing-eyebrow">
                        Prompt training for teams
                    </span>
                    <h1 className="landing-title">
                        Turn vague asks into
                        <br />
                        <span className="landing-title-accent">
                            precise AI results.
                        </span>
                    </h1>
                    <p className="landing-lede">
                        Prompt Battle makes prompting a measurable skill. Your
                        team recreates a hidden visual by directing a blind AI
                        agent in plain language — and a pixel-diff score proves
                        exactly how clear the instructions were. Describe it well
                        enough and the rebuild scores a perfect 100%. Type or
                        speak every prompt with built-in voice input.
                    </p>
                    <div className="landing-cta">
                        <button className="btn primary" onClick={onStart}>
                            Play now
                        </button>
                        <button
                            className="btn ghost"
                            onClick={scrollTo('how-it-works')}
                        >
                            See how it works
                        </button>
                    </div>
                </div>

                {/* Decorative mock of the game UI — not a real target render. */}
                <div className="landing-preview" aria-hidden="true">
                    <div className="landing-preview-bar">
                        <span className="landing-preview-dot" />
                        <span className="landing-preview-dot" />
                        <span className="landing-preview-dot" />
                    </div>
                    <div className="landing-preview-canvas">
                        <span className="landing-preview-square" />
                        <span className="landing-preview-circle" />
                    </div>
                    <div className="landing-preview-prompt">
                        <span className="landing-preview-promptline" />
                        <span className="landing-preview-promptline short" />
                    </div>
                </div>
            </section>

            <section className="landing-section" id="how-it-works">
                <h2 className="landing-h2">Three moves, one blind builder.</h2>
                <div className="landing-steps">
                    {steps.map((s) => (
                        <div className="landing-step" key={s.n}>
                            <span className="landing-step-n">{s.n}</span>
                            <h3 className="landing-step-title">{s.title}</h3>
                            <p className="landing-step-body">{s.body}</p>
                        </div>
                    ))}
                </div>
                <p className="landing-note">
                    The catch: your agent is blind. Everything it builds comes
                    from your words alone — get them right and a flawless
                    reconstruction is on the table.
                </p>
            </section>

            <section className="landing-section" id="scoring">
                <h2 className="landing-h2">Scored on what actually matters.</h2>
                <p className="landing-sub">
                    Accuracy drives it; prompts trim it. Here&rsquo;s the locked
                    formula.
                </p>
                <div className="landing-scoring">
                    <div className="landing-formula">
                        <code className="landing-formula-code">
                            Score = 1000 · A<sup>γ</sup> · (1 − λ(P − 1))
                        </code>
                        <p className="landing-formula-legend">
                            A = accuracy · P = prompts used · γ ={' '}
                            {DEFAULT_GAMMA} · λ = {DEFAULT_LAMBDA}
                        </p>
                    </div>
                    <ul className="landing-metrics">
                        {metrics.map((m) => (
                            <li className="landing-metric" key={m.name}>
                                <span className="landing-metric-name">
                                    {m.name}
                                </span>
                                <span className="landing-metric-body">
                                    {m.body}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <section className="landing-section">
                <h2 className="landing-h2">Built for the grind.</h2>
                <div className="landing-features">
                    {features.map((f) => (
                        <div className="landing-feature" key={f.title}>
                            <h3 className="landing-feature-title">{f.title}</h3>
                            <p className="landing-feature-body">{f.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="landing-section" id="challenges">
                <h2 className="landing-h2">Pick your fight.</h2>
                <p className="landing-sub">
                    {targets.length} targets, easy to hard. Choose any from the
                    toolbar once you&rsquo;re in.
                </p>
                <div className="landing-cards">
                    {targets.map((t) => (
                        <div className="landing-card" key={t.id}>
                            <h3 className="landing-card-name">{t.name}</h3>
                            <div className="landing-card-meta">
                                <span className={`badge diff-${t.difficulty}`}>
                                    {t.difficulty}
                                </span>
                                <span className="badge ghost">{t.kind}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="landing-band">
                <h2 className="landing-band-title">
                    Think you can describe your way to 1000?
                </h2>
                <p className="landing-band-sub">
                    One target, your words, a blind agent. The perfect score is
                    out there.
                </p>
                <button className="btn primary" onClick={onStart}>
                    Play now
                </button>
            </section>

            <footer className="landing-foot">
                <div className="landing-foot-brand">
                    <span className="landing-nav-brand">Prompt Battle</span>
                    <p className="landing-foot-tag">
                        Describe a hidden visual to a blind AI agent. Pixels
                        don&rsquo;t lie.
                    </p>
                </div>
                <div className="landing-foot-cols">
                    <div className="landing-foot-col">
                        <span className="landing-foot-head">Game</span>
                        <button
                            className="landing-foot-link"
                            onClick={scrollTo('how-it-works')}
                        >
                            How it works
                        </button>
                        <button
                            className="landing-foot-link"
                            onClick={scrollTo('scoring')}
                        >
                            Scoring
                        </button>
                        <button
                            className="landing-foot-link"
                            onClick={scrollTo('challenges')}
                        >
                            Challenges
                        </button>
                    </div>
                    <div className="landing-foot-col">
                        <span className="landing-foot-head">Play</span>
                        <button
                            className="landing-foot-link"
                            onClick={onStart}
                        >
                            Start a round
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    );
}
