import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CardFace } from '../components/cards/Card';
import { recordDrill } from '../db/dexie';
import { buildOrderedCards } from '../engine/cards';
import { decksRemaining, hiLoValue, runningCountOf } from '../engine/count/hiLo';
import { getDefaultRng, shuffleInPlace } from '../engine/rng';
import type { TcExercise } from '../stats/drills';
import { SHOE_SIZE, expectedTrueCount, newExercise } from '../stats/drills';
import type { Card } from '../engine/types';
import { useSettingsStore } from '../store/settingsStore';

type Tab = 'stream' | 'trueCount';

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function useDrillLog() {
  const [log, setLog] = useState<{ correct: boolean; text: string }[]>([]);
  const push = (entry: { correct: boolean; text: string }) =>
    setLog((l) => [entry, ...l].slice(0, 8));
  return { log, push };
}

function Result({ correct, children }: { correct: boolean; children: ReactNode }) {
  return (
    <p
      role="status"
      className={`rounded-xl px-4 py-3 text-center font-display text-lg font-bold ${correct ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss'}`}
    >
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------------------------
// Drill 1 : défilé de cartes
// ---------------------------------------------------------------------------------------------

function StreamDrill() {
  const fourColor = useSettingsStore((s) => s.fourColor);
  const [count, setCount] = useState(26);
  const [speedMs, setSpeedMs] = useState(800);
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(-1);
  const [phase, setPhase] = useState<'setup' | 'running' | 'answer' | 'done'>('setup');
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<{ correct: boolean; expected: number } | null>(null);
  const askedAt = useRef(0);
  const { log, push } = useDrillLog();
  const ids = { count: useId(), speed: useId(), answer: useId() };

  const start = () => {
    const deck = shuffleInPlace(buildOrderedCards(6), getDefaultRng()).slice(0, count);
    setCards(deck);
    setIndex(0);
    setAnswer('');
    setResult(null);
    setPhase('running');
  };

  useEffect(() => {
    if (phase !== 'running') return;
    const t = setTimeout(() => {
      if (index + 1 >= cards.length) {
        setPhase('answer');
        askedAt.current = performance.now();
      } else {
        setIndex(index + 1);
      }
    }, speedMs);
    return () => clearTimeout(t);
  }, [phase, index, cards.length, speedMs]);

  const submit = () => {
    const n = Number.parseInt(answer, 10);
    if (Number.isNaN(n)) return;
    const expected = runningCountOf(cards);
    const correct = n === expected;
    setResult({ correct, expected });
    setPhase('done');
    push({
      correct,
      text: `${cards.length} cartes à ${(speedMs / 1000).toLocaleString('fr-FR')} s : ${signed(n)} (attendu ${signed(expected)})`,
    });
    void recordDrill({
      timestamp: Date.now(),
      kind: 'stream',
      correct,
      expected,
      answer: n,
      responseMs: Math.round(performance.now() - askedAt.current),
      speedMs,
      cards: cards.length,
    }).catch((e: unknown) => console.warn('Enregistrement impossible', e));
  };

  const current = cards[index];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr,320px]">
      <div className="panel flex min-h-[380px] flex-col items-center justify-center gap-5 p-6">
        {phase === 'setup' && (
          <p className="max-w-sm text-center text-muted">
            Les cartes défilent une par une. Comptez en Hi-Lo (2–6 : +1, 7–9 : 0, 10–As : −1) puis
            donnez le running count final.
          </p>
        )}
        {phase === 'running' && current && (
          <>
            <div className="relative h-[210px] w-[147px]" aria-live="off">
              <AnimatePresence initial={false}>
                <motion.div
                  key={`${current.id}-${index}`}
                  className="absolute inset-0 drop-shadow-2xl"
                  initial={{ x: 80, rotate: 8, opacity: 0 }}
                  animate={{ x: 0, rotate: 0, opacity: 1 }}
                  exit={{ x: -80, rotate: -8, opacity: 0 }}
                  transition={{ duration: Math.min(0.25, speedMs / 2000) }}
                >
                  <CardFace card={current} fourColor={fourColor} className="h-full w-full" />
                </motion.div>
              </AnimatePresence>
            </div>
            <p className="font-display text-sm tabular-nums text-muted">
              Carte {index + 1} / {cards.length}
            </p>
          </>
        )}
        {(phase === 'answer' || phase === 'done') && (
          <form
            className="w-full max-w-xs space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label
              htmlFor={ids.answer}
              className="block text-center font-display text-lg font-bold"
            >
              Running count final ?
            </label>
            <input
              id={ids.answer}
              type="number"
              inputMode="numeric"
              autoFocus
              disabled={phase === 'done'}
              className="field h-14 w-full text-center font-display text-3xl tabular-nums"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            {phase === 'answer' && (
              <button
                type="submit"
                className="btn-primary w-full"
                disabled={Number.isNaN(Number.parseInt(answer, 10))}
              >
                Valider
              </button>
            )}
            {result && (
              <Result correct={result.correct}>
                {result.correct ? 'Exact !' : `Raté : ${signed(result.expected)}`}
              </Result>
            )}
          </form>
        )}
        {phase !== 'running' && phase !== 'answer' && (
          <button type="button" className="btn-primary px-8" onClick={start}>
            {phase === 'done' ? 'Recommencer' : 'Commencer'}
          </button>
        )}
      </div>
      <aside className="space-y-4">
        <div className="panel space-y-4 p-4">
          <div>
            <label htmlFor={ids.count} className="mb-1 block text-sm">
              Nombre de cartes
            </label>
            <select
              id={ids.count}
              className="field w-full"
              value={count}
              disabled={phase === 'running'}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {[13, 26, 52, 104, 156, 312].map((n) => (
                <option key={n} value={n}>
                  {n === 52 ? '52 (un paquet)' : n === 312 ? '312 (sabot complet)' : n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={ids.speed} className="mb-1 flex justify-between text-sm">
              <span>Vitesse</span>
              <span className="font-display tabular-nums text-muted">
                {(speedMs / 1000).toLocaleString('fr-FR')} s / carte
              </span>
            </label>
            <input
              id={ids.speed}
              type="range"
              min={300}
              max={2000}
              step={100}
              value={speedMs}
              disabled={phase === 'running'}
              onChange={(e) => setSpeedMs(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </div>
          {phase === 'running' && (
            <button type="button" className="btn w-full" onClick={() => setPhase('setup')}>
              Arrêter
            </button>
          )}
        </div>
        <DrillLog log={log} />
      </aside>
    </div>
  );
}

function DrillLog({ log }: { log: { correct: boolean; text: string }[] }) {
  if (log.length === 0) return null;
  return (
    <div className="panel p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
        Derniers essais
      </h3>
      <ul className="space-y-1 text-sm">
        {log.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span
              className={l.correct ? 'text-win' : 'text-loss'}
              aria-label={l.correct ? 'Réussi' : 'Raté'}
            >
              {l.correct ? '✓' : '✗'}
            </span>
            <span className="text-muted">{l.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Drill 2 : conversion true count
// ---------------------------------------------------------------------------------------------

/** Défausse vue de profil : la hauteur de pile indique les jeux déjà joués. */
function DiscardVisual({ discard }: { discard: number }) {
  const height = 240;
  const filled = (discard / SHOE_SIZE) * height;
  return (
    <figure className="flex flex-col items-center gap-2">
      <div
        className="relative mr-8 w-28 rounded-b-xl border-x-2 border-b-2 border-white/25 bg-black/30"
        style={{ height }}
        role="img"
        aria-label="Défausse : estimez le nombre de jeux joués d’après la hauteur de la pile"
      >
        <div
          className="absolute inset-x-1 bottom-1 rounded-sm"
          style={{
            height: Math.max(2, filled - 2),
            background: 'repeating-linear-gradient(0deg, #f3efe4 0 1px, #c9c3b3 1px 2px)',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.2)',
          }}
        />
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="absolute -right-5 w-3 border-t border-white/40"
            style={{ bottom: ((i + 1) * height) / 6 }}
          >
            <span className="absolute -top-2 left-4 font-display text-[10px] text-muted">
              {i + 1}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="max-w-[10rem] text-center text-xs text-muted">
        Graduations en jeux défaussés (1 jeu = 52 cartes, sabot de 6 jeux).
      </figcaption>
    </figure>
  );
}

function TrueCountDrill() {
  const [ex, setEx] = useState<TcExercise>(() => newExercise());
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<{
    correct: boolean;
    expected: number;
    decks: number;
  } | null>(null);
  const shownAt = useRef(performance.now());
  const { log, push } = useDrillLog();
  const answerId = useId();

  const next = useCallback(() => {
    setEx(newExercise());
    setAnswer('');
    setResult(null);
    shownAt.current = performance.now();
  }, []);

  const submit = () => {
    const n = Number.parseFloat(answer.replace(',', '.'));
    if (Number.isNaN(n)) return;
    const expected = expectedTrueCount(ex);
    const decks = decksRemaining(SHOE_SIZE - ex.discard);
    const correct = Math.abs(n - expected) <= 0.5;
    setResult({ correct, expected, decks });
    push({
      correct,
      text: `RC ${signed(ex.rc)}, ${decks} jeux restants → ${expected} (vous : ${n})`,
    });
    void recordDrill({
      timestamp: Date.now(),
      kind: 'trueCount',
      correct,
      expected,
      answer: n,
      responseMs: Math.round(performance.now() - shownAt.current),
    }).catch((e: unknown) => console.warn('Enregistrement impossible', e));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr,320px]">
      <div className="panel flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start sm:justify-center">
        <DiscardVisual discard={ex.discard} />
        <form
          className="w-full max-w-xs space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (result) next();
            else submit();
          }}
        >
          <p className="text-sm text-muted">Running count</p>
          <p className="font-display text-5xl font-bold tabular-nums" aria-live="polite">
            {signed(ex.rc)}
          </p>
          <label htmlFor={answerId} className="block text-sm">
            True count (RC ÷ jeux restants, au demi-jeu près) ?
          </label>
          <input
            id={answerId}
            inputMode="decimal"
            autoFocus
            className="field h-12 w-full text-center font-display text-2xl tabular-nums"
            value={answer}
            disabled={result !== null}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="ex. 2,5"
          />
          {result ? (
            <>
              <Result correct={result.correct}>
                {result.correct ? 'Bien estimé !' : 'À revoir'} TC ={' '}
                {result.expected.toLocaleString('fr-FR')}
              </Result>
              <p className="text-center text-xs text-muted">
                {ex.discard} cartes défaussées → {result.decks.toLocaleString('fr-FR')} jeux
                restants. Tolérance ± 0,5.
              </p>
              <button type="submit" className="btn-primary w-full">
                Exercice suivant
              </button>
            </>
          ) : (
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={Number.isNaN(Number.parseFloat(answer.replace(',', '.')))}
            >
              Valider
            </button>
          )}
        </form>
      </div>
      <aside>
        <DrillLog log={log} />
      </aside>
    </div>
  );
}

export default function TrainingPage() {
  const [tab, setTab] = useState<Tab>('stream');
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6">
        <header>
          <h1 className="font-display text-3xl font-bold">Entraînement Hi-Lo</h1>
          <p className="text-muted">
            Valeurs : 2–6 = +1 · 7–9 = 0 · 10, V, D, R, As = −1. Exemple : 5, R, 9 →{' '}
            {(['5', 'K', '9'] as const).map((r) => signed(hiLoValue(r))).join(', ')}.
          </p>
        </header>
        <div
          className="flex gap-1 rounded-xl bg-surface-2 p-1"
          role="tablist"
          aria-label="Exercices"
        >
          {(
            [
              ['stream', 'Défilé de cartes'],
              ['trueCount', 'Conversion true count'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`min-h-[44px] flex-1 rounded-lg text-sm font-semibold ${tab === value ? 'bg-accent text-white' : 'text-muted hover:text-text'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel">{tab === 'stream' ? <StreamDrill /> : <TrueCountDrill />}</div>
      </div>
    </div>
  );
}
