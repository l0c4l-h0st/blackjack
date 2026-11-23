import { lazy } from 'react';
import { BrowserRouter, Link, MemoryRouter, Route, Routes } from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import LobbyPage from './pages/LobbyPage';
import TablePage from './pages/TablePage';

const StatsPage = lazy(() => import('./pages/StatsPage'));
const TrainingPage = lazy(() => import('./pages/TrainingPage'));

function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <h1 className="font-display text-3xl font-bold">Page introuvable</h1>
      <Link to="/" className="btn-primary">
        Retour à la table
      </Link>
    </div>
  );
}

/** Routeur en mémoire pour l'hébergement dans un cadre isolé (build « artifact »). */
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : BrowserRouter;

export function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<TablePage />} />
          <Route path="lobby" element={<LobbyPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="training" element={<TrainingPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  );
}
