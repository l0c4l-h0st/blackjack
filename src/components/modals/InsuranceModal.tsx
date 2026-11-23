import { formatCredits } from '../../config/chips';
import { getAvailableActions } from '../../engine/round';
import { useGameStore } from '../../store/gameStore';
import { Modal } from './Modal';

/** Décision d'assurance / even money quand le croupier montre un As. */
export function InsuranceModal() {
  const engine = useGameStore((s) => s.engine);
  const playing = useGameStore((s) => s.playing);
  const dispatch = useGameStore((s) => s.dispatch);
  const offer = getAvailableActions(engine).insurance;
  const open = engine.phase === 'INSURANCE' && offer !== null && !playing;
  const evenMoney = offer?.kind === 'evenMoney';
  // Ignore les clics arrivant pendant l'animation de fermeture.
  const decide = (take: boolean) => {
    if (getAvailableActions(useGameStore.getState().engine).insurance) {
      dispatch({ type: 'INSURANCE', take });
    }
  };

  return (
    <Modal
      open={open}
      title={evenMoney ? 'Even money ?' : 'Assurance ?'}
      dismissable={false}
      size="sm"
      translucent
    >
      {offer && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Le croupier montre un <strong className="text-text">As</strong>.{' '}
            {evenMoney ? (
              <>
                Place {offer.seat + 1} : vous avez un{' '}
                <strong className="text-gold">blackjack</strong>. Prendre un gain immédiat à 1:1
                plutôt que risquer l’égalité ?
              </>
            ) : (
              <>
                Place {offer.seat + 1} : assurer pour{' '}
                <strong className="font-display text-text">{formatCredits(offer.cost)} cr</strong> ?
                Payée 2:1 si le croupier fait blackjack.
              </>
            )}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={!offer.canAfford}
              onClick={() => decide(true)}
              data-autofocus
              aria-keyshortcuts="I"
            >
              {evenMoney ? 'Prendre 1:1' : 'Oui, assurer'}
              <kbd aria-hidden="true" className="kbd border-white/40">
                I
              </kbd>
            </button>
            <button
              type="button"
              className="btn flex-1"
              onClick={() => decide(false)}
              aria-keyshortcuts="N"
            >
              Non
              <kbd aria-hidden="true" className="kbd">
                N
              </kbd>
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
