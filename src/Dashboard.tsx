import { targets } from './targets/manifest';

/**
 * Mock employee-facing progress dashboard. Purely presentational — hard-coded
 * data for one fictional employee, no backend, no game logic. Shows an
 * individual their AI-prompting proficiency over time, with the headline skill
 * score + trend as the focal point. Navigation is handed back to the rest of
 * the app via `onHome` (landing) and `onStart` (game).
 */
export default function Dashboard({
    onHome,
    onStart,
}: {
    onHome: () => void;
    onStart: (targetId?: string) => void;
}) {
    const employee = {
        name: 'Maya Chen',
        role: 'Product Engineer',
        team: 'Platform',
    };

    // AI Skill Score over the last 8 weeks (baseline → current). The headline
    // metric — everything else on the page supports reading this trend.
    const trend = [
        { label: 'W1', score: 614 },
        { label: 'W2', score: 631 },
        { label: 'W3', score: 627 },
        { label: 'W4', score: 658 },
        { label: 'W5', score: 689 },
        { label: 'W6', score: 705 },
        { label: 'W7', score: 698 },
        { label: 'W8', score: 742 },
    ];
    const current = trend[trend.length - 1].score;
    const baseline = trend[0].score;
    const delta = current - baseline;

    const stats = [
        { label: 'Team rank', value: '#4', hint: 'of 38 on Platform' },
        { label: 'Rounds played', value: '47', hint: 'last 90 days' },
        { label: 'Avg accuracy', value: '91%', hint: '+6 pts vs. start' },
        { label: 'Best score', value: '968', hint: 'Bullseye · 1 prompt' },
    ];

    // Recent rounds. Target names are pulled from the real manifest so they stay
    // in sync with what's actually playable in the game.
    const byId = (id: string) => targets.find((t) => t.id === id);
    const history = [
        { id: 'bullseye', accuracy: 99, prompts: 1, score: 968 },
        { id: 'split-horizon', accuracy: 96, prompts: 2, score: 871 },
        { id: 'tricolore', accuracy: 88, prompts: 3, score: 702 },
        { id: 'nested', accuracy: 82, prompts: 4, score: 561 },
        { id: 'profile-card', accuracy: 76, prompts: 5, score: 433 },
    ];

    // Suggested next targets to practise — the toughest the player hasn't
    // mastered. Reuses the manifest difficulty badges, like the landing page.
    const drillIds = ['profile-card', 'encode', 'nested'];
    const drills = targets.filter((t) => drillIds.includes(t.id));

    return (
        <div className="dash">
            <nav className="dash-nav">
                <button className="dash-brand" onClick={onHome}>
                    Prompt Battle
                </button>
                <div className="dash-nav-links">
                    <span className="dash-nav-link dash-nav-active">
                        My progress
                    </span>
                </div>
                <button className="btn primary" onClick={() => onStart()}>
                    Play now
                </button>
            </nav>

            <header className="dash-head">
                <div className="dash-avatar" aria-hidden="true">
                    {employee.name
                        .split(' ')
                        .map((p) => p[0])
                        .join('')}
                </div>
                <div className="dash-head-copy">
                    <span className="dash-eyebrow">Your progress</span>
                    <h1 className="dash-title">{employee.name}</h1>
                    <p className="dash-sub">
                        {employee.role} · {employee.team} team
                    </p>
                </div>
            </header>

            {/* Skill score + trend — the focal point of the page. */}
            <section className="dash-score panel">
                <div className="dash-score-readout">
                    <span className="dash-score-label">AI Skill Score</span>
                    <span className="dash-score-value">{current}</span>
                    <span className="dash-score-delta">
                        ▲ +{delta} since onboarding
                    </span>
                    <p className="dash-score-note">
                        Composite of accuracy and prompt economy across every
                        round you&rsquo;ve played. Climbing steadily — keep
                        tightening your descriptions.
                    </p>
                </div>
                <TrendChart trend={trend} />
            </section>

            <section className="dash-stats">
                {stats.map((s) => (
                    <div className="dash-stat panel" key={s.label}>
                        <span className="dash-stat-label">{s.label}</span>
                        <span className="dash-stat-value">{s.value}</span>
                        <span className="dash-stat-hint">{s.hint}</span>
                    </div>
                ))}
            </section>

            <section className="dash-section">
                <h2 className="dash-h2">Recommended drills</h2>
                <p className="dash-section-sub">
                    Your weakest tier is hard targets — sharpen these next.
                </p>
                <div className="dash-drills">
                    {drills.map((t) => (
                        <div className="dash-drill panel" key={t.id}>
                            <div className="dash-drill-meta">
                                <span className={`badge diff-${t.difficulty}`}>
                                    {t.difficulty}
                                </span>
                                <span className="badge ghost">{t.kind}</span>
                            </div>
                            <h3 className="dash-drill-name">{t.name}</h3>
                            <button
                                className="btn"
                                onClick={() => onStart(t.id)}
                            >
                                Start drill
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            <section className="dash-section">
                <h2 className="dash-h2">Recent battles</h2>
                <div className="dash-table panel">
                    <div className="dash-row dash-row-head">
                        <span>Target</span>
                        <span>Accuracy</span>
                        <span>Prompts</span>
                        <span>Score</span>
                    </div>
                    {history.map((h) => {
                        const t = byId(h.id);
                        return (
                            <div className="dash-row" key={h.id}>
                                <span className="dash-cell-target">
                                    {t?.name ?? h.id}
                                    <span
                                        className={`badge diff-${t?.difficulty ?? 'easy'}`}
                                    >
                                        {t?.difficulty ?? '—'}
                                    </span>
                                </span>
                                <span className="dash-cell-acc">
                                    {h.accuracy}%
                                </span>
                                <span className="dash-cell-mono">
                                    {h.prompts}
                                </span>
                                <span className="dash-cell-mono dash-cell-score">
                                    {h.score}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}

/**
 * Hand-built inline-SVG line chart for the skill-score trend. No chart library —
 * keeps the prototype dependency-free, mirroring the hand-built landing mock.
 */
function TrendChart({ trend }: { trend: { label: string; score: number }[] }) {
    const W = 560;
    const H = 220;
    const padX = 12;
    const padTop = 16;
    const padBottom = 28;

    const scores = trend.map((d) => d.score);
    const min = Math.min(...scores) - 12;
    const max = Math.max(...scores) + 12;
    const plotW = W - padX * 2;
    const plotH = H - padTop - padBottom;

    const x = (i: number) =>
        padX + (plotW * i) / Math.max(1, trend.length - 1);
    const y = (score: number) =>
        padTop + plotH * (1 - (score - min) / (max - min));

    const line = trend.map((d, i) => `${x(i)},${y(d.score)}`).join(' ');
    const area = `${padX},${padTop + plotH} ${line} ${padX + plotW},${padTop + plotH}`;

    return (
        <svg
            className="dash-chart"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="AI Skill Score trend over the last 8 weeks"
        >
            {/* horizontal gridlines */}
            {[0, 0.5, 1].map((g) => (
                <line
                    key={g}
                    x1={padX}
                    x2={padX + plotW}
                    y1={padTop + plotH * g}
                    y2={padTop + plotH * g}
                    className="dash-chart-grid"
                />
            ))}
            <polygon className="dash-chart-area" points={area} />
            <polyline className="dash-chart-line" points={line} />
            {trend.map((d, i) => (
                <g key={d.label}>
                    <circle
                        className="dash-chart-dot"
                        cx={x(i)}
                        cy={y(d.score)}
                        r={i === trend.length - 1 ? 4.5 : 3}
                    />
                    <text
                        className="dash-chart-tick"
                        x={x(i)}
                        y={H - 8}
                        textAnchor="middle"
                    >
                        {d.label}
                    </text>
                </g>
            ))}
        </svg>
    );
}
