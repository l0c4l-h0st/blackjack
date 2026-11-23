import { create } from 'zustand';
import type { Point } from '../fx/layout';

export type FlightMode = 'toss' | 'slide' | 'suck';

export interface ChipFlight {
  id: number;
  chips: number[];
  from: Point;
  to: Point;
  mode: FlightMode;
  /** Facteur de vitesse au moment du lancement. */
  factor: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  tone: 'win' | 'loss' | 'gold' | 'info';
}

interface FxStore {
  flights: ChipFlight[];
  floats: FloatingText[];
  /** Incrémenté pour déclencher une secousse d'écran. */
  shake: number;
  addFlight: (flight: Omit<ChipFlight, 'id'>) => void;
  removeFlight: (id: number) => void;
  addFloat: (text: Omit<FloatingText, 'id'>) => void;
  removeFloat: (id: number) => void;
  triggerShake: () => void;
  clear: () => void;
}

let nextId = 1;

export const useFxStore = create<FxStore>()((set) => ({
  flights: [],
  floats: [],
  shake: 0,
  addFlight: (flight) => set((s) => ({ flights: [...s.flights, { ...flight, id: nextId++ }] })),
  removeFlight: (id) => set((s) => ({ flights: s.flights.filter((f) => f.id !== id) })),
  addFloat: (text) => set((s) => ({ floats: [...s.floats, { ...text, id: nextId++ }] })),
  removeFloat: (id) => set((s) => ({ floats: s.floats.filter((f) => f.id !== id) })),
  triggerShake: () => set((s) => ({ shake: s.shake + 1 })),
  clear: () => set({ flights: [], floats: [] }),
}));
