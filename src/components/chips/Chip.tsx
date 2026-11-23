import { memo } from 'react';
import { chipStyle, formatCredits } from '../../config/chips';

const EDGE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export interface ChipProps {
  value: number;
  size?: number;
  className?: string;
  /** Masque le texte alternatif (jeton décoratif dans une pile). */
  decorative?: boolean;
}

/** Jeton SVG : bord rayé, anneau pointillé, valeur au centre. */
export const Chip = memo(function Chip({
  value,
  size = 48,
  className,
  decorative = false,
}: ChipProps) {
  const s = chipStyle(value);
  const fontSize = s.label.length >= 4 ? 13 : s.label.length === 3 ? 15 : 17;
  return (
    <svg
      viewBox="0 0 64 68"
      width={size}
      height={(size * 68) / 64}
      className={className}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : `Jeton de ${formatCredits(value)}`}
    >
      {/* tranche */}
      <circle cx="32" cy="36" r="30.5" fill={s.color} />
      <circle cx="32" cy="36" r="30.5" fill="#000" opacity="0.35" />
      {/* face */}
      <circle cx="32" cy="32" r="30.5" fill={s.color} />
      {EDGE_ANGLES.map((a) => (
        <rect
          key={a}
          x="28.5"
          y="1.5"
          width="7"
          height="10"
          rx="1.5"
          fill={s.edge}
          transform={`rotate(${a} 32 32)`}
        />
      ))}
      <circle
        cx="32"
        cy="32"
        r="21.5"
        fill="none"
        stroke={s.edge}
        strokeWidth="1.6"
        strokeDasharray="3.2 2.6"
        opacity="0.9"
      />
      <circle cx="32" cy="32" r="17.5" fill={s.color} />
      <circle cx="32" cy="32" r="17.5" fill="#fff" opacity="0.1" />
      <circle cx="32" cy="32" r="30.5" fill="url(#chip-shine)" />
      <text
        x="32"
        y={32 + fontSize * 0.36}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={700}
        fontFamily="'Space Grotesk', Inter, sans-serif"
        fill={s.text}
      >
        {s.label}
      </text>
    </svg>
  );
});
