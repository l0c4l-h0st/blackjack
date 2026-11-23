import type { ReactNode } from 'react';
import { useId, useRef, useState } from 'react';
import { buildExport, downloadJson, importSave, resetEverything } from '../../store/saveTransfer';
import type { AnimationSpeed } from '../../store/settingsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { SHORTCUTS } from '../../config/shortcuts';
import { Modal } from './Modal';

const SPEEDS: { value: AnimationSpeed; label: string }[] = [
  { value: 'x1', label: '×1' },
  { value: 'x2', label: '×2' },
  { value: 'x4', label: '×4' },
  { value: 'instant', label: 'Instant.' },
];

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="text-sm">
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
          checked ? 'border-accent bg-accent-strong' : 'border-border bg-surface-2'
        }`}
      >
        <span
          className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-3 first:border-t-0 first:pt-0">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">{title}</h3>
      {children}
    </section>
  );
}

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSettingsStore();
  const volumeId = useId();
  const quizId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState(0);

  const exportSave = async () => {
    const data = await buildExport();
    downloadJson(data, `nocturne21-sauvegarde-${data.exportedAt.slice(0, 10)}.json`);
    setMessage('Sauvegarde exportée.');
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      await importSave(await file.text());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import impossible.');
    }
  };

  return (
    <Modal
      open={open}
      title="Réglages"
      onClose={() => {
        setResetStep(0);
        onClose();
      }}
      size="lg"
    >
      <div className="grid gap-x-8 md:grid-cols-2">
        <div>
          <Section title="Animations">
            <div
              className="flex gap-1 rounded-xl bg-surface-2 p-1"
              role="radiogroup"
              aria-label="Vitesse des animations"
            >
              {SPEEDS.map((sp) => (
                <button
                  key={sp.value}
                  type="button"
                  role="radio"
                  aria-checked={s.speed === sp.value}
                  onClick={() => s.update({ speed: sp.value })}
                  className={`min-h-[40px] flex-1 rounded-lg text-sm font-semibold transition-colors ${
                    s.speed === sp.value
                      ? 'bg-accent-strong text-white'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  {sp.label}
                </button>
              ))}
            </div>
          </Section>
          <Section title="Son">
            <div className="flex items-center gap-3 py-2">
              <label htmlFor={volumeId} className="w-16 text-sm">
                Volume
              </label>
              <input
                id={volumeId}
                type="range"
                min={0}
                max={100}
                value={Math.round(s.volume * 100)}
                onChange={(e) => s.update({ volume: Number(e.target.value) / 100 })}
                className="flex-1 accent-[var(--accent)]"
              />
              <span className="w-10 text-right font-display text-sm tabular-nums text-muted">
                {Math.round(s.volume * 100)}
              </span>
            </div>
            <Toggle
              label="Couper le son"
              checked={s.muted}
              onChange={(v) => s.update({ muted: v })}
            />
            <Toggle
              label="Ambiance de salle"
              checked={s.ambience}
              onChange={(v) => s.update({ ambience: v })}
            />
          </Section>
          <Section title="Affichage">
            <Toggle
              label="Jeu 4 couleurs"
              hint="♠ noir, ♥ rouge, ♦ bleu, ♣ vert"
              checked={s.fourColor}
              onChange={(v) => s.update({ fourColor: v })}
            />
            <Toggle
              label="Panneau de comptage Hi-Lo"
              checked={s.showHiLo}
              onChange={(v) => s.update({ showHiLo: v })}
            />
            <Toggle
              label="Re-mise automatique"
              checked={s.autoRebet}
              onChange={(v) => s.update({ autoRebet: v })}
            />
          </Section>
          <Section title="Quiz de comptage">
            <Toggle
              label="Activer le quiz en jeu"
              hint="Demande le running count entre deux tours"
              checked={s.quizEnabled}
              onChange={(v) => s.update({ quizEnabled: v })}
            />
            <div className="flex items-center justify-between gap-4 py-2">
              <label htmlFor={quizId} className="text-sm">
                Fréquence (tous les N tours)
              </label>
              <input
                id={quizId}
                type="number"
                min={1}
                max={50}
                value={s.quizEvery}
                onChange={(e) => s.update({ quizEvery: Number(e.target.value) })}
                className="field w-20 text-right font-display tabular-nums"
              />
            </div>
          </Section>
        </div>
        <div>
          <Section title="Raccourcis clavier">
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
              {SHORTCUTS.map(([key, label]) => (
                <div key={key} className="contents">
                  <dt>
                    <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-display text-xs">
                      {key}
                    </kbd>
                  </dt>
                  <dd className="text-muted">{label}</dd>
                </div>
              ))}
            </dl>
          </Section>
          <Section title="Sauvegarde">
            <p className="mb-2 text-xs text-muted">
              Profil, réglages, partie en cours et historique, au format JSON.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={() => void exportSave()}>
                Exporter
              </button>
              <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                Importer…
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                aria-label="Fichier de sauvegarde à importer"
                onChange={(e) => void onImport(e.target.files?.[0])}
              />
            </div>
          </Section>
          <Section title="Zone sensible">
            {resetStep === 0 && (
              <button
                type="button"
                className="btn border-loss/50 text-loss"
                onClick={() => setResetStep(1)}
              >
                Réinitialiser la progression…
              </button>
            )}
            {resetStep === 1 && (
              <div className="space-y-2">
                <p className="text-sm text-loss">Solde, niveau, XP et historique seront effacés.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn border-loss text-loss"
                    onClick={() => setResetStep(2)}
                  >
                    Oui, continuer
                  </button>
                  <button type="button" className="btn" onClick={() => setResetStep(0)}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
            {resetStep === 2 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-loss">
                  Dernière confirmation : action irréversible.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn bg-loss text-white"
                    onClick={() => void resetEverything()}
                  >
                    Tout effacer définitivement
                  </button>
                  <button type="button" className="btn" onClick={() => setResetStep(0)}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </Section>
          {message && (
            <p className="mt-2 text-sm text-muted" role="status">
              {message}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
