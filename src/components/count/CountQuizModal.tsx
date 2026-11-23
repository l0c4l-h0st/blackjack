import { useEffect, useState } from 'react';
import type { QuizResult } from '../../store/gameStore';
import { useGameStore } from '../../store/gameStore';
import { Modal } from '../modals/Modal';

/** Quiz en jeu : « Quel est le running count ? » entre deux tours. */
export function CountQuizModal() {
  const due = useGameStore((s) => s.quizDue);
  const playing = useGameStore((s) => s.playing);
  const levelUp = useGameStore((s) => s.levelUp);
  const answerQuiz = useGameStore((s) => s.answerQuiz);
  const skipQuiz = useGameStore((s) => s.skipQuiz);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<QuizResult | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const open = (due && !playing && !levelUp) || result !== null;

  useEffect(() => {
    if (due && !playing) {
      setValue('');
      setStartedAt(performance.now());
    }
  }, [due, playing]);

  const submit = () => {
    const n = Number.parseInt(value, 10);
    if (Number.isNaN(n)) return;
    setResult(answerQuiz(n, Math.round(performance.now() - startedAt)));
  };

  return (
    <Modal open={open} title="Quiz de comptage" dismissable={false} size="sm">
      {result === null ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <p className="text-sm text-muted">
            Quel est le <strong className="text-text">running count</strong> actuel (cartes visibles
            depuis le dernier mélange) ?
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn w-12 px-0 text-xl"
              onClick={() => setValue(String((Number.parseInt(value, 10) || 0) - 1))}
              aria-label="Diminuer"
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              className="field h-12 flex-1 text-center font-display text-2xl tabular-nums"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-label="Running count"
              data-autofocus
            />
            <button
              type="button"
              className="btn w-12 px-0 text-xl"
              onClick={() => setValue(String((Number.parseInt(value, 10) || 0) + 1))}
              aria-label="Augmenter"
            >
              +
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={value.trim() === '' || Number.isNaN(Number.parseInt(value, 10))}
            >
              Valider
            </button>
            <button type="button" className="btn" onClick={skipQuiz}>
              Passer
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 text-center" role="status">
          {result.correct ? (
            <p className="font-display text-2xl font-bold text-win">Exact ! +10 XP</p>
          ) : (
            <p className="font-display text-xl font-bold text-loss">
              Raté : le running count était{' '}
              {result.expected > 0 ? `+${result.expected}` : result.expected}
            </p>
          )}
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => setResult(null)}
            data-autofocus
          >
            Continuer
          </button>
        </div>
      )}
    </Modal>
  );
}
