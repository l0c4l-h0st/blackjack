/**
 * Effets déclenchés par l'animation director : vols de jetons, sons, particules, textes
 * flottants, secousse d'écran.
 */
import { soundEngine } from '../audio/soundEngine';
import { decomposeAmount, formatSigned } from '../config/chips';
import type { CardTarget, SpotRef } from '../engine/events';
import { SIDE_BET_OUTCOME_LABELS } from '../engine/sideBets';
import type { TableView } from '../engine/view';
import { useFxStore } from '../store/fxStore';
import type { DirectorEvent } from './animationDirector';
import type { LayoutContext, Point } from './layout';
import { DOUBLE_STACK_OFFSET, fixedPoint, handAnchor, handScale, spotPosition } from './layout';
import { particles } from './particles';
import { stageToScreen } from './stageRegistry';

export interface EffectContext {
  view: TableView;
  layout: LayoutContext;
  reducedMotion: boolean;
}

function handCount(view: TableView, seat: number): number {
  return Math.max(1, view.seats[seat]?.hands.length ?? 1);
}

function spotPoint(ctx: EffectContext, spot: SpotRef): Point {
  return spotPosition(ctx.layout, spot, handCount(ctx.view, spot.seat));
}

function targetPoint(ctx: EffectContext, target: CardTarget): Point {
  if (target.kind === 'dealer') {
    const p = fixedPoint(ctx.layout.mode, 'dealerTray');
    return { x: p.x, y: p.y + 110 };
  }
  const a = handAnchor(ctx.layout, target.seat, target.hand, handCount(ctx.view, target.seat));
  return { x: a.x, y: a.y - 140 };
}

function flight(
  factor: number,
  amount: number,
  from: Point,
  to: Point,
  mode: 'toss' | 'slide' | 'suck',
): void {
  if (factor === 0 || amount <= 0) return;
  const chips = decomposeAmount(amount).slice(0, 5);
  if (chips.length === 0) return;
  useFxStore.getState().addFlight({ chips, from, to, mode, factor });
}

function floatText(p: Point, text: string, tone: 'win' | 'loss' | 'gold' | 'info'): void {
  useFxStore.getState().addFloat({ x: p.x, y: p.y, text, tone });
}

function burstAt(p: Point, kind: 'sparks' | 'rings', intensity = 1): void {
  const s = stageToScreen(p);
  particles.burst(kind, s.x, s.y, intensity);
}

function fullScreen(
  ctx: EffectContext,
  kinds: ('confetti' | 'coins' | 'chipRain' | 'explosion')[],
): void {
  if (ctx.reducedMotion) return;
  const w = globalThis.innerWidth ?? 0;
  const h = globalThis.innerHeight ?? 0;
  for (const kind of kinds) particles.burst(kind, w / 2, h / 2);
}

export function runEffects(e: DirectorEvent, factor: number, ctx: EffectContext): void {
  const mode = ctx.layout.mode;
  switch (e.type) {
    case 'PLACE_CHIPS': {
      soundEngine.play('chip');
      const to = spotPoint(ctx, e.spot);
      if (e.reason === 'double' && e.spot.kind === 'hand') {
        // La pile se duplique à côté en glissant.
        const scale = handScale(handCount(ctx.view, e.spot.seat));
        flight(factor, e.amount, to, { x: to.x + DOUBLE_STACK_OFFSET * scale, y: to.y }, 'slide');
      } else {
        flight(factor, e.amount, fixedPoint(mode, 'playerBank'), to, 'toss');
      }
      break;
    }
    case 'CHIPS_FROM_DEALER':
      soundEngine.play('chipStack');
      flight(factor, e.amount, fixedPoint(mode, 'dealerTray'), spotPoint(ctx, e.spot), 'slide');
      break;
    case 'CHIPS_TO_PLAYER':
      soundEngine.play('chipStack', { gain: 0.7 });
      flight(factor, e.amount, spotPoint(ctx, e.spot), fixedPoint(mode, 'playerBank'), 'slide');
      break;
    case 'CHIPS_TO_DEALER':
      soundEngine.play('chip', { rate: 0.8, gain: 0.7 });
      flight(factor, e.amount, spotPoint(ctx, e.spot), fixedPoint(mode, 'dealerTray'), 'suck');
      break;
    case 'DEAL_CARD':
    case 'BURN_CARD':
      soundEngine.play('cardSlide', { rate: 0.9 + Math.random() * 0.2 });
      break;
    case 'CLEAR_TABLE':
      soundEngine.play('cardSlide', { rate: 0.7 });
      break;
    case 'FLIP_CARD':
      soundEngine.play('flip');
      break;
    case 'CUT_CARD_REACHED': {
      soundEngine.play('flip');
      const shoe = fixedPoint(mode, 'shoe');
      floatText({ x: shoe.x - 40, y: shoe.y + 90 }, 'Carte de coupe', 'gold');
      break;
    }
    case 'SHUFFLE':
      soundEngine.play('shuffle');
      break;
    case 'SIDE_BET_RESULT': {
      if (e.payout <= 0 || !e.outcome) break;
      const p = spotPoint(ctx, { kind: 'seat', seat: e.seat, spot: e.bet });
      floatText(
        { x: p.x, y: p.y - 40 },
        `${SIDE_BET_OUTCOME_LABELS[e.outcome]} ×${e.multiplier}`,
        'gold',
      );
      if (e.outcome === 'suitedTrips') {
        soundEngine.play('jackpot');
        burstAt(p, 'rings', 1.5);
        fullScreen(ctx, ['chipRain', 'coins']);
        if (!ctx.reducedMotion) useFxStore.getState().triggerShake();
      } else {
        soundEngine.play('win');
        burstAt(p, 'sparks', 0.4);
      }
      break;
    }
    case 'BLACKJACK': {
      const p = targetPoint(ctx, e.target);
      if (e.target.kind === 'hand') {
        soundEngine.play('blackjack');
        burstAt(p, 'sparks', 1);
        burstAt(p, 'rings', 0.6);
      } else {
        soundEngine.play('lose');
        floatText(p, 'Blackjack du croupier', 'loss');
      }
      break;
    }
    case 'BUST': {
      soundEngine.play('bust');
      if (e.target.kind === 'dealer') {
        floatText(targetPoint(ctx, e.target), 'Le croupier saute !', 'win');
      }
      break;
    }
    case 'INSURANCE_RESULT': {
      const p = spotPoint(ctx, { kind: 'seat', seat: e.seat, spot: 'insurance' });
      floatText(
        { x: p.x, y: p.y - 30 },
        e.won ? `Assurance +${e.payout - e.amount}` : 'Assurance perdue',
        e.won ? 'win' : 'loss',
      );
      if (e.won) soundEngine.play('win');
      break;
    }
    case 'HAND_RESULT': {
      const anchor = handAnchor(ctx.layout, e.seat, e.hand, handCount(ctx.view, e.seat));
      const p = { x: anchor.x, y: anchor.y - 60 };
      if (e.result === 'win' || e.result === 'blackjack' || e.result === 'evenMoney') {
        if (e.result !== 'blackjack') soundEngine.play('win');
        floatText(p, formatSigned(e.net), 'win');
        if (e.net >= 5 * e.bet) {
          fullScreen(ctx, ['confetti', 'coins']);
          if (!ctx.reducedMotion) useFxStore.getState().triggerShake();
        }
      } else if (e.result === 'push') {
        soundEngine.play('push');
        floatText(p, 'Égalité', 'info');
      } else {
        soundEngine.play('lose', { gain: 0.8 });
        floatText(p, formatSigned(e.net), 'loss');
      }
      break;
    }
    case 'BALANCE_CREDITED':
      soundEngine.play('chipStack');
      break;
    case 'LEVEL_UP':
      soundEngine.play('levelUp');
      fullScreen(ctx, ['explosion']);
      break;
    case 'SPLIT':
      soundEngine.play('cardSlide', { rate: 1.2 });
      break;
    case 'PHASE':
    case 'ROUND_START':
    case 'DEALER_REVEAL_SUSPENSE':
    case 'INSURANCE_OFFERED':
    case 'INSURANCE_DECISION':
    case 'INSURANCE_CLOSED':
    case 'ACTIVE_HAND':
    case 'HAND_STATUS':
    case 'DOUBLE':
    case 'ROUND_END':
    case 'TABLE_CHANGED':
    case 'XP_GAINED':
      break;
  }
}
