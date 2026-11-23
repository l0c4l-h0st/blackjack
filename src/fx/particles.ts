/**
 * Moteur de particules Canvas 2D maison (overlay plein écran, `pointer-events: none`).
 * La boucle `requestAnimationFrame` ne tourne que tant qu'il reste des particules.
 */

export type BurstKind = 'sparks' | 'confetti' | 'coins' | 'rings' | 'explosion' | 'chipRain';

interface Particle {
  shape: 'streak' | 'rect' | 'coin' | 'ring' | 'disc';
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rotation: number;
  spin: number;
  /** Anneaux : rayon de départ et vitesse d'expansion. */
  growth: number;
  delay: number;
}

const GOLD = ['#f5c451', '#ffe08a', '#ffb627', '#fff4d0'];
const CONFETTI = ['#7c5cff', '#2ee6a6', '#f5c451', '#ff4d6d', '#22d3ee', '#e8508f', '#ffffff'];
const CHIP_COLORS = ['#e0344c', '#2f6fdc', '#7c4dff', '#f0a020', '#13a874', '#e8508f'];

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T;

/** Nombre max de particules simultanées (garde-fou de performance). */
const MAX_PARTICLES = 900;

export class ParticleEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private frame: number | null = null;
  private last = 0;
  private dpr = 1;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
  }

  detach(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
  }

  resize(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    this.dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    canvas.width = Math.floor(innerWidth * this.dpr);
    canvas.height = Math.floor(innerHeight * this.dpr);
  }

  get count(): number {
    return this.particles.length;
  }

  burst(kind: BurstKind, x: number, y: number, intensity = 1): void {
    if (!this.ctx) return;
    const add = (p: Partial<Particle> & Pick<Particle, 'shape' | 'x' | 'y'>) => {
      if (this.particles.length >= MAX_PARTICLES) return;
      const life = p.maxLife ?? 1;
      this.particles.push({
        vx: 0,
        vy: 0,
        gravity: 0,
        drag: 0,
        size: 4,
        color: '#fff',
        rotation: 0,
        spin: 0,
        growth: 0,
        delay: 0,
        ...p,
        life,
        maxLife: life,
      });
    };
    const n = (base: number) => Math.round(base * intensity);
    const w = innerWidth;
    const h = innerHeight;

    switch (kind) {
      case 'sparks':
        for (let i = 0; i < n(80); i++) {
          const a = rand(-Math.PI, 0) + rand(-0.4, 0.4);
          const speed = rand(180, 620);
          add({
            shape: 'streak',
            x,
            y,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            gravity: 700,
            drag: 1.2,
            maxLife: rand(0.7, 1.4),
            size: rand(1.5, 3),
            color: pick(GOLD),
          });
        }
        break;
      case 'rings':
        for (let i = 0; i < 3; i++) {
          add({
            shape: 'ring',
            x,
            y,
            maxLife: 1.1,
            size: 10,
            growth: 260,
            color: pick(GOLD.slice(i)),
            delay: i * 0.18,
          });
        }
        break;
      case 'confetti':
        for (let i = 0; i < n(160); i++) {
          add({
            shape: 'rect',
            x: rand(0, w),
            y: rand(-h * 0.3, -10),
            vx: rand(-60, 60),
            vy: rand(80, 260),
            gravity: 160,
            drag: 0.4,
            maxLife: rand(2.2, 3.4),
            size: rand(5, 10),
            color: pick(CONFETTI),
            rotation: rand(0, Math.PI),
            spin: rand(-8, 8),
          });
        }
        break;
      case 'coins':
        for (let i = 0; i < n(50); i++) {
          add({
            shape: 'coin',
            x: rand(w * 0.15, w * 0.85),
            y: rand(-h * 0.5, -20),
            vx: rand(-30, 30),
            vy: rand(150, 350),
            gravity: 900,
            maxLife: rand(1.6, 2.4),
            size: rand(7, 12),
            color: pick(GOLD),
            rotation: rand(0, Math.PI),
            spin: rand(-10, 10),
          });
        }
        break;
      case 'chipRain':
        for (let i = 0; i < n(60); i++) {
          add({
            shape: 'disc',
            x: rand(0, w),
            y: rand(-h * 0.6, -20),
            vx: rand(-40, 40),
            vy: rand(100, 300),
            gravity: 800,
            maxLife: rand(1.8, 2.8),
            size: rand(10, 16),
            color: pick(CHIP_COLORS),
            rotation: rand(0, Math.PI),
            spin: rand(-6, 6),
          });
        }
        break;
      case 'explosion':
        for (let i = 0; i < n(240); i++) {
          const a = rand(0, Math.PI * 2);
          const speed = rand(150, 900);
          add({
            shape: i % 3 === 0 ? 'rect' : 'streak',
            x,
            y,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            gravity: 260,
            drag: 1.4,
            maxLife: rand(1.2, 2.2),
            size: rand(2, 7),
            color: pick(i % 2 ? CONFETTI : GOLD),
            rotation: rand(0, Math.PI),
            spin: rand(-10, 10),
          });
        }
        for (let i = 0; i < 4; i++) {
          add({
            shape: 'ring',
            x,
            y,
            maxLife: 1.3,
            size: 20,
            growth: 520,
            color: pick(GOLD),
            delay: i * 0.15,
          });
        }
        break;
    }
    if (this.frame === null) {
      this.last = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  private readonly tick = (now: number): void => {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) {
      this.frame = null;
      return;
    }
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const alive: Particle[] = [];
    for (const p of this.particles) {
      if (p.delay > 0) {
        p.delay -= dt;
        alive.push(p);
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += p.gravity * dt;
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
      if (p.y > innerHeight + 40) continue;
      alive.push(p);
      this.draw(ctx, p);
    }
    this.particles = alive;
    if (alive.length > 0) {
      this.frame = requestAnimationFrame(this.tick);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.frame = null;
    }
  };

  private draw(ctx: CanvasRenderingContext2D, p: Particle): void {
    const t = p.life / p.maxLife;
    ctx.globalAlpha = Math.min(1, t * 1.6);
    switch (p.shape) {
      case 'streak': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'rect':
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(1, Math.cos(p.rotation * 2));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
        break;
      case 'coin':
      case 'disc':
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(Math.abs(Math.cos(p.rotation)) * 0.8 + 0.2, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p.shape === 'coin' ? '#a8790f' : '#ffffff';
        ctx.lineWidth = p.shape === 'coin' ? 1.5 : 2;
        ctx.setLineDash(p.shape === 'disc' ? [3, 3] : []);
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        break;
      case 'ring': {
        const radius = p.size + p.growth * (1 - t);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * t + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
    }
    ctx.globalAlpha = 1;
  }
}

export const particles = new ParticleEngine();
