import { useState } from 'react';
import App from './App';
import Landing from './Landing';
import Dashboard from './Dashboard';

/**
 * Top-level view switch (no router): the landing page mounts first, and only
 * when the player starts does the game (`App`, with its target-render/timer
 * effects) mount. The toolbar brand returns here via `onHome`. The dashboard is
 * a presentational mock reachable from the landing nav; its drills can start the
 * game on a specific target via the optional `targetId`.
 */
export default function Root() {
    const [view, setView] = useState<'landing' | 'game' | 'dashboard'>(
        'landing',
    );
    const [gameTargetId, setGameTargetId] = useState<string | undefined>();

    const startGame = (targetId?: string) => {
        setGameTargetId(targetId);
        setView('game');
    };

    if (view === 'game')
        return (
            <App
                onHome={() => setView('landing')}
                onProgress={() => setView('dashboard')}
                initialTargetId={gameTargetId}
            />
        );
    if (view === 'dashboard')
        return (
            <Dashboard
                onHome={() => setView('landing')}
                onStart={startGame}
            />
        );
    return (
        <Landing
            onStart={startGame}
            onDashboard={() => setView('dashboard')}
        />
    );
}
