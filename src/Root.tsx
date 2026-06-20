import { useState } from 'react';
import App from './App';
import Landing from './Landing';

/**
 * Top-level view switch (no router): the landing page mounts first, and only
 * when the player starts does the game (`App`, with its target-render/timer
 * effects) mount. The toolbar brand returns here via `onHome`.
 */
export default function Root() {
    const [view, setView] = useState<'landing' | 'game'>('landing');

    return view === 'landing' ? (
        <Landing onStart={() => setView('game')} />
    ) : (
        <App onHome={() => setView('landing')} />
    );
}
