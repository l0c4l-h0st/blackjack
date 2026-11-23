import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { APP_NAME, LEGAL_NOTICE } from './config/app';
import './styles/theme.css';

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable');

createRoot(root).render(
  <StrictMode>
    <main className="flex h-full flex-col items-center justify-center gap-4">
      <h1 className="font-display text-4xl">{APP_NAME}</h1>
      <p className="text-sm text-muted">{LEGAL_NOTICE}</p>
    </main>
  </StrictMode>,
);
