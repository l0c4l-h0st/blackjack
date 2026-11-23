import { useEffect, useRef } from 'react';
import { ActionBar } from '../components/actions/ActionBar';
import { CountQuizModal } from '../components/count/CountQuizModal';
import { HiLoPanel } from '../components/count/HiLoPanel';
import { NoticeToast } from '../components/hud/NoticeToast';
import { ExpandIcon } from '../components/icons';
import { InsuranceModal } from '../components/modals/InsuranceModal';
import { MobileSeatNav } from '../components/table/MobileSeatNav';
import { Table } from '../components/table/Table';
import { decksRemaining, roundCount, trueCount } from '../engine/count/hiLo';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useTableKeyboard } from '../hooks/useTableKeyboard';
import { useGameStore } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';

function toggleFullscreen(): void {
  const doc = document;
  if (doc.fullscreenElement) void doc.exitFullscreen();
  else void doc.documentElement.requestFullscreen?.().catch(() => undefined);
}

function CompactCount() {
  const rc = useGameStore((s) => s.view.runningCount);
  const shoe = useGameStore((s) => s.view.shoe);
  const tc = roundCount(trueCount(rc, decksRemaining(shoe.size - shoe.position)));
  const fmt = (n: number) => (n > 0 ? `+${n}` : String(n));
  return (
    <div
      className="pill pointer-events-none absolute left-2 top-2 z-20 gap-2 border border-border bg-black/60 text-xs"
      aria-label={`Running count ${rc}, true count ${tc}`}
    >
      <span className="text-muted">RC</span> {fmt(rc)} <span className="text-muted">TC</span>{' '}
      {fmt(tc)}
    </div>
  );
}

export default function TablePage() {
  const mobile = useMediaQuery('(max-width: 767px)');
  const wide = useMediaQuery('(min-width: 1024px)');
  const setLayoutMode = useGameStore((s) => s.setLayoutMode);
  const showHiLo = useSettingsStore((s) => s.showHiLo);
  const quizDue = useGameStore((s) => s.quizDue);
  const touchStart = useRef<number | null>(null);
  useTableKeyboard();

  useEffect(() => {
    setLayoutMode(mobile ? 'mobile' : 'desktop');
  }, [mobile, setLayoutMode]);

  const hideCount = quizDue;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onPointerDown={(e) => {
        touchStart.current = e.clientX;
        const s = useGameStore.getState();
        if (s.playing) s.skip();
      }}
      onPointerUp={(e) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!mobile || start === null) return;
        const dx = e.clientX - start;
        if (Math.abs(dx) < 50) return;
        const s = useGameStore.getState();
        // glisser vers la gauche → place de droite (index plus petit)
        s.setFocusSeat(s.focusSeat + (dx < 0 ? -1 : 1));
      }}
    >
      <h1 className="sr-only">Table de blackjack</h1>
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <Table />
          <NoticeToast />
          {showHiLo && !hideCount && !wide && <CompactCount />}
          <button
            type="button"
            className="btn-ghost absolute right-2 top-2 z-20 h-10 min-h-0 w-10 px-0 text-muted"
            onClick={toggleFullscreen}
            aria-label="Plein écran"
          >
            <ExpandIcon />
          </button>
        </div>
        {showHiLo && !hideCount && wide && (
          <aside
            className="w-64 shrink-0 overflow-y-auto border-l border-border p-3"
            aria-label="Comptage"
          >
            <HiLoPanel />
          </aside>
        )}
      </div>
      {mobile && <MobileSeatNav />}
      <ActionBar />
      <InsuranceModal />
      <CountQuizModal />
    </div>
  );
}
