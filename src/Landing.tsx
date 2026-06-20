import { CANVAS, MAX_PROMPTS, ROUND_MS } from './config';
import { targets } from './targets/manifest';

/**
 * Pre-game landing page. Purely presentational — explains the product and hands
 * off to the game via a single Start CTA. No game logic, no rendering of targets.
 */
export default function Landing({ onStart }: { onStart: () => void }) {
    const minutes = Math.round(ROUND_MS / 60000);

    const steps = [
        {
            n: 1,
            title: 'You see the target',
            body: 'A hidden visual is revealed only to you. The AI agent never gets to look at it — your words are its only window.',
        },
        {
            n: 2,
            title: 'Direct the blind agent',
            body: `Describe the shapes, sizes, positions and exact colours. The agent rebuilds it in HTML/CSS. Refine across up to ${MAX_PROMPTS} prompts within ${minutes} minutes.`,
        },
        {
            n: 3,
            title: 'Score on pixel accuracy',
            body: `Your render is pixel-diffed against the target on a fixed ${CANVAS.width}×${CANVAS.height} canvas. Nail it in fewer prompts to score higher.`,
        },
    ];

    return (
        <div className="landing">
            <section className="landing-hero">
                <span className="landing-eyebrow">Prompt Battle</span>
                <h1 className="landing-title">
                    You can see the target.
                    <br />
                    The AI can&rsquo;t.
                </h1>
                <p className="landing-lede">
                    Recreate a hidden visual by directing an AI coding agent in
                    plain language. The only lever is how well you describe it —
                    describe it well enough and the rebuild scores a perfect
                    100%.
                </p>
                <div className="landing-cta">
                    <button className="btn primary" onClick={onStart}>
                        Start playing
                    </button>
                </div>
            </section>

            <section className="landing-section">
                <h2 className="landing-h2">How it works</h2>
                <div className="landing-steps">
                    {steps.map((s) => (
                        <div className="landing-step" key={s.n}>
                            <span className="landing-step-n">{s.n}</span>
                            <h3 className="landing-step-title">{s.title}</h3>
                            <p className="landing-step-body">{s.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="landing-section">
                <h2 className="landing-h2">Challenges</h2>
                <p className="landing-sub">
                    {targets.length} targets, easy to hard. Pick any from the
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

            <section className="landing-footer">
                <button className="btn primary" onClick={onStart}>
                    Start playing
                </button>
            </section>
        </div>
    );
}
