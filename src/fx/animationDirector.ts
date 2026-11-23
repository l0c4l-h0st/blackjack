/**
 * Animation director : joue la file d'événements moteur un par un.
 *
 * - Chaque événement a une durée de base (ms) multipliée par le facteur de vitesse
 *   (x1 = 1, x2 = 0,5, x4 = 0,25, instantané = 0).
 * - La vue est mise à jour au début de l'événement (cartes : le composant anime lui-même son
 *   arrivée) ou à la fin (jetons qui volent vers une case : la pile grossit à l'atterrissage).
 * - Les jetons posés pendant les mises sont « concurrents » : ils volent sans bloquer l'UI.
 *   Un événement bloquant attend leur atterrissage pour garder la vue cohérente.
 * - `skip()` accélère tout le reste de la file (clic, Espace).
 */
import type { GameEvent } from '../engine/events';

export type UiEvent =
  | { type: 'XP_GAINED'; amount: number; level: number; xp: number }
  | { type: 'LEVEL_UP'; level: number; bonus: number };

export type DirectorEvent = GameEvent | UiEvent;

export interface EventTiming {
  /** Délai avant l'événement suivant (ms, à vitesse x1). */
  duration: number;
  /** Moment où la vue est mise à jour. */
  apply: 'start' | 'end';
  /** Ne bloque pas l'interface (jetons de mise). */
  concurrent: boolean;
}

export function eventTiming(e: DirectorEvent): EventTiming {
  const t = (
    duration: number,
    apply: 'start' | 'end' = 'start',
    concurrent = false,
  ): EventTiming => ({
    duration,
    apply,
    concurrent,
  });
  switch (e.type) {
    case 'PLACE_CHIPS':
      return e.reason === 'bet' ? t(300, 'end', true) : t(380, 'end');
    case 'CHIPS_TO_PLAYER':
      return t(360);
    case 'CHIPS_TO_DEALER':
      return t(340);
    case 'CHIPS_FROM_DEALER':
      return t(380, 'end');
    case 'ROUND_START':
      return t(120);
    case 'DEAL_CARD':
      return t(e.faceUp ? 270 : 380);
    case 'FLIP_CARD':
      return t(e.slow ? 780 : 340);
    case 'DEALER_REVEAL_SUSPENSE':
      return t(420);
    case 'CUT_CARD_REACHED':
      return t(900);
    case 'SIDE_BET_RESULT':
      return t(e.payout > 0 ? 900 : 380);
    case 'BLACKJACK':
      return t(e.target.kind === 'hand' ? 750 : 600);
    case 'BUST':
      return t(560);
    case 'INSURANCE_OFFERED':
    case 'INSURANCE_DECISION':
    case 'INSURANCE_CLOSED':
      return t(120);
    case 'INSURANCE_RESULT':
      return t(520);
    case 'ACTIVE_HAND':
      return t(160);
    case 'HAND_STATUS':
      return t(e.auto ? 180 : 120);
    case 'DOUBLE':
      return t(120);
    case 'SPLIT':
      return t(420);
    case 'HAND_RESULT':
      return t(520);
    case 'ROUND_END':
      return t(250);
    case 'CLEAR_TABLE':
      return t(520);
    case 'SHUFFLE':
      return t(1700);
    case 'BURN_CARD':
      return t(450);
    case 'TABLE_CHANGED':
      return t(200);
    case 'BALANCE_CREDITED':
      return t(400);
    case 'XP_GAINED':
      return t(300);
    case 'LEVEL_UP':
      return t(600);
    case 'PHASE':
      return t(0);
  }
}

export interface DirectorHost {
  applyEvent: (e: DirectorEvent) => void;
  runEffects: (e: DirectorEvent, factor: number) => void;
  speedFactor: () => number;
  setPlaying: (playing: boolean, factor: number) => void;
  /** Resynchronise l'affichage sur l'état moteur si la file échoue. */
  recover?: () => void;
  /** Planificateur (injectable pour les tests). */
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
}

interface Pending {
  event: DirectorEvent;
  handle: unknown;
  done: () => void;
}

export class AnimationDirector {
  private queue: DirectorEvent[] = [];
  private running = false;
  private fast = false;
  private wakeUp: (() => void) | null = null;
  private pending: Pending[] = [];
  private readonly schedule: (fn: () => void, ms: number) => unknown;
  private readonly cancel: (handle: unknown) => void;

  constructor(private readonly host: DirectorHost) {
    this.schedule = host.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    this.cancel =
      host.cancel ??
      ((handle) => {
        clearTimeout(handle as ReturnType<typeof setTimeout>);
      });
  }

  /** Les effets (sons, particules…) ne doivent jamais bloquer la file. */
  private effects(event: DirectorEvent, factor: number): void {
    try {
      this.host.runEffects(event, factor);
    } catch (e) {
      console.warn('Effet ignoré', e);
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  enqueue(events: DirectorEvent[]): void {
    if (events.length === 0) return;
    this.queue.push(...events);
    if (!this.running) void this.run();
  }

  /** Accélère la fin de la file (et les jetons en vol). */
  skip(): void {
    this.flush();
    if (!this.running) return;
    this.fast = true;
    this.wakeUp?.();
  }

  /** Applique immédiatement les jetons encore en vol. */
  private flush(): void {
    const pending = this.pending;
    this.pending = [];
    for (const p of pending) {
      this.cancel(p.handle);
      this.host.applyEvent(p.event);
      p.done();
    }
  }

  private wait(ms: number): Promise<void> {
    if (ms <= 0 || this.fast) return Promise.resolve();
    return new Promise((resolve) => {
      const handle = this.schedule(() => {
        this.wakeUp = null;
        resolve();
      }, ms);
      this.wakeUp = () => {
        this.cancel(handle);
        this.wakeUp = null;
        resolve();
      };
    });
  }

  private waitPending(): Promise<void> {
    if (this.pending.length === 0) return Promise.resolve();
    if (this.fast) {
      this.flush();
      return Promise.resolve();
    }
    return Promise.all(
      this.pending.map((p) => new Promise<void>((resolve) => (p.done = chain(p.done, resolve)))),
    ).then(() => undefined);
  }

  private async run(): Promise<void> {
    this.running = true;
    const state = { blocking: false };
    try {
      while (this.queue.length > 0) {
        const event = this.queue.shift() as DirectorEvent;
        const timing = eventTiming(event);
        const factor = this.fast ? 0 : this.host.speedFactor();

        if (timing.concurrent) {
          if (timing.apply === 'start' || factor === 0) {
            this.flush();
            this.effects(event, factor);
            this.host.applyEvent(event);
          } else {
            this.effects(event, factor);
            const entry: Pending = { event, handle: null, done: () => undefined };
            entry.handle = this.schedule(() => {
              this.pending = this.pending.filter((p) => p !== entry);
              try {
                this.host.applyEvent(event);
              } catch (e) {
                console.error('Jeton non appliqué, resynchronisation', e);
                this.host.recover?.();
              }
              entry.done();
            }, timing.duration * factor);
            this.pending.push(entry);
          }
          continue;
        }

        if (this.pending.length > 0) await this.waitPending();
        if (!state.blocking) {
          state.blocking = true;
          this.host.setPlaying(true, factor);
        }
        if (timing.apply === 'start') this.host.applyEvent(event);
        if (!this.fast) this.effects(event, factor);
        const ms = timing.duration * factor;
        if (ms > 0 && !this.fast) await this.wait(ms);
        if (timing.apply === 'end') this.host.applyEvent(event);
      }
    } catch (e) {
      console.error('Animation interrompue, resynchronisation', e);
      this.queue = [];
      for (const p of this.pending) this.cancel(p.handle);
      this.pending = [];
      this.host.recover?.();
    } finally {
      this.running = false;
      this.fast = false;
      if (state.blocking) this.host.setPlaying(false, this.host.speedFactor());
    }
  }
}

function chain(a: () => void, b: () => void): () => void {
  return () => {
    a();
    b();
  };
}
