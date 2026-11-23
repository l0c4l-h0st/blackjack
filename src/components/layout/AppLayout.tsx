import { Suspense, useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { soundEngine } from '../../audio/soundEngine';
import { LEGAL_NOTICE } from '../../config/app';
import { useSettingsStore } from '../../store/settingsStore';
import { ParticleCanvas } from '../fx/ParticleCanvas';
import { TopBar } from '../hud/TopBar';
import { LevelUpModal } from '../modals/LevelUpModal';
import { SettingsModal } from '../modals/SettingsModal';
import { TableSelectModal } from '../modals/TableSelectModal';
import { SvgDefs } from '../svg/SvgDefs';

function useAudioSetup(): void {
  const volume = useSettingsStore((s) => s.volume);
  const muted = useSettingsStore((s) => s.muted);
  const ambience = useSettingsStore((s) => s.ambience);
  useEffect(() => {
    const unlock = () => soundEngine.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  useEffect(() => soundEngine.setVolume(volume), [volume]);
  useEffect(() => soundEngine.setMuted(muted), [muted]);
  useEffect(() => soundEngine.setAmbience(ambience), [ambience]);
}

export function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center p-10 text-muted" role="status">
      Chargement…
    </div>
  );
}

/** Structure commune : barre du haut, contenu, bandeau légal permanent. */
export function AppLayout() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(false);
  useAudioSetup();
  return (
    <div className="flex h-[100dvh] flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[200] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2"
      >
        Aller au contenu
      </a>
      <SvgDefs />
      <TopBar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenTables={() => setTablesOpen(true)}
      />
      <main id="contenu" className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="shrink-0 border-t border-border bg-surface px-3 py-1 text-center text-[10px] leading-tight text-muted sm:py-1.5 sm:text-[11px]">
        {LEGAL_NOTICE}
      </footer>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <TableSelectModal open={tablesOpen} onClose={() => setTablesOpen(false)} />
      <LevelUpModal />
      <ParticleCanvas />
    </div>
  );
}
