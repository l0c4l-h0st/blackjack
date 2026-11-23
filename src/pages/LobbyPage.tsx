import { useNavigate } from 'react-router';
import { TableTile } from '../components/lobby/TableTile';
import { LevelBadge, XpBar } from '../components/hud/LevelBadge';
import { formatCredits } from '../config/chips';
import { xpToNext } from '../config/progression';
import { TABLES } from '../config/tables';
import { useGameStore } from '../store/gameStore';
import { useProfileStore } from '../store/profileStore';

export default function LobbyPage() {
  const navigate = useNavigate();
  const tableId = useGameStore((s) => s.engine.table.id);
  const balance = useGameStore((s) => s.engine.balance);
  const changeTable = useGameStore((s) => s.changeTable);
  const level = useProfileStore((s) => s.level);
  const xp = useProfileStore((s) => s.xp);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-4 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Lobby</h1>
          <p className="text-muted">
            Montez de niveau pour débloquer des tables aux mises plus élevées.
          </p>
        </div>
        <div className="panel flex items-center gap-4 px-4 py-3">
          <LevelBadge level={level} />
          <div>
            <XpBar level={level} xp={xp} />
            <p className="mt-1 font-display text-xs tabular-nums text-muted">
              {formatCredits(xp)} / {formatCredits(xpToNext(level))} XP
            </p>
          </div>
          <p className="font-display text-sm tabular-nums">
            {formatCredits(balance)} <span className="text-muted">cr</span>
          </p>
        </div>
      </header>
      <h2 className="mb-3 font-display text-lg font-bold">Tables</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TABLES.map((t) => (
          <TableTile
            key={t.id}
            table={t}
            level={level}
            xp={xp}
            current={t.id === tableId}
            onPlay={() => {
              if (changeTable(t.id)) void navigate('/');
            }}
          />
        ))}
      </div>
      <section className="panel mt-8 p-5 text-sm text-muted">
        <h2 className="mb-2 font-display text-lg font-bold text-text">Règles de la maison</h2>
        <ul className="grid list-disc gap-1 pl-5 sm:grid-cols-2">
          <li>Blackjack européen, 6 jeux, sans carte cachée (ENHC).</li>
          <li>Le croupier reste sur tous les 17. Blackjack payé 3:2.</li>
          <li>Double sur deux cartes, double après split autorisé.</li>
          <li>Re-split jusqu’à 4 mains, une seule carte par As splitté.</li>
          <li>Abandon (50 %) contre 2 à 10, jamais contre un As.</li>
          <li>Assurance 2:1, even money proposé avec un blackjack.</li>
          <li>Si le croupier fait blackjack, doubles et splits sont perdus.</li>
          <li>Side bets : Perfect Pairs (25/12/6) et 21+3 (100/40/30/10/5).</li>
        </ul>
      </section>
    </div>
  );
}
