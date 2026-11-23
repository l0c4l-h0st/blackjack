import { AnimatePresence } from 'framer-motion';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getTable } from '../../config/tables';
import { betRoom } from '../../engine/round';
import type { BetSpot as BetSpotKind } from '../../engine/types';
import type { LayoutContext, Point } from '../../fx/layout';
import {
  dealerCardPlacement,
  fixedPoint,
  handCardPlacement,
  stageSize,
  stageTilt,
} from '../../fx/layout';
import { registerStageMapper } from '../../fx/stageRegistry';
import { useFxStore } from '../../store/fxStore';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { AnimatedCard } from '../cards/AnimatedCard';
import { DealerArea } from './DealerArea';
import { DiscardTray } from './DiscardTray';
import { Felt } from './Felt';
import { FloatingTexts, FlyingChips } from './FxLayers';
import { Seat } from './Seat';
import { Shoe, ShuffleAnimation } from './Shoe';

const PERSPECTIVE = 1400;

/** Projection approximative (perspective + rotateX) d'un point de scène vers l'écran. */
function projectPoint(p: Point, w: number, h: number, tiltDeg: number): Point {
  const ox = w / 2;
  const oy = h * 0.6;
  const theta = (tiltDeg * Math.PI) / 180;
  const dy = p.y - oy;
  const z = dy * Math.sin(theta);
  const f = PERSPECTIVE / (PERSPECTIVE - z);
  return { x: ox + (p.x - ox) * f, y: oy + dy * Math.cos(theta) * f };
}

/** Scène de jeu : tapis, sabot, places, cartes et effets, mise à l'échelle du conteneur. */
export function Table() {
  const view = useGameStore((s) => s.view);
  const engine = useGameStore((s) => s.engine);
  const playing = useGameStore((s) => s.playing);
  const animFactor = useGameStore((s) => s.animFactor);
  const mode = useGameStore((s) => s.layoutMode);
  const focusSeat = useGameStore((s) => s.focusSeat);
  const dispatch = useGameStore((s) => s.dispatch);
  const notify = useGameStore((s) => s.notify);
  const setFocusSeat = useGameStore((s) => s.setFocusSeat);
  const selectedChip = useGameStore((s) => s.selectedChip);
  const fourColor = useSettingsStore((s) => s.fourColor);
  const shake = useFxStore((s) => s.shake);

  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const { width, height } = stageSize(mode);
  const tilt = stageTilt(mode);
  const scale = box.w > 0 ? Math.min(box.w / width, box.h / height) : 0;
  const offsetX = (box.w - width * scale) / 2;
  const offsetY = Math.max(0, (box.h - height * scale) / 2);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    registerStageMapper((p) => {
      const el = containerRef.current;
      if (!el) return { x: innerWidth / 2, y: innerHeight / 2 };
      const rect = el.getBoundingClientRect();
      const q = projectPoint(p, width, height, tilt);
      return { x: rect.left + offsetX + q.x * scale, y: rect.top + offsetY + q.y * scale };
    });
    return () => registerStageMapper(null);
  }, [width, height, tilt, offsetX, offsetY, scale]);

  const layout: LayoutContext = useMemo(
    () => ({ mode, seats: view.seats.length, focusSeat }),
    [mode, view.seats.length, focusSeat],
  );

  // Cartes présentes au montage : pas de vol depuis le sabot (reprise de partie).
  const initialCards = useRef<Set<number> | null>(null);
  if (initialCards.current === null) {
    const ids = new Set<number>(view.dealer.cards.map((c) => c.card.id));
    for (const s of view.seats)
      for (const h of s.hands) for (const c of h.cards) ids.add(c.card.id);
    initialCards.current = ids;
  }
  const initial = initialCards.current;

  const bettingOpen = (engine.phase === 'BETTING' || engine.phase === 'ROUND_END') && !playing;
  const theme = getTable(view.table.id);

  const onPlace = useCallback(
    (seat: number, spot: BetSpotKind) => {
      const s = useGameStore.getState();
      if (s.layoutMode === 'mobile' && seat !== s.focusSeat) {
        setFocusSeat(seat);
        return;
      }
      const room = betRoom(s.engine, seat, spot);
      if (
        spot !== 'main' &&
        s.engine.phase === 'BETTING' &&
        s.engine.seats[seat]?.bets.main === 0
      ) {
        notify('Posez d’abord une mise principale sur cette place', 'error');
        return;
      }
      if (spot !== 'main' && s.engine.phase === 'ROUND_END') {
        notify('Posez d’abord une mise principale sur cette place', 'error');
        return;
      }
      if (room <= 0) {
        notify(s.engine.balance < 10 ? 'Solde insuffisant' : 'Mise maximale atteinte', 'error');
        return;
      }
      dispatch({ type: 'PLACE_BET', seat, spot, amount: Math.min(selectedChip, room) });
    },
    [dispatch, notify, selectedChip, setFocusSeat],
  );

  const onRemove = useCallback(
    (seat: number, spot: BetSpotKind) => {
      if (useGameStore.getState().engine.phase === 'BETTING')
        dispatch({ type: 'REMOVE_BET', seat, spot });
    },
    [dispatch],
  );

  const shoeAt = fixedPoint(mode, 'shoe');
  const discardAt = fixedPoint(mode, 'discard');
  const factor = animFactor;

  const cards: ReactElement[] = [];
  const dealerCount = view.dealer.cards.length;
  view.dealer.cards.forEach((vc, i) => {
    cards.push(
      <AnimatedCard
        key={vc.card.id}
        card={vc.card}
        faceUp={vc.faceUp}
        placement={dealerCardPlacement(layout, i, dealerCount, vc.card.id)}
        origin={shoeAt}
        discard={discardAt}
        factor={factor}
        fourColor={fourColor}
        slowFlip={i === 1}
        animateEntry={!initial.has(vc.card.id)}
      />,
    );
  });
  for (const seat of view.seats) {
    seat.hands.forEach((hand, hi) => {
      hand.cards.forEach((vc, ci) => {
        cards.push(
          <AnimatedCard
            key={vc.card.id}
            card={vc.card}
            faceUp={vc.faceUp}
            placement={handCardPlacement(layout, seat.index, hi, seat.hands.length, ci, vc.card.id)}
            origin={shoeAt}
            discard={discardAt}
            factor={factor}
            fourColor={fourColor}
            slowFlip={false}
            animateEntry={!initial.has(vc.card.id)}
            dimmed={hand.status === 'bust' || hand.status === 'surrendered'}
          />,
        );
      });
    });
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      data-testid="table-stage"
    >
      {scale > 0 && (
        <div
          key={shake}
          className={shake > 0 ? 'shake absolute' : 'absolute'}
          style={{ left: offsetX, top: offsetY, width: width * scale, height: height * scale }}
        >
          <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
            <div
              className="relative"
              style={{
                width,
                height,
                transform: `perspective(${PERSPECTIVE}px) rotateX(${tilt}deg)`,
                transformOrigin: '50% 60%',
              }}
            >
              <Felt mode={mode} sparkle={theme.sparkle} />
              <DiscardTray count={view.shoe.discard} at={discardAt} />
              <Shoe shoe={view.shoe} at={shoeAt} />
              <DealerArea view={view} mode={mode} />
              {view.seats.map((seat) => (
                <Seat
                  key={seat.index}
                  seat={seat}
                  layout={layout}
                  bettingOpen={bettingOpen}
                  activeHand={view.turn?.seat === seat.index ? view.turn.hand : null}
                  insuranceAsked={view.insuranceSeat === seat.index}
                  onPlace={onPlace}
                  onRemove={onRemove}
                />
              ))}
              <AnimatePresence>{cards}</AnimatePresence>
              <ShuffleAnimation
                shoeId={view.shoe.shoeId}
                center={{ x: width / 2, y: 150 }}
                shoeAt={shoeAt}
                factor={factor}
              />
              <FlyingChips />
              <FloatingTexts factor={factor} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
