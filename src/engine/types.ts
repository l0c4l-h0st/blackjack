/**
 * Types du moteur de blackjack. Aucune dépendance UI : tout est sérialisable en JSON.
 */

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'];
export const RANKS: readonly Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];

/** Carte physique. `id` est unique dans le sabot (index de la carte dans les jeux neufs). */
export interface Card {
  readonly id: number;
  readonly rank: Rank;
  readonly suit: Suit;
}

export type DoubleOn = 'any' | '9-11' | '10-11';

export interface RulesConfig {
  decks: number;
  penetrationMin: number;
  penetrationMax: number;
  burnCardsAfterShuffle: number;
  dealerHitsSoft17: boolean;
  holeCard: boolean;
  enhcLoseAllOnDealerBJ: boolean;
  blackjackPayout: number;
  doubleOn: DoubleOn;
  doubleAfterSplit: boolean;
  maxHandsPerSeat: number;
  splitByValue: boolean;
  resplitAces: boolean;
  hitSplitAces: boolean;
  splitAce21IsBlackjack: boolean;
  surrender: boolean;
  surrenderVsAce: boolean;
  surrenderAfterSplit: boolean;
  insurance: boolean;
  evenMoney: boolean;
  maxSeats: number;
}

/** Limites de la table en cours (les side bets sont plafonnés à `max / 10`). */
export interface TableLimits {
  id: string;
  min: number;
  max: number;
}

/** Toutes les phases traversées par un tour. */
export type Phase =
  | 'BETTING'
  | 'DEALING'
  | 'SIDE_BETS'
  | 'INSURANCE'
  | 'PLAYER_TURNS'
  | 'DEALER_TURN'
  | 'SETTLEMENT'
  | 'ROUND_END'
  | 'SHUFFLING';

/** Phases dans lesquelles le moteur attend une décision du joueur. */
export type RestingPhase = 'BETTING' | 'INSURANCE' | 'PLAYER_TURNS' | 'ROUND_END';

export type HandStatus = 'playing' | 'stood' | 'bust' | 'blackjack' | 'surrendered';
export type HandResult = 'win' | 'lose' | 'push' | 'blackjack' | 'bust' | 'surrender' | 'evenMoney';
export type PlayerMove = 'hit' | 'stand' | 'double' | 'split' | 'surrender';

export type SideBetKind = 'perfectPairs' | 'twentyOnePlus3';
export type BetSpot = 'main' | SideBetKind;
export type SeatSpotKind = BetSpot | 'insurance';

export type PerfectPairsOutcome = 'perfectPair' | 'coloredPair' | 'mixedPair';
export type TwentyOnePlus3Outcome =
  | 'suitedTrips'
  | 'straightFlush'
  | 'threeOfAKind'
  | 'straight'
  | 'flush';
export type SideBetOutcome = PerfectPairsOutcome | TwentyOnePlus3Outcome;

export interface SideBetResult {
  readonly kind: SideBetKind;
  readonly outcome: SideBetOutcome | null;
  readonly multiplier: number;
  readonly stake: number;
  /** Montant brut rendu au joueur (mise + gain), 0 si perdu. */
  readonly payout: number;
}

export interface PlayerHand {
  /** Identifiant stable (clé React, historique). */
  id: string;
  cards: Card[];
  /** Mise totale engagée sur la main (doublement inclus). */
  bet: number;
  /** Mise de départ de la main (avant doublement). */
  baseBet: number;
  /** Jetons physiquement présents sur la case de la main. */
  stake: number;
  doubled: boolean;
  fromSplit: boolean;
  /** Main « d'origine » de la place (utile pour la règle OBO). */
  original: boolean;
  splitAces: boolean;
  status: HandStatus;
  actions: PlayerMove[];
  result: HandResult | null;
  /** Montant brut rendu (0 si perdu). */
  payout: number;
  settled: boolean;
}

export type InsuranceDecision = 'none' | 'pending' | 'taken' | 'declined' | 'evenMoney';

export interface SeatBets {
  main: number;
  perfectPairs: number;
  twentyOnePlus3: number;
}

export interface SeatSpots extends SeatBets {
  insurance: number;
}

export interface SeatState {
  index: number;
  /** Mises du tour (BETTING : en cours de constitution ; pendant le tour : mises initiales). */
  bets: SeatBets;
  /** Jetons physiquement présents sur les cases de la place. */
  spots: SeatSpots;
  hands: PlayerHand[];
  insurance: {
    decision: InsuranceDecision;
    amount: number;
    payout: number;
    settled: boolean;
  };
  sideBets: {
    perfectPairs: SideBetResult | null;
    twentyOnePlus3: SideBetResult | null;
  };
  /** Compteur pour générer des identifiants de main uniques. */
  handSeq: number;
}

export interface ShoeState {
  /** Ordre des cartes du sabot. Jamais muté après le mélange. */
  cards: Card[];
  /** Index de la prochaine carte à tirer. */
  position: number;
  /** Nombre de cartes devant la carte de coupe. */
  cutIndex: number;
  /** Cartes brûlées au début de ce sabot (non comptées en Hi-Lo). */
  burned: number;
  /** Nombre de cartes dans la défausse. */
  discard: number;
  shoeId: number;
  roundsInShoe: number;
}

export interface Turn {
  seat: number;
  hand: number;
}

export interface RoundMeta {
  id: number;
  shoeId: number;
  numberInShoe: number;
  balanceBefore: number;
  rcStart: number;
  tcStart: number;
}

export interface GameState {
  schema: 1;
  rules: RulesConfig;
  table: TableLimits;
  balance: number;
  phase: RestingPhase;
  shoe: ShoeState;
  seats: SeatState[];
  dealer: { cards: Card[] };
  turn: Turn | null;
  insuranceSeat: number | null;
  round: RoundMeta | null;
  roundCounter: number;
  lastBets: SeatBets[] | null;
  cutCardReached: boolean;
}

export type CreditReason = 'recharge' | 'levelUp' | 'quiz' | 'import';

export type PlayerAction =
  | { type: 'PLACE_BET'; seat: number; spot: BetSpot; amount: number }
  | { type: 'REMOVE_BET'; seat: number; spot: BetSpot }
  | { type: 'CLEAR_BETS' }
  | { type: 'REBET' }
  | { type: 'DOUBLE_BETS' }
  | { type: 'DEAL' }
  | { type: 'INSURANCE'; take: boolean }
  | { type: 'HIT' }
  | { type: 'STAND' }
  | { type: 'DOUBLE' }
  | { type: 'SPLIT' }
  | { type: 'SURRENDER' }
  | { type: 'NEW_ROUND' }
  | { type: 'SET_TABLE'; table: TableLimits }
  | { type: 'CREDIT'; amount: number; reason: CreditReason };

export interface AvailableActions {
  phase: RestingPhase;
  placeBet: boolean;
  clearBets: boolean;
  rebet: boolean;
  doubleBets: boolean;
  deal: boolean;
  /** Raisons empêchant la distribution (affichées à l'utilisateur). */
  dealBlockers: string[];
  newRound: boolean;
  changeTable: boolean;
  insurance: {
    seat: number;
    kind: 'insurance' | 'evenMoney';
    cost: number;
    canAfford: boolean;
  } | null;
  hit: boolean;
  stand: boolean;
  double: boolean;
  split: boolean;
  surrender: boolean;
}

/** Résumé d'une main dans l'historique. */
export interface HandRecord {
  id: string;
  cards: Card[];
  actions: PlayerMove[];
  bet: number;
  doubled: boolean;
  fromSplit: boolean;
  result: HandResult;
  payout: number;
  net: number;
}

export interface SeatRecord {
  seat: number;
  bets: SeatBets & { insurance: number };
  hands: HandRecord[];
  sideBets: {
    perfectPairs: SideBetResult | null;
    twentyOnePlus3: SideBetResult | null;
  };
  insurance: { decision: InsuranceDecision; amount: number; payout: number };
}

export interface RoundSummary {
  roundId: number;
  shoeId: number;
  numberInShoe: number;
  tableId: string;
  balanceBefore: number;
  balanceAfter: number;
  rcStart: number;
  tcStart: number;
  dealerCards: Card[];
  dealerTotal: number;
  dealerBlackjack: boolean;
  dealerBust: boolean;
  seats: SeatRecord[];
  totals: {
    wagered: number;
    returned: number;
    net: number;
    mainWagered: number;
    blackjacks: number;
    sideBetWins: number;
    splitHandWins: number;
  };
}
