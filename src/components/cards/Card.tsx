import { memo } from 'react';
import { RANK_LABELS_FR, cardLabel } from '../../engine/cards';
import type { Card as CardModel, Rank, Suit } from '../../engine/types';
import { suitColor } from './suitColors';

type Pip = [number, number];

/** Positions des pips (repère 140 × 200). Les pips de la moitié basse sont retournés. */
const PIPS: Partial<Record<Rank, Pip[]>> = {
  '2': [
    [70, 46],
    [70, 154],
  ],
  '3': [
    [70, 46],
    [70, 100],
    [70, 154],
  ],
  '4': [
    [44, 46],
    [96, 46],
    [44, 154],
    [96, 154],
  ],
  '5': [
    [44, 46],
    [96, 46],
    [70, 100],
    [44, 154],
    [96, 154],
  ],
  '6': [
    [44, 46],
    [96, 46],
    [44, 100],
    [96, 100],
    [44, 154],
    [96, 154],
  ],
  '7': [
    [44, 46],
    [96, 46],
    [70, 73],
    [44, 100],
    [96, 100],
    [44, 154],
    [96, 154],
  ],
  '8': [
    [44, 46],
    [96, 46],
    [70, 73],
    [44, 100],
    [96, 100],
    [70, 127],
    [44, 154],
    [96, 154],
  ],
  '9': [
    [44, 46],
    [96, 46],
    [44, 82],
    [96, 82],
    [70, 100],
    [44, 118],
    [96, 118],
    [44, 154],
    [96, 154],
  ],
  '10': [
    [44, 46],
    [96, 46],
    [70, 64],
    [44, 82],
    [96, 82],
    [44, 118],
    [96, 118],
    [70, 136],
    [44, 154],
    [96, 154],
  ],
};

function SuitUse({
  suit,
  x,
  y,
  size,
  flip = false,
}: {
  suit: Suit;
  x: number;
  y: number;
  size: number;
  flip?: boolean;
}) {
  return (
    <use
      href={`#suit-${suit}`}
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      transform={flip ? `rotate(180 ${x} ${y})` : undefined}
    />
  );
}

function CornerIndex({ rank, suit }: { rank: Rank; suit: Suit }) {
  const label = RANK_LABELS_FR[rank];
  return (
    <g>
      <text
        x={17}
        y={33}
        textAnchor="middle"
        fontSize={label.length > 1 ? 24 : 28}
        fontWeight={700}
        fontFamily="'Space Grotesk', Inter, sans-serif"
        letterSpacing={label.length > 1 ? -2 : 0}
      >
        {label}
      </text>
      <SuitUse suit={suit} x={17} y={48} size={17} />
    </g>
  );
}

/** Figures géométriques originales : moitié haute dessinée puis reflétée. */
function CourtHalf({ rank, suit, color }: { rank: Rank; suit: Suit; color: string }) {
  const gold = '#c9a227';
  const ink = '#1b2030';
  return (
    <g>
      {/* buste */}
      <path d="M44 100 L52 76 L88 76 L96 100 Z" fill={color} opacity="0.9" />
      <path d="M52 76 L70 92 L88 76" fill="none" stroke={gold} strokeWidth="2.5" />
      <SuitUse suit={suit} x={70} y={88} size={10} />
      {/* visage */}
      <circle cx="70" cy="62" r="12" fill="#f1dcc4" stroke={ink} strokeWidth="1.5" />
      <path d="M64 63h3M73 63h3" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
      {rank === 'K' && (
        <>
          <path
            d="M54 50 L57 34 L63 44 L70 30 L77 44 L83 34 L86 50 Z"
            fill={gold}
            stroke={ink}
            strokeWidth="1.3"
          />
          <circle cx="70" cy="38" r="2.2" fill={color} />
          <path d="M60 70 Q70 80 80 70 L78 76 Q70 84 62 76 Z" fill={ink} opacity="0.85" />
        </>
      )}
      {rank === 'Q' && (
        <>
          <path d="M56 50 Q63 38 70 46 Q77 38 84 50 Z" fill={gold} stroke={ink} strokeWidth="1.3" />
          <path d="M70 34 L74 41 L70 48 L66 41 Z" fill={color} stroke={ink} strokeWidth="1" />
          <path
            d="M57 56 Q52 72 58 82 M83 56 Q88 72 82 82"
            fill="none"
            stroke={ink}
            strokeWidth="2.2"
          />
        </>
      )}
      {rank === 'J' && (
        <>
          <path d="M55 52 L60 38 L84 38 L86 52 Z" fill={color} stroke={ink} strokeWidth="1.3" />
          <path
            d="M84 40 Q98 30 94 18"
            fill="none"
            stroke={gold}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <rect x="55" y="49" width="31" height="4" fill={gold} />
        </>
      )}
    </g>
  );
}

function CardFaceInner({ rank, suit, color }: { rank: Rank; suit: Suit; color: string }) {
  const pips = PIPS[rank];
  if (rank === 'A') {
    return (
      <g>
        <circle
          cx="70"
          cy="100"
          r="40"
          fill="none"
          stroke={color}
          strokeOpacity="0.22"
          strokeWidth="2"
        />
        <circle
          cx="70"
          cy="100"
          r="46"
          fill="none"
          stroke={color}
          strokeOpacity="0.12"
          strokeWidth="1"
          strokeDasharray="2 4"
        />
        <SuitUse suit={suit} x={70} y={100} size={56} />
      </g>
    );
  }
  if (pips) {
    return (
      <g>
        {pips.map(([x, y], i) => (
          <SuitUse key={i} suit={suit} x={x} y={y} size={27} flip={y > 100} />
        ))}
      </g>
    );
  }
  return (
    <g>
      <rect
        x="34"
        y="28"
        width="72"
        height="144"
        rx="6"
        fill={color}
        fillOpacity="0.07"
        stroke={color}
        strokeWidth="1.5"
      />
      <CourtHalf rank={rank} suit={suit} color={color} />
      <g transform="rotate(180 70 100)">
        <CourtHalf rank={rank} suit={suit} color={color} />
      </g>
      <path d="M36 100 H104" stroke={color} strokeWidth="1" strokeOpacity="0.5" />
    </g>
  );
}

export interface CardFaceProps {
  card: Pick<CardModel, 'rank' | 'suit'>;
  fourColor: boolean;
  className?: string;
}

/** Face d'une carte (SVG). Texte alternatif : « Roi de pique ». */
export const CardFace = memo(function CardFace({ card, fourColor, className }: CardFaceProps) {
  const color = suitColor(card.suit, fourColor);
  return (
    <svg viewBox="0 0 140 200" className={className} role="img" aria-label={cardLabel(card)}>
      <rect
        x="1"
        y="1"
        width="138"
        height="198"
        rx="11"
        fill="#f8f6f0"
        stroke="#d6d0c0"
        strokeWidth="1.5"
      />
      <rect
        x="7"
        y="7"
        width="126"
        height="186"
        rx="7"
        fill="none"
        stroke="#000"
        strokeOpacity="0.05"
      />
      <g fill={color}>
        <CornerIndex rank={card.rank} suit={card.suit} />
        <g transform="rotate(180 70 100)">
          <CornerIndex rank={card.rank} suit={card.suit} />
        </g>
        <CardFaceInner rank={card.rank} suit={card.suit} color={color} />
      </g>
    </svg>
  );
});

/** Dos de carte : treillis géométrique à la couleur d'accent de la table. */
export const CardBack = memo(function CardBack({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 200" className={className} role="img" aria-label="Carte face cachée">
      <rect
        x="1"
        y="1"
        width="138"
        height="198"
        rx="11"
        fill="#0f1424"
        stroke="#2a3350"
        strokeWidth="1.5"
      />
      <rect x="9" y="9" width="122" height="182" rx="6" fill="url(#card-back-lattice)" />
      <rect x="9" y="9" width="122" height="182" rx="6" fill="url(#card-back-glow)" />
      <rect
        x="9"
        y="9"
        width="122"
        height="182"
        rx="6"
        fill="none"
        style={{ stroke: 'var(--accent)' }}
        strokeWidth="2"
      />
      <path
        d="M70 62 L104 100 L70 138 L36 100 Z"
        fill="#0f1424"
        style={{ stroke: 'var(--accent)' }}
        strokeWidth="2.5"
      />
      <text
        x="70"
        y="109"
        textAnchor="middle"
        fontSize="26"
        fontWeight={700}
        fontFamily="'Space Grotesk', Inter, sans-serif"
        style={{ fill: 'var(--accent)' }}
      >
        21
      </text>
    </svg>
  );
});
