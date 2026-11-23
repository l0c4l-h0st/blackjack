import { formatCredits, formatSigned } from '../../config/chips';
import type { HandRow } from '../../db/dexie';
import { formatTotal } from '../../engine/hand';
import { SIDE_BET_NAMES, SIDE_BET_OUTCOME_LABELS } from '../../engine/sideBets';
import type { Card, HandResult, PlayerMove } from '../../engine/types';
import { useSettingsStore } from '../../store/settingsStore';
import { CardFace } from '../cards/Card';
import { Modal } from '../modals/Modal';

const MOVE_LABELS: Record<PlayerMove, string> = {
  hit: 'Tirer',
  stand: 'Rester',
  double: 'Doubler',
  split: 'Séparer',
  surrender: 'Abandon',
};

const RESULT_FR: Record<HandResult, string> = {
  win: 'Gagné',
  lose: 'Perdu',
  push: 'Égalité',
  blackjack: 'Blackjack',
  bust: 'Bust',
  surrender: 'Abandon',
  evenMoney: 'Even money',
};

function CardRow({ cards }: { cards: Card[] }) {
  const fourColor = useSettingsStore((s) => s.fourColor);
  return (
    <div className="flex">
      {cards.map((c, i) => (
        <div key={`${c.id}-${i}`} className="-ml-4 h-[70px] w-[49px] first:ml-0 drop-shadow-md">
          <CardFace card={c} fourColor={fourColor} className="h-full w-full" />
        </div>
      ))}
    </div>
  );
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'medium' });

/** Détail d'un tour : cartes, séquence d'actions, mises et résultats. */
export function HandDetail({ row, onClose }: { row: HandRow | null; onClose: () => void }) {
  return (
    <Modal
      open={row !== null}
      title={row ? `Tour n° ${row.roundId}` : 'Tour'}
      onClose={onClose}
      size="lg"
    >
      {row && (
        <div className="space-y-5 text-sm">
          <p className="text-muted">
            {dateFmt.format(row.timestamp)} · Table {row.tableName} · sabot {row.shoeId}, tour{' '}
            {row.numberInShoe} · RC début {row.rcStart >= 0 ? '+' : ''}
            {row.rcStart} / TC {row.tcStart.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
          </p>
          <section>
            <h3 className="mb-2 font-display font-bold">
              Croupier · {formatTotal(row.dealerCards)}
              {row.dealerBlackjack ? ' (blackjack)' : row.dealerBust ? ' (bust)' : ''}
            </h3>
            <CardRow cards={row.dealerCards} />
          </section>
          {row.seats.map((seat) => (
            <section key={seat.seat} className="rounded-xl border border-border p-3">
              <h3 className="mb-2 font-display font-bold">
                Place {seat.seat + 1} · mise {formatCredits(seat.bets.main)}
              </h3>
              <div className="space-y-3">
                {seat.hands.map((h, i) => (
                  <div key={h.id} className="flex flex-wrap items-center gap-4">
                    <CardRow cards={h.cards} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        Main {i + 1} · {formatTotal(h.cards)} · {RESULT_FR[h.result]}{' '}
                        <span
                          className={
                            h.net > 0 ? 'text-win' : h.net < 0 ? 'text-loss' : 'text-muted'
                          }
                        >
                          ({formatSigned(h.net)})
                        </span>
                      </p>
                      <ol
                        className="mt-1 flex flex-wrap items-center gap-1 text-xs"
                        aria-label="Séquence d’actions"
                      >
                        <li className="pill bg-surface-2 text-muted">Donne</li>
                        {h.actions.map((m, k) => (
                          <li key={k} className="flex items-center gap-1">
                            <span aria-hidden="true" className="text-muted">
                              →
                            </span>
                            <span className="pill bg-accent-soft">{MOVE_LABELS[m]}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ))}
              </div>
              <ul className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                {(['perfectPairs', 'twentyOnePlus3'] as const).map((k) => {
                  const side = seat.sideBets[k];
                  if (!side) return null;
                  return (
                    <li key={k} className="pill border border-border">
                      {SIDE_BET_NAMES[k]} {formatCredits(side.stake)} :{' '}
                      {side.outcome
                        ? `${SIDE_BET_OUTCOME_LABELS[side.outcome]} (+${formatCredits(side.payout - side.stake)})`
                        : 'perdu'}
                    </li>
                  );
                })}
                {seat.insurance.decision === 'taken' && (
                  <li className="pill border border-border">
                    Assurance {formatCredits(seat.insurance.amount)} :{' '}
                    {seat.insurance.payout > 0 ? 'gagnée' : 'perdue'}
                  </li>
                )}
                {seat.insurance.decision === 'evenMoney' && (
                  <li className="pill border border-border">Even money</li>
                )}
              </ul>
            </section>
          ))}
          <p className="font-display tabular-nums">
            Solde : {formatCredits(row.balanceBefore)} → {formatCredits(row.balanceAfter)}{' '}
            <span
              className={
                row.totals.net > 0 ? 'text-win' : row.totals.net < 0 ? 'text-loss' : 'text-muted'
              }
            >
              ({formatSigned(row.totals.net)})
            </span>
          </p>
        </div>
      )}
    </Modal>
  );
}
