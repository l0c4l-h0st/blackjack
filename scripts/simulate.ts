/**
 * Simulation Monte-Carlo du moteur Nocturne 21.
 *
 *   npm run simulate -- --hands 2000000 [--sidebets 10000000] [--seed 42] [--out SIMULATION.md]
 *
 * 1. Joue N mains avec la stratégie de base ENHC (1 place, mise fixe, sans side bet) en
 *    passant par le VRAI moteur (`applyAction`) et mesure l'avantage maison.
 * 2. Tire séparément M combinaisons de 3 cartes pour Perfect Pairs et 21+3 et compare le
 *    RTP mesuré au RTP théorique calculé par dénombrement.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_RULES } from '../src/config/rules';
import { buildOrderedCards } from '../src/engine/cards';
import { applyAction, createGame } from '../src/engine/round';
import type { Rng } from '../src/engine/rng';
import { CryptoRng, SeededRng, randomInt } from '../src/engine/rng';
import {
  PERFECT_PAIRS_PAYTABLE,
  TWENTY_ONE_PLUS_3_PAYTABLE,
  evaluatePerfectPairs,
  evaluateTwentyOnePlus3,
  theoreticalPerfectPairs,
  theoreticalTwentyOnePlus3,
} from '../src/engine/sideBets';
import { decideAction } from '../src/engine/strategy/basic';
import type {
  Card,
  GameState,
  PerfectPairsOutcome,
  RulesConfig,
  RoundSummary,
  TwentyOnePlus3Outcome,
} from '../src/engine/types';

interface Options {
  hands: number;
  variants: number;
  sideBetDraws: number;
  seed: number | null;
  out: string;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    hands: 2_000_000,
    variants: 0,
    sideBetDraws: 10_000_000,
    seed: null,
    out: 'SIMULATION.md',
  };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const value = argv[i + 1];
    if (value === undefined) continue;
    if (key === '--hands') opts.hands = Number(value);
    else if (key === '--sidebets') opts.sideBetDraws = Number(value);
    else if (key === '--variants') opts.variants = Number(value);
    else if (key === '--seed') opts.seed = Number(value);
    else if (key === '--out') opts.out = value;
    else continue;
    i += 1;
  }
  if (!Number.isInteger(opts.hands) || opts.hands <= 0) throw new Error('--hands invalide');
  if (!Number.isInteger(opts.sideBetDraws) || opts.sideBetDraws < 0) {
    throw new Error('--sidebets invalide');
  }
  return opts;
}

const HOUSE_EDGE_RANGE: [number, number] = [0.3, 0.7];
const BET = 100;

interface MainStats {
  rounds: number;
  netUnits: number;
  netUnitsSq: number;
  wagered: number;
  returned: number;
  playerBlackjacks: number;
  dealerBlackjacks: number;
  dealerBusts: number;
  dealerPlayed: number;
  wins: number;
  losses: number;
  pushes: number;
  surrenders: number;
  doubles: number;
  splits: number;
  shoes: number;
  ms: number;
}

function simulateMain(hands: number, rng: Rng, rules: RulesConfig = DEFAULT_RULES): MainStats {
  const table = { id: 'simulation', min: 10, max: 1_000_000 };
  let state: GameState = createGame({ rules, table, balance: 1e12, rng });
  const stats: MainStats = {
    rounds: 0,
    netUnits: 0,
    netUnitsSq: 0,
    wagered: 0,
    returned: 0,
    playerBlackjacks: 0,
    dealerBlackjacks: 0,
    dealerBusts: 0,
    dealerPlayed: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    surrenders: 0,
    doubles: 0,
    splits: 0,
    shoes: 1,
    ms: 0,
  };
  const started = performance.now();
  const progressEvery = Math.max(1, Math.floor(hands / 10));

  const record = (summary: RoundSummary) => {
    const units = summary.totals.net / BET;
    stats.rounds += 1;
    stats.netUnits += units;
    stats.netUnitsSq += units * units;
    stats.wagered += summary.totals.wagered;
    stats.returned += summary.totals.returned;
    stats.playerBlackjacks += summary.totals.blackjacks;
    if (summary.dealerBlackjack) stats.dealerBlackjacks += 1;
    if (summary.dealerCards.length >= 2) {
      stats.dealerPlayed += 1;
      if (summary.dealerBust) stats.dealerBusts += 1;
    }
    if (units > 0) stats.wins += 1;
    else if (units < 0) stats.losses += 1;
    else stats.pushes += 1;
    for (const seat of summary.seats) {
      for (const h of seat.hands) {
        if (h.result === 'surrender') stats.surrenders += 1;
        if (h.doubled) stats.doubles += 1;
      }
      stats.splits += seat.hands.length - 1;
    }
  };

  while (stats.rounds < hands) {
    let r = applyAction(state, { type: 'PLACE_BET', seat: 0, spot: 'main', amount: BET }, { rng });
    for (const e of r.events) if (e.type === 'SHUFFLE') stats.shoes += 1;
    r = applyAction(r.state, { type: 'DEAL' }, { rng });
    state = r.state;
    let events = r.events;
    for (;;) {
      for (const e of events) if (e.type === 'ROUND_END') record(e.summary);
      if (state.phase === 'ROUND_END') break;
      const next = applyAction(state, decideAction(state), { rng });
      state = next.state;
      events = next.events;
    }
    if (stats.rounds % progressEvery === 0) {
      process.stderr.write(`  … ${stats.rounds.toLocaleString('fr-FR')} mains\n`);
    }
  }
  stats.ms = performance.now() - started;
  return stats;
}

interface SideStats<O extends string> {
  draws: number;
  returned: number;
  returnedSq: number;
  counts: Record<O, number>;
}

function simulateSideBets(draws: number, rng: Rng) {
  const deck: Card[] = buildOrderedCards(DEFAULT_RULES.decks);
  const n = deck.length;
  const pp: SideStats<PerfectPairsOutcome> = {
    draws,
    returned: 0,
    returnedSq: 0,
    counts: { perfectPair: 0, coloredPair: 0, mixedPair: 0 },
  };
  const tp: SideStats<TwentyOnePlus3Outcome> = {
    draws,
    returned: 0,
    returnedSq: 0,
    counts: { suitedTrips: 0, straightFlush: 0, threeOfAKind: 0, straight: 0, flush: 0 },
  };
  const swap = (i: number, j: number) => {
    const t = deck[i] as Card;
    deck[i] = deck[j] as Card;
    deck[j] = t;
  };
  for (let t = 0; t < draws; t++) {
    // Tirage de 3 cartes distinctes (Fisher-Yates partiel) dans un sabot complet.
    swap(n - 1, randomInt(rng, n));
    swap(n - 2, randomInt(rng, n - 1));
    swap(n - 3, randomInt(rng, n - 2));
    const a = deck[n - 1] as Card;
    const b = deck[n - 2] as Card;
    const up = deck[n - 3] as Card;
    const p = evaluatePerfectPairs(a, b);
    const ppReturn = p ? PERFECT_PAIRS_PAYTABLE[p] + 1 : 0;
    if (p) pp.counts[p] += 1;
    pp.returned += ppReturn;
    pp.returnedSq += ppReturn * ppReturn;
    const o = evaluateTwentyOnePlus3(a, b, up);
    const tpReturn = o ? TWENTY_ONE_PLUS_3_PAYTABLE[o] + 1 : 0;
    if (o) tp.counts[o] += 1;
    tp.returned += tpReturn;
    tp.returnedSq += tpReturn * tpReturn;
  }
  return { pp, tp };
}

const pct = (x: number, digits = 3) => `${(x * 100).toFixed(digits)} %`;
const fmt = (x: number) => x.toLocaleString('fr-FR');

function meanAndSe(sum: number, sumSq: number, n: number): { mean: number; se: number } {
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  return { mean, se: Math.sqrt(variance / n) };
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const rng: Rng = opts.seed === null ? new CryptoRng() : new SeededRng(opts.seed);
  const rngLabel =
    opts.seed === null ? 'crypto.getRandomValues' : `xoshiro128** (graine ${opts.seed})`;

  console.log(`Simulation de ${fmt(opts.hands)} mains (stratégie de base ENHC)…`);
  const m = simulateMain(opts.hands, rng);
  const { mean, se } = meanAndSe(m.netUnits, m.netUnitsSq, m.rounds);
  const houseEdge = -mean * 100;
  const houseEdgeSe = se * 100;
  const rtp = m.returned / m.wagered;
  const inRange = houseEdge >= HOUSE_EDGE_RANGE[0] && houseEdge <= HOUSE_EDGE_RANGE[1];
  const ciLow = houseEdge - 1.96 * houseEdgeSe;
  const ciHigh = houseEdge + 1.96 * houseEdgeSe;
  // Hors plage mais intervalle de confiance qui chevauche la plage : échantillon trop petit.
  const compatible = !inRange && ciHigh >= HOUSE_EDGE_RANGE[0] && ciLow <= HOUSE_EDGE_RANGE[1];

  console.log(`Simulation des side bets (${fmt(opts.sideBetDraws)} tirages)…`);
  const sideStarted = performance.now();
  const side = opts.sideBetDraws > 0 ? simulateSideBets(opts.sideBetDraws, rng) : null;
  const sideMs = performance.now() - sideStarted;
  const thPP = theoreticalPerfectPairs(DEFAULT_RULES.decks);
  const thTP = theoreticalTwentyOnePlus3(DEFAULT_RULES.decks);

  const lines: string[] = [];
  lines.push('# Simulation Monte-Carlo — Nocturne 21', '');
  lines.push(
    `Générée par \`npm run simulate -- --hands ${opts.hands} --sidebets ${opts.sideBetDraws}\` le ${new Date().toISOString().slice(0, 10)}.`,
    '',
  );
  lines.push(
    `RNG : ${rngLabel}. Moteur réel (\`applyAction\`) avec les règles par défaut (\`src/config/rules.ts\`).`,
    '',
  );
  lines.push('## Règles simulées', '');
  lines.push(
    '6 jeux, carte de coupe 70–80 %, 1 carte brûlée, S17, ENHC (le joueur perd doubles et splits sur BJ croupier), BJ 3:2, double sur 2 cartes, DAS, re-split jusqu’à 4 mains (pas les As), une carte par As splitté, abandon contre 2–10, assurance refusée (stratégie de base).',
    '',
  );
  lines.push('## Blackjack (1 place, mise fixe, stratégie de base ENHC)', '');
  lines.push('| Mesure | Valeur |', '|---|---|');
  lines.push(`| Mains jouées | ${fmt(m.rounds)} |`);
  lines.push(`| Sabots utilisés | ${fmt(m.shoes)} |`);
  lines.push(
    `| **Avantage maison** (perte moyenne / mise initiale) | **${houseEdge.toFixed(3)} % ± ${houseEdgeSe.toFixed(3)} %** (1 erreur standard) |`,
  );
  lines.push(`| Intervalle à 95 % | [${ciLow.toFixed(3)} % ; ${ciHigh.toFixed(3)} %] |`);
  lines.push(`| RTP (total rendu / total misé, doubles et splits inclus) | ${pct(rtp)} |`);
  lines.push(
    `| Fréquence blackjack joueur | ${pct(m.playerBlackjacks / m.rounds)} (théorie ≈ 4,75 %) |`,
  );
  lines.push(`| Fréquence blackjack croupier | ${pct(m.dealerBlackjacks / m.rounds)} |`);
  lines.push(
    `| Bust croupier (quand il complète sa main) | ${pct(m.dealerBusts / Math.max(1, m.dealerPlayed))} |`,
  );
  lines.push(`| Bust croupier (sur toutes les mains) | ${pct(m.dealerBusts / m.rounds)} |`);
  lines.push(
    `| Tours gagnés / perdus / nuls | ${pct(m.wins / m.rounds, 2)} / ${pct(m.losses / m.rounds, 2)} / ${pct(m.pushes / m.rounds, 2)} |`,
  );
  lines.push(
    `| Abandons / doubles / splits (par main) | ${pct(m.surrenders / m.rounds, 2)} / ${pct(m.doubles / m.rounds, 2)} / ${pct(m.splits / m.rounds, 2)} |`,
  );
  lines.push(
    `| Durée | ${(m.ms / 1000).toFixed(1)} s (${fmt(Math.round(m.rounds / (m.ms / 1000)))} mains/s) |`,
  );
  lines.push('');
  const verdict = inRange
    ? '✅ dans la plage'
    : compatible
      ? '⚠️ estimation hors plage mais intervalle à 95 % compatible — relancer avec plus de mains'
      : '❌ HORS PLAGE — chercher le bug dans le moteur';
  lines.push(
    `Plage attendue pour ces règles : ${HOUSE_EDGE_RANGE[0]} % à ${HOUSE_EDGE_RANGE[1]} %. Résultat : **${verdict}**.`,
    '',
  );

  if (opts.variants > 0) {
    const variants: [string, Partial<RulesConfig>][] = [
      ['Règles du jeu (référence)', {}],
      ['Sans abandon', { surrender: false }],
      [
        'Sans abandon, règle OBO (≈ jeu avec carte cachée)',
        { surrender: false, enhcLoseAllOnDealerBJ: false },
      ],
    ];
    lines.push(`## Décomposition par variante de règles (${fmt(opts.variants)} mains chacune)`, '');
    lines.push(
      'Contrôle de cohérence du moteur : on désactive une règle à la fois et on vérifie que l’avantage maison bouge dans le sens et dans l’ordre de grandeur attendus.',
      '',
    );
    lines.push(
      'Chaque variante est mesurée sur moins de mains (erreur standard ≈ 0,035 pt) : ce sont les **écarts entre variantes** qui valident le moteur ; la valeur absolue de référence est la mesure principale ci-dessus.',
      '',
    );
    lines.push('| Variante | Avantage maison | Erreur standard |', '|---|---|---|');
    for (const [label, patch] of variants) {
      console.log(`Variante « ${label} »…`);
      const v = simulateMain(opts.variants, rng, { ...DEFAULT_RULES, ...patch });
      const r = meanAndSe(v.netUnits, v.netUnitsSq, v.rounds);
      lines.push(`| ${label} | ${(-r.mean * 100).toFixed(3)} % | ± ${(r.se * 100).toFixed(3)} % |`);
    }
    lines.push(
      '',
      'Références publiées (6 jeux, S17, DAS, re-split à 4, carte cachée) : ≈ 0,40 % ; règle ENHC « perte totale sur BJ croupier » : ≈ +0,11 pt. ' +
        'En ENHC, l’abandon autorisé contre 2–10 intervient AVANT que le croupier tire sa 2e carte : c’est un abandon précoce contre le 10, ' +
        'proposé sur ~6,5 % des mains (14–16 durs, 7-7, 8-8 contre 10), ce qui explique un avantage maison final proche de 0,3 %.',
      '',
    );
  }

  let sideOk = true;
  if (side) {
    const rows: [string, SideStats<string>, number, Record<string, number>][] = [
      ['Perfect Pairs', side.pp, thPP.rtp, thPP.probabilities],
      ['21+3', side.tp, thTP.rtp, thTP.probabilities],
    ];
    lines.push(
      `## Side bets (${fmt(opts.sideBetDraws)} tirages de 3 cartes sur un sabot complet)`,
      '',
    );
    lines.push(
      '| Side bet | RTP théorique (dénombrement) | RTP mesuré | Écart | Erreur standard | Verdict (< 0,3 pt) |',
    );
    lines.push('|---|---|---|---|---|---|');
    for (const [name, s, theory] of rows) {
      const { mean: r, se: rse } = meanAndSe(s.returned, s.returnedSq, s.draws);
      const gap = Math.abs(r - theory) * 100;
      const ok = gap < 0.3;
      sideOk &&= ok;
      lines.push(
        `| ${name} | ${pct(theory)} | ${pct(r)} | ${gap.toFixed(3)} pt | ${(rse * 100).toFixed(3)} pt | ${ok ? '✅' : '❌'} |`,
      );
    }
    lines.push('');
    for (const [name, s, , probs] of rows) {
      lines.push(`### ${name} — fréquences des combinaisons`, '');
      lines.push('| Combinaison | Probabilité théorique | Fréquence mesurée |', '|---|---|---|');
      for (const key of Object.keys(probs)) {
        const count = s.counts[key] ?? 0;
        lines.push(`| ${key} | ${pct(probs[key] ?? 0, 4)} | ${pct(count / s.draws, 4)} |`);
      }
      lines.push('');
    }
    lines.push(`Durée side bets : ${(sideMs / 1000).toFixed(1)} s.`, '');
  }

  const report = lines.join('\n');
  writeFileSync(resolve(process.cwd(), opts.out), report);
  console.log('');
  console.log(report);
  if ((!inRange && !compatible) || !sideOk) {
    console.error('Résultat hors des tolérances attendues.');
    process.exitCode = 1;
  }
}

main();
