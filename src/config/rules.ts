import type { RulesConfig } from '../engine/types';

/** Règles européennes (ENHC) par défaut. Modifier une ligne ici suffit à changer le jeu. */
export const DEFAULT_RULES: RulesConfig = {
  decks: 6,
  penetrationMin: 0.7, // carte de coupe placée au hasard entre 70 % …
  penetrationMax: 0.8, // … et 80 % du sabot
  burnCardsAfterShuffle: 1,
  dealerHitsSoft17: false, // S17 : le croupier reste sur TOUS les 17
  holeCard: false, // ENHC : pas de carte cachée, 2e carte tirée APRÈS les joueurs
  enhcLoseAllOnDealerBJ: true, // si BJ croupier : le joueur perd aussi les mises doublées/splittées
  blackjackPayout: 1.5, // 3:2
  doubleOn: 'any', // 'any' | '9-11' | '10-11'
  doubleAfterSplit: true,
  maxHandsPerSeat: 4, // re-split jusqu'à 4 mains
  splitByValue: true, // 10-V-D-R splittables entre eux
  resplitAces: false,
  hitSplitAces: false, // As splittés : 1 seule carte chacun
  splitAce21IsBlackjack: false, // As + 10 après split = 21, pas BJ (paye 1:1)
  surrender: true, // abandon : récupère 50 %
  surrenderVsAce: false, // abandon interdit contre un As (pas de peek en ENHC)
  surrenderAfterSplit: false,
  insurance: true, // proposée si carte visible du croupier = As, paye 2:1
  evenMoney: true, // BJ joueur vs As croupier : peut prendre 1:1 tout de suite
  maxSeats: 3,
};

export { BET_UNIT } from '../engine/rules';
