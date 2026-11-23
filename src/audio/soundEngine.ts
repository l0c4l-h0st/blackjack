/**
 * Moteur sonore Web Audio. Tous les sons sont synthétisés en code ; si un fichier
 * `public/sfx/<nom>.mp3` existe, il est utilisé à la place (chargé au déverrouillage).
 * Le contexte audio n'est créé qu'au premier geste de l'utilisateur.
 */

export type SoundName =
  | 'cardSlide'
  | 'flip'
  | 'chip'
  | 'chipStack'
  | 'shuffle'
  | 'win'
  | 'lose'
  | 'push'
  | 'bust'
  | 'blackjack'
  | 'levelUp'
  | 'jackpot'
  | 'click';

export const SOUND_NAMES: readonly SoundName[] = [
  'cardSlide',
  'flip',
  'chip',
  'chipStack',
  'shuffle',
  'win',
  'lose',
  'push',
  'bust',
  'blackjack',
  'levelUp',
  'jackpot',
  'click',
];

/** Intervalle minimal entre deux déclenchements d'un même son (évite la saturation). */
const MIN_GAP_MS: Partial<Record<SoundName, number>> = {
  chip: 35,
  cardSlide: 40,
  chipStack: 60,
  flip: 40,
};

type AudioContextCtor = new () => AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  const g = globalThis as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly files = new Map<SoundName, AudioBuffer>();
  private readonly lastPlayed = new Map<SoundName, number>();
  private volume = 0.7;
  private muted = false;
  private ambienceWanted = false;
  private ambience: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private filesRequested = false;

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  /** À appeler depuis un gestionnaire de geste utilisateur (clic, touche). */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = audioContextCtor();
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
      this.noiseBuffer = this.makeNoise(1.5);
      if (this.ambienceWanted) this.startAmbience();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (!this.filesRequested) {
      this.filesRequested = true;
      void this.loadFiles();
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.applyVolume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
  }

  setAmbience(on: boolean): void {
    this.ambienceWanted = on;
    if (!this.ctx) return;
    if (on) this.startAmbience();
    else this.stopAmbience();
  }

  play(name: SoundName, options: { gain?: number; rate?: number } = {}): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted || this.volume === 0) return;
    const now = performance.now();
    const gap = MIN_GAP_MS[name] ?? 0;
    if (gap > 0 && now - (this.lastPlayed.get(name) ?? -Infinity) < gap) return;
    this.lastPlayed.set(name, now);

    const out = ctx.createGain();
    out.gain.value = options.gain ?? 1;
    out.connect(master);
    const file = this.files.get(name);
    if (file) {
      const src = ctx.createBufferSource();
      src.buffer = file;
      src.playbackRate.value = options.rate ?? 1;
      src.connect(out);
      src.start();
      return;
    }
    SYNTHS[name](this, ctx, out, ctx.currentTime, options.rate ?? 1);
  }

  // --- primitives de synthèse -------------------------------------------------------------

  /** Rafale de bruit filtrée avec enveloppe percussive. */
  noise(
    out: AudioNode,
    at: number,
    duration: number,
    filter: { type: BiquadFilterType; frequency: number; q?: number },
    peak = 0.6,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = filter.type;
    f.frequency.value = filter.frequency;
    f.Q.value = filter.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    src.connect(f).connect(g).connect(out);
    src.start(at, Math.random() * 0.5, duration + 0.05);
  }

  /** Note synthétique avec enveloppe ADSR simplifiée. */
  tone(
    out: AudioNode,
    at: number,
    frequency: number,
    duration: number,
    options: {
      type?: OscillatorType;
      peak?: number;
      attack?: number;
      endFrequency?: number;
      lowpass?: number;
    } = {},
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = options.type ?? 'sine';
    osc.frequency.setValueAtTime(frequency, at);
    if (options.endFrequency) {
      osc.frequency.exponentialRampToValueAtTime(options.endFrequency, at + duration);
    }
    const g = ctx.createGain();
    const attack = options.attack ?? 0.008;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(options.peak ?? 0.3, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    let node: AudioNode = osc;
    if (options.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = options.lowpass;
      osc.connect(f);
      node = f;
    }
    node.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + duration + 0.05);
  }

  /** Clic de jeton : partiels inharmoniques très courts (céramique). */
  clack(out: AudioNode, at: number, pitch = 1, peak = 0.22): void {
    for (const [f, d] of [
      [2900, 0.05],
      [4700, 0.035],
      [6300, 0.025],
    ] as const) {
      this.tone(out, at, f * pitch, d, {
        type: 'triangle',
        peak: peak * (f === 2900 ? 1 : 0.55),
        attack: 0.002,
      });
    }
    this.noise(out, at, 0.03, { type: 'highpass', frequency: 5000 }, peak * 0.6);
  }

  private makeNoise(seconds: number): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private applyVolume(): void {
    if (!this.master || !this.ctx) return;
    const target = this.muted ? 0 : this.volume * 0.8;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
  }

  private startAmbience(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.ambience) return;
    // Bruit brun filtré + respiration lente : rumeur de salle feutrée.
    const length = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.12, ctx.currentTime, 1.5);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.04;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
    source.connect(filter).connect(gain).connect(master);
    source.start();
    this.ambience = { source, gain };
  }

  private stopAmbience(): void {
    if (!this.ambience || !this.ctx) return;
    const { source, gain } = this.ambience;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    source.stop(this.ctx.currentTime + 1.5);
    this.ambience = null;
  }

  private async loadFiles(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || typeof fetch !== 'function') return;
    await Promise.all(
      SOUND_NAMES.map(async (name) => {
        try {
          const res = await fetch(`${import.meta.env.BASE_URL}sfx/${name}.mp3`);
          const type = res.headers.get('content-type') ?? '';
          if (!res.ok || !type.startsWith('audio')) return;
          const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
          this.files.set(name, buffer);
        } catch {
          // Fichier absent ou illisible : le son synthétisé reste utilisé.
        }
      }),
    );
  }
}

type Synth = (e: SoundEngine, ctx: AudioContext, out: AudioNode, t: number, rate: number) => void;

const SYNTHS: Record<SoundName, Synth> = {
  cardSlide: (e, _c, out, t, rate) => {
    e.noise(out, t, 0.09, { type: 'bandpass', frequency: 3200 * rate, q: 0.8 }, 0.5);
    e.noise(out, t + 0.05, 0.05, { type: 'highpass', frequency: 5000 }, 0.25);
  },
  flip: (e, _c, out, t) => {
    e.noise(out, t, 0.06, { type: 'highpass', frequency: 3500 }, 0.4);
    e.tone(out, t + 0.03, 1700, 0.03, { type: 'triangle', peak: 0.12, attack: 0.002 });
  },
  chip: (e, _c, out, t, rate) => e.clack(out, t, rate * (0.95 + Math.random() * 0.1)),
  chipStack: (e, _c, out, t) => {
    for (let i = 0; i < 4; i++)
      e.clack(out, t + i * 0.038 + Math.random() * 0.01, 0.9 + Math.random() * 0.2, 0.16);
  },
  shuffle: (e, _c, out, t) => {
    // Riffle : petits claquements qui accélèrent, deux passes.
    for (let pass = 0; pass < 2; pass++) {
      let at = t + pass * 0.75;
      for (let i = 0; i < 26; i++) {
        e.noise(
          out,
          at,
          0.018,
          { type: 'bandpass', frequency: 2600 + Math.random() * 1600, q: 1.4 },
          0.35,
        );
        at += 0.026 - i * 0.0006;
      }
    }
  },
  win: (e, _c, out, t) => {
    [523.25, 659.25, 783.99].forEach((f, i) =>
      e.tone(out, t + i * 0.085, f, 0.32, { type: 'triangle', peak: 0.2 }),
    );
  },
  push: (e, _c, out, t) => {
    e.tone(out, t, 440, 0.18, { type: 'sine', peak: 0.14 });
    e.tone(out, t + 0.12, 440, 0.2, { type: 'sine', peak: 0.12 });
  },
  lose: (e, _c, out, t) => {
    e.tone(out, t, 170, 0.32, { type: 'sine', peak: 0.35, endFrequency: 85 });
    e.noise(out, t, 0.12, { type: 'lowpass', frequency: 400 }, 0.3);
  },
  bust: (e, _c, out, t) => {
    e.tone(out, t, 330, 0.36, { type: 'sawtooth', peak: 0.12, endFrequency: 140, lowpass: 900 });
    e.noise(out, t, 0.15, { type: 'lowpass', frequency: 600 }, 0.25);
  },
  blackjack: (e, _c, out, t) => {
    const chords = [
      [392, 493.88, 587.33],
      [523.25, 659.25, 783.99],
      [659.25, 783.99, 1046.5],
    ];
    chords.forEach((chord, i) =>
      chord.forEach((f) =>
        e.tone(out, t + i * 0.13, f, i === 2 ? 0.7 : 0.18, {
          type: 'sawtooth',
          peak: 0.07,
          lowpass: 2400,
        }),
      ),
    );
    for (let i = 0; i < 6; i++) {
      e.tone(out, t + 0.3 + i * 0.05, 2093 + i * 220, 0.18, { type: 'sine', peak: 0.05 });
    }
  },
  levelUp: (e, _c, out, t) => {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      e.tone(out, t + i * 0.07, f, 0.5, { type: 'triangle', peak: 0.16 }),
    );
    e.noise(out, t + 0.3, 0.6, { type: 'highpass', frequency: 7000 }, 0.12);
  },
  jackpot: (e, _c, out, t) => {
    for (let i = 0; i < 10; i++) {
      const f = [1046.5, 1318.5, 1568, 2093][i % 4] as number;
      e.tone(out, t + i * 0.06, f, 0.5, { type: 'sine', peak: 0.12 });
      e.tone(out, t + i * 0.06, f * 2.76, 0.3, { type: 'sine', peak: 0.03 });
    }
  },
  click: (e, _c, out, t) =>
    e.tone(out, t, 1200, 0.03, { type: 'square', peak: 0.04, attack: 0.001 }),
};

export const soundEngine = new SoundEngine();
