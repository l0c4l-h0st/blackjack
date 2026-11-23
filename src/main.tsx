import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-700.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/theme.css';

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Outil de debug (développement uniquement) : accès aux stores depuis la console.
if (import.meta.env.DEV) {
  void Promise.all([
    import('./store/gameStore'),
    import('./store/settingsStore'),
    import('./store/profileStore'),
  ]).then(([g, s, p]) => {
    Object.assign(window, {
      __nocturne: {
        game: g.useGameStore,
        settings: s.useSettingsStore,
        profile: p.useProfileStore,
      },
    });
  });
}
