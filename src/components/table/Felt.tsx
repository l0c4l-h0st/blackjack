import { memo } from 'react';
import type { LayoutMode } from '../../fx/layout';
import { stageSize } from '../../fx/layout';

interface FeltShape {
  outline: string;
  textArc1: string;
  textArc2: string;
}

const SHAPES: Record<LayoutMode, FeltShape> = {
  desktop: {
    outline: 'M24 14 H1176 V420 C1176 420 1100 690 600 690 C100 690 24 420 24 420 Z',
    textArc1: 'M250 236 Q600 352 950 236',
    textArc2: 'M200 262 Q600 392 1000 262',
  },
  mobile: {
    outline: 'M10 10 H410 V420 C410 420 400 612 210 612 C20 612 10 420 10 420 Z',
    textArc1: 'M30 250 Q210 306 390 250',
    textArc2: 'M40 272 Q210 330 380 272',
  },
};

const SPARKLES = Array.from({ length: 18 }, (_, i) => ({
  x: (Math.sin(i * 91.7) * 0.5 + 0.5) * 0.9 + 0.05,
  y: (Math.cos(i * 37.3) * 0.5 + 0.5) * 0.7 + 0.05,
  delay: (i * 0.37) % 3.2,
}));

/** Tapis : ardoise sombre en dégradé radial, liseré lumineux à la couleur d'accent. */
export const Felt = memo(function Felt({ mode, sparkle }: { mode: LayoutMode; sparkle: boolean }) {
  const { width, height } = stageSize(mode);
  const shape = SHAPES[mode];
  return (
    <div className="stage-layer" aria-hidden="true">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="absolute inset-0"
      >
        <defs>
          <radialGradient id="felt-grad" cx="50%" cy="40%" r="70%">
            <stop offset="0" style={{ stopColor: 'var(--felt-1)' }} />
            <stop offset="0.75" style={{ stopColor: 'var(--felt-2)' }} />
            <stop offset="1" stopColor="#05060b" />
          </radialGradient>
          <filter id="felt-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <pattern id="felt-noise" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="transparent" />
            <circle cx="1" cy="1" r="0.6" fill="#fff" opacity="0.025" />
            <circle cx="4" cy="3.5" r="0.5" fill="#000" opacity="0.08" />
          </pattern>
          <path id={`arc1-${mode}`} d={shape.textArc1} />
          <path id={`arc2-${mode}`} d={shape.textArc2} />
        </defs>
        <path d={shape.outline} fill="url(#felt-grad)" />
        <path d={shape.outline} fill="url(#felt-noise)" />
        <path
          d={shape.outline}
          fill="none"
          style={{ stroke: 'var(--accent)' }}
          strokeWidth="10"
          opacity="0.35"
          filter="url(#felt-glow)"
        />
        <path
          d={shape.outline}
          fill="none"
          style={{ stroke: 'var(--accent)' }}
          strokeWidth="2"
          opacity="0.9"
        />
        <path
          d={shape.outline}
          fill="none"
          stroke="#fff"
          strokeWidth="0.6"
          opacity="0.15"
          transform="translate(0 6)"
        />
        <text
          fontFamily="'Space Grotesk', Inter, sans-serif"
          fontWeight={700}
          fontSize={mode === 'desktop' ? 19 : 14}
          letterSpacing="0.28em"
          style={{ fill: 'var(--accent)' }}
          opacity="0.75"
        >
          <textPath href={`#arc1-${mode}`} startOffset="50%" textAnchor="middle">
            BLACKJACK PAYE 3 CONTRE 2
          </textPath>
        </text>
        <text
          fontFamily="Inter, sans-serif"
          fontWeight={600}
          fontSize={mode === 'desktop' ? 12 : 9.5}
          letterSpacing="0.22em"
          fill="#c7cde0"
          opacity="0.5"
        >
          <textPath href={`#arc2-${mode}`} startOffset="50%" textAnchor="middle">
            {mode === 'desktop'
              ? 'LE CROUPIER RESTE SUR TOUS LES 17 · ASSURANCE PAYE 2 CONTRE 1'
              : 'CROUPIER RESTE SUR 17 · ASSURANCE 2:1'}
          </textPath>
        </text>
      </svg>
      {sparkle &&
        SPARKLES.map((s, i) => (
          <span
            key={i}
            className="sparkle absolute h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_8px_2px_rgba(245,196,81,0.7)]"
            style={{ left: s.x * width, top: s.y * height, animationDelay: `${s.delay}s` }}
          />
        ))}
    </div>
  );
});
